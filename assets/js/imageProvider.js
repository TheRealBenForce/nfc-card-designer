import { PLACEHOLDER_SVG } from "./config.js";
import { gameForCard } from "./gameCatalog.js";

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
 * @param {import('./state.js').Card} card
 * @param {import('./data/games.js').Game | undefined} game
 * @param {string} imageType
 */
export function candidateImagePaths(card, game, imageType) {
  const key = IMAGE_FIELD_MAP[imageType] ?? "boxArt";
  const paths = [];

  paths.push(`assets/images/platforms/${card.platformId}/games/${card.raGameId}/${key}.png`);

  const fromCatalog = game?.images?.[key];
  if (fromCatalog) paths.push(fromCatalog);

  paths.push(`assets/images/games/${card.raGameId}-${key}.png`);

  return [...new Set(paths)];
}

/**
 * @param {import('./data/games.js').Game} game
 * @param {string} imageType
 * @returns {Promise<{ url: string, failed: boolean }>}
 */
export async function resolveGameImage(game, imageType) {
  const card = { platformId: game.platformId, raGameId: game.raGameId };
  for (const imagePath of candidateImagePaths(card, game, imageType)) {
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
