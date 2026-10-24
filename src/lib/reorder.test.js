import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { reorderPages } from './reorder.js';
import { createTestPdf } from './test-helpers.js';

// Reads a PDF and returns each page's width, so tests can tell pages apart
async function pageWidths(bytes) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => page.getWidth());
}

describe('reorderPages', () => {
  it('puts the pages in the new order', async () => {
    const pdf = await createTestPdf([100, 110, 120]);

    const result = await reorderPages(pdf, [2, 0, 1]);

    expect(await pageWidths(result)).toEqual([120, 100, 110]);
  });

  it('can reverse the pages', async () => {
    const pdf = await createTestPdf([100, 110, 120]);

    const result = await reorderPages(pdf, [2, 1, 0]);

    expect(await pageWidths(result)).toEqual([120, 110, 100]);
  });

  it('leaves the order alone for the original order', async () => {
    const pdf = await createTestPdf([100, 110, 120]);

    const result = await reorderPages(pdf, [0, 1, 2]);

    expect(await pageWidths(result)).toEqual([100, 110, 120]);
  });

  it('throws when a page is missing from the new order', async () => {
    const pdf = await createTestPdf([100, 110, 120]);

    await expect(reorderPages(pdf, [0, 1])).rejects.toThrow(
      'each of the 3 pages exactly once',
    );
  });

  it('throws when a page is repeated', async () => {
    const pdf = await createTestPdf([100, 110, 120]);

    // Right length, but page 0 appears twice and page 2 is missing
    await expect(reorderPages(pdf, [0, 1, 0])).rejects.toThrow(
      'each of the 3 pages exactly once',
    );
  });

  it('throws when the new order is longer than the page count', async () => {
    const pdf = await createTestPdf([100, 110, 120]);

    // Every page is there, but page 0 is listed twice, which would make 4 pages
    await expect(reorderPages(pdf, [0, 1, 2, 0])).rejects.toThrow(
      'each of the 3 pages exactly once',
    );
  });

  it('throws when a page does not exist', async () => {
    const pdf = await createTestPdf([100, 110]);

    await expect(reorderPages(pdf, [0, 2])).rejects.toThrow(
      'Page 3 does not exist',
    );
  });

  it('throws when the new order is empty', async () => {
    const pdf = await createTestPdf([100]);

    await expect(reorderPages(pdf, [])).rejects.toThrow('No pages selected');
  });

  it('throws a clear error for a file that is not a valid PDF', async () => {
    const bad = new Uint8Array([1, 2, 3]);

    await expect(reorderPages(bad, [0])).rejects.toThrow(
      'The file could not be read',
    );
  });
});
