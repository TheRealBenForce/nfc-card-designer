#!/usr/bin/env node
/**
 * Verify RetroAchievements API credentials before running fetch-images.
 */

import { buildAuthorization, getTopTenUsers } from "@retroachievements/api";
import { loadRaCredentials, maskSecret, inspectSecret, sanitizeApiKey } from "./env.js";

const RA_API = "https://retroachievements.org/API/API_GetTopTenUsers.php";

/**
 * @param {string} label
 * @param {string} url
 * @param {RequestInit} init
 */
async function tryRawRequest(label, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": "nfc-card-designer/1.0",
      ...(init.headers ?? {}),
    },
  });
  const body = await res.text();
  return { label, status: res.status, ok: res.ok, body: body.slice(0, 200) };
}

async function main() {
  const { username, apiKey, rawKey, encoding } = await loadRaCredentials();

  console.log("Testing RetroAchievements API credentials…\n");
  console.log(`  .env encoding: ${encoding}`);
  console.log(`  RA_USERNAME:   ${username}`);
  console.log(`  RA_API_KEY:    ${maskSecret(apiKey)}`);

  if (rawKey !== apiKey) {
    console.log("\n  Note: stripped whitespace from API key before use.");
    console.log(inspectSecret(rawKey, "  raw key"));
  }

  console.log("\nTrying auth methods…\n");

  const attempts = await Promise.all([
    tryRawRequest(
      "query: y only",
      `${RA_API}?${new URLSearchParams({ y: apiKey })}`,
    ),
    tryRawRequest(
      "query: z + y",
      `${RA_API}?${new URLSearchParams({ z: username, y: apiKey })}`,
    ),
    tryRawRequest("header: X-API-Key", RA_API, {
      headers: { "X-API-Key": apiKey },
    }),
  ]);

  for (const attempt of attempts) {
    console.log(`  ${attempt.label}: HTTP ${attempt.status}`);
    if (!attempt.ok) {
      console.log(`    ${attempt.body}`);
    }
  }

  console.log("\nTrying official client library…");

  const authorization = buildAuthorization({ username, webApiKey: apiKey });

  try {
    const topTen = await getTopTenUsers(authorization);
    const first = topTen[0];
    console.log("\nSuccess! API authentication works.");
    if (first?.username) {
      console.log(`  Top user: ${first.username} (${first.totalPoints} pts)`);
    } else {
      console.log(`  Received ${topTen.length} ranked users.`);
    }
    return;
  } catch (err) {
    console.error("\nOfficial client also failed.");
    console.error(err instanceof Error ? err.message : err);
  }

  console.error(`
All authentication methods returned 401. The API key is not being accepted.

Please try this on https://retroachievements.org/controlpanel.php:

  1. Open Settings → Keys
  2. Click **Reset** on the Web API Key (not connect token)
  3. Click **Copy** immediately — do not select text manually
  4. Paste into .env as a single line:
       RA_API_KEY=paste_here
  5. Save .env as **UTF-8** (in VS Code: bottom-right encoding → UTF-8)

Verify RA_USERNAME:
  - Open https://retroachievements.org/user/${username} while logged in
  - If you get a 404, your login username may be different

Bypass .env issues (PowerShell one-liner test):
  $env:RA_USERNAME="${username}"
  $env:RA_API_KEY="paste_key_without_spaces"
  npm run test-ra-auth

Docs: https://api-docs.retroachievements.org/getting-started.html
`);
  process.exit(1);
}

main();
