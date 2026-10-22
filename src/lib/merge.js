import { PDFDocument } from 'pdf-lib';

/**
 * Merges PDFs into one, keeping the given file order and each file's page order.
 * @param {Uint8Array[]} pdfs - the PDF files as bytes
 * @returns {Promise<Uint8Array>} the merged PDF as bytes
 * @throws {Error} if a file can't be read, e.g. it is corrupted or encrypted
 */
// async: this function uses await, so it returns a Promise
export async function mergePdfs(pdfs) {
  // The new, empty document that all pages get copied into
  const merged = await PDFDocument.create();

  // entries() gives [index, item] pairs, so we can report which file failed
  for (const [index, bytes] of pdfs.entries()) {
    let source;
    try {
      source = await PDFDocument.load(bytes);
    } catch (error) {
      // `cause` keeps the original error attached for debugging
      throw new Error(
        `File ${index + 1} could not be read. It may be corrupted or encrypted.`,
        { cause: error },
      );
    }
    // Pages can't be added directly from another document; copy them first
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }

  return merged.save();
}
