#!/usr/bin/env node

import { mapDisplayAlignmentToRotatedAlignment } from "../assets/js/cardRenderer.js";

/**
 * @param {{ x: number, y: number }} actual
 * @param {{ x: number, y: number }} expected
 * @param {string} label
 */
function expectPoint(actual, expected, label) {
  if (actual.x !== expected.x || actual.y !== expected.y) {
    throw new Error(
      `${label}: expected (${expected.x}, ${expected.y}), got (${actual.x}, ${actual.y})`,
    );
  }
}

// Unrotated mapping should be identity.
expectPoint(
  mapDisplayAlignmentToRotatedAlignment({ x: 1, y: 0 }, 0),
  { x: 1, y: 0 },
  "0° keeps upper-right pinned",
);

// 90° clockwise: upper-right in display maps to local upper-left.
expectPoint(
  mapDisplayAlignmentToRotatedAlignment({ x: 1, y: 0 }, 90),
  { x: 0, y: 0 },
  "90° remaps upper-right correctly",
);
expectPoint(
  mapDisplayAlignmentToRotatedAlignment({ x: 0, y: 0 }, 90),
  { x: 0, y: 1 },
  "90° remaps upper-left correctly",
);

// 180°: corners invert.
expectPoint(
  mapDisplayAlignmentToRotatedAlignment({ x: 1, y: 0 }, 180),
  { x: 0, y: 1 },
  "180° remaps upper-right correctly",
);

// 270° clockwise (or -90°): opposite quarter-turn mapping.
expectPoint(
  mapDisplayAlignmentToRotatedAlignment({ x: 1, y: 0 }, 270),
  { x: 1, y: 1 },
  "270° remaps upper-right correctly",
);
expectPoint(
  mapDisplayAlignmentToRotatedAlignment({ x: 1, y: 0 }, -90),
  { x: 1, y: 1 },
  "-90° remaps upper-right correctly",
);

console.log("✓ Artwork alignment remains display-relative across rotations");
