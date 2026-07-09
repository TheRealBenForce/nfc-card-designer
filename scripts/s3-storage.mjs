#!/usr/bin/env node
/**
 * S3 helpers for image hosting and site deployment.
 */

import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/** @type {S3Client | null} */
let client = null;

/**
 * @returns {string | null}
 */
export function s3BucketFromEnv() {
  return process.env.S3_BUCKET?.trim() || null;
}

/**
 * @returns {S3Client}
 */
export function getS3Client() {
  if (!client) {
    client = new S3Client({
      region: process.env.AWS_REGION ?? "us-east-1",
    });
  }
  return client;
}

/**
 * @param {string} objectKey
 */
export async function s3ObjectExists(objectKey) {
  const bucket = s3BucketFromEnv();
  if (!bucket) return false;

  try {
    await getS3Client().send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: objectKey.replace(/^\/+/, ""),
      }),
    );
    return true;
  } catch (err) {
    if (err && typeof err === "object" && "name" in err && err.name === "NotFound") {
      return false;
    }
    if (err && typeof err === "object" && "$metadata" in err) {
      const status = /** @type {{ $metadata?: { httpStatusCode?: number } }} */ (err).$metadata
        ?.httpStatusCode;
      if (status === 404) return false;
    }
    throw err;
  }
}

/**
 * @param {string} localPath
 * @param {string} objectKey
 */
export async function uploadFileToS3(localPath, objectKey) {
  const bucket = s3BucketFromEnv();
  if (!bucket) return false;

  const key = objectKey.replace(/^\/+/, "");
  const body = await readFile(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const contentType = contentTypeForExtension(ext);

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    }),
  );
  return true;
}

/**
 * @param {Buffer} body
 * @param {string} objectKey
 */
export async function uploadBufferToS3(body, objectKey) {
  const bucket = s3BucketFromEnv();
  if (!bucket) return false;

  const key = objectKey.replace(/^\/+/, "");
  const ext = path.extname(key).toLowerCase();
  const contentType = contentTypeForExtension(ext);

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    }),
  );
  return true;
}

/**
 * @param {string} ext
 */
function contentTypeForExtension(ext) {
  switch (ext) {
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".json":
      return "application/json";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

/**
 * @param {string} localPath
 */
export async function localFilePresent(localPath) {
  try {
    const info = await stat(localPath);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

/**
 * @param {string} localPath
 * @param {string} objectKey
 * @param {{ force?: boolean, checkLocal?: boolean, checkRemote?: boolean }} [options]
 */
export async function imagePresent(localPath, objectKey, options = {}) {
  const checkLocal = options.checkLocal !== false;
  const checkRemote = options.checkRemote !== false;

  if (!options.force) {
    if (checkLocal && (await localFilePresent(localPath))) return true;
    if (checkRemote && (await s3ObjectExists(objectKey))) return true;
  }
  return false;
}

const GAME_IMAGE_KEY_PATTERN =
  /^assets\/images\/platforms\/([^/]+)\/games\/(\d+)\/(boxArt|titleScreen|gamePicture)\.png$/;

/**
 * List game image objects under assets/images/platforms/ in S3.
 * @param {string} [platformId]
 * @returns {Promise<Record<string, Record<string, string[]>>>}
 */
export async function scanImageAvailabilityFromS3(platformId) {
  const bucket = s3BucketFromEnv();
  if (!bucket) {
    throw new Error("S3_BUCKET is required to scan remote artwork.");
  }

  /** @type {Record<string, Record<string, string[]>>} */
  const platforms = {};
  const prefix = platformId
    ? `assets/images/platforms/${platformId}/games/`
    : "assets/images/platforms/";

  let continuationToken;
  do {
    const response = await getS3Client().send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of response.Contents ?? []) {
      const key = object.Key;
      if (!key) continue;

      const match = key.match(GAME_IMAGE_KEY_PATTERN);
      if (!match) continue;

      const [, matchedPlatformId, raGameId, type] = match;
      if (!platforms[matchedPlatformId]) platforms[matchedPlatformId] = {};
      if (!platforms[matchedPlatformId][raGameId]) platforms[matchedPlatformId][raGameId] = [];
      platforms[matchedPlatformId][raGameId].push(type);
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  for (const games of Object.values(platforms)) {
    for (const raGameId of Object.keys(games)) {
      games[raGameId] = [...new Set(games[raGameId])].sort();
    }
  }

  return platforms;
}
