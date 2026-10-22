import { PDFDocument } from 'pdf-lib';

/**
 * Creates a new PDF containing only the chosen pages, in the order given.
 * @param {Uint8Array} pdf - the source PDF as bytes
 * @param {number[]} pageIndices - zero-based page numbers to keep, e.g. [0, 2]
 * @returns {Promise<Uint8Array>} the new PDF as bytes
 */
export async function extractPages(pdf, pageIndices) {
  const source = await PDFDocument.load(pdf);
  const result = await PDFDocument.create();

  // Copy the chosen pages into the new document; copyPages keeps the order of pageIndices
  const pages = await result.copyPages(source, pageIndices);
  pages.forEach((page) => result.addPage(page));

  return result.save();
}
