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
    await page.getByRole("button", { name: "NES", exact: true }).click();
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

    await page.getByRole("option", { name: "Super Mario Bros.", exact: true }).click();
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

    await addBtn.waitFor({ state: "visible", timeout: 5000 });

    await page.getByRole("button", { name: "SNES", exact: true }).click();
    await addBtn.waitFor({ state: "hidden", timeout: 5000 });

    const searchAfterPlatformChange = await page.locator("#game-search").inputValue();
    if (searchAfterPlatformChange !== "") {
      throw new Error(`Game search should clear on platform change, got: "${searchAfterPlatformChange}"`);
    }
    if (!(await dropdown.isHidden())) {
      throw new Error("Game dropdown should be hidden after platform change");
    }
    if (await addBtn.isVisible()) {
      throw new Error("Browse preview should clear after platform change");
    }
    console.log("✓ Platform change clears game search and browse preview");

    await page.getByRole("button", { name: "NES", exact: true }).click();
    await page.waitForTimeout(150);
    await page.fill("#game-search", "mar");
    await page.waitForTimeout(100);
    await page.getByRole("option", { name: "Super Mario Bros.", exact: true }).click();
    await page.waitForTimeout(300);

    await addBtn.click();
    await page.waitForTimeout(300);

    const collectionCards = await page.locator(".collection-card").count();
    if (collectionCards < 1) {
      throw new Error("Add to collection should create a collection card");
    }
    console.log("✓ Add to collection creates a card");

    await page.fill("#game-search", "mario");
    await page.waitForTimeout(100);
    const filtered = await page.locator("#game-results .list-item").allTextContents();
    if (filtered.length === 0 || !filtered.every((name) => name.toLowerCase().includes("mario"))) {
      throw new Error(`Filtered results should all contain 'mario': ${JSON.stringify(filtered)}`);
    }
    console.log("✓ Results narrow as query grows");

    const hint = await page.locator("#game-search-hint").textContent();
    if (!hint?.includes("found") && !hint?.includes("with artwork")) {
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
