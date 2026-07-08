#!/usr/bin/env node
/**
 * Pulls libretro thumbnails (CDN or local mirror) and uploads to S3
 * (and optionally keeps local copies).
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
import { imagePresent, s3BucketFromEnv, uploadBufferToS3, uploadFileToS3 } from "./s3-storage.mjs";
import {
  directoryExists,
  readLocalLibretroImage,
  resolveLocalLibretroFilename,
} from "./local-libretro-source.mjs";

const IMAGE_TYPES = ["boxArt", "titleScreen", "gamePicture"];
const REQUEST_DELAY_MS = 150;

/**
 * @param {string} name
 */
function argValue(name) {
  const prefix = `${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : null;
}

function parseArgs() {
  return {
    platformId: argValue("--platform"),
    libretroDir: argValue("--libretro-dir"),
    force: process.argv.includes("--force"),
    localOnly: process.argv.includes("--local-only"),
    s3Only: process.argv.includes("--s3-only"),
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

async function downloadImageBuffer(url) {
  const res = await fetch(url, { headers: { "User-Agent": "nfc-card-designer/1.0" } });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
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
  const { platformId, libretroDir, force, localOnly, s3Only } = parseArgs();
  if (localOnly && s3Only) {
    throw new Error("Choose either --local-only or --s3-only, not both.");
  }

  const localLibretroRoot = libretroDir ? path.resolve(libretroDir) : null;
  if (localLibretroRoot && !(await directoryExists(localLibretroRoot))) {
    throw new Error(`--libretro-dir does not exist or is not a directory: ${localLibretroRoot}`);
  }

  const bucket = s3BucketFromEnv();
  const uploadToS3 = Boolean(bucket) && !localOnly;
  const keepLocal = !s3Only;

  if (s3Only && !bucket) {
    throw new Error("S3_BUCKET is required when using --s3-only.");
  }

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const platformsPath = path.join(root, "src/assets/js/data/platforms.js");
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
    if (s3Only) {
      console.log("Existing images are skipped using S3 only. Pass --force to re-download.\n");
    } else if (localOnly) {
      console.log("Existing images are skipped using local disk only. Pass --force to re-download.\n");
    } else {
      console.log("Existing images are skipped (local disk and S3). Pass --force to re-download.\n");
    }
  }

  if (uploadToS3) {
    console.log(`Upload target: s3://${bucket}/\n`);
    if (s3Only) {
      console.log("S3-only mode: downloaded images are uploaded to S3 and not saved locally.\n");
    }
  } else if (!localOnly && !bucket) {
    console.log("S3_BUCKET not set — saving images locally only.\n");
  }

  if (localLibretroRoot) {
    console.log(`Using local libretro image source: ${localLibretroRoot}\n`);
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
    if (keepLocal) {
      await mkdir(dir, { recursive: true });
    }

    /** @type {string[]} */
    const alreadyPresent = [];
    /** @type {string[]} */
    const missingTypes = [];

    for (const type of IMAGE_TYPES) {
      const destPath = path.join(dir, `${type}.png`);
      const objectKey = objectKeyForImage(game.platformId, game.raGameId, type);
      if (!force && (await imagePresent(destPath, objectKey, { checkLocal: keepLocal, checkRemote: uploadToS3 }))) {
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
        `${alreadyPresent.length} skipped, processing ${missingTypes.length}… `,
    );

    let gameDownloaded = 0;
    let gameFailed = 0;
    let resolvedLibretroName = current.libretroName ?? null;

    for (const type of missingTypes) {
      const destPath = path.join(dir, `${type}.png`);
      const objectKey = objectKeyForImage(game.platformId, game.raGameId, type);

      let libretroName = null;
      let imageBuffer = null;

      if (localLibretroRoot) {
        libretroName = await resolveLocalLibretroFilename(
          localLibretroRoot,
          platform.libretroPlaylist,
          type,
          game.name,
          resolvedLibretroName,
        );
        if (libretroName) {
          imageBuffer = await readLocalLibretroImage(
            localLibretroRoot,
            platform.libretroPlaylist,
            type,
            libretroName,
          );
        }
      } else {
        libretroName = await resolveLibretroFilename(
          platform.libretroPlaylist,
          type,
          game.name,
          resolvedLibretroName,
        );
        if (libretroName) {
          const url = libretroImageUrl(platform.libretroPlaylist, type, libretroName);
          imageBuffer = await downloadImageBuffer(url);
        }
      }

      if (!libretroName || !imageBuffer) {
        gameFailed += 1;
        stats.failed += 1;
        continue;
      }

      if (!resolvedLibretroName) resolvedLibretroName = libretroName;

      if (keepLocal) {
        await writeFile(destPath, imageBuffer);
      }

      current.images[type] = gameImagePath(game.platformId, game.raGameId, type);
      gameDownloaded += 1;
      stats.downloaded += 1;

      if (uploadToS3) {
        const uploaded = keepLocal
          ? await uploadFileToS3(destPath, objectKey)
          : await uploadBufferToS3(imageBuffer, objectKey);
        if (uploaded) stats.uploaded += 1;
      }

      if (!localLibretroRoot) {
        await delay(REQUEST_DELAY_MS);
      }
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
  console.log("Updated src/assets/data/image-availability.json");
}
main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
