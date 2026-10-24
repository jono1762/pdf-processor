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
 * Builds the name for an edited file, e.g. "report.pdf" becomes "report-edited.pdf".
 * @param {string} name - the original file name
 * @returns {string}
 */
export function editedFilename(name) {
  // The regex removes a trailing ".pdf" in any letter case, so we don't get "report.pdf-edited.pdf"
  return `${name.replace(/\.pdf$/i, '')}-edited.pdf`;
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
