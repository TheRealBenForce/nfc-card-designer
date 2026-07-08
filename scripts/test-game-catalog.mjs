#!/usr/bin/env node
/**
 * Validates games-by-platform.json structure and search helpers.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gamesToByPlatform } from "./games-data.mjs";
import { isRetailRelease } from "../src/assets/js/retailFilter.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = path.join(root, "src/assets/data/games-by-platform.json");
const raw = await readFile(jsonPath, "utf8");
const data = JSON.parse(raw);

if (!data.platforms || typeof data.platforms !== "object") {
  throw new Error("games-by-platform.json must include a platforms object");
}

if (data.retailOnly !== true) {
  throw new Error("games-by-platform.json should be marked retailOnly: true");
}

const platformIds = Object.keys(data.platforms);
if (platformIds.length === 0) {
  throw new Error("Expected at least one platform in games-by-platform.json");
}

for (const platformId of platformIds) {
  const games = data.platforms[platformId];
  if (!Array.isArray(games)) {
    throw new Error(`Platform "${platformId}" games must be an array`);
  }

  for (const game of games) {
    if (!game.name || typeof game.raGameId !== "number") {
      throw new Error(`Invalid game entry under "${platformId}"`);
    }
    if (!isRetailRelease(game.name)) {
      throw new Error(`Non-retail game in catalog JSON: ${game.name}`);
    }
  }
}

const { games } = await import(pathToFileURL(path.join(root, "src/assets/js/data/games.js")).href);
const converted = gamesToByPlatform(games, { retailOnly: true });

for (const platformId of Object.keys(converted)) {
  const count = converted[platformId].length;
  const jsonCount = data.platforms[platformId]?.length ?? 0;
  if (count !== jsonCount) {
    throw new Error(`Platform "${platformId}" count mismatch: games.js=${count}, json=${jsonCount}`);
  }
}

const nesGames = data.platforms.nes ?? [];
const marioMatches = nesGames.filter((g) => g.name.toLowerCase().includes("mario"));
if (marioMatches.length === 0) {
  throw new Error("Expected at least one Mario game on NES in catalog JSON");
}

console.log(`✓ games-by-platform.json has ${platformIds.length} platforms`);
console.log(`✓ Catalog entries match games.js (${games.length} total games)`);
console.log("✓ Sample NES search data present");
