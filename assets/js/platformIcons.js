/** @type {Record<string, string>} */
export const PLATFORM_ICON_PATHS = Object.fromEntries(
  [
    "atari-2600",
    "nes",
    "master-system",
    "game-boy",
    "game-boy-color",
    "snes",
    "genesis",
    "saturn",
    "n64",
    "neo-geo",
    "playstation",
    "arcade",
  ].map((id) => [id, `assets/images/platforms/${id}/icon.svg`]),
);

/**
 * @param {string} platformId
 * @returns {string}
 */
export function getPlatformIconPath(platformId) {
  return PLATFORM_ICON_PATHS[platformId] ?? PLATFORM_ICON_PATHS.nes;
}
