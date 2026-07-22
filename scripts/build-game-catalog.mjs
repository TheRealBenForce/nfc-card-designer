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
import { LIBRETRO_IMAGE_FOLDERS, playlistToGitHubRepo } from "../src/assets/js/libretroThumbnails.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "src/assets/data/game-catalog.json");
const GITHUB_API = "https://api.github.com";
const BOXART_PREFIX = "Named_Boxarts/";
const USER_AGENT = "nfc-card-designer";
const IMAGE_FOLDERS = Object.values(LIBRETRO_IMAGE_FOLDERS);
const TREE_RETRY_ATTEMPTS = 3;
const TREE_RETRY_BASE_MS = 1000;

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
 * @param {string} [token]
 */
function githubHeaders(token) {
  /** @type {Record<string, string>} */
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {string} repo
 * @param {string} treeRef commit SHA, branch name, or tree SHA
 * @param {{ recursive?: boolean, token?: string }} [options]
 */
async function fetchGitTree(repo, treeRef, options = {}) {
  const recursive = options.recursive ? 1 : 0;
  const url =
    `${GITHUB_API}/repos/libretro-thumbnails/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(treeRef)}` +
    (recursive ? "?recursive=1" : "");

  const res = await fetch(url, { headers: githubHeaders(options.token) });
  if (!res.ok) {
    throw new Error(`GitHub tree ${repo}@${treeRef}: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (options.recursive && data.truncated) {
    throw new Error(`GitHub tree truncated for ${repo}@${treeRef}`);
  }

  return /** @type {{ path: string, type?: string, sha?: string }[]} */ (data.tree ?? []);
}

/**
 * Retry helper for transient GitHub 5xx / truncated recursive trees.
 * @param {() => Promise<T>} fn
 * @param {{ attempts?: number, baseMs?: number }} [options]
 * @template T
 */
export async function withTreeRetries(fn, options = {}) {
  const attempts = options.attempts ?? TREE_RETRY_ATTEMPTS;
  const baseMs = options.baseMs ?? TREE_RETRY_BASE_MS;
  /** @type {unknown} */
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = /\b5\d\d\b/.test(message) || /truncated/i.test(message);
      if (!retryable || attempt === attempts) break;
      await sleep(baseMs * 2 ** (attempt - 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * @param {string} repo
 * @param {string} [token]
 */
async function fetchRecursiveTree(repo, token) {
  return withTreeRetries(() => fetchGitTree(repo, "master", { recursive: true, token }));
}

/**
 * Rewrite flat/nested folder tree blobs into `{folder}/{filename}` paths for artwork indexing.
 * @param {string} folder
 * @param {{ path: string, type?: string }[]} folderTree
 * @returns {{ path: string, type: string }[]}
 */
export function prefixFolderTreePaths(folder, folderTree) {
  /** @type {{ path: string, type: string }[]} */
  const combined = [];
  for (const item of folderTree) {
    if (item.type && item.type !== "blob") continue;
    if (!item.path?.endsWith(".png")) continue;
    const relative = item.path.includes("/") ? item.path.split("/").pop() : item.path;
    if (!relative) continue;
    combined.push({ path: `${folder}/${relative}`, type: "blob" });
  }
  return combined;
}

/**
 * Large repos (Arcade) often 500 on full recursive trees. Fetch each image folder's
 * subtree separately and rewrite paths to `{folder}/{filename}`.
 * @param {string} repo
 * @param {string} [token]
 */
export async function fetchArtworkTreesByFolder(repo, token) {
  const rootTree = await withTreeRetries(() => fetchGitTree(repo, "master", { recursive: false, token }));
  /** @type {{ path: string, type: string }[]} */
  const combined = [];

  for (const folder of IMAGE_FOLDERS) {
    const entry = rootTree.find((item) => item.path === folder && item.type === "tree" && item.sha);
    if (!entry?.sha) {
      console.warn(`  ${repo}: missing folder ${folder}`);
      continue;
    }

    const folderTree = await withTreeRetries(() =>
      fetchGitTree(repo, entry.sha, { recursive: true, token }),
    );
    combined.push(...prefixFolderTreePaths(folder, folderTree));
  }

  if (combined.length === 0) {
    throw new Error(`No artwork files found via per-folder trees for ${repo}`);
  }

  return combined;
}

/**
 * Last-resort fallback. GitHub contents API is incomplete for directories with >1000 files.
 * @param {string} repo
 * @param {string} [token]
 */
async function fetchBoxartsViaContents(repo, token) {
  /** @type {string[]} */
  const names = [];
  let pageUrl =
    `${GITHUB_API}/repos/libretro-thumbnails/${encodeURIComponent(repo)}/contents/${encodeURIComponent("Named_Boxarts")}?per_page=100`;

  while (pageUrl) {
    const res = await fetch(pageUrl, { headers: githubHeaders(token) });
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
  } catch (treeError) {
    const treeMessage = treeError instanceof Error ? treeError.message : String(treeError);
    console.warn(`  ${platform.id}: full recursive tree failed (${treeMessage}); trying per-folder trees…`);

    try {
      const tree = await fetchArtworkTreesByFolder(repo, token);
      const artworkIndex = buildArtworkIndex(tree);
      const names = filterRetailBoxartNames(parseBoxartNamesFromTree(tree), artworkIndex);
      console.warn(`  ${platform.id}: per-folder trees recovered ${names.length} titles`);
      return names;
    } catch (folderError) {
      const folderMessage = folderError instanceof Error ? folderError.message : String(folderError);
      console.warn(
        `  ${platform.id}: per-folder trees failed (${folderMessage}); contents API last resort (incomplete for large dirs)…`,
      );
      const names = await fetchBoxartsViaContents(repo, token);
      const artworkIndex = buildArtworkIndexFromBoxartNames(names);
      const filtered = filterRetailBoxartNames(names, artworkIndex);
      console.warn(
        `  ${platform.id}: contents API returned ${filtered.length} titles (may be incomplete if Named_Boxarts has >1000 files)`,
      );
      return filtered;
    }
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

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false;

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
