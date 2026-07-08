#!/usr/bin/env node
/**
 * Ensures deploy excludes protect nested game artwork paths.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const deployPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "deploy.mjs");
const source = await readFile(deployPath, "utf8");

if (!/--exclude",\s*\n\s*"assets\/images\/platforms\/\*\/games\/\*\/\*"/.test(source)) {
  throw new Error("deploy.mjs must exclude nested platform game artwork from sync/delete");
}

if (!/--exclude",\s*\n\s*"assets\/images\/games\/\*"/.test(source)) {
  throw new Error("deploy.mjs must exclude legacy flat game artwork paths");
}

if (/--exclude",\s*\n\s*"assets\/images\/\*"/.test(source)) {
  throw new Error('deploy.mjs should not use the overly broad "assets/images/*" exclude');
}

console.log("✓ deploy.mjs excludes nested game artwork from sync");
