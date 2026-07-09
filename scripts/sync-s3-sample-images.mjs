#!/usr/bin/env node
/**
 * Download a small random local image cache from S3 for development.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { readImageManifest } from "./image-manifest.mjs";
import { getS3Client, localFilePresent, s3BucketFromEnv } from "./s3-storage.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SAMPLE_COUNT = 10;
const DEFAULT_BUCKET = "zaparoo.therealbenforce.com";

function parseArgs() {
  const countArg = process.argv.find((arg) => arg.startsWith("--count="));
  const platformArg = process.argv.find((arg) => arg.startsWith("--platform="));
  const bucketArg = process.argv.find((arg) => arg.startsWith("--bucket="));

  const count = countArg ? Number(countArg.split("=")[1]) : DEFAULT_SAMPLE_COUNT;
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`--count must be a positive integer (got "${countArg ?? count}")`);
  }

  const platformIds = platformArg
    ? platformArg
        .split("=")[1]
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : null;

  const bucket = bucketArg?.split("=")[1]?.trim() || s3BucketFromEnv() || DEFAULT_BUCKET;
  return {
    count,
    platformIds,
    bucket,
    force: process.argv.includes("--force"),
  };
}

/**
 * @template T
 * @param {T[]} values
 */
function shuffled(values) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * @param {unknown} err
 */
function isNotFound(err) {
  if (!err || typeof err !== "object") return false;
  if ("name" in err && (err.name === "NoSuchKey" || err.name === "NotFound")) return true;
  if ("$metadata" in err) {
    const status = /** @type {{ $metadata?: { httpStatusCode?: number } }} */ (err).$metadata
      ?.httpStatusCode;
    if (status === 404) return true;
  }
  return false;
}

/**
 * @param {any} body
 * @returns {Promise<Buffer>}
 */
async function bodyToBuffer(body) {
  if (!body) throw new Error("Empty S3 object body");
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body.transformToByteArray === "function") {
    return Buffer.from(await body.transformToByteArray());
  }
  throw new Error("Unsupported S3 object body type");
}

async function main() {
  const { count, platformIds, bucket, force } = parseArgs();
  process.env.S3_BUCKET = bucket;

  const manifest = await readImageManifest();
  const selectedPlatformIds = platformIds ?? Object.keys(manifest.platforms ?? {});

  let downloaded = 0;
  let skipped = 0;

  for (const platformId of selectedPlatformIds) {
    const games = manifest.platforms?.[platformId] ?? [];
    const sampleGames = shuffled(games).slice(0, count);

    for (const game of sampleGames) {
      for (const objectKey of Object.values(game.images ?? {})) {
        if (!objectKey) continue;

        const localPath = path.join(root, "src", objectKey);
        if (!force && (await localFilePresent(localPath))) {
          skipped += 1;
          continue;
        }

        try {
          const response = await getS3Client().send(
            new GetObjectCommand({
              Bucket: bucket,
              Key: objectKey,
            }),
          );
          const body = await bodyToBuffer(response.Body);
          await mkdir(path.dirname(localPath), { recursive: true });
          await writeFile(localPath, body);
          downloaded += 1;
        } catch (err) {
          if (isNotFound(err)) continue;
          throw err;
        }
      }
    }
  }

  console.log(`Downloaded ${downloaded} file(s), skipped ${skipped} existing file(s).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
