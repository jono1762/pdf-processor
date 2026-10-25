/**
 * Reads a File the user picked into bytes.
 * @param {File} file
 * @returns {Promise<Uint8Array>}
 */
export async function readFileBytes(file) {
  // arrayBuffer() is the raw memory; Uint8Array lets us read it byte by byte
  return new Uint8Array(await file.arrayBuffer());
}

/**
 * Says whether a file looks like a PDF. The picker only offers PDFs, but a dropped
 * file can be anything.
 * @param {{ name: string, type: string }} file - a File, or anything with these fields
 * @returns {boolean}
 */
export function isPdfFile(file) {
  // Some systems report an empty type, so a ".pdf" name also counts
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/**
 * The largest file that can be opened, in bytes: 200 MB, counting 1 MB as
 * 1024 × 1024 bytes as Windows does. A guess for now, to be tuned with real
 * measurements later.
 */
export const MAX_FILE_BYTES = 200 * 1024 * 1024;

/**
 * Says whether a file is too large to open safely. Every file is held in memory,
 * so a huge one could freeze or crash the tab.
 * @param {{ size: number }} file - a File, or anything with a size in bytes
 * @returns {boolean}
 */
export function isTooLarge(file) {
  // File.size is known without reading the file, so this check is instant
  return file.size > MAX_FILE_BYTES;
}

/**
 * Builds the name for an edited file, e.g. "report.pdf" becomes "report-edited.pdf".
 * @param {string} name - the original file name
 * @returns {string}
 */
export function editedFilename(name) {
  // The regex removes a trailing ".pdf" in any letter case, so we don't get "report.pdf-edited.pdf"
  return `${name.replace(/\.pdf$/i, '')}-edited.pdf`;
}

/**
 * Builds the name for a file made from some pages of another, e.g. "report.pdf"
 * and 2 give "report-pages-2.pdf".
 * @param {string} name - the original file name
 * @param {number} number - which extraction from that file this is
 * @returns {string}
 */
export function extractedFilename(name, number) {
  return `${name.replace(/\.pdf$/i, '')}-pages-${number}.pdf`;
}

/**
 * Makes the browser download the given bytes as a PDF file.
 * @param {Uint8Array} bytes
 * @param {string} filename
 */
export function downloadPdf(bytes, filename) {
  // A Blob is a file-like object held in memory; nothing is uploaded anywhere
  const blob = new Blob([bytes], { type: 'application/pdf' });
  // Gives the Blob a temporary local URL, so a link can point at it
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  // Frees the memory the temporary URL was holding
  URL.revokeObjectURL(url);
}
