/**
 * Parse libretro / No-Intro / TOSEC style game titles
 * (trailing parenthetical and bracket tags).
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
  "us",
  "jp",
  "eu",
]);

/**
 * Peel trailing `(...)` and `[...]` tags from a title.
 * @param {string} title
 * @returns {{ baseTitle: string, tags: string[] }}
 */
export function parseLibretroTitle(title) {
  /** @type {string[]} */
  const tags = [];
  let rest = title.trim();

  while (true) {
    if (rest.endsWith(")")) {
      const match = rest.match(/\(([^)]*)\)$/);
      if (!match || match.index === undefined) break;
      tags.unshift(match[1]);
      rest = rest.slice(0, match.index).trimEnd();
      continue;
    }

    if (rest.endsWith("]")) {
      const match = rest.match(/\[([^\]]*)\]$/);
      if (!match || match.index === undefined) break;
      tags.unshift(match[1]);
      rest = rest.slice(0, match.index).trimEnd();
      continue;
    }

    break;
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
  return (
    parts.length > 0 &&
    parts.every((part) => /^(En|Fr|De|Es|It|Nl|No|Sv|Da|Fi|Pt|Ja|Zh|Ko)$/i.test(part.trim()))
  );
}

/**
 * @param {string} tag
 */
export function isHardwareTag(tag) {
  const trimmed = tag.trim();
  if (/^(SGB|CGB)/i.test(trimmed) || /Enhanced$/i.test(trimmed)) return true;
  if (/^Enhancement Chip$/i.test(trimmed)) return true;
  if (/^\d+M$/i.test(trimmed)) return true;
  if (/^req\./i.test(trimmed)) return true;
  return false;
}

/**
 * Dump quality / ROM flags that should never appear in display names.
 * @param {string} tag
 */
export function isDumpFlagTag(tag) {
  return /^(!|b|n|o|a|b\s*sub|f|h|p|t|tr)$/i.test(tag.trim());
}

/**
 * Disc / CD markers used to collapse multi-disc releases.
 * @param {string} tag
 */
export function isDiscTag(tag) {
  return /^(Disc|Disk|CD)\b/i.test(tag.trim());
}

/**
 * Tags that mean the entry should not appear in the retail catalog.
 * @param {string} tag
 */
export function isExcludedReleaseTag(tag) {
  const trimmed = tag.trim();
  if (/\b(Beta|Proto|Prototype|Demo|Sample)\b/i.test(trimmed)) return true;
  if (/\bBootleg\b/i.test(trimmed)) return true;
  if (/\bHomebrew\b/i.test(trimmed)) return true;
  if (/\bHack\b/i.test(trimmed)) return true;
  if (/\bT-En\b/i.test(trimmed)) return true;
  if (/^English$/i.test(trimmed)) return true;
  if (/^Add by\b/i.test(trimmed)) return true;
  return false;
}

/**
 * @param {string} tag
 */
export function isRegionTag(tag) {
  if (
    isRevisionTag(tag) ||
    isLanguageOnlyTag(tag) ||
    isHardwareTag(tag) ||
    isExcludedReleaseTag(tag) ||
    isDumpFlagTag(tag) ||
    isDiscTag(tag)
  ) {
    return false;
  }

  if (/^(NTSC|PAL)$/i.test(tag.trim())) return false;

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

  if (/^(USA|US)$/i.test(region)) return 100;
  if (/^World$/i.test(region)) return 90;
  if (/\bUSA\b/i.test(region) || /\bUS\b/i.test(region)) return 85;
  if (/^(Europe|EU)$/i.test(region)) return 70;
  if (/^Australia$/i.test(region)) return 65;
  if (/^Canada$/i.test(region)) return 60;
  if (/^Germany$/i.test(region)) return 40;
  if (/^France$/i.test(region)) return 40;
  if (/^Spain$/i.test(region)) return 40;
  if (/^Italy$/i.test(region)) return 40;
  if (/^(Japan|JP)$/i.test(region)) return 30;
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
 * Lower is better. Missing disc tag sorts as 0 (preferred over Disc 2+).
 * @param {string[]} tags
 */
export function discNumber(tags) {
  const discTag = tags.find((tag) => isDiscTag(tag));
  if (!discTag) return 0;

  const numeric = discTag.match(/\d+/);
  if (numeric) return Number.parseInt(numeric[0], 10);

  const letter = discTag.match(/\b([A-Z])\b/i);
  if (letter) return letter[1].toUpperCase().charCodeAt(0) - "A".charCodeAt(0) + 1;

  return 1;
}

/**
 * MAME / FBNeo often use underscores where a dash belongs:
 * - spaced ` _ ` between alternate titles (Neo Geo)
 * - `1941_ Counter Attack` (digit + `_ `)
 * - `Kai_ Midway Kaisen` (word + `_ `)
 * Internal underscores like `Q_bert` or `1_2` are left alone.
 * @param {string} title
 */
export function normalizeLibretroBaseTitle(title) {
  let normalized = title.trim();
  normalized = normalized.replace(/\s+_\s+/g, " - ");
  normalized = normalized.replace(/_ /g, " - ");
  return stripTrailingVersionToken(normalized);
}

/**
 * @deprecated Prefer normalizeLibretroBaseTitle
 * @param {string} title
 */
export function normalizeAlternateTitleSeparator(title) {
  return normalizeLibretroBaseTitle(title);
}

/**
 * Strip trailing TOSEC-style version tokens (e.g. "v1.400") from display titles.
 * @param {string} title
 */
export function stripTrailingVersionToken(title) {
  return title.replace(/\s+v\d+\.\d+(?:\.\d+)*\b$/i, "").trimEnd();
}

/**
 * @param {string} title
 */
export function stripLibretroDisplayName(title) {
  const base = parseLibretroTitle(title).baseTitle;
  return normalizeLibretroBaseTitle(base);
}

/**
 * Catalog IDs and serial numbers that can appear as trailing tags.
 * @param {string} tag
 */
export function isCatalogOrSerialTag(tag) {
  const trimmed = tag.trim();
  if (/^NG[MH]-\d+$/i.test(trimmed)) return true;
  if (/^[A-Z]{2}\d[\w-]*$/i.test(trimmed)) return true;
  return false;
}

/**
 * Extract year and publisher from libretro filename metadata tags.
 * @param {string} libretroName
 * @returns {{ year: string | null, publisher: string | null }}
 */
export function extractLibretroMetadata(libretroName) {
  const { tags } = parseLibretroTitle(libretroName);

  /** @type {string | null} */
  let year = null;
  /** @type {string | null} */
  let publisher = null;

  for (const tag of tags) {
    const trimmed = tag.trim();

    if (!year && /^\d{4}$/.test(trimmed)) {
      year = trimmed;
      continue;
    }

    if (
      publisher ||
      /^\d{4}$/.test(trimmed) ||
      /^(NTSC|PAL)$/i.test(trimmed) ||
      isRegionTag(tag) ||
      isRevisionTag(tag) ||
      isDiscTag(tag) ||
      isDumpFlagTag(tag) ||
      isHardwareTag(tag) ||
      isExcludedReleaseTag(tag) ||
      isLanguageOnlyTag(tag) ||
      isCatalogOrSerialTag(tag)
    ) {
      continue;
    }

    publisher = trimmed;
  }

  return { year, publisher };
}
