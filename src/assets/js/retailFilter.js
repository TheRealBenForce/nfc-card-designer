/**
 * Community catalogs often mark non-retail entries directly in game titles.
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

  const upper = normalized.toUpperCase();
  for (const marker of NON_RETAIL_TITLE_MARKERS) {
    if (upper.includes(marker.toUpperCase())) return false;
  }

  if (/\[Subset\s*-/i.test(normalized)) return false;

  return true;
}

/**
 * @param {string} title
 */
export function retailDisplayName(title) {
  return title.trim();
}
