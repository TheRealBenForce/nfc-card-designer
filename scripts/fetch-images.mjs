#!/usr/bin/env node
/**
 * Upload libretro thumbnail files from a local mirror to S3 using libretro directory paths.
 *
 * Requires --libretro-dir=<path to local thumbnails root>.
 *
 * Examples:
 *   npm run fetch-images -- --libretro-dir=/path/to/thumbnails --platform=nes
 *   npm run fetch-images -- --libretro-dir=/path/to/thumbnails --local-only
 *   npm run fetch-images -- --libretro-dir=/path/to/thumbnails --platform=nes --max-games=25
 */

import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { LIBRETRO_IMAGE_FOLDERS } from "../src/assets/js/libretroThumbnails.js";
import { isRetailRelease } from "./game-filters.mjs";
import {
  LIBRETRO_IMAGE_ASSET_PREFIX,
  LIBRETRO_IMAGE_FOLDERS_LIST,
  libretroImageObjectKey,
} from "./libretro-image-paths.mjs";
import { directoryExists } from "./local-libretro-source.mjs";
import { loadDotEnv } from "./load-env.mjs";
import { imagePresent, s3BucketFromEnv, uploadBufferToS3 } from "./s3-storage.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localImagesRoot = path.join(root, "src/assets/images");

function parseArgs() {
  const platformArg = process.argv.find((arg) => arg.startsWith("--platform="));
  const libretroDirArg = process.argv.find((arg) => arg.startsWith("--libretro-dir="));
  const maxGamesArg = process.argv.find((arg) => arg.startsWith("--max-games="));
  const maxGamesValue = maxGamesArg ? Number(maxGamesArg.split("=")[1]) : null;

  return {
    platformId: platformArg?.split("=")[1],
    libretroDir: libretroDirArg?.split("=")[1]?.trim() ?? null,
    maxGames:
      maxGamesValue !== null && Number.isInteger(maxGamesValue) && maxGamesValue > 0
        ? maxGamesValue
        : null,
    force: process.argv.includes("--force"),
    localOnly: process.argv.includes("--local-only"),
    includeNonRetail: process.argv.includes("--include-non-retail"),
  };
}

/**
 * @param {string} name
 */
export function shouldIncludeFilename(name, includeNonRetail) {
  if (!name) return false;
  if (name.includes("[") || /\b(Beta|Demo|Proto|Pirate|Unl)\b/i.test(name)) return false;
  if (!includeNonRetail && !isRetailRelease(name)) return false;
  return true;
}

/**
 * @param {string[]} boxartBasenames filenames with or without .png
 * @param {{ includeNonRetail?: boolean, maxGames?: number | null }} [options]
 * @returns {Set<string>} libretro basenames without .png
 */
export function selectGameNamesForPlatform(boxartBasenames, options = {}) {
  const includeNonRetail = options.includeNonRetail === true;
  const names = boxartBasenames
    .map((basename) => basename.replace(/\.png$/i, ""))
    .filter((name) => shouldIncludeFilename(name, includeNonRetail))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  const limited = options.maxGames ? names.slice(0, options.maxGames) : names;
  return new Set(limited);
}

/**
 * @param {string} localRoot
 * @param {string} playlistName
 * @param {string} imageFolder
 */
async function listLocalPngFiles(localRoot, playlistName, imageFolder) {
  const dir = path.join(localRoot, playlistName, imageFolder);
  try {
    const files = await readdir(dir);
    return files.filter((file) => /\.png$/i.test(file));
  } catch {
    return [];
  }
}

/**
 * Remove empty libretro image folders for one platform under src/assets/images.
 * @param {string} playlistName
 */
export async function removeEmptyPlatformImageDirs(playlistName, imagesRoot = localImagesRoot) {
  const playlistDir = path.join(imagesRoot, playlistName);
  if (!(await directoryExists(playlistDir))) return 0;

  let removed = 0;

  for (const imageFolder of LIBRETRO_IMAGE_FOLDERS_LIST) {
    const dir = path.join(playlistDir, imageFolder);
    try {
      const entries = await readdir(dir);
      if (entries.length === 0) {
        await rm(dir, { recursive: true, force: true });
        removed += 1;
      }
    } catch {
      // folder missing
    }
  }

  try {
    const remaining = await readdir(playlistDir);
    if (remaining.length === 0) {
      await rm(playlistDir, { recursive: true, force: true });
      removed += 1;
    }
  } catch {
    // playlist folder already removed
  }

  return removed;
}

/**
 * @param {string} localRoot
 * @param {string} playlistName
 * @param {{ includeNonRetail?: boolean, maxGames?: number | null }} options
 */
async function gameNamesForPlatform(localRoot, playlistName, options) {
  const boxartFolder = LIBRETRO_IMAGE_FOLDERS.boxArt;
  const boxartFiles = await listLocalPngFiles(localRoot, playlistName, boxartFolder);
  return selectGameNamesForPlatform(boxartFiles, options);
}

/**
 * @param {string} file
 * @param {Set<string>} allowedGameNames
 */
function fileMatchesGameScope(file, allowedGameNames) {
  const libretroName = file.replace(/\.png$/i, "");
  return allowedGameNames.has(libretroName);
}

async function main() {
  await loadDotEnv();

  const { platformId, libretroDir, maxGames, force, localOnly, includeNonRetail } = parseArgs();
  if (!libretroDir) {
    throw new Error("--libretro-dir is required (path to local libretro thumbnails root).");
  }
  if (process.argv.some((arg) => arg.startsWith("--max-games=")) && !maxGames) {
    throw new Error("--max-games must be a positive integer.");
  }

  const localLibretroRoot = path.resolve(libretroDir);
  if (!(await directoryExists(localLibretroRoot))) {
    throw new Error(`--libretro-dir does not exist or is not a directory: ${localLibretroRoot}`);
  }

  const bucket = s3BucketFromEnv();
  const uploadToS3 = Boolean(bucket) && !localOnly;
  const writeLocal = localOnly || !uploadToS3;
  if (!uploadToS3 && !writeLocal) {
    throw new Error("Set S3_BUCKET to upload, or pass --local-only to copy into src/assets/images/.");
  }

  const platformsPath = path.join(root, "src/assets/js/data/platforms.js");
  const { platforms } = await import(pathToFileURL(platformsPath).href);
  const selectedPlatforms = platformId
    ? platforms.filter((platform) => platform.id === platformId)
    : platforms;

  if (selectedPlatforms.length === 0) {
    throw new Error(platformId ? `Unknown platform "${platformId}".` : "No platforms configured.");
  }

  const stats = { uploaded: 0, copied: 0, skipped: 0, failed: 0, emptyDirsRemoved: 0 };

  console.log(`Local libretro source: ${localLibretroRoot}`);
  if (uploadToS3) {
    console.log(`Upload target: s3://${bucket}/`);
  }
  if (writeLocal) {
    console.log(`Local target: ${localImagesRoot}/`);
  }
  if (maxGames) {
    console.log(`Max games per platform: ${maxGames}`);
  }
  console.log("");

  for (const platform of selectedPlatforms) {
    console.log(`=== ${platform.name} (${platform.id}) ===`);

    const allowedGameNames = await gameNamesForPlatform(localLibretroRoot, platform.libretroPlaylist, {
      includeNonRetail,
      maxGames,
    });

    console.log(
      `  Games in scope: ${allowedGameNames.size}` +
        (maxGames ? ` (max ${maxGames}, sorted by boxart name)` : " (all retail boxart entries)"),
    );

    for (const [imageType, imageFolder] of Object.entries(LIBRETRO_IMAGE_FOLDERS)) {
      const files = await listLocalPngFiles(localLibretroRoot, platform.libretroPlaylist, imageFolder);
      const filesInScope = files.filter((file) => fileMatchesGameScope(file, allowedGameNames));
      console.log(`  ${imageFolder}: ${filesInScope.length}/${files.length} file(s) in scope`);

      for (const file of filesInScope) {
        const sourcePath = path.join(
          localLibretroRoot,
          platform.libretroPlaylist,
          imageFolder,
          file,
        );
        const objectKey = libretroImageObjectKey(platform.libretroPlaylist, imageFolder, file);
        const localDestPath = path.join(root, "src", objectKey);

        if (!force) {
          const present = await imagePresent(localDestPath, objectKey, {
            checkLocal: writeLocal,
            checkRemote: uploadToS3,
          });
          if (present) {
            stats.skipped += 1;
            continue;
          }
        }

        let imageBuffer;
        try {
          const info = await stat(sourcePath);
          if (!info.isFile() || info.size === 0) {
            stats.failed += 1;
            continue;
          }
          imageBuffer = await readFile(sourcePath);
        } catch {
          stats.failed += 1;
          continue;
        }

        if (writeLocal) {
          await mkdir(path.dirname(localDestPath), { recursive: true });
          await writeFile(localDestPath, imageBuffer);
          stats.copied += 1;
        }

        if (uploadToS3) {
          const uploaded = await uploadBufferToS3(imageBuffer, objectKey);
          if (uploaded) stats.uploaded += 1;
          else stats.failed += 1;
        }
      }
    }

    const removed = await removeEmptyPlatformImageDirs(platform.libretroPlaylist);
    stats.emptyDirsRemoved += removed;
    if (removed > 0) {
      console.log(`  Removed ${removed} empty local folder(s)`);
    }
  }

  console.log(
    `\nDone. uploaded=${stats.uploaded}, copied=${stats.copied}, skipped=${stats.skipped}, ` +
      `failed=${stats.failed}, emptyDirsRemoved=${stats.emptyDirsRemoved}`,
  );
  console.log("Run npm run sync-image-manifest to refresh image-manifest.json.");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
