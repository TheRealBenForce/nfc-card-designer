#!/usr/bin/env node
/**
 * Downloads RetroAchievements artwork into assets/images/games/ and updates
 * assets/js/data/games.js with local image paths.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getGame } from "./ra-api.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const gamesPath = path.join(root, "assets/js/data/games.js");
const imagesDir = path.join(root, "assets/images/games");
const RA_BASE = "https://retroachievements.org";

async function downloadImage(relativePath, destPath) {
  if (!relativePath) return false;
  const url = relativePath.startsWith("http") ? relativePath : `${RA_BASE}${relativePath}`;
  const res = await fetch(url, { headers: { "User-Agent": "nfc-card-designer/1.0" } });
  if (!res.ok) return false;
  await writeFile(destPath, Buffer.from(await res.arrayBuffer()));
  return true;
}

async function main() {
  const { games } = await import(pathToFileURL(gamesPath).href);
  await mkdir(imagesDir, { recursive: true });

  const updated = [];

  for (const game of games) {
    process.stdout.write(`Fetching ${game.name} (${game.raGameId})… `);
    let images = { ...game.images };

    try {
      const data = await getGame(game.raGameId);
      const mapping = [
        ["boxArt", data.ImageBoxArt],
        ["titleScreen", data.ImageTitle],
        ["gamePicture", data.ImageIngame],
      ];

      for (const [type, relPath] of mapping) {
        if (!relPath) continue;
        const filename = `${game.raGameId}-${type}.png`;
        const ok = await downloadImage(relPath, path.join(imagesDir, filename));
        if (ok) images[type] = `assets/images/games/${filename}`;
      }
      console.log("done");
    } catch (err) {
      console.log(`failed (${err instanceof Error ? err.message : err})`);
    }

    updated.push({ ...game, images });
  }

  const header = `/**
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

  const footer = `
export function gamesForPlatform(platformId) {
  return games.filter((g) => g.platformId === platformId);
}

export function gameByRaId(raGameId) {
  return games.find((g) => g.raGameId === raGameId);
}
`;

  await writeFile(
    gamesPath,
    `${header}export const games = ${JSON.stringify(updated, null, 2)};
${footer}`,
  );

  console.log(`\nUpdated ${gamesPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
