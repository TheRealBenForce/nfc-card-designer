#!/usr/bin/env node
/**
 * Writes assets/data/games-by-platform.json from the flat games.js catalog.
 * fetch-game-list also writes this file automatically.
 */

import { pathToFileURL } from "node:url";
import { gamesPath, writeGamesByPlatformJson } from "./games-data.mjs";

const { games } = await import(pathToFileURL(gamesPath).href);
await writeGamesByPlatformJson(games);

const platformCount = new Set(games.map((g) => g.platformId)).size;
console.log(`Wrote ${games.length} games across ${platformCount} platforms to assets/data/games-by-platform.json`);
