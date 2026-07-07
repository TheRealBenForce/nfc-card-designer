#!/usr/bin/env node
/**
 * Downloads libretro thumbnails and uploads them to S3 (and optionally keeps local copies).
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { libretroImageUrl, resolveLibretroFilename } from "./libretro-thumbnails.mjs";
import {
  gamesPath,
  writeGamesJs,
  gameImagePath,
  gameImageDir,
  existingImageTypes,
  writeImageAvailabilityJson,
} from "./games-data.mjs";
import { imagePresent, s3BucketFromEnv, uploadFileToS3 } from "./s3-storage.mjs";

const IMAGE_TYPES = ["boxArt", "titleScreen", "gamePicture"];
const REQUEST_DELAY_MS = 150;

function parseArgs() {
  const platformArg = process.argv.find((a) => a.startsWith("--platform="));
  return {
    platformId: platformArg?.split("=")[1],
    force: process.argv.includes("--force"),
    localOnly: process.argv.includes("--local-only"),
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyImagePaths(game, platformId, raGameId, types = IMAGE_TYPES) {
  for (const type of types) {
    game.images[type] = gameImagePath(platformId, raGameId, type);
  }
}

async function downloadImage(url, destPath) {
  const res = await fetch(url, { headers: { "User-Agent": "nfc-card-designer/1.0" } });
  if (!res.ok) return false;
  await writeFile(destPath, Buffer.from(await res.arrayBuffer()));
  return true;
}

/**
 * @param {string} platformId
 * @param {number} raGameId
 * @param {string} type
 */
function objectKeyForImage(platformId, raGameId, type) {
  return gameImagePath(platformId, raGameId, type);
}

async function main() {
  const { platformId, force, localOnly } = parseArgs();
  const bucket = s3BucketFromEnv();
  const uploadToS3 = Boolean(bucket) && !localOnly;

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const platformsPath = path.join(root, "assets/js/data/platforms.js");
  const { platforms } = await import(pathToFileURL(platformsPath).href);
  const platformById = Object.fromEntries(platforms.map((p) => [p.id, p]));

  const { games } = await import(pathToFileURL(gamesPath).href);

  const targets = platformId ? games.filter((g) => g.platformId === platformId) : games;
  if (targets.length === 0) {
    console.error(platformId ? `No games found for platform "${platformId}".` : "No games in games.js.");
    process.exit(1);
  }

  if (games.length < 100) {
    console.warn(
      `\nWarning: games.js only has ${games.length} games (starter list).\n` +
        "Run npm run fetch-game-list first to pull the full RetroAchievements catalog.\n",
    );
  }

  if (force) {
    console.log("Force mode: re-downloading even when images already exist.\n");
  } else {
    console.log("Existing images are skipped (local disk and S3). Pass --force to re-download.\n");
  }

  if (uploadToS3) {
    console.log(`Upload target: s3://${bucket}/\n`);
  } else if (!localOnly && !bucket) {
    console.log("S3_BUCKET not set — saving images locally only.\n");
  }

  const stats = {
    downloaded: 0,
    skipped: 0,
    uploaded: 0,
    failed: 0,
    gamesDone: 0,
    gamesFullySkipped: 0,
  };
  const gameKey = (g) => `${g.platformId}:${g.raGameId}`;
  const updatedById = new Map(games.map((g) => [gameKey(g), { ...g, images: { ...g.images } }]));

  for (const game of targets) {
    const current = updatedById.get(gameKey(game));
    if (!current) continue;

    const platform = platformById[game.platformId];
    if (!platform?.libretroPlaylist) {
      console.warn(`Skipping ${game.name}: no libretro playlist for platform ${game.platformId}`);
      continue;
    }

    const dir = gameImageDir(game.platformId, game.raGameId);
    await mkdir(dir, { recursive: true });

    /** @type {string[]} */
    const alreadyPresent = [];
    /** @type {string[]} */
    const missingTypes = [];

    for (const type of IMAGE_TYPES) {
      const destPath = path.join(dir, `${type}.png`);
      const objectKey = objectKeyForImage(game.platformId, game.raGameId, type);
      if (!force && (await imagePresent(destPath, objectKey))) {
        alreadyPresent.push(type);
      } else {
        missingTypes.push(type);
      }
    }

    if (alreadyPresent.length > 0) {
      applyImagePaths(current, game.platformId, game.raGameId, alreadyPresent);
      stats.skipped += alreadyPresent.length;
    }

    if (missingTypes.length === 0) {
      stats.gamesFullySkipped += 1;
      stats.gamesDone += 1;
      console.log(
        `[${stats.gamesDone}/${targets.length}] ${game.name} (${game.raGameId}) — skipped (${IMAGE_TYPES.length}/${IMAGE_TYPES.length} present)`,
      );
      continue;
    }

    process.stdout.write(
      `[${stats.gamesDone + 1}/${targets.length}] ${game.name} (${game.raGameId}) — ` +
        `${alreadyPresent.length} skipped, fetching ${missingTypes.length}… `,
    );

    let gameDownloaded = 0;
    let gameFailed = 0;
    let resolvedLibretroName = current.libretroName ?? null;

    for (const type of missingTypes) {
      const destPath = path.join(dir, `${type}.png`);
      const objectKey = objectKeyForImage(game.platformId, game.raGameId, type);

      const libretroName = await resolveLibretroFilename(
        platform.libretroPlaylist,
        type,
        game.name,
        resolvedLibretroName,
      );

      if (!libretroName) {
        gameFailed += 1;
        stats.failed += 1;
        continue;
      }

      if (!resolvedLibretroName) resolvedLibretroName = libretroName;

      const url = libretroImageUrl(platform.libretroPlaylist, type, libretroName);
      const ok = await downloadImage(url, destPath);
      if (ok) {
        current.images[type] = gameImagePath(game.platformId, game.raGameId, type);
        gameDownloaded += 1;
        stats.downloaded += 1;

        if (uploadToS3) {
          const uploaded = await uploadFileToS3(destPath, objectKey);
          if (uploaded) stats.uploaded += 1;
        }
      } else {
        gameFailed += 1;
        stats.failed += 1;
      }

      await delay(REQUEST_DELAY_MS);
    }

    if (resolvedLibretroName) {
      current.libretroName = resolvedLibretroName;
    }

    console.log(`${gameDownloaded} downloaded, ${gameFailed} missing`);
    stats.gamesDone += 1;
  }

  const finalGames = [...updatedById.values()].sort((a, b) => {
    if (a.platformId !== b.platformId) return a.platformId.localeCompare(b.platformId);
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  await writeGamesJs(finalGames);
  await writeImageAvailabilityJson(finalGames);

  console.log(
    `\nDone. ${stats.downloaded} downloaded, ${stats.uploaded} uploaded, ${stats.skipped} skipped, ` +
      `${stats.failed} failed/missing (${stats.gamesFullySkipped} games already complete)`,
  );
  console.log(`Updated ${gamesPath}`);
  console.log("Updated assets/data/image-availability.json");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
