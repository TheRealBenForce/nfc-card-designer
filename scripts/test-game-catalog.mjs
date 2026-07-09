#!/usr/bin/env node
/**
 * Validates image-manifest.json structure and search helpers.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = path.join(root, "src/assets/data/image-manifest.json");
const raw = await readFile(jsonPath, "utf8");
const data = JSON.parse(raw);

if (data.version !== 1) {
  throw new Error("image-manifest.json must be version 1");
}

if (!data.platforms || typeof data.platforms !== "object") {
  throw new Error("image-manifest.json must include a platforms object");
}

const platformIds = Object.keys(data.platforms);
if (platformIds.length === 0) {
  throw new Error("Expected at least one platform in image-manifest.json");
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
    if (!game.images || typeof game.images !== "object") {
      throw new Error(`Missing images for "${game.libretroName}" under "${platformId}"`);
    }
    const hasImage = Object.values(game.images).some((value) => Boolean(value));
    if (!hasImage) {
      throw new Error(`Game "${game.libretroName}" has no image paths`);
    }
  }
}

if (!data.platforms["sega-cd"]?.some((game) => game.libretroName.includes("Ecco"))) {
  throw new Error("Expected Ecco the Dolphin sample in sega-cd manifest");
}

if (!data.platforms["sega-32x"]?.some((game) => game.libretroName.startsWith("Doom"))) {
  throw new Error("Expected Doom sample in sega-32x manifest");
}

console.log(`✓ image-manifest.json has ${platformIds.length} platforms`);
console.log("✓ Manifest entries include libretroName and image paths");
console.log("✓ Sample search fixtures present");
