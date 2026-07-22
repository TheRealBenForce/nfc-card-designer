/**
 * Parse libretro / No-Intro style game titles (trailing parenthetical tags).
 */

/** @type {ReadonlySet<string>} */
const REGION_PARTS = new Set([
  "usa",
  "world",
  "europe",
  "japan",
  "asia",
  "australia",
  "germany",
  "france",
  "spain",
  "italy",
  "canada",
  "brazil",
  "korea",
  "china",
  "hong kong",
  "taiwan",
  "netherlands",
  "sweden",
  "norway",
  "denmark",
  "finland",
  "greece",
  "portugal",
  "russia",
  "mexico",
  "poland",
  "austria",
  "switzerland",
  "belgium",
  "ireland",
  "uk",
  "scotland",
  "singapore",
  "malaysia",
  "thailand",
  "indonesia",
  "philippines",
  "vietnam",
]);

/**
 * @param {string} title
 * @returns {{ baseTitle: string, tags: string[] }}
 */
export function parseLibretroTitle(title) {
  /** @type {string[]} */
  const tags = [];
  let rest = title.trim();

  while (/\s+\([^)]*\)$/.test(rest)) {
    const match = rest.match(/\s+\(([^)]*)\)$/);
    if (!match) break;
    tags.unshift(match[1]);
    rest = rest.slice(0, match.index).trimEnd();
  }

  return { baseTitle: rest, tags };
}

/**
 * @param {string} tag
 */
export function isRevisionTag(tag) {
  return /^rev\b/i.test(tag.trim());
}

/**
 * @param {string} tag
 */
export function isLanguageOnlyTag(tag) {
  const parts = tag.split(/,\s*/);
  return parts.length > 0 && parts.every((part) => /^(En|Fr|De|Es|It|Nl|No|Sv|Da|Fi|Pt|Ja|Zh|Ko)$/i.test(part.trim()));
}

/**
 * @param {string} tag
 */
export function isHardwareTag(tag) {
  const trimmed = tag.trim();
  return /^(SGB|CGB)/i.test(trimmed) || /Enhanced$/i.test(trimmed);
}

/**
 * @param {string} tag
 */
export function isExcludedReleaseTag(tag) {
  return /^(Beta|Proto|Demo|Sample)$/i.test(tag.trim());
}

/**
 * @param {string} tag
 */
export function isRegionTag(tag) {
  if (isRevisionTag(tag) || isLanguageOnlyTag(tag) || isHardwareTag(tag) || isExcludedReleaseTag(tag)) {
    return false;
  }

  const parts = tag.split(/,\s*/);
  return parts.some((part) => REGION_PARTS.has(part.toLowerCase().trim()));
}

/**
 * @param {string[]} tags
 */
export function findRegionTag(tags) {
  return tags.find((tag) => isRegionTag(tag)) ?? null;
}

/**
 * Higher is better.
 * @param {string[]} tags
 */
export function regionPriorityScore(tags) {
  const region = findRegionTag(tags);
  if (!region) return 5;

  if (/^USA$/i.test(region)) return 100;
  if (/^World$/i.test(region)) return 90;
  if (/\bUSA\b/i.test(region)) return 85;
  if (/^Europe$/i.test(region)) return 70;
  if (/^Australia$/i.test(region)) return 65;
  if (/^Canada$/i.test(region)) return 60;
  if (/^Germany$/i.test(region)) return 40;
  if (/^France$/i.test(region)) return 40;
  if (/^Spain$/i.test(region)) return 40;
  if (/^Italy$/i.test(region)) return 40;
  if (/^Japan$/i.test(region)) return 30;
  if (/^Asia$/i.test(region)) return 25;
  if (/^Korea$/i.test(region)) return 25;
  if (/^China$/i.test(region)) return 25;
  return 35;
}

/**
 * Lower is better. No revision tag returns 0.
 * @param {string[]} tags
 */
export function revisionNumber(tags) {
  const revTag = tags.find((tag) => isRevisionTag(tag));
  if (!revTag) return 0;

  const numeric = revTag.match(/\d+/);
  if (numeric) return Number.parseInt(numeric[0], 10);

  const letter = revTag.match(/rev\s+([a-z])/i);
  if (letter) return letter[1].toUpperCase().charCodeAt(0) - "A".charCodeAt(0) + 1;

  return 1;
}

/**
 * @param {string} title
 */
export function stripLibretroDisplayName(title) {
  return parseLibretroTitle(title).baseTitle;
}
