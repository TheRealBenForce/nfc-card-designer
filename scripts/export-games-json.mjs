#!/usr/bin/env node
/**
 * Writes src/assets/data/games-by-platform.json from the flat games.js catalog.
 * fetch-game-list also writes this file automatically.
 */

import { pathToFileURL } from "node:url";
import { gamesPath, writeGamesByPlatformJson } from "./games-data.mjs";
import { isRetailRelease } from "./game-filters.mjs";

const { games } = await import(pathToFileURL(gamesPath).href);
const retailGames = games.filter((game) => isRetailRelease(game.name));
const excluded = games.length - retailGames.length;

await writeGamesByPlatformJson(retailGames, { retailOnly: true });

const platformCount = new Set(retailGames.map((g) => g.platformId)).size;
console.log(`Wrote ${retailGames.length} retail games across ${platformCount} platforms`);
if (excluded > 0) {
  console.log(`Excluded ${excluded} non-retail entries from JSON`);
}
console.log("Updated src/assets/data/games-by-platform.json");
