import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = "https://retroachievements.org/API";
const USER_AGENT = "nfc-card-designer/1.0";

async function loadApiKey() {
  if (process.env.RETROACHIEVEMENTS_API_KEY?.trim()) {
    return process.env.RETROACHIEVEMENTS_API_KEY.trim();
  }

  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) {
    throw new Error("Missing .env — set RETROACHIEVEMENTS_API_KEY (see .env.example)");
  }

  const text = await readFile(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("RETROACHIEVEMENTS_API_KEY=")) {
      return trimmed.slice("RETROACHIEVEMENTS_API_KEY=".length).trim();
    }
  }

  throw new Error("RETROACHIEVEMENTS_API_KEY not found in .env");
}

/**
 * @param {string} endpoint e.g. "API_GetGame.php"
 * @param {Record<string, string|number>} [params]
 */
export async function raFetch(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set("y", await loadApiKey());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${endpoint}`);
  }

  return response.json();
}

/** @param {number} gameId */
export async function getGame(gameId) {
  return raFetch("API_GetGame.php", { i: gameId });
}
