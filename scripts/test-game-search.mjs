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

    await page.locator("summary", { hasText: "Global Settings" }).click();
    const imageFilterToggle = page.locator("#search-only-games-with-images");
    await imageFilterToggle.check();
    await page.getByRole("button", { name: "Sega CD", exact: true }).click();
    await page.waitForTimeout(150);
    await page.fill("#game-search", "ecco");
    await page.waitForTimeout(150);

    let eccoResults = await page.locator("#game-results .list-item").allTextContents();
    if (!eccoResults.includes("Ecco the Dolphin") || !eccoResults.includes("Ecco: The Tides of Time")) {
      throw new Error(`Expected both Ecco entries before filtering, got: ${JSON.stringify(eccoResults)}`);
    }

    await imageFilterToggle.uncheck();
    await page.waitForTimeout(150);
    eccoResults = await page.locator("#game-results .list-item").allTextContents();
    if (!eccoResults.includes("Ecco the Dolphin")) {
      throw new Error(`Expected image-backed game to remain, got: ${JSON.stringify(eccoResults)}`);
    }
    if (eccoResults.includes("Ecco: The Tides of Time")) {
      throw new Error(`Expected no-image game to be filtered out, got: ${JSON.stringify(eccoResults)}`);
    }
    console.log("✓ Global setting filters out games with no images");

    await page.getByRole("button", { name: "Atari 2600", exact: true }).click();
    await page.waitForTimeout(150);
    await page.fill("#game-search", "china");
    await page.waitForTimeout(150);
    const chinaResults = await page.locator("#game-results .list-item").allTextContents();
    if (!chinaResults.includes("China Syndrome")) {
      throw new Error(
        `Expected image-availability indexed game in filtered results, got: ${JSON.stringify(chinaResults)}`,
      );
    }
    console.log("✓ Image-only filter respects disk availability index");

    await imageFilterToggle.check();
    await page.getByRole("button", { name: "NES", exact: true }).click();
    await page.waitForTimeout(150);
    await page.fill("#game-search", "mar");
    await page.waitForTimeout(100);

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

    await page.fill("#game-search", "met");
    await page.waitForTimeout(150);
    const metroidOption = page.getByRole("option", { name: /Metroid/i }).first();
    if (!(await metroidOption.count())) {
      throw new Error("Expected Metroid in search results for browse switch test");
    }
    await metroidOption.click();
    await page.waitForTimeout(500);

    if (!(await addBtn.isVisible())) {
      throw new Error("Add to collection should stay visible when switching browse games");
    }
    let tabsAfterSwitch = await page.locator(".preview-type-tab").count();
    if (tabsAfterSwitch < 1) {
      throw new Error("Artwork type tabs should remain visible when switching browse games");
    }
    let metaAfterSwitch = await page.locator("#preview-meta").textContent();
    if (!metaAfterSwitch?.toLowerCase().includes("metroid")) {
      throw new Error(`Preview meta should reflect Metroid, got: ${metaAfterSwitch}`);
    }

    await page.fill("#game-search", "mar");
    await page.waitForTimeout(150);
    await page.getByRole("option", { name: "Super Mario Bros.", exact: true }).click();
    await page.waitForTimeout(500);

    tabsAfterSwitch = await page.locator(".preview-type-tab").count();
    if (tabsAfterSwitch < 1) {
      throw new Error("Artwork type tabs should remain visible after switching back");
    }
    metaAfterSwitch = await page.locator("#preview-meta").textContent();
    if (!metaAfterSwitch?.includes("Super Mario Bros.")) {
      throw new Error(`Preview meta should reflect latest game, got: ${metaAfterSwitch}`);
    }
    console.log("✓ Switching browse games keeps artwork tabs and preview controls");

    const artworkControls = page.locator("#preview-artwork-controls");
    if (await artworkControls.isHidden()) {
      throw new Error("Artwork display controls should be visible while browsing");
    }
    console.log("✓ Artwork display controls are visible while browsing");

    const calibrationInput = page.locator("#preview-calibration-input");
    if ((await calibrationInput.getAttribute("min")) !== "50") {
      throw new Error("Screen calibration min should be 50");
    }
    if ((await calibrationInput.getAttribute("max")) !== "300") {
      throw new Error("Screen calibration max should be 300");
    }
    await calibrationInput.fill("50");
    await page.waitForTimeout(100);
    const calibrationValueMin = await page.locator("#preview-calibration-value").textContent();
    if (calibrationValueMin?.trim() !== "50%") {
      throw new Error(`Screen calibration should show 50%, got: ${calibrationValueMin}`);
    }
    await calibrationInput.fill("300");
    await page.waitForTimeout(100);
    const calibrationValueMax = await page.locator("#preview-calibration-value").textContent();
    if (calibrationValueMax?.trim() !== "300%") {
      throw new Error(`Screen calibration should show 300%, got: ${calibrationValueMax}`);
    }
    console.log("✓ Screen calibration supports 50% to 300%");

    await page.route("**/*.png", async (route) => route.abort());
    await page.fill("#game-search", "met");
    await page.waitForTimeout(150);
    await page.getByRole("option", { name: /Metroid/i }).first().click();
    await page.waitForTimeout(500);

    const previewSrc = await page.locator("#preview-image").getAttribute("src");
    if (!previewSrc?.startsWith("data:image/")) {
      throw new Error("Missing artwork should still render a placeholder preview image");
    }
    if (await artworkControls.isHidden()) {
      throw new Error("Artwork display controls should remain visible for placeholder previews");
    }
    if (!(await addBtn.isVisible())) {
      throw new Error("Add to collection should remain available for placeholder previews");
    }
    console.log("✓ Games without artwork show placeholder preview and controls");

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
