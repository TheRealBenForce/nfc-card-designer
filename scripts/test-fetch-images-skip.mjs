#!/usr/bin/env node

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { imagePresent } from "./s3-storage.mjs";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "nfc-fetch-images-skip-"));

try {
  const objectKey = "assets/images/Nintendo - Nintendo Entertainment System/Named_Boxarts/Super Mario Bros. (USA).png";
  const localPath = path.join(tempRoot, objectKey);
  await mkdir(path.dirname(localPath), { recursive: true });

  await writeFile(localPath, "png");
  if (!(await imagePresent(localPath, objectKey, { checkLocal: true, checkRemote: false }))) {
    throw new Error("Expected non-empty PNG to be present locally");
  }

  const emptyPath = path.join(tempRoot, "empty.png");
  await writeFile(emptyPath, "");
  if (await imagePresent(emptyPath, "assets/images/empty.png", { checkLocal: true, checkRemote: false })) {
    throw new Error("Empty files should not count as present");
  }

  if (
    await imagePresent(localPath, objectKey, {
      checkLocal: true,
      checkRemote: false,
      force: true,
    })
  ) {
    throw new Error("Force mode should bypass the present check");
  }

  console.log("✓ imagePresent ignores missing and empty files");
  console.log("✓ imagePresent honors force mode");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
