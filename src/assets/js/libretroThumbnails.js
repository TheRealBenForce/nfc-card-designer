/**
 * Libretro thumbnail helpers (GitHub raw URLs for runtime artwork).
 */

export const LIBRETRO_GITHUB_RAW_BASE = "https://raw.githubusercontent.com/libretro-thumbnails";
export const LIBRETRO_GITHUB_ORG = "libretro-thumbnails";

/** @deprecated Legacy CDN — do not use for canvas/PDF (no CORS). */
export const LIBRETRO_THUMBNAIL_BASE = "https://thumbnails.libretro.com";

/** @type {Record<string, string>} App image type → libretro folder name */
export const LIBRETRO_IMAGE_FOLDERS = {
  boxArt: "Named_Boxarts",
  titleScreen: "Named_Titles",
  gamePicture: "Named_Snaps",
};

/** Preferred region / release suffixes when probing filenames. */
export const LIBRETRO_REGION_SUFFIXES = [
  "(USA)",
  "(World)",
  "(Europe)",
  "(Japan)",
  "(USA, Europe)",
  "(Asia)",
];

const INVALID_FILENAME_CHARS = /[&*/:\\`<>?|]/g;

/**
 * @param {string} libretroPlaylist
 */
export function playlistToGitHubRepo(libretroPlaylist) {
  return libretroPlaylist.replaceAll(" - ", "_-_").replaceAll(" ", "_");
}

/**
 * @param {string} githubRepo
 * @param {string} imageFolder
 * @param {string} filename With or without .png extension
 */
export function libretroGitHubRawUrl(githubRepo, imageFolder, filename) {
  const stem = filename.replace(/\.png$/i, "");
  const safeName = sanitizeLibretroFilename(stem);
  return `${LIBRETRO_GITHUB_RAW_BASE}/${githubRepo}/master/${encodeURIComponent(imageFolder)}/${encodeURIComponent(`${safeName}.png`)}`;
}

/**
 * Characters forbidden in libretro thumbnail filenames become underscores.
 * @param {string} name
 */
export function sanitizeLibretroFilename(name) {
  return name.replace(INVALID_FILENAME_CHARS, "_").trim();
}

/**
 * @param {string} playlistName
 * @param {string} imageFolder
 * @param {string} filename Without .png extension
 */
export function libretroThumbnailUrl(playlistName, imageFolder, filename) {
  const safeName = sanitizeLibretroFilename(filename);
  const encodedPlaylist = encodeURIComponent(playlistName);
  const encodedFolder = encodeURIComponent(imageFolder);
  return `${LIBRETRO_THUMBNAIL_BASE}/${encodedPlaylist}/${encodedFolder}/${encodeURIComponent(`${safeName}.png`)}`;
}

/**
 * @param {string} playlistName
 * @param {string} imageFolder
 */
export function libretroThumbnailDirectoryUrl(playlistName, imageFolder) {
  const encodedPlaylist = encodeURIComponent(playlistName);
  const encodedFolder = encodeURIComponent(imageFolder);
  return `${LIBRETRO_THUMBNAIL_BASE}/${encodedPlaylist}/${encodedFolder}/`;
}

/**
 * Candidate thumbnail basenames to probe, most preferred first.
 * @param {string} gameName
 */
export function libretroFilenameCandidates(gameName) {
  const base = sanitizeLibretroFilename(gameName);
  /** @type {string[]} */
  const candidates = [base];

  for (const suffix of LIBRETRO_REGION_SUFFIXES) {
    candidates.push(`${base} ${suffix}`);
  }

  return [...new Set(candidates)];
}

/**
 * Score how well a libretro listing entry matches a catalog game title.
 * Higher is better; -1 means no match.
 * @param {string} gameName
 * @param {string} filename With or without .png
 */
export function scoreLibretroFilename(gameName, filename) {
  const listingName = filename.replace(/\.png$/i, "");
  const target = sanitizeLibretroFilename(gameName);
  if (!listingName.toLowerCase().startsWith(target.toLowerCase())) return -1;

  const rest = listingName.slice(target.length);
  if (rest && !/^(\s+\(|\s+-\s+|$)/.test(rest)) return -1;
  if (rest.includes(" + ") && !gameName.includes("+")) return -1;

  let score = 0;
  if (listingName === target) score += 100;
  if (rest.includes("(USA)")) score += 50;
  if (rest.includes("(World)")) score += 40;
  if (rest.includes("(Europe)")) score += 30;
  if (rest.includes("(Japan)")) score += 20;
  if (listingName.includes("[")) score -= 100;
  if (/\b(Beta|Demo|Proto|Pirate|Unl)\b/i.test(listingName)) score -= 50;
  score -= rest.length * 0.1;

  return score;
}

/**
 * Pick the best filename from a libretro directory listing.
 * @param {string} gameName
 * @param {string[]} filenames
 * @returns {string | null} basename without .png
 */
export function pickLibretroFilename(gameName, filenames) {
  let bestName = null;
  let bestScore = -1;

  for (const filename of filenames) {
    const score = scoreLibretroFilename(gameName, filename);
    if (score > bestScore) {
      bestScore = score;
      bestName = filename.replace(/\.png$/i, "");
    }
  }

  return bestName;
}
