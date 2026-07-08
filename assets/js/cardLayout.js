import { DEFAULT_HEADER_HEIGHT_PERCENT, resolveHeaderSettings } from "./headerSettings.js";

/** @typedef {{ x: number, y: number, w: number, h: number }} Rect */
/**
 * @typedef {{
 *   showHeader?: boolean,
 *   showPlatformColor?: boolean,
 *   headerHeightPercent?: number,
 * }} HeaderLayoutOptions
 */

/** Share of the segment given to artwork (primary) or logo (within platform). */
export const ART_RATIO = 1 - DEFAULT_HEADER_HEIGHT_PERCENT / 100;
export const PLATFORM_RATIO = DEFAULT_HEADER_HEIGHT_PERCENT / 100;
export const LOGO_RATIO = 0.75;
export const COLOR_RATIO = 0.25;

/**
 * Portrait when height is the long edge.
 * @param {number} w
 * @param {number} h
 */
export function isPortraitSegment(w, h) {
  return h >= w;
}

/**
 * @param {Rect} rect
 * @returns {Rect}
 */
function zeroRect(rect) {
  return { x: rect.x, y: rect.y, w: 0, h: 0 };
}

/**
 * Split long-edge to long-edge: artwork | platform header.
 *
 * Portrait segment (tall): horizontal cut → header top, artwork bottom.
 * Landscape segment (wide): vertical cut → artwork left, header right.
 *
 * @param {Rect} rect
 * @param {HeaderLayoutOptions} [options]
 */
export function splitArtAndPlatform(rect, options) {
  const { x, y, w, h } = rect;
  const { showHeader, headerHeightPercent } = resolveHeaderSettings(options);

  if (!showHeader) {
    return {
      platform: zeroRect(rect),
      art: { x, y, w, h },
    };
  }

  const headerRatio = headerHeightPercent / 100;

  if (isPortraitSegment(w, h)) {
    const platformH = Math.round(h * headerRatio);
    return {
      platform: { x, y, w, h: platformH },
      art: { x, y: y + platformH, w, h: h - platformH },
    };
  }

  const platformW = Math.round(w * headerRatio);
  return {
    art: { x, y, w: w - platformW, h },
    platform: { x: x + w - platformW, y, w: platformW, h },
  };
}

/**
 * Split the platform segment long-edge to long-edge: logo ~75% | color ~25%.
 *
 * Portrait segment (tall): horizontal cut → logo top, color bottom.
 * Landscape segment (wide): vertical cut → logo left, color right.
 *
 * @param {Rect} rect
 * @param {HeaderLayoutOptions} [options]
 */
export function splitLogoAndColor(rect, options) {
  const { x, y, w, h } = rect;
  const { showPlatformColor } = resolveHeaderSettings(options);

  if (!showPlatformColor) {
    return {
      logo: { x, y, w, h },
      color: zeroRect(rect),
    };
  }

  if (isPortraitSegment(w, h)) {
    const logoH = Math.round(h * LOGO_RATIO);
    return {
      logo: { x, y, w, h: logoH },
      color: { x, y: y + logoH, w, h: h - logoH },
    };
  }

  const logoW = Math.round(w * LOGO_RATIO);
  return {
    logo: { x, y, w: logoW, h },
    color: { x: x + logoW, y, w: w - logoW, h },
  };
}

/**
 * @param {number} cardW
 * @param {number} cardH
 * @param {HeaderLayoutOptions} [options]
 */
export function computeCardLayout(cardW, cardH, options) {
  const resolvedOptions = resolveHeaderSettings(options);
  const { art, platform } = splitArtAndPlatform(
    { x: 0, y: 0, w: cardW, h: cardH },
    resolvedOptions,
  );
  const { logo, color } = splitLogoAndColor(platform, resolvedOptions);
  return { art, platform, logo, color, ...resolvedOptions };
}
