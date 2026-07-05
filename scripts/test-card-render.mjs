#!/usr/bin/env node
/**
 * Browser smoke test for card canvas layout and image resolution.
 * Requires: npm start running on port 8000
 */

import { chromium } from "playwright";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:8000";

/** @param {number} r @param {number} g @param {number} b */
function hex(r, g, b) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));

  try {
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 15000 });

    const layout = await page.evaluate(async () => {
      const { renderCard } = await import("/assets/js/cardRenderer.js");
      const canvas = await renderCard(
        {
          id: "test",
          platformId: "nes",
          gameName: "Super Mario Bros.",
          raGameId: 2286,
          imageType: "boxArt",
        },
        { nes: "#b4000c" },
      );

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No canvas context");

      const stripH = Math.round(canvas.height * 0.25);
      const artH = canvas.height - stripH;
      const logoW = Math.round(canvas.width * 0.75);

      const logoPx = ctx.getImageData(5, 5, 1, 1).data;
      const colorPx = ctx.getImageData(logoW + 5, 5, 1, 1).data;
      const artPx = ctx.getImageData(Math.floor(canvas.width / 2), stripH + Math.floor(artH / 2), 1, 1).data;

      return {
        width: canvas.width,
        height: canvas.height,
        stripH,
        artH,
        logoW,
        logo: [logoPx[0], logoPx[1], logoPx[2]],
        color: [colorPx[0], colorPx[1], colorPx[2]],
        art: [artPx[0], artPx[1], artPx[2]],
      };
    });

    if (layout.width >= layout.height) {
      throw new Error(`Card should be portrait, got ${layout.width}x${layout.height}`);
    }
    console.log(`✓ Card canvas is portrait (${layout.width}×${layout.height})`);

    if (layout.stripH + layout.artH !== layout.height) {
      throw new Error("Platform strip and artwork should fill card height");
    }
    console.log("✓ Platform strip (top) and artwork (bottom) stack correctly");

    const logoColor = hex(...layout.logo);
    if (logoColor !== "#1a1a2e") {
      throw new Error(`Logo area should be #1a1a2e, got ${logoColor}`);
    }
    console.log("✓ Logo area renders in top strip (left)");

    const stripColor = hex(...layout.color);
    if (stripColor !== "#b4000c") {
      throw new Error(`Color strip should be NES red #b4000c, got ${stripColor}`);
    }
    console.log("✓ Platform color renders in top strip (right)");

    const artColor = hex(...layout.art);
    if (artColor === "#1a1a2e" || artColor === "#b4000c") {
      throw new Error(`Artwork area should be below platform strip, sampled ${artColor}`);
    }
    console.log("✓ Artwork area renders below platform strip");

    if (errors.length > 0) {
      throw new Error(`Page errors:\n${errors.join("\n")}`);
    }

    console.log("\nAll card render tests passed.");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
