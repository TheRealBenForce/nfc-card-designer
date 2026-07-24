import { PLACEHOLDER_SVG } from "./config.js";
import { computeCardLayout } from "./cardLayout.js";
import { platformById } from "./data/platforms.js";
import { loadImage, resolveCardImage, candidateImagePaths } from "./imageProvider.js";
import { gameForCard } from "./gameCatalog.js";
import { getBundledPlatformIconPath } from "./platformIcons.js";
import {
  DEFAULT_PLATFORM_COLOR,
  getImageRotation,
  getPlatformColor,
  normalizeRotationDegrees,
} from "./platformDefaults.js";
import { resolveCardHeaderSettings } from "./cardCustomization.js";
import {
  BLURRED_BACKGROUND_IMAGE_TYPES,
  DEFAULT_ARTWORK_BACKGROUND_COLOR,
  getAlignmentFractions,
  resolveArtworkDisplay,
} from "./artworkDisplay.js";
import { resolveCardSizing, mmToRenderPx } from "./cardSizing.js";

const ALPHA_THRESHOLD = 16;
const BLUR_RADIUS_PX = 36;
const BLUR_FALLBACK_RADIUS_PX = 72;
const BLUR_FALLBACK_SCALE_STEP = 0.5;
const BLUR_FALLBACK_PASS_COUNT = 5;
const BLUR_FALLBACK_MIN_SIDE_PX = 32;

/** @type {boolean | undefined} */
let cachedCanvasBlurFilterSupport;

/** @type {Promise<{ canvasRGBA: typeof import("stackblur-canvas").canvasRGBA }> | null} */
let stackBlurModulePromise = null;

/**
 * @returns {Promise<{ canvasRGBA: typeof import("stackblur-canvas").canvasRGBA }>}
 */
function loadStackBlurModule() {
  if (!stackBlurModulePromise) {
    stackBlurModulePromise = import("https://esm.sh/stackblur-canvas@3.0.1");
  }
  return stackBlurModulePromise;
}

/**
 * iPad Safari can expose `ctx.filter` but still skip blur on `drawImage`.
 * Detect real blur output once, then cache the result.
 *
 * @returns {boolean}
 */
function supportsCanvasBlurFilter() {
  if (typeof cachedCanvasBlurFilterSupport === "boolean") {
    return cachedCanvasBlurFilterSupport;
  }

  const source = document.createElement("canvas");
  source.width = 24;
  source.height = 24;
  const sourceCtx = source.getContext("2d");
  const target = document.createElement("canvas");
  target.width = 24;
  target.height = 24;
  const targetCtx = target.getContext("2d");
  if (!sourceCtx || !targetCtx) {
    cachedCanvasBlurFilterSupport = false;
    return cachedCanvasBlurFilterSupport;
  }

  sourceCtx.fillStyle = "#fff";
  sourceCtx.fillRect(0, 0, 12, 24);
  sourceCtx.fillStyle = "#000";
  sourceCtx.fillRect(12, 0, 12, 24);

  targetCtx.filter = "blur(4px)";
  targetCtx.drawImage(source, 0, 0);

  const leftSample = targetCtx.getImageData(10, 12, 1, 1).data[0];
  const rightSample = targetCtx.getImageData(13, 12, 1, 1).data[0];
  cachedCanvasBlurFilterSupport = Math.abs(leftSample - rightSample) < 200;
  return cachedCanvasBlurFilterSupport;
}

/**
 * Last-resort blur when StackBlur cannot be loaded (offline/CDN failure).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./cardLayout.js').Rect} rect
 * @param {HTMLCanvasElement} source
 */
function drawBlurredImageBackgroundResampleFallback(ctx, rect, source) {
  /**
   * @param {HTMLCanvasElement} layer
   * @param {number} width
   * @param {number} height
   * @returns {HTMLCanvasElement | null}
   */
  const resample = (layer, width, height) => {
    const output = document.createElement("canvas");
    output.width = Math.max(1, width);
    output.height = Math.max(1, height);
    const outputCtx = output.getContext("2d");
    if (!outputCtx) return null;
    outputCtx.imageSmoothingEnabled = true;
    outputCtx.imageSmoothingQuality = "high";
    outputCtx.drawImage(layer, 0, 0, output.width, output.height);
    return output;
  };

  /** @type {{ width: number, height: number }[]} */
  const levels = [{ width: source.width, height: source.height }];
  let blurredLayer = source;
  for (let pass = 0; pass < BLUR_FALLBACK_PASS_COUNT; pass += 1) {
    const nextWidth = Math.max(1, Math.round(blurredLayer.width * BLUR_FALLBACK_SCALE_STEP));
    const nextHeight = Math.max(1, Math.round(blurredLayer.height * BLUR_FALLBACK_SCALE_STEP));
    if (Math.min(nextWidth, nextHeight) < BLUR_FALLBACK_MIN_SIDE_PX) {
      break;
    }
    const next = resample(blurredLayer, nextWidth, nextHeight);
    if (!next) break;
    blurredLayer = next;
    levels.push({ width: nextWidth, height: nextHeight });
  }

  for (let i = levels.length - 2; i >= 0; i -= 1) {
    const restored = resample(blurredLayer, levels[i].width, levels[i].height);
    if (!restored) break;
    blurredLayer = restored;
  }

  const prevSmoothingEnabled = ctx.imageSmoothingEnabled;
  const prevSmoothingQuality = ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(blurredLayer, rect.x, rect.y, rect.w, rect.h);
  ctx.imageSmoothingEnabled = prevSmoothingEnabled;
  ctx.imageSmoothingQuality = prevSmoothingQuality;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./cardLayout.js').Rect} rect
 * @param {HTMLCanvasElement} source
 */
async function drawBlurredImageBackgroundFallback(ctx, rect, source) {
  try {
    const { canvasRGBA } = await loadStackBlurModule();
    const blurred = document.createElement("canvas");
    blurred.width = source.width;
    blurred.height = source.height;
    const blurredCtx = blurred.getContext("2d");
    if (!blurredCtx) {
      drawBlurredImageBackgroundResampleFallback(ctx, rect, source);
      return;
    }

    blurredCtx.drawImage(source, 0, 0);
    canvasRGBA(blurred, 0, 0, blurred.width, blurred.height, BLUR_FALLBACK_RADIUS_PX);
    ctx.drawImage(blurred, rect.x, rect.y, rect.w, rect.h);
  } catch {
    drawBlurredImageBackgroundResampleFallback(ctx, rect, source);
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} img
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} [rotationDeg]
 * @param {{ x: number, y: number }} [align]
 * @param {number} [zoom]
 */
function drawContainImageAligned(ctx, img, x, y, w, h, rotationDeg = 0, align = { x: 0.5, y: 0 }, zoom = 0) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.translate(cx, cy);
  ctx.rotate((rotationDeg * Math.PI) / 180);

  const isSideways = rotationDeg % 180 !== 0;
  const boxW = isSideways ? h : w;
  const boxH = isSideways ? w : h;
  const alignedForRotation = mapDisplayAlignmentToRotatedAlignment(align, rotationDeg);

  const scale = Math.min(boxW / img.width, boxH / img.height) * (1 + zoom / 100);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const drawX = -boxW / 2 + (boxW - drawW) * alignedForRotation.x;
  const drawY = -boxH / 2 + (boxH - drawH) * alignedForRotation.y;

  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.restore();
}

/**
 * Convert a display-space alignment (what the user clicked) into the
 * pre-rotation local alignment used by the drawing transform.
 *
 * @param {{ x: number, y: number }} align
 * @param {number} rotationDeg
 * @returns {{ x: number, y: number }}
 */
export function mapDisplayAlignmentToRotatedAlignment(align, rotationDeg) {
  const normalized = ((Math.round(rotationDeg) % 360) + 360) % 360;
  if (normalized === 90) {
    return { x: align.y, y: 1 - align.x };
  }
  if (normalized === 180) {
    return { x: 1 - align.x, y: 1 - align.y };
  }
  if (normalized === 270) {
    return { x: 1 - align.y, y: align.x };
  }
  return align;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} img
 * @param {import('./cardLayout.js').Rect} rect
 * @param {number} [padding]
 */
function drawContainImageCentered(ctx, img, rect, padding = 0) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  const innerW = Math.max(0, w - padding * 2);
  const innerH = Math.max(0, h - padding * 2);
  const scale = Math.min(innerW / img.width, innerH / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const drawX = x + (w - drawW) / 2;
  const drawY = y + (h - drawH) / 2;
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} icon
 * @param {import('./cardLayout.js').Rect} rect
 */
function drawPlatformLogo(ctx, icon, rect) {
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const padding = Math.round(Math.min(rect.w, rect.h) * 0.12);
  drawContainImageCentered(ctx, icon, rect, padding);
}

/**
 * @param {import('./cardLayout.js').Rect} rect
 * @param {number} offsetX
 * @param {number} offsetY
 * @returns {import('./cardLayout.js').Rect}
 */
function offsetRect(rect, offsetX, offsetY) {
  return {
    x: rect.x + offsetX,
    y: rect.y + offsetY,
    w: rect.w,
    h: rect.h,
  };
}

/**
 * @param {number} w
 * @param {number} h
 * @param {HTMLImageElement} img
 * @param {number} rotationDeg
 * @param {{ x: number, y: number }} align
 * @param {number} [zoom]
 * @returns {HTMLCanvasElement}
 */
function renderArtworkLayer(w, h, img, rotationDeg, align, zoom = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  drawContainImageAligned(ctx, img, 0, 0, w, h, rotationDeg, align, zoom);
  return canvas;
}

/**
 * @param {ImageData} imageData
 */
function extendEdgeColors(imageData) {
  const { data, width, height } = imageData;

  for (let y = 0; y < height; y++) {
    let minX = width;
    let maxX = -1;

    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > ALPHA_THRESHOLD) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }

    if (minX > width - 1 || maxX < 0) continue;

    const leftIdx = (y * width + minX) * 4;
    for (let x = 0; x < minX; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = data[leftIdx];
      data[idx + 1] = data[leftIdx + 1];
      data[idx + 2] = data[leftIdx + 2];
      data[idx + 3] = 255;
    }

    const rightIdx = (y * width + maxX) * 4;
    for (let x = maxX + 1; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = data[rightIdx];
      data[idx + 1] = data[rightIdx + 1];
      data[idx + 2] = data[rightIdx + 2];
      data[idx + 3] = 255;
    }
  }

  for (let x = 0; x < width; x++) {
    let minY = height;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > ALPHA_THRESHOLD) {
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }

    if (minY > height - 1 || maxY < 0) continue;

    const topIdx = (minY * width + x) * 4;
    for (let y = 0; y < minY; y++) {
      const idx = (y * width + x) * 4;
      data[idx] = data[topIdx];
      data[idx + 1] = data[topIdx + 1];
      data[idx + 2] = data[topIdx + 2];
      data[idx + 3] = 255;
    }

    const bottomIdx = (maxY * width + x) * 4;
    for (let y = maxY + 1; y < height; y++) {
      const idx = (y * width + x) * 4;
      data[idx] = data[bottomIdx];
      data[idx + 1] = data[bottomIdx + 1];
      data[idx + 2] = data[bottomIdx + 2];
      data[idx + 3] = 255;
    }
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./cardLayout.js').Rect} rect
 * @param {HTMLImageElement} img
 * @param {number} rotationDeg
 * @param {{ x: number, y: number }} align
 * @param {number} [zoom]
 */
function drawNearestEdgeBackground(ctx, rect, img, rotationDeg, align, zoom = 0) {
  const layer = renderArtworkLayer(rect.w, rect.h, img, rotationDeg, align, zoom);
  const layerCtx = layer.getContext("2d");
  if (!layerCtx) return;

  const imageData = layerCtx.getImageData(0, 0, rect.w, rect.h);
  extendEdgeColors(imageData);
  layerCtx.putImageData(imageData, 0, 0);

  ctx.drawImage(layer, rect.x, rect.y);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./cardLayout.js').Rect} rect
 * @param {HTMLImageElement} img
 */
async function drawBlurredImageBackground(ctx, rect, img) {
  const scratch = document.createElement("canvas");
  scratch.width = rect.w;
  scratch.height = rect.h;
  const scratchCtx = scratch.getContext("2d");
  if (!scratchCtx) return;

  const scale = Math.max(rect.w / img.width, rect.h / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const drawX = (rect.w - drawW) / 2;
  const drawY = (rect.h - drawH) / 2;

  scratchCtx.drawImage(img, drawX, drawY, drawW, drawH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (supportsCanvasBlurFilter()) {
    ctx.filter = `blur(${BLUR_RADIUS_PX}px)`;
    ctx.drawImage(scratch, rect.x, rect.y, rect.w, rect.h);
    ctx.filter = "none";
  } else {
    await drawBlurredImageBackgroundFallback(ctx, rect, scratch);
  }
  ctx.restore();
}

/**
 * @param {import('./state.js').Card} card
 * @param {string} imageType
 * @returns {Promise<HTMLImageElement|null>}
 */
async function loadCardImageType(card, imageType) {
  const game = gameForCard(card);
  for (const imagePath of candidateImagePaths(card, game, imageType)) {
    try {
      return await loadImage(imagePath);
    } catch {
      // try next path
    }
  }
  return null;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./cardLayout.js').Rect} rect
 * @param {import('./state.js').Card} card
 * @param {import('./artworkDisplay.js').ArtworkDisplaySettings} artworkDisplay
 * @param {string} platformColor
 * @param {HTMLImageElement} foregroundImg
 * @param {number} rotationDeg
 * @param {{ x: number, y: number }} align
 * @param {number} zoom
 */
async function drawArtBackground(
  ctx,
  rect,
  card,
  artworkDisplay,
  platformColor,
  foregroundImg,
  rotationDeg,
  align,
  zoom,
) {
  const { backgroundMode } = artworkDisplay;

  if (backgroundMode === "consoleColor") {
    ctx.fillStyle = platformColor;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    return;
  }

  if (backgroundMode === "nearestEdge") {
    drawNearestEdgeBackground(ctx, rect, foregroundImg, rotationDeg, align, zoom);
    return;
  }

  if (backgroundMode in BLURRED_BACKGROUND_IMAGE_TYPES) {
    const imageType = BLURRED_BACKGROUND_IMAGE_TYPES[backgroundMode];
    const bgImg = await loadCardImageType(card, imageType);
    if (bgImg) {
      await drawBlurredImageBackground(ctx, rect, bgImg);
      return;
    }
  }

  ctx.fillStyle = artworkDisplay.backgroundColor || DEFAULT_ARTWORK_BACKGROUND_COLOR;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

/**
 * @param {import('./state.js').Card} card
 * @param {Record<string, import('./platformDefaults.js').PlatformDefaults>} platformDefaults
 * @param {{
 *   showHeader?: boolean,
 *   showPlatformColor?: boolean,
 *   headerHeightPercent?: number,
 * } | null | undefined} [layoutSettings]
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderCard(card, platformDefaults, layoutSettings) {
  const cardSizing = resolveCardSizing(layoutSettings);
  const cardWidthPx = mmToRenderPx(cardSizing.cardWidthMm);
  const cardHeightPx = mmToRenderPx(cardSizing.cardHeightMm);
  const stickerInsetPx = mmToRenderPx(cardSizing.stickerInsetMm);
  const canvas = document.createElement("canvas");
  canvas.width = cardWidthPx;
  canvas.height = cardHeightPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const stickerRect = {
    x: stickerInsetPx,
    y: stickerInsetPx,
    w: Math.max(1, canvas.width - stickerInsetPx * 2),
    h: Math.max(1, canvas.height - stickerInsetPx * 2),
  };

  const normalizedDisplay = resolveArtworkDisplay(card, platformDefaults);
  const align = getAlignmentFractions(normalizedDisplay);
  const zoom = normalizedDisplay.zoom;

  const platform = platformById[card.platformId];
  const color = getPlatformColor(platformDefaults, card.platformId) ?? platform?.defaultColor ?? DEFAULT_PLATFORM_COLOR;
  const baseRotation = getImageRotation(platformDefaults, card.platformId, card.imageType);
  const rotation = normalizeRotationDegrees(baseRotation + (card.imageRotation ?? 0));
  const headerForLayout = resolveCardHeaderSettings(card, platformDefaults);
  const {
    art: stickerArtRect,
    logo: stickerLogoRect,
    color: stickerColorRect,
    showHeader,
    showPlatformColor,
  } = computeCardLayout(stickerRect.w, stickerRect.h, headerForLayout);
  const art = offsetRect(stickerArtRect, stickerRect.x, stickerRect.y);
  const logo = offsetRect(stickerLogoRect, stickerRect.x, stickerRect.y);
  const colorRect = offsetRect(stickerColorRect, stickerRect.x, stickerRect.y);

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111";
  ctx.fillRect(stickerRect.x, stickerRect.y, stickerRect.w, stickerRect.h);

  const { url: imageSrc } = await resolveCardImage(card);
  let img;
  try {
    img = await loadImage(imageSrc);
  } catch {
    img = await loadImage(PLACEHOLDER_SVG);
  }

  await drawArtBackground(ctx, art, card, normalizedDisplay, color, img, rotation, align, zoom);
  drawContainImageAligned(ctx, img, art.x, art.y, art.w, art.h, rotation, align, zoom);

  if (showHeader) {
    const icon = await loadImage(getBundledPlatformIconPath(card.platformId));
    drawPlatformLogo(ctx, icon, logo);
  }

  if (showPlatformColor) {
    ctx.fillStyle = color;
    ctx.fillRect(colorRect.x, colorRect.y, colorRect.w, colorRect.h);
  }

  return canvas;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {number} maxWidth
 */
export function canvasToDataUrl(canvas, maxWidth = 320) {
  const scale = Math.min(1, maxWidth / canvas.width);
  if (scale >= 1) return canvas.toDataURL("image/png");

  const preview = document.createElement("canvas");
  preview.width = Math.round(canvas.width * scale);
  preview.height = Math.round(canvas.height * scale);
  const ctx = preview.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");
  ctx.drawImage(canvas, 0, 0, preview.width, preview.height);
  return preview.toDataURL("image/png");
}
