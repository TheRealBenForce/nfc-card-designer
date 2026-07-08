import { DEFAULT_IMAGE_TYPE_PRIORITY } from "./config.js";
import { platforms } from "./data/platforms.js";

/**
 * @param {import('./state.js').Card[]} cards
 */
export function buildCollectionTree(cards) {
  /** @type {Map<string, import('./state.js').Card[]>} */
  const byPlatform = new Map();

  for (const card of cards) {
    if (!byPlatform.has(card.platformId)) {
      byPlatform.set(card.platformId, []);
    }
    byPlatform.get(card.platformId).push(card);
  }

  const artTypeOrder = new Map(DEFAULT_IMAGE_TYPE_PRIORITY.map((type, index) => [type, index]));

  return platforms
    .filter((platform) => byPlatform.has(platform.id))
    .map((platform) => ({
      platform,
      cards: byPlatform.get(platform.id).sort((a, b) => {
        const byName = a.gameName.localeCompare(b.gameName, undefined, { sensitivity: "base" });
        if (byName !== 0) return byName;
        return (artTypeOrder.get(a.imageType) ?? 99) - (artTypeOrder.get(b.imageType) ?? 99);
      }),
    }));
}
