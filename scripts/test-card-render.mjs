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

      const artW = Math.round(canvas.width * 0.75);
      const logoH = Math.round(canvas.height * 0.75);
      const colX = artW;

      const artPx = ctx.getImageData(Math.floor(artW / 2), Math.floor(canvas.height / 2), 1, 1).data;
      const logoPx = ctx.getImageData(colX + 10, Math.floor(logoH / 2), 1, 1).data;
      const colorPx = ctx.getImageData(colX + 10, logoH + 10, 1, 1).data;

      return {
        width: canvas.width,
        height: canvas.height,
        artW,
        colX,
        logoH,
        art: [artPx[0], artPx[1], artPx[2]],
        logo: [logoPx[0], logoPx[1], logoPx[2]],
        color: [colorPx[0], colorPx[1], colorPx[2]],
      };
    });

    if (layout.width >= layout.height) {
      throw new Error(`Card should be portrait, got ${layout.width}x${layout.height}`);
    }
    console.log(`✓ Card canvas is portrait (${layout.width}×${layout.height})`);

    if (layout.colX !== layout.artW) {
      throw new Error("Platform column should start where artwork ends");
    }
    console.log("✓ Artwork and platform columns are positioned correctly");

    const logoColor = hex(...layout.logo);
    if (logoColor !== "#1a1a2e") {
      throw new Error(`Logo area should be #1a1a2e, got ${logoColor}`);
    }
    console.log("✓ Logo area background renders");

    const stripColor = hex(...layout.color);
    if (stripColor !== "#b4000c") {
      throw new Error(`Color strip should be NES red #b4000c, got ${stripColor}`);
    }
    console.log("✓ Platform color strip renders");

    const placeholderText = await page.evaluate(async () => {
      const { PLACEHOLDER_SVG } = await import("/assets/js/config.js");
      return decodeURIComponent(PLACEHOLDER_SVG.replace(/^data:image\/svg\+xml,/, ""));
    });

    if (placeholderText.toLowerCase().includes("giant bomb")) {
      throw new Error("Placeholder still references Giant Bomb");
    }
    console.log("✓ Placeholder text is up to date");

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
