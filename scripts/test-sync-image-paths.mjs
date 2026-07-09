#!/usr/bin/env node
/**
 * Unit tests for image path scanning helpers used by sync-image-paths.
 */

import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  mergeImageAvailability,
  scanImageAvailabilityFromDisk,
  imagePathsForTypes,
} from "./games-data.mjs";

const tempRoot = await mkdtemp(path.join(tmpdir(), "sync-image-paths-"));
try {
  const platformDir = path.join(tempRoot, "atari-2600", "games", "42");
  await mkdir(platformDir, { recursive: true });
  await writeFile(path.join(platformDir, "boxArt.png"), "png");

  const availability = await scanImageAvailabilityFromDisk(tempRoot);
  const types = availability["atari-2600"]?.["42"];
  if (!types || !types.includes("boxArt")) {
    throw new Error(`Expected boxArt for atari-2600/42, got ${JSON.stringify(availability)}`);
  }

  const merged = mergeImageAvailability(
    { "atari-2600": { "42": ["boxArt"] } },
    { "atari-2600": { "42": ["titleScreen"], "99": ["gamePicture"] } },
  );
  if (!merged["atari-2600"]["42"].includes("titleScreen")) {
    throw new Error("mergeImageAvailability should union image types");
  }
  if (!merged["atari-2600"]["99"].includes("gamePicture")) {
    throw new Error("mergeImageAvailability should add new games");
  }

  const paths = imagePathsForTypes("atari-2600", 42, ["boxArt", "titleScreen"]);
  if (paths.boxArt !== "assets/images/platforms/atari-2600/games/42/boxArt.png") {
    throw new Error(`Unexpected boxArt path: ${paths.boxArt}`);
  }

  console.log("✓ scanImageAvailabilityFromDisk finds local PNGs");
  console.log("✓ mergeImageAvailability unions platforms and types");
  console.log("✓ imagePathsForTypes builds canonical paths");
  console.log("\nAll sync-image-paths helper tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
