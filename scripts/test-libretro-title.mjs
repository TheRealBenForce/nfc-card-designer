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

const androParsed = parseLibretroTitle("Andro Dunos (NGM-049)(NGH-049)");
if (androParsed.baseTitle !== "Andro Dunos") {
  throw new Error(`Expected Neo Geo catalog IDs to be stripped, got: ${androParsed.baseTitle}`);
}
if (androParsed.tags.join("|") !== "NGM-049|NGH-049") {
  throw new Error(`Unexpected Neo Geo tags: ${androParsed.tags.join("|")}`);
}
if (stripLibretroDisplayName("Andro Dunos (NGM-049)(NGH-049)") !== "Andro Dunos") {
  throw new Error("Expected Neo Geo catalog IDs removed from display name");
}

if (stripLibretroDisplayName("Aero Fighters 2 _ Sonic Wings 2") !== "Aero Fighters 2 - Sonic Wings 2") {
  throw new Error("Expected spaced underscores to become dashes in display name");
}

const chainedRegion = parseLibretroTitle("Burning Fight (NGH-018)(US)");
if (chainedRegion.baseTitle !== "Burning Fight") {
  throw new Error(`Expected chained trailing tags to peel, got: ${chainedRegion.baseTitle}`);
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
console.log("✓ stripLibretroDisplayName removes trailing metadata and Neo Geo catalog IDs");
console.log("✓ stripLibretroDisplayName normalizes alternate-title underscores to dashes");
console.log("✓ regionPriorityScore prefers USA > World > Europe > country > Japan");
console.log("✓ revisionNumber ranks revisions");
