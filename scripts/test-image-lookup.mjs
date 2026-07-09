#!/usr/bin/env node
/**
 * Ensures card artwork resolves using manifest image paths.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { candidateImagePaths } from "../src/assets/js/imageProvider.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "src/assets/data/image-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const nesGame = manifest.platforms.nes?.[0];
if (!nesGame) {
  throw new Error("Expected at least one NES game in image-manifest.json");
}

const card = {
  id: "test",
  platformId: "nes",
  gameName: nesGame.libretroName,
  libretroName: nesGame.libretroName,
  imageType: "boxArt",
};

const game = {
  platformId: "nes",
  libretroName: nesGame.libretroName,
  name: nesGame.libretroName,
  images: nesGame.images,
};

const paths = candidateImagePaths(card, game, "boxArt");
if (!paths[0]?.includes("Named_Boxarts")) {
  throw new Error(`Expected libretro boxart path first, got: ${paths[0]}`);
}

if (paths[0] !== nesGame.images.boxArt) {
  throw new Error(`Expected manifest boxArt path, got: ${paths[0]}`);
}

console.log("✓ Image lookup uses libretro manifest paths");
console.log("✓ Manifest image path is preferred");
