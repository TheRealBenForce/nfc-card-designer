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

/** Cut-mark bounds aligned to printable sticker edges (inset within each card slot). */
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
 * Perimeter crop marks around the full 3×3 grid.
 *
 * @param {import("jspdf").jsPDF} pdf
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 */
export function drawPerimeterCutMarks(pdf, x, y, w, h) {
  const m = PDF_CUT_MARK_LENGTH_MM;
  const o = PDF_CUT_MARK_OFFSET_MM;
  pdf.setDrawColor(120);
  pdf.setLineWidth(0.15);

  const corners = [
    [x - o, y, x - o - m, y],
    [x + w + o, y, x + w + o + m, y],
    [x - o, y + h, x - o - m, y + h],
    [x + w + o, y + h, x + w + o + m, y + h],
    [x, y - o, x, y - o - m],
    [x + w, y - o, x + w, y - o - m],
    [x, y + h + o, x, y + h + o + m],
    [x + w, y + h + o, x + w, y + h + o + m],
  ];

  for (const [x1, y1, x2, y2] of corners) {
    pdf.line(x1, y1, x2, y2);
  }
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
 * @param {import("jspdf").jsPDF} pdf
 * @param {number} cx
 * @param {number} cy
 * @param {number} m
 */
function drawHorizontalTick(pdf, cx, cy, m) {
  pdf.line(cx - m / 2, cy, cx + m / 2, cy);
}

/**
 * @param {import("jspdf").jsPDF} pdf
 * @param {number} cx
 * @param {number} cy
 * @param {number} m
 */
function drawVerticalTick(pdf, cx, cy, m) {
  pdf.line(cx, cy - m / 2, cx, cy + m / 2);
}

/**
 * Internal crop marks on cut-line intersections only (centered in gutters).
 *
 * Vertical cuts between columns get a horizontal tick at:
 * - top and bottom of the sheet grid
 * - the center of each horizontal gutter between rows
 *
 * Horizontal cuts between rows get a vertical tick at:
 * - left and right of the sheet grid
 * - the center of each vertical gutter between columns
 *
 * @param {import("jspdf").jsPDF} pdf
 */
export function drawInternalCutMarks(pdf, layoutSettings) {
  const { marginX, marginY, gridW, gridH } = computeStickerCutLayout(layoutSettings);
  const m = PDF_CUT_MARK_LENGTH_MM;
  const o = PDF_CUT_MARK_OFFSET_MM;

  pdf.setDrawColor(120);
  pdf.setLineWidth(0.15);

  for (let col = 0; col < CARDS_PER_ROW - 1; col++) {
    const cutX = verticalGutterCenterX(col, layoutSettings);
    drawHorizontalTick(pdf, cutX, marginY - o, m);
    drawHorizontalTick(pdf, cutX, marginY + gridH + o, m);
    for (let row = 0; row < CARDS_PER_COL - 1; row++) {
      drawHorizontalTick(pdf, cutX, horizontalGutterCenterY(row, layoutSettings), m);
    }
  }

  for (let row = 0; row < CARDS_PER_COL - 1; row++) {
    const cutY = horizontalGutterCenterY(row, layoutSettings);
    drawVerticalTick(pdf, marginX - o, cutY, m);
    drawVerticalTick(pdf, marginX + gridW + o, cutY, m);
    for (let col = 0; col < CARDS_PER_ROW - 1; col++) {
      drawVerticalTick(pdf, verticalGutterCenterX(col, layoutSettings), cutY, m);
    }
  }
}

/** @param {import("jspdf").jsPDF} pdf */
export function drawSheetCutMarks(pdf, layoutSettings) {
  const { marginX, marginY, gridW, gridH } = computeStickerCutLayout(layoutSettings);
  drawPerimeterCutMarks(pdf, marginX, marginY, gridW, gridH);
  drawInternalCutMarks(pdf, layoutSettings);
}

/**
 * Internal cut mark endpoints for tests.
 * @returns {{ x1: number, y1: number, x2: number, y2: number }[]}
 */
export function internalCutMarkSegments(layoutSettings) {
  const { marginX, marginY, gridW, gridH } = computeStickerCutLayout(layoutSettings);
  const m = PDF_CUT_MARK_LENGTH_MM;
  const o = PDF_CUT_MARK_OFFSET_MM;
  /** @type {{ x1: number, y1: number, x2: number, y2: number }[]} */
  const segments = [];

  for (let col = 0; col < CARDS_PER_ROW - 1; col++) {
    const cutX = verticalGutterCenterX(col, layoutSettings);
    for (const cy of [marginY - o, marginY + gridH + o]) {
      segments.push({ x1: cutX - m / 2, y1: cy, x2: cutX + m / 2, y2: cy });
    }
    for (let row = 0; row < CARDS_PER_COL - 1; row++) {
      const cy = horizontalGutterCenterY(row, layoutSettings);
      segments.push({ x1: cutX - m / 2, y1: cy, x2: cutX + m / 2, y2: cy });
    }
  }

  for (let row = 0; row < CARDS_PER_COL - 1; row++) {
    const cutY = horizontalGutterCenterY(row, layoutSettings);
    for (const cx of [marginX - o, marginX + gridW + o]) {
      segments.push({ x1: cx, y1: cutY - m / 2, x2: cx, y2: cutY + m / 2 });
    }
    for (let col = 0; col < CARDS_PER_ROW - 1; col++) {
      const cx = verticalGutterCenterX(col, layoutSettings);
      segments.push({ x1: cx, y1: cutY - m / 2, x2: cx, y2: cutY + m / 2 });
    }
  }

  return segments;
}

/**
 * @param {number} px
 * @param {number} py
 * @param {{ x: number, y: number, w: number, h: number }} rect
 */
export function pointInsideCard(px, py, rect) {
  return px > rect.x && px < rect.x + rect.w && py > rect.y && py < rect.y + rect.h;
}
