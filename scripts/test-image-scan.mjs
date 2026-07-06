#!/usr/bin/env node

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanImageAvailabilityFromDisk } from "./games-data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "nfc-image-scan-"));

try {
  await mkdir(path.join(tempRoot, "game-boy/games/511"), { recursive: true });
  await writeFile(path.join(tempRoot, "game-boy/games/511/boxArt.png"), "png");

  const availability = await scanImageAvailabilityFromDisk(tempRoot);
  const gameBoy = availability["game-boy"] ?? {};

  if (!gameBoy["511"]?.includes("boxArt")) {
    throw new Error(`Expected scanned boxArt for game-boy/511, got ${JSON.stringify(gameBoy["511"])}`);
  }

  console.log("✓ Disk scan finds artwork under platform/game folders");
  console.log("✓ Orphan images are indexed even when games.js is stale");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
