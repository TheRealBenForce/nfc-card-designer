#!/usr/bin/env node

import {
  CARD_WIDTH_MM,
  CARD_HEIGHT_MM,
  LETTER_WIDTH_MM,
  LETTER_HEIGHT_MM,
  CARDS_PER_ROW,
  CARDS_PER_COL,
  PDF_CARD_GAP_MM,
  PDF_CUT_MARK_OFFSET_MM,
} from "../assets/js/config.js";
import {
  cardPositionMm,
  cardRectMm,
  computePdfGridLayout,
  gutterCutMarkSegments,
  pointInsideCard,
} from "../assets/js/pdfLayout.js";

const { gridW, gridH, marginX, marginY } = computePdfGridLayout();

if (gridW > LETTER_WIDTH_MM || gridH > LETTER_HEIGHT_MM) {
  console.error(`FAILED: 3×3 grid (${gridW}×${gridH} mm) does not fit on letter (${LETTER_WIDTH_MM}×${LETTER_HEIGHT_MM} mm)`);
  process.exit(1);
}
console.log(`✓ 3×3 grid fits on letter (${gridW}×${gridH} mm with ${PDF_CARD_GAP_MM} mm gaps)`);

const pos00 = cardPositionMm(0, 0);
const pos10 = cardPositionMm(1, 0);
const pos01 = cardPositionMm(0, 1);

const gapX = pos10.x - (pos00.x + CARD_WIDTH_MM);
const gapY = pos01.y - (pos00.y + CARD_HEIGHT_MM);

if (Math.abs(gapX - PDF_CARD_GAP_MM) > 0.01 || Math.abs(gapY - PDF_CARD_GAP_MM) > 0.01) {
  console.error(`FAILED: Expected ${PDF_CARD_GAP_MM} mm gaps, got ${gapX}×${gapY} mm`);
  process.exit(1);
}
console.log(`✓ ${PDF_CARD_GAP_MM} mm gap between cards`);

if (marginX <= 0 || marginY <= 0) {
  console.error(`FAILED: Grid margins should be positive, got ${marginX}×${marginY} mm`);
  process.exit(1);
}
console.log(`✓ Grid centered with ${marginX.toFixed(1)}×${marginY.toFixed(1)} mm margins`);

const pos22 = cardPositionMm(CARDS_PER_ROW - 1, CARDS_PER_COL - 1);
if (pos22.x + CARD_WIDTH_MM > marginX + gridW + 0.01) {
  console.error("FAILED: Last column overflows grid width");
  process.exit(1);
}
if (pos22.y + CARD_HEIGHT_MM > marginY + gridH + 0.01) {
  console.error("FAILED: Last row overflows grid height");
  process.exit(1);
}
console.log("✓ All 9 card slots fit within the sheet");

const perimeterNearestX = marginX - PDF_CUT_MARK_OFFSET_MM;
if (perimeterNearestX >= marginX) {
  console.error("FAILED: Perimeter cut marks should sit outside the grid");
  process.exit(1);
}
console.log(`✓ Perimeter cut marks inset ${PDF_CUT_MARK_OFFSET_MM} mm from grid edges`);

const cards = [];
for (let row = 0; row < CARDS_PER_COL; row++) {
  for (let col = 0; col < CARDS_PER_ROW; col++) {
    cards.push(cardRectMm(col, row));
  }
}

for (const segment of gutterCutMarkSegments()) {
  for (const px of [segment.x1, segment.x2]) {
    for (const py of [segment.y1, segment.y2]) {
      for (const card of cards) {
        if (pointInsideCard(px, py, card)) {
          console.error(
            `FAILED: Gutter cut mark (${px.toFixed(2)}, ${py.toFixed(2)}) overlaps a card interior`,
          );
          process.exit(1);
        }
      }
    }
  }
}
console.log("✓ Gutter cut marks stay outside card artwork");

console.log("\nAll PDF layout tests passed.");
