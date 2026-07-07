#!/usr/bin/env node
/**
 * Build a game catalog from libretro thumbnail listings (for platforms without RA support).
 */

import { fetchLibretroListing } from "./libretro-thumbnails.mjs";
import { isRetailRelease } from "./game-filters.mjs";

/**
 * Stable synthetic game id for libretro-only catalog entries.
 * @param {string} platformId
 * @param {string} gameName
 */
export function syntheticRaGameId(platformId, gameName) {
  const key = `${platformId}\0${gameName}`;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 900_000_000 + ((hash >>> 0) % 99_000_000);
}

/**
 * @param {import("../assets/js/data/platforms.js").Platform} platform
 * @param {{ retailOnly?: boolean }} [options]
 */
export async function fetchLibretroGameCatalog(platform, options = {}) {
  const retailOnly = options.retailOnly !== false;
  const filenames = await fetchLibretroListing(platform.libretroPlaylist, "Named_Boxarts");
  /** @type {Map<string, string>} name → basename */
  const byName = new Map();

  for (const filename of filenames) {
    const name = filename.replace(/\.png$/i, "");
    if (!name) continue;
    if (retailOnly && !isRetailRelease(name)) continue;
    if (name.includes("[") || /\b(Beta|Demo|Proto|Pirate|Unl)\b/i.test(name)) continue;

    const existing = byName.get(name);
    if (!existing) {
      byName.set(name, name);
      continue;
    }

    const prefer = scoreRetailName(name);
    const existingScore = scoreRetailName(existing);
    if (prefer > existingScore) {
      byName.set(name, name);
    }
  }

  return [...byName.values()]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map((name) => ({
      platformId: platform.id,
      name,
      raGameId: syntheticRaGameId(platform.id, name),
      images: {},
    }));
}

/**
 * @param {string} name
 */
function scoreRetailName(name) {
  let score = 0;
  if (name.includes("(USA)")) score += 50;
  if (name.includes("(World)")) score += 40;
  if (name.includes("(Europe)")) score += 30;
  score -= name.length * 0.05;
  return score;
}
