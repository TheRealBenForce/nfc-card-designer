import { gameByPlatformAndRaId as imageEntryForGame } from "./data/games.js";

/**
 * @typedef {Object} GameImages
 * @property {string} [boxArt]
 * @property {string} [titleScreen]
 * @property {string} [gamePicture]
 */

/**
 * @typedef {Object} Game
 * @property {string} platformId
 * @property {string} name
 * @property {number} raGameId
 * @property {GameImages} images
 */

/** @type {Record<string, { name: string, raGameId: number }[]>|null} */
let byPlatform = null;

/** @type {Promise<void>|null} */
let loadPromise = null;

export const MIN_GAME_SEARCH_CHARS = 3;

export async function loadGameCatalog() {
  if (byPlatform) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const res = await fetch("assets/data/games-by-platform.json");
    if (!res.ok) {
      throw new Error(`Failed to load game catalog (${res.status})`);
    }

    const data = await res.json();
    byPlatform = data.platforms ?? {};
  })();

  return loadPromise;
}

/**
 * @param {string} platformId
 * @returns {Game[]}
 */
export function gamesForPlatform(platformId) {
  const entries = byPlatform?.[platformId] ?? [];
  return entries.map((entry) => withImages(platformId, entry));
}

/**
 * @param {string} platformId
 * @param {number} raGameId
 */
export function gameByPlatformAndRaId(platformId, raGameId) {
  const entry = byPlatform?.[platformId]?.find((g) => g.raGameId === raGameId);
  return entry ? withImages(platformId, entry) : undefined;
}

/** @param {{ platformId: string, raGameId: number }} card */
export function gameForCard(card) {
  return gameByPlatformAndRaId(card.platformId, card.raGameId);
}

/**
 * @param {string} platformId
 * @param {string} query
 * @param {{ limit?: number }} [options]
 */
export function searchGames(platformId, query, options = {}) {
  const limit = options.limit ?? 50;
  const q = query.trim().toLowerCase();
  if (q.length < MIN_GAME_SEARCH_CHARS) return [];

  return gamesForPlatform(platformId)
    .filter((game) => game.name.toLowerCase().includes(q))
    .slice(0, limit);
}

/**
 * @param {string} platformId
 * @param {{ name: string, raGameId: number }} entry
 * @returns {Game}
 */
function withImages(platformId, entry) {
  const imageEntry = imageEntryForGame(platformId, entry.raGameId);
  return {
    platformId,
    name: entry.name,
    raGameId: entry.raGameId,
    images: imageEntry?.images ?? {},
  };
}
