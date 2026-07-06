import { STORAGE_KEY, DECK_STORAGE_KEY, COLLECTION_STORAGE_KEY, DEFAULT_IMAGE_TYPE } from "./config.js";
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
    version: 1,
    platformColors: settings.platformColors,
    imageType: settings.imageType,
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
            platformColors: parsed.platformColors,
            imageType: parsed.imageType,
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
