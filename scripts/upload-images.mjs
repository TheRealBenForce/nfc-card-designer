#!/usr/bin/env node
/**
 * Upload local game artwork PNGs to S3 without re-downloading from libretro.
 * Use after fetch-images --local-only or when S3 uploads were interrupted.
 */

import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  gamesPath,
  gameImagePath,
  writeGamesJs,
  writeImageAvailabilityJson,
} from "./games-data.mjs";
import { s3BucketFromEnv, uploadFileToS3 } from "./s3-storage.mjs";

const IMAGE_TYPES = ["boxArt", "titleScreen", "gamePicture"];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const platformsImageRoot = path.join(root, "assets/images/platforms");

function parseArgs() {
  const platformArg = process.argv.find((a) => a.startsWith("--platform="));
  return {
    platformId: platformArg?.split("=")[1],
    dryRun: process.argv.includes("--dry-run"),
  };
}

/**
 * @param {string} platformId
 * @returns {Promise<Array<{ raGameId: string, type: string, localPath: string, objectKey: string }>>}
 */
async function collectLocalImages(platformId) {
  const gamesDir = path.join(platformsImageRoot, platformId, "games");
  /** @type {Array<{ raGameId: string, type: string, localPath: string, objectKey: string }>} */
  const images = [];

  let gameEntries = [];
  try {
    gameEntries = await readdir(gamesDir, { withFileTypes: true });
  } catch {
    return images;
  }

  for (const gameEntry of gameEntries) {
    if (!gameEntry.isDirectory()) continue;
    const raGameId = gameEntry.name;
    if (!/^\d+$/.test(raGameId)) continue;

    const imageDir = path.join(gamesDir, raGameId);
    for (const type of IMAGE_TYPES) {
      const localPath = path.join(imageDir, `${type}.png`);
      try {
        const info = await stat(localPath);
        if (!info.isFile() || info.size === 0) continue;
      } catch {
        continue;
      }

      images.push({
        raGameId,
        type,
        localPath,
        objectKey: gameImagePath(platformId, Number(raGameId), type),
      });
    }
  }

  return images;
}

async function main() {
  const { platformId, dryRun } = parseArgs();
  const bucket = s3BucketFromEnv();
  if (!bucket && !dryRun) {
    throw new Error("S3_BUCKET is required (set in .env or environment). Pass --dry-run to list files only.");
  }

  const platformsPath = path.join(root, "assets/js/data/platforms.js");
  const { platforms } = await import(pathToFileURL(platformsPath).href);
  const targetPlatforms = platformId ? platforms.filter((p) => p.id === platformId) : platforms;

  if (targetPlatforms.length === 0) {
    throw new Error(platformId ? `Unknown platform "${platformId}".` : "No platforms configured.");
  }

  const { games } = await import(pathToFileURL(gamesPath).href);
  const gameKey = (g) => `${g.platformId}:${g.raGameId}`;
  const updatedById = new Map(games.map((g) => [gameKey(g), { ...g, images: { ...g.images } }]));

  let uploaded = 0;
  let skipped = 0;

  for (const platform of targetPlatforms) {
    const images = await collectLocalImages(platform.id);
    if (images.length === 0) {
      console.log(`${platform.name}: no local game images found`);
      continue;
    }

    console.log(`${platform.name}: ${images.length} local image(s)`);

    for (const image of images) {
      const game = updatedById.get(`${platform.id}:${image.raGameId}`);
      if (game) {
        game.images[image.type] = image.objectKey;
      }

      if (dryRun) {
        console.log(`  would upload ${image.objectKey}`);
        continue;
      }

      const ok = await uploadFileToS3(image.localPath, image.objectKey);
      if (ok) {
        uploaded += 1;
        console.log(`  uploaded ${image.objectKey}`);
      } else {
        skipped += 1;
        console.warn(`  failed ${image.objectKey}`);
      }
    }
  }

  if (!dryRun && uploaded > 0) {
    const finalGames = [...updatedById.values()].sort((a, b) => {
      if (a.platformId !== b.platformId) return a.platformId.localeCompare(b.platformId);
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
    await writeGamesJs(finalGames);
    await writeImageAvailabilityJson(finalGames);
    console.log(`\nUpdated ${gamesPath}`);
    console.log("Updated assets/data/image-availability.json");
  }

  console.log(
    dryRun
      ? "\nDry run complete (no uploads)."
      : `\nDone. ${uploaded} uploaded, ${skipped} failed.`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
