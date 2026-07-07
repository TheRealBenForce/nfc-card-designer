#!/usr/bin/env node
/**
 * S3 helpers for image hosting and site deployment.
 */

import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/** @type {S3Client | null} */
let client = null;

/**
 * @param {unknown} err
 * @returns {number | undefined}
 */
function awsStatusCode(err) {
  if (!err || typeof err !== "object" || !("$metadata" in err)) return undefined;
  return /** @type {{ $metadata?: { httpStatusCode?: number } }} */ (err).$metadata?.httpStatusCode;
}

/**
 * @param {unknown} err
 * @returns {string | undefined}
 */
function awsRequestId(err) {
  if (!err || typeof err !== "object" || !("$metadata" in err)) return undefined;
  return /** @type {{ $metadata?: { requestId?: string } }} */ (err).$metadata?.requestId;
}

/**
 * @param {unknown} err
 * @returns {string | undefined}
 */
function awsErrorCode(err) {
  if (!err || typeof err !== "object") return undefined;
  if ("Code" in err && typeof err.Code === "string") return err.Code;
  if ("code" in err && typeof err.code === "string") return err.code;
  return undefined;
}

/**
 * @param {unknown} err
 * @returns {string | undefined}
 */
function awsErrorName(err) {
  if (!err || typeof err !== "object") return undefined;
  if ("name" in err && typeof err.name === "string") return err.name;
  return undefined;
}

/**
 * @returns {string}
 */
function awsEnvSummary() {
  const accessKey = process.env.AWS_ACCESS_KEY_ID?.trim() || "";
  return [
    `AWS_REGION=${process.env.AWS_REGION?.trim() || "us-east-1 (default)"}`,
    `S3_BUCKET=${s3BucketFromEnv() || "<missing>"}`,
    `AWS_ACCESS_KEY_ID=${accessKey ? `${accessKey.slice(0, 4)}…` : "<missing>"}`,
    `AWS_SECRET_ACCESS_KEY=${process.env.AWS_SECRET_ACCESS_KEY ? "<set>" : "<missing>"}`,
  ].join(", ");
}

/**
 * @param {unknown} err
 * @param {string} context
 */
export function formatAwsError(err, context) {
  const status = awsStatusCode(err);
  const requestId = awsRequestId(err);
  const code = awsErrorCode(err);
  const name = awsErrorName(err) || "Error";
  const message =
    err && typeof err === "object" && "message" in err && typeof err.message === "string"
      ? err.message
      : String(err);

  const headline = `${context}: ${name}${message ? ` — ${message}` : ""}`;
  /** @type {string[]} */
  const details = [];
  if (code && code !== name) details.push(`code=${code}`);
  if (status) details.push(`status=${status}`);
  if (requestId) details.push(`requestId=${requestId}`);

  /** @type {string[]} */
  const hints = [];
  if (
    name === "CredentialsProviderError" ||
    code === "InvalidAccessKeyId" ||
    code === "SignatureDoesNotMatch" ||
    /credential|signature|token/i.test(message)
  ) {
    hints.push("Verify AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are correct and active.");
  }
  if (
    status === 301 ||
    code === "PermanentRedirect" ||
    /wrong region|authorization header is malformed|region/i.test(message)
  ) {
    hints.push("Check AWS_REGION matches the bucket's region.");
  }
  if (status === 403 || name === "AccessDenied" || code === "AccessDenied") {
    hints.push("Check IAM permissions include s3:ListBucket, s3:GetObject, and s3:PutObject.");
  }
  if (status === 404 || name === "NoSuchBucket" || code === "NoSuchBucket") {
    hints.push("Check S3_BUCKET exists and is spelled correctly.");
  }

  const lines = [headline];
  if (details.length > 0) lines.push(`AWS details: ${details.join(", ")}`);
  lines.push(`AWS env: ${awsEnvSummary()}`);
  if (hints.length > 0) lines.push(`Hints: ${hints.join(" ")}`);
  return lines.join("\n");
}

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
  const key = objectKey.replace(/^\/+/, "");

  try {
    await getS3Client().send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
    return true;
  } catch (err) {
    if (err && typeof err === "object" && "name" in err && err.name === "NotFound") {
      return false;
    }
    if (awsStatusCode(err) === 404) return false;
    throw new Error(formatAwsError(err, `Failed to check S3 object s3://${bucket}/${key}`), {
      cause: err instanceof Error ? err : undefined,
    });
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

  try {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
      }),
    );
  } catch (err) {
    throw new Error(formatAwsError(err, `Failed to upload ${localPath} to s3://${bucket}/${key}`), {
      cause: err instanceof Error ? err : undefined,
    });
  }
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
 * @param {{ force?: boolean }} [options]
 */
export async function imagePresent(localPath, objectKey, options = {}) {
  if (!options.force) {
    if (await localFilePresent(localPath)) return true;
    if (await s3ObjectExists(objectKey)) return true;
  }
  return false;
}
