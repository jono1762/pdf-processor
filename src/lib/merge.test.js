import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { mergePdfs } from './merge.js';
import { createTestPdf } from './test-helpers.js';

// Reads a PDF and returns each page's width, so tests can check page order
async function pageWidths(bytes) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => page.getWidth());
}

// describe groups related tests; it defines one test
describe('mergePdfs', () => {
  it('combines all pages in file order', async () => {
    const a = await createTestPdf([100, 110]);
    const b = await createTestPdf([200]);

    const merged = await mergePdfs([a, b]);

    // toEqual compares array contents (toBe would compare identity)
    expect(await pageWidths(merged)).toEqual([100, 110, 200]);
  });

  it('respects the order the files are given in', async () => {
    const a = await createTestPdf([100]);
    const b = await createTestPdf([200]);

    const merged = await mergePdfs([b, a]);

    expect(await pageWidths(merged)).toEqual([200, 100]);
  });

  it('throws a clear error for a file that is not a valid PDF', async () => {
    const good = await createTestPdf([100]);
    const bad = new Uint8Array([1, 2, 3]);

    // rejects: the Promise must fail; toThrow checks the error message contains this text
    await expect(mergePdfs([good, bad])).rejects.toThrow(
      'File 2 could not be read',
    );
  });

  it('uses file names in the error when they are given', async () => {
    const good = await createTestPdf([100]);
    const bad = new Uint8Array([1, 2, 3]);

    await expect(mergePdfs([good, bad], ['a.pdf', 'b.pdf'])).rejects.toThrow(
      'b.pdf could not be read',
    );
  });

  it('lists every file that could not be read', async () => {
    const good = await createTestPdf([100]);
    const bad = new Uint8Array([1, 2, 3]);

    // The second and third files are bad; the message must name both
    await expect(
      mergePdfs([good, bad, bad], ['a.pdf', 'b.pdf', 'c.pdf']),
    ).rejects.toThrow('These files could not be read: b.pdf, c.pdf.');
  });

  it('falls back to file numbers when no names are given', async () => {
    const bad = new Uint8Array([1, 2, 3]);

    await expect(mergePdfs([bad, bad])).rejects.toThrow(
      'These files could not be read: File 1, File 2.',
    );
  });
});
