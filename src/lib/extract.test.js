import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { extractPages } from './extract.js';
import { createTestPdf } from './test-helpers.js';

// Reads a PDF and returns each page's width, so tests can tell pages apart
async function pageWidths(bytes) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => page.getWidth());
}

describe('extractPages', () => {
  it('keeps only the chosen pages', async () => {
    const pdf = await createTestPdf([100, 110, 120, 130]);

    const result = await extractPages(pdf, [1, 2]);

    expect(await pageWidths(result)).toEqual([110, 120]);
  });

  it('follows the order given, so pages can be reordered', async () => {
    const pdf = await createTestPdf([100, 110, 120]);

    const result = await extractPages(pdf, [2, 0, 1]);

    expect(await pageWidths(result)).toEqual([120, 100, 110]);
  });

  it('allows the same page more than once', async () => {
    const pdf = await createTestPdf([100, 110]);

    const result = await extractPages(pdf, [1, 1, 0]);

    expect(await pageWidths(result)).toEqual([110, 110, 100]);
  });

  it('throws when no pages are selected', async () => {
    const pdf = await createTestPdf([100]);

    await expect(extractPages(pdf, [])).rejects.toThrow('No pages selected');
  });

  it('throws when a page does not exist', async () => {
    const pdf = await createTestPdf([100, 110]);

    // Index 2 is the third page, but the PDF only has two
    await expect(extractPages(pdf, [0, 2])).rejects.toThrow(
      'Page 3 does not exist',
    );
    await expect(extractPages(pdf, [-1])).rejects.toThrow(
      'Page 0 does not exist',
    );
  });

  it('throws a clear error for a file that is not a valid PDF', async () => {
    const bad = new Uint8Array([1, 2, 3]);

    await expect(extractPages(bad, [0])).rejects.toThrow(
      'The file could not be read',
    );
  });
});
