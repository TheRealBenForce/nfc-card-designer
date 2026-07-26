#!/usr/bin/env node
/**
 * Browser smoke test for platform-related UI after navbar search experiment.
 * Run: node scripts/test-platform-search.mjs
 * Requires: npm start running on port 8000
 */

import { chromium } from "playwright";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:8000";
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

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

    const searchInput = page.locator("#game-search");
    if ((await searchInput.count()) !== 1) {
      throw new Error("Expected navbar game search input");
    }
    const placeholder = await searchInput.getAttribute("placeholder");
    if (!placeholder?.includes("Search from") || !placeholder?.includes("games")) {
      throw new Error(`Expected catalog count placeholder, got: ${placeholder}`);
    }
    console.log("✓ Navbar search shows catalog-wide placeholder");

    if (await page.locator("#platform-results").count() !== 0) {
      throw new Error("Platform browse list should be removed from the layout");
    }
    console.log("✓ Left platform selector panel is removed");

    const globalSettings = page.locator("#print-panel .collapsible__summary", { hasText: "Global Settings" });
    if ((await globalSettings.count()) !== 1) {
      throw new Error("Global settings should live in the print panel");
    }
    console.log("✓ Global settings moved to print panel");

    const resetCardBtn = page.locator("#preview-artwork-reset");
    if (await resetCardBtn.count() !== 1) {
      throw new Error("Reset card button should exist in Edit controls");
    }
    const saveDefaultsBtn = page.locator("#save-platform-defaults");
    if (await saveDefaultsBtn.count() !== 1) {
      throw new Error("Save to platform defaults button should exist in Edit controls");
    }
    console.log("✓ Platform defaults actions are available in Edit");

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
