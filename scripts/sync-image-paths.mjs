#!/usr/bin/env node
/**
 * Sync games.js image path metadata from artwork on disk and/or S3.
 * Does not download from libretro — use this after uploading PNGs directly.
 *
 * Examples:
 *   npm run sync-image-paths -- --platform=atari-2600
 *   npm run sync-image-paths -- --s3-only
 *   npm run sync-image-paths -- --local-only --platform=sega-cd
 */

import { pathToFileURL } from "node:url";
import {
  gamesPath,
  writeGamesJs,
  scanImageAvailabilityFromDisk,
  mergeImageAvailability,
  imagePathsForTypes,
} from "./games-data.mjs";
import { loadDotEnv } from "./load-env.mjs";
import { scanImageAvailabilityFromS3, s3BucketFromEnv } from "./s3-storage.mjs";

const DEFAULT_S3_BUCKET = "zaparoo.therealbenforce.com";

function parseArgs() {
  const platformArg = process.argv.find((arg) => arg.startsWith("--platform="));
  const bucketArg = process.argv.find((arg) => arg.startsWith("--bucket="));
  return {
    platformId: platformArg?.split("=")[1],
    bucket: bucketArg?.split("=")[1]?.trim(),
    localOnly: process.argv.includes("--local-only"),
    s3Only: process.argv.includes("--s3-only"),
    prune: process.argv.includes("--prune"),
  };
}

async function main() {
  await loadDotEnv();

  const { platformId, bucket: bucketArg, localOnly, s3Only, prune } = parseArgs();
  if (localOnly && s3Only) {
    throw new Error("Choose either --local-only or --s3-only, not both.");
  }

  if (bucketArg) {
    process.env.S3_BUCKET = bucketArg;
  } else if (s3Only && !s3BucketFromEnv()) {
    process.env.S3_BUCKET = DEFAULT_S3_BUCKET;
  }

  /** @type {Record<string, Record<string, string[]>>} */
  let availability = {};

  if (!s3Only) {
    const fromDisk = await scanImageAvailabilityFromDisk();
    availability = mergeImageAvailability(availability, fromDisk);
    console.log(
      `Scanned local disk: ${countGames(availability)} game(s) with PNGs across ${Object.keys(availability).length} platform(s).`,
    );
  }

  if (!localOnly) {
    const bucket = s3BucketFromEnv();
    if (!bucket) {
      throw new Error(
        "S3_BUCKET is required unless --local-only is passed. Set it in .env, export it, or pass --bucket=<name>.",
      );
    }

    const prefix = platformId
      ? `assets/images/platforms/${platformId}/games/`
      : "assets/images/platforms/";
    console.log(`Scanning s3://${bucket}/${prefix}`);

    const fromS3 = await scanImageAvailabilityFromS3(platformId);
    availability = mergeImageAvailability(availability, fromS3);
    const s3GameCount = countGames(fromS3);
    console.log(
      `Scanned S3: ${s3GameCount} game(s) with PNGs across ${Object.keys(fromS3).length} platform(s).`,
    );

    if (s3Only && s3GameCount === 0) {
      throw new Error(
        `S3 scan found 0 game images under ${prefix}. Check AWS credentials, bucket name, and that PNG keys match assets/images/platforms/<platform>/games/<raGameId>/<type>.png`,
      );
    }
  }

  const indexedCount = countGames(availability);
  if (indexedCount === 0) {
    throw new Error("No artwork found to index. Nothing was written to games.js.");
  }

  const { games } = await import(pathToFileURL(gamesPath).href);
  const targets = platformId ? games.filter((game) => game.platformId === platformId) : games;
  if (targets.length === 0) {
    throw new Error(platformId ? `No games found for platform "${platformId}".` : "No games in games.js.");
  }

  let updatedGames = 0;
  let clearedGames = 0;
  let unchangedGames = 0;

  const finalGames = games.map((game) => {
    if (platformId && game.platformId !== platformId) {
      return game;
    }

    const types = availability[game.platformId]?.[String(game.raGameId)] ?? [];
    const previousImages = game.images ?? {};

    if (types.length === 0) {
      if (!prune || Object.keys(previousImages).length === 0) {
        unchangedGames += 1;
        return game;
      }
      clearedGames += 1;
      return { ...game, images: {} };
    }

    const nextImages = imagePathsForTypes(game.platformId, game.raGameId, types);
    if (JSON.stringify(previousImages) === JSON.stringify(nextImages)) {
      unchangedGames += 1;
      return game;
    }

    updatedGames += 1;
    return {
      ...game,
      images: nextImages,
    };
  });

  await writeGamesJs(finalGames);

  console.log(
    `\nUpdated ${gamesPath}\n` +
      `  ${updatedGames} game(s) now have image paths\n` +
      (prune ? `  ${clearedGames} game(s) had stale paths cleared\n` : "") +
      `  ${unchangedGames} game(s) left unchanged\n` +
      `  ${indexedCount} indexed game(s) total`,
  );
}

/**
 * @param {Record<string, Record<string, string[]>>} availability
 */
function countGames(availability) {
  return Object.values(availability).reduce((sum, games) => sum + Object.keys(games).length, 0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
