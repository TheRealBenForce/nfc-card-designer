#!/usr/bin/env node
/**
 * Verify RetroAchievements API credentials.
 * Auth matches the working pattern: API key in query param `y` only.
 */

import { loadRaApiKey, maskSecret } from "./env.js";
import { raFetch } from "./ra-api.mjs";

async function main() {
  const apiKey = await loadRaApiKey();

  console.log("Testing RetroAchievements API credentials…");
  console.log(`  API key: ${maskSecret(apiKey)}`);
  console.log("  Auth: query param y only (no username)\n");

  try {
    const topTen = await raFetch("API_GetTopTenUsers.php");
    const first = topTen[0];
    console.log("Success! API authentication works.");
    if (first?.["1"]) {
      console.log(`  Top user: ${first["1"]} (${first["2"]} pts)`);
    } else if (first?.username) {
      console.log(`  Top user: ${first.username}`);
    } else {
      console.log(`  Received ${topTen.length} ranked users.`);
    }
  } catch (err) {
    console.error("Authentication failed.");
    console.error(err instanceof Error ? err.message : err);
    console.error(`
Set your Web API Key in .env (either name works):

  RETROACHIEVEMENTS_API_KEY=your_key_here
  RA_API_KEY=your_key_here

Get the key from https://retroachievements.org/controlpanel.php → Settings → Keys → Web API Key

PowerShell bypass:
  $env:RETROACHIEVEMENTS_API_KEY="your_key"
  npm run test-ra-auth
`);
    process.exit(1);
  }
}

main();
