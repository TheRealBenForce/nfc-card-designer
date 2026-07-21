#!/usr/bin/env node

import { parseBoxartNamesFromTree, filterRetailBoxartNames } from "./build-game-catalog.mjs";

const tree = [
  { path: "Named_Boxarts/Super Mario Bros. (USA).png", type: "blob" },
  { path: "Named_Boxarts/Super Mario Bros. ~Hack~.png", type: "blob" },
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

const filtered = filterRetailBoxartNames(parsed);
if (!filtered.includes("Super Mario Bros. (USA)")) {
  throw new Error("Expected retail title to remain after filter");
}
if (filtered.some((name) => name.includes("~Hack~"))) {
  throw new Error("Expected non-retail titles to be filtered out");
}

console.log("✓ parseBoxartNamesFromTree extracts Named_Boxarts stems");
console.log("✓ filterRetailBoxartNames applies retail rules");
