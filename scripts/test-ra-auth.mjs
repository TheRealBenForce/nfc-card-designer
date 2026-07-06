#!/usr/bin/env node

import { raFetch } from "./ra-api.mjs";

try {
  await raFetch("API_GetTopTenUsers.php");
  console.log("RetroAchievements API key is valid.");
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
