import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  createMultiPageSample,
  createSidewaysSample,
  createLargeSample,
} from './samples.js';
import { pageRotations } from './test-helpers.js';

// Counts the pages, which also proves the bytes are a PDF that can be opened
async function pageCount(bytes) {
  return (await PDFDocument.load(bytes)).getPageCount();
}

describe('sample documents', () => {
  it('multi-page sample has 6 pages, none rotated', async () => {
    const bytes = await createMultiPageSample();

    expect(await pageCount(bytes)).toBe(6);
    expect(await pageRotations(bytes)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('sideways sample has one page turned 90 degrees', async () => {
    const bytes = await createSidewaysSample();

    expect(await pageRotations(bytes)).toEqual([0, 0, 90, 0]);
  });

  it('large sample has 300 pages', async () => {
    const bytes = await createLargeSample();

    expect(await pageCount(bytes)).toBe(300);
  });
});
