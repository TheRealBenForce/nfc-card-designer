import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  LIBRETRO_IMAGE_FOLDERS,
  libretroFilenameCandidates,
  pickLibretroFilename,
} from "../src/assets/js/libretroThumbnails.js";

/** @type {Map<string, string[]>} */
const localListingCache = new Map();

/**
 * @param {string} dir
 */
export async function directoryExists(dir) {
  try {
    const info = await stat(dir);
    return info.isDirectory();
  } catch {
    return false;
  }
}

/**
 * @param {string[]} values
 * @param {string} target
 */
function matchIgnoreCase(values, target) {
  const lower = target.toLowerCase();
  return values.find((value) => value.toLowerCase() === lower) ?? null;
}

/**
 * @param {string} localRoot
 * @param {string} playlistName
 * @param {string} imageFolder
 */
export async function localLibretroListing(localRoot, playlistName, imageFolder) {
  const cacheKey = `${localRoot}/${playlistName}/${imageFolder}`;
  if (localListingCache.has(cacheKey)) {
    return localListingCache.get(cacheKey) ?? [];
  }

  const dir = path.join(localRoot, playlistName, imageFolder);
  /** @type {string[]} */
  let listing = [];
  try {
    const files = await readdir(dir);
    listing = files
      .filter((name) => /\.png$/i.test(name))
      .map((name) => name.replace(/\.png$/i, ""));
  } catch {
    listing = [];
  }

  localListingCache.set(cacheKey, listing);
  return listing;
}

/**
 * @param {string} localRoot
 * @param {string} playlistName
 * @param {string} imageType
 * @param {string} gameName
 * @param {string | null} [knownLibretroName]
 */
export async function resolveLocalLibretroFilename(
  localRoot,
  playlistName,
  imageType,
  gameName,
  knownLibretroName,
) {
  const imageFolder = LIBRETRO_IMAGE_FOLDERS[imageType];
  if (!imageFolder) return null;

  const listing = await localLibretroListing(localRoot, playlistName, imageFolder);
  if (listing.length === 0) return null;

  if (knownLibretroName) {
    const knownMatch = matchIgnoreCase(listing, knownLibretroName);
    if (knownMatch) return knownMatch;
  }

  for (const candidate of libretroFilenameCandidates(gameName)) {
    const candidateMatch = matchIgnoreCase(listing, candidate);
    if (candidateMatch) return candidateMatch;
  }

  return pickLibretroFilename(gameName, listing);
}

/**
 * @param {string} localRoot
 * @param {string} playlistName
 * @param {string} imageType
 * @param {string} libretroName
 */
export async function readLocalLibretroImage(localRoot, playlistName, imageType, libretroName) {
  const imageFolder = LIBRETRO_IMAGE_FOLDERS[imageType];
  if (!imageFolder) return null;
  const sourcePath = path.join(localRoot, playlistName, imageFolder, `${libretroName}.png`);
  try {
    return await readFile(sourcePath);
  } catch {
    return null;
  }
}
