import { PLACEHOLDER_SVG } from "./config.js";
import { getDevImageDelayMs } from "./devTools.js";
import { gameByPlatformAndRaId } from "./data/games.js";

const S3_ASSET_BASE_URL = "https://zaparoo.therealbenforce.com/";
const IMAGE_FIELD_MAP = {
  boxArt: "boxArt",
  titleScreen: "titleScreen",
  gamePicture: "gamePicture",
};
/** @type {Map<string, string|null>} */
const resolvedImageCache = new Map();

/**
 * @param {string} platformId
 * @param {number} raGameId
 * @param {string} imageType
 */
function imageCacheKey(platformId, raGameId, imageType) {
  return `${platformId}:${raGameId}:${imageType}`;
}

/**
 * @param {string[]} paths
 * @param {string | null | undefined} rawPath
 */
function addPathVariants(paths, rawPath) {
  if (typeof rawPath !== "string") return;
  const path = rawPath.trim();
  if (!path) return;

  paths.push(path);
  if (path.startsWith("data:")) return;
  if (/^https?:\/\//i.test(path)) return;

  if (path.startsWith("/")) {
    const withoutSlash = path.slice(1);
    if (withoutSlash) {
      paths.push(withoutSlash);
      paths.push(`${S3_ASSET_BASE_URL}${withoutSlash}`);
    }
    return;
  }

  paths.push(`/${path}`);
  paths.push(`${S3_ASSET_BASE_URL}${path}`);
}

/**
 * @param {string} cacheKey
 * @param {string[]} paths
 */
async function resolveFromCandidates(cacheKey, paths) {
  const cached = resolvedImageCache.get(cacheKey);
  if (typeof cached === "string") {
    try {
      await loadImage(cached);
      return { url: cached, failed: false };
    } catch {
      resolvedImageCache.delete(cacheKey);
    }
  } else if (cached === null) {
    return { url: PLACEHOLDER_SVG, failed: true };
  }

  for (const imagePath of paths) {
    try {
      await loadImage(imagePath);
      resolvedImageCache.set(cacheKey, imagePath);
      return { url: imagePath, failed: false };
    } catch {
      // try next path
    }
  }

  resolvedImageCache.set(cacheKey, null);
  return { url: PLACEHOLDER_SVG, failed: true };
}

/**
 * @param {import('./data/games.js').Game} game
 * @param {string} imageType
 */
export function getGameImagePath(game, imageType) {
  const key = IMAGE_FIELD_MAP[imageType] ?? "boxArt";
  return game.images?.[key] ?? null;
}

/**
 * @param {import('./state.js').Card} card
 * @param {import('./data/games.js').Game | undefined} game
 * @param {string} imageType
 */
export function candidateImagePaths(card, game, imageType) {
  const key = IMAGE_FIELD_MAP[imageType] ?? "boxArt";
  const paths = [];

  addPathVariants(paths, `assets/images/platforms/${card.platformId}/games/${card.raGameId}/${key}.png`);

  const fromCatalog = game?.images?.[key];
  addPathVariants(paths, fromCatalog);

  addPathVariants(paths, `assets/images/games/${card.raGameId}-${key}.png`);

  return [...new Set(paths)];
}

/**
 * @param {import('./data/games.js').Game} game
 * @param {string} imageType
 * @returns {Promise<{ url: string, failed: boolean }>}
 */
export async function resolveGameImage(game, imageType) {
  const card = { platformId: game.platformId, raGameId: game.raGameId };
  const cacheKey = imageCacheKey(game.platformId, game.raGameId, imageType);
  return resolveFromCandidates(cacheKey, candidateImagePaths(card, game, imageType));
}

/**
 * @param {import('./state.js').Card} card
 * @returns {Promise<{ url: string, failed: boolean }>}
 */
export async function resolveCardImage(card) {
  const game = gameByPlatformAndRaId(card.platformId, card.raGameId);
  const cacheKey = imageCacheKey(card.platformId, card.raGameId, card.imageType);
  return resolveFromCandidates(cacheKey, candidateImagePaths(card, game, card.imageType));
}

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
export async function loadImage(src) {
  const delayMs = getDevImageDelayMs();
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}
