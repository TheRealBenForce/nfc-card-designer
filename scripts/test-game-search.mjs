#!/usr/bin/env node
/**
 * Browser smoke test for 3-character game autocomplete.
 * Requires: local server on TEST_BASE_URL
 */

import { chromium } from "playwright";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:8000";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));

  try {
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 15000 });

    await page.fill("#platform-search", "nes");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);

    const dropdown = page.locator("#game-results");
    await page.fill("#game-search", "ma");
    await page.waitForTimeout(100);
    if (!(await dropdown.isHidden())) {
      throw new Error("Game dropdown should stay hidden before 3 characters");
    }
    console.log("✓ Dropdown hidden until 3 characters");

    await page.fill("#game-search", "mar");
    await page.waitForTimeout(100);
    if (await dropdown.isHidden()) {
      throw new Error("Game dropdown should appear at 3 characters");
    }

    const results = await page.locator("#game-results .list-item").allTextContents();
    if (!results.some((name) => name.includes("Super Mario Bros."))) {
      throw new Error(`Expected Mario in results, got: ${JSON.stringify(results)}`);
    }
    console.log("✓ 'mar' shows matching games");

    await page.fill("#game-search", "mario");
    await page.waitForTimeout(100);
    const filtered = await page.locator("#game-results .list-item").allTextContents();
    if (filtered.length === 0 || !filtered.every((name) => name.toLowerCase().includes("mario"))) {
      throw new Error(`Filtered results should all contain 'mario': ${JSON.stringify(filtered)}`);
    }
    console.log("✓ Results narrow as query grows");

    const hint = await page.locator("#game-search-hint").textContent();
    if (!hint?.includes("found") && !hint?.includes("matches")) {
      throw new Error(`Expected result count hint, got: ${hint}`);
    }
    console.log("✓ Search hint updates with result count");

    if (errors.length > 0) {
      throw new Error(`Page errors:\n${errors.join("\n")}`);
    }

    console.log("\nAll game search tests passed.");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
