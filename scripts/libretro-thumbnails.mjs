#!/usr/bin/env node
/**
 * Libretro thumbnail CDN client for maintainer scripts.
 */

import {
  LIBRETRO_IMAGE_FOLDERS,
  libretroFilenameCandidates,
  libretroThumbnailDirectoryUrl,
  libretroThumbnailUrl,
  pickLibretroFilename,
} from "../assets/js/libretroThumbnails.js";

const USER_AGENT = "nfc-card-designer/1.0";

/** @type {Map<string, string[]>} */
const listingCache = new Map();

/**
 * @param {string} playlistName
 * @param {string} imageFolder
 */
function listingCacheKey(playlistName, imageFolder) {
  return `${playlistName}/${imageFolder}`;
}

/**
 * @param {string} html
 * @returns {string[]}
 */
function parseDirectoryListing(html) {
  /** @type {string[]} */
  const filenames = [];
  const pattern = /href="([^"]+\.png)"/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const href = decodeURIComponent(match[1]);
    if (href.includes("/") || href.startsWith("?")) continue;
    filenames.push(href);
  }
  return filenames;
}

/**
 * @param {string} playlistName
 * @param {string} imageFolder
 * @returns {Promise<string[]>}
 */
export async function fetchLibretroListing(playlistName, imageFolder) {
  const key = listingCacheKey(playlistName, imageFolder);
  if (listingCache.has(key)) return listingCache.get(key);

  const url = libretroThumbnailDirectoryUrl(playlistName, imageFolder);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    listingCache.set(key, []);
    return [];
  }

  const html = await res.text();
  const filenames = parseDirectoryListing(html);
  listingCache.set(key, filenames);
  return filenames;
}

/**
 * @param {string} url
 */
async function thumbnailExists(url) {
  const res = await fetch(url, {
    method: "HEAD",
    headers: { "User-Agent": USER_AGENT },
  });
  return res.ok;
}

/**
 * @param {string} playlistName
 * @param {string} imageType
 * @param {string} gameName
 * @param {string} [knownLibretroName]
 * @returns {Promise<string | null>} basename without .png
 */
export async function resolveLibretroFilename(playlistName, imageType, gameName, knownLibretroName) {
  const imageFolder = LIBRETRO_IMAGE_FOLDERS[imageType];
  if (!imageFolder) return null;

  if (knownLibretroName) {
    const url = libretroThumbnailUrl(playlistName, imageFolder, knownLibretroName);
    if (await thumbnailExists(url)) return knownLibretroName;
  }

  for (const candidate of libretroFilenameCandidates(gameName)) {
    const url = libretroThumbnailUrl(playlistName, imageFolder, candidate);
    if (await thumbnailExists(url)) return candidate;
  }

  const listing = await fetchLibretroListing(playlistName, imageFolder);
  return pickLibretroFilename(gameName, listing);
}

/**
 * @param {string} playlistName
 * @param {string} imageType
 * @param {string} libretroName basename without .png
 */
export function libretroImageUrl(playlistName, imageType, libretroName) {
  const imageFolder = LIBRETRO_IMAGE_FOLDERS[imageType];
  return libretroThumbnailUrl(playlistName, imageFolder, libretroName);
}
