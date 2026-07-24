#!/usr/bin/env node

import {
  CARD_WIDTH_MM,
  CARD_HEIGHT_MM,
  DEFAULT_STICKER_INSET_MM,
  LETTER_WIDTH_MM,
  LETTER_HEIGHT_MM,
  CARDS_PER_ROW,
  CARDS_PER_COL,
  PDF_CARD_GAP_MM,
  PDF_CUT_MARK_LENGTH_MM,
  PDF_CUT_MARK_OFFSET_MM,
} from "../src/assets/js/config.js";
import {
  cardPositionMm,
  computePdfGridLayout,
  computeStickerCutLayout,
  pointInsideCard,
  horizontalGutterCenterY,
  verticalGutterCenterX,
  stickerRectMm,
  stickerVerticalCutXs,
  stickerHorizontalCutYs,
  stickerCutLineSegments,
} from "../src/assets/js/pdfLayout.js";

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

const stickerLayout = computeStickerCutLayout();
if (
  Math.abs(stickerLayout.marginX - (marginX + DEFAULT_STICKER_INSET_MM)) > 0.01
  || Math.abs(stickerLayout.gridW - (gridW - 2 * DEFAULT_STICKER_INSET_MM)) > 0.01
) {
  console.error("FAILED: Sticker cut layout should inset the card grid by sticker inset");
  process.exit(1);
}
console.log(`✓ Sticker cut grid inset ${DEFAULT_STICKER_INSET_MM} mm within card slots`);

const stickers = [];
for (let row = 0; row < CARDS_PER_COL; row++) {
  for (let col = 0; col < CARDS_PER_ROW; col++) {
    stickers.push(stickerRectMm(col, row));
  }
}

const cutXs = stickerVerticalCutXs();
const cutYs = stickerHorizontalCutYs();

if (cutXs.length !== CARDS_PER_ROW * 2 || cutYs.length !== CARDS_PER_COL * 2) {
  console.error("FAILED: Expected left/right cut lines per column and top/bottom per row");
  process.exit(1);
}

for (let col = 0; col < CARDS_PER_ROW; col++) {
  const sticker = stickerRectMm(col, 0);
  if (
    Math.abs(cutXs[col * 2] - sticker.x) > 0.01
    || Math.abs(cutXs[col * 2 + 1] - (sticker.x + sticker.w)) > 0.01
  ) {
    console.error(`FAILED: Vertical cut lines for column ${col} should match sticker edges`);
    process.exit(1);
  }
}

for (let row = 0; row < CARDS_PER_COL; row++) {
  const sticker = stickerRectMm(0, row);
  if (
    Math.abs(cutYs[row * 2] - sticker.y) > 0.01
    || Math.abs(cutYs[row * 2 + 1] - (sticker.y + sticker.h)) > 0.01
  ) {
    console.error(`FAILED: Horizontal cut lines for row ${row} should match sticker edges`);
    process.exit(1);
  }
}
console.log("✓ Cut lines align to every sticker edge");

if (
  Math.abs(cutXs[0] - stickerLayout.marginX) > 0.01
  || Math.abs(cutXs[cutXs.length - 1] - (stickerLayout.marginX + stickerLayout.gridW)) > 0.01
  || Math.abs(cutYs[0] - stickerLayout.marginY) > 0.01
  || Math.abs(cutYs[cutYs.length - 1] - (stickerLayout.marginY + stickerLayout.gridH)) > 0.01
) {
  console.error("FAILED: Outer cut lines should match the outer sticker bounds");
  process.exit(1);
}
console.log("✓ Outer cut lines match the sticker grid bounds");

const gutterCutX = verticalGutterCenterX(0);
if (cutXs.some((x) => Math.abs(x - gutterCutX) < 0.01)) {
  console.error("FAILED: Cut lines must not use card-gutter centers");
  process.exit(1);
}
const gutterCutY = horizontalGutterCenterY(0);
if (cutYs.some((y) => Math.abs(y - gutterCutY) < 0.01)) {
  console.error("FAILED: Cut lines must not use card-gutter centers");
  process.exit(1);
}
console.log("✓ Cut lines are sticker edges, not gutter centers");

const segments = stickerCutLineSegments();
const extend = PDF_CUT_MARK_OFFSET_MM + PDF_CUT_MARK_LENGTH_MM;
const verticalSegments = segments.filter((s) => Math.abs(s.x1 - s.x2) < 0.01);
const horizontalSegments = segments.filter((s) => Math.abs(s.y1 - s.y2) < 0.01);

if (verticalSegments.length !== cutXs.length || horizontalSegments.length !== cutYs.length) {
  console.error("FAILED: Expected one continuous segment per sticker edge");
  process.exit(1);
}

for (const segment of verticalSegments) {
  if (
    Math.abs(segment.y1 - (stickerLayout.marginY - extend)) > 0.01
    || Math.abs(segment.y2 - (stickerLayout.marginY + stickerLayout.gridH + extend)) > 0.01
  ) {
    console.error("FAILED: Vertical cut lines should run continuously through the sticker grid");
    process.exit(1);
  }
  // Midpoint must sit on a sticker border or in a gap/bleed corridor at that X —
  // specifically, the line must pass through each column sticker's top bleed.
  const midY = stickerRectMm(0, 0).y - DEFAULT_STICKER_INSET_MM / 2; // in top bleed
  if (!cutXs.some((x) => Math.abs(x - segment.x1) < 0.01)) {
    console.error("FAILED: Vertical segment X must be a sticker edge");
    process.exit(1);
  }
  if (!(segment.y1 < midY && midY < segment.y2)) {
    console.error("FAILED: Vertical cut line should pass through card bleed");
    process.exit(1);
  }
}

for (const segment of horizontalSegments) {
  if (
    Math.abs(segment.x1 - (stickerLayout.marginX - extend)) > 0.01
    || Math.abs(segment.x2 - (stickerLayout.marginX + stickerLayout.gridW + extend)) > 0.01
  ) {
    console.error("FAILED: Horizontal cut lines should run continuously through the sticker grid");
    process.exit(1);
  }
}
console.log("✓ Cut lines are continuous through bleed, borders, and gaps");

// Lines sit on sticker borders; endpoints should not land inside sticker faces.
for (const segment of segments) {
  for (const [px, py] of [
    [segment.x1, segment.y1],
    [segment.x2, segment.y2],
  ]) {
    for (const sticker of stickers) {
      if (pointInsideCard(px, py, sticker)) {
        console.error(
          `FAILED: Cut line endpoint (${px.toFixed(2)}, ${py.toFixed(2)}) overlaps a sticker interior`,
        );
        process.exit(1);
      }
    }
  }
}
console.log("✓ Cut line endpoints stay outside sticker interiors");

const rowGapY = horizontalGutterCenterY(0);
const expectedGapY = marginY + CARD_HEIGHT_MM + PDF_CARD_GAP_MM / 2;
if (Math.abs(rowGapY - expectedGapY) > 0.01) {
  console.error("FAILED: Horizontal gutter placement should stay centered between rows");
  process.exit(1);
}
const colGapX = verticalGutterCenterX(0);
const expectedGapX = marginX + CARD_WIDTH_MM + PDF_CARD_GAP_MM / 2;
if (Math.abs(colGapX - expectedGapX) > 0.01) {
  console.error("FAILED: Vertical gutter placement should stay centered between columns");
  process.exit(1);
}
console.log("✓ Gutter centers remain available for layout math");

console.log("\nAll PDF layout tests passed.");
