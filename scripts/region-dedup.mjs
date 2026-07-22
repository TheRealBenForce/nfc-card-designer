import { LIBRETRO_IMAGE_FOLDERS } from "../src/assets/js/libretroThumbnails.js";
import {
  discNumber,
  parseLibretroTitle,
  regionPriorityScore,
  revisionNumber,
} from "../src/assets/js/libretroTitle.js";

const IMAGE_FOLDERS = Object.values(LIBRETRO_IMAGE_FOLDERS);

/**
 * @param {{ path: string, type?: string }[]} tree
 * @returns {Map<string, Set<string>>}
 */
export function buildArtworkIndex(tree) {
  /** @type {Map<string, Set<string>>} */
  const index = new Map();

  for (const entry of tree) {
    if (entry.type && entry.type !== "blob") continue;

    for (const folder of IMAGE_FOLDERS) {
      const prefix = `${folder}/`;
      if (!entry.path?.startsWith(prefix) || !entry.path.endsWith(".png")) continue;

      const name = entry.path.slice(prefix.length).replace(/\.png$/i, "");
      if (!index.has(name)) index.set(name, new Set());
      index.get(name).add(folder);
    }
  }

  return index;
}

/**
 * @param {string[]} names
 * @returns {Map<string, Set<string>>}
 */
export function buildArtworkIndexFromBoxartNames(names) {
  /** @type {Map<string, Set<string>>} */
  const index = new Map();
  for (const name of names) {
    index.set(name, new Set([LIBRETRO_IMAGE_FOLDERS.boxArt]));
  }
  return index;
}

/**
 * @param {string} name
 * @param {Map<string, Set<string>>} artworkIndex
 */
export function artworkCount(name, artworkIndex) {
  return artworkIndex.get(name)?.size ?? 0;
}

/**
 * @param {string} a
 * @param {string} b
 * @param {Map<string, Set<string>>} artworkIndex
 */
export function compareRegionalVariants(a, b, artworkIndex) {
  const parsedA = parseLibretroTitle(a);
  const parsedB = parseLibretroTitle(b);

  const regionDelta = regionPriorityScore(parsedB.tags) - regionPriorityScore(parsedA.tags);
  if (regionDelta !== 0) return regionDelta;

  const artworkDelta = artworkCount(b, artworkIndex) - artworkCount(a, artworkIndex);
  if (artworkDelta !== 0) return artworkDelta;

  const revisionDelta = revisionNumber(parsedA.tags) - revisionNumber(parsedB.tags);
  if (revisionDelta !== 0) return revisionDelta;

  const discDelta = discNumber(parsedA.tags) - discNumber(parsedB.tags);
  if (discDelta !== 0) return discDelta;

  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

/**
 * Keep one libretro filename per base title, preferring USA/World and the variant
 * with the most artwork (box art, title screen, snap). Multi-disc releases collapse
 * to a single entry (lowest disc number after other tiebreakers).
 *
 * @param {string[]} names
 * @param {Map<string, Set<string>>} artworkIndex
 * @returns {string[]}
 */
export function dedupeRegionalVariants(names, artworkIndex) {
  /** @type {Map<string, string[]>} */
  const groups = new Map();

  for (const name of names) {
    const { baseTitle } = parseLibretroTitle(name);
    const key = baseTitle.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(name);
  }

  /** @type {string[]} */
  const picked = [];
  for (const variants of groups.values()) {
    variants.sort((a, b) => compareRegionalVariants(a, b, artworkIndex));
    picked.push(variants[0]);
  }

  return picked.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
