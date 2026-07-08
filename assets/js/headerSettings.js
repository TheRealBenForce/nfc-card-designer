export const DEFAULT_SHOW_HEADER = true;
export const DEFAULT_SHOW_PLATFORM_COLOR = true;
export const DEFAULT_HEADER_HEIGHT_PERCENT = 15;

export const MIN_HEADER_HEIGHT_PERCENT = 5;
export const MAX_HEADER_HEIGHT_PERCENT = 40;

/**
 * @param {unknown} value
 * @param {boolean} fallback
 */
function normalizeBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * @param {unknown} value
 */
export function normalizeHeaderHeightPercent(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_HEADER_HEIGHT_PERCENT;
  }
  const rounded = Math.round(value);
  return Math.min(MAX_HEADER_HEIGHT_PERCENT, Math.max(MIN_HEADER_HEIGHT_PERCENT, rounded));
}

/**
 * @param {{ showHeader?: unknown, showPlatformColor?: unknown, headerHeightPercent?: unknown } | null | undefined} settings
 */
export function normalizeHeaderSettings(settings) {
  return {
    showHeader: normalizeBoolean(settings?.showHeader, DEFAULT_SHOW_HEADER),
    showPlatformColor: normalizeBoolean(
      settings?.showPlatformColor,
      DEFAULT_SHOW_PLATFORM_COLOR,
    ),
    headerHeightPercent: normalizeHeaderHeightPercent(settings?.headerHeightPercent),
  };
}

/**
 * @param {{ showHeader?: unknown, showPlatformColor?: unknown, headerHeightPercent?: unknown } | null | undefined} settings
 */
export function resolveHeaderSettings(settings) {
  const normalized = normalizeHeaderSettings(settings);
  return {
    ...normalized,
    showPlatformColor: normalized.showHeader && normalized.showPlatformColor,
  };
}
