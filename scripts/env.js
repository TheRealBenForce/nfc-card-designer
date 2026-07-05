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

export async function loadRaApiKey() {
  const fromEnv =
    process.env.RETROACHIEVEMENTS_API_KEY?.trim() ||
    process.env.RA_API_KEY?.trim();

  if (fromEnv) {
    return sanitizeApiKey(fromEnv);
  }

  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) {
    throw new Error(
      "Missing API key. Set RETROACHIEVEMENTS_API_KEY or RA_API_KEY in .env",
    );
  }

  const buffer = await readFile(envPath);
  const decoded = decodeEnvBuffer(buffer);
  const vars = parseEnvText(decoded.text);

  const apiKey = sanitizeApiKey(
    vars.RETROACHIEVEMENTS_API_KEY || vars.RA_API_KEY || "",
  );

  if (!apiKey) {
    throw new Error(
      "Missing API key. Set RETROACHIEVEMENTS_API_KEY or RA_API_KEY in .env",
    );
  }

  return apiKey;
}

/**
 * @param {string} value
 */
export function maskSecret(value) {
  if (!value || value.length < 8) return "(too short)";
  return `${value.slice(0, 4)}…${value.slice(-4)} (${value.length} chars)`;
}
