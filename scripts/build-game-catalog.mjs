#!/usr/bin/env node
/**
 * Build game-catalog.json from libretro-thumbnails GitHub repos.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isRetailRelease } from "./game-filters.mjs";
import {
  buildArtworkIndex,
  buildArtworkIndexFromBoxartNames,
  dedupeRegionalVariants,
} from "./region-dedup.mjs";
import { playlistToGitHubRepo } from "../src/assets/js/libretroThumbnails.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "src/assets/data/game-catalog.json");
const GITHUB_API = "https://api.github.com";
const BOXART_PREFIX = "Named_Boxarts/";
const USER_AGENT = "nfc-card-designer";

/**
 * @param {{ path: string, type?: string }[]} tree
 * @returns {string[]}
 */
export function parseBoxartNamesFromTree(tree) {
  /** @type {string[]} */
  const names = [];
  for (const entry of tree) {
    if (entry.type && entry.type !== "blob") continue;
    if (!entry.path?.startsWith(BOXART_PREFIX) || !entry.path.endsWith(".png")) continue;
    const filename = entry.path.slice(BOXART_PREFIX.length);
    names.push(filename.replace(/\.png$/i, ""));
  }
  return names;
}

/**
 * @param {string[]} names
 * @param {Map<string, Set<string>>} artworkIndex
 * @returns {string[]}
 */
export function filterRetailBoxartNames(names, artworkIndex) {
  const retail = [...new Set(names.filter((name) => isRetailRelease(name)))];
  return dedupeRegionalVariants(retail, artworkIndex);
}

/**
 * @param {string} repo
 * @param {string} [token]
 */
async function fetchRecursiveTree(repo, token) {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${GITHUB_API}/repos/libretro-thumbnails/${encodeURIComponent(repo)}/git/trees/master?recursive=1`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub tree ${repo}: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (data.truncated) {
    throw new Error(`GitHub tree truncated for ${repo}`);
  }

  return /** @type {{ path: string, type?: string }[]} */ (data.tree ?? []);
}

/**
 * @param {string} repo
 * @param {string} [token]
 */
async function fetchBoxartsViaContents(repo, token) {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  /** @type {string[]} */
  const names = [];
  let pageUrl =
    `${GITHUB_API}/repos/libretro-thumbnails/${encodeURIComponent(repo)}/contents/${encodeURIComponent("Named_Boxarts")}?per_page=100`;

  while (pageUrl) {
    const res = await fetch(pageUrl, { headers });
    if (!res.ok) {
      throw new Error(`GitHub contents ${repo}: ${res.status} ${res.statusText}`);
    }

    const items = await res.json();
    if (!Array.isArray(items)) {
      throw new Error(`Unexpected GitHub contents response for ${repo}`);
    }

    for (const item of items) {
      if (item.type === "file" && item.name?.endsWith(".png")) {
        names.push(item.name.replace(/\.png$/i, ""));
      }
    }

    const link = res.headers.get("link");
    const next = link?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
    pageUrl = next ?? "";
  }

  return names;
}

/**
 * @param {import('../src/assets/js/data/platforms.js').Platform} platform
 * @param {string} [token]
 */
async function fetchPlatformBoxartNames(platform, token) {
  const repo = playlistToGitHubRepo(platform.libretroPlaylist);

  try {
    const tree = await fetchRecursiveTree(repo, token);
    const artworkIndex = buildArtworkIndex(tree);
    return filterRetailBoxartNames(parseBoxartNamesFromTree(tree), artworkIndex);
  } catch (error) {
    console.warn(`  ${platform.id}: recursive tree failed (${error.message}), trying contents API…`);
    const names = await fetchBoxartsViaContents(repo, token);
    const artworkIndex = buildArtworkIndexFromBoxartNames(names);
    return filterRetailBoxartNames(names, artworkIndex);
  }
}

async function main() {
  const token = process.env.GITHUB_TOKEN?.trim() || "";
  const { platforms } = await import(pathToFileURL(path.join(root, "src/assets/js/data/platforms.js")).href);

  /** @type {Record<string, { libretroName: string }[]>} */
  const platformsCatalog = {};
  let totalGames = 0;

  for (const platform of platforms) {
    process.stdout.write(`→ ${platform.name} (${platform.id})… `);
    const names = await fetchPlatformBoxartNames(platform, token);
    platformsCatalog[platform.id] = names.map((libretroName) => ({ libretroName }));
    totalGames += names.length;
    console.log(`${names.length} retail boxart titles`);
  }

  if (totalGames === 0) {
    throw new Error("No games found — catalog build failed");
  }

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    platforms: platformsCatalog,
  };

  await mkdir(path.dirname(catalogPath), { recursive: true });
  await writeFile(catalogPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`\nWrote ${catalogPath} (${totalGames} games across ${platforms.length} platforms)`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
