import {
  STORAGE_KEY,
  COLLECTION_STORAGE_KEY,
  DECK_STORAGE_KEY,
} from "./config.js";
import {
  defaultPlatformDefaults,
  normalizePlatformDefaults,
  normalizeRotationDegrees,
} from "./platformDefaults.js";
import { normalizeArtworkDisplay } from "./artworkDisplay.js";
import { legacyHeaderSettings, normalizeHeaderSettings } from "./headerSettings.js";
import { resolveCardSizing } from "./cardSizing.js";
import { normalizePlatformIconTheme } from "./platformIconTheme.js";
import { retailDisplayName } from "./retailFilter.js";

/** @returns {import('./state.js').AppSettings} */
export function defaultSettings() {
  const headerSettings = normalizeHeaderSettings();
  const cardSizing = resolveCardSizing();
  return {
    platformDefaults: defaultPlatformDefaults(),
    selectedPlatformId: "",
    platformIconTheme: normalizePlatformIconTheme(),
    ...headerSettings,
    ...cardSizing,
    ...headerSettings,
  };
}

/** @param {import('./state.js').Card} card */
function serializeCard(card) {
  const normalizedHeaderSettings = normalizeHeaderSettings(card.headerSettings);
  return {
    id: card.id,
    platformId: card.platformId,
    gameName: retailDisplayName(card.libretroName),
    libretroName: card.libretroName,
    imageType: card.imageType,
    ...(card.imageFailed ? { imageFailed: true } : {}),
    ...(card.artworkDisplay ? { artworkDisplay: card.artworkDisplay } : {}),
    ...(card.imageRotation ? { imageRotation: normalizeRotationDegrees(card.imageRotation) } : {}),
    headerSettings: normalizedHeaderSettings,
  };
}

/**
 * Normalize a saved/imported card.
 * `libretroName` is the canonical libretro filename stem used for GitHub artwork URLs.
 * `gameName` is always derived for display and may change as title cleanup rules evolve.
 *
 * @param {unknown} card
 * @param {{ showHeader?: unknown, showPlatformColor?: unknown, headerHeightPercent?: unknown } | null | undefined} [fallbackHeaderSettings]
 */
export function normalizeCollectionCard(card, fallbackHeaderSettings) {
  if (!card || typeof card !== "object") return null;
  const entry = /** @type {Record<string, unknown>} */ (card);
  if (
    typeof entry.id !== "string" ||
    typeof entry.platformId !== "string" ||
    typeof entry.libretroName !== "string" ||
    typeof entry.imageType !== "string"
  ) {
    return null;
  }

  const libretroName = entry.libretroName;
  const normalizedRotation = normalizeRotationDegrees(entry.imageRotation);
  const normalizedCardHeaderSettings = normalizeHeaderSettings(
    (entry.headerSettings && typeof entry.headerSettings === "object")
      ? entry.headerSettings
      : fallbackHeaderSettings ?? legacyHeaderSettings(),
  );

  return {
    id: entry.id,
    platformId: entry.platformId,
    gameName: retailDisplayName(libretroName),
    libretroName,
    imageType: entry.imageType,
    ...(entry.imageFailed ? { imageFailed: true } : {}),
    ...(entry.artworkDisplay
      ? { artworkDisplay: normalizeArtworkDisplay(entry.artworkDisplay) }
      : {}),
    ...(normalizedRotation ? { imageRotation: normalizedRotation } : {}),
    headerSettings: normalizedCardHeaderSettings,
  };
}

/** @param {unknown} card @param {Parameters<typeof normalizeCollectionCard>[1]} [fallbackHeaderSettings] */
function normalizeCard(card, fallbackHeaderSettings) {
  return normalizeCollectionCard(card, fallbackHeaderSettings);
}

/**
 * @param {import('./state.js').AppSettings} settings
 */
export function saveSettings(settings) {
  const headerSettings = normalizeHeaderSettings(settings);
  const cardSizing = resolveCardSizing(settings);
  const exportable = {
    platformDefaults: settings.platformDefaults,
    selectedPlatformId: settings.selectedPlatformId,
    platformIconTheme: normalizePlatformIconTheme(settings.platformIconTheme),
    ...headerSettings,
    ...cardSizing,
    ...headerSettings,
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
    const headerSettings = normalizeHeaderSettings(parsed);
    const cardSizing = resolveCardSizing(parsed);

    return {
      platformDefaults: normalizePlatformDefaults(
        parsed.platformDefaults,
        parsed.platformColors,
        parsed.artworkDisplay,
      ),
      selectedPlatformId:
        typeof parsed.selectedPlatformId === "string"
          ? parsed.selectedPlatformId
          : defaults.selectedPlatformId,
      platformIconTheme: normalizePlatformIconTheme(
        parsed.platformIconTheme ?? defaults.platformIconTheme,
      ),
      ...cardSizing,
      ...headerSettings,
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
  const headerSettings = normalizeHeaderSettings(settings);
  const cardSizing = resolveCardSizing(settings);
  return {
    version: 6,
    platformDefaults: settings.platformDefaults,
    selectedPlatformId: settings.selectedPlatformId,
    platformIconTheme: normalizePlatformIconTheme(settings.platformIconTheme),
    ...cardSizing,
    ...headerSettings,
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
        const importedHeaderSettings = normalizeHeaderSettings(parsed);
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
            platformIconTheme: normalizePlatformIconTheme(parsed.platformIconTheme),
            ...resolveCardSizing(parsed),
            ...importedHeaderSettings,
          },
          cards: cards.map((card) => normalizeCard(card, importedHeaderSettings)).filter(Boolean),
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
