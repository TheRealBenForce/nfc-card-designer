#!/usr/bin/env node

import { isRetailRelease } from "../src/assets/js/retailFilter.js";

const retail = [
  "Super Mario Bros.",
  "The Legend of Zelda",
  "Final Fantasy VII",
  "Andro Dunos (NGM-049)(NGH-049)",
  "GS (Ghost Sweeper) Mikami (Japan)",
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
  "Lost Vikings, The (USA) (Beta 1) [b]",
  "Burning Fight (prototype, older) [Prototype]",
  "Crouching Tiger Hidden Dragon 2003 Super Plus [Bootleg]",
  "Digger Man [Homebrew]",
  "Live A Live (Japan) [T-En by Aeon Genesis v2.00 Deluxe]",
  "Burning Heroes [English]",
  "Legend of Zelda, The - Majora's Mask (USA) - SymbolicLink",
  "Named_Boxarts/Clock Tower",
  "Matrimelee - Shin Gouketsuji Ichizoku Toukon (bootleg) [Bootleg]",
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
console.log("✓ Retail filter rejects hacks, homebrew, demos, prototypes, subsets, beta, proto, bootlegs, translations, SymbolicLink, and path junk");
