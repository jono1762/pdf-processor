import { PDFDocument } from 'pdf-lib';
import { loadPdf, checkPageIndices } from './validate.js';

/**
 * Creates a new PDF containing only the chosen pages, in the order given.
 * @param {Uint8Array} pdf - the source PDF as bytes
 * @param {number[]} pageIndices - zero-based page numbers to keep, e.g. [0, 2]
 * @returns {Promise<Uint8Array>} the new PDF as bytes
 * @throws {Error} if the file can't be read, no pages are chosen, or a page doesn't exist
 */
export async function extractPages(pdf, pageIndices) {
  const source = await loadPdf(pdf);

  // Check every page number before copying, so we never return a half-built PDF
  checkPageIndices(pageIndices, source.getPageCount());

  const result = await PDFDocument.create();

  // Copy the chosen pages into the new document; copyPages keeps the order of pageIndices
  const pages = await result.copyPages(source, pageIndices);
  pages.forEach((page) => result.addPage(page));

  return result.save();
}
