#!/usr/bin/env node
/**
 * Libretro-mirrored image path helpers shared by fetch-images and manifest sync.
 */

import { LIBRETRO_IMAGE_FOLDERS } from "../src/assets/js/libretroThumbnails.js";

export const LIBRETRO_IMAGE_ASSET_PREFIX = "assets/images";

/** @type {Record<string, string>} libretro folder → app image type */
export const LIBRETRO_FOLDER_TO_IMAGE_TYPE = Object.fromEntries(
  Object.entries(LIBRETRO_IMAGE_FOLDERS).map(([imageType, folder]) => [folder, imageType]),
);

/** @type {string[]} */
export const LIBRETRO_IMAGE_FOLDERS_LIST = Object.values(LIBRETRO_IMAGE_FOLDERS);

const LIBRETRO_IMAGE_KEY_PATTERN =
  /^assets\/images\/([^/]+)\/(Named_Boxarts|Named_Titles|Named_Snaps)\/(.+\.png)$/;

/**
 * @param {string} playlistName
 * @param {string} imageFolder
 * @param {string} filename With .png extension
 */
export function libretroImageObjectKey(playlistName, imageFolder, filename) {
  const safeFilename = filename.endsWith(".png") ? filename : `${filename}.png`;
  return `${LIBRETRO_IMAGE_ASSET_PREFIX}/${playlistName}/${imageFolder}/${safeFilename}`;
}

/**
 * @param {string} playlistName
 * @param {string} imageType
 * @param {string} libretroName basename without .png
 */
export function libretroImageKeyForType(playlistName, imageType, libretroName) {
  const imageFolder = LIBRETRO_IMAGE_FOLDERS[imageType];
  if (!imageFolder) {
    throw new Error(`Unknown image type: ${imageType}`);
  }
  return libretroImageObjectKey(playlistName, imageFolder, `${libretroName}.png`);
}

/**
 * @param {string} objectKey
 * @returns {{ playlist: string, imageFolder: string, filename: string, libretroName: string, imageType: string } | null}
 */
export function parseLibretroImageKey(objectKey) {
  const match = objectKey.match(LIBRETRO_IMAGE_KEY_PATTERN);
  if (!match) return null;

  const [, playlist, imageFolder, filename] = match;
  const imageType = LIBRETRO_FOLDER_TO_IMAGE_TYPE[imageFolder];
  if (!imageType) return null;

  const libretroName = filename.replace(/\.png$/i, "");
  return { playlist, imageFolder, filename, libretroName, imageType };
}

/**
 * @param {Record<string, Record<string, Partial<Record<string, string>>>>} inventory
 * playlist → libretroName → imageType → objectKey
 * @returns {import("./image-manifest.mjs").ImageManifest}
 */
export function buildManifestFromInventory(inventory, options = {}) {
  /** @type {Record<string, import("./image-manifest.mjs").ManifestGame[]>} */
  const platforms = {};
  const playlistToPlatform = options.playlistToPlatform ?? {};

  for (const [playlist, games] of Object.entries(inventory)) {
    const platformId = playlistToPlatform[playlist];
    if (!platformId) continue;

    /** @type {import("./image-manifest.mjs").ManifestGame[]} */
    const entries = [];

    for (const [libretroName, imagesByType] of Object.entries(games)) {
      const images = Object.fromEntries(
        Object.entries(imagesByType).filter(([, path]) => Boolean(path)),
      );
      if (Object.keys(images).length === 0) continue;

      entries.push({ libretroName, images });
    }

    entries.sort((a, b) =>
      a.libretroName.localeCompare(b.libretroName, undefined, { sensitivity: "base" }),
    );

    if (entries.length > 0) {
      platforms[platformId] = entries;
    }
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    platforms,
  };
}

/**
 * @param {Record<string, Record<string, Partial<Record<string, string>>>>} inventory
 * @param {{ playlist: string, libretroName: string, imageType: string, objectKey: string }} entry
 */
export function addInventoryEntry(inventory, entry) {
  if (!inventory[entry.playlist]) inventory[entry.playlist] = {};
  if (!inventory[entry.playlist][entry.libretroName]) {
    inventory[entry.playlist][entry.libretroName] = {};
  }
  inventory[entry.playlist][entry.libretroName][entry.imageType] = entry.objectKey;
}
