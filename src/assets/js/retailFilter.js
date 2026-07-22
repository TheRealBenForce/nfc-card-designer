import {
  isExcludedReleaseTag,
  parseLibretroTitle,
  stripLibretroDisplayName,
} from "./libretroTitle.js";

/**
 * RetroAchievements marks non-retail entries in game titles.
 * @see https://docs.retroachievements.org/guidelines/content/game-info-and-hub-guidelines.html
 */

/** @type {readonly string[]} */
export const NON_RETAIL_TITLE_MARKERS = [
  "~Hack~",
  "~Homebrew~",
  "~Demo~",
  "~Prototype~",
  "~Test Kit~",
  "~Unlicensed~",
  "~Z~",
];

/**
 * @param {string} title
 */
export function isRetailRelease(title) {
  const normalized = title.trim();
  if (!normalized) return false;

  if (/^Named_(Boxarts|Titles|Snaps)\//i.test(normalized)) return false;
  if (/\bSymbolicLink\b/i.test(normalized)) return false;

  const upper = normalized.toUpperCase();
  for (const marker of NON_RETAIL_TITLE_MARKERS) {
    if (upper.includes(marker.toUpperCase())) return false;
  }

  if (/\[Subset\s*-/i.test(normalized)) return false;

  const { tags } = parseLibretroTitle(normalized);
  if (tags.some((tag) => isExcludedReleaseTag(tag))) return false;

  // Mid-title bootleg/homebrew markers that are not always trailing tags.
  if (/\bbootleg\b/i.test(normalized)) return false;
  if (/\[Homebrew\]/i.test(normalized)) return false;

  return true;
}

/**
 * @param {string} title
 */
export function retailDisplayName(title) {
  return stripLibretroDisplayName(title);
}
