#!/usr/bin/env node

import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadEnvFile } from "./load-env.mjs";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "nfc-load-env-"));
const envPath = path.join(tempRoot, ".env");

try {
  delete process.env.LOAD_ENV_TEST_BUCKET;
  delete process.env.LOAD_ENV_TEST_REGION;

  await writeFile(
    envPath,
    "LOAD_ENV_TEST_BUCKET=zaparoo.therealbenforce.com\nLOAD_ENV_TEST_REGION=us-east-1\n",
    "utf8",
  );

  loadEnvFile(envPath);

  if (process.env.LOAD_ENV_TEST_BUCKET !== "zaparoo.therealbenforce.com") {
    throw new Error("Expected LOAD_ENV_TEST_BUCKET from .env");
  }

  process.env.LOAD_ENV_TEST_REGION = "eu-west-1";
  loadEnvFile(envPath);
  if (process.env.LOAD_ENV_TEST_REGION !== "eu-west-1") {
    throw new Error("loadEnvFile should not override existing environment variables");
  }

  console.log("✓ load-env reads .env into process.env");
  console.log("✓ existing environment variables are preserved");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
