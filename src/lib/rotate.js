import { PDFDocument, degrees } from 'pdf-lib';

/**
 * Rotates the chosen pages clockwise, on top of any rotation they already have.
 * @param {Uint8Array} pdf - the source PDF as bytes
 * @param {number[]} pageIndices - zero-based page numbers to rotate, e.g. [0, 2]
 * @param {number} angle - clockwise degrees to rotate by: 90, 180 or 270
 * @returns {Promise<Uint8Array>} the new PDF as bytes
 */
export async function rotatePages(pdf, pageIndices, angle) {
  const doc = await PDFDocument.load(pdf);
  const pages = doc.getPages();

  for (const index of pageIndices) {
    const page = pages[index];
    // degrees() wraps a number in the angle object pdf-lib expects
    page.setRotation(degrees(page.getRotation().angle + angle));
  }

  return doc.save();
}
