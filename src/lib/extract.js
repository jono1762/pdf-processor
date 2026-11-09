import { PDFDocument } from 'pdf-lib';
import { loadPdf, checkPageIndices } from './validate.js';
import { saveWithout } from './clean.js';

/**
 * Creates a new PDF containing only the chosen pages, in the order given.
 * @param {Uint8Array} pdf - the source PDF as bytes
 * @param {number[]} pageIndices - zero-based page numbers to keep, e.g. [0, 2]
 * @returns {Promise<Uint8Array>} the new PDF as bytes
 * @throws {Error} if the file can't be read, no pages are chosen, or a page doesn't exist
 */
export async function extractPages(pdf, pageIndices) {
  const doc = await loadPdf(pdf);
  const pageCount = doc.getPageCount();

  // Check every page number before changing anything
  checkPageIndices(pageIndices, pageCount);

  // Remove the unchosen pages first, as Delete does. Copying alone isn't safe: a
  // link to another page would bring that page along, hidden.
  const chosen = new Set(pageIndices);
  const unchosen = doc.getPageIndices().filter((index) => !chosen.has(index));
  const removed = unchosen.map((index) => doc.getPage(index).ref);
  // Backwards, since removing a page shifts the numbers after it
  for (const index of unchosen.reverse()) {
    doc.removePage(index);
  }
  const cleaned = await PDFDocument.load(await saveWithout(doc, removed));

  // Copy the chosen pages into the order asked for (repeats allowed). Each original
  // page number becomes its position among the chosen pages.
  const inOriginalOrder = [...chosen].sort((a, b) => a - b);
  const result = await PDFDocument.create();
  const pages = await result.copyPages(
    cleaned,
    pageIndices.map((index) => inOriginalOrder.indexOf(index)),
  );
  pages.forEach((page) => result.addPage(page));

  return result.save();
}
