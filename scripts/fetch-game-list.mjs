#!/usr/bin/env node
/**
 * Fetches the full libretro thumbnail catalog for each platform and
 * writes src/assets/js/data/games.js (images populated later by fetch-images).
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { gamesPath, writeGamesJs } from "./games-data.mjs";
import { fetchLibretroGameCatalog } from "./libretro-catalog.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const platformsPath = path.join(root, "src/assets/js/data/platforms.js");

function parseArgs() {
  const platformArg = process.argv.find((a) => a.startsWith("--platform="));
  return {
    platformId: platformArg?.split("=")[1],
    includeNonRetail: process.argv.includes("--include-non-retail"),
    withAchievements: process.argv.includes("--with-achievements"),
  };
}

/** @param {number} ms */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {string} platformId
 * @param {string} gameName
 */
function existingIdKey(platformId, gameName) {
  return `${platformId}\0${gameName.toLowerCase()}`;
}

async function main() {
  const { platformId, includeNonRetail, withAchievements } = parseArgs();
  const retailOnly = !includeNonRetail;
  const { platforms } = await import(pathToFileURL(platformsPath).href);

  /** @type {import("../src/assets/js/data/games.js").Game[]} */
  let existingAll = [];
  if (existsSync(gamesPath)) {
    const { games } = await import(pathToFileURL(gamesPath).href);
    existingAll = games;
  }

  /** @type {import("../src/assets/js/data/games.js").Game[]} */
  let existing = [];
  if (platformId) {
    existing = existingAll.filter((g) => g.platformId !== platformId);
  }

  /** @type {import("../src/assets/js/data/games.js").Game[]} */
  const games = [...existing];
  const existingIdByName = new Map(
    existingAll.map((game) => [existingIdKey(game.platformId, game.name), game.raGameId]),
  );

  if (withAchievements) {
    console.warn("--with-achievements is ignored (catalogs are now fetched from libretro).");
  }

  for (const platform of platforms) {
    if (platformId && platform.id !== platformId) continue;

    process.stdout.write(`Fetching game list for ${platform.name}… `);
    try {
      if (!platform.libretroPlaylist) {
        console.log("skipped (no libretro playlist configured)");
        continue;
      }

      const catalog = await fetchLibretroGameCatalog(platform, { retailOnly });
      const withStableIds = catalog.map((entry) => ({
        ...entry,
        raGameId: existingIdByName.get(existingIdKey(entry.platformId, entry.name)) ?? entry.raGameId,
      }));
      games.push(...withStableIds);
      console.log(
        retailOnly
          ? `${withStableIds.length} retail games (libretro thumbnails)`
          : `${withStableIds.length} games (libretro thumbnails)`,
      );
      await delay(300);
    } catch (err) {
      console.log(`failed (${err instanceof Error ? err.message : err})`);
    }
  }

  await writeGamesJs(games);
  console.log(`\nWrote ${games.length} games to src/assets/js/data/games.js`);
  console.log("Wrote src/assets/data/games-by-platform.json");
  console.log("Run npm run fetch-images to download artwork.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
