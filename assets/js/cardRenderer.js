import { CARD_RENDER_WIDTH_PX, CARD_RENDER_HEIGHT_PX, PLACEHOLDER_SVG } from "./config.js";
import { computeCardLayout } from "./cardLayout.js";
import { platformById } from "./data/platforms.js";
import { loadImage, resolveCardImage } from "./imageProvider.js";
import { getPlatformIconPath } from "./platformIcons.js";
import {
  DEFAULT_PLATFORM_COLOR,
  getImageRotation,
  getPlatformColor,
} from "./platformDefaults.js";

/**
 * Scale image to fit within the box (no cropping), top-aligned.
 * Unused space appears at the bottom; horizontal gaps are centered.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} img
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} [rotationDeg]
 */
function drawContainImageTopAligned(ctx, img, x, y, w, h, rotationDeg = 0) {
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
  const drawX = -drawW / 2;
  const drawY = -boxH / 2;

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
 * @param {import('./state.js').Card} card
 * @param {Record<string, import('./platformDefaults.js').PlatformDefaults>} platformDefaults
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderCard(card, platformDefaults) {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_RENDER_WIDTH_PX;
  canvas.height = CARD_RENDER_HEIGHT_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const platform = platformById[card.platformId];
  const color = getPlatformColor(platformDefaults, card.platformId) ?? platform?.defaultColor ?? DEFAULT_PLATFORM_COLOR;
  const rotation = getImageRotation(platformDefaults, card.platformId, card.imageType);
  const { art, logo, color: colorRect } = computeCardLayout(canvas.width, canvas.height);

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const { url: imageSrc } = await resolveCardImage(card);
  try {
    const img = await loadImage(imageSrc);
    drawContainImageTopAligned(ctx, img, art.x, art.y, art.w, art.h, rotation);
  } catch {
    const img = await loadImage(PLACEHOLDER_SVG);
    drawContainImageTopAligned(ctx, img, art.x, art.y, art.w, art.h, rotation);
  }

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
