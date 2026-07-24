#!/usr/bin/env node
/**
 * Browser smoke test for Print panel delete actions.
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
    await page.locator("#print-panel .collection-platform-row").filter({ hasText: "Sega CD" }).click();
    await page.waitForSelector("#collection-browser[open]");
    if ((await page.locator("#collection-browser .collection-card").count()) !== 1) {
      throw new Error("Expected one collection card in browser after add");
    }
    console.log("✓ Added card to collection");

    await page.locator("#collection-browser .collection-card__select-btn").first().click();
    await page.waitForTimeout(100);
    if (await page.locator("#delete-selected").isDisabled()) {
      throw new Error("Delete Selected should enable after selecting a card");
    }

    await page.keyboard.press("Escape");
    await page.waitForSelector("#collection-browser[open]", { state: "hidden" });

    await page.locator("#game-search").focus();
    await page.fill("#game-search", "e");
    await page.waitForTimeout(200);

    await page.locator("#delete-selected").click();
    await page.waitForSelector("#confirm-modal[open]");
    await page.locator("#confirm-modal-confirm").click();
    await page.waitForTimeout(300);
    if ((await page.locator("#print-panel .collection-platform-row").count()) !== 0) {
      throw new Error("Print platform list should be empty after deleting the only card");
    }
    console.log("✓ Delete Selected works with game search focused");

    if (errors.length > 0) {
      throw new Error(`Page errors:\n${errors.join("\n")}`);
    }

    console.log("\nAll collection delete tests passed.");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
