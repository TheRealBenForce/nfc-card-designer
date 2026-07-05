#!/usr/bin/env node
/**
 * Downloads RetroAchievements artwork into assets/images/games/ and updates
 * assets/js/data/games.js with local image paths.
 *
 * Usage:
 *   cp .env.example .env
 *   npm run test-ra-auth
 *   npm run fetch-images
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildAuthorization, getGame, getTopTenUsers } from "@retroachievements/api";
import { loadRaCredentials, sanitizeApiKey } from "./env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const gamesPath = path.join(root, "assets/js/data/games.js");
const imagesDir = path.join(root, "assets/images/games");

const RA_BASE = "https://retroachievements.org";

async function verifyAuth(authorization) {
  try {
    await getTopTenUsers(authorization);
  } catch {
    throw new Error(
      "RetroAchievements API authentication failed. Run: npm run test-ra-auth",
    );
  }
}

async function downloadImage(relativePath, destPath) {
  if (!relativePath) return false;
  const url = relativePath.startsWith("http") ? relativePath : `${RA_BASE}${relativePath}`;
  const res = await fetch(url);
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
  return true;
}

function relativeAssetPath(filename) {
  return `assets/images/games/${filename}`;
}

async function main() {
  const { username, apiKey } = await loadRaCredentials();
  const authorization = buildAuthorization({ username, webApiKey: sanitizeApiKey(apiKey) });

  console.log("Verifying API credentials…");
  await verifyAuth(authorization);

  const { games } = await import(pathToFileURL(gamesPath).href);

  await mkdir(imagesDir, { recursive: true });

  const updated = [];

  for (const game of games) {
    process.stdout.write(`Fetching ${game.name} (${game.raGameId})… `);
    let images = { ...game.images };

    try {
      const data = await getGame(authorization, { gameId: game.raGameId });
      const mapping = [
        ["boxArt", data.imageBoxArt],
        ["titleScreen", data.imageTitle],
        ["gamePicture", data.imageIngame],
      ];

      for (const [type, relPath] of mapping) {
        if (!relPath) continue;
        const filename = `${game.raGameId}-${type}.png`;
        const dest = path.join(imagesDir, filename);
        const ok = await downloadImage(relPath, dest);
        if (ok) {
          images[type] = relativeAssetPath(filename);
        }
      }
      console.log("done");
    } catch (err) {
      console.log(`failed (${err instanceof Error ? err.message : err})`);
    }

    updated.push({ ...game, images });
  }

  const fileContent = `/**
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
export const games = ${JSON.stringify(updated, null, 2)};

export function gamesForPlatform(platformId) {
  return games.filter((g) => g.platformId === platformId);
}

export function gameByRaId(raGameId) {
  return games.find((g) => g.raGameId === raGameId);
}
`;

  await writeFile(gamesPath, fileContent);
  console.log(`\nUpdated ${gamesPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
