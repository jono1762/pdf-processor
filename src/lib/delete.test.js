import { describe, it, expect } from 'vitest';
import { deletePages } from './delete.js';
import { createTestPdf, pageWidths } from './test-helpers.js';

describe('deletePages', () => {
  it('removes the chosen page and keeps the rest in order', async () => {
    const pdf = await createTestPdf([100, 110, 120]);

    const result = await deletePages(pdf, [1]);

    expect(await pageWidths(result)).toEqual([100, 120]);
  });

  it('removes several pages, whatever order they are listed in', async () => {
    const pdf = await createTestPdf([100, 110, 120, 130, 140]);

    const result = await deletePages(pdf, [3, 0, 1]);

    expect(await pageWidths(result)).toEqual([120, 140]);
  });

  it('treats a page chosen twice as chosen once', async () => {
    const pdf = await createTestPdf([100, 110, 120]);

    const result = await deletePages(pdf, [1, 1]);

    expect(await pageWidths(result)).toEqual([100, 120]);
  });

  it('throws when every page would be deleted', async () => {
    const pdf = await createTestPdf([100, 110]);

    await expect(deletePages(pdf, [0, 1])).rejects.toThrow(
      'not every page can be deleted',
    );
  });

  it('throws when no pages are selected', async () => {
    const pdf = await createTestPdf([100]);

    await expect(deletePages(pdf, [])).rejects.toThrow('No pages selected');
  });

  it('throws when a page does not exist', async () => {
    const pdf = await createTestPdf([100, 110]);

    await expect(deletePages(pdf, [2])).rejects.toThrow(
      'Page 3 does not exist',
    );
  });

  it('throws a clear error for a file that is not a valid PDF', async () => {
    const bad = new Uint8Array([1, 2, 3]);

    await expect(deletePages(bad, [0])).rejects.toThrow(
      'The file could not be read',
    );
  });
});
