import { platforms } from "./data/platforms.js";
import {
  gamesForPlatform,
  gameForCard,
  searchGames,
  pickGameFromCatalog,
  gameCountForPlatform,
  catalogCountForPlatform,
  platformsWithCatalogGames,
  platformHasCatalogGames,
  MIN_GAME_SEARCH_CHARS,
} from "./gameCatalog.js";
import { platformById } from "./data/platforms.js";
import {
  IMAGE_TYPES,
  CARD_PREVIEW_WIDTH_PX,
  PREVIEW_CALIBRATION_STORAGE_KEY,
  PLACEHOLDER_SVG,
} from "./config.js";
import { movePriorityItem } from "./imageSettings.js";
import {
  getEffectiveImageTypePriority,
  getPlatformArtworkDisplay,
  normalizeRotationDegrees,
  ROTATION_OPTIONS,
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
import {
  subscribe,
  getSettings,
  getCollection,
  getSelectedCardIds,
  getSelectedCards,
  getPreviewCard,
  updateSettings,
  setPlatformColor,
  setPlatformImageRotation,
  setPlatformImageTypePriority,
  setPlatformArtworkDisplay,
  setCardArtworkDisplay,
  clearCardArtworkDisplay,
  setCardImageRotation,
  clearCardImageRotation,
  getEffectiveArtworkDisplay,
  addCard,
  updateCard,
  removeCards,
  setSelectedCardIds,
  replaceCollection,
  clearCollection,
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
let platformColorInput = null;
/** @type {HTMLElement|null} */
let platformRotationFieldsEl = null;
/** @type {HTMLOListElement|null} */
let platformPriorityListEl = null;
/** @type {HTMLElement|null} */
let previewTypeTabsEl = null;
/** @type {HTMLButtonElement|null} */
let addBrowsedGameBtn = null;
/** @type {HTMLElement|null} */
let platformArtworkAlignmentGridEl = null;
/** @type {HTMLSelectElement|null} */
let platformArtworkBackgroundModeEl = null;
/** @type {HTMLInputElement|null} */
let platformArtworkBackgroundColorEl = null;
/** @type {HTMLButtonElement|null} */
let platformArtworkColorToolBtn = null;
/** @type {HTMLInputElement|null} */
let platformArtworkZoomEl = null;
/** @type {HTMLElement|null} */
let platformArtworkZoomValueEl = null;
/** @type {HTMLElement|null} */
let previewArtworkControlsEl = null;
/** @type {HTMLElement|null} */
let previewArtworkAlignmentGridEl = null;
/** @type {HTMLSelectElement|null} */
let previewArtworkBackgroundModeEl = null;
/** @type {HTMLInputElement|null} */
let previewArtworkBackgroundColorEl = null;
/** @type {HTMLButtonElement|null} */
let previewArtworkColorToolBtn = null;
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

/**
 * @type {{
 *   game: import('./gameCatalog.js').Game,
 *   imageType: string,
 *   availableTypes: string[],
 *   resolvedTypes: string[],
 *   targetCardId: string | null,
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
}

function cancelPreviewSkeleton() {
  clearTimeout(previewSkeletonTimer);
  previewSkeletonTimer = null;
  if (!previewSkeletonEl || !previewFrameEl) return;
  previewSkeletonEl.hidden = true;
  previewSkeletonEl.setAttribute("aria-hidden", "true");
  previewFrameEl.classList.remove("preview-frame--loading");
}

/** @type {number} */
let gameHighlightIndex = 0;
/** @type {import('./gameCatalog.js').Game[]} */
let filteredGames = [];
/** @type {number} */
let filteredGamesTotal = 0;

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
 * @param {HTMLButtonElement | null} colorToolBtn
 * @param {import('./artworkDisplay.js').ArtworkDisplaySettings} artworkDisplay
 */
function syncArtworkBackgroundControls(modeEl, colorEl, colorToolBtn, artworkDisplay) {
  const selectToolActive = artworkDisplay.backgroundMode === "select";
  if (modeEl) modeEl.value = artworkDisplay.backgroundMode;
  if (colorEl) colorEl.value = artworkDisplay.backgroundColor;
  if (colorToolBtn) {
    colorToolBtn.disabled = !selectToolActive;
    colorToolBtn.style.setProperty("--swatch-color", artworkDisplay.backgroundColor);
  }
}

/**
 * @param {HTMLInputElement | null} zoomEl
 * @param {HTMLElement | null} valueEl
 * @param {import('./artworkDisplay.js').ArtworkDisplaySettings} artworkDisplay
 */
function syncArtworkZoomControl(zoomEl, valueEl, artworkDisplay) {
  if (zoomEl) zoomEl.value = String(artworkDisplay.zoom);
  if (valueEl) valueEl.textContent = `${artworkDisplay.zoom}%`;
}

/**
 * @param {HTMLButtonElement} toolBtn
 * @param {HTMLInputElement} colorInput
 * @param {(color: string) => void} onColor
 */
function bindColorToolButton(toolBtn, colorInput, onColor) {
  toolBtn.addEventListener("click", async () => {
    if (toolBtn.disabled) return;

    if ("EyeDropper" in window) {
      try {
        const dropper = new EyeDropper();
        const { sRGBHex } = await dropper.open();
        onColor(sRGBHex);
        return;
      } catch (err) {
        if (err && typeof err === "object" && "name" in err && err.name === "AbortError") {
          return;
        }
      }
    }

    colorInput.click();
  });

  colorInput.addEventListener("input", () => {
    if (toolBtn.disabled) return;
    onColor(colorInput.value);
  });
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

function syncPlatformArtworkDisplayControls() {
  const settings = getSettings();
  const platformDefaults = settings.platformDefaults[settings.selectedPlatformId];
  if (!platformDefaults) return;

  syncArtworkAlignmentGrid(platformArtworkAlignmentGridEl, platformDefaults.artworkDisplay);
  syncArtworkBackgroundControls(
    platformArtworkBackgroundModeEl,
    platformArtworkBackgroundColorEl,
    platformArtworkColorToolBtn,
    platformDefaults.artworkDisplay,
  );
  syncArtworkZoomControl(
    platformArtworkZoomEl,
    platformArtworkZoomValueEl,
    platformDefaults.artworkDisplay,
  );
}

function syncPreviewArtworkControls() {
  const context = getPreviewArtworkControlContext();
  const showControls = Boolean(context);

  if (previewArtworkControlsEl) {
    previewArtworkControlsEl.hidden = !showControls;
  }

  if (!context) return;

  if (previewArtworkControlsTitleEl) {
    previewArtworkControlsTitleEl.textContent = "Artwork Display";
  }

  if (previewArtworkResetBtn) {
    previewArtworkResetBtn.hidden = false;
    previewArtworkResetBtn.disabled = !context.hasOverride;
  }

  if (previewArtworkRotateBtn) {
    previewArtworkRotateBtn.hidden = false;
    previewArtworkRotateBtn.disabled = false;
    const rotation = context.cardRotation ?? 0;
    previewArtworkRotateBtn.title = `Rotate artwork 90° (current ${rotation}°)`;
  }

  syncArtworkAlignmentGrid(previewArtworkAlignmentGridEl, context.display);
  syncArtworkBackgroundControls(
    previewArtworkBackgroundModeEl,
    previewArtworkBackgroundColorEl,
    previewArtworkColorToolBtn,
    context.display,
  );
  syncArtworkZoomControl(previewArtworkZoomEl, previewArtworkZoomValueEl, context.display);
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
  const browseTargetCard = browseState?.targetCardId
    ? getCollection().find((card) => card.id === browseState.targetCardId) ?? null
    : null;

  if (browseState && !browseTargetCard) {
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

  const previewCard = browseTargetCard ?? getPreviewCard();
  if (!previewCard) return null;

  return {
    mode: "card",
    cardId: previewCard.id,
    cardRotation: previewCard.imageRotation ?? 0,
    display: getEffectiveArtworkDisplay(previewCard),
    hasOverride: Boolean(previewCard.artworkDisplay) || (previewCard.imageRotation ?? 0) !== 0,
  };
}

/**
 * @param {Partial<import("./artworkDisplay.js").ArtworkDisplaySettings>} patch
 */
function applyPreviewArtworkPatch(patch) {
  const context = getPreviewArtworkControlContext();
  if (!context) return;

  if (context.cardId) {
    setCardArtworkDisplay(context.cardId, patch);
  } else if (context.isBrowseCard && browseState) {
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
  }

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
  addBrowsedGameBtn.hidden = false;
  if (!browseState) {
    addBrowsedGameBtn.textContent = "Add to collection";
    addBrowsedGameBtn.disabled = true;
    return;
  }
  addBrowsedGameBtn.textContent = browseState.targetCardId ? "Update Card" : "Add to collection";
  addBrowsedGameBtn.disabled = false;
}

/**
 * @returns {import("./state.js").Card | null}
 */
function getSingleSelectedCard() {
  const selected = getSelectedCards();
  return selected.length === 1 ? selected[0] : null;
}

/**
 * @param {import("./state.js").Card} card
 */
async function browseSelectedCard(card) {
  schedulePreviewSkeleton();
  const game =
    gameForCard(card) ?? {
      platformId: card.platformId,
      raGameId: card.raGameId,
      name: card.gameName,
      images: {},
    };
  const requestId = ++browseRequestId;
  const priority = getArtworkPriorityForPlatform(game.platformId);
  const resolvedTypes = await getAvailableImageTypes(game, priority);
  if (requestId !== browseRequestId) return;

  const availableTypes = browseTypesForGame(game, priority, resolvedTypes);
  browseState = {
    game,
    imageType: pickInitialBrowseImageType(availableTypes, resolvedTypes, card.imageType),
    availableTypes,
    resolvedTypes,
    targetCardId: card.id,
    artworkDisplayOverride: null,
    imageRotation: normalizeRotationDegrees(card.imageRotation ?? 0),
  };
  renderPreviewTypeTabs();
  syncBrowseActionButton();
  syncPreviewArtworkControls();
  await refreshPreview();
}

function syncBrowseStateWithSelection() {
  const selectedCard = getSingleSelectedCard();
  if (!selectedCard) {
    if (browseState?.targetCardId) {
      clearBrowse();
      void refreshPreview();
    }
    return;
  }

  if (
    browseState?.targetCardId === selectedCard.id &&
    browseState.game.platformId === selectedCard.platformId &&
    browseState.game.raGameId === selectedCard.raGameId &&
    browseState.game.name === selectedCard.gameName &&
    browseState.imageType === selectedCard.imageType
  ) {
    return;
  }

  void browseSelectedCard(selectedCard);
}

/**
 * @param {HTMLOListElement} listEl
 * @param {string[]} priority
 * @param {(next: string[]) => void} onChange
 */
function mountPriorityList(listEl, priority, onChange) {
  listEl.innerHTML = "";

  priority.forEach((type, index) => {
    const item = document.createElement("li");
    item.className = "priority-item";

    const rank = document.createElement("span");
    rank.className = "priority-item__rank";
    rank.textContent = String(index + 1);

    const label = document.createElement("span");
    label.className = "priority-item__label";
    label.textContent = IMAGE_TYPES[type]?.label ?? type;

    const actions = document.createElement("div");
    actions.className = "priority-item__actions";

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "priority-item__btn";
    upBtn.textContent = "▲";
    upBtn.disabled = index === 0;
    upBtn.addEventListener("click", () => {
      onChange(movePriorityItem(priority, index, -1));
    });

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "priority-item__btn";
    downBtn.textContent = "▼";
    downBtn.disabled = index === priority.length - 1;
    downBtn.addEventListener("click", () => {
      onChange(movePriorityItem(priority, index, 1));
    });

    actions.appendChild(upBtn);
    actions.appendChild(downBtn);
    item.appendChild(rank);
    item.appendChild(label);
    item.appendChild(actions);
    listEl.appendChild(item);
  });
}

function updateGameSearchHint(query = gameSearchInput?.value.trim() ?? "") {
  if (!gameSearchHintEl) return;

  const settings = getSettings();
  const gameCount = gameCountForPlatform(settings.selectedPlatformId);
  const catalogSize = catalogCountForPlatform(settings.selectedPlatformId);

  if (query.length === 0) {
    if (gameCount === 0) {
      gameSearchHintEl.textContent =
        catalogSize === 0
          ? "No retail games in catalog for this platform yet."
          : "No games available for this platform.";
    } else {
      gameSearchHintEl.textContent = `${gameCount} game${gameCount === 1 ? "" : "s"} in catalog`;
    }
    gameSearchHintEl.classList.remove("field-hint--ready");
    return;
  }

  if (query.length < MIN_GAME_SEARCH_CHARS) {
    const remaining = MIN_GAME_SEARCH_CHARS - query.length;
    gameSearchHintEl.textContent =
      remaining === 1
        ? `Type 1 more character to search ${gameCount} games.`
        : `Type ${remaining} more characters to search ${gameCount} games.`;
    gameSearchHintEl.classList.remove("field-hint--ready");
    return;
  }

  if (filteredGamesTotal === 0) {
    gameSearchHintEl.textContent =
      gameCount === 0 ? "No games on this platform yet." : `No games matching "${query}".`;
    gameSearchHintEl.classList.remove("field-hint--ready");
    return;
  }

  if (filteredGamesTotal > filteredGames.length) {
    gameSearchHintEl.textContent = `Showing ${filteredGames.length} of ${filteredGamesTotal} matches — refine your search`;
  } else {
    gameSearchHintEl.textContent = `${filteredGamesTotal} game${filteredGamesTotal === 1 ? "" : "s"} found`;
  }
  gameSearchHintEl.classList.add("field-hint--ready");
}

function filterGames(query) {
  const settings = getSettings();
  const q = query.trim();
  const result = searchGames(settings.selectedPlatformId, q);
  filteredGames = result.games;
  filteredGamesTotal = result.total;
  gameHighlightIndex = 0;
  renderGameResults();
  updateGameSearchHint(q);
}

function renderPlatformResults() {
  if (!platformResultsEl) return;
  const settings = getSettings();
  platformResultsEl.innerHTML = "";

  const visiblePlatforms = platformsWithCatalogGames();
  visiblePlatforms.forEach((platform) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "list-item";
    if (platform.id === settings.selectedPlatformId) btn.classList.add("list-item--selected");

    btn.textContent = platform.name;
    btn.addEventListener("click", () => selectPlatform(platform.id));
    platformResultsEl.appendChild(btn);
  });
}

function renderGameResults() {
  if (!gameResultsEl) return;
  gameResultsEl.innerHTML = "";

  const settings = getSettings();
  const gameCount = gameCountForPlatform(settings.selectedPlatformId);
  const query = gameSearchInput?.value.trim() ?? "";

  if (query.length < MIN_GAME_SEARCH_CHARS) {
    gameResultsEl.hidden = true;
    return;
  }

  gameResultsEl.hidden = false;

  if (filteredGames.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-hint";
    if (gameCount === 0) {
      empty.textContent = "No games on this platform yet.";
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
      browseGameFromSearch(game);
    });
    gameResultsEl.appendChild(btn);
  });

  if (filteredGamesTotal > filteredGames.length) {
    const more = document.createElement("p");
    more.className = "list-more-hint";
    more.textContent = `${filteredGamesTotal - filteredGames.length} more matches — keep typing to narrow down`;
    gameResultsEl.appendChild(more);
  }
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
  logStatus(`Platform: ${platformById[platformId]?.name ?? platformId}`);
}

function syncPlatformControls() {
  const settings = getSettings();
  if (!platformHasCatalogGames(settings.selectedPlatformId)) {
    const fallback = platformsWithCatalogGames()[0];
    if (fallback && fallback.id !== settings.selectedPlatformId) {
      updateSettings({ selectedPlatformId: fallback.id });
      saveSettings(getSettings());
    }
  }

  const currentSettings = getSettings();
  const platform = platformById[currentSettings.selectedPlatformId];
  const platformDefaults = currentSettings.platformDefaults[currentSettings.selectedPlatformId];

  if (platformColorInput && platform && platformDefaults) {
    platformColorInput.value = platformDefaults.color;
  }

  renderPlatformResults();
  renderPlatformImagePriorityList();
  renderPlatformRotationFields();
  syncPlatformArtworkDisplayControls();
  filterGames(gameSearchInput?.value ?? "");
}

function renderPlatformImagePriorityList() {
  if (!platformPriorityListEl) return;

  const settings = getSettings();
  const platformDefaults = settings.platformDefaults[settings.selectedPlatformId];
  if (!platformDefaults) return;

  mountPriorityList(platformPriorityListEl, platformDefaults.imageTypePriority, (next) => {
    setPlatformImageTypePriority(settings.selectedPlatformId, next);
    saveSettings(getSettings());
    renderPlatformImagePriorityList();
    renderPlatformRotationFields();
    applyPlatformPriorityToBrowse();
  });
}

function renderPlatformRotationFields() {
  if (!platformRotationFieldsEl) return;

  const settings = getSettings();
  const platformDefaults = settings.platformDefaults[settings.selectedPlatformId];
  platformRotationFieldsEl.innerHTML = "";

  if (!platformDefaults) return;

  for (const type of platformDefaults.imageTypePriority) {
    const meta = IMAGE_TYPES[type];
    if (!meta) continue;

    const field = document.createElement("label");
    field.className = "rotation-field";

    const label = document.createElement("span");
    label.className = "rotation-field__label";
    label.textContent = `${meta.label} rotation`;

    const select = document.createElement("select");
    select.className = "rotation-field__select";
    select.dataset.imageType = type;

    for (const degrees of ROTATION_OPTIONS) {
      const option = document.createElement("option");
      option.value = String(degrees);
      option.textContent = `${degrees}°`;
      select.appendChild(option);
    }

    select.value = String(platformDefaults.imageRotation?.[type] ?? 0);
    select.addEventListener("change", (e) => {
      const target = /** @type {HTMLSelectElement} */ (e.target);
      const imageType = target.dataset.imageType;
      if (!imageType) return;
      setPlatformImageRotation(
        settings.selectedPlatformId,
        imageType,
        Number(target.value),
      );
      saveSettings(getSettings());
      refreshPreview();
    });

    field.appendChild(label);
    field.appendChild(select);
    platformRotationFieldsEl.appendChild(field);
  }
}

async function applyPlatformPriorityToBrowse() {
  if (!browseState) return;

  const settings = getSettings();
  if (browseState.game.platformId !== settings.selectedPlatformId) return;

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
  const query = gameSearchInput?.value.trim() ?? "";
  if (query.length < MIN_GAME_SEARCH_CHARS) {
    logStatus(`Type at least ${MIN_GAME_SEARCH_CHARS} characters to search games.`, true);
    return null;
  }

  const settings = getSettings();
  const game = pickGameFromCatalog(settings.selectedPlatformId, query, gameHighlightIndex);
  if (!game) {
    logStatus(`No game matching "${query}".`, true);
    return null;
  }

  return game;
}

async function browseGameFromSearch(game) {
  const requestId = ++browseRequestId;
  schedulePreviewSkeleton();
  const selectedCard = getSingleSelectedCard();
  const editingSelectedCard =
    Boolean(selectedCard) &&
    selectedCard.platformId === game.platformId &&
    selectedCard.raGameId === game.raGameId;
  const targetCardId = editingSelectedCard && selectedCard ? selectedCard.id : null;
  const preferredType = editingSelectedCard && selectedCard ? selectedCard.imageType : null;
  const priority = getArtworkPriorityForPlatform(game.platformId);
  logStatus(`Loading preview for ${game.name}…`);

  const resolvedTypes = await getAvailableImageTypes(game, priority);
  if (requestId !== browseRequestId) return;

  const availableTypes = browseTypesForGame(game, priority, resolvedTypes);

  browseState = {
    game,
    imageType: pickInitialBrowseImageType(availableTypes, resolvedTypes, preferredType),
    availableTypes,
    resolvedTypes,
    targetCardId,
    artworkDisplayOverride: null,
    imageRotation: targetCardId && selectedCard ? normalizeRotationDegrees(selectedCard.imageRotation ?? 0) : 0,
  };

  renderPreviewTypeTabs();
  syncBrowseActionButton();
  syncPreviewArtworkControls();
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
  cancelPreviewSkeleton();
  browseState = null;
  renderPreviewTypeTabs();
  syncBrowseActionButton();
  syncPreviewArtworkControls();
}

function resetGameSearch({ focus = false } = {}) {
  clearBrowse();
  if (gameSearchInput) {
    gameSearchInput.value = "";
    if (focus) gameSearchInput.focus();
  }
  filterGames("");
}

async function addBrowsedGame() {
  if (!browseState) return;

  const { game, imageType, targetCardId } = browseState;
  const imageFailed = browseStateUsesPlaceholder(browseState);
  const targetCard = targetCardId
    ? getCollection().find((card) => card.id === targetCardId) ?? null
    : null;

  if (targetCard) {
    updateCard(targetCard.id, {
      platformId: game.platformId,
      gameName: game.name,
      raGameId: game.raGameId,
      imageType,
      imageFailed,
    });

    resetGameSearch({ focus: true });
    updateCollectionActions();
    await refreshPreview();
    logStatus(`Updated ${game.name}.`);
    return;
  }

  const card = {
    id: createCardId(),
    platformId: game.platformId,
    gameName: game.name,
    raGameId: game.raGameId,
    imageType,
    ...(imageFailed ? { imageFailed: true } : {}),
    ...(browseState.artworkDisplayOverride ? { artworkDisplay: browseState.artworkDisplayOverride } : {}),
    ...((normalizeRotationDegrees(browseState.imageRotation ?? 0) !== 0)
      ? { imageRotation: normalizeRotationDegrees(browseState.imageRotation ?? 0) }
      : {}),
  };

  addCard(card);
  setSelectedCardIds([]);
  resetGameSearch({ focus: true });
  updateCollectionActions();
  await refreshPreview();
  logStatus(`Added ${game.name} to collection.`);
}

function renderPreviewTypeTabs() {
  if (!previewTypeTabsEl) return;

  previewTypeTabsEl.innerHTML = "";
  const types = browseState?.availableTypes ?? getArtworkPriorityForPlatform(getSettings().selectedPlatformId);
  previewTypeTabsEl.hidden = types.length === 0;

  for (const type of types) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "preview-type-tab";
    btn.disabled = !browseState;
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

  for (const { platform, cards } of tree) {
    const platformDetails = document.createElement("details");
    platformDetails.className = "collection-platform";
    platformDetails.open = true;

    const platformSummary = document.createElement("summary");
    platformSummary.textContent = platform.name;
    platformDetails.appendChild(platformSummary);

    const cardsEl = document.createElement("div");
    cardsEl.className = "collection-cards";

    for (const card of cards) {
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
      const artLabel = IMAGE_TYPES[card.imageType]?.label ?? card.imageType;
      label.textContent = `${card.gameName} - ${artLabel}`;

      row.addEventListener("click", () => {
        toggleCardSelection(card.id);
        setPreviewCardId(card.id);
        renderCollection();
        updateCollectionActions();
        syncPreviewArtworkControls();
        refreshPreview();
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

    platformDetails.appendChild(cardsEl);
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
  if (!previewImageEl || !previewMetaEl) return;

  const requestId = ++previewRequestId;
  schedulePreviewSkeleton();

  try {
    if (browseState) {
      const snapshot = browseState;
      const { game, imageType } = snapshot;
      const platform = platformById[game.platformId];
      const targetCard = snapshot.targetCardId
        ? getCollection().find((entry) => entry.id === snapshot.targetCardId) ?? null
        : null;
      const cardForRender = targetCard
        ? {
            ...targetCard,
            platformId: game.platformId,
            gameName: game.name,
            raGameId: game.raGameId,
            imageType,
          }
        : {
            id: "browse",
            platformId: game.platformId,
            gameName: game.name,
            raGameId: game.raGameId,
            imageType,
            ...(snapshot.artworkDisplayOverride ? { artworkDisplay: snapshot.artworkDisplayOverride } : {}),
            ...((normalizeRotationDegrees(snapshot.imageRotation ?? 0) !== 0)
              ? { imageRotation: normalizeRotationDegrees(snapshot.imageRotation ?? 0) }
              : {}),
          };
      previewMetaEl.textContent = `${game.name} · ${platform?.name ?? ""} · ${IMAGE_TYPES[imageType]?.label ?? imageType}`;

      const canvas = await renderCard(cardForRender, getSettings().platformDefaults);
      if (requestId !== previewRequestId) return;
      if (browseState !== snapshot) return;

      previewImageEl.src = canvasToDataUrl(canvas, CARD_PREVIEW_WIDTH_PX);
      previewImageEl.alt = `Preview: ${game.name}`;
      syncBrowseActionButton();
      renderPreviewTypeTabs();
      syncPreviewArtworkControls();
      return;
    }

    syncBrowseActionButton();
    syncPreviewArtworkControls();

    const card = getPreviewCard();
    if (!card) {
      if (requestId !== previewRequestId) return;
      previewImageEl.src = PLACEHOLDER_SVG;
      previewImageEl.alt = "Preview placeholder";
      previewMetaEl.textContent = "Search for a game to preview artwork.";
      renderPreviewTypeTabs();
      return;
    }

    const platform = platformById[card.platformId];
    previewMetaEl.textContent = `${card.gameName} · ${platform?.name ?? ""} · ${IMAGE_TYPES[card.imageType]?.label ?? card.imageType}`;

    const canvas = await renderCard(card, getSettings().platformDefaults);
    if (requestId !== previewRequestId) return;
    if (browseState) return;

    previewImageEl.src = canvasToDataUrl(canvas, CARD_PREVIEW_WIDTH_PX);
    previewImageEl.alt = `Preview: ${card.gameName}`;
    renderPreviewTypeTabs();
  } finally {
    if (requestId === previewRequestId) {
      cancelPreviewSkeleton();
    }
  }
}

function bindEvents() {
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
      if (game) browseGameFromSearch(game);
    }
  });

  platformColorInput?.addEventListener("input", (e) => {
    const settings = getSettings();
    setPlatformColor(settings.selectedPlatformId, /** @type {HTMLInputElement} */ (e.target).value);
    saveSettings(getSettings());
    refreshPreview();
  });

  platformArtworkBackgroundModeEl?.addEventListener("change", (e) => {
    const settings = getSettings();
    setPlatformArtworkDisplay(
      settings.selectedPlatformId,
      { backgroundMode: /** @type {HTMLSelectElement} */ (e.target).value },
    );
    saveSettings(getSettings());
    syncPlatformArtworkDisplayControls();
    refreshPreview();
  });

  platformArtworkZoomEl?.addEventListener("input", (e) => {
    const zoom = Math.min(
      MAX_ARTWORK_ZOOM,
      Math.max(MIN_ARTWORK_ZOOM, Number(/** @type {HTMLInputElement} */ (e.target).value)),
    );
    const settings = getSettings();
    setPlatformArtworkDisplay(settings.selectedPlatformId, { zoom });
    saveSettings(getSettings());
    syncPlatformArtworkDisplayControls();
    refreshPreview();
  });

  previewArtworkBackgroundModeEl?.addEventListener("change", (e) => {
    applyPreviewArtworkPatch({
      backgroundMode: /** @type {HTMLSelectElement} */ (e.target).value,
    });
  });

  previewArtworkZoomEl?.addEventListener("input", (e) => {
    const zoom = Math.min(
      MAX_ARTWORK_ZOOM,
      Math.max(MIN_ARTWORK_ZOOM, Number(/** @type {HTMLInputElement} */ (e.target).value)),
    );
    applyPreviewArtworkPatch({ zoom });
  });

  previewArtworkResetBtn?.addEventListener("click", () => {
    const context = getPreviewArtworkControlContext();
    if (!context) return;
    if (context.cardId) {
      clearCardArtworkDisplay(context.cardId);
      clearCardImageRotation(context.cardId);
    } else if (context.isBrowseCard && browseState) {
      browseState = {
        ...browseState,
        artworkDisplayOverride: null,
        imageRotation: 0,
      };
    }
    syncPreviewArtworkControls();
    refreshPreview();
  });

  previewArtworkRotateBtn?.addEventListener("click", () => {
    const context = getPreviewArtworkControlContext();
    if (!context) return;
    if (context.cardId) {
      setCardImageRotation(context.cardId, (context.cardRotation ?? 0) + 90);
    } else if (context.isBrowseCard && browseState) {
      browseState = {
        ...browseState,
        imageRotation: normalizeRotationDegrees((context.cardRotation ?? 0) + 90),
      };
    }
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
        selectedPlatformId: imported.settings.selectedPlatformId ?? defaults.selectedPlatformId,
      });
      saveSettings(getSettings());
      replaceCollection(imported.cards);
      saveCollection(getCollection());
      if (imported.cards.length > 0) {
        setSelectedCardIds(imported.cards.map((c) => c.id));
        setPreviewCardId(imported.cards[0].id);
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

  printSelectedBtn?.addEventListener("click", async () => {
    const selected = getSelectedCards();
    if (selected.length === 0) {
      logStatus("Select at least one card to print.", true);
      return;
    }
    logStatus("Generating PDF…");
    try {
      await exportLetterPdf(selected, getSettings().platformDefaults);
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
  previewImageEl = /** @type {HTMLImageElement|null} */ (document.getElementById("preview-image"));
  previewFrameEl = document.getElementById("preview-frame");
  previewSkeletonEl = document.getElementById("preview-skeleton");
  previewMetaEl = document.getElementById("preview-meta");
  previewCalibrationInputEl = /** @type {HTMLInputElement|null} */ (
    document.getElementById("preview-calibration-input")
  );
  previewCalibrationValueEl = document.getElementById("preview-calibration-value");
  gameSearchInput = /** @type {HTMLInputElement|null} */ (document.getElementById("game-search"));
  gameSearchHintEl = document.getElementById("game-search-hint");
  platformColorInput = /** @type {HTMLInputElement|null} */ (document.getElementById("platform-color"));
  platformRotationFieldsEl = document.getElementById("platform-rotation-fields");
  platformPriorityListEl = /** @type {HTMLOListElement|null} */ (
    document.getElementById("platform-priority-list")
  );
  previewTypeTabsEl = document.getElementById("preview-type-tabs");
  addBrowsedGameBtn = /** @type {HTMLButtonElement|null} */ (
    document.getElementById("add-browsed-game")
  );
  if (addBrowsedGameBtn) addBrowsedGameBtn.hidden = false;
  platformArtworkAlignmentGridEl = document.getElementById("platform-artwork-alignment-grid");
  platformArtworkBackgroundModeEl = /** @type {HTMLSelectElement|null} */ (
    document.getElementById("platform-artwork-background-mode")
  );
  platformArtworkBackgroundColorEl = /** @type {HTMLInputElement|null} */ (
    document.getElementById("platform-artwork-background-color")
  );
  platformArtworkColorToolBtn = /** @type {HTMLButtonElement|null} */ (
    document.getElementById("platform-artwork-color-tool")
  );
  platformArtworkZoomEl = /** @type {HTMLInputElement|null} */ (
    document.getElementById("platform-artwork-zoom")
  );
  platformArtworkZoomValueEl = document.getElementById("platform-artwork-zoom-value");
  previewArtworkControlsEl = document.getElementById("preview-artwork-controls");
  previewArtworkAlignmentGridEl = document.getElementById("preview-artwork-alignment-grid");
  previewArtworkBackgroundModeEl = /** @type {HTMLSelectElement|null} */ (
    document.getElementById("preview-artwork-background-mode")
  );
  previewArtworkBackgroundColorEl = /** @type {HTMLInputElement|null} */ (
    document.getElementById("preview-artwork-background-color")
  );
  previewArtworkColorToolBtn = /** @type {HTMLButtonElement|null} */ (
    document.getElementById("preview-artwork-color-tool")
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

  if (platformArtworkAlignmentGridEl) {
    mountArtworkAlignmentGrid(platformArtworkAlignmentGridEl, (alignment) => {
      const settings = getSettings();
      setPlatformArtworkDisplay(settings.selectedPlatformId, { alignment });
      saveSettings(getSettings());
      syncPlatformArtworkDisplayControls();
      refreshPreview();
    });
  }

  if (previewArtworkAlignmentGridEl) {
    mountArtworkAlignmentGrid(previewArtworkAlignmentGridEl, (alignment) => {
      applyPreviewArtworkPatch({ alignment });
    });
  }

  if (platformArtworkBackgroundModeEl) {
    mountArtworkBackgroundModeSelect(platformArtworkBackgroundModeEl);
  }
  if (previewArtworkBackgroundModeEl) {
    mountArtworkBackgroundModeSelect(previewArtworkBackgroundModeEl);
  }

  if (platformArtworkColorToolBtn && platformArtworkBackgroundColorEl) {
    bindColorToolButton(platformArtworkColorToolBtn, platformArtworkBackgroundColorEl, (color) => {
      const settings = getSettings();
      setPlatformArtworkDisplay(settings.selectedPlatformId, {
        backgroundColor: color,
        backgroundMode: "select",
      });
      saveSettings(getSettings());
      syncPlatformArtworkDisplayControls();
      refreshPreview();
    });
  }

  if (previewArtworkColorToolBtn && previewArtworkBackgroundColorEl) {
    bindColorToolButton(previewArtworkColorToolBtn, previewArtworkBackgroundColorEl, (color) => {
      applyPreviewArtworkPatch({
        backgroundColor: color,
        backgroundMode: "select",
      });
    });
  }

  syncPlatformArtworkDisplayControls();
  syncPreviewArtworkControls();
  syncBrowseActionButton();
  bindEvents();
  applyPreviewCalibrationScale(loadPreviewCalibrationScale(), { persist: false });
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
      if (browseState?.targetCardId && !getCollection().some((card) => card.id === browseState.targetCardId)) {
        clearBrowse();
      }
      renderCollection();
    }
    if (event === "selection") {
      syncBrowseStateWithSelection();
      renderCollection();
      updateCollectionActions();
      syncPreviewArtworkControls();
      refreshPreview();
    }
  });
}
