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
import { normalizeHeaderSettings } from "./headerSettings.js";
import { resolveCardSizing } from "./cardSizing.js";
import { normalizePlatformIconTheme } from "./platformIconTheme.js";
import { retailDisplayName } from "./retailFilter.js";
import {
  CUSTOMIZATION_CUSTOMIZED,
  CUSTOMIZATION_DEFAULT,
  inferCardCustomization,
  normalizeCardCustomization,
  toDefaultCardShape,
} from "./cardCustomization.js";

export const PROJECT_VERSION = 7;

/** @returns {import('./state.js').AppSettings} */
export function defaultSettings() {
  const cardSizing = resolveCardSizing();
  return {
    platformDefaults: defaultPlatformDefaults(),
    selectedPlatformId: "",
    platformIconTheme: normalizePlatformIconTheme(),
    ...cardSizing,
  };
}

/** @param {import('./state.js').Card} card */
function serializeCard(card) {
  const customization = card.customization === CUSTOMIZATION_CUSTOMIZED
    ? CUSTOMIZATION_CUSTOMIZED
    : CUSTOMIZATION_DEFAULT;

  if (customization === CUSTOMIZATION_DEFAULT) {
    return {
      id: card.id,
      platformId: card.platformId,
      gameName: retailDisplayName(card.libretroName),
      libretroName: card.libretroName,
      imageType: card.imageType,
      customization: CUSTOMIZATION_DEFAULT,
      ...(card.imageFailed ? { imageFailed: true } : {}),
    };
  }

  const normalizedHeaderSettings = card.headerSettings
    ? normalizeHeaderSettings(card.headerSettings)
    : undefined;

  return {
    id: card.id,
    platformId: card.platformId,
    gameName: retailDisplayName(card.libretroName),
    libretroName: card.libretroName,
    imageType: card.imageType,
    customization: CUSTOMIZATION_CUSTOMIZED,
    ...(card.imageFailed ? { imageFailed: true } : {}),
    ...(card.artworkDisplay ? { artworkDisplay: card.artworkDisplay } : {}),
    ...(card.imageRotation ? { imageRotation: normalizeRotationDegrees(card.imageRotation) } : {}),
    ...(normalizedHeaderSettings ? { headerSettings: normalizedHeaderSettings } : {}),
  };
}

/**
 * @param {unknown} card
 * @param {Record<string, import('./platformDefaults.js').PlatformDefaults>} platformDefaults
 */
export function normalizeCollectionCard(card, platformDefaults = defaultPlatformDefaults()) {
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

  const base = {
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
    ...(entry.headerSettings && typeof entry.headerSettings === "object"
      ? { headerSettings: normalizeHeaderSettings(entry.headerSettings) }
      : {}),
    ...(entry.customization === CUSTOMIZATION_CUSTOMIZED ||
    entry.customization === CUSTOMIZATION_DEFAULT
      ? { customization: entry.customization }
      : {}),
  };

  return normalizeCardCustomization(/** @type {import('./state.js').Card} */ (base), platformDefaults);
}

/**
 * @param {import('./state.js').AppSettings} settings
 */
export function saveSettings(settings) {
  const cardSizing = resolveCardSizing(settings);
  const exportable = {
    platformDefaults: settings.platformDefaults,
    selectedPlatformId: settings.selectedPlatformId,
    platformIconTheme: normalizePlatformIconTheme(settings.platformIconTheme),
    ...cardSizing,
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
    const legacyHeader = normalizeHeaderSettings(parsed);
    const cardSizing = resolveCardSizing(parsed);

    return {
      platformDefaults: normalizePlatformDefaults(
        parsed.platformDefaults,
        parsed.platformColors,
        parsed.artworkDisplay,
        legacyHeader,
      ),
      selectedPlatformId:
        typeof parsed.selectedPlatformId === "string"
          ? parsed.selectedPlatformId
          : defaults.selectedPlatformId,
      platformIconTheme: normalizePlatformIconTheme(
        parsed.platformIconTheme ?? defaults.platformIconTheme,
      ),
      ...cardSizing,
    };
  } catch {
    return defaultSettings();
  }
}

/**
 * @param {Record<string, import('./platformDefaults.js').PlatformDefaults>} [platformDefaults]
 * @returns {import('./state.js').Card[]}
 */
export function loadCollection(platformDefaults = defaultPlatformDefaults()) {
  try {
    const raw =
      localStorage.getItem(COLLECTION_STORAGE_KEY) ?? localStorage.getItem(DECK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((card) => {
        const { imageUrl: _removed, ...rest } = card;
        return normalizeCollectionCard(rest, platformDefaults);
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * @param {import('./state.js').Card[]} collection
 */
export function saveCollection(collection) {
  localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(collection.map(serializeCard)));
}

/** @deprecated */
export function saveDeck(deck) {
  saveCollection(deck);
}

/** @deprecated */
export function loadDeck() {
  return loadCollection(getSettingsPlatformDefaultsForMigration());
}

/** @returns {Record<string, import('./platformDefaults.js').PlatformDefaults>} */
function getSettingsPlatformDefaultsForMigration() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPlatformDefaults();
    const parsed = JSON.parse(raw);
    return normalizePlatformDefaults(
      parsed.platformDefaults,
      parsed.platformColors,
      parsed.artworkDisplay,
      normalizeHeaderSettings(parsed),
    );
  } catch {
    return defaultPlatformDefaults();
  }
}

/**
 * @param {import('./state.js').AppSettings} settings
 * @param {import('./state.js').Card[]} collection
 */
export function buildProjectData(settings, collection) {
  const cardSizing = resolveCardSizing(settings);
  return {
    version: PROJECT_VERSION,
    platformDefaults: settings.platformDefaults,
    selectedPlatformId: settings.selectedPlatformId,
    platformIconTheme: normalizePlatformIconTheme(settings.platformIconTheme),
    ...cardSizing,
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
        const legacyHeader = normalizeHeaderSettings(parsed);
        const platformDefaults = normalizePlatformDefaults(
          parsed.platformDefaults,
          parsed.platformColors,
          parsed.artworkDisplay,
          legacyHeader,
        );
        const cards = Array.isArray(parsed.cards)
          ? parsed.cards
          : Array.isArray(parsed.collection)
            ? parsed.collection
            : [];
        resolve({
          settings: {
            platformDefaults,
            selectedPlatformId: parsed.selectedPlatformId,
            platformIconTheme: normalizePlatformIconTheme(parsed.platformIconTheme),
            ...resolveCardSizing(parsed),
          },
          cards: cards
            .map((card) => normalizeCollectionCard(card, platformDefaults))
            .filter(Boolean),
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

/**
 * @param {import('./state.js').Card[]} collection
 * @param {string} platformId
 * @param {Record<string, import('./platformDefaults.js').PlatformDefaults>} platformDefaults
 */
export function resetDefaultCardsOnPlatform(collection, platformId, platformDefaults) {
  return collection.map((card) => {
    if (card.platformId !== platformId) return card;
    if (inferCardCustomization(card, platformDefaults) !== CUSTOMIZATION_DEFAULT) return card;
    return toDefaultCardShape(card);
  });
}
