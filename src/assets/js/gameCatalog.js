import { platforms } from "./data/platforms.js";

/**
 * @typedef {Object} GameImages
 * @property {string} [boxArt]
 * @property {string} [titleScreen]
 * @property {string} [gamePicture]
 */

/**
 * @typedef {Object} Game
 * @property {string} platformId
 * @property {string} libretroName
 * @property {string} name
 * @property {GameImages} images
 */

/** @type {Record<string, Game[]>|null} */
let byPlatform = null;

/** @type {Promise<void>|null} */
let loadPromise = null;

export const MIN_GAME_SEARCH_CHARS = 3;
export const GAME_SEARCH_RESULT_LIMIT = 100;
export const GAME_SEARCH_BROWSE_LIMIT = 10;
const LOCAL_MANIFEST_URL = "assets/data/image-manifest.json";
const S3_MANIFEST_URL = "https://zaparoo.therealbenforce.com/assets/data/image-manifest.json";
const S3_MANIFEST_TIMEOUT_MS = 4000;

export async function loadGameCatalog() {
  if (byPlatform) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const data = await loadManifestPayload();
    /** @type {Record<string, Game[]>} */
    const platformsById = {};

    for (const [platformId, entries] of Object.entries(data.platforms ?? {})) {
      if (!Array.isArray(entries)) continue;
      platformsById[platformId] = entries
        .filter((entry) => entry.libretroName && entry.images)
        .map((entry) => toGame(platformId, entry))
        .filter((game) => gameHasImage(game));
    }

    byPlatform = platformsById;
  })();

  return loadPromise;
}

/**
 * @param {string} platformId
 * @param {{ libretroName: string, images: GameImages }} entry
 * @returns {Game}
 */
function toGame(platformId, entry) {
  return {
    platformId,
    libretroName: entry.libretroName,
    name: entry.libretroName,
    images: entry.images ?? {},
  };
}

/**
 * @returns {Promise<{ platforms?: Record<string, { libretroName: string, images: GameImages }[]> }>}
 */
async function loadManifestPayload() {
  if (shouldUseRemoteManifestFirst()) {
    try {
      return await fetchJsonPayload(S3_MANIFEST_URL, "image manifest", {
        timeoutMs: S3_MANIFEST_TIMEOUT_MS,
      });
    } catch (error) {
      console.warn("Could not load image manifest from S3, using bundled manifest instead.", error);
    }
  }

  return fetchJsonPayload(LOCAL_MANIFEST_URL, "image manifest");
}

/**
 * @param {string} url
 * @param {string} payloadLabel
 * @param {{ timeoutMs?: number }} [options]
 */
async function fetchJsonPayload(url, payloadLabel, options = {}) {
  /** @type {AbortController | null} */
  let controller = null;
  /** @type {number | null} */
  let timeoutId = null;

  if (options.timeoutMs && options.timeoutMs > 0 && "AbortController" in globalThis) {
    controller = new AbortController();
    timeoutId = globalThis.setTimeout(() => controller?.abort(), options.timeoutMs);
  }

  try {
    const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (!res.ok) {
      throw new Error(`Failed to load ${payloadLabel} from ${url} (${res.status})`);
    }
    return res.json();
  } finally {
    if (timeoutId !== null) globalThis.clearTimeout(timeoutId);
  }
}

function shouldUseRemoteManifestFirst() {
  const host = globalThis.location?.hostname?.toLowerCase() ?? "";
  return host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]";
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
  const limit = options.limit ?? GAME_SEARCH_BROWSE_LIMIT;
  const prefix = options.prefix?.trim().toLowerCase() ?? "";

  return gamesForPlatform(platformId)
    .filter((game) => !prefix || game.name.toLowerCase().includes(prefix))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    .slice(0, limit);
}

/**
 * @param {string} platformId
 * @param {string} query
 * @param {{ limit?: number, browseLimit?: number }} [options]
 * @returns {{ games: Game[], total: number, isBrowseSample: boolean }}
 */
export function searchGames(platformId, query, options = {}) {
  const limit = options.limit ?? GAME_SEARCH_RESULT_LIMIT;
  const browseLimit = options.browseLimit ?? GAME_SEARCH_BROWSE_LIMIT;
  const q = query.trim().toLowerCase();

  if (q.length < MIN_GAME_SEARCH_CHARS) {
    const games = browseGamesWithArtwork(platformId, { limit: browseLimit, prefix: q });
    return { games, total: games.length, isBrowseSample: true };
  }

  const matches = gamesForPlatform(platformId)
    .filter((game) => game.name.toLowerCase().includes(q))
    .sort((a, b) => compareSearchResults(a.name, b.name, q));

  if (matches.length === 0) {
    const games = browseGamesWithArtwork(platformId, { limit: browseLimit });
    return { games, total: 0, isBrowseSample: true };
  }

  const total = matches.length;
  const games = limit > 0 ? matches.slice(0, limit) : matches;
  return { games, total, isBrowseSample: false };
}

/**
 * @param {string} platformId
 * @param {string} query
 * @param {number} [highlightedIndex]
 */
export function pickGameFromCatalog(platformId, query, highlightedIndex = 0) {
  const { games } = searchGames(platformId, query, { limit: 0 });
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
 * @param {Game} game
 * @returns {boolean}
 */
function gameHasImage(game) {
  return Object.values(game.images).some((value) => Boolean(value));
}
