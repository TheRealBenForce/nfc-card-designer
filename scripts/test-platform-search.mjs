#!/usr/bin/env node
/**
 * Browser smoke test for platform browse UI.
 * Run: node scripts/test-platform-search.mjs
 * Requires: npm start running on port 8000
 */

import { chromium } from "playwright";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:8000";
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** @param {import('playwright').Page} page */
async function countPlatformItems(page) {
  return page.locator("#platform-results .platform-row").count();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.route("**/*.png", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: PNG_1X1,
    });
  });

  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  try {
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 15000 });

    const initialCount = await countPlatformItems(page);
    if (initialCount < 1) {
      throw new Error(`Expected at least one platform in browse list, got ${initialCount}`);
    }
    console.log(`✓ Shows ${initialCount} platforms with artwork-backed games`);

    await page.getByRole("button", { name: "Sega CD", exact: true }).click();
    const segaCdSelected = await page.locator("#platform-results .list-item--selected").textContent();
    if (!segaCdSelected?.includes("Sega CD")) {
      throw new Error(`Sega CD should be selected after click, got: ${segaCdSelected}`);
    }
    console.log("✓ Clicking a platform selects it");

    await page.getByRole("button", { name: "Sega 32X", exact: true }).click();
    const sega32xSelected = await page.locator("#platform-results .list-item--selected").textContent();
    if (!sega32xSelected?.includes("Sega 32X")) {
      throw new Error(`Sega 32X should be selected after click, got: ${sega32xSelected}`);
    }
    console.log("✓ Selected platform is highlighted");

    await page.getByRole("button", { name: "Edit Sega CD defaults" }).click();
    await page.waitForSelector("#platform-settings-modal[open]");
    const modalTitle = await page.locator("#platform-settings-title").textContent();
    if (!modalTitle?.includes("Sega CD")) {
      throw new Error(`Platform settings modal should show Sega CD, got: ${modalTitle}`);
    }
    console.log("✓ Pencil icon opens platform settings modal");

    await page.locator("#platform-settings-close").click();
    await page.waitForFunction(() => !document.getElementById("platform-settings-modal")?.open);

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
