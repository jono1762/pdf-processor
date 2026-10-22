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

  it('throws for an angle that is not 90, 180 or 270', async () => {
    const pdf = await createTestPdf([100]);

    await expect(rotatePages(pdf, [0], 45)).rejects.toThrow(
      'Angle must be 90, 180 or 270',
    );
  });

  it('throws when no pages are selected', async () => {
    const pdf = await createTestPdf([100]);

    await expect(rotatePages(pdf, [], 90)).rejects.toThrow('No pages selected');
  });

  it('throws when a page does not exist', async () => {
    const pdf = await createTestPdf([100, 110]);

    // Index 2 is the third page, but the PDF only has two
    await expect(rotatePages(pdf, [0, 2], 90)).rejects.toThrow(
      'Page 3 does not exist',
    );
  });

  it('throws a clear error for a file that is not a valid PDF', async () => {
    const bad = new Uint8Array([1, 2, 3]);

    await expect(rotatePages(bad, [0], 90)).rejects.toThrow(
      'The file could not be read',
    );
  });
});
