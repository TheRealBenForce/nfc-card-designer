import { IMAGE_TYPES } from "./config.js";
import { movePriorityItem } from "./imageSettings.js";
import {
  getPlatformArtworkDisplay,
  getSeedPlatformDefaults,
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
import { platformById } from "./data/platforms.js";
import {
  getSettings,
  setPlatformArtworkDisplay,
  setPlatformColor,
  setPlatformImageRotation,
  setPlatformImageTypePriority,
  updateSettings,
} from "./state.js";
import { saveSettings } from "./storage.js";

const ARTWORK_ZOOM_BASE_PERCENT = 100;
const MIN_ARTWORK_ZOOM_PERCENT = ARTWORK_ZOOM_BASE_PERCENT + MIN_ARTWORK_ZOOM;
const MAX_ARTWORK_ZOOM_PERCENT = ARTWORK_ZOOM_BASE_PERCENT + MAX_ARTWORK_ZOOM;

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

/** @type {HTMLDialogElement | null} */
let dialogEl = null;
/** @type {HTMLElement | null} */
let titleEl = null;
/** @type {HTMLInputElement | null} */
let colorInputEl = null;
/** @type {HTMLOListElement | null} */
let priorityListEl = null;
/** @type {HTMLElement | null} */
let rotationFieldsEl = null;
/** @type {HTMLElement | null} */
let alignmentGridEl = null;
/** @type {HTMLSelectElement | null} */
let backgroundModeEl = null;
/** @type {HTMLInputElement | null} */
let backgroundColorEl = null;
/** @type {HTMLButtonElement | null} */
let colorToolBtn = null;
/** @type {HTMLInputElement | null} */
let zoomEl = null;
/** @type {HTMLElement | null} */
let zoomValueEl = null;
/** @type {HTMLButtonElement | null} */
let resetBtn = null;

/** @type {string | null} */
let editingPlatformId = null;

/** @type {{ onChange?: () => void }} */
let callbacks = {};

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
 * @param {HTMLButtonElement | null} toolBtn
 * @param {import('./artworkDisplay.js').ArtworkDisplaySettings} artworkDisplay
 */
function syncArtworkBackgroundControls(modeEl, colorEl, toolBtn, artworkDisplay) {
  const selectToolActive = artworkDisplay.backgroundMode === "select";
  if (modeEl) modeEl.value = artworkDisplay.backgroundMode;
  if (colorEl) colorEl.value = artworkDisplay.backgroundColor;
  if (toolBtn) {
    toolBtn.disabled = !selectToolActive;
    toolBtn.style.setProperty("--swatch-color", artworkDisplay.backgroundColor);
  }
}

/**
 * @param {HTMLInputElement | null} zoomInput
 * @param {HTMLElement | null} valueEl
 * @param {import('./artworkDisplay.js').ArtworkDisplaySettings} artworkDisplay
 */
function syncArtworkZoomControl(zoomInput, valueEl, artworkDisplay) {
  const zoomPercent = artworkZoomToPercent(artworkDisplay.zoom);
  if (zoomInput) zoomInput.value = String(zoomPercent);
  if (valueEl) valueEl.textContent = `${zoomPercent}%`;
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

function notifyChange() {
  saveSettings(getSettings());
  callbacks.onChange?.();
}

function syncModalControls() {
  if (!editingPlatformId) return;

  const settings = getSettings();
  const platformDefaults = settings.platformDefaults[editingPlatformId];
  const platform = platformById[editingPlatformId];
  if (!platformDefaults || !platform) return;

  if (titleEl) {
    titleEl.textContent = `${platform.name} defaults`;
  }
  if (colorInputEl) {
    colorInputEl.value = platformDefaults.color;
  }

  mountPriorityList(priorityListEl, platformDefaults.imageTypePriority, (next) => {
    setPlatformImageTypePriority(editingPlatformId, next);
    notifyChange();
    syncModalControls();
  });

  if (rotationFieldsEl) {
    rotationFieldsEl.innerHTML = "";
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
        if (!imageType || !editingPlatformId) return;
        setPlatformImageRotation(editingPlatformId, imageType, Number(target.value));
        notifyChange();
      });

      field.appendChild(label);
      field.appendChild(select);
      rotationFieldsEl.appendChild(field);
    }
  }

  const artworkDisplay = getPlatformArtworkDisplay(settings.platformDefaults, editingPlatformId);
  syncArtworkAlignmentGrid(alignmentGridEl, artworkDisplay);
  syncArtworkBackgroundControls(backgroundModeEl, backgroundColorEl, colorToolBtn, artworkDisplay);
  syncArtworkZoomControl(zoomEl, zoomValueEl, artworkDisplay);
}

function bindEvents() {
  dialogEl?.addEventListener("close", () => {
    editingPlatformId = null;
  });

  dialogEl?.addEventListener("click", (e) => {
    if (e.target === dialogEl) {
      dialogEl.close();
    }
  });

  document.getElementById("platform-settings-close")?.addEventListener("click", () => {
    dialogEl?.close();
  });

  colorInputEl?.addEventListener("input", (e) => {
    if (!editingPlatformId) return;
    setPlatformColor(editingPlatformId, /** @type {HTMLInputElement} */ (e.target).value);
    notifyChange();
  });

  backgroundModeEl?.addEventListener("change", (e) => {
    if (!editingPlatformId) return;
    setPlatformArtworkDisplay(editingPlatformId, {
      backgroundMode: /** @type {HTMLSelectElement} */ (e.target).value,
    });
    notifyChange();
    syncModalControls();
  });

  zoomEl?.addEventListener("input", (e) => {
    if (!editingPlatformId) return;
    const zoom = artworkPercentToZoom(/** @type {HTMLInputElement} */ (e.target).value);
    setPlatformArtworkDisplay(editingPlatformId, { zoom });
    notifyChange();
    syncModalControls();
  });

  resetBtn?.addEventListener("click", () => {
    if (!editingPlatformId) return;
    const seed = getSeedPlatformDefaults(editingPlatformId);
    const settings = getSettings();
    updateSettings({
      platformDefaults: {
        ...settings.platformDefaults,
        [editingPlatformId]: seed,
      },
    });
    notifyChange();
    syncModalControls();
  });
}

/**
 * @param {{ onChange?: () => void }} [options]
 */
export function initPlatformSettingsModal(options = {}) {
  callbacks = options;

  dialogEl = /** @type {HTMLDialogElement | null} */ (
    document.getElementById("platform-settings-modal")
  );
  titleEl = document.getElementById("platform-settings-title");
  colorInputEl = /** @type {HTMLInputElement | null} */ (
    document.getElementById("platform-settings-color")
  );
  priorityListEl = /** @type {HTMLOListElement | null} */ (
    document.getElementById("platform-settings-priority-list")
  );
  rotationFieldsEl = document.getElementById("platform-settings-rotation-fields");
  alignmentGridEl = document.getElementById("platform-settings-alignment-grid");
  backgroundModeEl = /** @type {HTMLSelectElement | null} */ (
    document.getElementById("platform-settings-background-mode")
  );
  backgroundColorEl = /** @type {HTMLInputElement | null} */ (
    document.getElementById("platform-settings-background-color")
  );
  colorToolBtn = /** @type {HTMLButtonElement | null} */ (
    document.getElementById("platform-settings-color-tool")
  );
  zoomEl = /** @type {HTMLInputElement | null} */ (
    document.getElementById("platform-settings-zoom")
  );
  zoomValueEl = document.getElementById("platform-settings-zoom-value");
  resetBtn = /** @type {HTMLButtonElement | null} */ (
    document.getElementById("platform-settings-reset")
  );

  if (alignmentGridEl) {
    mountArtworkAlignmentGrid(alignmentGridEl, (alignment) => {
      if (!editingPlatformId) return;
      setPlatformArtworkDisplay(editingPlatformId, { alignment });
      notifyChange();
      syncModalControls();
    });
  }

  if (backgroundModeEl) {
    mountArtworkBackgroundModeSelect(backgroundModeEl);
  }

  if (colorToolBtn && backgroundColorEl) {
    bindColorToolButton(colorToolBtn, backgroundColorEl, (color) => {
      if (!editingPlatformId) return;
      setPlatformArtworkDisplay(editingPlatformId, {
        backgroundColor: color,
        backgroundMode: "select",
      });
      notifyChange();
      syncModalControls();
    });
  }

  bindEvents();
}

/**
 * @param {string} platformId
 */
export function openPlatformSettingsModal(platformId) {
  if (!dialogEl || !platformById[platformId]) return;
  editingPlatformId = platformId;
  syncModalControls();
  dialogEl.showModal();
}
