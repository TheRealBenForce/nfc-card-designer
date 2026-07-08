/** Card and print dimensions (millimeters). */
export const CARD_WIDTH_MM = 52;
export const CARD_HEIGHT_MM = 84;
export const DEFAULT_STICKER_INSET_MM = 2;
/** CSS reference pixel density used by browsers for absolute units. */
export const CSS_PX_PER_MM = 96 / 25.4;
/** Maximum on-screen preview size for a life-size 52×84 mm card. */
export const CARD_PREVIEW_WIDTH_PX = Math.round(CARD_WIDTH_MM * CSS_PX_PER_MM);
export const CARD_PREVIEW_HEIGHT_PX = Math.round(CARD_HEIGHT_MM * CSS_PX_PER_MM);

/**
 * Card layout ratios. Each segment is split long-edge to long-edge:
 * portrait segments → top | bottom, landscape segments → left | right.
 */
export const ART_RATIO = 0.85;
export const PLATFORM_RATIO = 0.15;
export const LOGO_RATIO = 0.75;
export const COLOR_RATIO = 0.25;

export const LETTER_WIDTH_MM = 215.9;
export const LETTER_HEIGHT_MM = 279.4;

export const CARDS_PER_ROW = 3;
export const CARDS_PER_COL = 3;

/** Gap between adjacent cards on the letter PDF sheet (mm). */
export const PDF_CARD_GAP_MM = 5;

/** Crop mark length and inset from card edges (mm). Marks sit outside the card. */
export const PDF_CUT_MARK_LENGTH_MM = 3;
export const PDF_CUT_MARK_OFFSET_MM = 3;

/** Render resolution for canvas (approx. 300 dpi). */
export const CARD_RENDER_WIDTH_PX = Math.round((CARD_WIDTH_MM / 25.4) * 300);
export const CARD_RENDER_HEIGHT_PX = Math.round((CARD_HEIGHT_MM / 25.4) * 300);

export const IMAGE_TYPES = {
  boxArt: { label: "Box Art", default: true },
  titleScreen: { label: "Title Screen", default: false },
  gamePicture: { label: "In-Game", default: false },
};

/** Global default artwork priority (first match wins when browsing). */
export const DEFAULT_IMAGE_TYPE_PRIORITY = ["boxArt", "titleScreen", "gamePicture"];

/** @deprecated Use imageTypePriority */
export const DEFAULT_IMAGE_TYPE = "boxArt";

export const STORAGE_KEY = "nfc-card-designer-settings";
export const COLLECTION_STORAGE_KEY = "nfc-card-designer-collection";
/** @deprecated Legacy key — migrated on read */
export const DECK_STORAGE_KEY = "nfc-card-designer-deck";
export const PREVIEW_CALIBRATION_STORAGE_KEY = "nfc-card-designer-preview-calibration-scale";
export const DEV_IMAGE_DELAY_STORAGE_KEY = "nfc-card-designer-dev-image-delay-ms";
export const DEV_IMAGE_DELAY_MAX_MS = 10000;

export const PLACEHOLDER_SVG = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="840" viewBox="0 0 520 840">
  <rect width="520" height="840" fill="#2a2a3e"/>
  <text x="260" y="400" text-anchor="middle" fill="#8888aa" font-family="system-ui,sans-serif" font-size="28">No Image</text>
  <text x="260" y="440" text-anchor="middle" fill="#666688" font-family="system-ui,sans-serif" font-size="20">Artwork not downloaded</text>
</svg>
`)}`;
