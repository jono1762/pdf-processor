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
});
