import { describe, it, expect } from 'vitest';
import { editedFilename, isPdfFile } from './download.js';

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
