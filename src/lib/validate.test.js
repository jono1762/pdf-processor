import { describe, it, expect } from 'vitest';
import { loadPdf, checkPageIndices } from './validate.js';
import { createTestPdf } from './test-helpers.js';

describe('loadPdf', () => {
  it('loads a valid PDF', async () => {
    const pdf = await createTestPdf([100, 110]);

    const doc = await loadPdf(pdf);

    expect(doc.getPageCount()).toBe(2);
  });

  it('throws a clear error for a file that is not a valid PDF', async () => {
    const bad = new Uint8Array([1, 2, 3]);

    await expect(loadPdf(bad)).rejects.toThrow('The file could not be read');
  });
});

describe('checkPageIndices', () => {
  it('accepts page numbers that exist, in any order, with repeats', () => {
    // .not.toThrow() passes only if the function runs without throwing
    expect(() => checkPageIndices([2, 0, 0], 3)).not.toThrow();
  });

  it('throws when the list is empty', () => {
    expect(() => checkPageIndices([], 3)).toThrow('No pages selected');
  });

  it('throws when a page is past the end', () => {
    expect(() => checkPageIndices([0, 3], 3)).toThrow('Page 4 does not exist');
  });

  it('throws for negative or non-whole page numbers', () => {
    expect(() => checkPageIndices([-1], 3)).toThrow('does not exist');
    expect(() => checkPageIndices([1.5], 3)).toThrow('does not exist');
  });
});
