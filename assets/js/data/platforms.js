/**
 * @typedef {Object} Platform
 * @property {string} id
 * @property {string} name
 * @property {string} emoji
 * @property {string} defaultColor
 * @property {number} raConsoleId - RetroAchievements console/system ID
 */

/** @type {Platform[]} */
export const platforms = [
  { id: "atari-2600", name: "Atari 2600", emoji: "🕹️", defaultColor: "#c63535", raConsoleId: 25 },
  { id: "nes", name: "NES", emoji: "🎮", defaultColor: "#b4000c", raConsoleId: 7 },
  { id: "master-system", name: "Sega Master System", emoji: "📺", defaultColor: "#1a1a8c", raConsoleId: 11 },
  { id: "game-boy", name: "Game Boy", emoji: "🟩", defaultColor: "#8bac0f", raConsoleId: 4 },
  { id: "game-boy-color", name: "Game Boy Color", emoji: "🌈", defaultColor: "#6b5b95", raConsoleId: 6 },
  { id: "snes", name: "SNES", emoji: "🎯", defaultColor: "#7b5aa6", raConsoleId: 3 },
  { id: "genesis", name: "Sega Genesis", emoji: "⚡", defaultColor: "#1c1c9e", raConsoleId: 1 },
  { id: "saturn", name: "Sega Saturn", emoji: "🪐", defaultColor: "#d4c400", raConsoleId: 39 },
  { id: "n64", name: "Nintendo 64", emoji: "64", defaultColor: "#2d8f2d", raConsoleId: 2 },
  { id: "neo-geo", name: "Neo Geo", emoji: "🐯", defaultColor: "#c8a000", raConsoleId: 56 },
  { id: "playstation", name: "PlayStation", emoji: "🎲", defaultColor: "#2d2d8f", raConsoleId: 12 },
  { id: "arcade", name: "Arcade", emoji: "👾", defaultColor: "#c41e3a", raConsoleId: 27 },
];

export const platformById = Object.fromEntries(platforms.map((p) => [p.id, p]));
