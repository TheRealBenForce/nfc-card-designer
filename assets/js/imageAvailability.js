import { games } from "./data/games.js";
import { resolveGameImage } from "./imageProvider.js";
import { sortTypesByPriority } from "./imageSettings.js";

/** @type {Map<string, string[]>} */
const cache = new Map();

/** @type {Map<string, Set<number>>} */
const searchableByPlatform = new Map();

let seedLoaded = false;

/**
 * @param {string} platformId
 * @param {number} raGameId
 */
export function gameCacheKey(platformId, raGameId) {
  return `${platformId}:${raGameId}`;
}

function rebuildSearchableSets() {
  searchableByPlatform.clear();
  for (const [key, types] of cache.entries()) {
    if (!types.length) continue;
    const [platformId, raGameId] = key.split(":");
    if (!searchableByPlatform.has(platformId)) {
      searchableByPlatform.set(platformId, new Set());
    }
    searchableByPlatform.get(platformId).add(Number(raGameId));
  }
}

/**
 * @param {string} platformId
 * @param {number} raGameId
 * @param {string[]} types
 */
function setCachedTypes(platformId, raGameId, types) {
  if (types.length === 0) {
    cache.delete(gameCacheKey(platformId, raGameId));
    return;
  }
  cache.set(gameCacheKey(platformId, raGameId), types);
}

export async function loadImageAvailability() {
  if (seedLoaded) return;
  seedLoaded = true;

  try {
    const res = await fetch("assets/data/image-availability.json");
    if (res.ok) {
      const data = await res.json();
      for (const [platformId, entries] of Object.entries(data.platforms ?? {})) {
        if (!entries || typeof entries !== "object") continue;
        for (const [raGameId, types] of Object.entries(entries)) {
          if (!Array.isArray(types) || types.length === 0) continue;
          setCachedTypes(platformId, Number(raGameId), types);
        }
      }
    }
  } catch {
    // optional seed file
  }

  for (const game of games) {
    const types = Object.entries(game.images ?? {})
      .filter(([, imagePath]) => Boolean(imagePath))
      .map(([type]) => type);
    if (types.length === 0) continue;

    const key = gameCacheKey(game.platformId, game.raGameId);
    const merged = [...new Set([...(cache.get(key) ?? []), ...types])];
    cache.set(key, merged);
  }

  rebuildSearchableSets();
}

/**
 * @param {string} platformId
 * @param {number} raGameId
 */
export function isSearchable(platformId, raGameId) {
  const types = cache.get(gameCacheKey(platformId, raGameId));
  return Array.isArray(types) && types.length > 0;
}

/**
 * @param {string} platformId
 */
export function searchableCount(platformId) {
  return searchableByPlatform.get(platformId)?.size ?? 0;
}

/**
 * @param {import('./gameCatalog.js').Game} game
 * @param {string[]} priority
 */
export async function getAvailableImageTypes(game, priority) {
  const cached = cache.get(gameCacheKey(game.platformId, game.raGameId));
  if (cached) {
    return sortTypesByPriority(cached, priority);
  }

  /** @type {string[]} */
  const available = [];
  for (const type of priority) {
    const { failed } = await resolveGameImage(game, type);
    if (!failed) available.push(type);
  }

  const sorted = sortTypesByPriority(available, priority);
  setCachedTypes(game.platformId, game.raGameId, sorted);
  rebuildSearchableSets();
  return sorted;
}

/**
 * @param {import('./gameCatalog.js').Game} game
 * @param {string[]} priority
 */
export async function getDefaultBrowseType(game, priority) {
  const types = await getAvailableImageTypes(game, priority);
  return types[0] ?? null;
}
