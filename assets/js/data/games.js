/**
 * @typedef {Object} GameImages
 * @property {string} [boxArt]
 * @property {string} [titleScreen]
 * @property {string} [gamePicture]
 */

/**
 * @typedef {Object} Game
 * @property {string} platformId
 * @property {string} name
 * @property {number} raGameId
 * @property {GameImages} images
 */

/** @type {Game[]} */
export const games = [
  { platformId: "atari-2600", name: "Pac-Man", raGameId: 14403, images: {} },
  { platformId: "atari-2600", name: "Pitfall!", raGameId: 14404, images: {} },
  { platformId: "atari-2600", name: "Asteroids", raGameId: 14405, images: {} },
  { platformId: "atari-2600", name: "Space Invaders", raGameId: 14406, images: {} },
  { platformId: "atari-2600", name: "Adventure", raGameId: 14407, images: {} },

  { platformId: "nes", name: "Super Mario Bros.", raGameId: 2286, images: {} },
  { platformId: "nes", name: "The Legend of Zelda", raGameId: 1462, images: {} },
  { platformId: "nes", name: "Metroid", raGameId: 1468, images: {} },
  { platformId: "nes", name: "Mega Man 2", raGameId: 1448, images: {} },
  { platformId: "nes", name: "Castlevania", raGameId: 1461, images: {} },
  { platformId: "nes", name: "Contra", raGameId: 1464, images: {} },
  { platformId: "nes", name: "Kirby's Adventure", raGameId: 1512, images: {} },

  { platformId: "master-system", name: "Phantasy Star", raGameId: 1030, images: {} },
  { platformId: "master-system", name: "Alex Kidd in Miracle World", raGameId: 1020, images: {} },
  { platformId: "master-system", name: "Wonder Boy", raGameId: 1044, images: {} },

  { platformId: "game-boy", name: "Tetris", raGameId: 486, images: {} },
  { platformId: "game-boy", name: "Pokémon Red", raGameId: 487, images: {} },
  { platformId: "game-boy", name: "Super Mario Land", raGameId: 492, images: {} },
  { platformId: "game-boy", name: "The Legend of Zelda: Link's Awakening", raGameId: 494, images: {} },

  { platformId: "game-boy-color", name: "Pokémon Crystal", raGameId: 469, images: {} },
  { platformId: "game-boy-color", name: "The Legend of Zelda: Oracle of Ages", raGameId: 472, images: {} },
  { platformId: "game-boy-color", name: "Wario Land 3", raGameId: 476, images: {} },

  { platformId: "snes", name: "Super Mario World", raGameId: 594, images: {} },
  { platformId: "snes", name: "The Legend of Zelda: A Link to the Past", raGameId: 596, images: {} },
  { platformId: "snes", name: "Super Metroid", raGameId: 597, images: {} },
  { platformId: "snes", name: "Chrono Trigger", raGameId: 614, images: {} },
  { platformId: "snes", name: "Final Fantasy VI", raGameId: 610, images: {} },
  { platformId: "snes", name: "Donkey Kong Country", raGameId: 608, images: {} },

  { platformId: "genesis", name: "Sonic the Hedgehog", raGameId: 1, images: {} },
  { platformId: "genesis", name: "Streets of Rage 2", raGameId: 3, images: {} },
  { platformId: "genesis", name: "Phantasy Star IV", raGameId: 16, images: {} },
  { platformId: "genesis", name: "Gunstar Heroes", raGameId: 7, images: {} },

  { platformId: "saturn", name: "Panzer Dragoon Saga", raGameId: 10352, images: {} },
  { platformId: "saturn", name: "Nights into Dreams", raGameId: 10351, images: {} },
  { platformId: "saturn", name: "Radiant Silvergun", raGameId: 10353, images: {} },

  { platformId: "n64", name: "Super Mario 64", raGameId: 1159, images: {} },
  { platformId: "n64", name: "The Legend of Zelda: Ocarina of Time", raGameId: 1157, images: {} },
  { platformId: "n64", name: "GoldenEye 007", raGameId: 1158, images: {} },
  { platformId: "n64", name: "Banjo-Kazooie", raGameId: 1156, images: {} },

  { platformId: "neo-geo", name: "Metal Slug", raGameId: 1486, images: {} },
  { platformId: "neo-geo", name: "The King of Fighters '98", raGameId: 1487, images: {} },
  { platformId: "neo-geo", name: "Samurai Shodown II", raGameId: 1488, images: {} },

  { platformId: "playstation", name: "Final Fantasy VII", raGameId: 11279, images: {} },
  { platformId: "playstation", name: "Metal Gear Solid", raGameId: 11280, images: {} },
  { platformId: "playstation", name: "Castlevania: Symphony of the Night", raGameId: 11281, images: {} },
  { platformId: "playstation", name: "Tekken 3", raGameId: 11282, images: {} },
  { platformId: "playstation", name: "Resident Evil 2", raGameId: 11283, images: {} },

  { platformId: "arcade", name: "Street Fighter II", raGameId: 13335, images: {} },
  { platformId: "arcade", name: "Pac-Man", raGameId: 13336, images: {} },
  { platformId: "arcade", name: "Donkey Kong", raGameId: 13337, images: {} },
  { platformId: "arcade", name: "Galaga", raGameId: 13338, images: {} },
  { platformId: "arcade", name: "Mortal Kombat II", raGameId: 13339, images: {} },
];

export function gamesForPlatform(platformId) {
  return games.filter((g) => g.platformId === platformId);
}

export function gameByRaId(raGameId) {
  return games.find((g) => g.raGameId === raGameId);
}
