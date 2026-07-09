import { gameByPlatformAndRaId as imageEntryForGame } from "./data/games.js";
import { platforms } from "./data/platforms.js";
import { ensureGameImageProbed, ensurePlatformArtworkIndexed, gameHasKnownImage } from "./imageProbe.js";
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
export const GAME_SEARCH_BROWSE_LIMIT = 10;
const LOCAL_GAME_CATALOG_URL = "assets/data/games-by-platform.json";
const S3_GAME_CATALOG_URL = "https://zaparoo.therealbenforce.com/assets/data/games-by-platform.json";
const S3_CATALOG_TIMEOUT_MS = 4000;

export async function loadGameCatalog() {
  if (byPlatform) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const data = await loadCatalogPayload();
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
 * Prefer live S3 catalog for production, then fallback to bundled JSON.
 * @returns {Promise<{ platforms?: Record<string, { name: string, raGameId: number }[]> }>}
 */
async function loadCatalogPayload() {
  if (shouldUseS3CatalogFirst()) {
    try {
      return await fetchJsonPayload(S3_GAME_CATALOG_URL, "game catalog", {
        timeoutMs: S3_CATALOG_TIMEOUT_MS,
      });
    } catch (error) {
      console.warn("Could not load game catalog from S3, using bundled catalog instead.", error);
    }
  }

  return fetchJsonPayload(LOCAL_GAME_CATALOG_URL, "game catalog");
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

function shouldUseS3CatalogFirst() {
  const host = globalThis.location?.hostname?.toLowerCase() ?? "";
  return host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]";
}

/**
 * @param {string} platformId
 * @returns {Game[]}
 */
export function gamesForPlatform(platformId) {
  const entries = byPlatform?.[platformId] ?? [];
  return entries.map((entry) => withImages(platformId, entry)).filter((game) => gameHasImage(game));
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
  return byPlatform?.[platformId]?.length ?? 0;
}

/** Platforms that have at least one retail game in the catalog JSON. */
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
 * @param {() => void} [onProgress]
 */
export async function refreshPlatformArtworkIndex(platformId, onProgress) {
  const entries = byPlatform?.[platformId] ?? [];
  await ensurePlatformArtworkIndexed(platformId, entries, onProgress);
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
 * @param {{ limit?: number, prefix?: string }} [options]
 * @returns {Promise<Game[]>}
 */
export async function browseGamesWithArtwork(platformId, options = {}) {
  const limit = options.limit ?? GAME_SEARCH_BROWSE_LIMIT;
  const prefix = options.prefix?.trim().toLowerCase() ?? "";

  const entries = (byPlatform?.[platformId] ?? [])
    .filter((entry) => !prefix || entry.name.toLowerCase().includes(prefix))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  /** @type {Game[]} */
  const games = [];
  for (const entry of entries) {
    const game = withImages(platformId, entry);
    if (gameHasImage(game) || (await ensureGameImageProbed(game))) {
      games.push(game);
      if (games.length >= limit) break;
    }
  }

  return games;
}

/**
 * @param {string} platformId
 * @param {string} query
 * @param {{ limit?: number, browseLimit?: number }} [options]
 * @returns {Promise<{ games: Game[], total: number, isBrowseSample: boolean }>}
 */
export async function searchGames(platformId, query, options = {}) {
  const limit = options.limit ?? GAME_SEARCH_RESULT_LIMIT;
  const browseLimit = options.browseLimit ?? GAME_SEARCH_BROWSE_LIMIT;
  const q = query.trim().toLowerCase();

  if (q.length < MIN_GAME_SEARCH_CHARS) {
    const games = await browseGamesWithArtwork(platformId, { limit: browseLimit, prefix: q });
    return { games, total: games.length, isBrowseSample: true };
  }

  const candidates = (byPlatform?.[platformId] ?? [])
    .map((entry) => withImages(platformId, entry))
    .filter((game) => game.name.toLowerCase().includes(q));

  candidates.sort((a, b) => compareSearchResults(a.name, b.name, q));

  /** @type {Game[]} */
  const matches = [];
  const concurrency = 12;
  let index = 0;

  async function worker() {
    while (index < candidates.length) {
      const game = candidates[index];
      index += 1;
      if (gameHasImage(game) || (await ensureGameImageProbed(game))) {
        matches.push(game);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, candidates.length || 1) }, worker),
  );

  matches.sort((a, b) => compareSearchResults(a.name, b.name, q));

  if (matches.length === 0) {
    const games = await browseGamesWithArtwork(platformId, { limit: browseLimit });
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
export async function pickGameFromCatalog(platformId, query, highlightedIndex = 0) {
  const { games } = await searchGames(platformId, query, { limit: 0 });
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
  return gameHasKnownImage(game);
}
