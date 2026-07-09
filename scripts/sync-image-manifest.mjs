#!/usr/bin/env node
/**
 * Build image-manifest.json from libretro-mirrored artwork on disk and/or S3.
 *
 * Examples:
 *   npm run sync-image-manifest -- --local-only
 *   npm run sync-image-manifest -- --s3-only
 *   npm run sync-image-manifest -- --platform=nes
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildImageManifest, writeImageManifest, imageManifestPath, localSiteRoot } from "./image-manifest.mjs";
import { loadDotEnv } from "./load-env.mjs";
import { s3BucketFromEnv } from "./s3-storage.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_S3_BUCKET = "zaparoo.therealbenforce.com";

function parseArgs() {
  const platformArg = process.argv.find((arg) => arg.startsWith("--platform="));
  const bucketArg = process.argv.find((arg) => arg.startsWith("--bucket="));
  return {
    platformId: platformArg?.split("=")[1],
    bucket: bucketArg?.split("=")[1]?.trim(),
    localOnly: process.argv.includes("--local-only"),
    s3Only: process.argv.includes("--s3-only"),
  };
}

function countGames(manifest) {
  return Object.values(manifest.platforms ?? {}).reduce((sum, games) => sum + games.length, 0);
}

async function main() {
  await loadDotEnv();

  const { platformId, bucket: bucketArg, localOnly, s3Only } = parseArgs();
  if (localOnly && s3Only) {
    throw new Error("Choose either --local-only or --s3-only, not both.");
  }

  if (bucketArg) {
    process.env.S3_BUCKET = bucketArg;
  } else if (s3Only && !s3BucketFromEnv()) {
    process.env.S3_BUCKET = DEFAULT_S3_BUCKET;
  }

  const { platforms } = await import(
    pathToFileURL(path.join(root, "src/assets/js/data/platforms.js")).href
  );

  const scanLocal = !s3Only;
  const scanS3 = !localOnly;

  if (scanS3 && !s3BucketFromEnv()) {
    throw new Error(
      "S3_BUCKET is required unless --local-only is passed. Set it in .env, export it, or pass --bucket=<name>.",
    );
  }

  const manifest = await buildImageManifest(platforms, {
    localRoot: scanLocal ? localSiteRoot : undefined,
    scanS3,
    platformId,
  });

  await writeImageManifest(manifest);

  const platformCount = Object.keys(manifest.platforms).length;
  const gameCount = countGames(manifest);
  console.log(`Wrote ${imageManifestPath}`);
  console.log(`${gameCount} game(s) with artwork across ${platformCount} platform(s).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
