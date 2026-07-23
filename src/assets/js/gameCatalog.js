import { platforms } from "./data/platforms.js";
import { retailDisplayName } from "./retailFilter.js";

/**
 * Friendly label for a saved card or catalog entry. Artwork always uses `libretroName`.
 * @param {string} libretroName
 */
export function displayNameForLibretroName(libretroName) {
  return retailDisplayName(libretroName);
}

/**
 * @typedef {Object} Game
 * @property {string} platformId
 * @property {string} libretroName
 * @property {string} name
 */

/** @type {Record<string, Game[]>|null} */
let byPlatform = null;

/** @type {Promise<void>|null} */
let loadPromise = null;

export const GAME_SEARCH_PAGE_SIZE = 10;
const GAME_CATALOG_URL = "assets/data/game-catalog.json";

export async function loadGameCatalog() {
  if (byPlatform) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const data = await fetchJsonPayload(GAME_CATALOG_URL, "game catalog");
    /** @type {Record<string, Game[]>} */
    const platformsById = {};

    for (const [platformId, entries] of Object.entries(data.platforms ?? {})) {
      if (!Array.isArray(entries)) continue;
      platformsById[platformId] = entries
        .filter((entry) => entry?.libretroName && typeof entry.libretroName === "string")
        .map((entry) => toGame(platformId, entry));
    }

    byPlatform = platformsById;
  })();

  return loadPromise;
}

/**
 * @param {string} platformId
 * @param {{ libretroName: string }} entry
 * @returns {Game}
 */
function toGame(platformId, entry) {
  return {
    platformId,
    libretroName: entry.libretroName,
    name: retailDisplayName(entry.libretroName),
  };
}

/**
 * @param {string} url
 * @param {string} payloadLabel
 */
async function fetchJsonPayload(url, payloadLabel) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${payloadLabel} from ${url} (${res.status})`);
  }
  return res.json();
}

/**
 * @param {string} platformId
 * @returns {Game[]}
 */
export function gamesForPlatform(platformId) {
  return byPlatform?.[platformId] ?? [];
}

/**
 * @param {string} platformId
 * @returns {number}
 */
export function gameCountForPlatform(platformId) {
  return gamesForPlatform(platformId).length;
}

/**
 * @param {string} platformId
 * @returns {number}
 */
export function catalogCountForPlatform(platformId) {
  return gameCountForPlatform(platformId);
}

export function platformsWithCatalogGames() {
  return platforms.filter((platform) => catalogCountForPlatform(platform.id) > 0);
}

export function platformsWithArtwork() {
  return platformsWithCatalogGames();
}

export function firstPlatformWithArtwork() {
  return platformsWithArtwork()[0]?.id ?? "";
}

export function firstPlatformWithCatalogGames() {
  return platformsWithCatalogGames()[0]?.id ?? platforms[0]?.id ?? "nes";
}

export function platformHasCatalogGames(platformId) {
  return catalogCountForPlatform(platformId) > 0;
}

export function platformHasArtwork(platformId) {
  return platformHasCatalogGames(platformId);
}

/**
 * @param {string} platformId
 * @param {string} libretroName
 */
export function gameByPlatformAndLibretroName(platformId, libretroName) {
  return gamesForPlatform(platformId).find((game) => game.libretroName === libretroName);
}

/** @param {{ platformId: string, libretroName: string }} card */
export function gameForCard(card) {
  return gameByPlatformAndLibretroName(card.platformId, card.libretroName);
}

/**
 * @param {string} platformId
 * @param {{ limit?: number, prefix?: string }} [options]
 * @returns {Game[]}
 */
export function browseGamesWithArtwork(platformId, options = {}) {
  const limit = options.limit ?? 0;
  const prefix = options.prefix?.trim().toLowerCase() ?? "";

  const games = gamesForPlatform(platformId)
    .filter((game) => !prefix || game.name.toLowerCase().includes(prefix))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  return limit > 0 ? games.slice(0, limit) : games;
}

/**
 * @param {string} platformId
 * @param {string} query
 * @returns {{ games: Game[], total: number, isNoMatchFallback: boolean }}
 */
export function searchGames(platformId, query) {
  const q = query.trim().toLowerCase();
  const platformGames = gamesForPlatform(platformId);

  if (q.length === 0) {
    const games = [...platformGames].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
    return { games, total: games.length, isNoMatchFallback: false };
  }

  const matches = platformGames
    .filter((game) => game.name.toLowerCase().includes(q))
    .sort((a, b) => compareSearchResults(a.name, b.name, q));

  if (matches.length === 0) {
    const games = browseGamesWithArtwork(platformId);
    return { games, total: 0, isNoMatchFallback: true };
  }

  return { games: matches, total: matches.length, isNoMatchFallback: false };
}

/**
 * @param {string} platformId
 * @param {string} query
 * @param {number} [highlightedIndex]
 */
export function pickGameFromCatalog(platformId, query, highlightedIndex = 0) {
  const { games, isNoMatchFallback } = searchGames(platformId, query);
  if (games.length === 0 || isNoMatchFallback) return null;

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
