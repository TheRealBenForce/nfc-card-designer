#!/usr/bin/env node

import { parseBoxartNamesFromTree, filterRetailBoxartNames } from "./build-game-catalog.mjs";
import { buildArtworkIndex } from "./region-dedup.mjs";

const tree = [
  { path: "Named_Boxarts/Super Mario Bros. (USA).png", type: "blob" },
  { path: "Named_Boxarts/Super Mario Bros. (Europe).png", type: "blob" },
  { path: "Named_Boxarts/Super Mario Bros. ~Hack~.png", type: "blob" },
  { path: "Named_Boxarts/Dr. Mario (World) (Beta).png", type: "blob" },
  { path: "Named_Titles/Super Mario Bros. (USA).png", type: "blob" },
  { path: "Named_Snaps/Super Mario Bros. (USA).png", type: "blob" },
  { path: "Named_Titles/Super Mario Bros. (USA).png", type: "blob" },
  { path: "README.md", type: "blob" },
];

const parsed = parseBoxartNamesFromTree(tree);
if (!parsed.includes("Super Mario Bros. (USA)")) {
  throw new Error("Expected Super Mario Bros. (USA) in parsed boxart names");
}
if (parsed.includes("README.md")) {
  throw new Error("Should not parse non-boxart paths");
}

const artworkIndex = buildArtworkIndex(tree);
const filtered = filterRetailBoxartNames(parsed, artworkIndex);
if (!filtered.includes("Super Mario Bros. (USA)")) {
  throw new Error("Expected retail title to remain after filter");
}
if (filtered.includes("Super Mario Bros. (Europe)")) {
  throw new Error("Expected duplicate regional variant to be removed");
}
if (filtered.some((name) => name.includes("~Hack~"))) {
  throw new Error("Expected non-retail titles to be filtered out");
}
if (filtered.some((name) => name.includes("(Beta)"))) {
  throw new Error("Expected beta titles to be filtered out");
}

console.log("✓ parseBoxartNamesFromTree extracts Named_Boxarts stems");
console.log("✓ filterRetailBoxartNames applies retail rules and regional dedupe");
