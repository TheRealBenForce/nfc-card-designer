import { PLACEHOLDER_SVG } from "./config.js";
import { platformById } from "./data/platforms.js";
import { getDevImageDelayMs } from "./devTools.js";
import { gameForCard } from "./gameCatalog.js";
import {
  LIBRETRO_IMAGE_FOLDERS,
  libretroGitHubRawUrl,
  playlistToGitHubRepo,
} from "./libretroThumbnails.js";

/**
 * @param {string} platformId
 * @param {string} libretroName
 * @param {string} imageType
 * @returns {string | null}
 */
export function buildGameImageUrl(platformId, libretroName, imageType) {
  if (!platformId || !libretroName || !imageType) return null;

  const platform = platformById[platformId];
  if (!platform?.libretroPlaylist) return null;

  const imageFolder = LIBRETRO_IMAGE_FOLDERS[imageType];
  if (!imageFolder) return null;

  const githubRepo = playlistToGitHubRepo(platform.libretroPlaylist);
  return libretroGitHubRawUrl(githubRepo, imageFolder, libretroName);
}

/**
 * @param {import('./gameCatalog.js').Game} game
 * @param {string} imageType
 */
export function getGameImagePath(game, imageType) {
  return buildGameImageUrl(game.platformId, game.libretroName, imageType);
}

/**
 * @param {import('./state.js').Card} card
 * @param {import('./gameCatalog.js').Game | undefined} game
 * @param {string} imageType
 */
export function candidateImagePaths(card, game, imageType) {
  const url =
    buildGameImageUrl(game?.platformId ?? card.platformId, game?.libretroName ?? card.libretroName, imageType) ??
    null;
  return url ? [url] : [];
}

/**
 * @param {import('./gameCatalog.js').Game} game
 * @param {string} imageType
 * @returns {Promise<{ url: string, failed: boolean }>}
 */
export async function resolveGameImage(game, imageType) {
  const imagePath = getGameImagePath(game, imageType);
  if (!imagePath) {
    return { url: PLACEHOLDER_SVG, failed: true };
  }

  try {
    await loadImage(imagePath);
    return { url: imagePath, failed: false };
  } catch {
    return { url: PLACEHOLDER_SVG, failed: true };
  }
}

/**
 * @param {import('./state.js').Card} card
 * @returns {Promise<{ url: string, failed: boolean }>}
 */
export async function resolveCardImage(card) {
  const game = gameForCard(card);
  for (const imagePath of candidateImagePaths(card, game, card.imageType)) {
    try {
      await loadImage(imagePath);
      return { url: imagePath, failed: false };
    } catch {
      // try next path
    }
  }

  return { url: PLACEHOLDER_SVG, failed: true };
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
