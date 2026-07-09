import { PLACEHOLDER_SVG } from "./config.js";
import { getDevImageDelayMs } from "./devTools.js";
import { gameForCard } from "./gameCatalog.js";

/**
 * @param {import('./gameCatalog.js').Game} game
 * @param {string} imageType
 */
export function getGameImagePath(game, imageType) {
  return game.images?.[imageType] ?? null;
}

/**
 * @param {import('./state.js').Card} card
 * @param {import('./gameCatalog.js').Game | undefined} game
 * @param {string} imageType
 */
export function candidateImagePaths(card, game, imageType) {
  const paths = [];
  const fromCatalog = game?.images?.[imageType];
  if (fromCatalog) paths.push(fromCatalog);
  return [...new Set(paths)];
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
