import {
  DEFAULT_PLATFORM_ICON_THEME,
  getXmbPlatformIconUrl,
  normalizePlatformIconTheme,
} from "./platformIconTheme.js";

const PLATFORM_IDS = [
  "atari-2600",
  "nes",
  "master-system",
  "game-boy",
  "game-boy-color",
  "game-boy-advance",
  "snes",
  "genesis",
  "sega-cd",
  "sega-32x",
  "turbo-grafx",
  "pc-engine-cd",
  "saturn",
  "n64",
  "neo-geo",
  "playstation",
  "dos",
  "arcade",
];

/** @type {Record<string, string>} */
export const BUNDLED_PLATFORM_ICON_PATHS = Object.fromEntries(
  PLATFORM_IDS.map((id) => [id, `assets/images/platforms/${id}/icon.svg`]),
);

/**
 * @param {string} platformId
 * @param {unknown} [theme]
 * @returns {string}
 */
export function getPlatformIconPath(platformId, theme = DEFAULT_PLATFORM_ICON_THEME) {
  return getXmbPlatformIconUrl(platformId, normalizePlatformIconTheme(theme));
}

/**
 * @param {string} platformId
 * @returns {string}
 */
export function getBundledPlatformIconPath(platformId) {
  return BUNDLED_PLATFORM_ICON_PATHS[platformId] ?? BUNDLED_PLATFORM_ICON_PATHS.nes;
}
