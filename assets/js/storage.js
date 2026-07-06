import {
  STORAGE_KEY,
  COLLECTION_STORAGE_KEY,
  DECK_STORAGE_KEY,
  DEFAULT_IMAGE_TYPE_PRIORITY,
} from "./config.js";
import { normalizeImageTypePriority } from "./imageSettings.js";
import {
  defaultPlatformDefaults,
  normalizePlatformDefaults,
} from "./platformDefaults.js";
import { platforms } from "./data/platforms.js";

/** @returns {import('./state.js').AppSettings} */
export function defaultSettings() {
  return {
    platformDefaults: defaultPlatformDefaults(),
    imageTypePriority: [...DEFAULT_IMAGE_TYPE_PRIORITY],
    selectedPlatformId: platforms[0].id,
  };
}

/** @param {import('./state.js').Card} card */
function serializeCard(card) {
  return {
    id: card.id,
    platformId: card.platformId,
    gameName: card.gameName,
    raGameId: card.raGameId,
    imageType: card.imageType,
    ...(card.imageFailed ? { imageFailed: true } : {}),
  };
}

/**
 * @param {import('./state.js').AppSettings} settings
 */
export function saveSettings(settings) {
  const exportable = {
    platformDefaults: settings.platformDefaults,
    imageTypePriority: settings.imageTypePriority,
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
    const imageTypePriority = parsed.imageTypePriority
      ? normalizeImageTypePriority(parsed.imageTypePriority)
      : parsed.imageType
        ? normalizeImageTypePriority([parsed.imageType, ...defaults.imageTypePriority])
        : defaults.imageTypePriority;

    return {
      platformDefaults: normalizePlatformDefaults(parsed.platformDefaults, parsed.platformColors),
      imageTypePriority,
      selectedPlatformId: parsed.selectedPlatformId ?? defaults.selectedPlatformId,
    };
  } catch {
    return defaultSettings();
  }
}

/**
 * @param {import('./state.js').Card[]} collection
 */
export function saveCollection(collection) {
  localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(collection.map(serializeCard)));
}

/** @returns {import('./state.js').Card[]} */
export function loadCollection() {
  try {
    const raw =
      localStorage.getItem(COLLECTION_STORAGE_KEY) ?? localStorage.getItem(DECK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((card) => {
      const { imageUrl: _removed, ...rest } = card;
      return rest;
    });
  } catch {
    return [];
  }
}

/** @deprecated */
export function saveDeck(deck) {
  saveCollection(deck);
}

/** @deprecated */
export function loadDeck() {
  return loadCollection();
}

/**
 * @param {import('./state.js').AppSettings} settings
 * @param {import('./state.js').Card[]} collection
 */
export function buildProjectData(settings, collection) {
  return {
    version: 3,
    platformDefaults: settings.platformDefaults,
    imageTypePriority: settings.imageTypePriority,
    selectedPlatformId: settings.selectedPlatformId,
    cards: collection.map(serializeCard),
  };
}

/**
 * @param {import('./state.js').AppSettings} settings
 * @param {import('./state.js').Card[]} collection
 */
export function exportProjectFile(settings, collection) {
  const blob = new Blob([JSON.stringify(buildProjectData(settings, collection), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "nfc-card-designer.json";
  a.click();
  URL.revokeObjectURL(url);
}

/** @deprecated */
export function exportSettingsFile(settings) {
  exportProjectFile(settings, []);
}

/**
 * @returns {Promise<{ settings: Partial<import('./state.js').AppSettings>, cards: import('./state.js').Card[] }>}
 */
export function importProjectFile() {
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
        const parsed = JSON.parse(await file.text());
        const cards = Array.isArray(parsed.cards)
          ? parsed.cards
          : Array.isArray(parsed.collection)
            ? parsed.collection
            : [];
        resolve({
          settings: {
            platformDefaults: normalizePlatformDefaults(parsed.platformDefaults, parsed.platformColors),
            imageTypePriority: parsed.imageTypePriority
              ? normalizeImageTypePriority(parsed.imageTypePriority)
              : parsed.imageType
                ? normalizeImageTypePriority([
                    parsed.imageType,
                    ...defaultSettings().imageTypePriority,
                  ])
                : undefined,
            selectedPlatformId: parsed.selectedPlatformId,
          },
          cards,
        });
      } catch (err) {
        reject(err);
      }
    });
    input.click();
  });
}

/** @deprecated */
export function importSettingsFile() {
  return importProjectFile().then((project) => project.settings);
}
