#!/usr/bin/env node
/**
 * Browser smoke test for 3-character game autocomplete.
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
    await page.fill("#game-search", "ec");
    await page.waitForTimeout(100);
    if (!(await dropdown.isHidden())) {
      throw new Error("Game dropdown should stay hidden before 3 characters");
    }
    console.log("✓ Dropdown hidden until 3 characters");

    await page.fill("#game-search", "ecc");
    await page.waitForTimeout(500);
    if (await dropdown.isHidden()) {
      throw new Error("Game dropdown should appear at 3 characters");
    }

    const results = await page.locator("#game-results .list-item").allTextContents();
    if (!results.includes("Ecco the Dolphin")) {
      throw new Error(`Expected Ecco the Dolphin in results, got: ${JSON.stringify(results)}`);
    }
    console.log("✓ 'ecc' shows matching games with artwork");

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

    await page.getByRole("option", { name: "Ecco the Dolphin", exact: true }).click();
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

    await page.getByRole("button", { name: "NES", exact: true }).click();
    await page.waitForTimeout(150);
    await page.fill("#game-search", "mar");
    await page.waitForTimeout(500);

    const marioOption = page.getByRole("option", { name: "Super Mario Bros.", exact: true });
    if (!(await marioOption.count())) {
      throw new Error("Expected Super Mario Bros. after runtime artwork probe on NES");
    }
    await marioOption.click();
    await page.waitForTimeout(500);

    if (!(await addBtn.isVisible())) {
      throw new Error("Add to collection should stay visible when switching browse games");
    }
    let metaAfterSwitch = await page.locator("#preview-meta").textContent();
    if (!metaAfterSwitch?.includes("Super Mario Bros.")) {
      throw new Error(`Preview meta should reflect Super Mario Bros., got: ${metaAfterSwitch}`);
    }
    console.log("✓ Runtime probing finds artwork-backed games without games.js metadata");

    await addBtn.waitFor({ state: "visible", timeout: 5000 });

    await page.getByRole("button", { name: "SNES", exact: true }).click();
    await page.waitForTimeout(200);

    const searchAfterPlatformChange = await page.locator("#game-search").inputValue();
    if (searchAfterPlatformChange !== "") {
      throw new Error(`Game search should clear on platform change, got: "${searchAfterPlatformChange}"`);
    }
    if (!(await dropdown.isHidden())) {
      throw new Error("Game dropdown should be hidden after platform change");
    }
    if (!(await addBtn.isVisible())) {
      throw new Error("Add to collection should stay visible after platform change");
    }
    if (!(await addBtn.isDisabled())) {
      throw new Error("Add to collection should be disabled after platform change clears browse state");
    }
    console.log("✓ Platform change clears game search and browse preview");

    await page.getByRole("button", { name: "Sega CD", exact: true }).click();
    await page.waitForTimeout(150);
    await page.fill("#game-search", "ecco");
    await page.waitForTimeout(500);
    await page.getByRole("option", { name: "Ecco the Dolphin", exact: true }).click();
    await page.waitForTimeout(300);

    await addBtn.click();
    await page.waitForTimeout(300);

    const collectionCards = await page.locator(".collection-card").count();
    if (collectionCards < 1) {
      throw new Error("Add to collection should create a collection card");
    }
    console.log("✓ Add to collection creates a card");

    const hint = await page.locator("#game-search-hint").textContent();
    if (!hint?.includes("found") && !hint?.includes("with artwork") && !hint?.includes("Type")) {
      throw new Error(`Expected search hint, got: ${hint}`);
    }
    console.log("✓ Search hint updates after filtering");

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
