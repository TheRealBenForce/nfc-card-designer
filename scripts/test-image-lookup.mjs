#!/usr/bin/env node
/**
 * Ensures card artwork resolves using platform + RA game id, not RA id alone.
 */

import { gameByPlatformAndRaId, gameForCard, gameByRaId } from "../assets/js/data/games.js";
import { candidateImagePaths } from "../assets/js/imageProvider.js";

const nesMario = gameByPlatformAndRaId("nes", 2286);
if (!nesMario || nesMario.name !== "Super Mario Bros.") {
  throw new Error("Expected Super Mario Bros. on NES");
}

const card = {
  id: "test",
  platformId: "nes",
  gameName: "Super Mario Bros.",
  raGameId: 2286,
  imageType: "boxArt",
};

const game = gameForCard(card);
if (!game || game.platformId !== "nes") {
  throw new Error("gameForCard should return the NES catalog entry");
}

const paths = candidateImagePaths(card, game, "boxArt");
if (!paths[0].includes("/platforms/nes/games/2286/")) {
  throw new Error(`Platform-specific path should be first, got: ${paths[0]}`);
}

if (gameByRaId(2286)?.platformId !== "nes") {
  throw new Error("Starter catalog should keep Mario on NES");
}

console.log("✓ Image lookup uses platform + RA game id");
console.log("✓ Platform-specific image path is preferred");
