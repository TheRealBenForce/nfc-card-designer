#!/usr/bin/env node
/**
 * Download a small random local image cache from S3 for development.
 * Defaults to 10 games per platform into:
 * assets/images/platforms/<platformId>/games/<raGameId>/<type>.png
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { gameImageDir, gameImagePath, gamesPath } from "./games-data.mjs";
import { getS3Client, localFilePresent, s3BucketFromEnv } from "./s3-storage.mjs";

const IMAGE_TYPES = ["boxArt", "titleScreen", "gamePicture"];
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
  if (typeof body[Symbol.asyncIterator] === "function") {
    const chunks = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new Error("Unsupported S3 response body type");
}

/**
 * @param {string} bucket
 * @param {string} key
 * @returns {Promise<Buffer | null>}
 */
async function downloadObject(bucket, key) {
  try {
    const output = await getS3Client().send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key.replace(/^\/+/, ""),
      }),
    );
    return await bodyToBuffer(output.Body);
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

/**
 * @param {import("../src/assets/js/data/games.js").Game} game
 */
function gameHasImageMetadata(game) {
  return IMAGE_TYPES.some((type) => Boolean(game.images?.[type]));
}

/**
 * @param {import("../src/assets/js/data/games.js").Game} game
 * @param {string} type
 */
function objectKeyForGameType(game, type) {
  return (game.images?.[type] ?? gameImagePath(game.platformId, game.raGameId, type)).replace(
    /^\/+/,
    "",
  );
}

async function main() {
  const { count, platformIds, bucket, force } = parseArgs();
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const platformsPath = path.join(root, "src/assets/js/data/platforms.js");
  const { platforms } = await import(pathToFileURL(platformsPath).href);
  const { games } = await import(pathToFileURL(gamesPath).href);

  const knownPlatforms = new Set(platforms.map((platform) => platform.id));
  const selectedPlatforms = platformIds?.length ? platformIds : platforms.map((platform) => platform.id);
  const invalidPlatforms = selectedPlatforms.filter((platformId) => !knownPlatforms.has(platformId));
  if (invalidPlatforms.length > 0) {
    throw new Error(`Unknown platform id(s): ${invalidPlatforms.join(", ")}`);
  }

  /** @type {Map<string, import("../src/assets/js/data/games.js").Game[]>} */
  const gamesByPlatform = new Map(selectedPlatforms.map((platformId) => [platformId, []]));
  for (const game of games) {
    if (gamesByPlatform.has(game.platformId)) {
      gamesByPlatform.get(game.platformId)?.push(game);
    }
  }

  let totalGamesSynced = 0;
  let totalFilesDownloaded = 0;
  console.log(`Syncing random local image samples from s3://${bucket}`);
  console.log(`Target: ${count} game(s) per platform${force ? " (force overwrite)" : ""}\n`);

  for (const platformId of selectedPlatforms) {
    const platformGames = gamesByPlatform.get(platformId) ?? [];
    if (platformGames.length === 0) {
      console.log(`${platformId}: no games found in catalog, skipping.\n`);
      continue;
    }

    const withMetadata = platformGames.filter(gameHasImageMetadata);
    const candidates = withMetadata.length > 0 ? withMetadata : platformGames;
    const randomGames = shuffled(candidates);

    let syncedGames = 0;
    let downloadedFiles = 0;
    for (const game of randomGames) {
      if (syncedGames >= count) break;

      const localDir = gameImageDir(game.platformId, game.raGameId);
      let hasAnyLocalOrDownloaded = false;
      let gameDownloads = 0;

      for (const type of IMAGE_TYPES) {
        const localPath = path.join(localDir, `${type}.png`);
        if (!force && (await localFilePresent(localPath))) {
          hasAnyLocalOrDownloaded = true;
          continue;
        }

        const key = objectKeyForGameType(game, type);
        const buffer = await downloadObject(bucket, key);
        if (!buffer) continue;

        await mkdir(localDir, { recursive: true });
        await writeFile(localPath, buffer);
        hasAnyLocalOrDownloaded = true;
        gameDownloads += 1;
        downloadedFiles += 1;
      }

      if (hasAnyLocalOrDownloaded) {
        syncedGames += 1;
        const suffix = gameDownloads > 0 ? `${gameDownloads} downloaded` : "already local";
        console.log(`  ✓ ${platformId} · ${game.name} (${game.raGameId}) — ${suffix}`);
      }
    }

    totalGamesSynced += syncedGames;
    totalFilesDownloaded += downloadedFiles;

    if (syncedGames < count) {
      console.log(
        `${platformId}: synced ${syncedGames}/${count} game(s) with local images (${downloadedFiles} new files).\n`,
      );
    } else {
      console.log(`${platformId}: synced ${syncedGames}/${count} game(s) (${downloadedFiles} new files).\n`);
    }
  }

  console.log(
    `Done. Synced ${totalGamesSynced} game sample(s) total; downloaded ${totalFilesDownloaded} new file(s).`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
