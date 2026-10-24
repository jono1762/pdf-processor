import { describe, it, expect } from 'vitest';
import { editedFilename } from './download.js';

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
