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

import { addInventoryEntry, parseLibretroImageKey } from "./libretro-image-paths.mjs";

/**
 * List libretro-mirrored image objects under assets/images/ in S3.
 * @param {string} [playlistFilter]
 * @param {Record<string, string>} [playlistToPlatform]
 * @returns {Promise<Record<string, Record<string, Partial<Record<string, string>>>>>>}
 */
export async function scanLibretroImagesFromS3(playlistFilter, playlistToPlatform = {}) {
  const bucket = s3BucketFromEnv();
  if (!bucket) {
    throw new Error("S3_BUCKET is required to scan remote artwork.");
  }

  /** @type {Record<string, Record<string, Partial<Record<string, string>>>>>} */
  const inventory = {};
  const prefix = playlistFilter
    ? `assets/images/${playlistFilter}/`
    : "assets/images/";

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

      const parsed = parseLibretroImageKey(key);
      if (!parsed) continue;
      if (playlistFilter && parsed.playlist !== playlistFilter) continue;
      if (Object.keys(playlistToPlatform).length > 0 && !playlistToPlatform[parsed.playlist]) {
        continue;
      }

      addInventoryEntry(inventory, {
        playlist: parsed.playlist,
        libretroName: parsed.libretroName,
        imageType: parsed.imageType,
        objectKey: key,
      });
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return inventory;
}
