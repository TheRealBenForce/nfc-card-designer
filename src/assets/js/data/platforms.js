/**
 * @typedef {Object} Platform
 * @property {string} id
 * @property {string} name
 * @property {string} emoji
 * @property {string} defaultColor
 * @property {number} [raConsoleId] - Legacy RetroAchievements console/system ID (unused by current catalog pipeline)
 * @property {string} libretroPlaylist - Libretro thumbnail playlist folder name
 * @property {"libretro" | "ra"} [catalogSource] - Legacy game list source override (default libretro)
 * @property {string[]} [searchAliases] - Extra terms for platform search
 */

const MASTER_SYSTEM_COLOR = "#2e6db4";

/** @type {Platform[]} */
export const platforms = [
  { id: "atari-2600", name: "Atari 2600", emoji: "🕹️", defaultColor: "#e2622b", raConsoleId: 25, libretroPlaylist: "Atari - 2600", searchAliases: ["atari", "2600"] },
  { id: "nes", name: "NES", emoji: "🎮", defaultColor: "#d6262a", raConsoleId: 7, libretroPlaylist: "Nintendo - Nintendo Entertainment System", searchAliases: ["famicom", "nintendo"] },
  { id: "master-system", name: "Sega Master System", emoji: "📺", defaultColor: MASTER_SYSTEM_COLOR, raConsoleId: 11, libretroPlaylist: "Sega - Master System - Mark III", searchAliases: ["sms", "sega master"] },
  { id: "game-boy", name: "Game Boy", emoji: "🟩", defaultColor: "#8bac0f", raConsoleId: 4, libretroPlaylist: "Nintendo - Game Boy", searchAliases: ["gb", "gameboy"] },
  { id: "game-boy-color", name: "Game Boy Color", emoji: "🌈", defaultColor: "#e0459c", raConsoleId: 6, libretroPlaylist: "Nintendo - Game Boy Color", searchAliases: ["gbc", "gameboy color"] },
  { id: "snes", name: "SNES", emoji: "🎯", defaultColor: "#8b5fbf", raConsoleId: 3, libretroPlaylist: "Nintendo - Super Nintendo Entertainment System", searchAliases: ["super nintendo", "super nes"] },
  { id: "genesis", name: "Sega Genesis", emoji: "⚡", defaultColor: "#17a398", raConsoleId: 1, libretroPlaylist: "Sega - Mega Drive - Genesis", searchAliases: ["megadrive", "mega drive", "md"] },
  { id: "sega-cd", name: "Sega CD", emoji: "💿", defaultColor: MASTER_SYSTEM_COLOR, raConsoleId: 9, libretroPlaylist: "Sega - Mega-CD - Sega CD", searchAliases: ["mega cd", "segacd"] },
  { id: "sega-32x", name: "Sega 32X", emoji: "⚡", defaultColor: MASTER_SYSTEM_COLOR, raConsoleId: 10, libretroPlaylist: "Sega - 32X", searchAliases: ["32x"] },
  { id: "turbo-grafx", name: "TurboGrafx-16", emoji: "🕹️", defaultColor: "#e6376a", raConsoleId: 8, libretroPlaylist: "NEC - PC Engine - TurboGrafx 16", searchAliases: ["pc engine", "pce", "tg16"] },
  { id: "pc-engine-cd", name: "PC Engine CD", emoji: "💿", defaultColor: "#c42d5a", raConsoleId: 76, libretroPlaylist: "NEC - PC Engine CD - TurboGrafx-CD", searchAliases: ["turbografx-cd", "tgcd"] },
  { id: "saturn", name: "Sega Saturn", emoji: "🪐", defaultColor: "#5b5ea6", raConsoleId: 39, libretroPlaylist: "Sega - Saturn", searchAliases: ["sega saturn"] },
  { id: "n64", name: "Nintendo 64", emoji: "64", defaultColor: "#2d8f2d", raConsoleId: 2, libretroPlaylist: "Nintendo - Nintendo 64", searchAliases: ["nintendo 64"] },
  { id: "neo-geo", name: "Neo Geo", emoji: "🐯", defaultColor: "#d4a017", raConsoleId: 56, libretroPlaylist: "SNK - Neo Geo", searchAliases: ["neogeo", "neo geo"] },
  { id: "playstation", name: "PlayStation", emoji: "🎲", defaultColor: "#003791", raConsoleId: 12, libretroPlaylist: "Sony - PlayStation", searchAliases: ["ps1", "psx", "sony"] },
  { id: "dos", name: "DOS", emoji: "💻", defaultColor: "#1b4f9c", libretroPlaylist: "DOS", catalogSource: "libretro", searchAliases: ["ms-dos", "ibm", "pc dos"] },
  { id: "arcade", name: "Arcade", emoji: "👾", defaultColor: "#ff3d57", raConsoleId: 27, libretroPlaylist: "FBNeo - Arcade Games", searchAliases: ["mame", "cabinets"] },
];

export const platformById = Object.fromEntries(platforms.map((p) => [p.id, p]));
