import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const gamesPath = path.join(root, "assets/js/data/games.js");

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
export async function writeGamesJs(games) {
  await writeFile(
    gamesPath,
    `${GAMES_HEADER}export const games = ${JSON.stringify(games, null, 2)};
${GAMES_FOOTER}`,
  );
}

/** @param {string} platformId @param {number} raGameId @param {string} type */
export function gameImagePath(platformId, raGameId, type) {
  return `assets/images/platforms/${platformId}/games/${raGameId}/${type}.png`;
}

/** @param {string} platformId @param {number} raGameId */
export function gameImageDir(platformId, raGameId) {
  return path.join(root, "assets/images/platforms", platformId, "games", String(raGameId));
}
