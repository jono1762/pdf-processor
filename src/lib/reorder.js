import { PDFDocument } from 'pdf-lib';
import { loadPdf, checkPageIndices } from './validate.js';

/**
 * Puts a PDF's pages in a new order.
 * @param {Uint8Array} pdf - the source PDF as bytes
 * @param {number[]} newOrder - every zero-based page number exactly once, in the
 *   order the pages should end up, e.g. [2, 0, 1] puts the last page of three first
 * @returns {Promise<Uint8Array>} the new PDF as bytes
 * @throws {Error} if the file can't be read, or newOrder isn't a full reordering
 */
export async function reorderPages(pdf, newOrder) {
  const source = await loadPdf(pdf);
  const pageCount = source.getPageCount();
  checkPageIndices(newOrder, pageCount);

  // Every page exactly once: the right length, with no page repeated.
  // (A Set holds each value once, so a repeat makes it smaller than the list.)
  if (newOrder.length !== pageCount || new Set(newOrder).size !== pageCount) {
    throw new Error(
      `The new order must list each of the ${pageCount} pages exactly once.`,
    );
  }

  const result = await PDFDocument.create();
  // copyPages keeps the order of newOrder
  const pages = await result.copyPages(source, newOrder);
  pages.forEach((page) => result.addPage(page));

  return result.save();
}
