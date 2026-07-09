import { resolveGameImage } from "./imageProvider.js";
import { sortTypesByPriority } from "./imageSettings.js";

/** @type {Map<string, string[]>} */
const cache = new Map();

/**
 * @param {string} platformId
 * @param {string} libretroName
 */
export function gameCacheKey(platformId, libretroName) {
  return `${platformId}:${libretroName}`;
}

/**
 * @param {string} platformId
 * @param {string} libretroName
 * @param {string[]} types
 */
function setCachedTypes(platformId, libretroName, types) {
  if (types.length === 0) {
    cache.delete(gameCacheKey(platformId, libretroName));
    return;
  }
  cache.set(gameCacheKey(platformId, libretroName), types);
}

/**
 * @param {import('./gameCatalog.js').Game} game
 * @param {string[]} priority
 */
export async function getAvailableImageTypes(game, priority) {
  const cached = cache.get(gameCacheKey(game.platformId, game.libretroName));
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
  setCachedTypes(game.platformId, game.libretroName, sorted);
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
