import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = "https://retroachievements.org/API";
const USER_AGENT = "nfc-card-designer/1.0";

const KEY_NAMES = ["RETROACHIEVEMENTS_API_KEY", "RA_API_KEY"];

/** @param {Buffer} buffer */
function decodeEnvFile(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString("utf16le");
  }
  let text = buffer.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  return text;
}

/** @param {string} value */
function normalizeApiKey(value) {
  let trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed.replace(/\s+/g, "");
}

async function loadApiKey() {
  for (const name of KEY_NAMES) {
    const fromEnv = process.env[name];
    if (fromEnv?.trim()) {
      return normalizeApiKey(fromEnv);
    }
  }

  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) {
    throw new Error("Missing .env — set RETROACHIEVEMENTS_API_KEY (see .env.example)");
  }

  const text = decodeEnvFile(await readFile(envPath));
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    if (!KEY_NAMES.includes(key)) continue;

    const value = normalizeApiKey(trimmed.slice(eq + 1));
    if (value) return value;
  }

  throw new Error(
    "RETROACHIEVEMENTS_API_KEY not found in .env — use RETROACHIEVEMENTS_API_KEY=your_key (UTF-8, one line, no spaces around =)",
  );
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
