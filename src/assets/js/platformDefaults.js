import { DEFAULT_IMAGE_TYPE_PRIORITY } from "./config.js";
import { normalizeImageTypePriority } from "./imageSettings.js";
import { defaultArtworkDisplay, normalizeArtworkDisplay } from "./artworkDisplay.js";
import { normalizeHeaderSettings } from "./headerSettings.js";
import { platformById, platforms } from "./data/platforms.js";

export const DEFAULT_PLATFORM_COLOR = "#000000";

/** @type {readonly number[]} */
export const ROTATION_OPTIONS = [0, 90, 180, 270];

const PLATFORM_DEFAULTS_URL = "assets/data/platform-defaults.json";

/**
 * @typedef {Object} PlatformDefaults
 * @property {string} color
 * @property {string[]} imageTypePriority
 * @property {Record<string, number>} imageRotation
 * @property {import('./artworkDisplay.js').ArtworkDisplaySettings} artworkDisplay
 * @property {import('./headerSettings.js').HeaderSettings} headerSettings
 */

/** @type {Record<string, Partial<PlatformDefaults>> | null} */
let seedDefaults = null;

/** @type {Promise<void> | null} */
let loadPromise = null;

/**
 * @param {string} platformId
 * @param {string} [color]
 * @returns {PlatformDefaults}
 */
function buildBarePlatformDefaultEntry(platformId, color = DEFAULT_PLATFORM_COLOR) {
  return {
    color,
    imageTypePriority: [...DEFAULT_IMAGE_TYPE_PRIORITY],
    imageRotation: defaultImageRotation(),
    artworkDisplay: defaultArtworkDisplay(),
    headerSettings: normalizeHeaderSettings(),
  };
}

/**
 * @param {Partial<PlatformDefaults>} seed
 * @param {string} platformId
 * @returns {PlatformDefaults}
 */
function applySeedToEntry(seed, platformId) {
  const entry = buildBarePlatformDefaultEntry(platformId, platformById[platformId]?.defaultColor);
  if (!seed || typeof seed !== "object") return entry;

  const normalized = { ...entry };
  if (typeof seed.color === "string") normalized.color = seed.color;

  if (seed.imageTypePriority) {
    normalized.imageTypePriority = normalizeImageTypePriority(seed.imageTypePriority);
  }

  if (seed.imageRotation && typeof seed.imageRotation === "object") {
    const imageRotation = { ...normalized.imageRotation };
    for (const type of DEFAULT_IMAGE_TYPE_PRIORITY) {
      if (type in seed.imageRotation) {
        imageRotation[type] = normalizeRotationDegrees(seed.imageRotation[type]);
      }
    }
    normalized.imageRotation = imageRotation;
  }

  if (seed.artworkDisplay) {
    normalized.artworkDisplay = normalizeArtworkDisplay(seed.artworkDisplay);
  }

  if (seed.headerSettings) {
    normalized.headerSettings = normalizeHeaderSettings(seed.headerSettings);
  }

  return normalized;
}

/**
 * Load bundled platform defaults from `assets/data/platform-defaults.json`.
 * Safe to call multiple times; subsequent calls are no-ops.
 */
export async function loadPlatformDefaultsSeed() {
  if (seedDefaults) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      let raw;
      if (typeof window === "undefined") {
        const { readFile } = await import("node:fs/promises");
        const { fileURLToPath } = await import("node:url");
        const path = await import("node:path");
        const jsonPath = path.join(
          fileURLToPath(new URL("../../assets/data/platform-defaults.json", import.meta.url)),
        );
        raw = await readFile(jsonPath, "utf8");
      } else {
        const response = await fetch(PLATFORM_DEFAULTS_URL);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        raw = await response.text();
      }

      const parsed = JSON.parse(raw);
      seedDefaults = parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      seedDefaults = {};
    }
  })();

  return loadPromise;
}

/**
 * @param {string} platformId
 * @returns {PlatformDefaults}
 */
export function getSeedPlatformDefaults(platformId) {
  const seed = seedDefaults?.[platformId];
  return applySeedToEntry(seed ?? {}, platformId);
}

/** @returns {Record<string, number>} */
export function defaultImageRotation() {
  return Object.fromEntries(DEFAULT_IMAGE_TYPE_PRIORITY.map((type) => [type, 0]));
}

/**
 * @param {string} platformId
 * @param {unknown} rotationEntry
 */
function shouldMigrateLegacyRotation(platformId, rotationEntry) {
  const seedBoxArtRotation = getSeedPlatformDefaults(platformId).imageRotation.boxArt;
  if (!seedBoxArtRotation) return false;
  if (!rotationEntry || typeof rotationEntry !== "object") return false;
  return DEFAULT_IMAGE_TYPE_PRIORITY.every(
    (type) => normalizeRotationDegrees(rotationEntry[type]) === 0,
  );
}

/**
 * @param {string} platformId
 * @param {string} [color]
 * @returns {PlatformDefaults}
 */
export function createPlatformDefaultEntry(platformId, color = DEFAULT_PLATFORM_COLOR) {
  const seed = seedDefaults?.[platformId];
  if (seed) {
    return applySeedToEntry(seed, platformId);
  }

  return buildBarePlatformDefaultEntry(platformId, color);
}

/** @returns {Record<string, PlatformDefaults>} */
export function defaultPlatformDefaults() {
  return Object.fromEntries(
    platforms.map((platform) => [
      platform.id,
      createPlatformDefaultEntry(platform.id, platform.defaultColor),
    ]),
  );
}

/**
 * @param {unknown} degrees
 * @returns {number}
 */
export function normalizeRotationDegrees(degrees) {
  if (typeof degrees !== "number" || !Number.isFinite(degrees)) return 0;
  const rounded = Math.round(degrees);
  const normalized = ((rounded % 360) + 360) % 360;
  return ROTATION_OPTIONS.includes(normalized) ? normalized : 0;
}

/**
 * @param {Record<string, PlatformDefaults> | undefined} parsed
 * @param {Record<string, string> | undefined} legacyColors
 * @param {unknown} [legacyArtworkDisplay]
 * @param {{ showHeader?: unknown, showPlatformColor?: unknown, headerHeightPercent?: unknown } | null | undefined} [legacyGlobalHeader]
 * @returns {Record<string, PlatformDefaults>}
 */
export function normalizePlatformDefaults(parsed, legacyColors, legacyArtworkDisplay, legacyGlobalHeader) {
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
        if (shouldMigrateLegacyRotation(platformId, entry.imageRotation)) {
          imageRotation.boxArt = normalizeRotationDegrees(
            getSeedPlatformDefaults(platformId).imageRotation.boxArt,
          );
        }
        normalized.imageRotation = imageRotation;
      }

      if (entry.artworkDisplay) {
        normalized.artworkDisplay = normalizeArtworkDisplay(entry.artworkDisplay);
      } else if (legacyDisplay) {
        normalized.artworkDisplay = legacyDisplay;
      }

      if (entry.headerSettings) {
        normalized.headerSettings = normalizeHeaderSettings(entry.headerSettings);
      } else if (legacyGlobalHeader) {
        normalized.headerSettings = normalizeHeaderSettings(legacyGlobalHeader);
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

  if (legacyGlobalHeader) {
    const migratedHeader = normalizeHeaderSettings(legacyGlobalHeader);
    for (const platformId of Object.keys(defaults)) {
      if (!parsed?.[platformId]?.headerSettings) {
        defaults[platformId] = {
          ...defaults[platformId],
          headerSettings: migratedHeader,
        };
      }
    }
  }

  return defaults;
}

/**
 * @param {Record<string, PlatformDefaults>} platformDefaults
 * @param {string} platformId
 */
export function getPlatformHeaderSettings(platformDefaults, platformId) {
  return normalizeHeaderSettings(platformDefaults[platformId]?.headerSettings);
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
