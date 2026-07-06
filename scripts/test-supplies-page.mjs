#!/usr/bin/env node
/**
 * Browser smoke test for the /supplies page.
 * Run: node scripts/test-supplies-page.mjs
 * Requires: static server running (see npm run verify)
 */

import { chromium } from "playwright";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:8000";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  try {
    await page.goto(`${BASE}/supplies/`, { waitUntil: "networkidle", timeout: 15000 });

    const title = await page.title();
    if (!title.includes("Supplies")) {
      throw new Error(`Expected supplies page title, got "${title}"`);
    }
    console.log("✓ Supplies page loads");

    const printablesLink = page.locator('a[href*="printables.com/model/1022980"]');
    if ((await printablesLink.count()) !== 1) {
      throw new Error("Expected one Printables link for the sticker applicator");
    }
    console.log("✓ Printables applicator link present");

    const amazonLinks = page.locator('a[href*="amazon.com"]');
    const amazonCount = await amazonLinks.count();
    if (amazonCount < 4) {
      throw new Error(`Expected at least 4 Amazon links, got ${amazonCount}`);
    }
    console.log(`✓ ${amazonCount} Amazon search links present`);

    await page.locator(".header__link", { hasText: "Back to Designer" }).click();
    await page.waitForURL((url) => url.pathname.endsWith("/") || url.pathname.endsWith("/index.html"), {
      timeout: 5000,
    });
    console.log("✓ Navigation back to designer works");

    await page.locator(".header__link", { hasText: "Supplies" }).click();
    await page.waitForURL(/\/supplies\/?$/, { timeout: 5000 });
    console.log("✓ Navigation from designer to supplies works");

    if (errors.length) {
      throw new Error(`Page errors:\n${errors.join("\n")}`);
    }
  } finally {
    await browser.close();
  }

  console.log("\n✓ supplies page smoke test passed");
}

main().catch((err) => {
  console.error("\n✗ supplies page smoke test failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
