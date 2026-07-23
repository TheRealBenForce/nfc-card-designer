#!/usr/bin/env node

import { CARD_HEIGHT_MM, CARD_WIDTH_MM } from "../src/assets/js/config.js";
import {
  computePreviewCalibrationMaxScale,
  PREVIEW_CALIBRATION_MAX_INSET_RATIO,
} from "../src/assets/js/cardSizing.js";

const wideStageMax = computePreviewCalibrationMaxScale(400, 100, CARD_WIDTH_MM, CARD_HEIGHT_MM);
const expectedWideMax = (100 / (100 * (CARD_WIDTH_MM / CARD_HEIGHT_MM))) * PREVIEW_CALIBRATION_MAX_INSET_RATIO;
if (Math.abs(wideStageMax - expectedWideMax) > 0.001) {
  throw new Error(`Wide stage max scale should match mat/card fit ratio, got ${wideStageMax}`);
}
console.log("✓ Wide mat allows zoom in until the card's smaller edge nears the mat edge");

const narrowStageMax = computePreviewCalibrationMaxScale(120, 300, CARD_WIDTH_MM, CARD_HEIGHT_MM);
if (narrowStageMax > PREVIEW_CALIBRATION_MAX_INSET_RATIO + 0.001) {
  throw new Error(`Width-limited mat max scale should stay near 100%, got ${narrowStageMax}`);
}
console.log("✓ Width-limited mat caps max scale near fit");

const squareStageMax = computePreviewCalibrationMaxScale(200, 200, CARD_WIDTH_MM, CARD_HEIGHT_MM);
if (squareStageMax <= 1) {
  throw new Error(`Square mat should allow scaling above 100%, got ${squareStageMax}`);
}
console.log("✓ Square mat allows scaling above fit when the card is height-limited");

console.log("\nAll preview calibration tests passed.");
