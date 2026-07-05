#!/usr/bin/env node
/**
 * Downloads RetroAchievements artwork into
 * assets/images/platforms/<platformId>/games/<raGameId>/ and updates games.js.
 */

import { writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getGame, delay } from "./ra-api.mjs";
import { gamesPath, writeGamesJs, gameImagePath, gameImageDir } from "./games-data.mjs";

const RA_BASE = "https://retroachievements.org";
const IMAGE_TYPES = [
  ["boxArt", "ImageBoxArt"],
  ["titleScreen", "ImageTitle"],
  ["gamePicture", "ImageIngame"],
];

function parseArgs() {
  const platformArg = process.argv.find((a) => a.startsWith("--platform="));
  return {
    platformId: platformArg?.split("=")[1],
    force: process.argv.includes("--force"),
  };
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadImage(relativePath, destPath) {
  if (!relativePath) return false;
  const url = relativePath.startsWith("http") ? relativePath : `${RA_BASE}${relativePath}`;
  const res = await fetch(url, { headers: { "User-Agent": "nfc-card-designer/1.0" } });
  if (!res.ok) return false;
  await writeFile(destPath, Buffer.from(await res.arrayBuffer()));
  return true;
}

async function main() {
  const { platformId, force } = parseArgs();
  const { games } = await import(pathToFileURL(gamesPath).href);

  const targets = platformId ? games.filter((g) => g.platformId === platformId) : games;
  if (targets.length === 0) {
    console.error(platformId ? `No games found for platform "${platformId}".` : "No games in games.js.");
    process.exit(1);
  }

  if (games.length < 100) {
    console.warn(
      `\nWarning: games.js only has ${games.length} games (starter list).\n` +
        "Run npm run fetch-game-list first to pull the full RetroAchievements catalog.\n",
    );
  }

  const stats = { downloaded: 0, skipped: 0, failed: 0, gamesDone: 0 };
  const updatedById = new Map(games.map((g) => [g.raGameId, { ...g, images: { ...g.images } }]));

  for (const game of targets) {
    const current = updatedById.get(game.raGameId);
    if (!current) continue;

    const dir = gameImageDir(game.platformId, game.raGameId);
    await mkdir(dir, { recursive: true });

    const allExist = !force && (await Promise.all(
      IMAGE_TYPES.map(([type]) => fileExists(path.join(dir, `${type}.png`))),
    )).every(Boolean);

    if (allExist) {
      for (const [type] of IMAGE_TYPES) {
        current.images[type] = gameImagePath(game.platformId, game.raGameId, type);
      }
      stats.skipped += IMAGE_TYPES.length;
      stats.gamesDone += 1;
      continue;
    }

    process.stdout.write(`[${stats.gamesDone + 1}/${targets.length}] ${game.name} (${game.raGameId})… `);

    try {
      const data = await getGame(game.raGameId);
      let gameDownloaded = 0;
      let gameFailed = 0;

      for (const [type, apiField] of IMAGE_TYPES) {
        const destPath = path.join(dir, `${type}.png`);
        const relPath = data[apiField];

        if (!force && (await fileExists(destPath))) {
          current.images[type] = gameImagePath(game.platformId, game.raGameId, type);
          stats.skipped += 1;
          continue;
        }

        if (!relPath) {
          gameFailed += 1;
          continue;
        }

        const ok = await downloadImage(relPath, destPath);
        if (ok) {
          current.images[type] = gameImagePath(game.platformId, game.raGameId, type);
          gameDownloaded += 1;
          stats.downloaded += 1;
        } else {
          gameFailed += 1;
          stats.failed += 1;
        }
      }

      console.log(`${gameDownloaded} downloaded, ${gameFailed} missing`);
      stats.gamesDone += 1;
      await delay(250);
    } catch (err) {
      console.log(`failed (${err instanceof Error ? err.message : err})`);
      stats.failed += 1;
      stats.gamesDone += 1;
      await delay(500);
    }
  }

  await writeGamesJs([...updatedById.values()].sort((a, b) => {
    if (a.platformId !== b.platformId) return a.platformId.localeCompare(b.platformId);
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  }));

  console.log(`\nDone. ${stats.downloaded} downloaded, ${stats.skipped} skipped, ${stats.failed} failed/missing`);
  console.log(`Updated ${gamesPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
