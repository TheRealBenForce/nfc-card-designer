/**
 * @typedef {Object} Platform
 * @property {string} id
 * @property {string} name
 * @property {string} emoji
 * @property {string} defaultColor
 * @property {number} raConsoleId - RetroAchievements console/system ID
 * @property {string[]} [searchAliases] - Extra terms for platform search
 */

/** @type {Platform[]} */
export const platforms = [
  { id: "atari-2600", name: "Atari 2600", emoji: "🕹️", defaultColor: "#c63535", raConsoleId: 25, searchAliases: ["atari", "2600"] },
  { id: "nes", name: "NES", emoji: "🎮", defaultColor: "#b4000c", raConsoleId: 7, searchAliases: ["famicom", "nintendo"] },
  { id: "master-system", name: "Sega Master System", emoji: "📺", defaultColor: "#1a1a8c", raConsoleId: 11, searchAliases: ["sms", "sega master"] },
  { id: "game-boy", name: "Game Boy", emoji: "🟩", defaultColor: "#8bac0f", raConsoleId: 4, searchAliases: ["gb", "gameboy"] },
  { id: "game-boy-color", name: "Game Boy Color", emoji: "🌈", defaultColor: "#6b5b95", raConsoleId: 6, searchAliases: ["gbc", "gameboy color"] },
  { id: "snes", name: "SNES", emoji: "🎯", defaultColor: "#7b5aa6", raConsoleId: 3, searchAliases: ["super nintendo", "super nes"] },
  { id: "genesis", name: "Sega Genesis", emoji: "⚡", defaultColor: "#1c1c9e", raConsoleId: 1, searchAliases: ["megadrive", "mega drive", "md"] },
  { id: "saturn", name: "Sega Saturn", emoji: "🪐", defaultColor: "#d4c400", raConsoleId: 39, searchAliases: ["sega saturn"] },
  { id: "n64", name: "Nintendo 64", emoji: "64", defaultColor: "#2d8f2d", raConsoleId: 2, searchAliases: ["nintendo 64"] },
  { id: "neo-geo", name: "Neo Geo", emoji: "🐯", defaultColor: "#c8a000", raConsoleId: 56, searchAliases: ["neogeo", "neo geo"] },
  { id: "playstation", name: "PlayStation", emoji: "🎲", defaultColor: "#2d2d8f", raConsoleId: 12, searchAliases: ["ps1", "psx", "sony"] },
  { id: "arcade", name: "Arcade", emoji: "👾", defaultColor: "#c41e3a", raConsoleId: 27, searchAliases: ["mame", "cabinets"] },
];

export const platformById = Object.fromEntries(platforms.map((p) => [p.id, p]));
