import { gameByPlatformAndRaId as imageEntryForGame } from "./data/games.js";
import { platforms } from "./data/platforms.js";
import { isRetailRelease } from "./retailFilter.js";

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
export const GAME_SEARCH_RESULT_LIMIT = 100;

export async function loadGameCatalog() {
  if (byPlatform) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const res = await fetch("assets/data/games-by-platform.json");
    if (!res.ok) {
      throw new Error(`Failed to load game catalog (${res.status})`);
    }

    const data = await res.json();
    /** @type {Record<string, { name: string, raGameId: number }[]>} */
    const platforms = {};

    for (const [platformId, entries] of Object.entries(data.platforms ?? {})) {
      if (!Array.isArray(entries)) continue;
      platforms[platformId] = entries.filter((entry) => isRetailRelease(entry.name));
    }

    byPlatform = platforms;
  })();

  return loadPromise;
}

/**
 * @param {string} platformId
 * @param {{ requireImages?: boolean }} [options]
 * @returns {Game[]}
 */
export function gamesForPlatform(platformId, options = {}) {
  const entries = byPlatform?.[platformId] ?? [];
  const games = entries.map((entry) => withImages(platformId, entry));
  if (!options.requireImages) return games;
  return games.filter((game) => gameHasImage(game));
}

/**
 * @param {string} platformId
 * @param {{ requireImages?: boolean }} [options]
 * @returns {number}
 */
export function gameCountForPlatform(platformId, options = {}) {
  if (!options.requireImages) return catalogCountForPlatform(platformId);
  return gamesForPlatform(platformId, options).length;
}

/**
 * @param {string} platformId
 * @returns {number}
 */
export function catalogCountForPlatform(platformId) {
  return byPlatform?.[platformId]?.length ?? 0;
}

/** Platforms that have at least one game in the catalog JSON. */
export function platformsWithCatalogGames() {
  return platforms.filter((platform) => catalogCountForPlatform(platform.id) > 0);
}

/** @returns {string} */
export function firstPlatformWithCatalogGames() {
  return platformsWithCatalogGames()[0]?.id ?? platforms[0]?.id ?? "nes";
}

/**
 * @param {string} platformId
 * @returns {boolean}
 */
export function platformHasCatalogGames(platformId) {
  return catalogCountForPlatform(platformId) > 0;
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
 * @param {{ limit?: number, requireImages?: boolean }} [options]
 * @returns {{ games: Game[], total: number }}
 */
export function searchGames(platformId, query, options = {}) {
  const limit = options.limit ?? GAME_SEARCH_RESULT_LIMIT;
  const q = query.trim().toLowerCase();
  if (q.length < MIN_GAME_SEARCH_CHARS) return { games: [], total: 0 };

  const matches = gamesForPlatform(platformId, options).filter((game) => {
    return game.name.toLowerCase().includes(q);
  });

  matches.sort((a, b) => compareSearchResults(a.name, b.name, q));

  const total = matches.length;
  const games = limit > 0 ? matches.slice(0, limit) : matches;
  return { games, total };
}

/**
 * @param {string} platformId
 * @param {string} query
 * @param {number} [highlightedIndex]
 * @param {{ requireImages?: boolean }} [options]
 */
export function pickGameFromCatalog(platformId, query, highlightedIndex = 0, options = {}) {
  const { games } = searchGames(platformId, query, { ...options, limit: 0 });
  if (games.length === 0) return null;

  const lower = query.trim().toLowerCase();
  const exact = games.find((g) => g.name.toLowerCase() === lower);
  if (exact) return exact;

  const startsWith = games.find((g) => g.name.toLowerCase().startsWith(lower));
  if (startsWith) return startsWith;

  if (games[highlightedIndex]) return games[highlightedIndex];
  return games[0];
}

/**
 * @param {string} a
 * @param {string} b
 * @param {string} query
 */
function compareSearchResults(a, b, query) {
  const aName = a.toLowerCase();
  const bName = b.toLowerCase();
  const aStarts = aName.startsWith(query) ? 0 : 1;
  const bStarts = bName.startsWith(query) ? 0 : 1;
  if (aStarts !== bStarts) return aStarts - bStarts;
  return aName.localeCompare(bName, undefined, { sensitivity: "base" });
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

/**
 * @param {Game} game
 * @returns {boolean}
 */
function gameHasImage(game) {
  return Object.values(game.images).some((value) => Boolean(value));
}
