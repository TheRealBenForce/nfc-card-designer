/**
 * Load .env from the project root into process.env.
 * Existing environment variables are not overwritten.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
function parseEnvValue(value) {
  let trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1);
  }
  return trimmed;
}

export function loadEnvFile(envFilePath = path.join(root, ".env")) {
  if (!existsSync(envFilePath)) return false;

  const text = decodeEnvFile(readFileSync(envFilePath));
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    if (!key || process.env[key]?.trim()) continue;

    process.env[key] = parseEnvValue(trimmed.slice(eq + 1));
  }

  return true;
}

loadEnvFile();
