#!/usr/bin/env node
/**
 * Fetches the full RetroAchievements game catalog for each platform and
 * writes assets/js/data/games.js (images populated later by fetch-images).
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getGameList, delay } from "./ra-api.mjs";
import { writeGamesJs } from "./games-data.mjs";

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
  };
}

async function main() {
  const { platformId, onlyWithAchievements } = parseArgs();
  const { platforms } = await import(pathToFileURL(platformsPath).href);

  /** @type {import("../assets/js/data/games.js").Game[]} */
  const games = [];

  for (const platform of platforms) {
    if (platformId && platform.id !== platformId) continue;

    process.stdout.write(`Fetching game list for ${platform.name}… `);
    try {
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

        games.push({
          platformId: platform.id,
          name,
          raGameId,
          images: {},
        });
      }

      console.log(`${sorted.length} games`);
      await delay(300);
    } catch (err) {
      console.log(`failed (${err instanceof Error ? err.message : err})`);
    }
  }

  await writeGamesJs(games);
  console.log(`\nWrote ${games.length} games to assets/js/data/games.js`);
  console.log("Run npm run fetch-images to download artwork.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
