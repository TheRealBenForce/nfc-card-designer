#!/usr/bin/env node
/**
 * Ensures card artwork resolves using platform + RA game id, not RA id alone.
 */

import { gameByPlatformAndRaId, gameForCard, gamesForPlatform } from "../assets/js/data/games.js";
import { candidateImagePaths } from "../assets/js/imageProvider.js";

const nesGames = gamesForPlatform("nes");
if (nesGames.length === 0) {
  throw new Error("Expected at least one NES game in catalog");
}
const sampleNesGame = nesGames[0];

const card = {
  id: "test",
  platformId: "nes",
  gameName: sampleNesGame.name,
  raGameId: sampleNesGame.raGameId,
  imageType: "boxArt",
};

const byPlatformAndId = gameByPlatformAndRaId("nes", sampleNesGame.raGameId);
if (!byPlatformAndId || byPlatformAndId.name !== sampleNesGame.name) {
  throw new Error("Expected gameByPlatformAndRaId to return the NES sample game");
}

const game = gameForCard(card);
if (!game || game.platformId !== "nes") {
  throw new Error("gameForCard should return the NES catalog entry");
}

const paths = candidateImagePaths(card, game, "boxArt");
if (!paths[0].includes(`/platforms/nes/games/${sampleNesGame.raGameId}/`)) {
  throw new Error(`Platform-specific path should be first, got: ${paths[0]}`);
}

if (!paths.some((path) => path.includes(`assets/images/games/${sampleNesGame.raGameId}-boxArt.png`))) {
  throw new Error("Expected legacy fallback path to remain in candidates");
}

console.log("✓ Image lookup uses platform + RA game id");
console.log("✓ Platform-specific image path is preferred");
