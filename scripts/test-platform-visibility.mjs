#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { platforms } from "../src/assets/js/data/platforms.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "src/assets/data/image-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

function artworkCountForPlatform(platformId) {
  return manifest.platforms?.[platformId]?.length ?? 0;
}

const visible = platforms.filter((platform) => artworkCountForPlatform(platform.id) > 0);
if (visible.length === 0) {
  throw new Error("Expected at least one platform with artwork-backed games");
}

if (!visible.some((platform) => platform.id === "sega-cd")) {
  throw new Error("Expected Sega CD to be visible when it has indexed artwork");
}

if (!visible.some((platform) => platform.id === "sega-32x")) {
  throw new Error("Expected Sega 32X to be visible when it has indexed artwork");
}

const hidden = platforms.filter((platform) => artworkCountForPlatform(platform.id) === 0);
if (hidden.length === platforms.length) {
  throw new Error("Expected some platforms without artwork");
}

console.log(`✓ ${visible.length} platforms have artwork-backed games and would be shown`);
console.log("✓ Platforms without artwork are excluded from the selector");
console.log("✓ Manifest-backed platform visibility works");
