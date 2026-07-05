/**
 * @typedef {Object} Game
 * @property {string} platformId
 * @property {string} name
 * @property {string} wikiSlug
 */

/** @type {Game[]} */
export const games = [
  // Atari 2600
  { platformId: "atari-2600", name: "Pac-Man", wikiSlug: "Games/Pac-Man" },
  { platformId: "atari-2600", name: "Pitfall!", wikiSlug: "Games/Pitfall" },
  { platformId: "atari-2600", name: "Asteroids", wikiSlug: "Games/Asteroids" },
  { platformId: "atari-2600", name: "Space Invaders", wikiSlug: "Games/Space_Invaders" },
  { platformId: "atari-2600", name: "Adventure", wikiSlug: "Games/Adventure" },

  // NES
  { platformId: "nes", name: "Super Mario Bros.", wikiSlug: "Games/Super_Mario_Bros" },
  { platformId: "nes", name: "The Legend of Zelda", wikiSlug: "Games/The_Legend_of_Zelda" },
  { platformId: "nes", name: "Metroid", wikiSlug: "Games/Metroid" },
  { platformId: "nes", name: "Mega Man 2", wikiSlug: "Games/Mega_Man_2" },
  { platformId: "nes", name: "Castlevania", wikiSlug: "Games/Castlevania" },
  { platformId: "nes", name: "Contra", wikiSlug: "Games/Contra" },
  { platformId: "nes", name: "Kirby's Adventure", wikiSlug: "Games/Kirby_s_Adventure" },

  // Master System
  { platformId: "master-system", name: "Phantasy Star", wikiSlug: "Games/Phantasy_Star" },
  { platformId: "master-system", name: "Alex Kidd in Miracle World", wikiSlug: "Games/Alex_Kidd_in_Miracle_World" },
  { platformId: "master-system", name: "Wonder Boy", wikiSlug: "Games/Wonder_Boy" },

  // Game Boy
  { platformId: "game-boy", name: "Tetris", wikiSlug: "Games/Tetris" },
  { platformId: "game-boy", name: "Pokémon Red", wikiSlug: "Games/Pokemon_Red_Blue" },
  { platformId: "game-boy", name: "Super Mario Land", wikiSlug: "Games/Super_Mario_Land" },
  { platformId: "game-boy", name: "The Legend of Zelda: Link's Awakening", wikiSlug: "Games/The_Legend_of_Zelda_Link_s_Awakening" },

  // Game Boy Color
  { platformId: "game-boy-color", name: "Pokémon Crystal", wikiSlug: "Games/Pokemon_Crystal" },
  { platformId: "game-boy-color", name: "The Legend of Zelda: Oracle of Ages", wikiSlug: "Games/The_Legend_of_Zelda_Oracle_of_Ages" },
  { platformId: "game-boy-color", name: "Wario Land 3", wikiSlug: "Games/Wario_Land_3" },

  // SNES
  { platformId: "snes", name: "Super Mario World", wikiSlug: "Games/Super_Mario_World" },
  { platformId: "snes", name: "The Legend of Zelda: A Link to the Past", wikiSlug: "Games/The_Legend_of_Zelda_A_Link_to_the_Past" },
  { platformId: "snes", name: "Super Metroid", wikiSlug: "Games/Super_Metroid" },
  { platformId: "snes", name: "Chrono Trigger", wikiSlug: "Games/Chrono_Trigger" },
  { platformId: "snes", name: "Final Fantasy VI", wikiSlug: "Games/Final_Fantasy_III" },
  { platformId: "snes", name: "Donkey Kong Country", wikiSlug: "Games/Donkey_Kong_Country" },

  // Genesis
  { platformId: "genesis", name: "Sonic the Hedgehog", wikiSlug: "Games/Sonic_the_Hedgehog" },
  { platformId: "genesis", name: "Streets of Rage 2", wikiSlug: "Games/Streets_of_Rage_2" },
  { platformId: "genesis", name: "Phantasy Star IV", wikiSlug: "Games/Phantasy_Star_IV" },
  { platformId: "genesis", name: "Gunstar Heroes", wikiSlug: "Games/Gunstar_Heroes" },

  // Saturn
  { platformId: "saturn", name: "Panzer Dragoon Saga", wikiSlug: "Games/Panzer_Dragoon_Saga" },
  { platformId: "saturn", name: "Nights into Dreams", wikiSlug: "Games/Nights_into_Dreams" },
  { platformId: "saturn", name: "Radiant Silvergun", wikiSlug: "Games/Radiant_Silvergun" },

  // N64
  { platformId: "n64", name: "Super Mario 64", wikiSlug: "Games/Super_Mario_64" },
  { platformId: "n64", name: "The Legend of Zelda: Ocarina of Time", wikiSlug: "Games/The_Legend_of_Zelda_Ocarina_of_Time" },
  { platformId: "n64", name: "GoldenEye 007", wikiSlug: "Games/GoldenEye_007" },
  { platformId: "n64", name: "Banjo-Kazooie", wikiSlug: "Games/Banjo-Kazooie" },

  // Neo Geo
  { platformId: "neo-geo", name: "Metal Slug", wikiSlug: "Games/Metal_Slug" },
  { platformId: "neo-geo", name: "The King of Fighters '98", wikiSlug: "Games/The_King_of_Fighters_98" },
  { platformId: "neo-geo", name: "Samurai Shodown II", wikiSlug: "Games/Samurai_Shodown_II" },

  // PlayStation
  { platformId: "playstation", name: "Final Fantasy VII", wikiSlug: "Games/Final_Fantasy_VII" },
  { platformId: "playstation", name: "Metal Gear Solid", wikiSlug: "Games/Metal_Gear_Solid" },
  { platformId: "playstation", name: "Castlevania: Symphony of the Night", wikiSlug: "Games/Castlevania_Symphony_of_the_Night" },
  { platformId: "playstation", name: "Tekken 3", wikiSlug: "Games/Tekken_3" },
  { platformId: "playstation", name: "Resident Evil 2", wikiSlug: "Games/Resident_Evil_2" },

  // Arcade (curated subset)
  { platformId: "arcade", name: "Street Fighter II", wikiSlug: "Games/Street_Fighter_II_The_World_Warrior" },
  { platformId: "arcade", name: "Pac-Man", wikiSlug: "Games/Pac-Man" },
  { platformId: "arcade", name: "Donkey Kong", wikiSlug: "Games/Donkey_Kong" },
  { platformId: "arcade", name: "Galaga", wikiSlug: "Games/Galaga" },
  { platformId: "arcade", name: "Mortal Kombat II", wikiSlug: "Games/Mortal_Kombat_II" },
];

export function gamesForPlatform(platformId) {
  return games.filter((g) => g.platformId === platformId);
}
