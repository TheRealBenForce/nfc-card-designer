#!/usr/bin/env node

import { formatPlatformSelectionBadge } from "../src/assets/js/collectionBrowser.js";

if (formatPlatformSelectionBadge(0, 12) !== "12") {
  console.error("FAILED: zero selected should show total only");
  process.exit(1);
}

if (formatPlatformSelectionBadge(4, 12) !== "4 of 12 selected") {
  console.error("FAILED: partial selection badge");
  process.exit(1);
}

if (formatPlatformSelectionBadge(12, 12) !== "12 of 12 selected") {
  console.error("FAILED: full selection badge");
  process.exit(1);
}

console.log("✓ Platform selection badge formatting");
console.log("\nAll collection browser badge tests passed.");
