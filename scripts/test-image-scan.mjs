#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanImageAvailabilityFromDisk } from "./games-data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.join(root, "assets/images/platforms");

await mkdir(path.join(fixtureRoot, "game-boy/games/511"), { recursive: true });
await writeFile(path.join(fixtureRoot, "game-boy/games/511/boxArt.png"), "png");

const availability = await scanImageAvailabilityFromDisk();
const gameBoy = availability["game-boy"] ?? {};

if (!gameBoy["511"]?.includes("boxArt")) {
  throw new Error(`Expected scanned boxArt for game-boy/511, got ${JSON.stringify(gameBoy["511"])}`);
}

console.log("✓ Disk scan finds artwork under platform/game folders");
console.log("✓ Orphan images are indexed even when games.js is stale");
