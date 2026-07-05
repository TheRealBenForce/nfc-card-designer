#!/usr/bin/env node
/**
 * Verify RetroAchievements API credentials before running fetch-images.
 */

import { buildAuthorization, getTopTenUsers } from "@retroachievements/api";
import { loadRaCredentials, maskSecret } from "./env.js";

async function main() {
  const { username, apiKey } = await loadRaCredentials();

  console.log("Testing RetroAchievements API credentials…");
  console.log(`  RA_USERNAME: ${username}`);
  console.log(`  RA_API_KEY:  ${maskSecret(apiKey)}`);

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
  } catch (err) {
    console.error("\nAuthentication failed.");
    console.error(err instanceof Error ? err.message : err);
    console.error(`
Check your .env file:
  1. RA_USERNAME = your RetroAchievements LOGIN username (Settings → Account)
  2. RA_API_KEY  = Web API Key from Settings → Keys (click "Web API Key" to copy)

Docs: https://api-docs.retroachievements.org/getting-started.html

Common mistakes:
  - Using a connect/app token instead of the Web API Key
  - Extra spaces or quotes around values in .env
  - Wrong username (display name vs login name)
  - Key was reset on the website but .env still has the old key
`);
    process.exit(1);
  }
}

main();
