#!/usr/bin/env node
/**
 * Project verification — run before finishing UI or script changes.
 * Usage: npm run verify
 */

import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.VERIFY_PORT ?? "8765";
const BASE = `http://localhost:${PORT}`;

/** @param {string} cmd @param {string[]} args @param {import('node:child_process').SpawnOptions} [opts] */
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", ...opts });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

/** @param {string} dir */
async function collectJsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  /** @type {string[]} */
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collectJsFiles(full)));
    else if (entry.name.endsWith(".js") || entry.name.endsWith(".mjs")) files.push(full);
  }
  return files;
}

/** @param {import('node:child_process').ChildProcess} server */
function stopServer(server) {
  if (!server.killed) server.kill("SIGTERM");
}

async function main() {
  console.log("→ Syntax check…");
  const jsFiles = [
    ...(await collectJsFiles(path.join(root, "assets/js"))),
    ...(await collectJsFiles(path.join(root, "scripts"))),
  ];
  for (const file of jsFiles) {
    await run("node", ["--check", file]);
  }
  console.log(`  ${jsFiles.length} files OK\n`);

  console.log("→ PDF layout…");
  await run("node", ["scripts/test-pdf-layout.mjs"]);

  console.log("→ Collection tree…");
  await run("node", ["scripts/test-collection-tree.mjs"]);

  console.log("→ Image lookup…");
  await run("node", ["scripts/test-image-lookup.mjs"]);

  console.log("→ Game catalog JSON…");
  await run("node", ["scripts/test-game-catalog.mjs"]);

  console.log("→ UI smoke test (platform search)…");
  const server = spawn("npx", ["--yes", "serve", "-l", PORT], {
    cwd: root,
    stdio: "ignore",
    detached: false,
  });

  try {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(BASE);
        if (res.ok) break;
      } catch {
        // server not ready
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    const res = await fetch(BASE);
    if (!res.ok) throw new Error(`Server not ready at ${BASE}`);

    await run("node", ["scripts/test-platform-search.mjs"], {
      env: { ...process.env, TEST_BASE_URL: BASE },
    });

    await run("node", ["scripts/test-card-render.mjs"], {
      env: { ...process.env, TEST_BASE_URL: BASE },
    });

    await run("node", ["scripts/test-game-search.mjs"], {
      env: { ...process.env, TEST_BASE_URL: BASE },
    });
  } finally {
    stopServer(server);
  }

  console.log("\n✓ verify passed");
}

main().catch((err) => {
  console.error("\n✗ verify failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
