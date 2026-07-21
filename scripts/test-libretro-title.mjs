#!/usr/bin/env node

import {
  parseLibretroTitle,
  regionPriorityScore,
  revisionNumber,
  stripLibretroDisplayName,
} from "../src/assets/js/libretroTitle.js";

const linkParsed = parseLibretroTitle("Legend of Zelda, The - Link's Awakening (USA, Europe) (Rev 2)");
if (linkParsed.baseTitle !== "Legend of Zelda, The - Link's Awakening") {
  throw new Error(`Unexpected base title: ${linkParsed.baseTitle}`);
}
if (linkParsed.tags.join("|") !== "USA, Europe|Rev 2") {
  throw new Error(`Unexpected tags: ${linkParsed.tags.join("|")}`);
}

if (stripLibretroDisplayName("Doom (Europe)") !== "Doom") {
  throw new Error("Expected stripped display name");
}

if (regionPriorityScore(parseLibretroTitle("Game (USA)").tags) <= regionPriorityScore(parseLibretroTitle("Game (World)").tags)) {
  throw new Error("USA should outrank World");
}
if (regionPriorityScore(parseLibretroTitle("Game (World)").tags) <= regionPriorityScore(parseLibretroTitle("Game (Europe)").tags)) {
  throw new Error("World should outrank Europe");
}
if (regionPriorityScore(parseLibretroTitle("Game (Europe)").tags) <= regionPriorityScore(parseLibretroTitle("Game (Germany)").tags)) {
  throw new Error("Europe should outrank Germany");
}
if (regionPriorityScore(parseLibretroTitle("Game (Germany)").tags) <= regionPriorityScore(parseLibretroTitle("Game (Japan)").tags)) {
  throw new Error("Germany should outrank Japan");
}

if (revisionNumber(["Rev 2"]) <= revisionNumber(["Rev 1"])) {
  throw new Error("Rev 2 should sort after Rev 1");
}
if (revisionNumber([]) !== 0) {
  throw new Error("No revision tag should be 0");
}

console.log("✓ parseLibretroTitle extracts base title and tags");
console.log("✓ stripLibretroDisplayName removes trailing metadata");
console.log("✓ regionPriorityScore prefers USA > World > Europe > country > Japan");
console.log("✓ revisionNumber ranks revisions");
