import { CARD_RENDER_WIDTH_PX, CARD_RENDER_HEIGHT_PX, PLACEHOLDER_SVG } from "./config.js";
import { computeCardLayout } from "./cardLayout.js";
import { platformById } from "./data/platforms.js";
import { loadImage, resolveCardImage } from "./imageProvider.js";

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} img
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 */
function drawCoverImage(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;

  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (imgRatio > boxRatio) {
    sw = img.height * boxRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / boxRatio;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} emoji
 * @param {import('./cardLayout.js').Rect} rect
 */
function drawEmojiLogo(ctx, emoji, rect) {
  const { x, y, w, h } = rect;
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(x, y, w, h);
  const fontSize = Math.min(w, h) * 0.55;
  ctx.font = `${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, x + w / 2, y + h / 2);
}

/**
 * @param {import('./state.js').Card} card
 * @param {Record<string, string>} platformColors
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderCard(card, platformColors) {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_RENDER_WIDTH_PX;
  canvas.height = CARD_RENDER_HEIGHT_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const platform = platformById[card.platformId];
  const color = platformColors[card.platformId] ?? platform?.defaultColor ?? "#333";
  const { art, logo, color: colorRect } = computeCardLayout(canvas.width, canvas.height);

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const { url: imageSrc } = await resolveCardImage(card);
  try {
    const img = await loadImage(imageSrc);
    drawCoverImage(ctx, img, art.x, art.y, art.w, art.h);
  } catch {
    const img = await loadImage(PLACEHOLDER_SVG);
    drawCoverImage(ctx, img, art.x, art.y, art.w, art.h);
  }

  drawEmojiLogo(ctx, platform?.emoji ?? "🎮", logo);

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
