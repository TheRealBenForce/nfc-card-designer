import { spawn } from "node:child_process";
import { chromium } from "playwright";

/** @param {string} message */
function isMissingBrowserError(message) {
  return message.includes("Executable doesn't exist")
    || message.includes("Please run the following command to download new browsers");
}

function installChromium() {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["playwright", "install", "chromium"], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`playwright install chromium exited with code ${code}`));
    });
  });
}

/** @returns {Promise<import('playwright').Browser>} */
export async function launchChromium() {
  try {
    return await chromium.launch({ headless: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isMissingBrowserError(message)) throw err;

    console.log("Playwright Chromium not found — downloading browser (one-time setup)…");
    await installChromium();
    console.log("Browser installed. Retrying…");
    return chromium.launch({ headless: true });
  }
}
