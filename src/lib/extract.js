import { PDFDocument } from 'pdf-lib';

/**
 * Creates a new PDF containing only the chosen pages, in the order given.
 * @param {Uint8Array} pdf - the source PDF as bytes
 * @param {number[]} pageIndices - zero-based page numbers to keep, e.g. [0, 2]
 * @returns {Promise<Uint8Array>} the new PDF as bytes
 * @throws {Error} if the file can't be read, no pages are chosen, or a page doesn't exist
 */
export async function extractPages(pdf, pageIndices) {
  let source;
  try {
    source = await PDFDocument.load(pdf);
  } catch (error) {
    throw new Error(
      'The file could not be read. It may be corrupted or encrypted.',
      {
        cause: error,
      },
    );
  }

  if (pageIndices.length === 0) {
    throw new Error('No pages selected.');
  }

  // Check every page number before copying, so we never return a half-built PDF
  const pageCount = source.getPageCount();
  for (const index of pageIndices) {
    if (!Number.isInteger(index) || index < 0 || index >= pageCount) {
      // index + 1 because users count pages from 1
      throw new Error(
        `Page ${index + 1} does not exist. The PDF has ${pageCount} pages.`,
      );
    }
  }

  const result = await PDFDocument.create();

  // Copy the chosen pages into the new document; copyPages keeps the order of pageIndices
  const pages = await result.copyPages(source, pageIndices);
  pages.forEach((page) => result.addPage(page));

  return result.save();
}
