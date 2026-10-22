import { degrees } from 'pdf-lib';
import { loadPdf, checkPageIndices } from './validate.js';

/**
 * Rotates the chosen pages clockwise, on top of any rotation they already have.
 * @param {Uint8Array} pdf - the source PDF as bytes
 * @param {number[]} pageIndices - zero-based page numbers to rotate, e.g. [0, 2]
 * @param {number} angle - clockwise degrees to rotate by: 90, 180 or 270
 * @returns {Promise<Uint8Array>} the new PDF as bytes
 * @throws {Error} if the file can't be read, the angle is invalid, no pages are chosen, or a page doesn't exist
 */
export async function rotatePages(pdf, pageIndices, angle) {
  if (![90, 180, 270].includes(angle)) {
    throw new Error('Angle must be 90, 180 or 270 degrees.');
  }

  const doc = await loadPdf(pdf);
  const pages = doc.getPages();

  // Check every page number before changing anything
  checkPageIndices(pageIndices, pages.length);

  for (const index of pageIndices) {
    const page = pages[index];
    // % 360 wraps the total back into 0-359, e.g. 270 + 180 = 450 becomes 90
    const total = (page.getRotation().angle + angle) % 360;
    // degrees() wraps a number in the angle object pdf-lib expects
    page.setRotation(degrees(total));
  }

  return doc.save();
}
