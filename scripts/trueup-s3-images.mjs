#!/usr/bin/env node
/**
 * Scan S3 image objects against catalog IDs and optionally delete extras.
 *
 * Usage:
 *   npm run trueup-images -- --platform=nes
 *   npm run trueup-images -- --platform=nes --delete-extra --yes
 *   npm run trueup-images -- --platform=nes,atari-2600 --delete-extra --yes
 */

import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getS3Client, s3BucketFromEnv } from "./s3-storage.mjs";

const IMAGE_TYPES = ["boxArt", "titleScreen", "gamePicture"];
const MAX_DELETE_BATCH = 1000;
const PREVIEW_LIMIT = 25;

function parseArgs() {
  const platformArgs = process.argv
    .filter((arg) => arg.startsWith("--platform="))
    .flatMap((arg) => arg.slice("--platform=".length).split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    platformIds: platformArgs,
    deleteExtra: process.argv.includes("--delete-extra"),
    yes: process.argv.includes("--yes"),
  };
}

/**
 * @param {string[]} keys
 */
function uniq(keys) {
  return [...new Set(keys)];
}

/**
 * @param {string[]} values
 * @param {number} size
 */
function chunk(values, size) {
  /** @type {string[][]} */
  const chunks = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

/**
 * @param {string} label
 * @param {string[]} lines
 */
function printPreview(label, lines) {
  if (lines.length === 0) return;
  console.log(label);
  for (const line of lines.slice(0, PREVIEW_LIMIT)) {
    console.log(`  - ${line}`);
  }
  if (lines.length > PREVIEW_LIMIT) {
    console.log(`  ... ${lines.length - PREVIEW_LIMIT} more`);
  }
}

/**
 * @param {string} bucket
 * @param {string} prefix
 */
async function listAllKeys(bucket, prefix) {
  /** @type {string[]} */
  const keys = [];
  let continuationToken;

  while (true) {
    const out = await getS3Client().send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const item of out.Contents ?? []) {
      if (item.Key) keys.push(item.Key);
    }

    if (!out.IsTruncated || !out.NextContinuationToken) break;
    continuationToken = out.NextContinuationToken;
  }

  return keys;
}

/**
 * @param {string} platformId
 * @param {string[]} keys
 */
function scanPlatformKeys(platformId, keys) {
  const prefix = `assets/images/platforms/${platformId}/games/`;
  const validPattern = new RegExp(
    `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)\\/(boxArt|titleScreen|gamePicture)\\.png$`,
  );

  /** @type {Map<string, Set<string>>} */
  const typesByGameId = new Map();
  /** @type {Map<string, string[]>} */
  const keysByGameId = new Map();
  /** @type {string[]} */
  const unknownKeys = [];

  for (const key of keys) {
    const match = key.match(validPattern);
    if (match) {
      const [, gameId, imageType] = match;
      if (!typesByGameId.has(gameId)) typesByGameId.set(gameId, new Set());
      typesByGameId.get(gameId).add(imageType);
      if (!keysByGameId.has(gameId)) keysByGameId.set(gameId, []);
      keysByGameId.get(gameId).push(key);
      continue;
    }

    // Track non-standard keys under the same platform path for optional cleanup.
    if (key.startsWith(prefix)) unknownKeys.push(key);
  }

  return { typesByGameId, keysByGameId, unknownKeys };
}

/**
 * @param {string} bucket
 * @param {string[]} keys
 */
async function deleteKeys(bucket, keys) {
  let deleted = 0;
  /** @type {string[]} */
  const errors = [];

  for (const batch of chunk(keys, MAX_DELETE_BATCH)) {
    const out = await getS3Client().send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch.map((key) => ({ Key: key })),
          Quiet: true,
        },
      }),
    );
    deleted += out.Deleted?.length ?? 0;
    for (const err of out.Errors ?? []) {
      errors.push(`${err.Key ?? "<unknown>"} (${err.Code ?? "Unknown"})`);
    }
  }

  return { deleted, errors };
}

async function main() {
  const { platformIds, deleteExtra, yes } = parseArgs();
  if (deleteExtra && !yes) {
    throw new Error("Refusing to delete without --yes. Re-run with --delete-extra --yes.");
  }

  const bucket = s3BucketFromEnv();
  if (!bucket) {
    throw new Error("S3_BUCKET is required.");
  }

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const catalogPath = path.join(root, "assets/data/games-by-platform.json");
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  const catalogPlatforms = catalog.platforms ?? {};

  const targets = platformIds.length > 0 ? platformIds : Object.keys(catalogPlatforms);
  if (targets.length === 0) {
    throw new Error("No platforms found in assets/data/games-by-platform.json.");
  }

  let totalMissing = 0;
  let totalExtra = 0;
  let totalDeleted = 0;

  for (const platformId of targets) {
    const entries = Array.isArray(catalogPlatforms[platformId]) ? catalogPlatforms[platformId] : [];
    /** @type {Set<string>} */
    const expectedIds = new Set(entries.map((entry) => String(entry.raGameId)).filter(Boolean));

    const prefix = `assets/images/platforms/${platformId}/games/`;
    const keys = await listAllKeys(bucket, prefix);
    const { typesByGameId, keysByGameId, unknownKeys } = scanPlatformKeys(platformId, keys);

    const foundIds = [...typesByGameId.keys()];
    const completeIds = foundIds.filter((gameId) => IMAGE_TYPES.every((type) => typesByGameId.get(gameId)?.has(type)));
    const missing = [...expectedIds]
      .map((gameId) => ({
        gameId,
        missingTypes: IMAGE_TYPES.filter((type) => !typesByGameId.get(gameId)?.has(type)),
      }))
      .filter((row) => row.missingTypes.length > 0);
    const extraIds = foundIds.filter((gameId) => !expectedIds.has(gameId));

    totalMissing += missing.length;
    totalExtra += extraIds.length;

    console.log(`\n[${platformId}]`);
    console.log(`Catalog IDs: ${expectedIds.size}`);
    console.log(`S3 IDs with recognized images: ${foundIds.length}`);
    console.log(`Complete IDs (all ${IMAGE_TYPES.length} types): ${completeIds.length}`);
    console.log(`Missing IDs: ${missing.length}`);
    console.log(`Extra IDs (in S3, not in catalog): ${extraIds.length}`);
    if (unknownKeys.length > 0) {
      console.log(`Unknown keys under platform path: ${unknownKeys.length}`);
    }

    printPreview(
      "Missing (gameId -> missing types)",
      missing.map((row) => `${row.gameId} -> ${row.missingTypes.join(", ")}`),
    );
    printPreview("Extra game IDs", extraIds);
    printPreview("Unknown keys", unknownKeys);

    if (deleteExtra) {
      const extraKeys = uniq([
        ...extraIds.flatMap((gameId) => keysByGameId.get(gameId) ?? []),
        ...unknownKeys,
      ]);
      if (extraKeys.length === 0) {
        console.log("No extra keys to delete.");
        continue;
      }

      const { deleted, errors } = await deleteKeys(bucket, extraKeys);
      totalDeleted += deleted;
      console.log(`Deleted keys: ${deleted}/${extraKeys.length}`);
      if (errors.length > 0) {
        printPreview("Delete errors", errors);
      }
    }
  }

  console.log("\nSummary");
  console.log(`Platforms scanned: ${targets.length}`);
  console.log(`Missing catalog IDs: ${totalMissing}`);
  console.log(`Extra S3 IDs: ${totalExtra}`);
  if (deleteExtra) {
    console.log(`Deleted S3 keys: ${totalDeleted}`);
  } else {
    console.log("Dry run only (no deletions). Add --delete-extra --yes to remove extras.");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
