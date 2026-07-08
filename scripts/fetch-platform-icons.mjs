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
  "sega-cd": "segacd",
  "sega-32x": "sega32x",
  "turbo-grafx": "tg16",
  "pc-engine-cd": "pce-cd",
  saturn: "saturn",
  n64: "n64",
  "neo-geo": "neogeo",
  playstation: "psx",
  arcade: "arcade",
};

const DOS_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="DOS">
  <rect width="64" height="64" rx="8" fill="#000000"/>
  <text x="32" y="40" text-anchor="middle" font-family="monospace" font-size="22" font-weight="700" fill="#c0c0c0">DOS</text>
</svg>`;

async function main() {
  for (const [platformId, carbonFolder] of Object.entries(PLATFORM_CARBON_FOLDERS)) {
    const destDir = path.join(root, "src/assets/images/platforms", platformId);
    const destFile = path.join(destDir, "icon.svg");

    const url = `${CARBON_BASE}/${carbonFolder}/art/system.svg`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }

    const svg = await res.text();
    await mkdir(destDir, { recursive: true });
    await writeFile(destFile, svg, "utf8");
    console.log(`✓ ${platformId} ← ${carbonFolder}/art/system.svg`);
  }

  const dosDir = path.join(root, "src/assets/images/platforms", "dos");
  await mkdir(dosDir, { recursive: true });
  await writeFile(path.join(dosDir, "icon.svg"), DOS_PLACEHOLDER_SVG, "utf8");
  console.log("✓ dos ← bundled placeholder SVG");

  console.log(`\nDownloaded ${Object.keys(PLATFORM_CARBON_FOLDERS).length + 1} platform icons.`);
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
