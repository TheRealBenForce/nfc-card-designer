#!/usr/bin/env node
/**
 * Browser smoke test for collection platform browser overlay.
 * Requires: local server on TEST_BASE_URL
 */

import { chromium } from "playwright";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:8000";
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function browseEcco(page) {
  await page.getByRole("button", { name: "Sega CD", exact: true }).first().click();
  await page.locator("#game-search").focus();
  await page.fill("#game-search", "ecco");
  await page.waitForTimeout(400);
  await page.getByRole("option", { name: "Ecco the Dolphin", exact: true }).click();
  await page.waitForTimeout(300);
}

async function addEccoCard(page) {
  await browseEcco(page);
  await page.locator("#add-browsed-game").click();
  await page.waitForTimeout(300);
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

  try {
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 15000 });

    await addEccoCard(page);

    const platformRow = page.locator("#print-panel .collection-platform-row").filter({ hasText: "Sega CD" });
    if ((await platformRow.count()) !== 1) {
      throw new Error("Expected one Sega CD platform row in Print panel");
    }
    console.log("✓ Added card shows platform row in Print");

    await platformRow.click();
    const browserDialog = page.locator("#collection-browser[open]");
    await browserDialog.waitFor({ state: "visible", timeout: 5000 });
    if ((await page.locator("#collection-browser .collection-card").count()) !== 1) {
      throw new Error("Expected one card in collection browser carousel");
    }
    console.log("✓ Platform row opens collection browser");

    await page.locator("#collection-browser .collection-card__select-btn").click();
    await page.waitForTimeout(150);
    if (await page.locator("#delete-selected").isDisabled()) {
      throw new Error("Delete Selected should enable after selecting a card in browser");
    }
    const badgeText = await platformRow.locator(".collection-platform-row__count").textContent();
    if (!badgeText?.includes("1 of 1 selected")) {
      throw new Error(`Expected platform badge '1 of 1 selected', got: ${badgeText}`);
    }
    console.log("✓ Selection updates toolbar and platform badge");

    await page.keyboard.press("Escape");
    await browserDialog.waitFor({ state: "hidden", timeout: 5000 });
    console.log("✓ Escape dismisses collection browser");

    if (errors.length > 0) {
      throw new Error(`Page errors:\n${errors.join("\n")}`);
    }

    console.log("\nAll collection browser tests passed.");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
