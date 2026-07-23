#!/usr/bin/env node

import { CARD_HEIGHT_MM, CARD_WIDTH_MM } from "../src/assets/js/config.js";
import {
  computePreviewCalibrationMaxScale,
  PREVIEW_CALIBRATION_MAX_INSET_RATIO,
  PREVIEW_CALIBRATION_MIN_SCALE,
} from "../src/assets/js/cardSizing.js";

function expectedMax(stageWidth, stageHeight, cardWidthMm, cardHeightMm) {
  const aspect = cardWidthMm / cardHeightMm;
  const fitWidth = Math.min(stageWidth, stageHeight * aspect);
  const fitHeight = fitWidth / aspect;
  return Math.min(stageWidth / fitWidth, stageHeight / fitHeight) * PREVIEW_CALIBRATION_MAX_INSET_RATIO;
}

const wideStageMax = computePreviewCalibrationMaxScale(400, 100, CARD_WIDTH_MM, CARD_HEIGHT_MM);
if (Math.abs(wideStageMax - expectedMax(400, 100, CARD_WIDTH_MM, CARD_HEIGHT_MM)) > 0.001) {
  throw new Error(`Wide stage max scale should match height limit, got ${wideStageMax}`);
}
if (wideStageMax > PREVIEW_CALIBRATION_MAX_INSET_RATIO + 0.001) {
  throw new Error(`Wide stage max scale should stay inside the mat, got ${wideStageMax}`);
}
console.log("✓ Wide mat caps max scale at the limiting edge");

const narrowStageMax = computePreviewCalibrationMaxScale(120, 300, CARD_WIDTH_MM, CARD_HEIGHT_MM);
if (Math.abs(narrowStageMax - expectedMax(120, 300, CARD_WIDTH_MM, CARD_HEIGHT_MM)) > 0.001) {
  throw new Error(`Narrow stage max scale mismatch, got ${narrowStageMax}`);
}
if (narrowStageMax > PREVIEW_CALIBRATION_MAX_INSET_RATIO + 0.001) {
  throw new Error(`Width-limited mat max scale should stay near fit, got ${narrowStageMax}`);
}
console.log("✓ Width-limited mat caps max scale near fit");

const squareStageMax = computePreviewCalibrationMaxScale(200, 200, CARD_WIDTH_MM, CARD_HEIGHT_MM);
if (Math.abs(squareStageMax - expectedMax(200, 200, CARD_WIDTH_MM, CARD_HEIGHT_MM)) > 0.001) {
  throw new Error(`Square stage max scale mismatch, got ${squareStageMax}`);
}
if (squareStageMax > PREVIEW_CALIBRATION_MAX_INSET_RATIO + 0.001) {
  throw new Error(`Square mat max scale should stay inside the mat, got ${squareStageMax}`);
}
console.log("✓ Square mat caps max scale at the limiting edge");

const floored = computePreviewCalibrationMaxScale(10, 10, CARD_WIDTH_MM, CARD_HEIGHT_MM);
if (floored < PREVIEW_CALIBRATION_MIN_SCALE) {
  throw new Error(`Tiny stage max scale should not drop below min, got ${floored}`);
}
console.log("✓ Tiny stage max scale respects the minimum");

console.log("\nAll preview calibration tests passed.");
