import { DEFAULT_IMAGE_TYPE_PRIORITY } from "./config.js";
import { normalizeImageTypePriority } from "./imageSettings.js";
import { defaultArtworkDisplay, normalizeArtworkDisplay } from "./artworkDisplay.js";
import { platformById, platforms } from "./data/platforms.js";

export const DEFAULT_PLATFORM_COLOR = "#000000";

/** @type {readonly number[]} */
export const ROTATION_OPTIONS = [0, 90, 180, 270];

/**
 * @typedef {Object} PlatformDefaults
 * @property {string} color
 * @property {string[]} imageTypePriority
 * @property {Record<string, number>} imageRotation
 * @property {import('./artworkDisplay.js').ArtworkDisplaySettings} artworkDisplay
 */

/** @returns {Record<string, number>} */
export function defaultImageRotation() {
  return Object.fromEntries(DEFAULT_IMAGE_TYPE_PRIORITY.map((type) => [type, 0]));
}

/**
 * @param {string} [color]
 * @returns {PlatformDefaults}
 */
export function createPlatformDefaultEntry(color = DEFAULT_PLATFORM_COLOR) {
  return {
    color,
    imageTypePriority: [...DEFAULT_IMAGE_TYPE_PRIORITY],
    imageRotation: defaultImageRotation(),
    artworkDisplay: defaultArtworkDisplay(),
  };
}

/** @returns {Record<string, PlatformDefaults>} */
export function defaultPlatformDefaults() {
  return Object.fromEntries(
    platforms.map((platform) => [platform.id, createPlatformDefaultEntry(platform.defaultColor)]),
  );
}

/**
 * @param {unknown} degrees
 * @returns {number}
 */
export function normalizeRotationDegrees(degrees) {
  if (typeof degrees !== "number" || !Number.isFinite(degrees)) return 0;
  const rounded = Math.round(degrees);
  return ROTATION_OPTIONS.includes(rounded) ? rounded : 0;
}

/**
 * @param {Record<string, PlatformDefaults> | undefined} parsed
 * @param {Record<string, string> | undefined} legacyColors
 * @param {unknown} [legacyArtworkDisplay]
 * @returns {Record<string, PlatformDefaults>}
 */
export function normalizePlatformDefaults(parsed, legacyColors, legacyArtworkDisplay) {
  const defaults = defaultPlatformDefaults();
  const legacyDisplay = legacyArtworkDisplay
    ? normalizeArtworkDisplay(legacyArtworkDisplay)
    : null;

  if (parsed && typeof parsed === "object") {
    for (const [platformId, entry] of Object.entries(parsed)) {
      if (!defaults[platformId] || !entry || typeof entry !== "object") continue;

      const normalized = { ...defaults[platformId] };
      if (typeof entry.color === "string") normalized.color = entry.color;

      if (entry.imageTypePriority) {
        normalized.imageTypePriority = normalizeImageTypePriority(entry.imageTypePriority);
      }

      if (entry.imageRotation && typeof entry.imageRotation === "object") {
        const imageRotation = { ...normalized.imageRotation };
        for (const type of DEFAULT_IMAGE_TYPE_PRIORITY) {
          if (type in entry.imageRotation) {
            imageRotation[type] = normalizeRotationDegrees(entry.imageRotation[type]);
          }
        }
        normalized.imageRotation = imageRotation;
      }

      if (entry.artworkDisplay) {
        normalized.artworkDisplay = normalizeArtworkDisplay(entry.artworkDisplay);
      } else if (legacyDisplay) {
        normalized.artworkDisplay = legacyDisplay;
      }

      defaults[platformId] = normalized;
    }
  } else if (legacyDisplay) {
    for (const platformId of Object.keys(defaults)) {
      defaults[platformId] = { ...defaults[platformId], artworkDisplay: legacyDisplay };
    }
  }

  if (legacyColors && typeof legacyColors === "object") {
    for (const [platformId, color] of Object.entries(legacyColors)) {
      if (defaults[platformId] && typeof color === "string") {
        defaults[platformId] = { ...defaults[platformId], color };
      }
    }
  }

  return defaults;
}

/**
 * @param {Record<string, PlatformDefaults>} platformDefaults
 * @param {string} platformId
 */
export function getPlatformColor(platformDefaults, platformId) {
  return (
    platformDefaults[platformId]?.color ??
    platformById[platformId]?.defaultColor ??
    DEFAULT_PLATFORM_COLOR
  );
}

/**
 * @param {Record<string, PlatformDefaults>} platformDefaults
 * @param {string} platformId
 * @param {string} imageType
 */
export function getImageRotation(platformDefaults, platformId, imageType) {
  return normalizeRotationDegrees(platformDefaults[platformId]?.imageRotation?.[imageType]);
}

/**
 * Per-platform artwork priority used when browsing or adding cards.
 *
 * @param {Record<string, PlatformDefaults>} platformDefaults
 * @param {string} platformId
 */
export function getEffectiveImageTypePriority(platformDefaults, platformId) {
  const platformPriority = platformDefaults[platformId]?.imageTypePriority;
  if (platformPriority?.length) {
    return normalizeImageTypePriority(platformPriority);
  }
  return normalizeImageTypePriority(DEFAULT_IMAGE_TYPE_PRIORITY);
}

/**
 * @param {Record<string, PlatformDefaults>} platformDefaults
 * @param {string} platformId
 */
export function getPlatformArtworkDisplay(platformDefaults, platformId) {
  return normalizeArtworkDisplay(platformDefaults[platformId]?.artworkDisplay);
}
