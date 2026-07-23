import { platformById } from "./data/platforms.js";

/** @typedef {{ id: string, label: string }} PlatformIconThemeOption */

/** @type {readonly PlatformIconThemeOption[]} */
export const PLATFORM_ICON_THEMES = [
  { id: "dot-art", label: "Dot Art" },
  { id: "flatui", label: "FlatUI" },
  { id: "flatux", label: "FlatUX" },
  { id: "monochrome", label: "Monochrome" },
  { id: "pixel", label: "Pixel" },
  { id: "retrosystem", label: "RetroSystem" },
  { id: "systematic", label: "Systematic" },
  { id: "daite", label: "Daite" },
  { id: "automatic", label: "Automatic" },
];

export const DEFAULT_PLATFORM_ICON_THEME = "dot-art";

/** Themes whose XMB icons are light-on-transparent and need inversion in light UI mode. */
export const PLATFORM_ICON_THEMES_INVERT_IN_LIGHT = new Set([
  "monochrome",
  "pixel",
  "automatic",
]);

const THEME_IDS = new Set(PLATFORM_ICON_THEMES.map((theme) => theme.id));

const XMB_BASE =
  "https://raw.githubusercontent.com/libretro/retroarch-assets/master/xmb";

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizePlatformIconTheme(value) {
  return typeof value === "string" && THEME_IDS.has(value)
    ? value
    : DEFAULT_PLATFORM_ICON_THEME;
}

/**
 * @param {string} theme
 * @returns {boolean}
 */
export function shouldInvertPlatformIconInLight(theme) {
  return PLATFORM_ICON_THEMES_INVERT_IN_LIGHT.has(normalizePlatformIconTheme(theme));
}

/**
 * @param {string} platformId
 * @param {string} [theme]
 * @returns {string}
 */
export function getXmbPlatformIconUrl(platformId, theme = DEFAULT_PLATFORM_ICON_THEME) {
  const platform = platformById[platformId];
  const normalizedTheme = normalizePlatformIconTheme(theme);
  const playlist = platform?.libretroPlaylist ?? platformById.nes.libretroPlaylist;
  const filename = `${playlist}.png`;
  return `${XMB_BASE}/${normalizedTheme}/png/${encodeURIComponent(filename)}`;
}
