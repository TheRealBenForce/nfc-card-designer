import { writeFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isRetailRelease } from "../src/assets/js/retailFilter.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const platformsImageRoot = path.join(root, "src/assets/images/platforms");

/** @type {Record<string, string>} */
const IMAGE_FILE_TYPES = {
  "boxArt.png": "boxArt",
  "titleScreen.png": "titleScreen",
  "gamePicture.png": "gamePicture",
};

export const gamesPath = path.join(root, "src/assets/js/data/games.js");
export const gamesByPlatformPath = path.join(root, "src/assets/data/games-by-platform.json");
export const imageAvailabilityPath = path.join(root, "src/assets/data/image-availability.json");

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
 * @property {string} [libretroName] - Resolved libretro thumbnail basename (no .png)
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

/** @param {import("../src/assets/js/data/games.js").Game[]} games */
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
 * @param {import("../src/assets/js/data/games.js").Game[]} games
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

/** @param {import("../src/assets/js/data/games.js").Game[]} games */
export async function writeGamesJs(games) {
  await writeFile(
    gamesPath,
    `${GAMES_HEADER}export const games = ${JSON.stringify(games, null, 2)};
${GAMES_FOOTER}`,
  );
  await writeGamesByPlatformJson(games, { retailOnly: true });
}

/** @param {string} [rootDir] */
export async function scanImageAvailabilityFromDisk(rootDir = platformsImageRoot) {
  /** @type {Record<string, Record<string, string[]>>} */
  const platforms = {};

  let platformEntries = [];
  try {
    platformEntries = await readdir(rootDir, { withFileTypes: true });
  } catch {
    return platforms;
  }

  for (const platformEntry of platformEntries) {
    if (!platformEntry.isDirectory()) continue;

    const platformId = platformEntry.name;
    const gamesDir = path.join(rootDir, platformId, "games");

    let gameEntries = [];
    try {
      gameEntries = await readdir(gamesDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const gameEntry of gameEntries) {
      if (!gameEntry.isDirectory()) continue;

      const raGameId = gameEntry.name;
      if (!/^\d+$/.test(raGameId)) continue;

      const imageDir = path.join(gamesDir, raGameId);
      const files = await readdir(imageDir);
      const types = files
        .map((file) => IMAGE_FILE_TYPES[file])
        .filter((type) => Boolean(type));

      if (types.length === 0) continue;

      if (!platforms[platformId]) platforms[platformId] = {};
      platforms[platformId][raGameId] = [...new Set(types)].sort();
    }
  }

  return platforms;
}

/**
 * @param {Record<string, Record<string, string[]>>} base
 * @param {Record<string, Record<string, string[]>>} extra
 */
export function mergeImageAvailability(base, extra) {
  /** @type {Record<string, Record<string, string[]>>} */
  const merged = structuredClone(base);

  for (const [platformId, games] of Object.entries(extra)) {
    if (!merged[platformId]) merged[platformId] = {};
    for (const [raGameId, types] of Object.entries(games)) {
      merged[platformId][raGameId] = [...new Set([...(merged[platformId][raGameId] ?? []), ...types])].sort();
    }
  }

  return merged;
}

/** @param {import("../src/assets/js/data/games.js").Game[]} games */
export function imageAvailabilityFromGames(games) {
  /** @type {Record<string, Record<string, string[]>>} */
  const platforms = {};

  for (const game of games) {
    const types = Object.entries(game.images ?? {})
      .filter(([, imagePath]) => Boolean(imagePath))
      .map(([type]) => type);
    if (types.length === 0) continue;

    if (!platforms[game.platformId]) platforms[game.platformId] = {};
    platforms[game.platformId][String(game.raGameId)] = types;
  }

  return platforms;
}

/** @param {import("../src/assets/js/data/games.js").Game[]} [games] */
export async function buildImageAvailability(games = []) {
  const fromGames = imageAvailabilityFromGames(games);
  const fromDisk = await scanImageAvailabilityFromDisk();
  return mergeImageAvailability(fromGames, fromDisk);
}

/** @param {import("../src/assets/js/data/games.js").Game[]} games */
export async function writeImageAvailabilityJson(games) {
  const platforms = await buildImageAvailability(games);

  const payload = {
    version: 2,
    generatedAt: new Date().toISOString(),
    platforms,
  };

  await mkdir(path.dirname(imageAvailabilityPath), { recursive: true });
  await writeFile(imageAvailabilityPath, `${JSON.stringify(payload, null, 2)}\n`);
}

/** @param {string} platformId @param {number} raGameId @param {string} type */
export function gameImagePath(platformId, raGameId, type) {
  return `assets/images/platforms/${platformId}/games/${raGameId}/${type}.png`;
}

/** @param {string} platformId @param {number} raGameId */
export function gameImageDir(platformId, raGameId) {
  return path.join(root, "src/assets/images/platforms", platformId, "games", String(raGameId));
}

/** @param {string} filePath */
export async function imageFilePresent(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

/**
 * @param {string} dir
 * @param {string[]} imageTypes
 * @param {boolean} [force]
 */
export async function existingImageTypes(dir, imageTypes, force = false) {
  if (force) return [];

  /** @type {string[]} */
  const present = [];
  for (const type of imageTypes) {
    if (await imageFilePresent(path.join(dir, `${type}.png`))) {
      present.push(type);
    }
  }
  return present;
}
