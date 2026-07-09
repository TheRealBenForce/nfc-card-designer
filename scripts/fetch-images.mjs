#!/usr/bin/env node
/**
 * Upload libretro thumbnail files from a local mirror to S3 using libretro directory paths.
 *
 * Requires --libretro-dir=<path to local thumbnails root>.
 *
 * Examples:
 *   npm run fetch-images -- --libretro-dir=/path/to/thumbnails --platform=nes
 *   npm run fetch-images -- --libretro-dir=/path/to/thumbnails --local-only
 */

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { LIBRETRO_IMAGE_FOLDERS } from "../src/assets/js/libretroThumbnails.js";
import { isRetailRelease } from "./game-filters.mjs";
import {
  LIBRETRO_IMAGE_ASSET_PREFIX,
  libretroImageObjectKey,
} from "./libretro-image-paths.mjs";
import { directoryExists } from "./local-libretro-source.mjs";
import { loadDotEnv } from "./load-env.mjs";
import { imagePresent, s3BucketFromEnv, uploadBufferToS3 } from "./s3-storage.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs() {
  const platformArg = process.argv.find((arg) => arg.startsWith("--platform="));
  const libretroDirArg = process.argv.find((arg) => arg.startsWith("--libretro-dir="));
  return {
    platformId: platformArg?.split("=")[1],
    libretroDir: libretroDirArg?.split("=")[1]?.trim() ?? null,
    force: process.argv.includes("--force"),
    localOnly: process.argv.includes("--local-only"),
    includeNonRetail: process.argv.includes("--include-non-retail"),
  };
}

/**
 * @param {string} name
 */
function shouldIncludeFilename(name, includeNonRetail) {
  if (!name) return false;
  if (name.includes("[") || /\b(Beta|Demo|Proto|Pirate|Unl)\b/i.test(name)) return false;
  if (!includeNonRetail && !isRetailRelease(name)) return false;
  return true;
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

async function main() {
  await loadDotEnv();

  const { platformId, libretroDir, force, localOnly, includeNonRetail } = parseArgs();
  if (!libretroDir) {
    throw new Error("--libretro-dir is required (path to local libretro thumbnails root).");
  }

  const localLibretroRoot = path.resolve(libretroDir);
  if (!(await directoryExists(localLibretroRoot))) {
    throw new Error(`--libretro-dir does not exist or is not a directory: ${localLibretroRoot}`);
  }

  const bucket = s3BucketFromEnv();
  const uploadToS3 = Boolean(bucket) && !localOnly;
  if (!uploadToS3 && !localOnly) {
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

  const stats = { uploaded: 0, copied: 0, skipped: 0, failed: 0 };

  console.log(`Local libretro source: ${localLibretroRoot}`);
  if (uploadToS3) {
    console.log(`Upload target: s3://${bucket}/\n`);
  } else {
    console.log(`Copy target: ${path.join(root, "src/assets/images/")}\n`);
  }

  for (const platform of selectedPlatforms) {
    console.log(`=== ${platform.name} (${platform.id}) ===`);

    for (const [imageType, imageFolder] of Object.entries(LIBRETRO_IMAGE_FOLDERS)) {
      const files = await listLocalPngFiles(localLibretroRoot, platform.libretroPlaylist, imageFolder);
      console.log(`  ${imageFolder}: ${files.length} file(s)`);

      for (const file of files) {
        const libretroName = file.replace(/\.png$/i, "");
        if (!shouldIncludeFilename(libretroName, includeNonRetail)) {
          stats.skipped += 1;
          continue;
        }

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
            checkLocal: true,
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

        if (localOnly || !uploadToS3) {
          const { mkdir, writeFile } = await import("node:fs/promises");
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
  }

  console.log(
    `\nDone. uploaded=${stats.uploaded}, copied=${stats.copied}, skipped=${stats.skipped}, failed=${stats.failed}`,
  );
  console.log("Run npm run sync-image-manifest to refresh image-manifest.json.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
