import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @param {Buffer} buffer
 */
export function decodeEnvBuffer(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { text: buffer.toString("utf16le"), encoding: "utf-16le" };
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { text: buffer.toString("utf8").slice(1), encoding: "utf-8-bom" };
  }
  return { text: buffer.toString("utf8"), encoding: "utf-8" };
}

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

/**
 * @param {string} value
 */
export function sanitizeApiKey(value) {
  return value.replace(/\s+/g, "");
}

/**
 * @param {string} value
 */
export function inspectSecret(value, label) {
  const lines = [`${label}:`];
  lines.push(`  length: ${value.length}`);
  lines.push(`  first code: ${value.charCodeAt(0)} (${JSON.stringify(value[0])})`);
  lines.push(`  last code: ${value.charCodeAt(value.length - 1)} (${JSON.stringify(value.at(-1))})`);
  if (/\s/.test(value)) {
    lines.push("  warning: contains whitespace — will be stripped for API calls");
  }
  if (!/^[A-Za-z0-9]+$/.test(value)) {
    lines.push("  warning: contains non-alphanumeric characters");
  }
  return lines.join("\n");
}

export async function loadRaCredentials() {
  let username = process.env.RA_USERNAME?.trim();
  let apiKey = process.env.RA_API_KEY?.trim();
  let encoding = "environment";

  if (!username || !apiKey) {
    const envPath = path.join(root, ".env");
    if (!existsSync(envPath)) {
      throw new Error(
        "Missing .env file. Copy .env.example to .env and set RA_USERNAME and RA_API_KEY.",
      );
    }

    const buffer = await readFile(envPath);
    const decoded = decodeEnvBuffer(buffer);
    encoding = decoded.encoding;
    const vars = parseEnvText(decoded.text);

    username = username || vars.RA_USERNAME?.trim();
    apiKey = apiKey || vars.RA_API_KEY?.trim();
  }

  if (!apiKey) {
    throw new Error("RA_API_KEY is required in .env or environment");
  }

  if (!username) {
    throw new Error(
      "RA_USERNAME is required in .env (your RetroAchievements login username).",
    );
  }

  const rawKey = apiKey;
  apiKey = sanitizeApiKey(apiKey);

  return { username, apiKey, rawKey, encoding };
}

/**
 * @param {string} value
 */
export function maskSecret(value) {
  if (!value || value.length < 8) return "(too short)";
  return `${value.slice(0, 4)}…${value.slice(-4)} (${value.length} chars)`;
}
