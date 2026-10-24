import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

// US Letter size in PDF points (1 point = 1/72 inch)
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

// Header colours, used in turn so neighbouring pages are easy to tell apart
const HEADER_COLORS = [
  rgb(0.15, 0.39, 0.92),
  rgb(0.09, 0.64, 0.29),
  rgb(0.85, 0.47, 0.02),
  rgb(0.86, 0.15, 0.15),
  rgb(0.58, 0.2, 0.92),
];

/**
 * Builds a simple PDF where every page has a coloured header, the document title
 * and a large "Page N" number.
 * @param {string} title
 * @param {number} pageCount
 * @param {number[]} [rotatedPages] - zero-based pages to turn 90 degrees clockwise
 * @returns {Promise<Uint8Array>}
 */
async function buildSample(title, pageCount, rotatedPages = []) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    // A coloured band across the top, with the title in white
    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 90,
      width: PAGE_WIDTH,
      height: 90,
      color: HEADER_COLORS[i % HEADER_COLORS.length],
    });
    page.drawText(title, {
      x: 40,
      y: PAGE_HEIGHT - 55,
      size: 24,
      font,
      color: rgb(1, 1, 1),
    });

    // The page number, large enough to read in a small thumbnail
    page.drawText(`Page ${i + 1}`, {
      x: 150,
      y: PAGE_HEIGHT / 2,
      size: 72,
      font,
      color: rgb(0.12, 0.16, 0.2),
    });
    page.drawText(`of ${pageCount}`, {
      x: 150,
      y: PAGE_HEIGHT / 2 - 40,
      size: 24,
      font,
      color: rgb(0.32, 0.38, 0.45),
    });

    if (rotatedPages.includes(i)) page.setRotation(degrees(90));
  }

  return doc.save();
}

/**
 * A 6-page document, for trying reorder, merge, rotate and delete.
 * @returns {Promise<Uint8Array>}
 */
export function createMultiPageSample() {
  return buildSample('Sample document', 6);
}

/**
 * A 4-page document whose third page is turned sideways, for trying rotate.
 * @returns {Promise<Uint8Array>}
 */
export function createSidewaysSample() {
  return buildSample('Sideways page sample', 4, [2]);
}

/**
 * A 300-page document, for seeing how the app copes with a long file.
 * @returns {Promise<Uint8Array>}
 */
export function createLargeSample() {
  return buildSample('Large sample', 300);
}
