import { renderCard } from "./cardRenderer.js";
import {
  CARD_WIDTH_MM,
  CARD_HEIGHT_MM,
  CARDS_PER_ROW,
  CARDS_PER_COL,
  PDF_CUT_MARK_LENGTH_MM,
  PDF_CUT_MARK_OFFSET_MM,
} from "./config.js";
import { cardPositionMm } from "./pdfLayout.js";

/**
 * Crop marks outside the card — inner tick ends PDF_CUT_MARK_OFFSET_MM from the edge.
 *
 * @param {import("jspdf").jsPDF} pdf
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 */
export function drawCutMarks(pdf, x, y, w, h) {
  const m = PDF_CUT_MARK_LENGTH_MM;
  const o = PDF_CUT_MARK_OFFSET_MM;
  pdf.setDrawColor(120);
  pdf.setLineWidth(0.15);

  const corners = [
    [x - o, y, x - o - m, y],
    [x + w + o, y, x + w + o + m, y],
    [x - o, y + h, x - o - m, y + h],
    [x + w + o, y + h, x + w + o + m, y + h],
    [x, y - o, x, y - o - m],
    [x + w, y - o, x + w, y - o - m],
    [x, y + h + o, x, y + h + o + m],
    [x + w, y + h + o, x + w, y + h + o + m],
  ];

  for (const [x1, y1, x2, y2] of corners) {
    pdf.line(x1, y1, x2, y2);
  }
}

/**
 * @param {import('./state.js').Card[]} deck
 * @param {Record<string, string>} platformColors
 */
export async function exportLetterPdf(deck, platformColors) {
  const { jsPDF } = await import("https://esm.sh/jspdf@2.5.2");

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
      const col = slot % CARDS_PER_ROW;
      const row = Math.floor(slot / CARDS_PER_ROW);
      const { x, y } = cardPositionMm(col, row);

      drawCutMarks(pdf, x, y, CARD_WIDTH_MM, CARD_HEIGHT_MM);

      if (cardIndex >= deck.length) continue;

      const canvas = await renderCard(deck[cardIndex], platformColors);
      const dataUrl = canvas.toDataURL("image/png");
      pdf.addImage(dataUrl, "PNG", x, y, CARD_WIDTH_MM, CARD_HEIGHT_MM);
    }
  }

  pdf.save("nfc-card-labels.pdf");
}
