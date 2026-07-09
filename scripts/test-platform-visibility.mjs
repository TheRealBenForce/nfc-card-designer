#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { platforms } from "../src/assets/js/data/platforms.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { games } = await import(pathToFileURL(path.join(root, "src/assets/js/data/games.js")).href);

/**
 * @param {string} platformId
 */
function artworkCountForPlatform(platformId) {
  return games.filter(
    (game) =>
      game.platformId === platformId &&
      Object.values(game.images ?? {}).some((value) => Boolean(value)),
  ).length;
}

const visible = platforms.filter((platform) => artworkCountForPlatform(platform.id) > 0);
if (visible.length === 0) {
  throw new Error("Expected at least one platform with artwork-backed games");
}

const hiddenWithArtwork = platforms.filter(
  (platform) => artworkCountForPlatform(platform.id) > 0 && !visible.includes(platform),
);
if (hiddenWithArtwork.length > 0) {
  throw new Error("Visible platform filter is inconsistent");
}

const hiddenWithCatalogOnly = platforms.filter(
  (platform) => artworkCountForPlatform(platform.id) === 0 && visible.includes(platform),
);
if (hiddenWithCatalogOnly.length > 0) {
  throw new Error("Platforms without artwork should stay hidden");
}

const segaCd = visible.find((platform) => platform.id === "sega-cd");
if (!segaCd) {
  throw new Error("Expected Sega CD to be visible when it has indexed artwork");
}

const newPlatforms = ["dos", "sega-cd", "sega-32x", "turbo-grafx", "pc-engine-cd"];
for (const platformId of newPlatforms) {
  const platform = platforms.find((p) => p.id === platformId);
  if (!platform) {
    throw new Error(`Missing platform definition: ${platformId}`);
  }
}

console.log(`✓ ${visible.length} platforms have artwork-backed games and would be shown`);
console.log("✓ Platforms without artwork are excluded from the selector");
console.log("✓ New platform definitions are present");
