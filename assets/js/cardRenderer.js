import { CARD_RENDER_WIDTH_PX, CARD_RENDER_HEIGHT_PX, PLACEHOLDER_SVG } from "./config.js";
import { computeCardLayout } from "./cardLayout.js";
import { platformById } from "./data/platforms.js";
import { loadImage, resolveCardImage, candidateImagePaths } from "./imageProvider.js";
import { gameByPlatformAndRaId } from "./data/games.js";
import { getPlatformIconPath } from "./platformIcons.js";
import {
  DEFAULT_PLATFORM_COLOR,
  getImageRotation,
  getPlatformColor,
} from "./platformDefaults.js";
import {
  BLURRED_BACKGROUND_IMAGE_TYPES,
  DEFAULT_ARTWORK_BACKGROUND_COLOR,
  defaultArtworkDisplay,
  getAlignmentFractions,
  normalizeArtworkDisplay,
} from "./artworkDisplay.js";

const ALPHA_THRESHOLD = 16;
const BLUR_RADIUS_PX = 24;
const BLURRED_INSET_RATIO = 0.1;

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} img
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} [rotationDeg]
 * @param {{ x: number, y: number }} [align]
 */
function drawContainImageAligned(ctx, img, x, y, w, h, rotationDeg = 0, align = { x: 0.5, y: 0 }) {
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

  const scale = Math.min(boxW / img.width, boxH / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const drawX = -boxW / 2 + (boxW - drawW) * align.x;
  const drawY = -boxH / 2 + (boxH - drawH) * align.y;

  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.restore();
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
 * @param {number} w
 * @param {number} h
 * @param {HTMLImageElement} img
 * @param {number} rotationDeg
 * @param {{ x: number, y: number }} align
 * @returns {HTMLCanvasElement}
 */
function renderArtworkLayer(w, h, img, rotationDeg, align) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  drawContainImageAligned(ctx, img, 0, 0, w, h, rotationDeg, align);
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
 */
function drawNearestEdgeBackground(ctx, rect, img, rotationDeg, align) {
  const layer = renderArtworkLayer(rect.w, rect.h, img, rotationDeg, align);
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
function drawBlurredImageBackground(ctx, rect, img) {
  const inset = Math.round(Math.min(rect.w, rect.h) * BLURRED_INSET_RATIO);
  const innerW = Math.max(1, rect.w - inset * 2);
  const innerH = Math.max(1, rect.h - inset * 2);

  const scratch = document.createElement("canvas");
  scratch.width = rect.w;
  scratch.height = rect.h;
  const scratchCtx = scratch.getContext("2d");
  if (!scratchCtx) return;

  const scale = Math.min(innerW / img.width, innerH / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const drawX = (rect.w - drawW) / 2;
  const drawY = (rect.h - drawH) / 2;

  scratchCtx.drawImage(img, drawX, drawY, drawW, drawH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.filter = `blur(${BLUR_RADIUS_PX}px)`;
  ctx.drawImage(scratch, rect.x, rect.y, rect.w, rect.h);
  ctx.filter = "none";
  ctx.restore();
}

/**
 * @param {import('./state.js').Card} card
 * @param {string} imageType
 * @returns {Promise<HTMLImageElement|null>}
 */
async function loadCardImageType(card, imageType) {
  const game = gameByPlatformAndRaId(card.platformId, card.raGameId);
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
) {
  const { backgroundMode } = artworkDisplay;

  if (backgroundMode === "consoleColor") {
    ctx.fillStyle = platformColor;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    return;
  }

  if (backgroundMode === "nearestEdge") {
    drawNearestEdgeBackground(ctx, rect, foregroundImg, rotationDeg, align);
    return;
  }

  if (backgroundMode in BLURRED_BACKGROUND_IMAGE_TYPES) {
    const imageType = BLURRED_BACKGROUND_IMAGE_TYPES[backgroundMode];
    const bgImg = await loadCardImageType(card, imageType);
    if (bgImg) {
      drawBlurredImageBackground(ctx, rect, bgImg);
      return;
    }
  }

  ctx.fillStyle = artworkDisplay.backgroundColor || DEFAULT_ARTWORK_BACKGROUND_COLOR;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

/**
 * @param {import('./state.js').Card} card
 * @param {Record<string, import('./platformDefaults.js').PlatformDefaults>} platformDefaults
 * @param {import('./artworkDisplay.js').ArtworkDisplaySettings} [artworkDisplay]
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderCard(card, platformDefaults, artworkDisplay = defaultArtworkDisplay()) {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_RENDER_WIDTH_PX;
  canvas.height = CARD_RENDER_HEIGHT_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const normalizedDisplay = normalizeArtworkDisplay(artworkDisplay);
  const align = getAlignmentFractions(normalizedDisplay);

  const platform = platformById[card.platformId];
  const color = getPlatformColor(platformDefaults, card.platformId) ?? platform?.defaultColor ?? DEFAULT_PLATFORM_COLOR;
  const rotation = getImageRotation(platformDefaults, card.platformId, card.imageType);
  const { art, logo, color: colorRect } = computeCardLayout(canvas.width, canvas.height);

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const { url: imageSrc } = await resolveCardImage(card);
  let img;
  try {
    img = await loadImage(imageSrc);
  } catch {
    img = await loadImage(PLACEHOLDER_SVG);
  }

  await drawArtBackground(ctx, art, card, normalizedDisplay, color, img, rotation, align);
  drawContainImageAligned(ctx, img, art.x, art.y, art.w, art.h, rotation, align);

  const icon = await loadImage(getPlatformIconPath(card.platformId));
  drawPlatformLogo(ctx, icon, logo);

  ctx.fillStyle = color;
  ctx.fillRect(colorRect.x, colorRect.y, colorRect.w, colorRect.h);

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
