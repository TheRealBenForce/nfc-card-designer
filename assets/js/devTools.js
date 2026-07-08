import { DEV_IMAGE_DELAY_MAX_MS, DEV_IMAGE_DELAY_STORAGE_KEY } from "./config.js";

/**
 * @returns {number}
 */
export function getDevImageDelayMs() {
  try {
    const raw = localStorage.getItem(DEV_IMAGE_DELAY_STORAGE_KEY);
    const value = raw ? Number(raw) : 0;
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.min(Math.round(value), DEV_IMAGE_DELAY_MAX_MS);
  } catch {
    return 0;
  }
}

/**
 * @param {number} ms
 * @returns {number}
 */
export function setDevImageDelayMs(ms) {
  const value = Math.min(Math.max(0, Math.round(ms)), DEV_IMAGE_DELAY_MAX_MS);
  localStorage.setItem(DEV_IMAGE_DELAY_STORAGE_KEY, String(value));
  return value;
}
