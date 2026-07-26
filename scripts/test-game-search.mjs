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

    const editGatedRegion = page.locator("#edit-gated-region");
    if ((await editGatedRegion.getAttribute("aria-disabled")) !== "true") {
      throw new Error("Edit panel should be disabled on initial load");
    }
    if (!(await page.locator("#preview-skeleton").isVisible())) {
      throw new Error("Edit preview skeleton should be visible on initial load");
    }
    if (!(await page.locator("#edit-panel").evaluate((el) => el.classList.contains("panel--edit-off")))) {
      throw new Error("Edit panel should have panel--edit-off on initial load");
    }
    console.log("✓ Edit column is OFF with preview skeleton on load");

    const dropdown = page.locator("#game-results");
    const searchInput = page.locator("#game-search");
    const placeholder = await searchInput.getAttribute("placeholder");
    if (!placeholder?.includes("Search from") || !placeholder?.includes("games")) {
      throw new Error(`Expected catalog placeholder, got: ${placeholder}`);
    }
    console.log("✓ Navbar search placeholder shows catalog size");

    await searchInput.focus();
    await page.waitForTimeout(500);

    const browseResults = await page.locator("#game-results .list-item").count();
    if (browseResults === 0) {
      throw new Error("Expected browse suggestions on focus");
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
    const results = await page.locator("#game-results .list-item__name").allTextContents();
    if (!results.some((name) => name.includes("Ecco the Dolphin"))) {
      throw new Error(`Expected Ecco the Dolphin in results, got: ${JSON.stringify(results)}`);
    }
    const platformPills = await page.locator("#game-results .game-result-pill").count();
    if (platformPills < 1) {
      throw new Error("Expected platform pills on search results");
    }
    console.log("✓ Short query filters catalog with platform pills");

    await page.fill("#game-search", "ecco");
    await page.waitForTimeout(500);
    const eccoResults = await page.locator("#game-results .list-item__name").allTextContents();
    if (!eccoResults.some((name) => name.includes("Ecco the Dolphin"))) {
      throw new Error(`Expected Ecco the Dolphin in results, got: ${JSON.stringify(eccoResults)}`);
    }
    console.log("✓ Search finds games across the full catalog");

    await page.fill("#game-search", "zzznomatch");
    await page.waitForTimeout(500);
    const fallbackResults = await page.locator("#game-results .list-item").count();
    if (fallbackResults === 0) {
      throw new Error("Expected browse fallback when search has no matches");
    }
    console.log("✓ No-match search shows browse fallback");

    await page.fill("#game-search", "ecco");
    await page.waitForTimeout(300);
    await page.getByRole("option", { name: /Ecco the Dolphin.*Sega CD/i }).click();
    await page.waitForTimeout(500);

    const addBtn = page.locator("#add-browsed-game");
    if (!(await addBtn.isVisible())) {
      throw new Error("Browse preview should show Add to collection button");
    }
    if ((await editGatedRegion.getAttribute("aria-disabled")) !== "false") {
      throw new Error("Edit panel should be enabled after selecting a game");
    }

    const tabs = await page.locator(".preview-type-tab").count();
    if (tabs < 1) {
      throw new Error("Browse preview should show artwork type tabs");
    }
    console.log("✓ Selecting a game opens browse preview with artwork tabs");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "networkidle", timeout: 15000 });
    await page.fill("#game-search", "ecco");
    await page.waitForTimeout(300);
    await page.getByRole("option", { name: /Ecco the Dolphin.*Sega CD/i }).click();
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

    await searchInput.focus();
    await page.waitForTimeout(300);
    const browseAll = await page.locator("#game-results .list-item").count();
    if (browseAll === 0) {
      throw new Error("Expected browse suggestions on focus after reload");
    }
    if (browseAll > 10) {
      throw new Error(`Expected at most 10 browse rows, got ${browseAll}`);
    }
    console.log("✓ Browse dropdown lists indexed games without waiting for background probing");

    await page.fill("#game-search", "doo");
    await page.waitForTimeout(300);
    const doomOption = page.getByRole("option", { name: /Doom.*Sega 32X/i });
    await doomOption.waitFor({ state: "visible", timeout: 5000 });
    await doomOption.click();
    await page.waitForTimeout(500);
    console.log("✓ Search finds games indexed in game-catalog.json");

    await addBtn.waitFor({ state: "visible", timeout: 5000 });

    await page.fill("#game-search", "ecc");
    await page.waitForTimeout(100);
    const filtered = await page.locator("#game-results .list-item__name").allTextContents();
    if (filtered.length === 0 || !filtered.every((name) => name.toLowerCase().includes("ecc"))) {
      throw new Error(`Filtered results should all contain 'ecc': ${JSON.stringify(filtered)}`);
    }
    console.log("✓ Results narrow as query grows");

    const hint = await page.locator(".game-search-dropdown__hint").textContent();
    if (!hint?.includes("found")) {
      throw new Error(`Expected search hint in dropdown, got: ${hint}`);
    }
    console.log("✓ Search hint updates after filtering");

    await page.fill("#game-search", "ecco");
    await page.waitForTimeout(300);
    await page.getByRole("option", { name: /Ecco the Dolphin.*Sega CD/i }).click();
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

    await page.locator("#print-panel").getByRole("button", { name: "Clear", exact: true }).click();
    await page.waitForSelector("#confirm-modal[open]");
    await page.locator("#confirm-modal-confirm").click();
    await page.waitForFunction(() => {
      const region = document.getElementById("edit-gated-region");
      return region?.getAttribute("aria-disabled") === "true";
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
