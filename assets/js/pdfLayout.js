import {
  CARD_WIDTH_MM,
  CARD_HEIGHT_MM,
  LETTER_WIDTH_MM,
  LETTER_HEIGHT_MM,
  CARDS_PER_ROW,
  CARDS_PER_COL,
  PDF_CARD_GAP_MM,
  PDF_CUT_MARK_LENGTH_MM,
  PDF_CUT_MARK_OFFSET_MM,
} from "./config.js";

/** Layout math for the letter-size PDF grid (exported for tests). */
export function computePdfGridLayout() {
  const gridW = CARDS_PER_ROW * CARD_WIDTH_MM + (CARDS_PER_ROW - 1) * PDF_CARD_GAP_MM;
  const gridH = CARDS_PER_COL * CARD_HEIGHT_MM + (CARDS_PER_COL - 1) * PDF_CARD_GAP_MM;
  const marginX = (LETTER_WIDTH_MM - gridW) / 2;
  const marginY = (LETTER_HEIGHT_MM - gridH) / 2;

  return { gridW, gridH, marginX, marginY, gap: PDF_CARD_GAP_MM };
}

/**
 * @param {number} col
 * @param {number} row
 */
export function cardPositionMm(col, row) {
  const { marginX, marginY, gap } = computePdfGridLayout();
  return {
    x: marginX + col * (CARD_WIDTH_MM + gap),
    y: marginY + row * (CARD_HEIGHT_MM + gap),
  };
}

/**
 * @param {number} col
 * @param {number} row
 */
export function cardRectMm(col, row) {
  const { x, y } = cardPositionMm(col, row);
  return { x, y, w: CARD_WIDTH_MM, h: CARD_HEIGHT_MM };
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
export function verticalGutterCenterX(col) {
  const { marginX, gap } = computePdfGridLayout();
  return marginX + (col + 1) * CARD_WIDTH_MM + col * gap + gap / 2;
}

/**
 * Y coordinate at the center of the horizontal gutter between two rows.
 * @param {number} row Top row index (0 or 1 for a 3-row grid).
 */
export function horizontalGutterCenterY(row) {
  const { marginY, gap } = computePdfGridLayout();
  return marginY + (row + 1) * CARD_HEIGHT_MM + row * gap + gap / 2;
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
export function drawInternalCutMarks(pdf) {
  const { marginX, marginY, gridW, gridH } = computePdfGridLayout();
  const m = PDF_CUT_MARK_LENGTH_MM;
  const o = PDF_CUT_MARK_OFFSET_MM;

  pdf.setDrawColor(120);
  pdf.setLineWidth(0.15);

  for (let col = 0; col < CARDS_PER_ROW - 1; col++) {
    const cutX = verticalGutterCenterX(col);
    drawHorizontalTick(pdf, cutX, marginY - o, m);
    drawHorizontalTick(pdf, cutX, marginY + gridH + o, m);
    for (let row = 0; row < CARDS_PER_COL - 1; row++) {
      drawHorizontalTick(pdf, cutX, horizontalGutterCenterY(row), m);
    }
  }

  for (let row = 0; row < CARDS_PER_COL - 1; row++) {
    const cutY = horizontalGutterCenterY(row);
    drawVerticalTick(pdf, marginX - o, cutY, m);
    drawVerticalTick(pdf, marginX + gridW + o, cutY, m);
    for (let col = 0; col < CARDS_PER_ROW - 1; col++) {
      drawVerticalTick(pdf, verticalGutterCenterX(col), cutY, m);
    }
  }
}

/** @param {import("jspdf").jsPDF} pdf */
export function drawSheetCutMarks(pdf) {
  const { marginX, marginY, gridW, gridH } = computePdfGridLayout();
  drawPerimeterCutMarks(pdf, marginX, marginY, gridW, gridH);
  drawInternalCutMarks(pdf);
}

/**
 * Internal cut mark endpoints for tests.
 * @returns {{ x1: number, y1: number, x2: number, y2: number }[]}
 */
export function internalCutMarkSegments() {
  const { marginX, marginY, gridW, gridH } = computePdfGridLayout();
  const m = PDF_CUT_MARK_LENGTH_MM;
  const o = PDF_CUT_MARK_OFFSET_MM;
  /** @type {{ x1: number, y1: number, x2: number, y2: number }[]} */
  const segments = [];

  for (let col = 0; col < CARDS_PER_ROW - 1; col++) {
    const cutX = verticalGutterCenterX(col);
    for (const cy of [marginY - o, marginY + gridH + o]) {
      segments.push({ x1: cutX - m / 2, y1: cy, x2: cutX + m / 2, y2: cy });
    }
    for (let row = 0; row < CARDS_PER_COL - 1; row++) {
      const cy = horizontalGutterCenterY(row);
      segments.push({ x1: cutX - m / 2, y1: cy, x2: cutX + m / 2, y2: cy });
    }
  }

  for (let row = 0; row < CARDS_PER_COL - 1; row++) {
    const cutY = horizontalGutterCenterY(row);
    for (const cx of [marginX - o, marginX + gridW + o]) {
      segments.push({ x1: cx, y1: cutY - m / 2, x2: cx, y2: cutY + m / 2 });
    }
    for (let col = 0; col < CARDS_PER_ROW - 1; col++) {
      const cx = verticalGutterCenterX(col);
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
