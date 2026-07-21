#!/usr/bin/env node
/**
 * Deploy the static site to S3 and invalidate CloudFront.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = path.join(root, "src");

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
 * Return static route names backed by src HTML files.
 * Uploading each file as a route index document allows CloudFront+S3 origins
 * to resolve URLs like /supplies and /thanks.
 * @returns {string[]}
 */
function getExtensionlessRouteAliases() {
  return ["recognition", "supplies", "thanks"];
}

async function main() {
  const bucket = process.env.S3_BUCKET?.trim();
  if (!bucket) {
    throw new Error("S3_BUCKET is required (e.g. nfc-card-designer.therealbenforce.com)");
  }

  console.log(`→ Syncing site from ${siteRoot} to s3://${bucket}/`);
  await run("aws", ["s3", "sync", "src", `s3://${bucket}`, "--delete"]);

  const extensionlessAliases = getExtensionlessRouteAliases();
  if (extensionlessAliases.length > 0) {
    console.log(`→ Publishing extensionless route aliases: ${extensionlessAliases.join(", ")}`);
    for (const route of extensionlessAliases) {
      const source = path.join("src", `${route}.html`);
      await run("aws", [
        "s3",
        "cp",
        source,
        `s3://${bucket}/${route}/index.html`,
        "--content-type",
        "text/html; charset=utf-8",
      ]);
      await run("aws", [
        "s3",
        "cp",
        source,
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
