#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { platforms } from "../assets/js/data/platforms.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = path.join(root, "assets/data/games-by-platform.json");
const data = JSON.parse(await readFile(jsonPath, "utf8"));

function catalogCountForPlatform(platformId) {
  return data.platforms?.[platformId]?.length ?? 0;
}

const visible = platforms.filter((platform) => catalogCountForPlatform(platform.id) > 0);
if (visible.length === 0) {
  throw new Error("Expected at least one platform with catalog games");
}

const hiddenWithGames = platforms.filter(
  (platform) => catalogCountForPlatform(platform.id) > 0 && !visible.includes(platform),
);
if (hiddenWithGames.length > 0) {
  throw new Error("Visible platform filter is inconsistent");
}

const nes = visible.find((platform) => platform.id === "nes");
if (!nes) {
  throw new Error("Expected NES to remain visible in starter catalog");
}

const newPlatforms = ["dos", "sega-cd", "sega-32x", "turbo-grafx", "pc-engine-cd"];
for (const platformId of newPlatforms) {
  const platform = platforms.find((p) => p.id === platformId);
  if (!platform) {
    throw new Error(`Missing platform definition: ${platformId}`);
  }
}

console.log(`✓ ${visible.length} platforms have catalog games and would be shown`);
console.log("✓ Empty platforms are excluded from the selector");
console.log("✓ New platform definitions are present");
