#!/usr/bin/env node

import {
  discNumber,
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

const saturn = parseLibretroTitle(
  "Akumajou Dracula X - Gekka no Yasoukyoku v1.400 (1998)(Konami)(NTSC)(JP)[!]",
);
if (saturn.baseTitle !== "Akumajou Dracula X - Gekka no Yasoukyoku v1.400") {
  throw new Error(`Expected Saturn TOSEC tags peeled, got: ${saturn.baseTitle}`);
}
if (stripLibretroDisplayName(saturn.baseTitle + " (1998)(Konami)(NTSC)(JP)[!]") !== "Akumajou Dracula X - Gekka no Yasoukyoku") {
  throw new Error(
    `Expected version token stripped from display, got: ${stripLibretroDisplayName("Akumajou Dracula X - Gekka no Yasoukyoku v1.400 (1998)(Konami)(NTSC)(JP)[!]")}`,
  );
}

const pce = parseLibretroTitle("3x3 Eyes - Sanjiyan Hensei (NEC) (Japan)[HE100523-1]");
if (pce.baseTitle !== "3x3 Eyes - Sanjiyan Hensei") {
  throw new Error(`Expected publisher/serial peeled, got: ${pce.baseTitle}`);
}

const translation = parseLibretroTitle(
  "Chaos Seed - Feng Shui Chronicles (Japan) [T-En by Dynamic Designs v1.02] [n]",
);
if (translation.baseTitle !== "Chaos Seed - Feng Shui Chronicles") {
  throw new Error(`Expected bracket tags peeled, got: ${translation.baseTitle}`);
}
if (translation.tags.join("|") !== "Japan|T-En by Dynamic Designs v1.02|n") {
  throw new Error(`Unexpected translation tags: ${translation.tags.join("|")}`);
}

// In-title parentheses must remain (lowest-risk rule).
if (stripLibretroDisplayName("GS (Ghost Sweeper) Mikami (Japan)") !== "GS (Ghost Sweeper) Mikami") {
  throw new Error("Expected in-title parentheses to remain");
}

const discParsed = parseLibretroTitle("Rampo v1.000 (1995)(Sega)(NTSC)(JP)(Disc 1 of 2)[!]");
if (discNumber(discParsed.tags) !== 1) {
  throw new Error(`Expected disc 1, got ${discNumber(discParsed.tags)}`);
}
if (discNumber(parseLibretroTitle("Game (Disc 2 of 2)").tags) !== 2) {
  throw new Error("Expected disc 2");
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
if (regionPriorityScore(parseLibretroTitle("Game (US)").tags) <= regionPriorityScore(parseLibretroTitle("Game (JP)").tags)) {
  throw new Error("US should outrank JP");
}

if (revisionNumber(["Rev 2"]) <= revisionNumber(["Rev 1"])) {
  throw new Error("Rev 2 should sort after Rev 1");
}
if (revisionNumber([]) !== 0) {
  throw new Error("No revision tag should be 0");
}

console.log("✓ parseLibretroTitle extracts base title and tags");
console.log("✓ stripLibretroDisplayName removes trailing metadata and Neo Geo catalog IDs");
console.log("✓ stripLibretroDisplayName peels brackets and TOSEC stacks");
console.log("✓ stripLibretroDisplayName strips trailing version tokens");
console.log("✓ stripLibretroDisplayName normalizes alternate-title underscores to dashes");
console.log("✓ stripLibretroDisplayName keeps in-title parentheses");
console.log("✓ regionPriorityScore prefers USA > World > Europe > country > Japan");
console.log("✓ revisionNumber and discNumber rank revisions/discs");
