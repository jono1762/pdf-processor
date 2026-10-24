import { loadPdf, checkPageIndices } from './validate.js';

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

  // Delete from the last page backwards. Removing a page shifts the numbers of the
  // pages after it, so going backwards keeps the remaining numbers correct.
  const lastFirst = [...toDelete].sort((a, b) => b - a);
  for (const index of lastFirst) {
    doc.removePage(index);
  }

  return doc.save();
}
