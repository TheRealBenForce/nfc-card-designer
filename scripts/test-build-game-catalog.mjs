#!/usr/bin/env node

import {
  parseBoxartNamesFromTree,
  filterRetailBoxartNames,
  prefixFolderTreePaths,
  withTreeRetries,
} from "./build-game-catalog.mjs";
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

const prefixed = prefixFolderTreePaths("Named_Boxarts", [
  { path: "Pac-Man (USA).png", type: "blob" },
  { path: "nested/Galaga (Japan).png", type: "blob" },
  { path: "readme.txt", type: "blob" },
]);
if (!prefixed.some((entry) => entry.path === "Named_Boxarts/Pac-Man (USA).png")) {
  throw new Error("Expected flat folder entries to be prefixed");
}
if (!prefixed.some((entry) => entry.path === "Named_Boxarts/Galaga (Japan).png")) {
  throw new Error("Expected nested folder entries to use basename with folder prefix");
}

let attempts = 0;
const recovered = await withTreeRetries(
  async () => {
    attempts += 1;
    if (attempts < 2) throw new Error("GitHub tree FBNeo_-_Arcade_Games: 500 Internal Server Error");
    return ["ok"];
  },
  { baseMs: 0 },
);
if (recovered[0] !== "ok" || attempts !== 2) {
  throw new Error(`Expected retry recovery, got attempts=${attempts} result=${recovered}`);
}

let hardFailAttempts = 0;
let hardFailed = false;
try {
  await withTreeRetries(
    async () => {
      hardFailAttempts += 1;
      throw new Error("GitHub tree demo: 404 Not Found");
    },
    { baseMs: 0 },
  );
} catch {
  hardFailed = true;
}
if (!hardFailed || hardFailAttempts !== 1) {
  throw new Error("Non-retryable errors should fail immediately");
}

console.log("✓ parseBoxartNamesFromTree extracts Named_Boxarts stems");
console.log("✓ filterRetailBoxartNames applies retail rules and regional dedupe");
console.log("✓ prefixFolderTreePaths rewrites per-folder trees for artwork indexing");
console.log("✓ withTreeRetries retries transient GitHub 5xx failures");
