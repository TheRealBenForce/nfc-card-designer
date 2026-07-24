#!/usr/bin/env node

import {
  browseSessionIsCustomized,
  browseSessionMatchesPlatformDefaults,
  CUSTOMIZATION_CUSTOMIZED,
  CUSTOMIZATION_DEFAULT,
  inferCardCustomization,
  normalizeCardCustomization,
} from "../src/assets/js/cardCustomization.js";
import { defaultPlatformDefaults, loadPlatformDefaultsSeed } from "../src/assets/js/platformDefaults.js";
import { normalizeCollectionCard, PROJECT_VERSION } from "../src/assets/js/storage.js";

await loadPlatformDefaultsSeed();

const platformDefaults = defaultPlatformDefaults();

const defaultBrowse = {
  game: { platformId: "nes", name: "Test", libretroName: "Test" },
  imageType: "boxArt",
  colorOverride: null,
  artworkDisplayOverride: null,
  imageRotation: 0,
  headerSettingsOverride: null,
};

if (!browseSessionMatchesPlatformDefaults(defaultBrowse, platformDefaults)) {
  throw new Error("Fresh browse session should match platform defaults");
}
if (browseSessionIsCustomized(defaultBrowse, platformDefaults)) {
  throw new Error("Fresh browse session should not be customized");
}

const colorTouched = { ...defaultBrowse, colorOverride: "#ff0000" };
if (browseSessionMatchesPlatformDefaults(colorTouched, platformDefaults)) {
  throw new Error("Accent color change should diverge from platform defaults");
}

const defaultCard = normalizeCardCustomization(
  {
    id: "c1",
    platformId: "nes",
    libretroName: "Test",
    imageType: "boxArt",
  },
  platformDefaults,
);
if (defaultCard.customization !== CUSTOMIZATION_DEFAULT) {
  throw new Error("Card without overrides should be default");
}
if (defaultCard.artworkDisplay || defaultCard.headerSettings) {
  throw new Error("Default card should not store layout overrides");
}

const customizedCard = normalizeCardCustomization(
  {
    id: "c2",
    platformId: "nes",
    libretroName: "Test 2",
    imageType: "boxArt",
    imageRotation: 90,
    customization: CUSTOMIZATION_CUSTOMIZED,
  },
  platformDefaults,
);
if (customizedCard.customization !== CUSTOMIZATION_CUSTOMIZED) {
  throw new Error("Explicit customized card should stay customized");
}

const inferred = inferCardCustomization(
  {
    id: "c3",
    platformId: "nes",
    libretroName: "Test 3",
    imageType: "boxArt",
    headerSettings: { showHeader: false, showPlatformColor: true, headerHeightPercent: 20 },
  },
  platformDefaults,
);
if (inferred !== CUSTOMIZATION_CUSTOMIZED) {
  throw new Error("Header divergence should infer customized");
}

const migrated = normalizeCollectionCard(
  {
    id: "legacy",
    platformId: "nes",
    libretroName: "Legacy",
    imageType: "boxArt",
    headerSettings: platformDefaults.nes.headerSettings,
  },
  platformDefaults,
);
if (migrated?.customization !== CUSTOMIZATION_DEFAULT) {
  throw new Error("Legacy card matching platform header should migrate to default");
}

if (PROJECT_VERSION !== 7) {
  throw new Error("Project export version should be 7");
}

console.log("✓ Browse session customization detection works");
console.log("✓ Card customization normalization works");
console.log("✓ Project version is 7");
