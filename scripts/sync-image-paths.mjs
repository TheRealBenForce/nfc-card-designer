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
import { scanImageAvailabilityFromS3, s3BucketFromEnv } from "./s3-storage.mjs";

function parseArgs() {
  const platformArg = process.argv.find((arg) => arg.startsWith("--platform="));
  return {
    platformId: platformArg?.split("=")[1],
    localOnly: process.argv.includes("--local-only"),
    s3Only: process.argv.includes("--s3-only"),
    prune: process.argv.includes("--prune"),
  };
}

async function main() {
  const { platformId, localOnly, s3Only, prune } = parseArgs();
  if (localOnly && s3Only) {
    throw new Error("Choose either --local-only or --s3-only, not both.");
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
      throw new Error("S3_BUCKET is required unless --local-only is passed.");
    }
    const fromS3 = await scanImageAvailabilityFromS3(platformId);
    availability = mergeImageAvailability(availability, fromS3);
    console.log(
      `Scanned s3://${bucket}/: ${countGames(availability)} game(s) with PNGs across ${Object.keys(availability).length} platform(s).`,
    );
  }

  const { games } = await import(pathToFileURL(gamesPath).href);
  const targets = platformId ? games.filter((game) => game.platformId === platformId) : games;
  if (targets.length === 0) {
    throw new Error(platformId ? `No games found for platform "${platformId}".` : "No games in games.js.");
  }

  let updatedGames = 0;
  let clearedGames = 0;

  const finalGames = games.map((game) => {
    if (platformId && game.platformId !== platformId) {
      return game;
    }

    const types = availability[game.platformId]?.[String(game.raGameId)] ?? [];
    const nextImages = types.length > 0 ? imagePathsForTypes(game.platformId, game.raGameId, types) : {};

    const previousImages = game.images ?? {};
    const changed =
      JSON.stringify(previousImages) !== JSON.stringify(nextImages) ||
      (prune && types.length === 0 && Object.keys(previousImages).length > 0);

    if (!changed) {
      return game;
    }

    if (types.length > 0) {
      updatedGames += 1;
    } else if (Object.keys(previousImages).length > 0) {
      clearedGames += 1;
    }

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
      `  ${countGames(availability)} indexed game(s) total`,
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
