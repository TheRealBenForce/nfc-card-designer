import { PLACEHOLDER_SVG } from "./config.js";
import { gameByRaId } from "./data/games.js";

const IMAGE_FIELD_MAP = {
  boxArt: "boxArt",
  titleScreen: "titleScreen",
  gamePicture: "gamePicture",
};

/**
 * @param {import('./data/games.js').Game} game
 * @param {string} imageType
 */
export function getGameImagePath(game, imageType) {
  const key = IMAGE_FIELD_MAP[imageType] ?? "boxArt";
  return game.images?.[key] ?? null;
}

/**
 * @param {import('./data/games.js').Game} game
 * @param {string} imageType
 */
export function candidateImagePaths(game, imageType) {
  const key = IMAGE_FIELD_MAP[imageType] ?? "boxArt";
  const paths = [];

  const fromCatalog = game.images?.[key];
  if (fromCatalog) paths.push(fromCatalog);

  paths.push(`assets/images/platforms/${game.platformId}/games/${game.raGameId}/${key}.png`);
  paths.push(`assets/images/games/${game.raGameId}-${key}.png`);

  return [...new Set(paths)];
}

/**
 * @param {import('./data/games.js').Game} game
 * @param {string} imageType
 * @returns {Promise<{ url: string, failed: boolean }>}
 */
export async function resolveGameImage(game, imageType) {
  for (const imagePath of candidateImagePaths(game, imageType)) {
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
 * @param {import('./state.js').Card} card
 * @returns {Promise<{ url: string, failed: boolean }>}
 */
export async function resolveCardImage(card) {
  const game = gameByRaId(card.raGameId);
  if (!game) {
    return { url: PLACEHOLDER_SVG, failed: true };
  }
  return resolveGameImage(game, card.imageType);
}

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
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
