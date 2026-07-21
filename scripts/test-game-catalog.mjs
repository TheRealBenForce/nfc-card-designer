#!/usr/bin/env node
/**
 * Validates game-catalog.json structure.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = path.join(root, "src/assets/data/game-catalog.json");
const raw = await readFile(jsonPath, "utf8");
const data = JSON.parse(raw);

if (data.version !== 1) {
  throw new Error("game-catalog.json must be version 1");
}

if (!data.platforms || typeof data.platforms !== "object") {
  throw new Error("game-catalog.json must include a platforms object");
}

const platformIds = Object.keys(data.platforms);
if (platformIds.length === 0) {
  throw new Error("Expected at least one platform in game-catalog.json");
}

for (const platformId of platformIds) {
  const games = data.platforms[platformId];
  if (!Array.isArray(games)) {
    throw new Error(`Platform "${platformId}" games must be an array`);
  }

  for (const game of games) {
    if (!game.libretroName || typeof game.libretroName !== "string") {
      throw new Error(`Invalid game entry under "${platformId}"`);
    }
  }
}

if (!data.platforms["sega-cd"]?.some((game) => game.libretroName.includes("Ecco"))) {
  throw new Error("Expected Ecco the Dolphin sample in sega-cd catalog");
}

if (!data.platforms["sega-32x"]?.some((game) => game.libretroName.startsWith("Doom"))) {
  throw new Error("Expected Doom sample in sega-32x catalog");
}

console.log(`✓ game-catalog.json has ${platformIds.length} platforms`);
console.log("✓ Catalog entries include libretroName");
console.log("✓ Sample search fixtures present");
