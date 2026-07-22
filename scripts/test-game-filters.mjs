#!/usr/bin/env node

import { isRetailRelease } from "../src/assets/js/retailFilter.js";

const retail = [
  "Super Mario Bros.",
  "The Legend of Zelda",
  "Final Fantasy VII",
];

const nonRetail = [
  "~Hack~ Super Mario World",
  "~Homebrew~ Bob's Game",
  "~Demo~ Sonic Jam",
  "~Prototype~ Metroid",
  "~Test Kit~ Something",
  "~Unlicensed~ Bootleg Game",
  "~Z~ Old Entry",
  "Base Game [Subset - Bonus]",
  "Dr. Mario (World) (Beta)",
  "Metroid (Japan) (Proto)",
  "Alpha Mission II _ ASO II - Last Guardian (prototype)",
];

for (const title of retail) {
  if (!isRetailRelease(title)) {
    throw new Error(`Expected retail: ${title}`);
  }
}

for (const title of nonRetail) {
  if (isRetailRelease(title)) {
    throw new Error(`Expected non-retail: ${title}`);
  }
}

console.log("✓ Retail filter accepts retail titles");
console.log("✓ Retail filter rejects hacks, homebrew, demos, prototypes, subsets, beta, and proto");
