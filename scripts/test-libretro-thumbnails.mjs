#!/usr/bin/env node

import {
  libretroFilenameCandidates,
  libretroThumbnailUrl,
  libretroTitleVariants,
  normalizeLibretroTitle,
  pickLibretroFilename,
  scoreLibretroFilename,
} from "../assets/js/libretroThumbnails.js";
import { resolveLibretroFilename } from "./libretro-thumbnails.mjs";

const pacManCandidates = libretroFilenameCandidates("Pac-Man");
if (!pacManCandidates.includes("Pac-Man (USA)")) {
  throw new Error("Expected Pac-Man (USA) in filename candidates");
}

const url = libretroThumbnailUrl("Atari - 2600", "Named_Boxarts", "Pac-Man (USA)");
if (!url.includes("Pac-Man%20(USA).png")) {
  throw new Error(`Unexpected libretro URL: ${url}`);
}

const listing = [
  "Jr. Pac-Man (USA).png",
  "Ms. Pac-Man (USA).png",
  "Pac-Man (USA).png",
  "Pac-Man (Europe).png",
];
const picked = pickLibretroFilename("Pac-Man", listing);
if (picked !== "Pac-Man (USA)") {
  throw new Error(`Expected Pac-Man (USA), got ${picked}`);
}

if (scoreLibretroFilename("Pac-Man", "Pac-Man [b].png") >= 0) {
  throw new Error("Hack dumps should not prefix-match retail titles");
}

const marioListing = [
  "Super Mario Bros. + Duck Hunt (USA).png",
  "Super Mario Bros. (World).png",
  "Super Mario Bros. (19xx)(-)[h][p][no title].png",
];
const marioPicked = pickLibretroFilename("Super Mario Bros.", marioListing);
if (marioPicked !== "Super Mario Bros. (World)") {
  throw new Error(`Expected Super Mario Bros. (World), got ${marioPicked}`);
}

const pitfallListing = ["Pitfall II - Lost Caverns (USA).png", "Pitfall! - Pitfall Harry's Jungle Adventure (USA).png"];
const pitfallPicked = pickLibretroFilename("Pitfall!", pitfallListing);
if (pitfallPicked !== "Pitfall! - Pitfall Harry's Jungle Adventure (USA)") {
  throw new Error(`Expected Pitfall! extended title, got ${pitfallPicked}`);
}

const resolved = await resolveLibretroFilename(
  "Atari - 2600",
  "boxArt",
  "Pac-Man",
  undefined,
);
if (resolved !== "Pac-Man (USA)") {
  throw new Error(`Expected live resolve for Pac-Man, got ${resolved}`);
}

if (!libretroTitleVariants("The Legend of Zelda").includes("Legend of Zelda, The")) {
  throw new Error('Expected "The Legend of Zelda" to produce "Legend of Zelda, The" variant');
}

if (normalizeLibretroTitle("The Legend of Zelda") !== normalizeLibretroTitle("Legend of Zelda, The (USA)")) {
  throw new Error("Normalized Zelda titles should match");
}

const zeldaListing = [
  "Legend of Zelda, The (USA).png",
  "Legend of Zelda, The (Europe).png",
  "Zelda II - The Adventure of Link (USA).png",
];
const zeldaPicked = pickLibretroFilename("The Legend of Zelda", zeldaListing);
if (zeldaPicked !== "Legend of Zelda, The (USA)") {
  throw new Error(`Expected Legend of Zelda, The (USA), got ${zeldaPicked}`);
}

const midwayCandidates = libretroFilenameCandidates("1943: The Battle of Midway");
if (!midwayCandidates.some((c) => c.startsWith("1943 - The Battle of Midway"))) {
  throw new Error("Expected colon-to-dash variant for 1943");
}

const midwayResolved = await resolveLibretroFilename(
  "Nintendo - Nintendo Entertainment System",
  "boxArt",
  "1943: The Battle of Midway",
);
if (!midwayResolved || !midwayResolved.includes("1943 - The Battle of Midway")) {
  throw new Error(`Expected live resolve for 1943, got ${midwayResolved}`);
}

const zeldaResolved = await resolveLibretroFilename(
  "Nintendo - Nintendo Entertainment System",
  "boxArt",
  "The Legend of Zelda",
);
if (!zeldaResolved || !zeldaResolved.startsWith("Legend of Zelda, The")) {
  throw new Error(`Expected live resolve for Zelda, got ${zeldaResolved}`);
}

console.log("✓ Libretro filename candidates and scoring");
console.log("✓ Libretro thumbnail URLs are built correctly");
console.log("✓ Live CDN resolve finds Pac-Man (USA)");
console.log("✓ NES title variants resolve Zelda and 1943");
