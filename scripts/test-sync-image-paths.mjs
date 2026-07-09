#!/usr/bin/env node
/**
 * Unit tests for libretro image path scanning used by sync-image-manifest.
 */

import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { mergeInventory, scanLibretroImagesFromDisk } from "./image-manifest.mjs";
import { libretroImageKeyForType } from "./libretro-image-paths.mjs";

const playlist = "Nintendo - Nintendo Entertainment System";
const libretroName = "Super Mario Bros. (USA)";
const tempRoot = await mkdtemp(path.join(tmpdir(), "sync-image-manifest-"));

try {
  const boxArtKey = libretroImageKeyForType(playlist, "boxArt", libretroName);
  const boxArtPath = path.join(tempRoot, boxArtKey);
  await mkdir(path.dirname(boxArtPath), { recursive: true });
  await writeFile(boxArtPath, "png");

  const availability = await scanLibretroImagesFromDisk(tempRoot);
  const types = availability[playlist]?.[libretroName];
  if (!types?.boxArt) {
    throw new Error(`Expected boxArt for ${playlist}/${libretroName}, got ${JSON.stringify(availability)}`);
  }

  const titleKey = libretroImageKeyForType(playlist, "titleScreen", libretroName);
  const merged = mergeInventory(availability, {
    [playlist]: {
      [libretroName]: {
        titleScreen: titleKey,
      },
    },
  });
  if (!merged[playlist][libretroName].titleScreen) {
    throw new Error("mergeInventory should union image types");
  }

  console.log("✓ scanLibretroImagesFromDisk finds local PNGs");
  console.log("✓ mergeInventory unions playlists and image types");
  console.log("\nAll sync-image-manifest helper tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
