import { loadSettings, loadCollection } from "./storage.js";
import { normalizeImageTypePriority } from "./imageSettings.js";

/**
 * @typedef {Object} Card
 * @property {string} id
 * @property {string} platformId
 * @property {string} gameName
 * @property {number} raGameId
 * @property {string} imageType
 * @property {boolean} [imageFailed]
 */

/**
 * @typedef {import('./platformDefaults.js').PlatformDefaults} PlatformDefaults
 */

/**
 * @typedef {Object} AppSettings
 * @property {Record<string, PlatformDefaults>} platformDefaults
 * @property {string} selectedPlatformId
 */

/** @type {AppSettings} */
export let settings = loadSettings();

/** @type {Card[]} */
export let collection = loadCollection();

/** @type {Set<string>} */
export let selectedCardIds = new Set();

/** @type {string|null} */
export let previewCardId = collection.length > 0 ? collection[collection.length - 1].id : null;

/** @type {Set<(event: string) => void>} */
const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(event) {
  listeners.forEach((fn) => fn(event));
}

export function getSettings() {
  return settings;
}

/** @deprecated Use getCollection */
export function getDeck() {
  return collection;
}

export function getCollection() {
  return collection;
}

export function getSelectedCardIds() {
  return selectedCardIds;
}

export function getSelectedCards() {
  return collection.filter((card) => selectedCardIds.has(card.id));
}

export function getPreviewCard() {
  if (!previewCardId) return null;
  return collection.find((card) => card.id === previewCardId) ?? null;
}

/** @deprecated Use getPreviewCard */
export function getSelectedCard() {
  return getPreviewCard();
}

/**
 * @param {Partial<AppSettings>} patch
 */
export function updateSettings(patch) {
  settings = { ...settings, ...patch };
  emit("settings");
}

/**
 * @param {string} platformId
 * @param {string} color
 */
export function setPlatformColor(platformId, color) {
  const current = settings.platformDefaults[platformId];
  if (!current) return;

  settings = {
    ...settings,
    platformDefaults: {
      ...settings.platformDefaults,
      [platformId]: { ...current, color },
    },
  };
  emit("settings");
}

/**
 * @param {string} platformId
 * @param {string[]} priority
 */
export function setPlatformImageTypePriority(platformId, priority) {
  const current = settings.platformDefaults[platformId];
  if (!current) return;

  settings = {
    ...settings,
    platformDefaults: {
      ...settings.platformDefaults,
      [platformId]: {
        ...current,
        imageTypePriority: normalizeImageTypePriority(priority),
      },
    },
  };
  emit("settings");
}

/**
 * @param {string} platformId
 * @param {string} imageType
 * @param {number} degrees
 */
export function setPlatformImageRotation(platformId, imageType, degrees) {
  const current = settings.platformDefaults[platformId];
  if (!current) return;

  settings = {
    ...settings,
    platformDefaults: {
      ...settings.platformDefaults,
      [platformId]: {
        ...current,
        imageRotation: {
          ...current.imageRotation,
          [imageType]: degrees,
        },
      },
    },
  };
  emit("settings");
}

/**
 * @param {Card} card
 */
export function addCard(card) {
  collection = [...collection, card];
  selectedCardIds = new Set([card.id]);
  previewCardId = card.id;
  emit("collection");
}

/**
 * @param {string} cardId
 * @param {Partial<Card>} patch
 */
export function updateCard(cardId, patch) {
  collection = collection.map((c) => (c.id === cardId ? { ...c, ...patch } : c));
  emit("collection");
}

export function removeCard(cardId) {
  collection = collection.filter((c) => c.id !== cardId);
  selectedCardIds = new Set([...selectedCardIds].filter((id) => id !== cardId));
  if (previewCardId === cardId) {
    previewCardId = collection.length > 0 ? collection[collection.length - 1].id : null;
    emit("selection");
  }
  emit("collection");
}

export function removeCards(cardIds) {
  const removeSet = new Set(cardIds);
  collection = collection.filter((c) => !removeSet.has(c.id));
  selectedCardIds = new Set([...selectedCardIds].filter((id) => !removeSet.has(id)));
  if (previewCardId && removeSet.has(previewCardId)) {
    previewCardId = collection.length > 0 ? collection[collection.length - 1].id : null;
    emit("selection");
  }
  emit("collection");
}

export function toggleCardSelection(cardId) {
  if (!collection.some((card) => card.id === cardId)) return;
  const next = new Set(selectedCardIds);
  if (next.has(cardId)) next.delete(cardId);
  else next.add(cardId);
  selectedCardIds = next;
  emit("selection");
}

/**
 * @param {string} cardId
 * @param {{ toggle?: boolean, extend?: boolean }} [options]
 */
export function selectCard(cardId, options = {}) {
  if (!collection.some((card) => card.id === cardId)) return;

  if (options.toggle) {
    const next = new Set(selectedCardIds);
    if (next.has(cardId)) next.delete(cardId);
    else next.add(cardId);
    selectedCardIds = next;
  } else if (options.extend) {
    selectedCardIds = new Set([...selectedCardIds, cardId]);
  } else {
    selectedCardIds = new Set([cardId]);
  }

  previewCardId = cardId;
  emit("selection");
}

export function setSelectedCardIds(cardIds) {
  selectedCardIds = new Set(cardIds);
  emit("selection");
}

export function clearSelection() {
  selectedCardIds = new Set();
  emit("selection");
}

export function setPreviewCardId(cardId) {
  if (!collection.some((card) => card.id === cardId)) return;
  previewCardId = cardId;
  emit("selection");
}

/**
 * @param {Card[]} cards
 */
export function replaceCollection(cards) {
  collection = cards;
  const validIds = new Set(cards.map((c) => c.id));
  selectedCardIds = new Set([...selectedCardIds].filter((id) => validIds.has(id)));
  if (previewCardId && !validIds.has(previewCardId)) {
    previewCardId = cards.length > 0 ? cards[cards.length - 1].id : null;
  }
  emit("collection");
}

export function clearCollection() {
  collection = [];
  selectedCardIds = new Set();
  previewCardId = null;
  emit("collection");
}

/** @deprecated */
export function clearDeck() {
  clearCollection();
}

export function createCardId() {
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
