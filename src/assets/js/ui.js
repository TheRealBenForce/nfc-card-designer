import { platforms } from "./data/platforms.js";
import {
  gamesForPlatform,
  gameForCard,
  searchGames,
  pickGameFromCatalog,
  gameCountForPlatform,
  catalogCountForPlatform,
  platformsWithArtwork,
  platformHasArtwork,
  GAME_SEARCH_PAGE_SIZE,
} from "./gameCatalog.js";
import { platformById } from "./data/platforms.js";
import {
  IMAGE_TYPES,
  PLACEHOLDER_SVG,
  PREVIEW_CALIBRATION_STORAGE_KEY,
} from "./config.js";
import {
  getCardPreviewWidthPx,
  maxStickerInsetMm,
  mmToRenderPx,
  normalizeCardHeightMm,
  normalizeCardWidthMm,
  normalizeStickerInsetMm,
  resolveCardSizing,
} from "./cardSizing.js";
import {
  getEffectiveImageTypePriority,
  getPlatformArtworkDisplay,
  normalizeRotationDegrees,
} from "./platformDefaults.js";
import {
  ARTWORK_ALIGNMENT_ORDER,
  ARTWORK_ALIGNMENTS,
  ARTWORK_BACKGROUND_MODE_ORDER,
  ARTWORK_BACKGROUND_MODES,
  MAX_ARTWORK_ZOOM,
  MIN_ARTWORK_ZOOM,
  normalizeArtworkDisplay,
} from "./artworkDisplay.js";
import { getAvailableImageTypes } from "./imageAvailability.js";
import { buildCollectionTree } from "./collectionTree.js";
import { normalizeHeaderHeightPercent, normalizeHeaderSettings } from "./headerSettings.js";
import {
  subscribe,
  getSettings,
  getCollection,
  getSelectedCardIds,
  getSelectedCards,
  updateSettings,
  addCard,
  updateCard,
  removeCards,
  setSelectedCardIds,
  replaceCollection,
  clearCollection,
  createCardId,
  toggleCardSelection,
} from "./state.js";
import {
  saveSettings,
  saveCollection,
  exportProjectFile,
  importProjectFile,
  defaultSettings,
} from "./storage.js";
import { buildGameImageUrl, resolveGameImage } from "./imageProvider.js";
import { extractLibretroMetadata } from "./libretroTitle.js";
import { renderCard, canvasToDataUrl } from "./cardRenderer.js";
import { exportLetterPdf } from "./pdfExport.js";
import {
  initPlatformSettingsModal,
  openPlatformSettingsModal,
} from "./platformSettingsModal.js";

const ARTWORK_ZOOM_BASE_PERCENT = 100;
const MIN_ARTWORK_ZOOM_PERCENT = ARTWORK_ZOOM_BASE_PERCENT + MIN_ARTWORK_ZOOM;
const MAX_ARTWORK_ZOOM_PERCENT = ARTWORK_ZOOM_BASE_PERCENT + MAX_ARTWORK_ZOOM;

/**
 * @param {number} zoom
 * @returns {number}
 */
function artworkZoomToPercent(zoom) {
  return Math.min(
    MAX_ARTWORK_ZOOM_PERCENT,
    Math.max(MIN_ARTWORK_ZOOM_PERCENT, Math.round(ARTWORK_ZOOM_BASE_PERCENT + zoom)),
  );
}

/**
 * @param {string} rawPercent
 * @returns {number}
 */
function artworkPercentToZoom(rawPercent) {
  const parsed = Number(rawPercent);
  const safePercent = Number.isFinite(parsed) ? parsed : ARTWORK_ZOOM_BASE_PERCENT;
  const clampedPercent = Math.min(
    MAX_ARTWORK_ZOOM_PERCENT,
    Math.max(MIN_ARTWORK_ZOOM_PERCENT, Math.round(safePercent)),
  );
  return clampedPercent - ARTWORK_ZOOM_BASE_PERCENT;
}

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
/** @type {HTMLButtonElement|null} */
let selectAllBtn = null;
/** @type {HTMLButtonElement|null} */
let deselectAllBtn = null;
/** @type {HTMLImageElement|null} */
let previewImageEl = null;
/** @type {HTMLElement|null} */
let previewFrameEl = null;
/** @type {HTMLElement|null} */
let previewSkeletonEl = null;
/** @type {HTMLElement|null} */
let previewMetaEl = null;
/** @type {HTMLInputElement|null} */
let previewCalibrationInputEl = null;
/** @type {HTMLElement|null} */
let previewCalibrationValueEl = null;
/** @type {HTMLInputElement|null} */
let gameSearchInput = null;
/** @type {HTMLElement|null} */
let gameSearchHintEl = null;
/** @type {HTMLInputElement|null} */
let globalShowHeaderInput = null;
/** @type {HTMLInputElement|null} */
let globalShowPlatformColorInput = null;
/** @type {HTMLInputElement|null} */
let globalHeaderHeightInput = null;
/** @type {HTMLElement|null} */
let globalHeaderHeightValueEl = null;
/** @type {HTMLInputElement|null} */
let globalCardWidthInput = null;
/** @type {HTMLInputElement|null} */
let globalCardHeightInput = null;
/** @type {HTMLInputElement|null} */
let globalStickerInsetInput = null;
/** @type {HTMLElement|null} */
let previewTypeTabsEl = null;
/** @type {HTMLButtonElement|null} */
let addBrowsedGameBtn = null;
/** @type {HTMLElement|null} */
let previewArtworkControlsEl = null;
/** @type {HTMLElement|null} */
let previewArtworkAlignmentGridEl = null;
/** @type {HTMLSelectElement|null} */
let previewArtworkBackgroundModeEl = null;
/** @type {HTMLInputElement|null} */
let previewArtworkBackgroundColorEl = null;
/** @type {HTMLInputElement|null} */
let previewArtworkZoomEl = null;
/** @type {HTMLElement|null} */
let previewArtworkZoomValueEl = null;
/** @type {HTMLButtonElement|null} */
let previewArtworkResetBtn = null;
/** @type {HTMLElement|null} */
let previewArtworkControlsTitleEl = null;
/** @type {HTMLButtonElement|null} */
let previewArtworkRotateBtn = null;
/** @type {HTMLElement|null} */
let editPanelEl = null;
/** @type {HTMLElement|null} */
let editControlsEl = null;

/** True while resolving artwork types or rendering a browse preview. */
let browseLoading = false;

/**
 * @type {{
 *   game: import('./gameCatalog.js').Game,
 *   imageType: string,
 *   availableTypes: string[],
 *   resolvedTypes: string[],
 *   artworkDisplayOverride?: import("./artworkDisplay.js").ArtworkDisplaySettings | null,
 *   imageRotation?: number,
 * } | null}
 */
let browseState = null;

/** Monotonic tokens so stale async browse/preview work cannot overwrite newer UI state. */
let browseRequestId = 0;
let previewRequestId = 0;

/** Delay before showing the preview skeleton to avoid flicker on fast cache hits. */
const PREVIEW_SKELETON_DELAY_MS = 120;

/** @type {ReturnType<typeof setTimeout> | null} */
let previewSkeletonTimer = null;

function schedulePreviewSkeleton() {
  if (!previewSkeletonEl || !previewFrameEl) return;
  clearTimeout(previewSkeletonTimer);
  previewSkeletonTimer = setTimeout(showPreviewSkeleton, PREVIEW_SKELETON_DELAY_MS);
}

function showPreviewSkeleton() {
  if (!previewSkeletonEl || !previewFrameEl) return;
  previewSkeletonTimer = null;
  previewSkeletonEl.hidden = false;
  previewSkeletonEl.setAttribute("aria-hidden", "false");
  previewFrameEl.classList.add("preview-frame--loading");
  previewFrameEl.classList.remove("preview-frame--idle");
}

function showPreviewSkeletonImmediate() {
  if (!previewSkeletonEl || !previewFrameEl) return;
  clearTimeout(previewSkeletonTimer);
  previewSkeletonTimer = null;
  showPreviewSkeleton();
}

function cancelPreviewSkeleton() {
  clearTimeout(previewSkeletonTimer);
  previewSkeletonTimer = null;
  if (!previewSkeletonEl || !previewFrameEl) return;
  previewSkeletonEl.hidden = true;
  previewSkeletonEl.setAttribute("aria-hidden", "true");
  previewFrameEl.classList.remove("preview-frame--loading");
  previewFrameEl.classList.remove("preview-frame--idle");
}

function isEditInteractive() {
  return Boolean(browseState) && !browseLoading;
}

/**
 * @returns {import("./artworkDisplay.js").ArtworkDisplaySettings}
 */
function getPreviewArtworkDisplayFallback() {
  const platformId = getActivePlatformId();
  if (!platformId) return normalizeArtworkDisplay({});
  return getPlatformArtworkDisplay(getSettings().platformDefaults, platformId);
}

function setEditControlsDisabled(disabled) {
  const controls = [
    addBrowsedGameBtn,
    previewArtworkRotateBtn,
    previewArtworkResetBtn,
    previewArtworkBackgroundModeEl,
    previewArtworkBackgroundColorEl,
    previewArtworkZoomEl,
  ];

  for (const control of controls) {
    if (control) control.disabled = disabled;
  }

  if (previewArtworkAlignmentGridEl) {
    for (const btn of previewArtworkAlignmentGridEl.querySelectorAll("[data-alignment]")) {
      /** @type {HTMLButtonElement} */ (btn).disabled = disabled;
    }
  }

  for (const tab of previewTypeTabsEl?.querySelectorAll(".preview-type-tab") ?? []) {
    /** @type {HTMLButtonElement} */ (tab).disabled = disabled;
  }
}

function syncPreviewPlatformAccent() {
  const platformId = browseState?.game.platformId ?? getActivePlatformId();
  const color = platformId ? platformById[platformId]?.defaultColor : null;
  const targets = [editPanelEl, ...document.querySelectorAll(".preview-frame")].filter(Boolean);

  targets.forEach((el) => {
    if (color) el.style.setProperty("--platform-color", color);
    else el.style.removeProperty("--platform-color");
  });
}

function syncEditColumnState() {
  const interactive = isEditInteractive();
  const active = Boolean(browseState) || browseLoading;

  if (editPanelEl) {
    editPanelEl.classList.toggle("panel--edit-on", active);
    editPanelEl.classList.toggle("panel--edit-off", !active);
    editPanelEl.setAttribute("aria-disabled", interactive ? "false" : "true");
  }

  if (editControlsEl) {
    editControlsEl.classList.toggle("edit-controls--idle", !active);
    editControlsEl.classList.toggle("edit-controls--loading", browseLoading);
    editControlsEl.classList.toggle("edit-controls--ready", interactive);
    if (interactive) {
      editControlsEl.removeAttribute("inert");
    } else {
      editControlsEl.setAttribute("inert", "");
    }
  }

  if (!active) {
    if (previewImageEl) {
      previewImageEl.hidden = true;
      previewImageEl.removeAttribute("src");
      previewImageEl.alt = "";
    }
    if (previewMetaEl) {
      previewMetaEl.textContent = "Select a game to start editing.";
    }
    renderPreviewTypeTabs();
    if (previewSkeletonEl && previewFrameEl) {
      clearTimeout(previewSkeletonTimer);
      previewSkeletonTimer = null;
      previewSkeletonEl.hidden = false;
      previewSkeletonEl.setAttribute("aria-hidden", "false");
      previewFrameEl.classList.remove("preview-frame--loading");
      previewFrameEl.classList.add("preview-frame--idle");
    }
  } else if (browseLoading) {
    showPreviewSkeletonImmediate();
  }

  setEditControlsDisabled(!interactive);
  syncPreviewPlatformAccent();
  syncBrowseActionButton();
  syncPreviewArtworkControls();
}

/** @type {number} */
let gameHighlightIndex = 0;
/** @type {import('./gameCatalog.js').Game[]} */
let filteredGames = [];
/** @type {number} */
let filteredGamesTotal = 0;
/** @type {boolean} */
let filteredGamesNoMatchFallback = false;
/** @type {number} */
let filteredGamesVisibleCount = GAME_SEARCH_PAGE_SIZE;
/** @type {boolean} */
let gameResultsScrollBound = false;
/** @type {boolean} */
let gameSearchFocused = false;

/**
 * Treat empty/invalid ids as no active platform selection.
 * @returns {string | null}
 */
function getActivePlatformId() {
  const selectedPlatformId = getSettings().selectedPlatformId;
  if (!selectedPlatformId) return null;
  if (!platformHasArtwork(selectedPlatformId)) return null;
  return selectedPlatformId;
}

function logStatus(message, isError = false) {
  if (isError) console.error(message);
  else console.log(message);
}

/**
 * @param {number} value
 */
function clampPreviewCalibrationScale(value) {
  return Math.min(1.3, Math.max(0.7, value));
}

function loadPreviewCalibrationScale() {
  try {
    const raw = localStorage.getItem(PREVIEW_CALIBRATION_STORAGE_KEY);
    if (!raw) return 1;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 1;
    return clampPreviewCalibrationScale(parsed);
  } catch {
    return 1;
  }
}

/**
 * @param {number} nextScale
 * @param {{ persist?: boolean }} [options]
 */
function applyPreviewCalibrationScale(nextScale, options = {}) {
  const scale = clampPreviewCalibrationScale(nextScale);

  document.documentElement.style.setProperty("--preview-calibration-scale", String(scale));

  const percent = Math.round(scale * 100);
  if (previewCalibrationInputEl) {
    previewCalibrationInputEl.value = String(percent);
  }
  if (previewCalibrationValueEl) {
    previewCalibrationValueEl.textContent = `${percent}%`;
  }

  if (options.persist !== false) {
    try {
      localStorage.setItem(PREVIEW_CALIBRATION_STORAGE_KEY, String(scale));
    } catch {
      // no-op when storage is unavailable
    }
  }
}

const ALIGNMENT_SYMBOLS = {
  "top-left": "↖",
  "top-center": "↑",
  "top-right": "↗",
  "center-left": "←",
  center: "●",
  "center-right": "→",
  "bottom-left": "↙",
  "bottom-center": "↓",
  "bottom-right": "↘",
};

/**
 * @param {HTMLElement | null} gridEl
 * @param {import('./artworkDisplay.js').ArtworkDisplaySettings} artworkDisplay
 */
function syncArtworkAlignmentGrid(gridEl, artworkDisplay) {
  if (!gridEl) return;

  for (const btn of gridEl.querySelectorAll("[data-alignment]")) {
    const alignment = /** @type {HTMLElement} */ (btn).dataset.alignment;
    btn.classList.toggle("alignment-grid__btn--active", alignment === artworkDisplay.alignment);
    btn.setAttribute("aria-checked", alignment === artworkDisplay.alignment ? "true" : "false");
  }
}

/**
 * @param {HTMLSelectElement | null} modeEl
 * @param {HTMLInputElement | null} colorEl
 * @param {import('./artworkDisplay.js').ArtworkDisplaySettings} artworkDisplay
 */
function syncArtworkBackgroundControls(modeEl, colorEl, artworkDisplay) {
  const selectToolActive = artworkDisplay.backgroundMode === "select";
  if (modeEl) modeEl.value = artworkDisplay.backgroundMode;
  if (colorEl) {
    colorEl.value = artworkDisplay.backgroundColor;
    colorEl.disabled = !selectToolActive;
  }
}

/**
 * @param {HTMLInputElement | null} zoomEl
 * @param {HTMLElement | null} valueEl
 * @param {import('./artworkDisplay.js').ArtworkDisplaySettings} artworkDisplay
 */
function syncArtworkZoomControl(zoomEl, valueEl, artworkDisplay) {
  const zoomPercent = artworkZoomToPercent(artworkDisplay.zoom);
  if (zoomEl) zoomEl.value = String(zoomPercent);
  if (valueEl) valueEl.textContent = `${zoomPercent}%`;
}

/**
 * @param {HTMLElement} gridEl
 * @param {(alignment: string) => void} onSelect
 */
function mountArtworkAlignmentGrid(gridEl, onSelect) {
  gridEl.innerHTML = "";

  for (const alignment of ARTWORK_ALIGNMENT_ORDER) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "alignment-grid__btn";
    btn.dataset.alignment = alignment;
    btn.setAttribute("role", "radio");
    btn.title = ARTWORK_ALIGNMENTS[alignment].label;
    btn.textContent = ALIGNMENT_SYMBOLS[alignment] ?? "·";
    btn.addEventListener("click", () => onSelect(alignment));
    gridEl.appendChild(btn);
  }
}

/**
 * @param {HTMLSelectElement} selectEl
 */
function mountArtworkBackgroundModeSelect(selectEl) {
  selectEl.innerHTML = "";

  for (const mode of ARTWORK_BACKGROUND_MODE_ORDER) {
    const option = document.createElement("option");
    option.value = mode;
    option.textContent = ARTWORK_BACKGROUND_MODES[mode].label;
    selectEl.appendChild(option);
  }
}

function syncPreviewArtworkControls() {
  const context = getPreviewArtworkControlContext();
  const interactive = isEditInteractive();
  const display = context?.display ?? getPreviewArtworkDisplayFallback();

  if (previewArtworkControlsTitleEl) {
    previewArtworkControlsTitleEl.textContent = "Artwork";
  }

  if (previewArtworkResetBtn) {
    previewArtworkResetBtn.hidden = false;
    previewArtworkResetBtn.disabled = !interactive || !context?.hasOverride;
  }

  if (previewArtworkRotateBtn) {
    const rotation = context?.cardRotation ?? 0;
    previewArtworkRotateBtn.hidden = false;
    previewArtworkRotateBtn.disabled = !interactive;
    previewArtworkRotateBtn.title = interactive
      ? `Rotate artwork 90° (current ${rotation}°)`
      : "Rotate artwork 90°";
  }

  if (previewArtworkControlsEl) {
    previewArtworkControlsEl.hidden = false;
  }

  syncArtworkAlignmentGrid(previewArtworkAlignmentGridEl, display);
  syncArtworkBackgroundControls(
    previewArtworkBackgroundModeEl,
    previewArtworkBackgroundColorEl,
    display,
  );
  syncArtworkZoomControl(previewArtworkZoomEl, previewArtworkZoomValueEl, display);

  if (previewArtworkAlignmentGridEl) {
    for (const btn of previewArtworkAlignmentGridEl.querySelectorAll("[data-alignment]")) {
      /** @type {HTMLButtonElement} */ (btn).disabled = !interactive;
    }
  }
  if (previewArtworkBackgroundModeEl) {
    previewArtworkBackgroundModeEl.disabled = !interactive;
  }
  if (previewArtworkZoomEl) {
    previewArtworkZoomEl.disabled = !interactive;
  }
  if (previewArtworkBackgroundColorEl && !interactive) {
    previewArtworkBackgroundColorEl.disabled = true;
  }
}

/**
 * @returns {{
 *   mode: "card",
 *   cardId?: string,
 *   isBrowseCard?: boolean,
 *   cardRotation?: number,
 *   display: import("./artworkDisplay.js").ArtworkDisplaySettings,
 *   hasOverride?: boolean,
 * } | null}
 */
function getPreviewArtworkControlContext() {
  if (!browseState) return null;

  const platformDisplay = getPlatformArtworkDisplay(
    getSettings().platformDefaults,
    browseState.game.platformId,
  );
  const display = browseState.artworkDisplayOverride
    ? normalizeArtworkDisplay({ ...platformDisplay, ...browseState.artworkDisplayOverride })
    : platformDisplay;
  return {
    mode: "card",
    isBrowseCard: true,
    cardRotation: normalizeRotationDegrees(browseState.imageRotation ?? 0),
    display,
    hasOverride:
      Boolean(browseState.artworkDisplayOverride) ||
      normalizeRotationDegrees(browseState.imageRotation ?? 0) !== 0,
  };
}

/**
 * @param {Partial<import("./artworkDisplay.js").ArtworkDisplaySettings>} patch
 */
function applyPreviewArtworkPatch(patch) {
  const context = getPreviewArtworkControlContext();
  if (!context?.isBrowseCard || !browseState) return;

  const platformDisplay = getPlatformArtworkDisplay(
    getSettings().platformDefaults,
    browseState.game.platformId,
  );
  const current = browseState.artworkDisplayOverride
    ? normalizeArtworkDisplay({ ...platformDisplay, ...browseState.artworkDisplayOverride })
    : platformDisplay;
  browseState = {
    ...browseState,
    artworkDisplayOverride: normalizeArtworkDisplay({ ...current, ...patch }),
  };

  syncPreviewArtworkControls();
  refreshPreview();
}

/**
 * @param {import('./gameCatalog.js').Game} game
 * @param {string[]} priority
 * @param {string[]} availableTypes
 */
function browseTypesForGame(game, priority, availableTypes) {
  void game;
  void availableTypes;
  return [...priority];
}

function getArtworkPriorityForPlatform(platformId) {
  return getEffectiveImageTypePriority(getSettings().platformDefaults, platformId);
}

/**
 * @param {string[]} availableTypes
 * @param {string[]} resolvedTypes
 * @param {string | null | undefined} preferredType
 */
function pickInitialBrowseImageType(availableTypes, resolvedTypes, preferredType) {
  if (preferredType && availableTypes.includes(preferredType)) return preferredType;
  return resolvedTypes[0] ?? availableTypes[0];
}

/**
 * @param {typeof browseState} state
 */
function browseStateUsesPlaceholder(state) {
  if (!state) return false;
  return !state.resolvedTypes.includes(state.imageType);
}

function syncBrowseActionButton() {
  if (!addBrowsedGameBtn) return;
  addBrowsedGameBtn.textContent = "Add to collection";
  addBrowsedGameBtn.disabled = !isEditInteractive();
}

/**
 * Load a collection card's settings into the browse editor without editing that card in place.
 * @param {import("./state.js").Card} card
 */
async function copyCardSettingsToEditor(card) {
  const requestId = ++browseRequestId;
  browseLoading = true;
  if (previewMetaEl) {
    previewMetaEl.textContent = `Loading ${card.gameName}…`;
  }
  syncEditColumnState();
  showPreviewSkeletonImmediate();

  const header = normalizeHeaderSettings(card.headerSettings ?? getSettings());
  updateSettings({
    selectedPlatformId: card.platformId,
    showHeader: header.showHeader,
    showPlatformColor: header.showPlatformColor,
    headerHeightPercent: header.headerHeightPercent,
  });
  saveSettings(getSettings());
  syncGlobalSettingsControls();
  syncPlatformControls();

  const game =
    gameForCard(card) ?? {
      platformId: card.platformId,
      libretroName: card.libretroName,
      name: card.gameName,
      images: {},
    };
  const priority = getArtworkPriorityForPlatform(game.platformId);
  const resolvedTypes = await getAvailableImageTypes(game, priority);
  if (requestId !== browseRequestId) return;

  const availableTypes = browseTypesForGame(game, priority, resolvedTypes);
  browseState = {
    game,
    imageType: pickInitialBrowseImageType(availableTypes, resolvedTypes, card.imageType),
    availableTypes,
    resolvedTypes,
    artworkDisplayOverride: card.artworkDisplay
      ? normalizeArtworkDisplay(card.artworkDisplay)
      : null,
    imageRotation: normalizeRotationDegrees(card.imageRotation ?? 0),
  };

  if (gameSearchInput) {
    gameSearchInput.value = game.name;
  }
  closeGameResults();

  browseLoading = false;
  syncEditColumnState();
  renderPreviewTypeTabs();
  await refreshPreview();
  logStatus(`Copied ${card.gameName} settings to editor.`);
}

function refreshSearchViews() {
  renderPlatformResults();
  filterGames(gameSearchInput?.value ?? "");
}

function artworkCountLabel(count) {
  return `${count} game${count === 1 ? "" : "s"} with artwork`;
}

function syncGameSearchHintVisibility() {
  if (!gameSearchHintEl || !gameResultsEl) return;
  const resultsOpen = !gameResultsEl.hidden;
  gameSearchHintEl.hidden = resultsOpen;
  gameSearchHintEl.setAttribute("aria-hidden", resultsOpen ? "true" : "false");
}

function updateGameSearchHint(query = gameSearchInput?.value.trim() ?? "") {
  if (!gameSearchHintEl) return;
  const activePlatformId = getActivePlatformId();
  if (!activePlatformId) {
    gameSearchHintEl.textContent = "Select a platform to search retail releases.";
    gameSearchHintEl.classList.remove("field-hint--ready");
    syncGameSearchHintVisibility();
    return;
  }

  const gameCount = gameCountForPlatform(activePlatformId);
  const catalogSize = catalogCountForPlatform(activePlatformId);

  if (query.length === 0) {
    if (gameCount === 0) {
      gameSearchHintEl.textContent =
        catalogSize === 0
          ? "No retail games in catalog for this platform yet."
          : "No games in catalog yet — run npm run build-game-catalog, then click search to browse.";
    } else {
      gameSearchHintEl.textContent = artworkCountLabel(gameCount);
    }
    gameSearchHintEl.classList.remove("field-hint--ready");
    syncGameSearchHintVisibility();
    return;
  }

  if (filteredGamesNoMatchFallback && filteredGamesTotal === 0) {
    gameSearchHintEl.textContent = `No matches for "${query}" — browse available games below`;
    gameSearchHintEl.classList.remove("field-hint--ready");
    syncGameSearchHintVisibility();
    return;
  }

  if (filteredGamesTotal === 0) {
    gameSearchHintEl.textContent = `No games with artwork matching "${query}".`;
    gameSearchHintEl.classList.remove("field-hint--ready");
    syncGameSearchHintVisibility();
    return;
  }

  const visibleCount = Math.min(filteredGamesVisibleCount, filteredGames.length);
  if (filteredGamesTotal > visibleCount) {
    gameSearchHintEl.textContent = `Showing ${visibleCount} of ${filteredGamesTotal} matches — scroll for more`;
  } else {
    gameSearchHintEl.textContent = `${filteredGamesTotal} game${filteredGamesTotal === 1 ? "" : "s"} found`;
  }
  gameSearchHintEl.classList.add("field-hint--ready");
  syncGameSearchHintVisibility();
}

function filterGames(query) {
  const activePlatformId = getActivePlatformId();
  const q = query.trim();
  if (!activePlatformId) {
    filteredGames = [];
    filteredGamesTotal = 0;
    filteredGamesNoMatchFallback = false;
    filteredGamesVisibleCount = GAME_SEARCH_PAGE_SIZE;
    gameHighlightIndex = 0;
    renderGameResults();
    updateGameSearchHint(q);
    return;
  }

  if (q.length === 0 && !gameSearchFocused) {
    filteredGames = [];
    filteredGamesTotal = 0;
    filteredGamesNoMatchFallback = false;
    filteredGamesVisibleCount = GAME_SEARCH_PAGE_SIZE;
    gameHighlightIndex = 0;
    renderGameResults();
    updateGameSearchHint(q);
    return;
  }

  const result = searchGames(activePlatformId, q);
  filteredGames = result.games;
  filteredGamesTotal = result.isNoMatchFallback ? result.games.length : result.total;
  filteredGamesNoMatchFallback = result.isNoMatchFallback;
  filteredGamesVisibleCount = GAME_SEARCH_PAGE_SIZE;
  gameHighlightIndex = 0;
  renderGameResults();
  updateGameSearchHint(q);
}

function renderPlatformResults() {
  if (!platformResultsEl) return;
  const settings = getSettings();
  platformResultsEl.innerHTML = "";

  const visiblePlatforms = [...platformsWithArtwork()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  visiblePlatforms.forEach((platform) => {
    const row = document.createElement("div");
    row.className = "platform-row";
    row.style.setProperty("--platform-color", platform.defaultColor);
    if (platform.id === settings.selectedPlatformId) {
      row.classList.add("platform-row--selected");
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "platform-row__select";

    const emoji = document.createElement("span");
    emoji.className = "platform-row__emoji";
    emoji.textContent = platform.emoji;
    emoji.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "platform-row__label";
    label.textContent = platform.name;

    btn.append(emoji, label);
    btn.addEventListener("click", () => selectPlatform(platform.id));

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "platform-row__edit-btn";
    editBtn.textContent = "✎";
    editBtn.title = `Edit ${platform.name} defaults`;
    editBtn.setAttribute("aria-label", `Edit ${platform.name} defaults`);
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openPlatformSettingsModal(platform.id);
    });

    row.appendChild(btn);
    row.appendChild(editBtn);
    platformResultsEl.appendChild(row);
  });
}

function closeGameResults() {
  if (!gameResultsEl) return;
  gameResultsEl.hidden = true;
  syncGameSearchHintVisibility();
}

/**
 * @param {import("./gameCatalog.js").Game} game
 * @param {number} index
 */
function createGameResultItem(game, index) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "list-item";
  btn.setAttribute("role", "option");
  if (index === gameHighlightIndex) btn.classList.add("list-item--highlight");
  btn.textContent = game.name;
  btn.addEventListener("click", () => {
    if (gameSearchInput) gameSearchInput.value = game.name;
    closeGameResults();
    void browseGameFromSearch(game);
  });
  return btn;
}

function loadMoreGameResults() {
  if (!gameResultsEl || filteredGamesVisibleCount >= filteredGames.length) return;

  const previousCount = filteredGamesVisibleCount;
  filteredGamesVisibleCount = Math.min(
    filteredGamesVisibleCount + GAME_SEARCH_PAGE_SIZE,
    filteredGames.length,
  );

  const newGames = filteredGames.slice(previousCount, filteredGamesVisibleCount);
  newGames.forEach((game, offset) => {
    gameResultsEl.appendChild(createGameResultItem(game, previousCount + offset));
  });

  updateGameSearchHint();
}

function bindGameResultsScroll() {
  if (!gameResultsEl || gameResultsScrollBound) return;
  gameResultsScrollBound = true;
  gameResultsEl.addEventListener("scroll", () => {
    if (gameResultsEl.hidden) return;
    const remaining = gameResultsEl.scrollHeight - gameResultsEl.scrollTop - gameResultsEl.clientHeight;
    if (remaining < 48) {
      loadMoreGameResults();
    }
  });
}

function renderGameResults() {
  if (!gameResultsEl) return;
  gameResultsEl.innerHTML = "";
  const activePlatformId = getActivePlatformId();
  if (!activePlatformId) {
    closeGameResults();
    return;
  }

  const query = gameSearchInput?.value.trim() ?? "";
  const shouldShow = gameSearchFocused || query.length > 0;
  if (!shouldShow) {
    gameResultsEl.hidden = true;
    syncGameSearchHintVisibility();
    return;
  }

  gameResultsEl.hidden = false;
  syncGameSearchHintVisibility();

  if (filteredGames.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-hint";
    empty.textContent =
      query.length > 0
        ? `No games with artwork matching "${query}".`
        : "No games with artwork available yet.";
    gameResultsEl.appendChild(empty);
    return;
  }

  if (filteredGamesNoMatchFallback) {
    const intro = document.createElement("p");
    intro.className = "list-more-hint";
    intro.textContent = `No matches for "${query}" — browse available games:`;
    gameResultsEl.appendChild(intro);
  }

  const visibleGames = filteredGames.slice(0, filteredGamesVisibleCount);
  visibleGames.forEach((game, index) => {
    gameResultsEl.appendChild(createGameResultItem(game, index));
  });
}

function selectPlatform(platformId) {
  const previousPlatformId = getSettings().selectedPlatformId;
  updateSettings({ selectedPlatformId: platformId });
  saveSettings(getSettings());

  if (platformId !== previousPlatformId) {
    resetGameSearch();
    void refreshPreview();
  }

  syncPlatformControls();
  syncPreviewPlatformAccent();
  renderPreviewTypeTabs();
  logStatus(`Platform: ${platformById[platformId]?.name ?? platformId}`);
}

/**
 * @param {import("./state.js").AppSettings} settings
 */
function applyCardSizingCssVariables(settings) {
  const sizing = resolveCardSizing(settings);
  document.documentElement.style.setProperty("--card-width-mm", String(sizing.cardWidthMm));
  document.documentElement.style.setProperty("--card-height-mm", String(sizing.cardHeightMm));
  document.documentElement.style.setProperty("--sticker-width-mm", String(sizing.stickerWidthMm));
  document.documentElement.style.setProperty("--sticker-height-mm", String(sizing.stickerHeightMm));
}

function syncGlobalSettingsControls() {
  const settings = getSettings();
  const sizing = resolveCardSizing(settings);
  if (globalShowHeaderInput) {
    globalShowHeaderInput.checked = settings.showHeader;
  }
  if (globalShowPlatformColorInput) {
    globalShowPlatformColorInput.checked = settings.showPlatformColor;
    globalShowPlatformColorInput.disabled = !settings.showHeader;
  }
  if (globalHeaderHeightInput) {
    globalHeaderHeightInput.value = String(settings.headerHeightPercent);
  }
  if (globalHeaderHeightValueEl) {
    globalHeaderHeightValueEl.textContent = `${settings.headerHeightPercent}%`;
  }
  if (globalCardWidthInput) {
    globalCardWidthInput.value = String(sizing.cardWidthMm);
  }
  if (globalCardHeightInput) {
    globalCardHeightInput.value = String(sizing.cardHeightMm);
  }
  if (globalStickerInsetInput) {
    globalStickerInsetInput.value = String(sizing.stickerInsetMm);
    globalStickerInsetInput.max = String(maxStickerInsetMm(sizing.cardWidthMm, sizing.cardHeightMm));
  }
  applyCardSizingCssVariables(settings);
}

/**
 * Render output is full card size for print; preview overlay needs sticker-only.
 * @param {HTMLCanvasElement} cardCanvas
 * @param {import("./state.js").AppSettings} settings
 */
function stickerCanvasToDataUrl(cardCanvas, settings) {
  const sizing = resolveCardSizing(settings);
  const insetPx = mmToRenderPx(sizing.stickerInsetMm);
  const stickerWidthPx = Math.max(1, cardCanvas.width - insetPx * 2);
  const stickerHeightPx = Math.max(1, cardCanvas.height - insetPx * 2);
  const stickerCanvas = document.createElement("canvas");
  stickerCanvas.width = stickerWidthPx;
  stickerCanvas.height = stickerHeightPx;
  const ctx = stickerCanvas.getContext("2d");
  if (!ctx) return cardCanvas.toDataURL("image/png");
  ctx.drawImage(
    cardCanvas,
    insetPx,
    insetPx,
    stickerWidthPx,
    stickerHeightPx,
    0,
    0,
    stickerWidthPx,
    stickerHeightPx,
  );
  const stickerPreviewWidthPx = Math.max(
    1,
    Math.round(getCardPreviewWidthPx(settings) * (sizing.stickerWidthMm / sizing.cardWidthMm)),
  );
  return canvasToDataUrl(stickerCanvas, stickerPreviewWidthPx);
}

function currentHeaderSettingsSnapshot() {
  const settings = getSettings();
  return {
    showHeader: settings.showHeader,
    showPlatformColor: settings.showPlatformColor,
    headerHeightPercent: settings.headerHeightPercent,
  };
}

function syncPlatformControls() {
  syncGlobalSettingsControls();
  const selectedPlatformId = getSettings().selectedPlatformId;
  if (selectedPlatformId && !platformHasArtwork(selectedPlatformId)) {
    updateSettings({ selectedPlatformId: "" });
    saveSettings(getSettings());
  }

  const activePlatformId = getActivePlatformId();
  if (gameSearchInput) {
    gameSearchInput.disabled = !activePlatformId;
    gameSearchInput.placeholder = activePlatformId ? "Search games..." : "Select a platform first";
  }
  if (!activePlatformId) {
    closeGameResults();
  }

  renderPlatformResults();
  filterGames(gameSearchInput?.value ?? "");
}

async function applyPlatformPriorityToBrowse() {
  if (!browseState) return;

  const activePlatformId = getActivePlatformId();
  if (!activePlatformId || browseState.game.platformId !== activePlatformId) return;

  const priority = getArtworkPriorityForPlatform(browseState.game.platformId);
  const availableTypes = await getAvailableImageTypes(browseState.game, priority);
  const typesForBrowse = browseTypesForGame(browseState.game, priority, availableTypes);

  const imageType = typesForBrowse.includes(browseState.imageType)
    ? browseState.imageType
    : pickInitialBrowseImageType(typesForBrowse, availableTypes, null);

  browseState = {
    ...browseState,
    availableTypes: typesForBrowse,
    resolvedTypes: availableTypes,
    imageType,
  };
  renderPreviewTypeTabs();
  syncBrowseActionButton();
  syncPreviewArtworkControls();
  await refreshPreview();
}

function pickGameFromSearch() {
  const activePlatformId = getActivePlatformId();
  if (!activePlatformId) {
    logStatus("Select a platform before searching for games.", true);
    return null;
  }

  const query = gameSearchInput?.value.trim() ?? "";
  if (!query) {
    logStatus("Type a game name to search.", true);
    return null;
  }

  const game = pickGameFromCatalog(activePlatformId, query, gameHighlightIndex);
  if (!game) {
    logStatus(`No game matching "${query}".`, true);
    return null;
  }

  return game;
}

async function browseGameFromSearch(game) {
  const requestId = ++browseRequestId;
  browseLoading = true;
  if (previewMetaEl) {
    previewMetaEl.textContent = `Loading ${game.name}…`;
  }
  syncEditColumnState();
  showPreviewSkeletonImmediate();
  logStatus(`Loading preview for ${game.name}…`);

  const priority = getArtworkPriorityForPlatform(game.platformId);
  const resolvedTypes = await getAvailableImageTypes(game, priority);
  if (requestId !== browseRequestId) return;

  const availableTypes = browseTypesForGame(game, priority, resolvedTypes);

  browseState = {
    game,
    imageType: pickInitialBrowseImageType(availableTypes, resolvedTypes, null),
    availableTypes,
    resolvedTypes,
    artworkDisplayOverride: null,
    imageRotation: 0,
  };

  browseLoading = false;
  syncEditColumnState();
  renderPreviewTypeTabs();
  await refreshPreview();
  if (requestId !== browseRequestId) return;
  logStatus(
    browseStateUsesPlaceholder(browseState)
      ? `Previewing ${game.name} with placeholder artwork.`
      : `Previewing ${game.name}.`,
  );
}

function clearBrowse() {
  browseRequestId += 1;
  browseLoading = false;
  browseState = null;
  syncEditColumnState();
}

function resetGameSearch({ focus = false } = {}) {
  clearBrowse();
  closeGameResults();
  if (gameSearchInput) {
    gameSearchInput.value = "";
    if (focus) gameSearchInput.focus();
  }
  filterGames("");
}

async function addBrowsedGame() {
  if (!browseState) return;

  const { game, imageType } = browseState;
  const headerSettings = currentHeaderSettingsSnapshot();
  const imageFailed = browseStateUsesPlaceholder(browseState);

  const card = {
    id: createCardId(),
    platformId: game.platformId,
    gameName: game.name,
    libretroName: game.libretroName,
    imageType,
    headerSettings,
    ...(imageFailed ? { imageFailed: true } : {}),
    ...(browseState.artworkDisplayOverride ? { artworkDisplay: browseState.artworkDisplayOverride } : {}),
    ...((normalizeRotationDegrees(browseState.imageRotation ?? 0) !== 0)
      ? { imageRotation: normalizeRotationDegrees(browseState.imageRotation ?? 0) }
      : {}),
  };

  addCard(card);
  setSelectedCardIds([]);
  updateCollectionActions();
  celebrateAddToCollection();
  logStatus(`Added ${game.name} to collection.`);
}

function celebrateAddToCollection() {
  if (!addBrowsedGameBtn) return;

  addBrowsedGameBtn.classList.remove("preview-add-btn--celebrate");
  void addBrowsedGameBtn.offsetWidth;
  addBrowsedGameBtn.classList.add("preview-add-btn--celebrate");

  const host = addBrowsedGameBtn.closest(".preview-main") ?? addBrowsedGameBtn.parentElement;
  if (!host) return;

  const burst = document.createElement("div");
  burst.className = "party-favor";
  burst.setAttribute("aria-hidden", "true");

  const colors = ["var(--accent)", "#f4c95d", "#ff8b6a", "#7bc9a8", "#9b8cff"];
  for (let i = 0; i < 14; i += 1) {
    const piece = document.createElement("span");
    piece.className = "party-favor__piece";
    const angle = (i / 14) * Math.PI * 2;
    piece.style.setProperty("--tx", `${Math.cos(angle) * 52}px`);
    piece.style.setProperty("--ty", `${Math.sin(angle) * -42}px`);
    piece.style.setProperty("--rot", `${i * 46}deg`);
    piece.style.setProperty("--hue", colors[i % colors.length]);
    piece.style.animationDelay = `${i * 18}ms`;
    burst.appendChild(piece);
  }

  host.appendChild(burst);
  globalThis.setTimeout(() => burst.remove(), 900);
  globalThis.setTimeout(() => {
    addBrowsedGameBtn?.classList.remove("preview-add-btn--celebrate");
  }, 700);
}

function renderPreviewTypeTabs() {
  if (!previewTypeTabsEl) return;

  previewTypeTabsEl.innerHTML = "";
  const platformId = browseState?.game.platformId ?? getActivePlatformId();
  const types = browseState?.availableTypes ?? (platformId ? getArtworkPriorityForPlatform(platformId) : []);
  previewTypeTabsEl.hidden = types.length === 0;
  const interactive = isEditInteractive();

  for (const type of types) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "preview-type-tab";
    btn.disabled = !interactive;
    if (type === browseState?.imageType) btn.classList.add("preview-type-tab--active");
    btn.textContent = IMAGE_TYPES[type]?.label ?? type;
    btn.addEventListener("click", async () => {
      if (!browseState) return;
      browseState = { ...browseState, imageType: type };
      renderPreviewTypeTabs();
      await refreshPreview();
    });
    previewTypeTabsEl.appendChild(btn);
  }
}

function updateCollectionActions() {
  const totalCards = getCollection().length;
  const selectedCount = getSelectedCardIds().size;
  const label =
    selectedCount === 0
      ? "No cards selected"
      : selectedCount === 1
        ? "1 card selected"
        : `${selectedCount} cards selected`;

  if (collectionSelectionMetaEl) {
    collectionSelectionMetaEl.textContent = label;
    collectionSelectionMetaEl.classList.toggle("collection-meta--active", selectedCount > 0);
  }
  if (deleteSelectedBtn) deleteSelectedBtn.disabled = selectedCount === 0;
  if (printSelectedBtn) printSelectedBtn.disabled = selectedCount === 0;
  if (selectAllBtn) selectAllBtn.disabled = totalCards === 0 || selectedCount === totalCards;
  if (deselectAllBtn) deselectAllBtn.disabled = selectedCount === 0;
}

function renderCollection() {
  if (!collectionListEl) return;
  const collection = getCollection();
  const selectedIds = getSelectedCardIds();
  collectionListEl.innerHTML = "";

  if (collection.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-hint";
    empty.textContent = "Add a game from Select to build your print sheet.";
    collectionListEl.appendChild(empty);
    updateCollectionActions();
    return;
  }

  const tree = buildCollectionTree(collection);

  for (const { platform, cards } of tree) {
    const platformDetails = document.createElement("details");
    platformDetails.className = "collection-platform";
    platformDetails.open = true;
    platformDetails.style.setProperty("--platform-color", platform.defaultColor);

    const platformSummary = document.createElement("summary");
    platformSummary.className = "collection-platform__summary";

    const platformLead = document.createElement("span");
    platformLead.className = "collection-platform__lead";

    const platformEmoji = document.createElement("span");
    platformEmoji.className = "collection-platform__emoji";
    platformEmoji.textContent = platform.emoji;
    platformEmoji.setAttribute("aria-hidden", "true");

    const platformName = document.createElement("span");
    platformName.className = "collection-platform__name";
    platformName.textContent = platform.name;

    platformLead.append(platformEmoji, platformName);

    const platformCount = document.createElement("span");
    platformCount.className = "collection-platform__count";
    platformCount.textContent = String(cards.length);

    const platformChevron = document.createElement("span");
    platformChevron.className = "collection-platform__chevron";
    platformChevron.setAttribute("aria-hidden", "true");
    platformChevron.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    platformSummary.append(platformLead, platformCount, platformChevron);
    platformDetails.appendChild(platformSummary);

    const cardsEl = document.createElement("div");
    cardsEl.className = "collection-cards";

    for (const card of cards) {
      const row = document.createElement("div");
      row.className = "collection-card";
      if (selectedIds.has(card.id)) row.classList.add("collection-card--selected");

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "collection-card__copy-btn";
      copyBtn.title = `Copy ${card.gameName} settings to editor`;
      copyBtn.setAttribute("aria-label", `Copy ${card.gameName} settings to editor`);
      copyBtn.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2"/></svg>';
      copyBtn.addEventListener("click", () => {
        void copyCardSettingsToEditor(card);
      });

      const selectBtn = document.createElement("button");
      selectBtn.type = "button";
      selectBtn.className = "collection-card__select-btn";
      selectBtn.setAttribute("aria-pressed", selectedIds.has(card.id) ? "true" : "false");

      const thumb = document.createElement("img");
      thumb.className = "collection-card__thumb";
      thumb.alt = "";
      thumb.loading = "lazy";
      const artworkUrl = buildGameImageUrl(card.platformId, card.libretroName, card.imageType);
      thumb.src = card.imageFailed ? PLACEHOLDER_SVG : artworkUrl ?? PLACEHOLDER_SVG;
      thumb.addEventListener("error", () => {
        thumb.src = PLACEHOLDER_SVG;
      });

      const content = document.createElement("span");
      content.className = "collection-card__content";

      const info = document.createElement("span");
      info.className = "collection-card__info";

      const nameEl = document.createElement("span");
      nameEl.className = "collection-card__name";
      nameEl.textContent = card.gameName;
      info.appendChild(nameEl);

      const { year, publisher } = extractLibretroMetadata(card.libretroName);
      const metaParts = [year, publisher].filter(Boolean);
      if (metaParts.length > 0) {
        const metaEl = document.createElement("span");
        metaEl.className = "collection-card__meta";
        metaEl.textContent = metaParts.join(" - ");
        info.appendChild(metaEl);
      }

      content.appendChild(info);
      content.appendChild(thumb);

      selectBtn.addEventListener("click", () => {
        toggleCardSelection(card.id);
      });

      selectBtn.appendChild(content);

      if (card.imageFailed) {
        const badge = document.createElement("span");
        badge.className = "collection-card__badge";
        badge.textContent = "placeholder";
        selectBtn.appendChild(badge);
      }

      row.appendChild(selectBtn);
      row.appendChild(copyBtn);
      cardsEl.appendChild(row);
    }

    platformDetails.appendChild(cardsEl);
    collectionListEl.appendChild(platformDetails);
  }

  updateCollectionActions();
}

async function refreshCollectionImageStatus() {
  for (const card of getCollection()) {
    const game = gameForCard(card);
    const { failed } = await resolveGameImage(
      game ?? { platformId: card.platformId, libretroName: card.libretroName, name: card.gameName, images: {} },
      card.imageType,
    );
    if (Boolean(card.imageFailed) !== failed) {
      updateCard(card.id, { imageFailed: failed });
    }
  }
}

async function refreshPreview() {
  if (!previewImageEl || !previewMetaEl) return;

  if (!browseState) {
    syncEditColumnState();
    return;
  }

  const requestId = ++previewRequestId;
  schedulePreviewSkeleton();
  const settings = getSettings();

  try {
    const snapshot = browseState;
    const { game, imageType } = snapshot;
    const platform = platformById[game.platformId];
    const cardForRender = {
      id: "browse",
      platformId: game.platformId,
      gameName: game.name,
      libretroName: game.libretroName,
      imageType,
      headerSettings: currentHeaderSettingsSnapshot(),
      ...(snapshot.artworkDisplayOverride ? { artworkDisplay: snapshot.artworkDisplayOverride } : {}),
      ...((normalizeRotationDegrees(snapshot.imageRotation ?? 0) !== 0)
        ? { imageRotation: normalizeRotationDegrees(snapshot.imageRotation ?? 0) }
        : {}),
    };
    previewMetaEl.textContent = `${game.name} · ${platform?.name ?? ""} · ${IMAGE_TYPES[imageType]?.label ?? imageType}`;

    syncPreviewPlatformAccent();

    const canvas = await renderCard(cardForRender, settings.platformDefaults, settings);
    if (requestId !== previewRequestId) return;
    if (browseState !== snapshot) return;

    previewImageEl.hidden = false;
    previewImageEl.src = stickerCanvasToDataUrl(canvas, settings);
    previewImageEl.alt = `Preview: ${game.name}`;
    syncBrowseActionButton();
    renderPreviewTypeTabs();
    syncPreviewArtworkControls();
  } finally {
    if (requestId === previewRequestId) {
      cancelPreviewSkeleton();
    }
  }
}

function bindCollectionDrawer() {
  const toggle = document.getElementById("collection-drawer-toggle");
  const backdrop = document.getElementById("collection-drawer-backdrop");
  const printPanel = document.getElementById("print-panel");
  const storageKey = "nfc-card-designer-collection-drawer";

  const setOpen = (open) => {
    document.body.classList.toggle("collection-drawer-open", open);
    document.body.style.overflow = open ? "hidden" : "";
    toggle?.setAttribute("aria-expanded", open ? "true" : "false");
    backdrop?.toggleAttribute("hidden", !open);
    try {
      localStorage.setItem(storageKey, open ? "1" : "0");
    } catch {
      // ignore storage failures
    }
  };

  toggle?.addEventListener("click", () => {
    setOpen(!document.body.classList.contains("collection-drawer-open"));
  });

  backdrop?.addEventListener("click", () => setOpen(false));

  printPanel?.querySelector(".panel__title")?.addEventListener("click", () => {
    setOpen(false);
  });

  globalThis.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("collection-drawer-open")) {
      setOpen(false);
    }
  });
}

function bindEvents() {
  bindCollectionDrawer();
  bindGameResultsScroll();
  gameSearchInput?.addEventListener("focus", () => {
    gameSearchFocused = true;
    filterGames(gameSearchInput?.value ?? "");
  });

  gameSearchInput?.addEventListener("blur", () => {
    gameSearchFocused = false;
    globalThis.setTimeout(() => {
      if (!gameSearchFocused) {
        renderGameResults();
        updateGameSearchHint();
      }
    }, 150);
  });

  gameSearchInput?.addEventListener("input", (e) => {
    filterGames(/** @type {HTMLInputElement} */ (e.target).value);
  });

  gameSearchInput?.addEventListener("keydown", (e) => {
    const query = gameSearchInput?.value.trim() ?? "";
    const dropdownOpen =
      Boolean(getActivePlatformId()) &&
      (gameSearchFocused || query.length > 0) &&
      filteredGames.length > 0;

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
      if (game) {
        closeGameResults();
        void browseGameFromSearch(game);
      }
    }
  });

  globalShowHeaderInput?.addEventListener("change", (e) => {
    updateSettings({ showHeader: /** @type {HTMLInputElement} */ (e.target).checked });
    saveSettings(getSettings());
    syncGlobalSettingsControls();
    refreshPreview();
  });

  globalShowPlatformColorInput?.addEventListener("change", (e) => {
    updateSettings({
      showPlatformColor: /** @type {HTMLInputElement} */ (e.target).checked,
    });
    saveSettings(getSettings());
    syncGlobalSettingsControls();
    refreshPreview();
  });

  globalHeaderHeightInput?.addEventListener("input", (e) => {
    const headerHeightPercent = normalizeHeaderHeightPercent(
      Number(/** @type {HTMLInputElement} */ (e.target).value),
    );
    updateSettings({ headerHeightPercent });
    saveSettings(getSettings());
    syncGlobalSettingsControls();
    refreshPreview();
  });

  globalCardWidthInput?.addEventListener("change", (e) => {
    const settings = getSettings();
    const rawWidth = Number(/** @type {HTMLInputElement} */ (e.target).value);
    const cardWidthMm = Number.isFinite(rawWidth)
      ? normalizeCardWidthMm(rawWidth)
      : settings.cardWidthMm;
    updateSettings({
      cardWidthMm,
      stickerInsetMm: normalizeStickerInsetMm(
        settings.stickerInsetMm,
        cardWidthMm,
        settings.cardHeightMm,
      ),
    });
    saveSettings(getSettings());
    syncGlobalSettingsControls();
    refreshPreview();
  });

  globalCardHeightInput?.addEventListener("change", (e) => {
    const settings = getSettings();
    const rawHeight = Number(/** @type {HTMLInputElement} */ (e.target).value);
    const cardHeightMm = Number.isFinite(rawHeight)
      ? normalizeCardHeightMm(rawHeight)
      : settings.cardHeightMm;
    updateSettings({
      cardHeightMm,
      stickerInsetMm: normalizeStickerInsetMm(
        settings.stickerInsetMm,
        settings.cardWidthMm,
        cardHeightMm,
      ),
    });
    saveSettings(getSettings());
    syncGlobalSettingsControls();
    refreshPreview();
  });

  globalStickerInsetInput?.addEventListener("change", (e) => {
    const settings = getSettings();
    const rawInset = Number(/** @type {HTMLInputElement} */ (e.target).value);
    updateSettings({
      stickerInsetMm: normalizeStickerInsetMm(
        Number.isFinite(rawInset) ? rawInset : settings.stickerInsetMm,
        settings.cardWidthMm,
        settings.cardHeightMm,
      ),
    });
    saveSettings(getSettings());
    syncGlobalSettingsControls();
    refreshPreview();
  });

  previewArtworkBackgroundModeEl?.addEventListener("change", (e) => {
    applyPreviewArtworkPatch({
      backgroundMode: /** @type {HTMLSelectElement} */ (e.target).value,
    });
  });

  previewArtworkZoomEl?.addEventListener("input", (e) => {
    const zoom = artworkPercentToZoom(/** @type {HTMLInputElement} */ (e.target).value);
    applyPreviewArtworkPatch({ zoom });
  });

  previewArtworkResetBtn?.addEventListener("click", () => {
    if (!browseState) return;
    browseState = {
      ...browseState,
      artworkDisplayOverride: null,
      imageRotation: 0,
    };
    syncPreviewArtworkControls();
    refreshPreview();
  });

  previewArtworkRotateBtn?.addEventListener("click", () => {
    const context = getPreviewArtworkControlContext();
    if (!context?.isBrowseCard || !browseState) return;
    browseState = {
      ...browseState,
      imageRotation: normalizeRotationDegrees((context.cardRotation ?? 0) + 90),
    };
    syncPreviewArtworkControls();
    refreshPreview();
  });

  addBrowsedGameBtn?.addEventListener("click", () => {
    addBrowsedGame();
  });

  previewCalibrationInputEl?.addEventListener("input", (e) => {
    const nextPercent = Number(/** @type {HTMLInputElement} */ (e.target).value);
    applyPreviewCalibrationScale(nextPercent / 100);
  });

  document.getElementById("export-project")?.addEventListener("click", () => {
    exportProjectFile(getSettings(), getCollection());
    logStatus("Project exported.");
  });

  document.getElementById("import-project")?.addEventListener("click", async () => {
    try {
      const imported = await importProjectFile();
      const defaults = defaultSettings();
      updateSettings({
        platformDefaults:
          imported.settings.platformDefaults ??
          defaultSettings().platformDefaults,
        selectedPlatformId:
          typeof imported.settings.selectedPlatformId === "string"
            ? imported.settings.selectedPlatformId
            : defaults.selectedPlatformId,
        cardWidthMm: imported.settings.cardWidthMm ?? defaults.cardWidthMm,
        cardHeightMm: imported.settings.cardHeightMm ?? defaults.cardHeightMm,
        stickerInsetMm: imported.settings.stickerInsetMm ?? defaults.stickerInsetMm,
        showHeader: imported.settings.showHeader ?? defaults.showHeader,
        showPlatformColor: imported.settings.showPlatformColor ?? defaults.showPlatformColor,
        headerHeightPercent: imported.settings.headerHeightPercent ?? defaults.headerHeightPercent,
      });
      saveSettings(getSettings());
      replaceCollection(imported.cards);
      saveCollection(getCollection());
      if (imported.cards.length > 0) {
        setSelectedCardIds(imported.cards.map((c) => c.id));
      }
      clearBrowse();
      syncPlatformControls();
      syncPreviewArtworkControls();
      renderCollection();
      await refreshPreview();
      logStatus(`Imported project with ${imported.cards.length} card(s).`);
    } catch {
      logStatus("Could not import project.", true);
    }
  });

  document.getElementById("clear-project")?.addEventListener("click", () => {
    if (
      !confirm(
        "Clear your collection and reset all settings to defaults? This cannot be undone.",
      )
    ) {
      return;
    }

    const defaults = defaultSettings();
    updateSettings(defaults);
    saveSettings(getSettings());
    clearCollection();
    saveCollection(getCollection());
    clearBrowse();
    syncPlatformControls();
    syncPreviewArtworkControls();
    renderCollection();
    refreshPreview();
    logStatus("Project cleared.");
  });

  deleteSelectedBtn?.addEventListener("click", () => {
    const selected = getSelectedCards();
    if (selected.length === 0) return;
    const noun = selected.length === 1 ? "1 card" : `${selected.length} cards`;
    if (!confirm(`Delete ${noun} from your collection?`)) return;
    removeCards(selected.map((card) => card.id));
    renderCollection();
    refreshPreview();
    logStatus(`Deleted ${noun}.`);
  });

  selectAllBtn?.addEventListener("click", () => {
    const allCardIds = getCollection().map((card) => card.id);
    if (allCardIds.length === 0) return;
    setSelectedCardIds(allCardIds);
  });

  deselectAllBtn?.addEventListener("click", () => {
    setSelectedCardIds([]);
  });

  printSelectedBtn?.addEventListener("click", async () => {
    const selected = getSelectedCards();
    if (selected.length === 0) {
      logStatus("Select at least one card to print.", true);
      return;
    }
    logStatus("Generating PDF…");
    try {
      await exportLetterPdf(selected, getSettings().platformDefaults, getSettings());
      logStatus(`Printed ${selected.length} card(s) to PDF.`);
    } catch (err) {
      logStatus("PDF export failed.", true);
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
  selectAllBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById("select-all"));
  deselectAllBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById("deselect-all"));
  editPanelEl = document.getElementById("edit-panel");
  editControlsEl = document.getElementById("edit-controls");
  previewImageEl = /** @type {HTMLImageElement|null} */ (document.getElementById("preview-image"));
  if (previewImageEl) {
    previewImageEl.hidden = true;
    previewImageEl.removeAttribute("src");
    previewImageEl.alt = "";
  }
  previewFrameEl = document.getElementById("preview-frame");
  previewSkeletonEl = document.getElementById("preview-skeleton");
  previewMetaEl = document.getElementById("preview-meta");
  previewCalibrationInputEl = /** @type {HTMLInputElement|null} */ (
    document.getElementById("preview-calibration-input")
  );
  previewCalibrationValueEl = document.getElementById("preview-calibration-value");
  gameSearchInput = /** @type {HTMLInputElement|null} */ (document.getElementById("game-search"));
  gameSearchHintEl = document.getElementById("game-search-hint");
  globalShowHeaderInput = /** @type {HTMLInputElement|null} */ (
    document.getElementById("global-show-header")
  );
  globalShowPlatformColorInput = /** @type {HTMLInputElement|null} */ (
    document.getElementById("global-show-platform-color")
  );
  globalHeaderHeightInput = /** @type {HTMLInputElement|null} */ (
    document.getElementById("global-header-height")
  );
  globalHeaderHeightValueEl = document.getElementById("global-header-height-value");
  globalCardWidthInput = /** @type {HTMLInputElement|null} */ (
    document.getElementById("global-card-width")
  );
  globalCardHeightInput = /** @type {HTMLInputElement|null} */ (
    document.getElementById("global-card-height")
  );
  globalStickerInsetInput = /** @type {HTMLInputElement|null} */ (
    document.getElementById("global-sticker-inset")
  );
  previewTypeTabsEl = document.getElementById("preview-type-tabs");
  addBrowsedGameBtn = /** @type {HTMLButtonElement|null} */ (
    document.getElementById("add-browsed-game")
  );
  previewArtworkControlsEl = document.getElementById("preview-artwork-controls");
  previewArtworkAlignmentGridEl = document.getElementById("preview-artwork-alignment-grid");
  previewArtworkBackgroundModeEl = /** @type {HTMLSelectElement|null} */ (
    document.getElementById("preview-artwork-background-mode")
  );
  previewArtworkBackgroundColorEl = /** @type {HTMLInputElement|null} */ (
    document.getElementById("preview-artwork-background-color")
  );
  previewArtworkZoomEl = /** @type {HTMLInputElement|null} */ (
    document.getElementById("preview-artwork-zoom")
  );
  previewArtworkZoomValueEl = document.getElementById("preview-artwork-zoom-value");
  previewArtworkResetBtn = /** @type {HTMLButtonElement|null} */ (
    document.getElementById("preview-artwork-reset")
  );
  previewArtworkControlsTitleEl = document.getElementById("preview-artwork-controls-title");
  previewArtworkRotateBtn = /** @type {HTMLButtonElement|null} */ (
    document.getElementById("preview-artwork-rotate")
  );

  initPlatformSettingsModal({
    onChange: () => {
      void applyPlatformPriorityToBrowse();
      refreshPreview();
    },
  });

  if (previewArtworkAlignmentGridEl) {
    mountArtworkAlignmentGrid(previewArtworkAlignmentGridEl, (alignment) => {
      applyPreviewArtworkPatch({ alignment });
    });
  }

  if (previewArtworkBackgroundModeEl) {
    mountArtworkBackgroundModeSelect(previewArtworkBackgroundModeEl);
  }

  previewArtworkBackgroundColorEl?.addEventListener("input", (e) => {
    if (previewArtworkBackgroundColorEl?.disabled) return;
    applyPreviewArtworkPatch({
      backgroundColor: /** @type {HTMLInputElement} */ (e.target).value,
      backgroundMode: "select",
    });
  });

  syncEditColumnState();
  syncGlobalSettingsControls();
  bindEvents();
  applyPreviewCalibrationScale(loadPreviewCalibrationScale(), { persist: false });
  syncPlatformControls();
  renderPreviewTypeTabs();
  if (gameResultsEl) gameResultsEl.hidden = true;
  updateGameSearchHint();
  renderCollection();
  refreshCollectionImageStatus().then(() => {
    renderCollection();
    refreshPreview();
  });

  subscribe((event) => {
    if (event === "settings") {
      saveSettings(getSettings());
      syncGlobalSettingsControls();
    }
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
