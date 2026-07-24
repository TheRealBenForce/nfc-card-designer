import { renderCard } from "./cardRenderer.js";
import { CARDS_PER_ROW, CARDS_PER_COL } from "./config.js";
import { resolveCardSizing } from "./cardSizing.js";
import { cardPositionMm, drawSheetCutMarks } from "./pdfLayout.js";

/**
 * @param {import('./state.js').Card[]} deck
 * @param {Record<string, import('./platformDefaults.js').PlatformDefaults>} platformDefaults
 * @param {{
 *   showHeader?: boolean,
 *   showPlatformColor?: boolean,
 *   headerHeightPercent?: number,
 * } | null | undefined} [layoutSettings]
 */
export async function exportLetterPdf(deck, platformDefaults, layoutSettings) {
  const { jsPDF } = await import("https://esm.sh/jspdf@2.5.2");
  const cardSizing = resolveCardSizing(layoutSettings);

  const cardsPerSheet = CARDS_PER_ROW * CARDS_PER_COL;
  const sheetCount = Math.max(1, Math.ceil(deck.length / cardsPerSheet));

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
  });

  for (let sheet = 0; sheet < sheetCount; sheet++) {
    if (sheet > 0) pdf.addPage();

    for (let slot = 0; slot < cardsPerSheet; slot++) {
      const cardIndex = sheet * cardsPerSheet + slot;
      if (cardIndex >= deck.length) continue;

      const col = slot % CARDS_PER_ROW;
      const row = Math.floor(slot / CARDS_PER_ROW);
      const { x, y } = cardPositionMm(col, row, layoutSettings);

      const canvas = await renderCard(deck[cardIndex], platformDefaults, layoutSettings, {
        bleedToCard: true,
      });
      const dataUrl = canvas.toDataURL("image/png");
      pdf.addImage(dataUrl, "PNG", x, y, cardSizing.cardWidthMm, cardSizing.cardHeightMm);
    }

    drawSheetCutMarks(pdf, layoutSettings);
  }

  pdf.save("nfc-card-labels.pdf");
}
