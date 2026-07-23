#!/usr/bin/env node

import { platforms } from "../src/assets/js/data/platforms.js";
import {
  DEFAULT_PLATFORM_ICON_THEME,
  PLATFORM_ICON_THEMES,
  getXmbPlatformIconUrl,
  normalizePlatformIconTheme,
} from "../src/assets/js/platformIconTheme.js";
import {
  getBundledPlatformIconPath,
  getPlatformIconPath,
} from "../src/assets/js/platformIcons.js";

if (normalizePlatformIconTheme(undefined) !== DEFAULT_PLATFORM_ICON_THEME) {
  throw new Error("Missing platform icon theme should default to flatui");
}

if (normalizePlatformIconTheme("not-a-theme") !== DEFAULT_PLATFORM_ICON_THEME) {
  throw new Error("Unknown platform icon theme should fall back to flatui");
}

if (PLATFORM_ICON_THEMES[0]?.id !== "flatui") {
  throw new Error("FlatUI should be the first listed platform icon theme");
}

const nesUrl = getXmbPlatformIconUrl("nes", "flatui");
if (!nesUrl.includes("/xmb/flatui/png/")) {
  throw new Error(`Expected flatui XMB URL, got: ${nesUrl}`);
}
if (!nesUrl.endsWith("Nintendo%20-%20Nintendo%20Entertainment%20System.png")) {
  throw new Error(`Unexpected NES icon URL: ${nesUrl}`);
}

if (getPlatformIconPath("nes") !== nesUrl) {
  throw new Error("getPlatformIconPath should use the default flatui theme");
}

for (const platform of platforms) {
  const bundled = getBundledPlatformIconPath(platform.id);
  if (!bundled.startsWith("assets/images/platforms/")) {
    throw new Error(`Unexpected bundled icon path for ${platform.id}: ${bundled}`);
  }
}

console.log("✓ Platform icon theme defaults to flatui");
console.log("✓ XMB icon URLs encode libretro playlist names");
console.log("✓ Bundled fallback icon paths remain available");
