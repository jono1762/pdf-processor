import { PDFDocument, degrees } from 'pdf-lib';

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

  let doc;
  try {
    doc = await PDFDocument.load(pdf);
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

  // Check every page number before changing anything
  const pages = doc.getPages();
  for (const index of pageIndices) {
    if (!Number.isInteger(index) || index < 0 || index >= pages.length) {
      // index + 1 because users count pages from 1
      throw new Error(
        `Page ${index + 1} does not exist. The PDF has ${pages.length} pages.`,
      );
    }
  }

  for (const index of pageIndices) {
    const page = pages[index];
    // % 360 wraps the total back into 0-359, e.g. 270 + 180 = 450 becomes 90
    const total = (page.getRotation().angle + angle) % 360;
    // degrees() wraps a number in the angle object pdf-lib expects
    page.setRotation(degrees(total));
  }

  return doc.save();
}
