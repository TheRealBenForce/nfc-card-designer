import { loadSettings, loadDeck } from "./storage.js";

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
 * @typedef {Object} AppSettings
 * @property {Record<string, string>} platformColors
 * @property {string} imageType
 * @property {string} selectedPlatformId
 */

/** @type {AppSettings} */
export let settings = loadSettings();

/** @type {Card[]} */
export let deck = loadDeck();

/** @type {number} */
export let selectedDeckIndex = deck.length > 0 ? deck.length - 1 : -1;

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

export function getDeck() {
  return deck;
}

export function getSelectedDeckIndex() {
  return selectedDeckIndex;
}

export function getSelectedCard() {
  if (selectedDeckIndex < 0 || selectedDeckIndex >= deck.length) return null;
  return deck[selectedDeckIndex];
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
  settings = {
    ...settings,
    platformColors: { ...settings.platformColors, [platformId]: color },
  };
  emit("settings");
}

/**
 * @param {Card} card
 */
export function addCard(card) {
  deck = [...deck, card];
  selectedDeckIndex = deck.length - 1;
  emit("deck");
}

/**
 * @param {string} cardId
 * @param {Partial<Card>} patch
 */
export function updateCard(cardId, patch) {
  deck = deck.map((c) => (c.id === cardId ? { ...c, ...patch } : c));
  emit("deck");
}

export function removeCard(cardId) {
  const index = deck.findIndex((c) => c.id === cardId);
  if (index === -1) return;
  deck = deck.filter((c) => c.id !== cardId);
  if (deck.length === 0) {
    selectedDeckIndex = -1;
  } else if (selectedDeckIndex >= deck.length) {
    selectedDeckIndex = deck.length - 1;
  } else if (selectedDeckIndex === index) {
    selectedDeckIndex = Math.min(index, deck.length - 1);
  }
  emit("deck");
}

export function selectDeckIndex(index) {
  if (index < -1 || index >= deck.length) return;
  selectedDeckIndex = index;
  emit("selection");
}

export function clearDeck() {
  deck = [];
  selectedDeckIndex = -1;
  emit("deck");
}

export function createCardId() {
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
