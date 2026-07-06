/** @typedef {{ x: number, y: number, w: number, h: number }} Rect */

/** Share of the segment given to artwork (primary) or logo (within platform). */
export const ART_RATIO = 0.75;
export const PLATFORM_RATIO = 0.25;
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
 * Split long-edge to long-edge: artwork ~75% | platform ~25%.
 *
 * Portrait segment (tall): horizontal cut → platform top, artwork bottom.
 * Landscape segment (wide): vertical cut → artwork left, platform right.
 *
 * @param {Rect} rect
 */
export function splitArtAndPlatform(rect) {
  const { x, y, w, h } = rect;

  if (isPortraitSegment(w, h)) {
    const platformH = Math.round(h * PLATFORM_RATIO);
    return {
      platform: { x, y, w, h: platformH },
      art: { x, y: y + platformH, w, h: h - platformH },
    };
  }

  const platformW = Math.round(w * PLATFORM_RATIO);
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
 */
export function splitLogoAndColor(rect) {
  const { x, y, w, h } = rect;

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
 */
export function computeCardLayout(cardW, cardH) {
  const { art, platform } = splitArtAndPlatform({ x: 0, y: 0, w: cardW, h: cardH });
  const { logo, color } = splitLogoAndColor(platform);
  return { art, platform, logo, color };
}
