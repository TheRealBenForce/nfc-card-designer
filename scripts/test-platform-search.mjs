#!/usr/bin/env node
/**
 * Browser smoke test for platform browse UI.
 * Run: node scripts/test-platform-search.mjs
 * Requires: npm start running on port 8000
 */

import { chromium } from "playwright";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:8000";

/** @param {import('playwright').Page} page */
async function countPlatformItems(page) {
  return page.locator("#platform-results .list-item").count();
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

    await page.locator("summary", { hasText: "Platform Settings" }).click();

    const initialCount = await countPlatformItems(page);
    if (initialCount !== 12) {
      throw new Error(`Expected 12 platforms in browse list, got ${initialCount}`);
    }
    console.log("✓ Shows all 12 platforms to browse");

    await page.getByRole("button", { name: "NES", exact: true }).click();
    const nesSelected = await page.locator("#platform-results .list-item--selected").textContent();
    if (!nesSelected?.includes("NES") || nesSelected.includes("SNES")) {
      throw new Error(`NES should be selected after click, got: ${nesSelected}`);
    }
    console.log("✓ Clicking a platform selects it");

    await page.getByRole("button", { name: "Nintendo 64" }).click();
    const n64Selected = await page.locator("#platform-results .list-item--selected").textContent();
    if (!n64Selected?.includes("Nintendo 64")) {
      throw new Error(`N64 should be selected after click, got: ${n64Selected}`);
    }
    console.log("✓ Selected platform is highlighted");

    const deleteBtn = page.locator("#delete-selected");
    const deleteClass = await deleteBtn.getAttribute("class");
    if (!deleteClass?.includes("btn--danger")) {
      throw new Error(`Delete Selected should use danger style, got: ${deleteClass}`);
    }
    console.log("✓ Delete Selected uses danger button style");

    if (errors.length > 0) {
      throw new Error(`Page errors:\n${errors.join("\n")}`);
    }

    console.log("\nAll platform browse tests passed.");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
