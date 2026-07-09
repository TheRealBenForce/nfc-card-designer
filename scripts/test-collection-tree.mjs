#!/usr/bin/env node

import { buildCollectionTree } from "../src/assets/js/collectionTree.js";

const cards = [
  { id: "1", platformId: "nes", gameName: "Zelda (USA)", libretroName: "Zelda (USA)", imageType: "boxArt" },
  { id: "2", platformId: "nes", gameName: "Mario (USA)", libretroName: "Mario (USA)", imageType: "titleScreen" },
  { id: "3", platformId: "nes", gameName: "Mario (USA)", libretroName: "Mario (USA)", imageType: "boxArt" },
  { id: "4", platformId: "snes", gameName: "Metroid (USA)", libretroName: "Metroid (USA)", imageType: "boxArt" },
];

const tree = buildCollectionTree(cards);

if (tree.length !== 2) {
  console.error(`FAILED: Expected 2 platforms, got ${tree.length}`);
  process.exit(1);
}

const nes = tree.find((group) => group.platform.id === "nes");
if (!nes || nes.cards.length !== 3) {
  console.error("FAILED: NES should have 3 cards");
  process.exit(1);
}

const marioCards = nes.cards.filter((card) => card.gameName === "Mario (USA)");
if (marioCards.length !== 2) {
  console.error("FAILED: Mario should have 2 configured cards");
  process.exit(1);
}

if (nes.cards[0].gameName !== "Mario (USA)" || nes.cards[0].imageType !== "boxArt") {
  console.error("FAILED: Cards should be sorted by game name, then art type");
  process.exit(1);
}

console.log("✓ Collection tree groups by platform with flat card list");
console.log("\nAll collection tree tests passed.");
