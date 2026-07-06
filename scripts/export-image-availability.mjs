#!/usr/bin/env node

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gamesPath, imageAvailabilityPath } from "./games-data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { games } = await import(pathToFileURL(gamesPath).href);

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

const payload = {
  version: 1,
  generatedAt: new Date().toISOString(),
  platforms,
};

await mkdir(path.dirname(imageAvailabilityPath), { recursive: true });
await writeFile(imageAvailabilityPath, `${JSON.stringify(payload, null, 2)}\n`);

const gameCount = Object.values(platforms).reduce((sum, entries) => sum + Object.keys(entries).length, 0);
console.log(`Wrote image availability for ${gameCount} games to assets/data/image-availability.json`);
