import { IMAGE_TYPES, PLACEHOLDER_SVG } from "./config.js";
import { buildGameImageUrl } from "./imageProvider.js";
import { extractLibretroMetadata } from "./libretroTitle.js";
import { getBundledPlatformIconPath, getPlatformIconPath } from "./platformIcons.js";
import {
  normalizePlatformIconTheme,
  shouldInvertPlatformIconInLight,
} from "./platformIconTheme.js";
import { CUSTOMIZATION_CUSTOMIZED } from "./cardCustomization.js";
import { toggleCardSelection } from "./state.js";

export const COLLECTION_BROWSER_BREAKPOINT_PX = 1100;

/** @type {HTMLDialogElement|null} */
let dialogEl = null;
/** @type {HTMLElement|null} */
let carouselEl = null;
/** @type {HTMLElement|null} */
let titleEl = null;
/** @type {HTMLElement|null} */
let positionEl = null;
/** @type {HTMLElement|null} */
let iconSlotEl = null;
/** @type {HTMLButtonElement|null} */
let prevBtn = null;
/** @type {HTMLButtonElement|null} */
let nextBtn = null;

/** @type {string|null} */
let openPlatformId = null;
/** @type {string|null} */
let focusCardId = null;
/** @type {HTMLElement|null} */
let triggerElement = null;
/** @type {import("./state.js").Card[]} */
let currentCards = [];

/** @type {(card: import("./state.js").Card) => void | Promise<void>} */
let onCopyCard = async () => {};

let scrollRaf = 0;

/**
 * @param {number} selectedCount
 * @param {number} totalCount
 */
export function formatPlatformSelectionBadge(selectedCount, totalCount) {
  if (selectedCount > 0) {
    return `${selectedCount} of ${totalCount} selected`;
  }
  return String(totalCount);
}

export function isCollectionBrowserOpen() {
  return Boolean(dialogEl?.open);
}

export function getOpenPlatformId() {
  return openPlatformId;
}

/**
 * @param {{ onCopyCard: (card: import("./state.js").Card) => void | Promise<void> }} options
 */
export function initCollectionBrowser({ onCopyCard: copyHandler }) {
  onCopyCard = copyHandler;

  dialogEl = /** @type {HTMLDialogElement|null} */ (document.getElementById("collection-browser"));
  carouselEl = document.getElementById("collection-browser-carousel");
  titleEl = document.getElementById("collection-browser-title");
  positionEl = document.getElementById("collection-browser-position");
  iconSlotEl = document.getElementById("collection-browser-icon");
  prevBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById("collection-browser-prev"));
  nextBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById("collection-browser-next"));

  document.getElementById("collection-browser-close")?.addEventListener("click", () => {
    closeCollectionBrowser();
  });

  dialogEl?.addEventListener("click", (event) => {
    if (event.target === dialogEl) {
      closeCollectionBrowser();
    }
  });

  dialogEl?.addEventListener("close", () => {
    openPlatformId = null;
    currentCards = [];
    focusCardId = null;
    triggerElement = null;
    if (carouselEl) carouselEl.innerHTML = "";
  });

  carouselEl?.addEventListener("scroll", () => {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      updateCarouselPosition();
    });
  });

  prevBtn?.addEventListener("click", () => {
    stepCarousel(-1);
  });

  nextBtn?.addEventListener("click", () => {
    stepCarousel(1);
  });

  carouselEl?.addEventListener("keydown", (event) => {
    if (!carouselEl) return;
    const vertical = isVerticalLayout();
    if (vertical && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      stepCarousel(event.key === "ArrowUp" ? -1 : 1);
      return;
    }
    if (!vertical && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      stepCarousel(event.key === "ArrowLeft" ? -1 : 1);
      return;
    }
    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      const card = cardAtSnapIndex(getSnapIndex());
      if (card) toggleCardSelection(card.id);
    }
  });
}

export function closeCollectionBrowser() {
  if (!dialogEl?.open) return;
  const trigger = triggerElement;
  dialogEl.close();
  trigger?.focus();
}

/**
 * @param {import("./data/platforms.js").Platform} platform
 * @param {import("./state.js").Card[]} cards
 * @param {{ selectedIds: Set<string>, settings: import("./state.js").Settings, triggerEl?: HTMLElement|null, focusCardId?: string|null }} options
 */
export function openCollectionBrowser(platform, cards, options) {
  if (!dialogEl || !carouselEl) return;
  if (cards.length === 0) return;

  openPlatformId = platform.id;
  currentCards = cards;
  focusCardId = options.focusCardId ?? cards[0]?.id ?? null;
  triggerElement = options.triggerEl ?? triggerElement;

  if (titleEl) titleEl.textContent = platform.name;
  if (iconSlotEl) {
    iconSlotEl.innerHTML = "";
    iconSlotEl.appendChild(
      createPlatformIconElement(platform, options.settings.platformIconTheme, {
        iconClassName: "collection-browser__icon",
        emojiClassName: "collection-browser__emoji",
      }),
    );
  }
  dialogEl.style.setProperty("--platform-color", platform.defaultColor);

  renderCarouselSlides(cards, options.selectedIds);

  if (!dialogEl.open) {
    dialogEl.showModal();
  }

  requestAnimationFrame(() => {
    scrollToCardId(focusCardId, "instant");
    updateCarouselPosition();
    carouselEl?.focus();
  });
}

/**
 * @param {import("./data/platforms.js").Platform} platform
 * @param {import("./state.js").Card[]} cards
 * @param {{ selectedIds: Set<string>, settings: import("./state.js").Settings }} options
 */
export function syncCollectionBrowser(platform, cards, options) {
  if (!isCollectionBrowserOpen() || openPlatformId !== platform.id) return;

  if (cards.length === 0) {
    closeCollectionBrowser();
    return;
  }

  const previousFocus = focusCardId;
  currentCards = cards;
  if (previousFocus && !cards.some((card) => card.id === previousFocus)) {
    focusCardId = cards[0]?.id ?? null;
  }

  renderCarouselSlides(cards, options.selectedIds);
  requestAnimationFrame(() => {
    scrollToCardId(focusCardId ?? cards[0]?.id ?? null, "instant");
    updateCarouselPosition();
  });
}

/**
 * @param {import("./state.js").Card[]} cards
 * @param {Set<string>} selectedIds
 */
function renderCarouselSlides(cards, selectedIds) {
  if (!carouselEl) return;
  carouselEl.innerHTML = "";

  for (const card of cards) {
    const slide = document.createElement("article");
    slide.className = "collection-browser__slide";
    slide.dataset.cardId = card.id;

    const row = document.createElement("div");
    row.className = "collection-card";
    if (selectedIds.has(card.id)) row.classList.add("collection-card--selected");

    const selectBtn = document.createElement("button");
    selectBtn.type = "button";
    selectBtn.className = "collection-card__select-btn";
    selectBtn.setAttribute("aria-pressed", selectedIds.has(card.id) ? "true" : "false");
    selectBtn.setAttribute("aria-label", `Select ${card.gameName}`);

    const thumb = document.createElement("img");
    thumb.className = "collection-card__thumb collection-browser__thumb";
    thumb.alt = "";
    thumb.loading = "lazy";
    const artworkUrl = buildGameImageUrl(card.platformId, card.libretroName, card.imageType);
    thumb.src = card.imageFailed ? PLACEHOLDER_SVG : artworkUrl ?? PLACEHOLDER_SVG;
    thumb.addEventListener("error", () => {
      thumb.src = PLACEHOLDER_SVG;
    });

    const content = document.createElement("span");
    content.className = "collection-card__content collection-browser__card-content";

    const info = document.createElement("span");
    info.className = "collection-card__info";

    const nameEl = document.createElement("span");
    nameEl.className = "collection-card__name";
    nameEl.textContent = card.gameName;
    info.appendChild(nameEl);

    const customizationDot = document.createElement("span");
    const isCustomized = card.customization === CUSTOMIZATION_CUSTOMIZED;
    customizationDot.className = `collection-card__customization-dot${
      isCustomized ? " collection-card__customization-dot--customized" : ""
    }`;
    customizationDot.title = isCustomized
      ? "Customized — won't change when defaults update"
      : "Uses platform defaults";
    customizationDot.setAttribute("aria-label", customizationDot.title);
    info.appendChild(customizationDot);

    const artTypeEl = document.createElement("span");
    artTypeEl.className = "collection-card__meta";
    artTypeEl.textContent = IMAGE_TYPES[card.imageType]?.label ?? card.imageType;
    info.appendChild(artTypeEl);

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

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "collection-card__copy-btn";
    copyBtn.title = `Copy ${card.gameName} settings to editor`;
    copyBtn.setAttribute("aria-label", `Copy ${card.gameName} settings to editor`);
    copyBtn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2"/></svg>';
    copyBtn.addEventListener("click", () => {
      void onCopyCard(card);
    });

    row.append(selectBtn, copyBtn);
    slide.appendChild(row);
    carouselEl.appendChild(slide);
  }
}

function isVerticalLayout() {
  return globalThis.matchMedia(`(min-width: ${COLLECTION_BROWSER_BREAKPOINT_PX + 1}px)`).matches;
}

function getSlides() {
  return carouselEl ? [...carouselEl.querySelectorAll(".collection-browser__slide")] : [];
}

function getSnapIndex() {
  const slides = getSlides();
  if (!carouselEl || slides.length === 0) return 0;

  const vertical = isVerticalLayout();
  const center = vertical
    ? carouselEl.scrollTop + carouselEl.clientHeight / 2
    : carouselEl.scrollLeft + carouselEl.clientWidth / 2;

  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  slides.forEach((slide, index) => {
    const slideStart = vertical ? slide.offsetTop : slide.offsetLeft;
    const slideCenter = slideStart + (vertical ? slide.offsetHeight : slide.offsetWidth) / 2;
    const distance = Math.abs(slideCenter - center);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
}

/**
 * @param {number} delta
 */
function stepCarousel(delta) {
  const slides = getSlides();
  if (!carouselEl || slides.length === 0) return;

  const nextIndex = Math.min(slides.length - 1, Math.max(0, getSnapIndex() + delta));
  const slide = slides[nextIndex];
  if (!slide) return;

  slide.scrollIntoView({
    behavior: prefersReducedMotion() ? "instant" : "smooth",
    block: isVerticalLayout() ? "center" : "nearest",
    inline: isVerticalLayout() ? "nearest" : "center",
  });

  const cardId = slide.dataset.cardId;
  if (cardId) focusCardId = cardId;
  requestAnimationFrame(updateCarouselPosition);
}

/**
 * @param {string|null|undefined} cardId
 * @param {ScrollBehavior} [behavior]
 */
function scrollToCardId(cardId, behavior = "smooth") {
  if (!carouselEl || !cardId) return;
  const slide = carouselEl.querySelector(`.collection-browser__slide[data-card-id="${cardId}"]`);
  if (!slide) return;
  slide.scrollIntoView({
    behavior: prefersReducedMotion() ? "instant" : behavior,
    block: isVerticalLayout() ? "center" : "nearest",
    inline: isVerticalLayout() ? "nearest" : "center",
  });
}

function updateCarouselPosition() {
  const slides = getSlides();
  if (!positionEl || slides.length === 0) return;

  const index = getSnapIndex();
  const slide = slides[index];
  if (slide?.dataset.cardId) focusCardId = slide.dataset.cardId;

  positionEl.textContent = `${index + 1} of ${slides.length}`;

  if (prevBtn) prevBtn.disabled = index <= 0;
  if (nextBtn) nextBtn.disabled = index >= slides.length - 1;
}

/**
 * @param {number} index
 * @returns {import("./state.js").Card|undefined}
 */
function cardAtSnapIndex(index) {
  const slide = getSlides()[index];
  if (!slide?.dataset.cardId) return undefined;
  return currentCards.find((card) => card.id === slide.dataset.cardId);
}

function prefersReducedMotion() {
  return globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * @param {import("./data/platforms.js").Platform} platform
 * @param {string} iconTheme
 * @param {{ iconClassName?: string, emojiClassName?: string }} [options]
 */
function createPlatformIconElement(platform, iconTheme, options = {}) {
  const { iconClassName = "collection-browser__icon", emojiClassName = "collection-browser__emoji" } =
    options;
  const normalizedTheme = normalizePlatformIconTheme(iconTheme);
  const icon = document.createElement("img");
  icon.className = iconClassName;
  icon.alt = "";
  icon.src = getPlatformIconPath(platform.id, normalizedTheme);
  if (shouldInvertPlatformIconInLight(normalizedTheme)) {
    icon.dataset.invertInLight = "true";
  }
  icon.addEventListener(
    "error",
    () => {
      icon.src = getBundledPlatformIconPath(platform.id);
      icon.addEventListener(
        "error",
        () => {
          const emoji = document.createElement("span");
          emoji.className = emojiClassName;
          emoji.textContent = platform.emoji;
          emoji.setAttribute("aria-hidden", "true");
          icon.replaceWith(emoji);
        },
        { once: true },
      );
    },
    { once: true },
  );
  return icon;
}
