import {
  STORAGE_KEY,
  COLLECTION_STORAGE_KEY,
  DECK_STORAGE_KEY,
} from "./config.js";
import {
  defaultPlatformDefaults,
  normalizePlatformDefaults,
} from "./platformDefaults.js";
import { normalizeArtworkDisplay } from "./artworkDisplay.js";
import { firstPlatformWithCatalogGames } from "./gameCatalog.js";

/** @returns {import('./state.js').AppSettings} */
export function defaultSettings() {
  return {
    platformDefaults: defaultPlatformDefaults(),
    selectedPlatformId: firstPlatformWithCatalogGames(),
    searchOnlyGamesWithImages: false,
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
    ...(card.artworkDisplay ? { artworkDisplay: card.artworkDisplay } : {}),
  };
}

/** @param {unknown} card */
function normalizeCard(card) {
  if (!card || typeof card !== "object") return null;
  const entry = /** @type {Record<string, unknown>} */ (card);
  if (
    typeof entry.id !== "string" ||
    typeof entry.platformId !== "string" ||
    typeof entry.gameName !== "string" ||
    typeof entry.raGameId !== "number" ||
    typeof entry.imageType !== "string"
  ) {
    return null;
  }

  return {
    id: entry.id,
    platformId: entry.platformId,
    gameName: entry.gameName,
    raGameId: entry.raGameId,
    imageType: entry.imageType,
    ...(entry.imageFailed ? { imageFailed: true } : {}),
    ...(entry.artworkDisplay
      ? { artworkDisplay: normalizeArtworkDisplay(entry.artworkDisplay) }
      : {}),
  };
}

/**
 * @param {import('./state.js').AppSettings} settings
 */
export function saveSettings(settings) {
  const exportable = {
    platformDefaults: settings.platformDefaults,
    selectedPlatformId: settings.selectedPlatformId,
    searchOnlyGamesWithImages: settings.searchOnlyGamesWithImages,
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
      platformDefaults: normalizePlatformDefaults(
        parsed.platformDefaults,
        parsed.platformColors,
        parsed.artworkDisplay,
      ),
      selectedPlatformId: parsed.selectedPlatformId ?? defaults.selectedPlatformId,
      searchOnlyGamesWithImages:
        typeof parsed.searchOnlyGamesWithImages === "boolean"
          ? parsed.searchOnlyGamesWithImages
          : defaults.searchOnlyGamesWithImages,
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
      return normalizeCard(rest) ?? rest;
    }).filter(Boolean);
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
    version: 4,
    platformDefaults: settings.platformDefaults,
    selectedPlatformId: settings.selectedPlatformId,
    searchOnlyGamesWithImages: settings.searchOnlyGamesWithImages,
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
            platformDefaults: normalizePlatformDefaults(
              parsed.platformDefaults,
              parsed.platformColors,
              parsed.artworkDisplay,
            ),
            selectedPlatformId: parsed.selectedPlatformId,
            searchOnlyGamesWithImages:
              typeof parsed.searchOnlyGamesWithImages === "boolean"
                ? parsed.searchOnlyGamesWithImages
                : undefined,
          },
          cards: cards.map((card) => normalizeCard(card)).filter(Boolean),
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
