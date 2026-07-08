#!/usr/bin/env node

import {
  defaultPlatformDefaults,
  normalizePlatformDefaults,
  getEffectiveImageTypePriority,
} from "../assets/js/platformDefaults.js";
import { normalizeArtworkDisplay } from "../assets/js/artworkDisplay.js";
import { platformById } from "../assets/js/data/platforms.js";

const defaults = defaultPlatformDefaults();
if (defaults.nes.color !== platformById.nes.defaultColor) {
  throw new Error("Default platform color should come from platforms.js");
}
if (defaults.nes.imageRotation.boxArt !== 0) {
  throw new Error("Default boxArt rotation should be 0");
}
if (defaults.nes.imageTypePriority.join(",") !== "boxArt,titleScreen,gamePicture") {
  throw new Error("Default platform imageTypePriority should match built-in default order");
}

const effective = getEffectiveImageTypePriority(
  { nes: { imageTypePriority: ["gamePicture", "boxArt", "titleScreen"] } },
  "nes",
);
if (effective[0] !== "gamePicture") {
  throw new Error("Platform priority should be used when set");
}

const fallback = getEffectiveImageTypePriority({}, "nes");
if (fallback.join(",") !== "boxArt,titleScreen,gamePicture") {
  throw new Error("Missing platform priority should fall back to default order");
}

const migrated = normalizePlatformDefaults(undefined, { nes: "#b4000c" });
if (migrated.nes.color !== "#b4000c") {
  throw new Error("Should migrate legacy platformColors");
}
if (migrated.snes.color !== platformById.snes.defaultColor) {
  throw new Error("Unspecified platforms should keep palette default");
}

const merged = normalizePlatformDefaults(
  {
    nes: {
      color: "#111111",
      imageRotation: { boxArt: 90, titleScreen: 0, gamePicture: 270 },
    },
  },
  { snes: "#ff00ff" },
);
if (merged.nes.color !== "#111111") {
  throw new Error("Explicit platformDefaults color should win");
}
if (merged.nes.imageRotation.boxArt !== 90) {
  throw new Error("boxArt rotation should be preserved");
}
if (merged.nes.imageRotation.gamePicture !== 270) {
  throw new Error("gamePicture rotation should be preserved");
}
if (merged.snes.color !== "#ff00ff") {
  throw new Error("Legacy color should apply when platformDefaults missing entry");
}

const invalidRotation = normalizePlatformDefaults({
  nes: { color: "#000000", imageRotation: { boxArt: 45 } },
});
if (invalidRotation.nes.imageRotation.boxArt !== 0) {
  throw new Error("Invalid rotation degrees should fall back to 0");
}

const wrappedRotation = normalizePlatformDefaults({
  nes: { color: "#000000", imageRotation: { boxArt: 450, titleScreen: -90 } },
});
if (wrappedRotation.nes.imageRotation.boxArt !== 90) {
  throw new Error("Rotation >360 should wrap to a valid quarter turn");
}
if (wrappedRotation.nes.imageRotation.titleScreen !== 270) {
  throw new Error("Negative rotation should wrap to equivalent quarter turn");
}

if (defaults.nes.artworkDisplay.zoom !== 0) {
  throw new Error("Default artwork zoom should be 0");
}

const zoomNormalized = normalizeArtworkDisplay({ zoom: 150 });
if (zoomNormalized.zoom !== 100) {
  throw new Error("Artwork zoom should clamp to 100");
}

const zoomInvalid = normalizeArtworkDisplay({ zoom: "bad" });
if (zoomInvalid.zoom !== 0) {
  throw new Error("Invalid artwork zoom should fall back to 0");
}

console.log("✓ Platform defaults normalization works");
console.log("✓ Platform image priority resolution works");
console.log("✓ Legacy platformColors migration works");
