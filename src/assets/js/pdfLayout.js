import {
  LETTER_WIDTH_MM,
  LETTER_HEIGHT_MM,
  CARDS_PER_ROW,
  CARDS_PER_COL,
  PDF_CARD_GAP_MM,
  PDF_CUT_MARK_LENGTH_MM,
  PDF_CUT_MARK_OFFSET_MM,
} from "./config.js";
import { resolveCardSizing } from "./cardSizing.js";

/**
 * @param {{ cardWidthMm?: unknown, cardHeightMm?: unknown, stickerInsetMm?: unknown } | null | undefined} layoutSettings
 */
function resolvePdfCardDimensions(layoutSettings) {
  const sizing = resolveCardSizing(layoutSettings);
  return {
    cardWidthMm: sizing.cardWidthMm,
    cardHeightMm: sizing.cardHeightMm,
  };
}

/** Layout math for the letter-size PDF grid (exported for tests). */
export function computePdfGridLayout(layoutSettings) {
  const { cardWidthMm, cardHeightMm } = resolvePdfCardDimensions(layoutSettings);
  const gridW = CARDS_PER_ROW * cardWidthMm + (CARDS_PER_ROW - 1) * PDF_CARD_GAP_MM;
  const gridH = CARDS_PER_COL * cardHeightMm + (CARDS_PER_COL - 1) * PDF_CARD_GAP_MM;
  const marginX = (LETTER_WIDTH_MM - gridW) / 2;
  const marginY = (LETTER_HEIGHT_MM - gridH) / 2;

  return { gridW, gridH, marginX, marginY, gap: PDF_CARD_GAP_MM, cardWidthMm, cardHeightMm };
}

/**
 * @param {number} col
 * @param {number} row
 */
export function cardPositionMm(col, row, layoutSettings) {
  const { marginX, marginY, gap, cardWidthMm, cardHeightMm } = computePdfGridLayout(layoutSettings);
  return {
    x: marginX + col * (cardWidthMm + gap),
    y: marginY + row * (cardHeightMm + gap),
  };
}

/**
 * @param {number} col
 * @param {number} row
 */
export function cardRectMm(col, row, layoutSettings) {
  const { x, y } = cardPositionMm(col, row, layoutSettings);
  const { cardWidthMm, cardHeightMm } = computePdfGridLayout(layoutSettings);
  return { x, y, w: cardWidthMm, h: cardHeightMm };
}

/**
 * @param {number} col
 * @param {number} row
 */
export function stickerRectMm(col, row, layoutSettings) {
  const { x, y } = cardPositionMm(col, row, layoutSettings);
  const { stickerInsetMm, stickerWidthMm, stickerHeightMm } = resolveCardSizing(layoutSettings);
  return {
    x: x + stickerInsetMm,
    y: y + stickerInsetMm,
    w: stickerWidthMm,
    h: stickerHeightMm,
  };
}

/** Outer bounds of the 3×3 sticker trim grid. */
export function computeStickerCutLayout(layoutSettings) {
  const { gridW, gridH, marginX, marginY } = computePdfGridLayout(layoutSettings);
  const { stickerInsetMm } = resolveCardSizing(layoutSettings);
  return {
    marginX: marginX + stickerInsetMm,
    marginY: marginY + stickerInsetMm,
    gridW: gridW - 2 * stickerInsetMm,
    gridH: gridH - 2 * stickerInsetMm,
    stickerInsetMm,
  };
}

/**
 * Vertical cut-line X positions at every sticker left/right edge.
 * @returns {number[]}
 */
export function stickerVerticalCutXs(layoutSettings) {
  /** @type {number[]} */
  const xs = [];
  for (let col = 0; col < CARDS_PER_ROW; col++) {
    const sticker = stickerRectMm(col, 0, layoutSettings);
    xs.push(sticker.x, sticker.x + sticker.w);
  }
  return xs;
}

/**
 * Horizontal cut-line Y positions at every sticker top/bottom edge.
 * @returns {number[]}
 */
export function stickerHorizontalCutYs(layoutSettings) {
  /** @type {number[]} */
  const ys = [];
  for (let row = 0; row < CARDS_PER_COL; row++) {
    const sticker = stickerRectMm(0, row, layoutSettings);
    ys.push(sticker.y, sticker.y + sticker.h);
  }
  return ys;
}

/**
 * Continuous cut-line segments for tests / drawing.
 * Each sticker edge is one straight line through the sticker grid, extended
 * into the page margin by the crop-mark offset + length.
 *
 * @returns {{ x1: number, y1: number, x2: number, y2: number }[]}
 */
export function stickerCutLineSegments(layoutSettings) {
  const { marginX, marginY, gridW, gridH } = computeStickerCutLayout(layoutSettings);
  const extend = PDF_CUT_MARK_OFFSET_MM + PDF_CUT_MARK_LENGTH_MM;
  /** @type {{ x1: number, y1: number, x2: number, y2: number }[]} */
  const segments = [];

  for (const cutX of stickerVerticalCutXs(layoutSettings)) {
    segments.push({
      x1: cutX,
      y1: marginY - extend,
      x2: cutX,
      y2: marginY + gridH + extend,
    });
  }

  for (const cutY of stickerHorizontalCutYs(layoutSettings)) {
    segments.push({
      x1: marginX - extend,
      y1: cutY,
      x2: marginX + gridW + extend,
      y2: cutY,
    });
  }

  return segments;
}

/**
 * X coordinate at the center of the vertical gutter between two columns.
 * @param {number} col Left column index (0 or 1 for a 3-column grid).
 */
export function verticalGutterCenterX(col, layoutSettings) {
  const { marginX, gap, cardWidthMm } = computePdfGridLayout(layoutSettings);
  return marginX + (col + 1) * cardWidthMm + col * gap + gap / 2;
}

/**
 * Y coordinate at the center of the horizontal gutter between two rows.
 * @param {number} row Top row index (0 or 1 for a 3-row grid).
 */
export function horizontalGutterCenterY(row, layoutSettings) {
  const { marginY, gap, cardHeightMm } = computePdfGridLayout(layoutSettings);
  return marginY + (row + 1) * cardHeightMm + row * gap + gap / 2;
}

/**
 * Draw continuous trim lines on every sticker edge.
 * Lines run straight through bleed zones, artwork borders, and card gaps,
 * and extend slightly into the page margin for alignment.
 *
 * @param {import("jspdf").jsPDF} pdf
 */
export function drawSheetCutMarks(pdf, layoutSettings) {
  pdf.setDrawColor(120);
  pdf.setLineWidth(0.15);

  for (const { x1, y1, x2, y2 } of stickerCutLineSegments(layoutSettings)) {
    pdf.line(x1, y1, x2, y2);
  }
}

/**
 * @param {number} px
 * @param {number} py
 * @param {{ x: number, y: number, w: number, h: number }} rect
 */
export function pointInsideCard(px, py, rect) {
  return px > rect.x && px < rect.x + rect.w && py > rect.y && py < rect.y + rect.h;
}
