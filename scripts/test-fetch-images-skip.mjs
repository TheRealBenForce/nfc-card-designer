#!/usr/bin/env node

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existingImageTypes, imageFilePresent } from "./games-data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "nfc-fetch-images-skip-"));

try {
  const gameDir = path.join(tempRoot, "nes/games/2286");
  await mkdir(gameDir, { recursive: true });

  const boxArtPath = path.join(gameDir, "boxArt.png");
  await writeFile(boxArtPath, "png");

  if (!(await imageFilePresent(boxArtPath))) {
    throw new Error("Expected non-empty boxArt.png to be present");
  }

  await writeFile(path.join(gameDir, "titleScreen.png"), "");
  if (await imageFilePresent(path.join(gameDir, "titleScreen.png"))) {
    throw new Error("Empty files should not count as present");
  }

  const types = ["boxArt", "titleScreen", "gamePicture"];
  const present = await existingImageTypes(gameDir, types, false);
  if (present.length !== 1 || present[0] !== "boxArt") {
    throw new Error(`Expected only boxArt present, got ${JSON.stringify(present)}`);
  }

  const forced = await existingImageTypes(gameDir, types, true);
  if (forced.length !== 0) {
    throw new Error("Force mode should not report existing images");
  }

  const allPresent = await existingImageTypes(gameDir, ["boxArt"], false);
  if (allPresent.length !== 1) {
    throw new Error("Expected boxArt in existingImageTypes result");
  }

  console.log("✓ imageFilePresent ignores missing and empty files");
  console.log("✓ existingImageTypes reports only non-empty PNGs");
  console.log("✓ --force bypass is honored by existingImageTypes");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
