import { loadPdf, checkPageIndices } from './validate.js';
import { saveWithout } from './clean.js';

/**
 * Removes the chosen pages from a PDF.
 * @param {Uint8Array} pdf - the source PDF as bytes
 * @param {number[]} pageIndices - zero-based page numbers to delete, e.g. [0, 2]
 * @returns {Promise<Uint8Array>} the new PDF as bytes
 * @throws {Error} if the file can't be read, no pages are chosen, a page doesn't
 *   exist, or the choice would delete every page
 */
export async function deletePages(pdf, pageIndices) {
  const doc = await loadPdf(pdf);
  const pageCount = doc.getPageCount();
  checkPageIndices(pageIndices, pageCount);

  // A Set drops duplicates, so choosing the same page twice deletes it once
  const toDelete = new Set(pageIndices);
  if (toDelete.size === pageCount) {
    throw new Error(
      'A PDF needs at least one page, so not every page can be deleted.',
    );
  }

  // Remembered for the clean-up when saving
  const removed = [...toDelete].map((index) => doc.getPage(index).ref);

  // Backwards, since removing a page shifts the numbers after it
  const lastFirst = [...toDelete].sort((a, b) => b - a);
  for (const index of lastFirst) {
    doc.removePage(index);
  }

  // Not doc.save(), which would keep the deleted pages in the file
  return saveWithout(doc, removed);
}
