#!/usr/bin/env node

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  readLocalLibretroImage,
  resolveLocalLibretroFilename,
} from "./local-libretro-source.mjs";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "nfc-fetch-images-local-libretro-"));
const playlistName = "Nintendo - Nintendo Entertainment System";
const boxArtDir = path.join(tempRoot, playlistName, "Named_Boxarts");
const titleDir = path.join(tempRoot, playlistName, "Named_Titles");

try {
  await mkdir(boxArtDir, { recursive: true });
  await mkdir(titleDir, { recursive: true });

  await writeFile(path.join(boxArtDir, "Super Mario Bros. (USA).png"), "box");
  await writeFile(path.join(boxArtDir, "super mario bros. (europe).PNG"), "box-eu");
  await writeFile(path.join(titleDir, "Super Mario Bros. (USA).png"), "title");

  const resolvedFromCandidates = await resolveLocalLibretroFilename(
    tempRoot,
    playlistName,
    "boxArt",
    "Super Mario Bros.",
    null,
  );
  if (resolvedFromCandidates !== "Super Mario Bros. (USA)") {
    throw new Error(`Expected USA box art, got ${String(resolvedFromCandidates)}`);
  }

  const resolvedFromKnownName = await resolveLocalLibretroFilename(
    tempRoot,
    playlistName,
    "boxArt",
    "Super Mario Bros.",
    "SUPER MARIO BROS. (usa)",
  );
  if (resolvedFromKnownName !== "Super Mario Bros. (USA)") {
    throw new Error(`Expected case-insensitive known-name match, got ${String(resolvedFromKnownName)}`);
  }

  const imageBuffer = await readLocalLibretroImage(
    tempRoot,
    playlistName,
    "titleScreen",
    "Super Mario Bros. (USA)",
  );
  if (!imageBuffer || imageBuffer.toString() !== "title") {
    throw new Error("Expected titleScreen image buffer from local mirror");
  }

  const missingImage = await readLocalLibretroImage(
    tempRoot,
    playlistName,
    "gamePicture",
    "Super Mario Bros. (USA)",
  );
  if (missingImage !== null) {
    throw new Error("Expected null for missing local mirror image");
  }

  console.log("✓ local libretro mirror filename resolution");
  console.log("✓ known libretro names match case-insensitively");
  console.log("✓ local libretro mirror image reads by app image type");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
