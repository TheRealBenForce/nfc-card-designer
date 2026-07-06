#!/usr/bin/env node
/**
 * Download platform system icons from RetroPie es-theme-carbon.
 * https://github.com/RetroPie/es-theme-carbon
 *
 * Run: node scripts/fetch-platform-icons.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CARBON_BASE =
  "https://raw.githubusercontent.com/RetroPie/es-theme-carbon/master";

/** @type {Record<string, string>} platform id → carbon theme folder name */
const PLATFORM_CARBON_FOLDERS = {
  "atari-2600": "atari2600",
  nes: "nes",
  "master-system": "mastersystem",
  "game-boy": "gb",
  "game-boy-color": "gbc",
  snes: "snes",
  genesis: "genesis",
  saturn: "saturn",
  n64: "n64",
  "neo-geo": "neogeo",
  playstation: "psx",
  arcade: "arcade",
};

async function main() {
  for (const [platformId, carbonFolder] of Object.entries(PLATFORM_CARBON_FOLDERS)) {
    const url = `${CARBON_BASE}/${carbonFolder}/art/system.svg`;
    const destDir = path.join(root, "assets/images/platforms", platformId);
    const destFile = path.join(destDir, "icon.svg");

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }

    const svg = await res.text();
    await mkdir(destDir, { recursive: true });
    await writeFile(destFile, svg, "utf8");
    console.log(`✓ ${platformId} ← ${carbonFolder}/art/system.svg`);
  }

  console.log(`\nDownloaded ${Object.keys(PLATFORM_CARBON_FOLDERS).length} platform icons.`);
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
