#!/usr/bin/env node
/**
 * Deploy the static site to S3 and invalidate CloudFront.
 */

import { spawn } from "node:child_process";
import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @param {string} cmd @param {string[]} args */
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", cwd: root });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

/**
 * Return top-level route directories that contain an index.html file.
 * Uploading each index file to an extensionless object key allows
 * CloudFront+S3 origins to resolve URLs like /supplies and /thanks.
 * @returns {Promise<string[]>}
 */
async function getExtensionlessRouteAliases() {
  const entries = await readdir(root, { withFileTypes: true });
  const aliases = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || entry.name === "assets" || entry.name === "scripts") continue;
    const indexPath = path.join(root, entry.name, "index.html");
    try {
      await access(indexPath);
      aliases.push(entry.name);
    } catch {
      // Not a static route directory.
    }
  }
  return aliases.sort();
}

async function main() {
  const bucket = process.env.S3_BUCKET?.trim();
  if (!bucket) {
    throw new Error("S3_BUCKET is required (e.g. zaparoo.therealbenforce.com)");
  }

  const excludes = [
    "--exclude",
    ".git/*",
    "--exclude",
    ".github/*",
    "--exclude",
    "node_modules/*",
    "--exclude",
    ".env",
    "--exclude",
    ".env.*",
    "--exclude",
    "infrastructure/*",
    "--exclude",
    "docs/*",
    "--exclude",
    "scripts/*",
    "--exclude",
    "package-lock.json",
    "--exclude",
    "package.json",
    "--exclude",
    "README.md",
    "--exclude",
    "assets/images/*",
  ];

  console.log(`→ Syncing site to s3://${bucket}/`);
  await run("aws", ["s3", "sync", ".", `s3://${bucket}`, "--delete", ...excludes]);

  const extensionlessAliases = await getExtensionlessRouteAliases();
  if (extensionlessAliases.length > 0) {
    console.log(`→ Publishing extensionless route aliases: ${extensionlessAliases.join(", ")}`);
    for (const route of extensionlessAliases) {
      await run("aws", [
        "s3",
        "cp",
        `${route}/index.html`,
        `s3://${bucket}/${route}`,
        "--content-type",
        "text/html; charset=utf-8",
      ]);
    }
  }

  const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID?.trim();
  if (distributionId) {
    console.log(`→ Invalidating CloudFront distribution ${distributionId}`);
    await run("aws", [
      "cloudfront",
      "create-invalidation",
      "--distribution-id",
      distributionId,
      "--paths",
      "/*",
    ]);
  } else {
    console.log("CLOUDFRONT_DISTRIBUTION_ID not set — skipping cache invalidation");
  }

  const siteUrl = process.env.SITE_URL?.trim() ?? `https://${bucket}`;
  console.log(`\n✓ Deploy complete: ${siteUrl}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
