#!/usr/bin/env node
/**
 * Browser smoke test for platform search UI.
 * Run: node scripts/test-platform-search.mjs
 * Requires: npm start running on port 8000
 */

import { chromium } from "playwright";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:8000";

/** @param {import('playwright').Page} page */
async function countPlatformItems(page) {
  return page.locator("#platform-results .list-item").count();
}

/** @param {import('playwright').Page} page */
async function platformItemTexts(page) {
  return page.locator("#platform-results .list-item").allTextContents();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  try {
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 15000 });

    const initialCount = await countPlatformItems(page);
    if (initialCount !== 12) {
      throw new Error(`Expected 12 platforms on load, got ${initialCount}`);
    }
    console.log("✓ Shows all 12 platforms on load");

    await page.fill("#platform-search", "n64");
    await page.waitForTimeout(100);
    const n64Count = await countPlatformItems(page);
    const n64Texts = await platformItemTexts(page);
    if (n64Count !== 1 || !n64Texts.some((t) => t.includes("Nintendo 64"))) {
      throw new Error(`'n64' search failed: count=${n64Count}, texts=${JSON.stringify(n64Texts)}`);
    }
    console.log("✓ 'n64' finds Nintendo 64");

    await page.fill("#platform-search", "gbc");
    await page.waitForTimeout(100);
    const gbcTexts = await platformItemTexts(page);
    if (!gbcTexts.some((t) => t.includes("Game Boy Color"))) {
      throw new Error(`'gbc' search failed: ${JSON.stringify(gbcTexts)}`);
    }
    console.log("✓ 'gbc' finds Game Boy Color");

    await page.fill("#platform-search", "zzzznotaplatform");
    await page.waitForTimeout(100);
    const emptyHint = await page.locator("#platform-results .empty-hint").textContent();
    if (!emptyHint?.includes("No platforms match")) {
      throw new Error(`Expected empty-state message, got: ${emptyHint}`);
    }
    console.log("✓ Empty search shows no-match message");

    await page.fill("#platform-search", "nes");
    await page.waitForTimeout(100);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(100);

    const searchValue = await page.inputValue("#platform-search");
    if (searchValue !== "") {
      throw new Error(`Platform search should clear after Enter, got: "${searchValue}"`);
    }

    const afterSelectCount = await countPlatformItems(page);
    if (afterSelectCount !== 12) {
      throw new Error(`Expected 12 platforms after select, got ${afterSelectCount}`);
    }
    console.log("✓ Selecting platform clears search and restores full list");

    const nesSelected = await page.locator("#platform-results .list-item--selected").textContent();
    if (!nesSelected?.includes("NES")) {
      throw new Error(`NES should be selected, got: ${nesSelected}`);
    }
    console.log("✓ Selected platform is highlighted");

    if (errors.length > 0) {
      throw new Error(`Page errors:\n${errors.join("\n")}`);
    }

    console.log("\nAll platform search tests passed.");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
