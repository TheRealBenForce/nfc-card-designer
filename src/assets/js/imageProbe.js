import { gameByPlatformAndRaId } from "./data/games.js";

/** @type {Map<string, boolean>} */
const probeCache = new Map();

/**
 * @param {string} platformId
 * @param {number} raGameId
 */
export function gameProbeKey(platformId, raGameId) {
  return `${platformId}:${raGameId}`;
}

/**
 * @param {import("./gameCatalog.js").Game} game
 */
export function gameHasKnownImage(game) {
  if (Object.values(game.images).some((value) => Boolean(value))) {
    return true;
  }

  const cached = probeCache.get(gameProbeKey(game.platformId, game.raGameId));
  return cached === true;
}

/**
 * @param {string} url
 */
async function probeImageUrl(url) {
  return new Promise((resolve) => {
    const img = new Image();
    if (!url.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/**
 * @param {import("./gameCatalog.js").Game} game
 */
export async function ensureGameImageProbed(game) {
  if (Object.values(game.images).some((value) => Boolean(value))) {
    return true;
  }

  const key = gameProbeKey(game.platformId, game.raGameId);
  if (probeCache.has(key)) {
    return probeCache.get(key) === true;
  }

  const boxArtUrl = `assets/images/platforms/${game.platformId}/games/${game.raGameId}/boxArt.png`;
  const found = await probeImageUrl(boxArtUrl);
  probeCache.set(key, found);
  return found;
}
