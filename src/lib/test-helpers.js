import { PDFDocument } from 'pdf-lib';

/**
 * Creates a PDF in memory for tests. Each page gets the width given in
 * `widths`, so tests can tell pages apart and check their order.
 * @param {number[]} widths
 * @returns {Promise<Uint8Array>}
 */
export async function createTestPdf(widths) {
  const doc = await PDFDocument.create();
  for (const width of widths) {
    doc.addPage([width, 200]);
  }
  return doc.save();
}

/**
 * Reads a PDF and returns each page's width, so tests can tell pages apart.
 * @param {Uint8Array} bytes
 * @returns {Promise<number[]>}
 */
export async function pageWidths(bytes) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => page.getWidth());
}

/**
 * Reads a PDF and returns each page's rotation in degrees.
 * @param {Uint8Array} bytes
 * @returns {Promise<number[]>}
 */
export async function pageRotations(bytes) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => page.getRotation().angle);
}
