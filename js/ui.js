import { platforms } from "./data/platforms.js";
import { gamesForPlatform } from "./data/games.js";
import { platformById } from "./data/platforms.js";
import { IMAGE_TYPES } from "./config.js";
import {
  subscribe,
  getSettings,
  getDeck,
  getSelectedDeckIndex,
  getSelectedCard,
  updateSettings,
  setPlatformColor,
  addCard,
  updateCard,
  removeCard,
  selectDeckIndex,
  clearDeck,
  createCardId,
} from "./state.js";
import {
  saveSettings,
  saveDeck,
  exportSettingsFile,
  importSettingsFile,
  defaultSettings,
} from "./storage.js";
import { fetchGameImage } from "./wikiParser.js";
import { renderCard, canvasToDataUrl } from "./cardRenderer.js";
import { exportLetterPdf } from "./pdfExport.js";

/** @type {HTMLElement|null} */
let platformResultsEl = null;
/** @type {HTMLElement|null} */
let gameResultsEl = null;
/** @type {HTMLElement|null} */
let deckListEl = null;
/** @type {HTMLImageElement|null} */
let previewImageEl = null;
/** @type {HTMLElement|null} */
let previewMetaEl = null;
/** @type {HTMLElement|null} */
let statusEl = null;
/** @type {HTMLInputElement|null} */
let platformSearchInput = null;
/** @type {HTMLInputElement|null} */
let gameSearchInput = null;
/** @type {HTMLInputElement|null} */
let platformColorInput = null;
/** @type {HTMLSelectElement|null} */
let imageTypeSelect = null;

/** @type {number} */
let platformHighlightIndex = 0;
/** @type {import('./data/platforms.js').Platform[]} */
let filteredPlatforms = [...platforms];
/** @type {import('./data/games.js').Game[]} */
let filteredGames = [];

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle("status--error", isError);
}

function filterPlatforms(query) {
  const q = query.trim().toLowerCase();
  filteredPlatforms = q
    ? platforms.filter((p) => p.name.toLowerCase().includes(q))
    : [...platforms];
  platformHighlightIndex = 0;
  renderPlatformResults();
}

function filterGames(query) {
  const settings = getSettings();
  const all = gamesForPlatform(settings.selectedPlatformId);
  const q = query.trim().toLowerCase();
  filteredGames = q
    ? all.filter((g) => g.name.toLowerCase().includes(q))
    : all;
  renderGameResults();
}

function renderPlatformResults() {
  if (!platformResultsEl) return;
  const settings = getSettings();
  platformResultsEl.innerHTML = "";

  filteredPlatforms.forEach((platform, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "list-item";
    if (platform.id === settings.selectedPlatformId) btn.classList.add("list-item--selected");
    if (index === platformHighlightIndex) btn.classList.add("list-item--highlight");
    btn.innerHTML = `<span class="list-item__emoji">${platform.emoji}</span><span>${platform.name}</span>`;
    btn.addEventListener("click", () => selectPlatform(platform.id));
    platformResultsEl.appendChild(btn);
  });
}

function renderGameResults() {
  if (!gameResultsEl) return;
  gameResultsEl.innerHTML = "";

  if (filteredGames.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-hint";
    empty.textContent = "No games found for this platform.";
    gameResultsEl.appendChild(empty);
    return;
  }

  filteredGames.slice(0, 50).forEach((game) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "list-item";
    btn.textContent = game.name;
    btn.addEventListener("click", () => {
      if (gameSearchInput) gameSearchInput.value = game.name;
      addGameCard(game);
    });
    gameResultsEl.appendChild(btn);
  });
}

function selectPlatform(platformId) {
  updateSettings({ selectedPlatformId: platformId });
  saveSettings(getSettings());
  syncPlatformControls();
  filterGames(gameSearchInput?.value ?? "");
  setStatus(`Platform: ${platformById[platformId]?.name ?? platformId}`);
}

function syncPlatformControls() {
  const settings = getSettings();
  const platform = platformById[settings.selectedPlatformId];
  if (platformColorInput && platform) {
    platformColorInput.value = settings.platformColors[platform.id] ?? platform.defaultColor;
  }
  filterPlatforms(platformSearchInput?.value ?? "");
  filterGames(gameSearchInput?.value ?? "");
}

async function addGameCard(game) {
  const settings = getSettings();
  setStatus(`Loading artwork for ${game.name}…`);

  const card = {
    id: createCardId(),
    platformId: settings.selectedPlatformId,
    gameName: game.name,
    wikiSlug: game.wikiSlug,
    imageType: settings.imageType,
    imageUrl: null,
    imageFailed: false,
  };

  addCard(card);
  saveDeck(getDeck());

  const { url, failed } = await fetchGameImage(
    game.wikiSlug,
    settings.selectedPlatformId,
    settings.imageType,
  );

  updateCard(card.id, { imageUrl: url, imageFailed: failed });
  saveDeck(getDeck());

  if (gameSearchInput) {
    gameSearchInput.value = "";
    gameSearchInput.focus();
  }

  filterGames("");
  await refreshPreview();

  if (failed) {
    setStatus(`Added ${game.name} (placeholder — Giant Bomb image unavailable)`, true);
  } else {
    setStatus(`Added ${game.name}`);
  }
}

function renderDeck() {
  if (!deckListEl) return;
  const deck = getDeck();
  const selectedIndex = getSelectedDeckIndex();
  deckListEl.innerHTML = "";

  if (deck.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-hint";
    empty.textContent = "Search for a game and press Enter to add cards.";
    deckListEl.appendChild(empty);
    return;
  }

  deck.forEach((card, index) => {
    const platform = platformById[card.platformId];
    const item = document.createElement("div");
    item.className = "deck-item";
    if (index === selectedIndex) item.classList.add("deck-item--selected");

    item.innerHTML = `
      <button type="button" class="deck-item__select">
        <span class="deck-item__emoji">${platform?.emoji ?? "🎮"}</span>
        <span class="deck-item__name">${card.gameName}</span>
        ${card.imageFailed ? '<span class="deck-item__badge">placeholder</span>' : ""}
      </button>
      <button type="button" class="deck-item__remove" aria-label="Remove card">×</button>
    `;

    item.querySelector(".deck-item__select")?.addEventListener("click", async () => {
      selectDeckIndex(index);
      await refreshPreview();
    });
    item.querySelector(".deck-item__remove")?.addEventListener("click", () => {
      removeCard(card.id);
      saveDeck(getDeck());
      renderDeck();
      refreshPreview();
    });

    deckListEl.appendChild(item);
  });

  const selected = deckListEl.querySelector(".deck-item--selected");
  selected?.scrollIntoView({ block: "nearest" });
}

async function refreshPreview() {
  const card = getSelectedCard();
  if (!previewImageEl || !previewMetaEl) return;

  if (!card) {
    previewImageEl.removeAttribute("src");
    previewMetaEl.textContent = "Select or add a card to preview.";
    return;
  }

  const platform = platformById[card.platformId];
  previewMetaEl.textContent = `${card.gameName} · ${platform?.name ?? ""} · ${IMAGE_TYPES[card.imageType]?.label ?? card.imageType}`;

  const canvas = await renderCard(card, getSettings().platformColors);
  previewImageEl.src = canvasToDataUrl(canvas, 400);
  previewImageEl.alt = `Preview: ${card.gameName}`;
}

function bindEvents() {
  platformSearchInput?.addEventListener("input", (e) => {
    filterPlatforms(/** @type {HTMLInputElement} */ (e.target).value);
  });

  platformSearchInput?.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      platformHighlightIndex = Math.min(platformHighlightIndex + 1, filteredPlatforms.length - 1);
      renderPlatformResults();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      platformHighlightIndex = Math.max(platformHighlightIndex - 1, 0);
      renderPlatformResults();
    } else if (e.key === "Enter" && filteredPlatforms[platformHighlightIndex]) {
      e.preventDefault();
      selectPlatform(filteredPlatforms[platformHighlightIndex].id);
    }
  });

  gameSearchInput?.addEventListener("input", (e) => {
    filterGames(/** @type {HTMLInputElement} */ (e.target).value);
  });

  gameSearchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const query = gameSearchInput.value.trim().toLowerCase();
      const exact = filteredGames.find((g) => g.name.toLowerCase() === query);
      const partial = filteredGames.find((g) => g.name.toLowerCase().includes(query));
      const game = exact ?? partial ?? filteredGames[0];
      if (game) addGameCard(game);
    }
  });

  platformColorInput?.addEventListener("input", (e) => {
    const settings = getSettings();
    setPlatformColor(settings.selectedPlatformId, /** @type {HTMLInputElement} */ (e.target).value);
    saveSettings(getSettings());
    refreshPreview();
  });

  imageTypeSelect?.addEventListener("change", (e) => {
    updateSettings({ imageType: /** @type {HTMLSelectElement} */ (e.target).value });
    saveSettings(getSettings());
  });

  document.getElementById("export-settings")?.addEventListener("click", () => {
    exportSettingsFile(getSettings());
    setStatus("Settings exported.");
  });

  document.getElementById("import-settings")?.addEventListener("click", async () => {
    try {
      const imported = await importSettingsFile();
      const defaults = defaultSettings();
      updateSettings({
        platformColors: { ...defaults.platformColors, ...imported.platformColors },
        imageType: imported.imageType ?? defaults.imageType,
        selectedPlatformId: imported.selectedPlatformId ?? defaults.selectedPlatformId,
      });
      saveSettings(getSettings());
      syncPlatformControls();
      if (imageTypeSelect) imageTypeSelect.value = getSettings().imageType;
      setStatus("Settings imported.");
    } catch {
      setStatus("Could not import settings.", true);
    }
  });

  document.getElementById("export-pdf")?.addEventListener("click", async () => {
    const deck = getDeck();
    if (deck.length === 0) {
      setStatus("Add at least one card before exporting.", true);
      return;
    }
    setStatus("Generating PDF…");
    try {
      await exportLetterPdf(deck, getSettings().platformColors);
      setStatus(`Exported ${deck.length} card(s) to PDF.`);
    } catch (err) {
      setStatus("PDF export failed.", true);
      console.error(err);
    }
  });

  document.getElementById("clear-deck")?.addEventListener("click", () => {
    if (getDeck().length === 0) return;
    if (confirm("Clear all cards from the deck?")) {
      clearDeck();
      saveDeck(getDeck());
      renderDeck();
      refreshPreview();
      setStatus("Deck cleared.");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const deck = getDeck();
    if (deck.length === 0) return;
    const index = getSelectedDeckIndex();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectDeckIndex(Math.min(index + 1, deck.length - 1));
      renderDeck();
      refreshPreview();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectDeckIndex(Math.max(index - 1, 0));
      renderDeck();
      refreshPreview();
    }
  });
}

export function initUI() {
  platformResultsEl = document.getElementById("platform-results");
  gameResultsEl = document.getElementById("game-results");
  deckListEl = document.getElementById("deck-list");
  previewImageEl = /** @type {HTMLImageElement|null} */ (document.getElementById("preview-image"));
  previewMetaEl = document.getElementById("preview-meta");
  statusEl = document.getElementById("status");
  platformSearchInput = /** @type {HTMLInputElement|null} */ (document.getElementById("platform-search"));
  gameSearchInput = /** @type {HTMLInputElement|null} */ (document.getElementById("game-search"));
  platformColorInput = /** @type {HTMLInputElement|null} */ (document.getElementById("platform-color"));
  imageTypeSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById("image-type"));

  if (imageTypeSelect) {
    imageTypeSelect.innerHTML = Object.entries(IMAGE_TYPES)
      .map(([key, val]) => `<option value="${key}">${val.label}</option>`)
      .join("");
    imageTypeSelect.value = getSettings().imageType;
  }

  bindEvents();
  syncPlatformControls();
  renderDeck();
  refreshPreview();

  subscribe((event) => {
    if (event === "settings") saveSettings(getSettings());
    if (event === "deck") saveDeck(getDeck());
    if (event === "selection") refreshPreview();
  });
}
