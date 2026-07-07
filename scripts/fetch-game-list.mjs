#!/usr/bin/env node
/**
 * Fetches the full RetroAchievements game catalog for each platform and
 * writes assets/js/data/games.js (images populated later by fetch-images from libretro).
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { getGameList, delay } from "./ra-api.mjs";
import { gamesPath, writeGamesJs } from "./games-data.mjs";
import { isRetailRelease } from "./game-filters.mjs";
import { fetchLibretroGameCatalog } from "./libretro-catalog.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const platformsPath = path.join(root, "assets/js/data/platforms.js");

/** @param {Record<string, unknown>} entry */
function gameIdFromEntry(entry) {
  return Number(entry.ID ?? entry.id);
}

/** @param {Record<string, unknown>} entry */
function titleFromEntry(entry) {
  return String(entry.Title ?? entry.title ?? "").trim();
}

function parseArgs() {
  const platformArg = process.argv.find((a) => a.startsWith("--platform="));
  return {
    platformId: platformArg?.split("=")[1],
    onlyWithAchievements: process.argv.includes("--with-achievements"),
    includeNonRetail: process.argv.includes("--include-non-retail"),
  };
}

async function main() {
  const { platformId, onlyWithAchievements, includeNonRetail } = parseArgs();
  const retailOnly = !includeNonRetail;
  const { platforms } = await import(pathToFileURL(platformsPath).href);

  /** @type {import("../assets/js/data/games.js").Game[]} */
  let existing = [];
  if (platformId && existsSync(gamesPath)) {
    const { games } = await import(pathToFileURL(gamesPath).href);
    existing = games.filter((g) => g.platformId !== platformId);
  }

  /** @type {import("../assets/js/data/games.js").Game[]} */
  const games = [...existing];
  let excludedNonRetail = 0;

  for (const platform of platforms) {
    if (platformId && platform.id !== platformId) continue;

    process.stdout.write(`Fetching game list for ${platform.name}… `);
    try {
      if (platform.catalogSource === "libretro") {
        const catalog = await fetchLibretroGameCatalog(platform, { retailOnly });
        games.push(...catalog);
        console.log(`${catalog.length} retail games (libretro thumbnails)`);
        await delay(300);
        continue;
      }

      if (!platform.raConsoleId) {
        console.log("skipped (no catalog source configured)");
        continue;
      }

      const list = await getGameList(platform.raConsoleId, { onlyWithAchievements });
      if (!Array.isArray(list)) {
        console.log("failed (unexpected response)");
        continue;
      }

      const sorted = [...list].sort((a, b) =>
        titleFromEntry(a).localeCompare(titleFromEntry(b), undefined, { sensitivity: "base" }),
      );

      for (const entry of sorted) {
        const raGameId = gameIdFromEntry(entry);
        const name = titleFromEntry(entry);
        if (!raGameId || !name) continue;
        if (retailOnly && !isRetailRelease(name)) {
          excludedNonRetail += 1;
          continue;
        }

        games.push({
          platformId: platform.id,
          name,
          raGameId,
          images: {},
        });
      }

      const kept = sorted.filter((entry) => {
        const name = titleFromEntry(entry);
        return name && (!retailOnly || isRetailRelease(name));
      }).length;
      console.log(`${kept} retail games (${sorted.length} total on RA)`);
      await delay(300);
    } catch (err) {
      console.log(`failed (${err instanceof Error ? err.message : err})`);
    }
  }

  await writeGamesJs(games);
  console.log(`\nWrote ${games.length} games to assets/js/data/games.js`);
  console.log("Wrote assets/data/games-by-platform.json");
  if (retailOnly && excludedNonRetail > 0) {
    console.log(`Excluded ${excludedNonRetail} non-retail entries (hacks, homebrew, demos, etc.)`);
  }
  console.log("Run npm run fetch-images to download artwork.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
