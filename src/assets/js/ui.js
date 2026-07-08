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
import { normalizeHeaderHeightPercent } from "./headerSettings.js";
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
let searchOnlyGamesWithImagesInput = null;
/** @type {HTMLInputElement|null} */
let gameSearchInput = null;
/** @type {HTMLElement|null} */
let gameSearchHintEl = null;
/** @type {HTMLInputElement|null} */
let platformColorInput = null;
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

/**
 * Treat empty/invalid ids as no active platform selection.
 * @returns {string | null}
 */
function getActivePlatformId() {
  const selectedPlatformId = getSettings().selectedPlatformId;
  if (!selectedPlatformId) return null;
  if (!platformHasCatalogGames(selectedPlatformId)) return null;
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
  const activePlatformId = getActivePlatformId();
  const artworkDisplay = activePlatformId
    ? getPlatformArtworkDisplay(settings.platformDefaults, activePlatformId)
    : normalizeArtworkDisplay();

  syncArtworkAlignmentGrid(platformArtworkAlignmentGridEl, artworkDisplay);
  syncArtworkBackgroundControls(
    platformArtworkBackgroundModeEl,
    platformArtworkBackgroundColorEl,
    platformArtworkColorToolBtn,
    artworkDisplay,
  );
  syncArtworkZoomControl(
    platformArtworkZoomEl,
    platformArtworkZoomValueEl,
    artworkDisplay,
  );

  const controlsDisabled = !activePlatformId;
  if (platformArtworkAlignmentGridEl) {
    for (const btn of platformArtworkAlignmentGridEl.querySelectorAll("[data-alignment]")) {
      /** @type {HTMLButtonElement} */ (btn).disabled = controlsDisabled;
    }
  }
  if (platformArtworkBackgroundModeEl) {
    platformArtworkBackgroundModeEl.disabled = controlsDisabled;
  }
  if (platformArtworkZoomEl) {
    platformArtworkZoomEl.disabled = controlsDisabled;
  }
  if (platformArtworkColorToolBtn && controlsDisabled) {
    platformArtworkColorToolBtn.disabled = true;
  }
}

function syncPreviewArtworkControls() {
  const context = getPreviewArtworkControlContext();
  const activePlatformId = getActivePlatformId();
  const fallbackDisplay = activePlatformId
    ? getPlatformArtworkDisplay(getSettings().platformDefaults, activePlatformId)
    : normalizeArtworkDisplay();
  const display = context?.display ?? fallbackDisplay;

  if (previewArtworkControlsTitleEl) {
    previewArtworkControlsTitleEl.textContent = context
      ? "Artwork Display"
      : "Artwork Display (select a game or card)";
  }

  if (previewArtworkResetBtn) {
    previewArtworkResetBtn.hidden = false;
    previewArtworkResetBtn.disabled = !context || !context.hasOverride;
  }

  if (previewArtworkRotateBtn) {
    const rotation = context?.cardRotation ?? 0;
    previewArtworkRotateBtn.hidden = false;
    previewArtworkRotateBtn.disabled = !context;
    previewArtworkRotateBtn.title = `Rotate artwork 90° (current ${rotation}°)`;
  }

  if (previewArtworkControlsEl) {
    previewArtworkControlsEl.hidden = false;
  }

  syncArtworkAlignmentGrid(previewArtworkAlignmentGridEl, display);
  syncArtworkBackgroundControls(
    previewArtworkBackgroundModeEl,
    previewArtworkBackgroundColorEl,
    previewArtworkColorToolBtn,
    display,
  );
  syncArtworkZoomControl(previewArtworkZoomEl, previewArtworkZoomValueEl, display);

  const controlsDisabled = !context;
  if (previewArtworkAlignmentGridEl) {
    for (const btn of previewArtworkAlignmentGridEl.querySelectorAll("[data-alignment]")) {
      /** @type {HTMLButtonElement} */ (btn).disabled = controlsDisabled;
    }
  }
  if (previewArtworkBackgroundModeEl) {
    previewArtworkBackgroundModeEl.disabled = controlsDisabled;
  }
  if (previewArtworkZoomEl) {
    previewArtworkZoomEl.disabled = controlsDisabled;
  }
  if (previewArtworkColorToolBtn && controlsDisabled) {
    previewArtworkColorToolBtn.disabled = true;
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

function getEditingCard() {
  if (!browseState?.targetCardId) return null;
  return getCollection().find((card) => card.id === browseState.targetCardId) ?? null;
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
  const activePlatformId = getActivePlatformId();
  if (!activePlatformId) {
    gameSearchHintEl.textContent = "Select a platform to search retail releases.";
    gameSearchHintEl.classList.remove("field-hint--ready");
    return;
  }

  const requireImages = getSettings().searchOnlyGamesWithImages;
  const gameCount = gameCountForPlatform(activePlatformId, { requireImages });
  const catalogSize = catalogCountForPlatform(activePlatformId);

  if (query.length === 0) {
    if (gameCount === 0) {
      gameSearchHintEl.textContent =
        catalogSize === 0
          ? "No retail games in catalog for this platform yet."
          : requireImages
            ? "No games with artwork available for this platform."
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
      gameCount === 0
        ? requireImages
          ? "No games with artwork on this platform yet."
          : "No games on this platform yet."
        : `No games matching "${query}".`;
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
  const activePlatformId = getActivePlatformId();
  const q = query.trim();
  if (!activePlatformId) {
    filteredGames = [];
    filteredGamesTotal = 0;
    gameHighlightIndex = 0;
    renderGameResults();
    updateGameSearchHint(q);
    return;
  }
  const requireImages = getSettings().searchOnlyGamesWithImages;
  const result = searchGames(activePlatformId, q, { requireImages });
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

  const visiblePlatforms = [...platformsWithCatalogGames()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
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

function closeGameResults() {
  if (!gameResultsEl) return;
  gameResultsEl.hidden = true;
}

function renderGameResults() {
  if (!gameResultsEl) return;
  gameResultsEl.innerHTML = "";
  const activePlatformId = getActivePlatformId();
  if (!activePlatformId) {
    closeGameResults();
    return;
  }

  const requireImages = getSettings().searchOnlyGamesWithImages;
  const gameCount = gameCountForPlatform(activePlatformId, { requireImages });
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
      empty.textContent = requireImages
        ? "No games with artwork on this platform yet."
        : "No games on this platform yet.";
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
      closeGameResults();
      void browseGameFromSearch(game);
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
  if (searchOnlyGamesWithImagesInput) {
    searchOnlyGamesWithImagesInput.checked = !settings.searchOnlyGamesWithImages;
  }
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
  if (selectedPlatformId && !platformHasCatalogGames(selectedPlatformId)) {
    updateSettings({ selectedPlatformId: "" });
    saveSettings(getSettings());
  }

  const activePlatformId = getActivePlatformId();
  const currentSettings = getSettings();
  const platform = activePlatformId ? platformById[activePlatformId] : null;
  const platformDefaults = activePlatformId
    ? currentSettings.platformDefaults[activePlatformId]
    : null;

  if (platformColorInput) {
    platformColorInput.value = platform && platformDefaults ? platformDefaults.color : "#000000";
    platformColorInput.disabled = !activePlatformId;
  }
  if (gameSearchInput) {
    gameSearchInput.disabled = !activePlatformId;
    gameSearchInput.placeholder = activePlatformId ? "Search games..." : "Select a platform first";
  }
  if (!activePlatformId) {
    closeGameResults();
  }

  renderPlatformResults();
  renderPlatformImagePriorityList();
  renderPlatformRotationFields();
  syncPlatformArtworkDisplayControls();
  filterGames(gameSearchInput?.value ?? "");
}

function renderPlatformImagePriorityList() {
  if (!platformPriorityListEl) return;
  const activePlatformId = getActivePlatformId();
  if (!activePlatformId) {
    platformPriorityListEl.innerHTML = "";
    return;
  }

  const settings = getSettings();
  const platformDefaults = settings.platformDefaults[activePlatformId];
  if (!platformDefaults) return;

  mountPriorityList(platformPriorityListEl, platformDefaults.imageTypePriority, (next) => {
    setPlatformImageTypePriority(activePlatformId, next);
    saveSettings(getSettings());
    renderPlatformImagePriorityList();
    renderPlatformRotationFields();
    applyPlatformPriorityToBrowse();
  });
}

function renderPlatformRotationFields() {
  if (!platformRotationFieldsEl) return;
  const activePlatformId = getActivePlatformId();
  if (!activePlatformId) {
    platformRotationFieldsEl.innerHTML = "";
    return;
  }

  const settings = getSettings();
  const platformDefaults = settings.platformDefaults[activePlatformId];
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
        activePlatformId,
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
  if (query.length < MIN_GAME_SEARCH_CHARS) {
    logStatus(`Type at least ${MIN_GAME_SEARCH_CHARS} characters to search games.`, true);
    return null;
  }

  const game = pickGameFromCatalog(activePlatformId, query, gameHighlightIndex, {
    requireImages: getSettings().searchOnlyGamesWithImages,
  });
  if (!game) {
    logStatus(`No game matching "${query}".`, true);
    return null;
  }

  return game;
}

async function browseGameFromSearch(game) {
  const requestId = ++browseRequestId;
  schedulePreviewSkeleton();
  const editingCard = getEditingCard();
  const targetCardId = editingCard ? editingCard.id : null;
  const preferredType = editingCard ? editingCard.imageType : null;
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
    imageRotation: targetCardId ? normalizeRotationDegrees(editingCard?.imageRotation ?? 0) : 0,
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
  closeGameResults();
  if (gameSearchInput) {
    gameSearchInput.value = "";
    if (focus) gameSearchInput.focus();
  }
  filterGames("");
}

async function addBrowsedGame() {
  if (!browseState) return;

  const { game, imageType, targetCardId } = browseState;
  const headerSettings = currentHeaderSettingsSnapshot();
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
      ...(targetCard.headerSettings ? {} : { headerSettings }),
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
    headerSettings,
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
  const totalCards = getCollection().length;
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
      const row = document.createElement("div");
      row.className = "collection-card";
      if (selectedIds.has(card.id)) row.classList.add("collection-card--selected");

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "collection-card__edit-btn";
      if (browseState?.targetCardId === card.id) {
        editBtn.classList.add("collection-card__edit-btn--active");
      }
      editBtn.textContent = "✎";
      editBtn.title = `Edit ${card.gameName}`;
      editBtn.setAttribute("aria-label", `Edit ${card.gameName}`);
      editBtn.addEventListener("click", () => {
        void browseSelectedCard(card);
      });

      const selectBtn = document.createElement("button");
      selectBtn.type = "button";
      selectBtn.className = "collection-card__select-btn";

      const mark = document.createElement("span");
      mark.className = "collection-card__mark";
      mark.textContent = selectedIds.has(card.id) ? "✓" : "";
      mark.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      label.className = "collection-card__label";
      const artLabel = IMAGE_TYPES[card.imageType]?.label ?? card.imageType;
      label.textContent = `${card.gameName} - ${artLabel}`;

      selectBtn.addEventListener("click", () => {
        if (browseState) clearBrowse();
        toggleCardSelection(card.id);
        setPreviewCardId(card.id);
        renderCollection();
        updateCollectionActions();
        syncPreviewArtworkControls();
        refreshPreview();
      });

      selectBtn.appendChild(mark);
      selectBtn.appendChild(label);

      if (card.imageFailed) {
        const badge = document.createElement("span");
        badge.className = "collection-card__badge";
        badge.textContent = "placeholder";
        selectBtn.appendChild(badge);
      }

      row.appendChild(editBtn);
      row.appendChild(selectBtn);
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
  const settings = getSettings();

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
            headerSettings: currentHeaderSettingsSnapshot(),
            ...(snapshot.artworkDisplayOverride ? { artworkDisplay: snapshot.artworkDisplayOverride } : {}),
            ...((normalizeRotationDegrees(snapshot.imageRotation ?? 0) !== 0)
              ? { imageRotation: normalizeRotationDegrees(snapshot.imageRotation ?? 0) }
              : {}),
          };
      previewMetaEl.textContent = `${game.name} · ${platform?.name ?? ""} · ${IMAGE_TYPES[imageType]?.label ?? imageType}`;

      const canvas = await renderCard(cardForRender, settings.platformDefaults, settings);
      if (requestId !== previewRequestId) return;
      if (browseState !== snapshot) return;

      previewImageEl.hidden = false;
      previewImageEl.src = stickerCanvasToDataUrl(canvas, settings);
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
      previewImageEl.hidden = true;
      previewImageEl.src = "";
      previewImageEl.alt = "";
      previewMetaEl.textContent = "Search for a game to preview artwork.";
      renderPreviewTypeTabs();
      return;
    }

    const platform = platformById[card.platformId];
    previewMetaEl.textContent = `${card.gameName} · ${platform?.name ?? ""} · ${IMAGE_TYPES[card.imageType]?.label ?? card.imageType}`;

    const canvas = await renderCard(card, settings.platformDefaults, settings);
    if (requestId !== previewRequestId) return;
    if (browseState) return;

    previewImageEl.hidden = false;
    previewImageEl.src = stickerCanvasToDataUrl(canvas, settings);
    previewImageEl.alt = `Preview: ${card.gameName}`;
    renderPreviewTypeTabs();
  } finally {
    if (requestId === previewRequestId) {
      cancelPreviewSkeleton();
    }
  }
}

function bindEvents() {
  searchOnlyGamesWithImagesInput?.addEventListener("change", (e) => {
    updateSettings({
      // Checked means "include games with no images", so require-images is the inverse.
      searchOnlyGamesWithImages: !/** @type {HTMLInputElement} */ (e.target).checked,
    });
    saveSettings(getSettings());
    filterGames(gameSearchInput?.value ?? "");
  });

  gameSearchInput?.addEventListener("input", (e) => {
    filterGames(/** @type {HTMLInputElement} */ (e.target).value);
  });

  gameSearchInput?.addEventListener("keydown", (e) => {
    const query = gameSearchInput?.value.trim() ?? "";
    const dropdownOpen = Boolean(getActivePlatformId()) && query.length >= MIN_GAME_SEARCH_CHARS;

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

  platformColorInput?.addEventListener("input", (e) => {
    const activePlatformId = getActivePlatformId();
    if (!activePlatformId) return;
    setPlatformColor(activePlatformId, /** @type {HTMLInputElement} */ (e.target).value);
    saveSettings(getSettings());
    refreshPreview();
  });

  platformArtworkBackgroundModeEl?.addEventListener("change", (e) => {
    const activePlatformId = getActivePlatformId();
    if (!activePlatformId) return;
    setPlatformArtworkDisplay(
      activePlatformId,
      { backgroundMode: /** @type {HTMLSelectElement} */ (e.target).value },
    );
    saveSettings(getSettings());
    syncPlatformArtworkDisplayControls();
    refreshPreview();
  });

  platformArtworkZoomEl?.addEventListener("input", (e) => {
    const activePlatformId = getActivePlatformId();
    if (!activePlatformId) return;
    const zoom = Math.min(
      MAX_ARTWORK_ZOOM,
      Math.max(MIN_ARTWORK_ZOOM, Number(/** @type {HTMLInputElement} */ (e.target).value)),
    );
    setPlatformArtworkDisplay(activePlatformId, { zoom });
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
        searchOnlyGamesWithImages:
          imported.settings.searchOnlyGamesWithImages ?? defaults.searchOnlyGamesWithImages,
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
  previewImageEl = /** @type {HTMLImageElement|null} */ (document.getElementById("preview-image"));
  if (previewImageEl) previewImageEl.hidden = true;
  previewFrameEl = document.getElementById("preview-frame");
  previewSkeletonEl = document.getElementById("preview-skeleton");
  previewMetaEl = document.getElementById("preview-meta");
  previewCalibrationInputEl = /** @type {HTMLInputElement|null} */ (
    document.getElementById("preview-calibration-input")
  );
  previewCalibrationValueEl = document.getElementById("preview-calibration-value");
  searchOnlyGamesWithImagesInput = /** @type {HTMLInputElement|null} */ (
    document.getElementById("search-only-games-with-images")
  );
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
      const activePlatformId = getActivePlatformId();
      if (!activePlatformId) return;
      setPlatformArtworkDisplay(activePlatformId, { alignment });
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
      const activePlatformId = getActivePlatformId();
      if (!activePlatformId) return;
      setPlatformArtworkDisplay(activePlatformId, {
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
  syncGlobalSettingsControls();
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
    if (event === "settings") {
      saveSettings(getSettings());
      syncGlobalSettingsControls();
    }
    if (event === "collection") {
      saveCollection(getCollection());
      if (browseState?.targetCardId && !getCollection().some((card) => card.id === browseState.targetCardId)) {
        clearBrowse();
      }
      renderCollection();
    }
    if (event === "selection") {
      renderCollection();
      updateCollectionActions();
      syncPreviewArtworkControls();
      refreshPreview();
    }
  });
}
