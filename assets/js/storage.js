import { STORAGE_KEY, DECK_STORAGE_KEY, DEFAULT_IMAGE_TYPE } from "./config.js";
import { platforms } from "./data/platforms.js";

/** @returns {Record<string, string>} */
export function defaultPlatformColors() {
  return Object.fromEntries(platforms.map((p) => [p.id, p.defaultColor]));
}

/** @returns {import('./state.js').AppSettings} */
export function defaultSettings() {
  return {
    platformColors: defaultPlatformColors(),
    imageType: DEFAULT_IMAGE_TYPE,
    selectedPlatformId: platforms[0].id,
  };
}

/**
 * @param {import('./state.js').AppSettings} settings
 */
export function saveSettings(settings) {
  const exportable = {
    platformColors: settings.platformColors,
    imageType: settings.imageType,
    selectedPlatformId: settings.selectedPlatformId,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(exportable));
}

/** @returns {import('./state.js').AppSettings} */
export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw);
    const defaults = defaultSettings();
    return {
      platformColors: { ...defaults.platformColors, ...parsed.platformColors },
      imageType: parsed.imageType ?? defaults.imageType,
      selectedPlatformId: parsed.selectedPlatformId ?? defaults.selectedPlatformId,
    };
  } catch {
    return defaultSettings();
  }
}

/**
 * @param {import('./state.js').Card[]} deck
 */
export function saveDeck(deck) {
  localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(deck));
}

/** @returns {import('./state.js').Card[]} */
export function loadDeck() {
  try {
    const raw = localStorage.getItem(DECK_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * @param {import('./state.js').AppSettings} settings
 */
export function exportSettingsFile(settings) {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          platformColors: settings.platformColors,
          imageType: settings.imageType,
          selectedPlatformId: settings.selectedPlatformId,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "nfc-card-designer-settings.json";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * @returns {Promise<Partial<import('./state.js').AppSettings>>}
 */
export function importSettingsFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }
      try {
        const text = await file.text();
        resolve(JSON.parse(text));
      } catch (err) {
        reject(err);
      }
    });
    input.click();
  });
}
