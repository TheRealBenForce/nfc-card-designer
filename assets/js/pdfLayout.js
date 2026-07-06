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
 * Crop marks centered in gutters between cards (not on card edges).
 *
 * @param {import("jspdf").jsPDF} pdf
 */
export function drawGutterCutMarks(pdf) {
  const { marginX, marginY, gap } = computePdfGridLayout();
  const m = PDF_CUT_MARK_LENGTH_MM;
  const o = PDF_CUT_MARK_OFFSET_MM;

  pdf.setDrawColor(120);
  pdf.setLineWidth(0.15);

  for (let col = 0; col < CARDS_PER_ROW - 1; col++) {
    const gutterX = marginX + (col + 1) * CARD_WIDTH_MM + col * gap + gap / 2;
    for (let row = 0; row < CARDS_PER_COL; row++) {
      const y = marginY + row * (CARD_HEIGHT_MM + gap);
      pdf.line(gutterX - m / 2, y - o, gutterX + m / 2, y - o);
      pdf.line(gutterX - m / 2, y + CARD_HEIGHT_MM + o, gutterX + m / 2, y + CARD_HEIGHT_MM + o);
    }
  }

  for (let row = 0; row < CARDS_PER_COL - 1; row++) {
    const gutterY = marginY + (row + 1) * CARD_HEIGHT_MM + row * gap + gap / 2;
    for (let col = 0; col < CARDS_PER_ROW; col++) {
      const x = marginX + col * (CARD_WIDTH_MM + gap);
      pdf.line(x - o, gutterY - m / 2, x - o, gutterY + m / 2);
      pdf.line(x + CARD_WIDTH_MM + o, gutterY - m / 2, x + CARD_WIDTH_MM + o, gutterY + m / 2);
    }
  }
}

/** @param {import("jspdf").jsPDF} pdf */
export function drawSheetCutMarks(pdf) {
  const { marginX, marginY, gridW, gridH } = computePdfGridLayout();
  drawPerimeterCutMarks(pdf, marginX, marginY, gridW, gridH);
  drawGutterCutMarks(pdf);
}

/**
 * Internal gutter mark endpoints for tests.
 * @returns {{ x1: number, y1: number, x2: number, y2: number }[]}
 */
export function gutterCutMarkSegments() {
  const { marginX, marginY, gap } = computePdfGridLayout();
  const m = PDF_CUT_MARK_LENGTH_MM;
  const o = PDF_CUT_MARK_OFFSET_MM;
  /** @type {{ x1: number, y1: number, x2: number, y2: number }[]} */
  const segments = [];

  for (let col = 0; col < CARDS_PER_ROW - 1; col++) {
    const gutterX = marginX + (col + 1) * CARD_WIDTH_MM + col * gap + gap / 2;
    for (let row = 0; row < CARDS_PER_COL; row++) {
      const y = marginY + row * (CARD_HEIGHT_MM + gap);
      segments.push(
        { x1: gutterX - m / 2, y1: y - o, x2: gutterX + m / 2, y2: y - o },
        {
          x1: gutterX - m / 2,
          y1: y + CARD_HEIGHT_MM + o,
          x2: gutterX + m / 2,
          y2: y + CARD_HEIGHT_MM + o,
        },
      );
    }
  }

  for (let row = 0; row < CARDS_PER_COL - 1; row++) {
    const gutterY = marginY + (row + 1) * CARD_HEIGHT_MM + row * gap + gap / 2;
    for (let col = 0; col < CARDS_PER_ROW; col++) {
      const x = marginX + col * (CARD_WIDTH_MM + gap);
      segments.push(
        { x1: x - o, y1: gutterY - m / 2, x2: x - o, y2: gutterY + m / 2 },
        {
          x1: x + CARD_WIDTH_MM + o,
          y1: gutterY - m / 2,
          x2: x + CARD_WIDTH_MM + o,
          y2: gutterY + m / 2,
        },
      );
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
