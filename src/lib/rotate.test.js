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

  it('adds to a rotation the page already has', async () => {
    const pdf = await createTestPdf([100]);

    const once = await rotatePages(pdf, [0], 90);
    const twice = await rotatePages(once, [0], 90);

    expect(await pageRotations(twice)).toEqual([180]);
  });

  it('wraps around after a full turn', async () => {
    const pdf = await createTestPdf([100]);

    const once = await rotatePages(pdf, [0], 270);
    const twice = await rotatePages(once, [0], 180);

    // 270 + 180 = 450, which is the same as 90
    expect(await pageRotations(twice)).toEqual([90]);
  });
});
