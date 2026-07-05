import { PLACEHOLDER_SVG } from "./config.js";

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
 * @returns {Promise<{ url: string, failed: boolean }>}
 */
export async function resolveGameImage(game, imageType) {
  const localPath = getGameImagePath(game, imageType);

  if (localPath) {
    try {
      await loadImage(localPath);
      return { url: localPath, failed: false };
    } catch {
      return { url: PLACEHOLDER_SVG, failed: true };
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
