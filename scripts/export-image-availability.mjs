#!/usr/bin/env node
/**
 * Scans platform game image folders on disk and writes image-availability.json.
 * Use after downloading images so search finds games even when games.js is stale.
 */

import { pathToFileURL } from "node:url";
import { gamesPath, writeImageAvailabilityJson, buildImageAvailability } from "./games-data.mjs";

const { games } = await import(pathToFileURL(gamesPath).href);
await writeImageAvailabilityJson(games);

const platforms = await buildImageAvailability(games);
const gameCount = Object.values(platforms).reduce(
  (sum, entries) => sum + Object.keys(entries).length,
  0,
);

console.log(`Wrote image availability for ${gameCount} games to assets/data/image-availability.json`);
