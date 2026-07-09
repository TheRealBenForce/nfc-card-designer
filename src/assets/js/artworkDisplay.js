/** @typedef {'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'} ArtworkAlignment */

/** @typedef {'select' | 'consoleColor' | 'nearestEdge' | 'blurredBoxArt' | 'blurredTitleScreen' | 'blurredSnapshot'} ArtworkBackgroundMode */

/**
 * @typedef {Object} ArtworkDisplaySettings
 * @property {ArtworkAlignment} alignment
 * @property {ArtworkBackgroundMode} backgroundMode
 * @property {string} backgroundColor
 * @property {number} zoom
 */

/** @type {readonly ArtworkAlignment[]} */
export const ARTWORK_ALIGNMENT_ORDER = [
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

/** @type {Record<ArtworkAlignment, { label: string, x: number, y: number }>} */
export const ARTWORK_ALIGNMENTS = {
  "top-left": { label: "Top left", x: 0, y: 0 },
  "top-center": { label: "Top center", x: 0.5, y: 0 },
  "top-right": { label: "Top right", x: 1, y: 0 },
  "center-left": { label: "Center left", x: 0, y: 0.5 },
  center: { label: "Center", x: 0.5, y: 0.5 },
  "center-right": { label: "Center right", x: 1, y: 0.5 },
  "bottom-left": { label: "Bottom left", x: 0, y: 1 },
  "bottom-center": { label: "Bottom center", x: 0.5, y: 1 },
  "bottom-right": { label: "Bottom right", x: 1, y: 1 },
};

export const DEFAULT_ARTWORK_ALIGNMENT = "top-center";

/** @type {readonly ArtworkBackgroundMode[]} */
export const ARTWORK_BACKGROUND_MODE_ORDER = [
  "select",
  "consoleColor",
  "nearestEdge",
  "blurredBoxArt",
  "blurredTitleScreen",
  "blurredSnapshot",
];

/** @type {Record<ArtworkBackgroundMode, { label: string }>} */
export const ARTWORK_BACKGROUND_MODES = {
  select: { label: "Select Tool" },
  consoleColor: { label: "Console color" },
  nearestEdge: { label: "Nearest edge" },
  blurredBoxArt: { label: "Blurred box art" },
  blurredTitleScreen: { label: "Blurred title screen" },
  blurredSnapshot: { label: "Blurred snapshot" },
};

export const DEFAULT_ARTWORK_BACKGROUND_MODE = "select";
export const DEFAULT_ARTWORK_BACKGROUND_COLOR = "#000000";
export const DEFAULT_ARTWORK_ZOOM = 0;
export const MIN_ARTWORK_ZOOM = -50;
export const MAX_ARTWORK_ZOOM = 200;

/** @type {Record<string, string>} */
export const BLURRED_BACKGROUND_IMAGE_TYPES = {
  blurredBoxArt: "boxArt",
  blurredTitleScreen: "titleScreen",
  blurredSnapshot: "gamePicture",
};

/** @returns {ArtworkDisplaySettings} */
export function defaultArtworkDisplay() {
  return {
    alignment: DEFAULT_ARTWORK_ALIGNMENT,
    backgroundMode: DEFAULT_ARTWORK_BACKGROUND_MODE,
    backgroundColor: DEFAULT_ARTWORK_BACKGROUND_COLOR,
    zoom: DEFAULT_ARTWORK_ZOOM,
  };
}

/**
 * @param {string} color
 * @returns {string}
 */
export function normalizeHexColor(color) {
  if (typeof color !== "string") return DEFAULT_ARTWORK_BACKGROUND_COLOR;
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return DEFAULT_ARTWORK_BACKGROUND_COLOR;
}

/**
 * @param {unknown} alignment
 * @returns {ArtworkAlignment}
 */
export function normalizeArtworkAlignment(alignment) {
  if (typeof alignment === "string" && alignment in ARTWORK_ALIGNMENTS) {
    return /** @type {ArtworkAlignment} */ (alignment);
  }
  return DEFAULT_ARTWORK_ALIGNMENT;
}

/**
 * @param {unknown} mode
 * @returns {ArtworkBackgroundMode}
 */
export function normalizeArtworkBackgroundMode(mode) {
  if (typeof mode === "string" && mode in ARTWORK_BACKGROUND_MODES) {
    return /** @type {ArtworkBackgroundMode} */ (mode);
  }
  return DEFAULT_ARTWORK_BACKGROUND_MODE;
}

/**
 * @param {unknown} zoom
 * @returns {number}
 */
export function normalizeArtworkZoom(zoom) {
  if (typeof zoom !== "number" || !Number.isFinite(zoom)) return DEFAULT_ARTWORK_ZOOM;
  return Math.min(MAX_ARTWORK_ZOOM, Math.max(MIN_ARTWORK_ZOOM, Math.round(zoom)));
}

/**
 * @param {unknown} parsed
 * @returns {ArtworkDisplaySettings}
 */
export function normalizeArtworkDisplay(parsed) {
  const defaults = defaultArtworkDisplay();
  if (!parsed || typeof parsed !== "object") return defaults;

  const entry = /** @type {Record<string, unknown>} */ (parsed);
  return {
    alignment: normalizeArtworkAlignment(entry.alignment),
    backgroundMode: normalizeArtworkBackgroundMode(entry.backgroundMode),
    backgroundColor: normalizeHexColor(
      typeof entry.backgroundColor === "string" ? entry.backgroundColor : defaults.backgroundColor,
    ),
    zoom: normalizeArtworkZoom(entry.zoom),
  };
}

/**
 * @param {ArtworkDisplaySettings | undefined} artworkDisplay
 * @returns {{ x: number, y: number }}
 */
export function getAlignmentFractions(artworkDisplay) {
  const alignment = normalizeArtworkAlignment(artworkDisplay?.alignment);
  return ARTWORK_ALIGNMENTS[alignment];
}

/**
 * Effective artwork display for a card: card override, then platform default.
 *
 * @param {import('./state.js').Card} card
 * @param {Record<string, import('./platformDefaults.js').PlatformDefaults>} platformDefaults
 * @returns {ArtworkDisplaySettings}
 */
export function resolveArtworkDisplay(card, platformDefaults) {
  if (card.artworkDisplay) {
    return normalizeArtworkDisplay(card.artworkDisplay);
  }
  return normalizeArtworkDisplay(platformDefaults[card.platformId]?.artworkDisplay);
}
