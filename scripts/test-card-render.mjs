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

    const portrait = await page.evaluate(async () => {
      const { renderCard } = await import("/assets/js/cardRenderer.js");
      const { computeCardLayout } = await import("/assets/js/cardLayout.js");
      const canvas = await renderCard(
        {
          id: "test",
          platformId: "nes",
          gameName: "Super Mario Bros.",
          raGameId: 2286,
          imageType: "boxArt",
        },
        {
          nes: {
            color: "#b4000c",
            imageRotation: { boxArt: 0, titleScreen: 0, gamePicture: 0 },
          },
        },
      );

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No canvas context");

      const layout = computeCardLayout(canvas.width, canvas.height);

      const sample = (x, y) => {
        const px = ctx.getImageData(x, y, 1, 1).data;
        return [px[0], px[1], px[2]];
      };

      return {
        width: canvas.width,
        height: canvas.height,
        layout,
        art: sample(layout.art.x + 10, layout.art.y + 10),
        logo: sample(layout.logo.x + 5, layout.logo.y + 5),
        color: sample(layout.color.x + layout.color.w - 5, layout.color.y + 5),
      };
    });

    if (portrait.width >= portrait.height) {
      throw new Error(`Card should be portrait, got ${portrait.width}x${portrait.height}`);
    }
    console.log(`✓ Card canvas is portrait (${portrait.width}×${portrait.height})`);

    if (portrait.layout.platform.y !== 0 || portrait.layout.art.y !== portrait.layout.platform.h) {
      throw new Error("Portrait card should place platform strip on top, artwork below");
    }
    console.log("✓ Portrait: platform strip top (25%), artwork bottom (75%)");

    if (portrait.layout.logo.x !== portrait.layout.platform.x) {
      throw new Error("Logo should stay within the platform strip");
    }
    if (portrait.layout.color.x <= portrait.layout.logo.x) {
      throw new Error("Portrait platform strip should split logo left, color right");
    }
    console.log("✓ Portrait platform strip: logo left, color right");

    if (hex(...portrait.logo) !== "#1a1a2e") {
      throw new Error(`Logo area should be #1a1a2e, got ${hex(...portrait.logo)}`);
    }
    if (hex(...portrait.color) !== "#b4000c") {
      throw new Error(`Color area should be #b4000c, got ${hex(...portrait.color)}`);
    }
    console.log("✓ Logo and color regions render correctly");

    const landscape = await page.evaluate(async () => {
      const { splitArtAndPlatform, splitLogoAndColor } = await import("/assets/js/cardLayout.js");
      const cardW = 840;
      const cardH = 520;
      const { art, platform } = splitArtAndPlatform({ x: 0, y: 0, w: cardW, h: cardH });
      const { logo, color } = splitLogoAndColor(platform);
      return { art, platform, logo, color };
    });

    if (landscape.art.x + landscape.art.w !== landscape.platform.x) {
      throw new Error("Landscape card should split artwork left, platform right");
    }
    if (landscape.logo.y !== landscape.platform.y) {
      throw new Error("Landscape platform column: logo should be at top of column");
    }
    if (landscape.color.y !== landscape.logo.h) {
      throw new Error("Landscape platform column should split logo top, color bottom");
    }
    console.log("✓ Landscape: artwork left (75%), platform right (25%), logo above color");

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
