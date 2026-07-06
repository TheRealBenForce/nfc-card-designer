import { platforms } from "./data/platforms.js";
import { gamesForPlatform, gameForCard, searchGames, MIN_GAME_SEARCH_CHARS } from "./gameCatalog.js";
import { platformById } from "./data/platforms.js";
import { IMAGE_TYPES } from "./config.js";
import { buildCollectionTree } from "./collectionTree.js";
import {
  subscribe,
  getSettings,
  getCollection,
  getSelectedCardIds,
  getSelectedCards,
  getPreviewCard,
  updateSettings,
  setPlatformColor,
  addCard,
  updateCard,
  removeCards,
  setSelectedCardIds,
  replaceCollection,
  createCardId,
  toggleCardSelection,
  setPreviewCardId,
} from "./state.js";
import {
  saveSettings,
  saveCollection,
  exportProjectFile,
  importProjectFile,
  defaultSettings,
} from "./storage.js";
import { resolveGameImage } from "./imageProvider.js";
import { renderCard, canvasToDataUrl } from "./cardRenderer.js";
import { exportLetterPdf } from "./pdfExport.js";

/** @type {HTMLElement|null} */
let platformResultsEl = null;
/** @type {HTMLElement|null} */
let gameResultsEl = null;
/** @type {HTMLElement|null} */
let collectionListEl = null;
/** @type {HTMLElement|null} */
let collectionSelectionMetaEl = null;
/** @type {HTMLButtonElement|null} */
let deleteSelectedBtn = null;
/** @type {HTMLButtonElement|null} */
let printSelectedBtn = null;
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
/** @type {HTMLElement|null} */
let gameSearchHintEl = null;
/** @type {HTMLInputElement|null} */
let platformColorInput = null;
/** @type {HTMLSelectElement|null} */
let imageTypeSelect = null;

/** @type {number} */
let platformHighlightIndex = 0;
/** @type {number} */
let gameHighlightIndex = 0;
/** @type {import('./data/platforms.js').Platform[]} */
let filteredPlatforms = [...platforms];
/** @type {import('./gameCatalog.js').Game[]} */
let filteredGames = [];

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle("status--error", isError);
}

/** @param {import('./data/platforms.js').Platform} platform @param {string} query */
function platformMatches(platform, query) {
  const terms = [
    platform.name,
    platform.id,
    platform.id.replace(/-/g, " "),
    platform.id.replace(/-/g, ""),
    ...(platform.searchAliases ?? []),
  ].map((s) => s.toLowerCase());

  return terms.some((term) => term.includes(query));
}

function filterPlatforms(query) {
  const q = query.trim().toLowerCase();
  filteredPlatforms = q ? platforms.filter((p) => platformMatches(p, q)) : [...platforms];
  platformHighlightIndex = 0;
  renderPlatformResults();
}

function updateGameSearchHint(query = gameSearchInput?.value.trim() ?? "") {
  if (!gameSearchHintEl) return;

  if (query.length === 0) {
    gameSearchHintEl.textContent = `Type at least ${MIN_GAME_SEARCH_CHARS} characters to search games.`;
    gameSearchHintEl.classList.remove("field-hint--ready");
    return;
  }

  if (query.length < MIN_GAME_SEARCH_CHARS) {
    const remaining = MIN_GAME_SEARCH_CHARS - query.length;
    gameSearchHintEl.textContent =
      remaining === 1
        ? "Type 1 more character to search games."
        : `Type ${remaining} more characters to search games.`;
    gameSearchHintEl.classList.remove("field-hint--ready");
    return;
  }

  const count = filteredGames.length;
  gameSearchHintEl.textContent =
    count === 0 ? `No games matching "${query}".` : `${count} game${count === 1 ? "" : "s"} found`;
  gameSearchHintEl.classList.toggle("field-hint--ready", count > 0);
}

function filterGames(query) {
  const settings = getSettings();
  const q = query.trim();
  filteredGames = searchGames(settings.selectedPlatformId, q);
  gameHighlightIndex = 0;
  renderGameResults();
  updateGameSearchHint(q);
}

function renderPlatformResults() {
  if (!platformResultsEl) return;
  const settings = getSettings();
  platformResultsEl.innerHTML = "";

  if (filteredPlatforms.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-hint";
    empty.textContent = "No platforms match your search.";
    platformResultsEl.appendChild(empty);
    return;
  }

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

  const settings = getSettings();
  const catalogSize = gamesForPlatform(settings.selectedPlatformId).length;
  const query = gameSearchInput?.value.trim() ?? "";

  if (query.length < MIN_GAME_SEARCH_CHARS) {
    gameResultsEl.hidden = true;
    return;
  }

  gameResultsEl.hidden = false;

  if (filteredGames.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-hint";
    if (catalogSize === 0) {
      empty.textContent = "No games in catalog for this platform yet.";
    } else {
      empty.textContent = `No games matching "${query}".`;
    }
    gameResultsEl.appendChild(empty);
    return;
  }

  filteredGames.forEach((game, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "list-item";
    btn.setAttribute("role", "option");
    if (index === gameHighlightIndex) btn.classList.add("list-item--highlight");
    btn.textContent = game.name;
    btn.addEventListener("click", () => {
      if (gameSearchInput) gameSearchInput.value = game.name;
      addGameCard(game);
    });
    gameResultsEl.appendChild(btn);
  });
}

function selectPlatform(platformId) {
  if (platformSearchInput) platformSearchInput.value = "";
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

function pickGameFromSearch() {
  const query = gameSearchInput?.value.trim() ?? "";
  if (query.length < MIN_GAME_SEARCH_CHARS) {
    setStatus(`Type at least ${MIN_GAME_SEARCH_CHARS} characters to search games.`, true);
    return null;
  }

  if (!query) {
    setStatus("Type a game name, then press Enter.", true);
    return null;
  }

  const lower = query.toLowerCase();
  const exact = filteredGames.find((g) => g.name.toLowerCase() === lower);
  if (exact) return exact;

  const startsWith = filteredGames.find((g) => g.name.toLowerCase().startsWith(lower));
  if (startsWith) return startsWith;

  const partial = filteredGames.find((g) => g.name.toLowerCase().includes(lower));
  if (partial) return partial;

  if (filteredGames[gameHighlightIndex]) return filteredGames[gameHighlightIndex];

  setStatus(`No game matching "${query}".`, true);
  return null;
}

async function addGameCard(game) {
  const settings = getSettings();
  setStatus(`Loading artwork for ${game.name}…`);

  const card = {
    id: createCardId(),
    platformId: settings.selectedPlatformId,
    gameName: game.name,
    raGameId: game.raGameId,
    imageType: settings.imageType,
  };

  addCard(card);

  const { failed } = await resolveGameImage(game, settings.imageType);

  updateCard(card.id, { imageFailed: failed });

  if (gameSearchInput) {
    gameSearchInput.value = "";
    gameSearchInput.focus();
  }

  filterGames("");
  updateCollectionActions();
  await refreshPreview();

  if (failed) {
    setStatus(
      `Added ${game.name} (placeholder — run npm run fetch-images to download artwork)`,
      true,
    );
  } else {
    setStatus(`Added ${game.name} to collection.`);
  }
}

function updateCollectionActions() {
  const selectedCount = getSelectedCardIds().size;
  const label =
    selectedCount === 0
      ? "No cards selected"
      : selectedCount === 1
        ? "1 card selected"
        : `${selectedCount} cards selected`;

  if (collectionSelectionMetaEl) collectionSelectionMetaEl.textContent = label;
  if (deleteSelectedBtn) deleteSelectedBtn.disabled = selectedCount === 0;
  if (printSelectedBtn) printSelectedBtn.disabled = selectedCount === 0;
}

function renderCollection() {
  if (!collectionListEl) return;
  const collection = getCollection();
  const selectedIds = getSelectedCardIds();
  collectionListEl.innerHTML = "";

  if (collection.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-hint";
    empty.textContent = "Search for a game and press Enter to add cards.";
    collectionListEl.appendChild(empty);
    updateCollectionActions();
    return;
  }

  const tree = buildCollectionTree(collection);

  for (const { platform, games } of tree) {
    const platformDetails = document.createElement("details");
    platformDetails.className = "collection-platform";
    platformDetails.open = true;

    const platformSummary = document.createElement("summary");
    platformSummary.textContent = `${platform.emoji} ${platform.name}`;
    platformDetails.appendChild(platformSummary);

    for (const game of games) {
      const gameDetails = document.createElement("details");
      gameDetails.className = "collection-game";
      gameDetails.open = true;

      const gameSummary = document.createElement("summary");
      gameSummary.textContent = game.name;
      gameDetails.appendChild(gameSummary);

      const cardsEl = document.createElement("div");
      cardsEl.className = "collection-cards";

      for (const card of game.cards) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "collection-card";
        if (selectedIds.has(card.id)) row.classList.add("collection-card--selected");

        const mark = document.createElement("span");
        mark.className = "collection-card__mark";
        mark.textContent = selectedIds.has(card.id) ? "✓" : "";
        mark.setAttribute("aria-hidden", "true");

        const label = document.createElement("span");
        label.className = "collection-card__label";
        label.textContent = IMAGE_TYPES[card.imageType]?.label ?? card.imageType;

        row.addEventListener("click", () => {
          toggleCardSelection(card.id);
          renderCollection();
          updateCollectionActions();
        });

        row.appendChild(mark);
        row.appendChild(label);

        if (card.imageFailed) {
          const badge = document.createElement("span");
          badge.className = "collection-card__badge";
          badge.textContent = "placeholder";
          row.appendChild(badge);
        }

        cardsEl.appendChild(row);
      }

      gameDetails.appendChild(cardsEl);
      platformDetails.appendChild(gameDetails);
    }

    collectionListEl.appendChild(platformDetails);
  }

  updateCollectionActions();
}

async function refreshCollectionImageStatus() {
  for (const card of getCollection()) {
    const game = gameForCard(card);
    const { failed } = await resolveGameImage(
      game ?? { platformId: card.platformId, raGameId: card.raGameId, name: card.gameName, images: {} },
      card.imageType,
    );
    if (Boolean(card.imageFailed) !== failed) {
      updateCard(card.id, { imageFailed: failed });
    }
  }
}

async function refreshPreview() {
  const card = getPreviewCard();
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

  platformSearchInput?.addEventListener("search", (e) => {
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
    const query = gameSearchInput?.value.trim() ?? "";
    const dropdownOpen = query.length >= MIN_GAME_SEARCH_CHARS;

    if (dropdownOpen && e.key === "ArrowDown") {
      e.preventDefault();
      gameHighlightIndex = Math.min(gameHighlightIndex + 1, filteredGames.length - 1);
      renderGameResults();
      return;
    }
    if (dropdownOpen && e.key === "ArrowUp") {
      e.preventDefault();
      gameHighlightIndex = Math.max(gameHighlightIndex - 1, 0);
      renderGameResults();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const game = pickGameFromSearch();
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

  document.getElementById("export-project")?.addEventListener("click", () => {
    exportProjectFile(getSettings(), getCollection());
    setStatus("Project exported.");
  });

  document.getElementById("import-project")?.addEventListener("click", async () => {
    try {
      const imported = await importProjectFile();
      const defaults = defaultSettings();
      updateSettings({
        platformColors: { ...defaults.platformColors, ...imported.settings.platformColors },
        imageType: imported.settings.imageType ?? defaults.imageType,
        selectedPlatformId: imported.settings.selectedPlatformId ?? defaults.selectedPlatformId,
      });
      saveSettings(getSettings());
      replaceCollection(imported.cards);
      saveCollection(getCollection());
      if (imported.cards.length > 0) {
        setSelectedCardIds(imported.cards.map((c) => c.id));
        setPreviewCardId(imported.cards[0].id);
      }
      syncPlatformControls();
      if (imageTypeSelect) imageTypeSelect.value = getSettings().imageType;
      renderCollection();
      await refreshPreview();
      setStatus(`Imported project with ${imported.cards.length} card(s).`);
    } catch {
      setStatus("Could not import project.", true);
    }
  });

  deleteSelectedBtn?.addEventListener("click", () => {
    const selected = getSelectedCards();
    if (selected.length === 0) return;
    const noun = selected.length === 1 ? "1 card" : `${selected.length} cards`;
    if (!confirm(`Delete ${noun} from your collection?`)) return;
    removeCards(selected.map((card) => card.id));
    renderCollection();
    refreshPreview();
    setStatus(`Deleted ${noun}.`);
  });

  printSelectedBtn?.addEventListener("click", async () => {
    const selected = getSelectedCards();
    if (selected.length === 0) {
      setStatus("Select at least one card to print.", true);
      return;
    }
    setStatus("Generating PDF…");
    try {
      await exportLetterPdf(selected, getSettings().platformColors);
      setStatus(`Printed ${selected.length} card(s) to PDF.`);
    } catch (err) {
      setStatus("PDF export failed.", true);
      console.error(err);
    }
  });
}

export async function initUI() {
  platformResultsEl = document.getElementById("platform-results");
  gameResultsEl = document.getElementById("game-results");
  collectionListEl = document.getElementById("collection-list");
  collectionSelectionMetaEl = document.getElementById("collection-selection-meta");
  deleteSelectedBtn = /** @type {HTMLButtonElement|null} */ (
    document.getElementById("delete-selected")
  );
  printSelectedBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById("print-selected"));
  previewImageEl = /** @type {HTMLImageElement|null} */ (document.getElementById("preview-image"));
  previewMetaEl = document.getElementById("preview-meta");
  statusEl = document.getElementById("status");
  platformSearchInput = /** @type {HTMLInputElement|null} */ (document.getElementById("platform-search"));
  gameSearchInput = /** @type {HTMLInputElement|null} */ (document.getElementById("game-search"));
  gameSearchHintEl = document.getElementById("game-search-hint");
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
  if (gameResultsEl) gameResultsEl.hidden = true;
  updateGameSearchHint();
  renderCollection();
  refreshCollectionImageStatus().then(() => {
    renderCollection();
    refreshPreview();
  });

  subscribe((event) => {
    if (event === "settings") saveSettings(getSettings());
    if (event === "collection") {
      saveCollection(getCollection());
      renderCollection();
    }
    if (event === "selection") {
      renderCollection();
      updateCollectionActions();
    }
  });
}
