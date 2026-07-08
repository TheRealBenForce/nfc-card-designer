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
      const { resolveCardSizing, mmToRenderPx } = await import("/assets/js/cardSizing.js");
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
      const sizing = resolveCardSizing();
      const stickerInsetPx = mmToRenderPx(sizing.stickerInsetMm);
      const stickerRect = {
        x: stickerInsetPx,
        y: stickerInsetPx,
        w: canvas.width - stickerInsetPx * 2,
        h: canvas.height - stickerInsetPx * 2,
      };
      const stickerLayout = computeCardLayout(stickerRect.w, stickerRect.h);
      const insetLayout = {
        art: {
          ...stickerLayout.art,
          x: stickerLayout.art.x + stickerRect.x,
          y: stickerLayout.art.y + stickerRect.y,
        },
        platform: {
          ...stickerLayout.platform,
          x: stickerLayout.platform.x + stickerRect.x,
          y: stickerLayout.platform.y + stickerRect.y,
        },
        logo: {
          ...stickerLayout.logo,
          x: stickerLayout.logo.x + stickerRect.x,
          y: stickerLayout.logo.y + stickerRect.y,
        },
        color: {
          ...stickerLayout.color,
          x: stickerLayout.color.x + stickerRect.x,
          y: stickerLayout.color.y + stickerRect.y,
        },
      };

      const sample = (x, y) => {
        const px = ctx.getImageData(x, y, 1, 1).data;
        return [px[0], px[1], px[2]];
      };

      return {
        width: canvas.width,
        height: canvas.height,
        layout,
        insetLayout,
        stickerRect,
        cardCorner: sample(3, 3),
        art: sample(layout.art.x + 10, layout.art.y + 10),
        logoCenter: sample(
          Math.floor(insetLayout.logo.x + insetLayout.logo.w / 2),
          Math.floor(insetLayout.logo.y + insetLayout.logo.h / 2),
        ),
        colorCenter: sample(
          Math.floor(insetLayout.color.x + insetLayout.color.w / 2),
          Math.floor(insetLayout.color.y + insetLayout.color.h / 2),
        ),
      };
    });

    if (portrait.width >= portrait.height) {
      throw new Error(`Card should be portrait, got ${portrait.width}x${portrait.height}`);
    }
    console.log(`✓ Card canvas is portrait (${portrait.width}×${portrait.height})`);

    if (
      portrait.insetLayout.platform.y !== portrait.stickerRect.y
      || portrait.insetLayout.art.y !== portrait.insetLayout.platform.h + portrait.stickerRect.y
    ) {
      throw new Error("Portrait card should place platform strip on top, artwork below");
    }
    const expectedHeaderHeight = Math.round(portrait.stickerRect.h * 0.15);
    if (portrait.insetLayout.platform.h !== expectedHeaderHeight) {
      throw new Error(
        `Portrait header should default to 15% (${expectedHeaderHeight}px), got ${portrait.insetLayout.platform.h}px`,
      );
    }
    console.log("✓ Portrait: platform strip top (15%), artwork below");

    if (hex(...portrait.cardCorner) !== "#ffffff") {
      throw new Error("Card border should be white around the inset sticker");
    }
    console.log("✓ Card border renders as white card stock");

    if (portrait.insetLayout.logo.x !== portrait.insetLayout.platform.x) {
      throw new Error("Logo should stay within the platform strip");
    }
    if (portrait.insetLayout.color.x <= portrait.insetLayout.logo.x) {
      throw new Error("Portrait platform strip should split logo left, color right");
    }
    console.log("✓ Portrait platform strip: logo left, color right");

    if (hex(...portrait.logoCenter) === "#1a1a2e") {
      throw new Error("Logo area should render the platform icon");
    }
    if (hex(...portrait.colorCenter) !== "#b4000c") {
      throw new Error(`Color area should be solid fill #b4000c, got ${hex(...portrait.colorCenter)}`);
    }
    console.log("✓ Logo renders platform icon; color area is solid fill");

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
    console.log("✓ Landscape: artwork left (85%), platform right (15%), logo above color");

    const noHeader = await page.evaluate(async () => {
      const { computeCardLayout } = await import("/assets/js/cardLayout.js");
      return computeCardLayout(520, 840, { showHeader: false, showPlatformColor: true });
    });
    if (noHeader.platform.h !== 0 || noHeader.platform.w !== 0) {
      throw new Error("Hidden header should collapse platform segment");
    }
    if (noHeader.art.w !== 520 || noHeader.art.h !== 840) {
      throw new Error("Hidden header should allow artwork to fill the whole card");
    }

    const noColor = await page.evaluate(async () => {
      const { computeCardLayout } = await import("/assets/js/cardLayout.js");
      return computeCardLayout(520, 840, { showHeader: true, showPlatformColor: false });
    });
    if (noColor.color.w !== 0 || noColor.color.h !== 0) {
      throw new Error("Hidden platform color should collapse color segment");
    }
    if (noColor.logo.w !== noColor.platform.w || noColor.logo.h !== noColor.platform.h) {
      throw new Error("Hidden platform color should let the logo use the full header");
    }
    console.log("✓ Header toggles: hide header or color adjusts layout correctly");

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
