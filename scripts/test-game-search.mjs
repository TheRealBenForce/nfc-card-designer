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

    const editPanel = page.locator("#edit-panel");
    if ((await editPanel.getAttribute("aria-disabled")) !== "true") {
      throw new Error("Edit panel should be disabled on initial load");
    }
    if (!(await page.locator("#preview-skeleton").isVisible())) {
      throw new Error("Edit preview skeleton should be visible on initial load");
    }
    if (!(await page.locator("#edit-panel").evaluate((el) => el.classList.contains("panel--edit-off")))) {
      throw new Error("Edit panel should have panel--edit-off on initial load");
    }
    console.log("✓ Edit column is OFF with preview skeleton on load");

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
    if (!results.some((name) => name.includes("Ecco the Dolphin"))) {
      throw new Error(`Expected Ecco the Dolphin in results, got: ${JSON.stringify(results)}`);
    }
    console.log("✓ Short query filters browse suggestions");

    await page.fill("#game-search", "ecco");
    await page.waitForTimeout(500);
    const eccoResults = await page.locator("#game-results .list-item").allTextContents();
    if (!eccoResults.some((name) => name.includes("Ecco the Dolphin"))) {
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
    await page.getByRole("option", { name: "Ecco the Dolphin", exact: true }).click();
    await page.waitForTimeout(500);

    const addBtn = page.locator("#add-browsed-game");
    if (!(await addBtn.isVisible())) {
      throw new Error("Browse preview should show Add to collection button");
    }
    if ((await editPanel.getAttribute("aria-disabled")) !== "false") {
      throw new Error("Edit panel should be enabled after selecting a game");
    }

    const tabs = await page.locator(".preview-type-tab").count();
    if (tabs < 1) {
      throw new Error("Browse preview should show artwork type tabs");
    }
    console.log("✓ Selecting a game opens browse preview with artwork tabs");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "networkidle", timeout: 15000 });
    await page.getByRole("button", { name: "Sega CD", exact: true }).click();
    await page.waitForTimeout(150);
    await page.fill("#game-search", "ecco");
    await page.waitForTimeout(300);
    await page.getByRole("option", { name: "Ecco the Dolphin", exact: true }).click();
    await page.waitForTimeout(500);

    const previewCardSize = await page.locator("#preview-card").evaluate((el) => {
      const { width, height } = el.getBoundingClientRect();
      return { width, height };
    });
    if (previewCardSize.width < 10 || previewCardSize.height < 10) {
      throw new Error(
        `Preview card should be visible on narrow viewport, got: ${JSON.stringify(previewCardSize)}`,
      );
    }
    console.log("✓ Narrow viewport shows a sized preview card after game selection");

    const narrowPreview = await page.evaluate(() => {
      const panel = document.querySelector(".preview-calibration-panel");
      const stage = document.querySelector(".preview-stage");
      const card = document.getElementById("preview-card");
      if (!panel || !stage || !card) return null;
      const panelStyle = getComputedStyle(panel);
      const stageRect = stage.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      return {
        panelDisplay: panelStyle.display,
        stageWidth: stageRect.width,
        stageHeight: stageRect.height,
        cardWidth: cardRect.width,
        cardHeight: cardRect.height,
      };
    });
    if (!narrowPreview) {
      throw new Error("Expected preview card and mat on narrow viewport");
    }
    if (narrowPreview.panelDisplay !== "none") {
      throw new Error("Card scale slider should be hidden on narrow viewports");
    }
    const widthFill = narrowPreview.cardWidth / narrowPreview.stageWidth;
    const heightFill = narrowPreview.cardHeight / narrowPreview.stageHeight;
    if (Math.max(widthFill, heightFill) < 0.9) {
      throw new Error(
        `Narrow viewport should zoom the card to fill the mat, got fill=${Math.max(widthFill, heightFill).toFixed(2)}`,
      );
    }
    console.log("✓ Narrow viewport hides card scale slider and zooms card to fill the mat");

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.reload({ waitUntil: "networkidle", timeout: 15000 });

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
    console.log("✓ Search finds games indexed in game-catalog.json");

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

    await page.fill("#game-search", "ecco");
    await page.waitForTimeout(300);
    await page.getByRole("option", { name: "Ecco the Dolphin", exact: true }).click();
    await page.waitForTimeout(300);

    await addBtn.click();
    await page.waitForTimeout(300);

    const platformRows = await page.locator("#print-panel .collection-platform-row").count();
    if (platformRows < 1) {
      throw new Error("Add to collection should create a platform row in Print");
    }
    await page.locator("#print-panel .collection-platform-row").first().click();
    await page.waitForSelector("#collection-browser[open]");
    const collectionCards = await page.locator("#collection-browser .collection-card").count();
    if (collectionCards < 1) {
      throw new Error("Add to collection should create a collection card in the browser");
    }
    console.log("✓ Add to collection creates a card");

    await page.keyboard.press("Escape");
    await page.waitForSelector("#collection-browser[open]", { state: "hidden" });

    await page.fill("#game-search", "ecc");
    await page.waitForTimeout(100);
    const filtered = await page.locator("#game-results .list-item").allTextContents();
    if (filtered.length === 0 || !filtered.every((name) => name.toLowerCase().includes("ecc"))) {
      throw new Error(`Filtered results should all contain 'ecc': ${JSON.stringify(filtered)}`);
    }
    console.log("✓ Results narrow as query grows");

    const hint = await page.locator("#game-search-hint").textContent();
    if (!hint?.includes("found") && !hint?.includes("with artwork")) {
      throw new Error(`Expected search hint, got: ${hint}`);
    }
    console.log("✓ Search hint updates after filtering");

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await page.waitForFunction(() => {
      const panel = document.getElementById("edit-panel");
      return panel?.getAttribute("aria-disabled") === "true";
    });
    if (!(await page.locator("#preview-skeleton").isVisible())) {
      throw new Error("Edit preview skeleton should return after clearing project");
    }
    console.log("✓ Clearing project returns Edit column to OFF");

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
