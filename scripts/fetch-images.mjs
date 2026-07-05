#!/usr/bin/env node
/**
 * Downloads RetroAchievements artwork into assets/images/games/ and updates
 * assets/js/data/games.js with local image paths.
 *
 * Usage:
 *   cp .env.example .env   # add your RA_API_KEY
 *   npm run fetch-images
 *
 * The API key stays on your machine — it is never deployed to GitHub Pages.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const gamesPath = path.join(root, "assets/js/data/games.js");
const imagesDir = path.join(root, "assets/images/games");

const RA_BASE = "https://retroachievements.org";

async function loadEnv() {
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) {
    console.error("Missing .env file. Copy .env.example to .env and set RA_API_KEY.");
    process.exit(1);
  }
  const text = await readFile(envPath, "utf8");
  const key = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("RA_API_KEY="))
    ?.split("=")[1]
    ?.trim();
  if (!key) {
    console.error("RA_API_KEY not found in .env");
    process.exit(1);
  }
  return key;
}

async function fetchGame(apiKey, gameId) {
  const url = `${RA_BASE}/API/API_GetGame.php?y=${encodeURIComponent(apiKey)}&i=${gameId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for game ${gameId}`);
  return res.json();
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
  const apiKey = await loadEnv();
  const { games } = await import(pathToFileURL(gamesPath).href);

  await mkdir(imagesDir, { recursive: true });

  const updated = [];

  for (const game of games) {
    process.stdout.write(`Fetching ${game.name} (${game.raGameId})… `);
    let images = { ...game.images };

    try {
      const data = await fetchGame(apiKey, game.raGameId);
      const mapping = [
        ["boxArt", data.ImageBoxArt ?? data.imageBoxArt],
        ["titleScreen", data.ImageTitle ?? data.imageTitle],
        ["gamePicture", data.ImageIngame ?? data.imageIngame],
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
      console.log(`failed (${err.message})`);
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
  console.error(err);
  process.exit(1);
});
