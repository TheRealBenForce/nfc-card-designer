import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @param {string} text
 */
export function parseEnvText(text) {
  let normalized = text;
  if (normalized.charCodeAt(0) === 0xfeff) {
    normalized = normalized.slice(1);
  }

  /** @type {Record<string, string>} */
  const vars = {};

  for (const line of normalized.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    vars[key] = value;
  }

  return vars;
}

export async function loadRaCredentials() {
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) {
    throw new Error(
      "Missing .env file. Copy .env.example to .env and set RA_USERNAME and RA_API_KEY.",
    );
  }

  const text = await readFile(envPath, "utf8");
  const vars = parseEnvText(text);

  const username = vars.RA_USERNAME?.trim();
  const apiKey = vars.RA_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("RA_API_KEY is required in .env");
  }

  if (!username) {
    throw new Error(
      "RA_USERNAME is required in .env (your RetroAchievements login username).",
    );
  }

  return { username, apiKey };
}

/**
 * @param {string} value
 */
export function maskSecret(value) {
  if (!value || value.length < 8) return "(too short)";
  return `${value.slice(0, 4)}…${value.slice(-4)} (${value.length} chars)`;
}
