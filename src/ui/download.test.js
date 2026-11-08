import { describe, it, expect } from 'vitest';
import {
  downloadFilename,
  editedFilename,
  extractedFilename,
  isPdfFile,
  isTooLarge,
  MAX_FILE_BYTES,
  pdfFilename,
} from './download.js';

describe('pdfFilename', () => {
  it('keeps a name that ends in .pdf', () => {
    expect(pdfFilename('report.pdf')).toBe('report.pdf');
  });

  it('ignores the case of the extension', () => {
    expect(pdfFilename('Report.PDF')).toBe('Report.PDF');
  });

  it('adds the extension when the name has none', () => {
    expect(pdfFilename('notes')).toBe('notes.pdf');
  });
});

describe('downloadFilename', () => {
  // Like a file in the list: both names point to the same array until an edit
  const bytes = new Uint8Array([1, 2, 3]);

  it('keeps the name of a file that has not been edited', () => {
    const file = { name: 'report.pdf', bytes, originalBytes: bytes };
    expect(downloadFilename(file)).toBe('report.pdf');
  });

  it('adds -edited to a file that has been edited', () => {
    const file = {
      name: 'report.pdf',
      bytes: new Uint8Array([1, 2, 3]),
      originalBytes: bytes,
    };
    expect(downloadFilename(file)).toBe('report-edited.pdf');
  });

  it('adds the extension to an unedited file whose name has none', () => {
    const file = { name: 'notes', bytes, originalBytes: bytes };
    expect(downloadFilename(file)).toBe('notes.pdf');
  });
});

describe('editedFilename', () => {
  it('adds -edited before the .pdf extension', () => {
    expect(editedFilename('report.pdf')).toBe('report-edited.pdf');
  });

  it('ignores the case of the extension', () => {
    expect(editedFilename('Report.PDF')).toBe('Report-edited.pdf');
  });

  it('only removes the final .pdf', () => {
    expect(editedFilename('a.pdf.pdf')).toBe('a.pdf-edited.pdf');
  });

  it('adds the extension when the name has none', () => {
    expect(editedFilename('notes')).toBe('notes-edited.pdf');
  });
});

describe('isPdfFile', () => {
  it('accepts the PDF type', () => {
    expect(isPdfFile({ name: 'report', type: 'application/pdf' })).toBe(true);
  });

  it('accepts a .pdf name when the type is empty, in any letter case', () => {
    expect(isPdfFile({ name: 'report.pdf', type: '' })).toBe(true);
    expect(isPdfFile({ name: 'REPORT.PDF', type: '' })).toBe(true);
  });

  it('rejects other files', () => {
    expect(isPdfFile({ name: 'notes.txt', type: 'text/plain' })).toBe(false);
  });

  it('rejects a name that only contains "pdf"', () => {
    expect(isPdfFile({ name: 'pdf.txt', type: '' })).toBe(false);
    expect(isPdfFile({ name: 'report.pdf.txt', type: '' })).toBe(false);
  });
});

describe('isTooLarge', () => {
  it('allows files up to and including the limit', () => {
    expect(isTooLarge({ size: 0 })).toBe(false);
    expect(isTooLarge({ size: MAX_FILE_BYTES - 1 })).toBe(false);
    expect(isTooLarge({ size: MAX_FILE_BYTES })).toBe(false);
  });

  it('rejects files over the limit', () => {
    expect(isTooLarge({ size: MAX_FILE_BYTES + 1 })).toBe(true);
  });
});

describe('extractedFilename', () => {
  it('adds -pages and the number before the .pdf extension', () => {
    expect(extractedFilename('report.pdf', 1)).toBe('report-pages-1.pdf');
    expect(extractedFilename('report.pdf', 12)).toBe('report-pages-12.pdf');
  });

  it('ignores the case of the extension', () => {
    expect(extractedFilename('Report.PDF', 2)).toBe('Report-pages-2.pdf');
  });

  it('adds the extension when the name has none', () => {
    expect(extractedFilename('notes', 1)).toBe('notes-pages-1.pdf');
  });
});
