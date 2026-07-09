import { gameByPlatformAndRaId } from "./data/games.js";

/** @type {Map<string, boolean>} */
const probeCache = new Map();

/** @type {Map<string, Promise<void>>} */
const indexPromises = new Map();

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
 * @param {string} platformId
 */
export function isPlatformArtworkIndexInProgress(platformId) {
  return indexPromises.has(platformId);
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

/**
 * @param {string} platformId
 * @param {{ name: string, raGameId: number }[]} entries
 * @param {() => void} [onProgress]
 */
export async function ensurePlatformArtworkIndexed(platformId, entries, onProgress) {
  const existing = indexPromises.get(platformId);
  if (existing) {
    await existing;
    return;
  }

  const run = (async () => {
    const concurrency = 20;
    let index = 0;

    async function worker() {
      while (index < entries.length) {
        const entry = entries[index];
        index += 1;

        const images = gameByPlatformAndRaId(platformId, entry.raGameId)?.images ?? {};
        await ensureGameImageProbed({
          platformId,
          name: entry.name,
          raGameId: entry.raGameId,
          images,
        });
        onProgress?.();
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(concurrency, entries.length || 1) }, worker),
    );
  })();

  indexPromises.set(platformId, run);
  try {
    await run;
  } finally {
    indexPromises.delete(platformId);
  }
}
