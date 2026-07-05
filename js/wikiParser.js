import { PLACEHOLDER_SVG } from "./config.js";
import { platformById } from "./data/platforms.js";

const WIKI_BASE = "https://www.giantbomb.com/wiki";

/**
 * @param {string} wikiSlug
 */
export function wikiImagesUrl(wikiSlug) {
  return `${WIKI_BASE}/${wikiSlug}/Images`;
}

/**
 * @param {string} html
 * @returns {{ heading: string, images: { src: string, alt: string }[] }[]}
 */
export function parseWikiImagesPage(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const sections = [];
  let current = { heading: "All Images", images: [] };

  const headings = doc.querySelectorAll("h2, h3, img");
  const content = doc.body;

  /** @type {Element[]} */
  const elements = [...content.querySelectorAll("h2, h3, img")];

  for (const el of elements) {
    if (el.tagName === "H2" || el.tagName === "H3") {
      if (current.images.length > 0 || current.heading !== "All Images") {
        sections.push(current);
      }
      current = { heading: el.textContent?.trim() ?? "", images: [] };
    } else if (el.tagName === "IMG") {
      const src = el.getAttribute("src") ?? el.getAttribute("data-src") ?? "";
      if (!src || src.includes("logo") || src.includes("icon")) continue;
      const fullSrc = src.startsWith("http") ? src : `https://www.giantbomb.com${src}`;
      current.images.push({
        src: fullSrc.replace(/\/square_avatar\//, "/scale_large/").replace(/\/thumb\//, "/scale_large/"),
        alt: el.getAttribute("alt") ?? "",
      });
    }
  }

  if (current.images.length > 0) {
    sections.push(current);
  }

  if (sections.length === 0) {
    const imgs = [...doc.querySelectorAll("img")]
      .map((img) => {
        const src = img.getAttribute("src") ?? "";
        if (!src || src.includes("logo")) return null;
        const fullSrc = src.startsWith("http") ? src : `https://www.giantbomb.com${src}`;
        return {
          src: fullSrc.replace(/\/square_avatar\//, "/scale_large/").replace(/\/thumb\//, "/scale_large/"),
          alt: img.getAttribute("alt") ?? "",
        };
      })
      .filter(Boolean);
    if (imgs.length > 0) {
      sections.push({ heading: "All Images", images: imgs });
    }
  }

  return sections;
}

/**
 * @param {string} sectionHeading
 * @param {string[]} aliases
 */
function sectionMatches(sectionHeading, aliases) {
  const lower = sectionHeading.toLowerCase();
  return aliases.some((alias) => lower.includes(alias.toLowerCase()));
}

/**
 * @param {{ heading: string, images: { src: string }[] }[]} sections
 * @param {string[]} aliases
 */
function findImageInSections(sections, aliases) {
  for (const section of sections) {
    if (sectionMatches(section.heading, aliases) && section.images.length > 0) {
      return section.images[0].src;
    }
  }
  for (const section of sections) {
    for (const img of section.images) {
      if (aliases.some((alias) => img.alt?.toLowerCase().includes(alias.toLowerCase()))) {
        return img.src;
      }
    }
  }
  return null;
}

/**
 * @param {import('./data/platforms.js').Platform} platform
 * @param {string} imageType
 * @param {{ heading: string, images: { src: string, alt: string }[] }[]} sections
 */
export function pickImageForType(platform, imageType, sections) {
  const aliases = platform.imageSectionAliases?.[imageType] ?? [imageType];
  const found = findImageInSections(sections, aliases);
  if (found) return found;

  for (const section of sections) {
    if (section.images.length > 0) return section.images[0].src;
  }

  return null;
}

/**
 * @param {string} wikiSlug
 * @param {string} platformId
 * @param {string} imageType
 * @returns {Promise<{ url: string|null, failed: boolean }>}
 */
export async function fetchGameImage(wikiSlug, platformId, imageType) {
  const platform = platformById[platformId];
  if (!platform) return { url: null, failed: true };

  const url = wikiImagesUrl(wikiSlug);

  try {
    const response = await fetch(url, {
      mode: "cors",
      headers: { Accept: "text/html" },
    });

    if (!response.ok) {
      return { url: PLACEHOLDER_SVG, failed: true };
    }

    const html = await response.text();
    const sections = parseWikiImagesPage(html);
    const imageUrl = pickImageForType(platform, imageType, sections);

    if (!imageUrl) {
      return { url: PLACEHOLDER_SVG, failed: true };
    }

    return { url: imageUrl, failed: false };
  } catch {
    return { url: PLACEHOLDER_SVG, failed: true };
  }
}

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      const fallback = new Image();
      fallback.onload = () => resolve(fallback);
      fallback.onerror = reject;
      fallback.src = PLACEHOLDER_SVG;
    };
    img.src = src;
  });
}
