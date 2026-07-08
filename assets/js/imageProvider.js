import { IMAGE_ASSET_ORIGIN, PLACEHOLDER_SVG } from "./config.js";
import { gameByPlatformAndRaId } from "./data/games.js";

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
  return toS3ImageUrl(game.images?.[key] ?? null);
}

/**
 * Convert relative game-image paths to absolute S3 URLs.
 * @param {string | null | undefined} value
 */
export function toS3ImageUrl(value) {
  if (!value) return null;
  if (/^(?:https?:|data:)/i.test(value)) return value;

  const normalized = value.startsWith("/") ? value : `/${value.replace(/^\.?\//, "")}`;
  return new URL(normalized, IMAGE_ASSET_ORIGIN).toString();
}

/**
 * @param {import('./state.js').Card} card
 * @param {import('./data/games.js').Game | undefined} game
 * @param {string} imageType
 */
export function candidateImagePaths(card, game, imageType) {
  const key = IMAGE_FIELD_MAP[imageType] ?? "boxArt";
  /** @type {string[]} */
  const paths = [];

  paths.push(
    toS3ImageUrl(`assets/images/platforms/${card.platformId}/games/${card.raGameId}/${key}.png`),
  );

  const fromCatalog = game?.images?.[key];
  if (fromCatalog) {
    const remotePath = toS3ImageUrl(fromCatalog);
    if (remotePath) paths.push(remotePath);
  }

  paths.push(toS3ImageUrl(`assets/images/games/${card.raGameId}-${key}.png`));

  return [...new Set(paths.filter(Boolean))];
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
  const game = gameByPlatformAndRaId(card.platformId, card.raGameId);
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
