#!/usr/bin/env node
/**
 * Image manifest read/write helpers.
 */

import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  LIBRETRO_IMAGE_ASSET_PREFIX,
  addInventoryEntry,
  buildManifestFromInventory,
  parseLibretroImageKey,
} from "./libretro-image-paths.mjs";
import { scanLibretroImagesFromS3 } from "./s3-storage.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const imageManifestPath = path.join(root, "src/assets/data/image-manifest.json");
/** Local static site root; game PNGs live under <localSiteRoot>/assets/images/ */
export const localSiteRoot = path.join(root, "src");

/**
 * @typedef {Object} ManifestGame
 * @property {string} libretroName
 * @property {Partial<Record<"boxArt"|"titleScreen"|"gamePicture", string>>} images
 */

/**
 * @typedef {Object} ImageManifest
 * @property {number} version
 * @property {string} generatedAt
 * @property {Record<string, ManifestGame[]>} platforms
 */

/**
 * @param {import("../src/assets/js/data/platforms.js").Platform[]} platformList
 */
export function playlistToPlatformMap(platformList) {
  /** @type {Record<string, string>} */
  const map = {};
  for (const platform of platformList) {
    map[platform.libretroPlaylist] = platform.id;
  }
  return map;
}

/**
 * @param {string} rootDir
 * @param {string} [playlistFilter]
 * @returns {Promise<Record<string, Record<string, Partial<Record<string, string>>>>>>}
 */
export async function scanLibretroImagesFromDisk(rootDir, playlistFilter) {
  /** @type {Record<string, Record<string, Partial<Record<string, string>>>>>>} */
  const inventory = {};

  const imagesRoot = path.join(rootDir, LIBRETRO_IMAGE_ASSET_PREFIX);
  let playlistEntries = [];
  try {
    playlistEntries = await readdir(imagesRoot, { withFileTypes: true });
  } catch {
    return inventory;
  }

  for (const playlistEntry of playlistEntries) {
    if (!playlistEntry.isDirectory()) continue;
    const playlist = playlistEntry.name;
    if (playlistFilter && playlist !== playlistFilter) continue;

    const playlistDir = path.join(imagesRoot, playlist);
    let folderEntries = [];
    try {
      folderEntries = await readdir(playlistDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const folderEntry of folderEntries) {
      if (!folderEntry.isDirectory()) continue;
      const folderDir = path.join(playlistDir, folderEntry.name);
      let files = [];
      try {
        files = await readdir(folderDir);
      } catch {
        continue;
      }

      for (const file of files) {
        if (!/\.png$/i.test(file)) continue;
        const objectKey = `${LIBRETRO_IMAGE_ASSET_PREFIX}/${playlist}/${folderEntry.name}/${file}`;
        const parsed = parseLibretroImageKey(objectKey);
        if (!parsed) continue;

        try {
          const info = await stat(path.join(folderDir, file));
          if (!info.isFile() || info.size === 0) continue;
        } catch {
          continue;
        }

        addInventoryEntry(inventory, {
          playlist,
          libretroName: parsed.libretroName,
          imageType: parsed.imageType,
          objectKey,
        });
      }
    }
  }

  return inventory;
}

/**
 * @param {Record<string, Record<string, Partial<Record<string, string>>>>>} base
 * @param {Record<string, Record<string, Partial<Record<string, string>>>>>} extra
 */
export function mergeInventory(base, extra) {
  /** @type {Record<string, Record<string, Partial<Record<string, string>>>>>} */
  const merged = structuredClone(base);

  for (const [playlist, games] of Object.entries(extra)) {
    if (!merged[playlist]) merged[playlist] = {};
    for (const [libretroName, types] of Object.entries(games)) {
      if (!merged[playlist][libretroName]) merged[playlist][libretroName] = {};
      Object.assign(merged[playlist][libretroName], types);
    }
  }

  return merged;
}

/**
 * @param {import("../src/assets/js/data/platforms.js").Platform[]} platformList
 * @param {Record<string, Record<string, Partial<Record<string, string>>>>>} inventory
 */
export function inventoryToManifest(platformList, inventory) {
  return buildManifestFromInventory(inventory, {
    playlistToPlatform: playlistToPlatformMap(platformList),
  });
}

/**
 * @param {ImageManifest} manifest
 */
export async function writeImageManifest(manifest) {
  await mkdir(path.dirname(imageManifestPath), { recursive: true });
  await writeFile(imageManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * @returns {Promise<ImageManifest>}
 */
export async function readImageManifest() {
  const raw = await readFile(imageManifestPath, "utf8");
  return JSON.parse(raw);
}

/**
 * @param {import("../src/assets/js/data/platforms.js").Platform[]} platformList
 * @param {{ localRoot?: string, scanS3?: boolean, platformId?: string }} options
 */
export async function buildImageManifest(platformList, options = {}) {
  const playlistToPlatform = playlistToPlatformMap(platformList);
  const playlistFilter = options.platformId
    ? platformList.find((platform) => platform.id === options.platformId)?.libretroPlaylist
    : undefined;

  /** @type {Record<string, Record<string, Partial<Record<string, string>>>>>} */
  let inventory = {};

  if (options.localRoot) {
    inventory = mergeInventory(
      inventory,
      await scanLibretroImagesFromDisk(options.localRoot, playlistFilter),
    );
  }

  if (options.scanS3) {
    inventory = mergeInventory(
      inventory,
      await scanLibretroImagesFromS3(playlistFilter, playlistToPlatform),
    );
  }

  return inventoryToManifest(platformList, inventory);
}

export { scanLibretroImagesFromS3 };
