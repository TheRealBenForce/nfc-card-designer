import {
  CARD_WIDTH_MM,
  CARD_HEIGHT_MM,
  DEFAULT_STICKER_INSET_MM,
  CSS_PX_PER_MM,
} from "./config.js";

export const MIN_CARD_WIDTH_MM = 20;
export const MAX_CARD_WIDTH_MM = 120;
export const MIN_CARD_HEIGHT_MM = 20;
export const MAX_CARD_HEIGHT_MM = 180;
const MIN_STICKER_SIZE_MM = 1;

/**
 * @param {unknown} value
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 */
function normalizeMillimeterValue(value, fallback, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value * 10) / 10;
  return Math.min(max, Math.max(min, rounded));
}

/**
 * @param {unknown} value
 */
export function normalizeCardWidthMm(value) {
  return normalizeMillimeterValue(value, CARD_WIDTH_MM, MIN_CARD_WIDTH_MM, MAX_CARD_WIDTH_MM);
}

/**
 * @param {unknown} value
 */
export function normalizeCardHeightMm(value) {
  return normalizeMillimeterValue(value, CARD_HEIGHT_MM, MIN_CARD_HEIGHT_MM, MAX_CARD_HEIGHT_MM);
}

/**
 * @param {number} cardWidthMm
 * @param {number} cardHeightMm
 */
export function maxStickerInsetMm(cardWidthMm, cardHeightMm) {
  const maxInsetByWidth = Math.max(0, (cardWidthMm - MIN_STICKER_SIZE_MM) / 2);
  const maxInsetByHeight = Math.max(0, (cardHeightMm - MIN_STICKER_SIZE_MM) / 2);
  return Math.min(maxInsetByWidth, maxInsetByHeight);
}

/**
 * @param {unknown} value
 * @param {number} [cardWidthMm]
 * @param {number} [cardHeightMm]
 */
export function normalizeStickerInsetMm(value, cardWidthMm = CARD_WIDTH_MM, cardHeightMm = CARD_HEIGHT_MM) {
  const maxInset = maxStickerInsetMm(cardWidthMm, cardHeightMm);
  return normalizeMillimeterValue(value, DEFAULT_STICKER_INSET_MM, 0, maxInset);
}

/**
 * @param {{
 *   cardWidthMm?: unknown,
 *   cardHeightMm?: unknown,
 *   stickerInsetMm?: unknown,
 * } | null | undefined} settings
 */
export function resolveCardSizing(settings) {
  const cardWidthMm = normalizeCardWidthMm(settings?.cardWidthMm);
  const cardHeightMm = normalizeCardHeightMm(settings?.cardHeightMm);
  const stickerInsetMm = normalizeStickerInsetMm(settings?.stickerInsetMm, cardWidthMm, cardHeightMm);
  return {
    cardWidthMm,
    cardHeightMm,
    stickerInsetMm,
    stickerWidthMm: Math.max(MIN_STICKER_SIZE_MM, cardWidthMm - stickerInsetMm * 2),
    stickerHeightMm: Math.max(MIN_STICKER_SIZE_MM, cardHeightMm - stickerInsetMm * 2),
  };
}

/**
 * @param {number} mm
 */
export function mmToCssPx(mm) {
  return Math.round(mm * CSS_PX_PER_MM);
}

/**
 * @param {number} mm
 * @param {number} [dpi]
 */
export function mmToRenderPx(mm, dpi = 300) {
  return Math.max(0, Math.round((mm / 25.4) * dpi));
}

/**
 * @param {{
 *   cardWidthMm?: unknown,
 *   cardHeightMm?: unknown,
 *   stickerInsetMm?: unknown,
 * } | null | undefined} settings
 */
export function getCardPreviewWidthPx(settings) {
  return mmToCssPx(resolveCardSizing(settings).cardWidthMm);
}
