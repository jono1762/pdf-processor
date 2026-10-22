import { PDFDocument } from 'pdf-lib';

/**
 * Merges PDFs into one, keeping the given file order and each file's page order.
 * @param {Uint8Array[]} pdfs - the PDF files as bytes
 * @param {string[]} [names] - file names in the same order, used in error messages
 * @returns {Promise<Uint8Array>} the merged PDF as bytes
 * @throws {Error} if any file can't be read, e.g. it is corrupted or encrypted;
 *   the message lists every file that failed
 */
// async: this function uses await, so it returns a Promise
export async function mergePdfs(pdfs, names = []) {
  // Load every file first, collecting failures, so the user hears about all
  // the bad files at once instead of fixing them one merge at a time
  const sources = [];
  const failed = [];
  for (const [index, bytes] of pdfs.entries()) {
    try {
      sources.push(await PDFDocument.load(bytes));
    } catch (error) {
      // ?? uses the right side only when the left is missing: no name given
      failed.push({ name: names[index] ?? `File ${index + 1}`, error });
    }
  }

  if (failed.length > 0) {
    const list = failed.map((file) => file.name).join(', ');
    const message =
      failed.length === 1
        ? `${list} could not be read. It may be corrupted or encrypted.`
        : `These files could not be read: ${list}. They may be corrupted or encrypted.`;
    // `cause` keeps the original errors attached for debugging
    throw new Error(message, { cause: failed.map((file) => file.error) });
  }

  // The new, empty document that all pages get copied into
  const merged = await PDFDocument.create();
  for (const source of sources) {
    // Pages can't be added directly from another document; copy them first
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }

  return merged.save();
}
