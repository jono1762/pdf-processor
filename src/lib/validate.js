import { PDFDocument } from 'pdf-lib';

/**
 * Loads a PDF, turning pdf-lib's technical error into a message users can understand.
 * @param {Uint8Array} bytes - the PDF as bytes
 * @returns {Promise<PDFDocument>}
 * @throws {Error} if the file is corrupted, encrypted or not a PDF
 */
export async function loadPdf(bytes) {
  try {
    return await PDFDocument.load(bytes);
  } catch (error) {
    // `cause` keeps the original error attached for debugging
    throw new Error(
      'The file could not be read. It may be corrupted or encrypted.',
      { cause: error },
    );
  }
}

/**
 * Checks that a list of zero-based page numbers is non-empty and all exist.
 * @param {number[]} pageIndices
 * @param {number} pageCount - how many pages the PDF has
 * @throws {Error} if the list is empty or a page number is invalid
 */
export function checkPageIndices(pageIndices, pageCount) {
  if (pageIndices.length === 0) {
    throw new Error('No pages selected.');
  }

  for (const index of pageIndices) {
    if (!Number.isInteger(index) || index < 0 || index >= pageCount) {
      // index + 1 because users count pages from 1
      throw new Error(
        `Page ${index + 1} does not exist. The PDF has ${pageCount} pages.`,
      );
    }
  }
}
