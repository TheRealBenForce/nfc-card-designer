#!/usr/bin/env node

import { normalizeImageTypePriority, sortTypesByPriority, movePriorityItem } from "../assets/js/imageSettings.js";

const priority = normalizeImageTypePriority(["gamePicture", "boxArt"]);
if (priority[0] !== "gamePicture") {
  throw new Error("Custom priority should preserve user order first");
}

const sorted = sortTypesByPriority(["titleScreen", "boxArt", "gamePicture"], priority);
if (sorted[0] !== "gamePicture") {
  throw new Error(`Expected gamePicture first, got ${sorted.join(",")}`);
}

const moved = movePriorityItem(["boxArt", "titleScreen", "gamePicture"], 2, -1);
if (moved.join(",") !== "boxArt,gamePicture,titleScreen") {
  throw new Error(`Unexpected move result: ${moved.join(",")}`);
}

const migrated = normalizeImageTypePriority(undefined);
if (migrated.join(",") !== "boxArt,titleScreen,gamePicture") {
  throw new Error(`Expected default priority, got ${migrated.join(",")}`);
}

console.log("✓ Image priority normalization works");
console.log("✓ Priority sort and reorder helpers work");
