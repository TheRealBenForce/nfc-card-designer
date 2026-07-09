#!/usr/bin/env node
/**
 * Browser smoke test for game autocomplete and artwork browse.
 * Requires: local server on TEST_BASE_URL
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
    const url = route.request().url();
    if (url.includes("/16020/")) {
      await route.abort();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: PNG_1X1,
    });
  });

  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));

  try {
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 15000 });

    await page.locator("summary", { hasText: "Platform Settings" }).click();
    await page.getByRole("button", { name: "Sega CD", exact: true }).click();
    await page.waitForTimeout(150);

    const dropdown = page.locator("#game-results");
    const searchInput = page.locator("#game-search");
    await searchInput.focus();
    await page.waitForTimeout(500);

    const browseResults = await page.locator("#game-results .list-item").allTextContents();
    if (browseResults.length === 0) {
      throw new Error(`Expected browse suggestions on focus, got: ${JSON.stringify(browseResults)}`);
    }
    console.log("✓ Focus shows alphabetical browse suggestions");

    await page.fill("#game-search", "ec");
    await page.waitForTimeout(500);
    if (await dropdown.isHidden()) {
      throw new Error("Game dropdown should stay visible while typing a short query");
    }
    console.log("✓ Dropdown stays open while typing");

    await page.fill("#game-search", "ecc");
    await page.waitForTimeout(500);
    const results = await page.locator("#game-results .list-item").allTextContents();
    if (!results.includes("Ecco the Dolphin")) {
      throw new Error(`Expected Ecco the Dolphin in results, got: ${JSON.stringify(results)}`);
    }
    console.log("✓ Short query filters browse suggestions");

    await page.fill("#game-search", "ecco");
    await page.waitForTimeout(500);
    const eccoResults = await page.locator("#game-results .list-item").allTextContents();
    if (!eccoResults.includes("Ecco the Dolphin")) {
      throw new Error(`Expected artwork-backed game in results, got: ${JSON.stringify(eccoResults)}`);
    }
    if (eccoResults.includes("Ecco: The Tides of Time")) {
      throw new Error(`Expected game without artwork to be excluded, got: ${JSON.stringify(eccoResults)}`);
    }
    console.log("✓ Search excludes games without artwork");

    await page.fill("#game-search", "");
    await page.waitForTimeout(500);
    const artworkHint = await page.locator("#game-search-hint").textContent();
    if (!artworkHint?.includes("with artwork")) {
      throw new Error(`Expected artwork count hint, got: ${artworkHint}`);
    }
    console.log("✓ Search hint shows artwork totals");

    await page.fill("#game-search", "zzznomatch");
    await page.waitForTimeout(500);
    const fallbackResults = await page.locator("#game-results .list-item").allTextContents();
    if (fallbackResults.length === 0) {
      throw new Error("Expected browse fallback when search has no matches");
    }
    console.log("✓ No-match search shows browse fallback");

    await page.fill("#game-search", "ecco");
    await page.waitForTimeout(300);

    const addBtn = page.locator("#add-browsed-game");
    if (!(await addBtn.isVisible())) {
      throw new Error("Browse preview should show Add to collection button");
    }

    const tabs = await page.locator(".preview-type-tab").count();
    if (tabs < 1) {
      throw new Error("Browse preview should show artwork type tabs");
    }
    console.log("✓ Selecting a game opens browse preview with artwork tabs");

    await page.getByRole("button", { name: "Sega 32X", exact: true }).click();
    await page.waitForTimeout(150);
    await searchInput.focus();
    await page.waitForTimeout(300);
    const browse32x = await page.locator("#game-results .list-item").allTextContents();
    if (browse32x.length === 0) {
      throw new Error(`Expected Sega 32X browse suggestions on focus, got: ${JSON.stringify(browse32x)}`);
    }
    if (browse32x.length > 10) {
      throw new Error(`Expected at most 10 browse rows, got ${browse32x.length}`);
    }
    console.log("✓ Browse dropdown lists indexed games without waiting for background probing");

    await page.fill("#game-search", "doo");
    await page.waitForTimeout(300);
    const doomOption = page.getByRole("option", { name: "Doom", exact: true });
    await doomOption.waitFor({ state: "visible", timeout: 5000 });
    await doomOption.click();
    await page.waitForTimeout(500);
    console.log("✓ Search finds games indexed in games.js");

    await addBtn.waitFor({ state: "visible", timeout: 5000 });

    await page.getByRole("button", { name: "Sega CD", exact: true }).click();
    await page.waitForTimeout(200);

    const searchAfterPlatformChange = await page.locator("#game-search").inputValue();
    if (searchAfterPlatformChange !== "") {
      throw new Error(`Game search should clear on platform change, got: "${searchAfterPlatformChange}"`);
    }
    if (!(await dropdown.isHidden())) {
      throw new Error("Game dropdown should be hidden after platform change");
    }
    console.log("✓ Platform change clears game search and browse preview");

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
