import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isRetailRelease } from "../assets/js/retailFilter.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const gamesPath = path.join(root, "assets/js/data/games.js");
export const gamesByPlatformPath = path.join(root, "assets/data/games-by-platform.json");

const GAMES_HEADER = `/**
 * @typedef {Object} GameImages
 * @property {string} [boxArt]
 * @property {string} [titleScreen]
 * @property {string} [gamePicture]
 */

/**
 * @typedef {Object} Game
 * @property {string} platformId
 * @property {string} name
 * @property {number} raGameId
 * @property {GameImages} images
 */

/** @type {Game[]} */
`;

const GAMES_FOOTER = `
export function gamesForPlatform(platformId) {
  return games.filter((g) => g.platformId === platformId);
}

export function gameByPlatformAndRaId(platformId, raGameId) {
  return games.find((g) => g.platformId === platformId && g.raGameId === raGameId);
}

/** @param {{ platformId: string, raGameId: number }} card */
export function gameForCard(card) {
  return gameByPlatformAndRaId(card.platformId, card.raGameId);
}

export function gameByRaId(raGameId) {
  return games.find((g) => g.raGameId === raGameId);
}
`;

/** @param {import("../assets/js/data/games.js").Game[]} games */
export function gamesToByPlatform(games, options = {}) {
  const retailOnly = options.retailOnly !== false;
  /** @type {Record<string, { name: string, raGameId: number }[]>} */
  const platforms = {};

  for (const game of games) {
    if (retailOnly && !isRetailRelease(game.name)) continue;
    if (!platforms[game.platformId]) platforms[game.platformId] = [];
    platforms[game.platformId].push({ name: game.name, raGameId: game.raGameId });
  }

  for (const platformId of Object.keys(platforms)) {
    platforms[platformId].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }

  return platforms;
}

/**
 * @param {import("../assets/js/data/games.js").Game[]} games
 * @param {{ generatedAt?: string }} [meta]
 */
export async function writeGamesByPlatformJson(games, meta = {}) {
  const retailOnly = meta.retailOnly !== false;
  const payload = {
    version: 2,
    retailOnly,
    generatedAt: meta.generatedAt ?? new Date().toISOString(),
    platforms: gamesToByPlatform(games, { retailOnly }),
  };

  await mkdir(path.dirname(gamesByPlatformPath), { recursive: true });
  await writeFile(gamesByPlatformPath, `${JSON.stringify(payload, null, 2)}\n`);
}

/** @param {import("../assets/js/data/games.js").Game[]} games */
export async function writeGamesJs(games) {
  await writeFile(
    gamesPath,
    `${GAMES_HEADER}export const games = ${JSON.stringify(games, null, 2)};
${GAMES_FOOTER}`,
  );
  await writeGamesByPlatformJson(games, { retailOnly: true });
}

/** @param {string} platformId @param {number} raGameId @param {string} type */
export function gameImagePath(platformId, raGameId, type) {
  return `assets/images/platforms/${platformId}/games/${raGameId}/${type}.png`;
}

/** @param {string} platformId @param {number} raGameId */
export function gameImageDir(platformId, raGameId) {
  return path.join(root, "assets/images/platforms", platformId, "games", String(raGameId));
}
