/**
 * Libretro thumbnail CDN helpers.
 * @see https://thumbnails.libretro.com/
 */

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
 * Normalize a catalog title for fuzzy comparison with libretro filenames.
 * Handles common RA vs No-Intro differences (leading "The", colons vs dashes).
 * @param {string} name
 */
export function normalizeLibretroTitle(name) {
  let normalized = sanitizeLibretroFilename(name);
  const thePrefix = normalized.match(/^The (.+)$/i);
  if (thePrefix) normalized = `${thePrefix[1]}, The`;
  normalized = normalized.replace(/:/g, " -").replace(/\s+/g, " ").trim();
  normalized = normalized.replace(/\s+\([^)]*\)$/g, "").trim();
  return normalized.toLowerCase();
}

/**
 * Alternate spellings RA titles may use vs libretro / No-Intro names.
 * @param {string} gameName
 */
export function libretroTitleVariants(gameName) {
  /** @type {string[]} */
  const variants = [gameName];

  if (gameName.includes(":")) {
    variants.push(gameName.replace(/:/g, " -"));
    variants.push(gameName.replace(/:/g, " - "));
  }

  const thePrefix = gameName.match(/^The (.+)$/i);
  if (thePrefix) variants.push(`${thePrefix[1]}, The`);

  const commaThe = gameName.match(/^(.+), The$/i);
  if (commaThe) variants.push(`The ${commaThe[1]}`);

  return [...new Set(variants)];
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
  /** @type {string[]} */
  const candidates = [];

  for (const variant of libretroTitleVariants(gameName)) {
    const base = sanitizeLibretroFilename(variant);
    candidates.push(base);

    for (const suffix of LIBRETRO_REGION_SUFFIXES) {
      candidates.push(`${base} ${suffix}`);
    }
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
  const normalizedTarget = normalizeLibretroTitle(gameName);
  const normalizedListing = normalizeLibretroTitle(listingName);

  const directPrefix = listingName.toLowerCase().startsWith(target.toLowerCase());
  const normalizedPrefix = normalizedListing === normalizedTarget || normalizedListing.startsWith(`${normalizedTarget} `);
  if (!directPrefix && !normalizedPrefix) return -1;

  const rest = directPrefix ? listingName.slice(target.length) : "";
  if (directPrefix && rest && !/^(\s+\(|\s+-\s+|$)/.test(rest) && !normalizedPrefix) return -1;
  if (rest.includes(" + ") && !gameName.includes("+")) return -1;

  let score = 0;
  if (listingName === target || normalizedListing === normalizedTarget) score += 100;
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
