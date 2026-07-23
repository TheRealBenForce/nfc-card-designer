#!/usr/bin/env node

import { platforms } from "../src/assets/js/data/platforms.js";
import {
  DEFAULT_PLATFORM_ICON_THEME,
  PLATFORM_ICON_THEMES,
  getXmbPlatformIconUrl,
  normalizePlatformIconTheme,
  shouldInvertPlatformIconInLight,
} from "../src/assets/js/platformIconTheme.js";
import {
  getBundledPlatformIconPath,
  getPlatformIconPath,
} from "../src/assets/js/platformIcons.js";

if (normalizePlatformIconTheme(undefined) !== DEFAULT_PLATFORM_ICON_THEME) {
  throw new Error("Missing platform icon theme should default to dot-art");
}

if (normalizePlatformIconTheme("not-a-theme") !== DEFAULT_PLATFORM_ICON_THEME) {
  throw new Error("Unknown platform icon theme should fall back to dot-art");
}

if (PLATFORM_ICON_THEMES[0]?.id !== "dot-art") {
  throw new Error("Dot Art should be the first listed platform icon theme");
}

const nesUrl = getXmbPlatformIconUrl("nes", "dot-art");
if (!nesUrl.includes("/xmb/dot-art/png/")) {
  throw new Error(`Expected dot-art XMB URL, got: ${nesUrl}`);
}
if (!nesUrl.endsWith("Nintendo%20-%20Nintendo%20Entertainment%20System.png")) {
  throw new Error(`Unexpected NES icon URL: ${nesUrl}`);
}

if (getPlatformIconPath("nes") !== nesUrl) {
  throw new Error("getPlatformIconPath should use the default dot-art theme");
}

if (!shouldInvertPlatformIconInLight("monochrome")) {
  throw new Error("Monochrome icons should invert in light mode");
}
if (!shouldInvertPlatformIconInLight("pixel")) {
  throw new Error("Pixel icons should invert in light mode");
}
if (!shouldInvertPlatformIconInLight("automatic")) {
  throw new Error("Automatic icons should invert in light mode");
}
if (shouldInvertPlatformIconInLight("dot-art")) {
  throw new Error("Dot Art icons should not invert in light mode");
}

const gba = platforms.find((platform) => platform.id === "game-boy-advance");
if (!gba) {
  throw new Error("Game Boy Advance platform should be defined");
}
if (gba.libretroPlaylist !== "Nintendo - Game Boy Advance") {
  throw new Error("Game Boy Advance should use the libretro GBA playlist name");
}

for (const platform of platforms) {
  const bundled = getBundledPlatformIconPath(platform.id);
  if (!bundled.startsWith("assets/images/platforms/")) {
    throw new Error(`Unexpected bundled icon path for ${platform.id}: ${bundled}`);
  }
}

if (platforms.length !== 18) {
  throw new Error(`Expected 18 platforms, got ${platforms.length}`);
}

console.log("✓ Platform icon theme defaults to dot-art");
console.log("✓ XMB icon URLs encode libretro playlist names");
console.log("✓ Light-mode inversion applies to monochrome, pixel, and automatic");
console.log("✓ Game Boy Advance is included in the platform catalog");
console.log("✓ Bundled fallback icon paths remain available");
