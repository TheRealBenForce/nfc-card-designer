/** Card and print dimensions (millimeters). */
export const CARD_WIDTH_MM = 52;
export const CARD_HEIGHT_MM = 84;

/** Layout ratios for the three-box template. */
export const ART_WIDTH_RATIO = 0.75;
export const PLATFORM_COLUMN_RATIO = 0.25;
export const LOGO_HEIGHT_RATIO = 0.75;
export const COLOR_HEIGHT_RATIO = 0.25;

export const LETTER_WIDTH_MM = 215.9;
export const LETTER_HEIGHT_MM = 279.4;

export const CARDS_PER_ROW = 3;
export const CARDS_PER_COL = 3;

/** Render resolution for canvas (approx. 300 dpi). */
export const CARD_RENDER_WIDTH_PX = Math.round((CARD_WIDTH_MM / 25.4) * 300);
export const CARD_RENDER_HEIGHT_PX = Math.round((CARD_HEIGHT_MM / 25.4) * 300);

export const IMAGE_TYPES = {
  boxArt: { label: "Box Art", default: true },
  titleScreen: { label: "Title Screen", default: false },
  gamePicture: { label: "Game Picture", default: false },
};

export const DEFAULT_IMAGE_TYPE = "boxArt";

export const STORAGE_KEY = "nfc-card-designer-settings";
export const DECK_STORAGE_KEY = "nfc-card-designer-deck";

export const PLACEHOLDER_SVG = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#2a2a3e"/>
  <rect x="40" y="40" width="320" height="320" rx="12" fill="#3d3d5c" stroke="#5a5a8a" stroke-width="4"/>
  <text x="200" y="185" text-anchor="middle" fill="#8888aa" font-family="system-ui,sans-serif" font-size="22">No Image</text>
  <text x="200" y="220" text-anchor="middle" fill="#666688" font-family="system-ui,sans-serif" font-size="16">Giant Bomb unavailable</text>
</svg>
`)}`;
