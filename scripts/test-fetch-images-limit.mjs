#!/usr/bin/env node

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  removeEmptyPlatformImageDirs,
  selectGameNamesForPlatform,
} from "./fetch-images.mjs";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "nfc-fetch-images-limit-"));

try {
  const selected = selectGameNamesForPlatform(
    ["Zelda (USA).png", "Mario (USA).png", "Beta (USA).png", "~Hack~ Foo"],
    { maxGames: 2 },
  );
  if (!selected.has("Mario (USA)") || !selected.has("Zelda (USA)")) {
    throw new Error(`Expected first two retail games, got ${JSON.stringify([...selected])}`);
  }
  if (selected.size !== 2) {
    throw new Error(`Expected max-games cap of 2, got ${selected.size}`);
  }

  const playlistDir = path.join(tempRoot, "Sega - 32X");
  const boxArtDir = path.join(playlistDir, "Named_Boxarts");
  const titlesDir = path.join(playlistDir, "Named_Titles");
  await mkdir(boxArtDir, { recursive: true });
  await mkdir(titlesDir, { recursive: true });
  await writeFile(path.join(boxArtDir, "keep.png"), "x");
  await mkdir(path.join(playlistDir, "Named_Snaps"), { recursive: true });

  const removed = await removeEmptyPlatformImageDirs("Sega - 32X", tempRoot);
  if (removed < 1) {
    throw new Error(`Expected at least one empty folder removed, got ${removed}`);
  }

  const remaining = await import("node:fs/promises").then((fs) => fs.readdir(playlistDir));
  if (!remaining.includes("Named_Boxarts")) {
    throw new Error("Non-empty boxart folder should remain");
  }
  if (remaining.includes("Named_Titles") || remaining.includes("Named_Snaps")) {
    throw new Error("Empty image folders should be removed");
  }

  console.log("✓ selectGameNamesForPlatform caps and filters retail boxart names");
  console.log("✓ removeEmptyPlatformImageDirs prunes empty libretro folders");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
