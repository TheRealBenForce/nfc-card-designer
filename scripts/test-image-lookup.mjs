#!/usr/bin/env node
/**
 * Ensures card artwork resolves using GitHub raw URLs.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { candidateImagePaths, getGameImagePath } from "../src/assets/js/imageProvider.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "src/assets/data/game-catalog.json");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));

const nesGame = catalog.platforms.nes?.[0];
if (!nesGame) {
  throw new Error("Expected at least one NES game in game-catalog.json");
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
};

const url = getGameImagePath(game, "boxArt");
if (!url?.startsWith("https://raw.githubusercontent.com/libretro-thumbnails/")) {
  throw new Error(`Expected GitHub raw URL, got: ${url}`);
}
if (!url.includes("Named_Boxarts")) {
  throw new Error(`Expected Named_Boxarts in URL, got: ${url}`);
}

const paths = candidateImagePaths(card, game, "boxArt");
if (paths[0] !== url) {
  throw new Error(`Expected candidate path to match getGameImagePath, got: ${paths[0]}`);
}

console.log("✓ Image lookup builds GitHub raw URLs");
console.log("✓ candidateImagePaths returns catalog-derived artwork URL");
