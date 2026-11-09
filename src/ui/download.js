import { isEdited } from './state.js';

/**
 * Reads a File the user picked into bytes.
 * @param {File} file
 * @returns {Promise<Uint8Array>}
 */
export async function readFileBytes(file) {
  // Uint8Array reads the raw memory byte by byte
  return new Uint8Array(await file.arrayBuffer());
}

/**
 * Says whether a file looks like a PDF (a dropped file can be anything).
 * @param {{ name: string, type: string }} file - a File, or anything with these fields
 * @returns {boolean}
 */
export function isPdfFile(file) {
  // Some systems give no type, so a ".pdf" name counts too
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/**
 * The largest file that can be opened: 200 MB (1 MB = 1024 × 1024 bytes).
 * A guess, to tune later.
 */
export const MAX_FILE_BYTES = 200 * 1024 * 1024;

/**
 * Says whether a file is too large to hold in memory safely.
 * @param {{ size: number }} file - a File, or anything with a size in bytes
 * @returns {boolean}
 */
export function isTooLarge(file) {
  // Known without reading the file
  return file.size > MAX_FILE_BYTES;
}

/**
 * Makes sure a name ends in ".pdf", e.g. "notes" becomes "notes.pdf".
 * @param {string} name - the original file name
 * @returns {string}
 */
export function pdfFilename(name) {
  return /\.pdf$/i.test(name) ? name : `${name}.pdf`;
}

/**
 * The download name: the file's own name, plus "-edited" if it has been changed.
 * @param {{ name: string, bytes: Uint8Array, originalBytes: Uint8Array }} file
 * @returns {string}
 */
export function downloadFilename(file) {
  return isEdited(file) ? editedFilename(file.name) : pdfFilename(file.name);
}

/**
 * Builds the name for an edited file, e.g. "report.pdf" becomes "report-edited.pdf".
 * @param {string} name - the original file name
 * @returns {string}
 */
export function editedFilename(name) {
  // Removes a trailing ".pdf" in any case, to avoid "report.pdf-edited.pdf"
  return `${name.replace(/\.pdf$/i, '')}-edited.pdf`;
}

/**
 * Builds an extracted file's name, e.g. "report.pdf" and 2 give "report-pages-2.pdf".
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
  // A Blob is a file in memory; nothing is uploaded
  const blob = new Blob([bytes], { type: 'application/pdf' });
  // A temporary local URL a link can point at
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  // Free the URL's memory
  URL.revokeObjectURL(url);
}
