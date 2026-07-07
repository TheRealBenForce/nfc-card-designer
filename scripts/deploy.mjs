#!/usr/bin/env node
/**
 * Deploy the static site to S3 and invalidate CloudFront.
 */

import { spawn } from "node:child_process";
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
  ];

  console.log(`→ Syncing site to s3://${bucket}/`);
  await run("aws", ["s3", "sync", ".", `s3://${bucket}`, "--delete", ...excludes]);

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
