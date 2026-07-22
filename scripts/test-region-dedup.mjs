#!/usr/bin/env node

import {
  artworkCount,
  buildArtworkIndexFromBoxartNames,
  compareRegionalVariants,
  dedupeRegionalVariants,
} from "./region-dedup.mjs";

/** @param {Record<string, string[]>} entries */
function makeArtworkIndex(entries) {
  /** @type {Map<string, Set<string>>} */
  const index = new Map();
  for (const [name, folders] of Object.entries(entries)) {
    index.set(name, new Set(folders));
  }
  return index;
}

const linkVariants = [
  "Legend of Zelda, The - Link's Awakening (Canada) (Fr)",
  "Legend of Zelda, The - Link's Awakening (France)",
  "Legend of Zelda, The - Link's Awakening (Germany)",
  "Legend of Zelda, The - Link's Awakening (USA, Europe)",
  "Legend of Zelda, The - Link's Awakening (USA, Europe) (Rev 1)",
  "Legend of Zelda, The - Link's Awakening (USA, Europe) (Rev 2)",
];
const linkIndex = makeArtworkIndex({
  "Legend of Zelda, The - Link's Awakening (USA, Europe)": [
    "Named_Boxarts",
    "Named_Titles",
    "Named_Snaps",
  ],
  "Legend of Zelda, The - Link's Awakening (USA, Europe) (Rev 1)": ["Named_Boxarts", "Named_Titles"],
  "Legend of Zelda, The - Link's Awakening (USA, Europe) (Rev 2)": ["Named_Boxarts"],
  "Legend of Zelda, The - Link's Awakening (Germany)": ["Named_Boxarts", "Named_Titles", "Named_Snaps"],
});
const linkPicked = dedupeRegionalVariants(linkVariants, linkIndex);
if (linkPicked.length !== 1 || linkPicked[0] !== "Legend of Zelda, The - Link's Awakening (USA, Europe)") {
  throw new Error(`Expected USA/Europe base Link's Awakening, got ${JSON.stringify(linkPicked)}`);
}

const revisionIndex = makeArtworkIndex({
  "Super Mario Land 2 - 6 Golden Coins (USA, Europe)": ["Named_Boxarts"],
  "Super Mario Land 2 - 6 Golden Coins (USA, Europe) (Rev 1)": [
    "Named_Boxarts",
    "Named_Titles",
    "Named_Snaps",
  ],
  "Super Mario Land 2 - 6 Golden Coins (USA, Europe) (Rev 2)": ["Named_Boxarts", "Named_Titles"],
});
const revisionPicked = dedupeRegionalVariants(
  [
    "Super Mario Land 2 - 6 Golden Coins (USA, Europe)",
    "Super Mario Land 2 - 6 Golden Coins (USA, Europe) (Rev 1)",
    "Super Mario Land 2 - 6 Golden Coins (USA, Europe) (Rev 2)",
  ],
  revisionIndex,
);
if (revisionPicked[0] !== "Super Mario Land 2 - 6 Golden Coins (USA, Europe) (Rev 1)") {
  throw new Error(`Expected revision with most artwork, got ${revisionPicked[0]}`);
}

const japanOnlyPicked = dedupeRegionalVariants(
  ["Hoshi no Kirby (Japan)", "Hoshi no Kirby (Japan) (Rev 1)"],
  makeArtworkIndex({
    "Hoshi no Kirby (Japan)": ["Named_Boxarts", "Named_Titles", "Named_Snaps"],
    "Hoshi no Kirby (Japan) (Rev 1)": ["Named_Boxarts"],
  }),
);
if (japanOnlyPicked.length !== 1 || japanOnlyPicked[0] !== "Hoshi no Kirby (Japan)") {
  throw new Error(`Expected Japan-only Kirby to remain, got ${JSON.stringify(japanOnlyPicked)}`);
}

const japanVsUsaPicked = dedupeRegionalVariants(
  ["Kirby's Dream Land (USA, Europe)", "Hoshi no Kirby (Japan)"],
  buildArtworkIndexFromBoxartNames(["Kirby's Dream Land (USA, Europe)", "Hoshi no Kirby (Japan)"]),
);
if (japanVsUsaPicked.length !== 2) {
  throw new Error("Different base titles should not merge");
}

const usaBeatsJapan = dedupeRegionalVariants(
  ["Sample Game (Japan)", "Sample Game (USA)"],
  buildArtworkIndexFromBoxartNames(["Sample Game (Japan)", "Sample Game (USA)"]),
);
if (usaBeatsJapan[0] !== "Sample Game (USA)") {
  throw new Error(`Expected USA variant to win, got ${usaBeatsJapan[0]}`);
}

const europeBeatsGermany = dedupeRegionalVariants(
  ["Sample Game (Germany)", "Sample Game (Europe)"],
  buildArtworkIndexFromBoxartNames(["Sample Game (Germany)", "Sample Game (Europe)"]),
);
if (europeBeatsGermany[0] !== "Sample Game (Europe)") {
  throw new Error(`Expected Europe variant to win, got ${europeBeatsGermany[0]}`);
}

if (compareRegionalVariants("Game (USA)", "Game (World)", new Map()) >= 0) {
  throw new Error("USA should compare ahead of World");
}

const tieBreakRevision = compareRegionalVariants(
  "Game (USA, Europe) (Rev 1)",
  "Game (USA, Europe) (Rev 2)",
  makeArtworkIndex({
    "Game (USA, Europe) (Rev 1)": ["Named_Boxarts"],
    "Game (USA, Europe) (Rev 2)": ["Named_Boxarts"],
  }),
);
if (tieBreakRevision >= 0) {
  throw new Error("Lower revision should win when artwork counts match");
}

if (artworkCount("Missing", new Map()) !== 0) {
  throw new Error("Missing artwork should count as 0");
}

const discPicked = dedupeRegionalVariants(
  [
    "Rampo v1.000 (1995)(Sega)(NTSC)(JP)(Disc 2 of 2)[!]",
    "Rampo v1.000 (1995)(Sega)(NTSC)(JP)(Disc 1 of 2)[!]",
  ],
  makeArtworkIndex({
    "Rampo v1.000 (1995)(Sega)(NTSC)(JP)(Disc 1 of 2)[!]": ["Named_Boxarts", "Named_Titles"],
    "Rampo v1.000 (1995)(Sega)(NTSC)(JP)(Disc 2 of 2)[!]": ["Named_Boxarts", "Named_Titles"],
  }),
);
if (discPicked.length !== 1 || !discPicked[0].includes("Disc 1")) {
  throw new Error(`Expected multi-disc collapse to Disc 1, got ${JSON.stringify(discPicked)}`);
}

const mameDashPicked = dedupeRegionalVariants(
  ["1941 - Counter Attack (World)", "1941_ Counter Attack (World)"],
  buildArtworkIndexFromBoxartNames([
    "1941 - Counter Attack (World)",
    "1941_ Counter Attack (World)",
  ]),
);
if (mameDashPicked.length !== 1) {
  throw new Error(`Expected MAME underscore/dash variants to merge, got ${JSON.stringify(mameDashPicked)}`);
}
if (!mameDashPicked[0].includes("1941 - Counter Attack")) {
  throw new Error(`Expected dash variant to win, got ${mameDashPicked[0]}`);
}

console.log("✓ dedupeRegionalVariants keeps one entry per base title");
console.log("✓ USA/Europe preferred over country-specific variants");
console.log("✓ Most artwork wins among same-region revisions");
console.log("✓ Japan-only games are kept when no higher-priority region exists");
console.log("✓ Different base titles are not merged");
console.log("✓ Multi-disc releases collapse to the lowest disc number");
console.log("✓ MAME underscore/dash title variants merge");
