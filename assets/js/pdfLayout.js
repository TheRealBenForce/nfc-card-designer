import {
  CARD_WIDTH_MM,
  CARD_HEIGHT_MM,
  LETTER_WIDTH_MM,
  LETTER_HEIGHT_MM,
  CARDS_PER_ROW,
  CARDS_PER_COL,
  PDF_CARD_GAP_MM,
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
