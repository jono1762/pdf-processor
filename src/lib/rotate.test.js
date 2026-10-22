import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { rotatePages } from './rotate.js';
import { createTestPdf } from './test-helpers.js';

// Reads a PDF and returns each page's rotation in degrees
async function pageRotations(bytes) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => page.getRotation().angle);
}

describe('rotatePages', () => {
  it('rotates only the chosen pages', async () => {
    const pdf = await createTestPdf([100, 110, 120]);

    const result = await rotatePages(pdf, [0, 2], 90);

    expect(await pageRotations(result)).toEqual([90, 0, 90]);
  });
});
