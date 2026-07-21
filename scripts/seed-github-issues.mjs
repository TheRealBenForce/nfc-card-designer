#!/usr/bin/env node
/**
 * Create GitHub issues from scripts/issue-seeds/*.md
 * Usage: npm run seed-github-issues
 *
 * Requires: gh CLI authenticated with issue create permission.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seedsDir = path.join(root, "scripts/issue-seeds");

function parseSeed(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const titleLine = lines.find((line) => line.startsWith("# "));
  if (!titleLine) {
    throw new Error("Seed file must start with a # Title heading");
  }
  const title = titleLine.slice(2).trim();
  const body = lines.slice(lines.indexOf(titleLine) + 1).join("\n").trim();
  return { title, body };
}

async function main() {
  const entries = await readdir(seedsDir);
  const files = entries.filter((name) => name.endsWith(".md") && name !== "README.md").sort();

  if (files.length === 0) {
    console.log("No issue seed files found in scripts/issue-seeds/");
    return;
  }

  for (const file of files) {
    const raw = await readFile(path.join(seedsDir, file), "utf8");
    const { title, body } = parseSeed(raw);

    console.log(`→ Creating issue: ${title}`);
    const result = spawnSync(
      "gh",
      ["issue", "create", "--title", title, "--body", body, "--label", "enhancement"],
      { cwd: root, encoding: "utf8", stdio: "pipe" },
    );

    if (result.status !== 0) {
      console.error(result.stderr || result.stdout);
      process.exit(result.status || 1);
    }

    console.log(`  ${(result.stdout || "").trim()}`);
  }

  console.log(`\nCreated ${files.length} issue(s). Review on GitHub, then remove seeded .md files if desired.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
