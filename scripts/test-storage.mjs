#!/usr/bin/env node

import { normalizeCollectionCard } from "../src/assets/js/storage.js";

const legacyCard = normalizeCollectionCard({
  id: "1",
  platformId: "neo-geo",
  gameName: "Andro Dunos (NGM-049)(NGH-049)",
  libretroName: "Andro Dunos (NGM-049)(NGH-049)",
  imageType: "boxArt",
});

if (!legacyCard) {
  throw new Error("Expected legacy card to normalize");
}
if (legacyCard.libretroName !== "Andro Dunos (NGM-049)(NGH-049)") {
  throw new Error("libretroName must stay canonical for artwork lookup");
}
if (legacyCard.gameName !== "Andro Dunos") {
  throw new Error(`Expected friendly display name, got: ${legacyCard.gameName}`);
}

const alternateTitleCard = normalizeCollectionCard({
  id: "2",
  platformId: "neo-geo",
  gameName: "Aero Fighters 2 _ Sonic Wings 2",
  libretroName: "Aero Fighters 2 _ Sonic Wings 2",
  imageType: "boxArt",
});
if (alternateTitleCard?.gameName !== "Aero Fighters 2 - Sonic Wings 2") {
  throw new Error("Expected underscore alternate titles to display as dashes");
}
if (alternateTitleCard?.libretroName !== "Aero Fighters 2 _ Sonic Wings 2") {
  throw new Error("libretroName must preserve GitHub filename stem");
}

const missingDisplayName = normalizeCollectionCard({
  id: "3",
  platformId: "sega-32x",
  libretroName: "Doom (Europe)",
  imageType: "boxArt",
});
if (missingDisplayName?.gameName !== "Doom") {
  throw new Error("gameName should be derived when missing from import payload");
}

console.log("✓ Collection cards keep canonical libretroName for artwork lookup");
console.log("✓ Collection cards derive friendly gameName from libretroName on load");
