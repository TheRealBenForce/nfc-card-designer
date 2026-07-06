import { platforms } from "./data/platforms.js";

/**
 * @param {import('./state.js').Card[]} cards
 */
export function buildCollectionTree(cards) {
  /** @type {Map<string, Map<number, { raGameId: number, name: string, cards: import('./state.js').Card[] }>>} */
  const byPlatform = new Map();

  for (const card of cards) {
    if (!byPlatform.has(card.platformId)) {
      byPlatform.set(card.platformId, new Map());
    }
    const games = byPlatform.get(card.platformId);
    if (!games.has(card.raGameId)) {
      games.set(card.raGameId, { raGameId: card.raGameId, name: card.gameName, cards: [] });
    }
    games.get(card.raGameId).cards.push(card);
  }

  return platforms
    .filter((platform) => byPlatform.has(platform.id))
    .map((platform) => ({
      platform,
      games: [...byPlatform.get(platform.id).values()].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    }));
}
