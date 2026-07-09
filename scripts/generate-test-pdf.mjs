#!/usr/bin/env node
/**
 * Generate a single 3×3 letter-size PDF sheet using default global settings.
 *
 * Usage:
 *   npm run generate:test-pdf
 *   npm run generate:test-pdf -- --output my-sheet.pdf
 *
 * Requires the static file server (started automatically unless TEST_BASE_URL is set).
 */

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.TEST_PORT ?? "8000";
const BASE = process.env.TEST_BASE_URL ?? `http://localhost:${PORT}`;
const DEFAULT_OUTPUT = path.join(root, "output", "test-sheet.pdf");

/** @param {string[]} argv */
function parseArgs(argv) {
  let output = DEFAULT_OUTPUT;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--output" || argv[i] === "-o") {
      const value = argv[i + 1];
      if (!value) throw new Error("Missing value for --output");
      output = path.resolve(value);
      i++;
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log(`Usage: npm run generate:test-pdf [-- --output <path>]

Generate one full 3×3 PDF sheet with default global settings.

Options:
  -o, --output <path>  Output PDF path (default: output/test-sheet.pdf)
  -h, --help           Show this help message

Environment:
  TEST_BASE_URL        Base URL when the dev server is already running
  TEST_PORT            Port for auto-started server (default: 8000)
`);
      process.exit(0);
    }
  }
  return { output };
}

/** @param {string} base */
async function isServerUp(base) {
  try {
    const res = await fetch(base, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** @param {import('node:child_process').ChildProcess} server */
function stopServer(server) {
  if (!server.killed) server.kill("SIGTERM");
}

/** @param {string} base */
async function waitForServer(base) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (await isServerUp(base)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server not ready at ${base}`);
}

async function main() {
  const { output } = parseArgs(process.argv.slice(2));

  let server = null;
  let startedServer = false;

  if (!(await isServerUp(BASE))) {
    if (process.env.TEST_BASE_URL) {
      throw new Error(`Server not reachable at ${BASE}`);
    }
    console.log(`Starting dev server on port ${PORT}…`);
    server = spawn("npx", ["--yes", "serve", "src", "-l", PORT], {
      cwd: root,
      stdio: "ignore",
      detached: false,
    });
    startedServer = true;
    await waitForServer(BASE);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));

  try {
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });

    const result = await page.evaluate(async () => {
      const { buildLetterPdf } = await import("/assets/js/pdfExport.js");
      const { defaultSettings } = await import("/assets/js/storage.js");
      const { gamesForPlatform } = await import("/assets/js/data/games.js");
      const { platforms } = await import("/assets/js/data/platforms.js");
      const { CARDS_PER_ROW, CARDS_PER_COL } = await import("/assets/js/config.js");

      const cardsPerSheet = CARDS_PER_ROW * CARDS_PER_COL;
      const settings = defaultSettings();
      /** @type {import('/assets/js/state.js').Card[]} */
      const deck = [];

      for (const platform of platforms) {
        if (deck.length >= cardsPerSheet) break;
        const games = gamesForPlatform(platform.id);
        if (games.length === 0) continue;
        const game = games[0];
        deck.push({
          id: `test-${deck.length + 1}`,
          platformId: platform.id,
          gameName: game.name,
          raGameId: game.raGameId,
          imageType: "boxArt",
        });
      }

      if (deck.length < cardsPerSheet) {
        throw new Error(`Need ${cardsPerSheet} sample games, found only ${deck.length}`);
      }

      const pdf = await buildLetterPdf(deck, settings.platformDefaults, settings);
      const dataUri = pdf.output("datauristring");
      const base64 = dataUri.split(",")[1] ?? "";

      return {
        base64,
        cardCount: deck.length,
        games: deck.map((card) => `${card.platformId}: ${card.gameName}`),
      };
    });

    if (errors.length > 0) {
      throw new Error(`Page errors:\n${errors.join("\n")}`);
    }
    if (!result.base64) {
      throw new Error("PDF generation returned empty data");
    }

    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, Buffer.from(result.base64, "base64"));

    console.log(`✓ Generated ${result.cardCount}-card sheet with default global settings`);
    for (const label of result.games) {
      console.log(`  · ${label}`);
    }
    console.log(`✓ Wrote ${output}`);
  } finally {
    await browser.close();
    if (startedServer && server) stopServer(server);
  }
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
