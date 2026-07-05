/** @typedef {'full' | 'partial'} PlatformSupport */

/**
 * @typedef {Object} Platform
 * @property {string} id
 * @property {string} name
 * @property {string} emoji
 * @property {string} defaultColor
 * @property {string} giantBombSlug
 * @property {number} giantBombPlatformId
 * @property {PlatformSupport} support
 * @property {Record<string, string[]>} [imageSectionAliases]
 */

/** @type {Platform[]} */
export const platforms = [
  {
    id: "atari-2600",
    name: "Atari 2600",
    emoji: "🕹️",
    defaultColor: "#c63535",
    giantBombSlug: "Platforms/Atari_2600",
    giantBombPlatformId: 40,
    support: "full",
    imageSectionAliases: {
      boxArt: ["Box Art", "Atari 2600 Box Art", "Cartridge"],
      titleScreen: ["Title Screen", "Atari 2600 Screenshots"],
      gamePicture: ["Screenshots", "In-Game"],
    },
  },
  {
    id: "nes",
    name: "NES",
    emoji: "🎮",
    defaultColor: "#b4000c",
    giantBombSlug: "Platforms/NES",
    giantBombPlatformId: 8,
    support: "full",
    imageSectionAliases: {
      boxArt: ["Box Art", "NES Box Art", "Cartridge"],
      titleScreen: ["Title Screen", "NES Screenshots"],
      gamePicture: ["Screenshots", "In-Game"],
    },
  },
  {
    id: "master-system",
    name: "Sega Master System",
    emoji: "📺",
    defaultColor: "#1a1a8c",
    giantBombSlug: "Platforms/Master_System",
    giantBombPlatformId: 35,
    support: "full",
    imageSectionAliases: {
      boxArt: ["Box Art", "Master System Box Art"],
      titleScreen: ["Title Screen", "Master System Screenshots"],
      gamePicture: ["Screenshots", "In-Game"],
    },
  },
  {
    id: "game-boy",
    name: "Game Boy",
    emoji: "🟩",
    defaultColor: "#8bac0f",
    giantBombSlug: "Platforms/Game_Boy",
    giantBombPlatformId: 7,
    support: "full",
    imageSectionAliases: {
      boxArt: ["Box Art", "Game Boy Box Art", "Cartridge"],
      titleScreen: ["Title Screen", "Game Boy Screenshots"],
      gamePicture: ["Screenshots", "In-Game"],
    },
  },
  {
    id: "game-boy-color",
    name: "Game Boy Color",
    emoji: "🌈",
    defaultColor: "#6b5b95",
    giantBombSlug: "Platforms/Game_Boy_Color",
    giantBombPlatformId: 22,
    support: "full",
    imageSectionAliases: {
      boxArt: ["Box Art", "Game Boy Color Box Art"],
      titleScreen: ["Title Screen", "Game Boy Color Screenshots"],
      gamePicture: ["Screenshots", "In-Game"],
    },
  },
  {
    id: "snes",
    name: "SNES",
    emoji: "🎯",
    defaultColor: "#7b5aa6",
    giantBombSlug: "Platforms/Super_Nintendo_Entertainment_System",
    giantBombPlatformId: 9,
    support: "full",
    imageSectionAliases: {
      boxArt: ["Box Art", "SNES Box Art", "Super Nintendo Box Art"],
      titleScreen: ["Title Screen", "SNES Screenshots"],
      gamePicture: ["Screenshots", "In-Game"],
    },
  },
  {
    id: "genesis",
    name: "Sega Genesis",
    emoji: "⚡",
    defaultColor: "#1c1c9e",
    giantBombSlug: "Platforms/Sega_Genesis",
    giantBombPlatformId: 29,
    support: "full",
    imageSectionAliases: {
      boxArt: ["Box Art", "Genesis Box Art", "Mega Drive Box Art"],
      titleScreen: ["Title Screen", "Genesis Screenshots"],
      gamePicture: ["Screenshots", "In-Game"],
    },
  },
  {
    id: "saturn",
    name: "Sega Saturn",
    emoji: "🪐",
    defaultColor: "#d4c400",
    giantBombSlug: "Platforms/Sega_Saturn",
    giantBombPlatformId: 42,
    support: "full",
    imageSectionAliases: {
      boxArt: ["Box Art", "Saturn Box Art"],
      titleScreen: ["Title Screen", "Saturn Screenshots"],
      gamePicture: ["Screenshots", "In-Game"],
    },
  },
  {
    id: "n64",
    name: "Nintendo 64",
    emoji: "64",
    defaultColor: "#2d8f2d",
    giantBombSlug: "Platforms/Nintendo_64",
    giantBombPlatformId: 43,
    support: "full",
    imageSectionAliases: {
      boxArt: ["Box Art", "N64 Box Art", "Nintendo 64 Box Art"],
      titleScreen: ["Title Screen", "N64 Screenshots"],
      gamePicture: ["Screenshots", "In-Game"],
    },
  },
  {
    id: "neo-geo",
    name: "Neo Geo",
    emoji: "🐯",
    defaultColor: "#c8a000",
    giantBombSlug: "Platforms/Neo_Geo",
    giantBombPlatformId: 20,
    support: "partial",
    imageSectionAliases: {
      boxArt: ["Box Art", "Neo Geo Box Art", "AES Box Art", "MVS", "Cartridge"],
      titleScreen: ["Title Screen", "Neo Geo Screenshots"],
      gamePicture: ["Screenshots", "In-Game"],
    },
  },
  {
    id: "playstation",
    name: "PlayStation",
    emoji: "🎲",
    defaultColor: "#2d2d8f",
    giantBombSlug: "Platforms/PlayStation",
    giantBombPlatformId: 19,
    support: "full",
    imageSectionAliases: {
      boxArt: ["Box Art", "PlayStation Box Art", "PS1 Box Art"],
      titleScreen: ["Title Screen", "PlayStation Screenshots"],
      gamePicture: ["Screenshots", "In-Game"],
    },
  },
  {
    id: "arcade",
    name: "Arcade",
    emoji: "👾",
    defaultColor: "#c41e3a",
    giantBombSlug: "Platforms/Arcade",
    giantBombPlatformId: 52,
    support: "partial",
    imageSectionAliases: {
      boxArt: ["Box Art", "Flyer", "Cabinet", "Marquee", "Arcade Flyer"],
      titleScreen: ["Title Screen", "Attract Mode"],
      gamePicture: ["Screenshots", "In-Game", "Arcade Screenshots"],
    },
  },
];

export const platformById = Object.fromEntries(platforms.map((p) => [p.id, p]));
