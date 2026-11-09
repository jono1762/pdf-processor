import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { deletePages } from './delete.js';

// Each page draws a unique word with an uncompressed content stream, so a test can
// search the saved bytes for it: if the word is in the file, so is that page.
async function markedPdf(pageCount, extras = () => {}) {
  const doc = await PDFDocument.create();
  doc.setTitle('Generated test file');
  for (let i = 1; i <= pageCount; i++) {
    const page = doc.addPage([200, 200]);
    const content = doc.context.stream(
      `BT /F1 12 Tf 20 100 Td (MARKER-PAGE-${i}) Tj ET`,
    );
    page.node.set(PDFName.of('Contents'), doc.context.register(content));
  }
  await extras(doc);
  return doc.save();
}

// True if the text appears anywhere in the saved file
const contains = (bytes, text) =>
  Buffer.from(bytes).toString('latin1').includes(text);

describe('deleted pages are really gone from the saved file', () => {
  it('leaves out a deleted page', async () => {
    const result = await deletePages(await markedPdf(3), [1]);

    expect(contains(result, 'MARKER-PAGE-2')).toBe(false);
    expect(contains(result, 'MARKER-PAGE-1')).toBe(true);
    expect(contains(result, 'MARKER-PAGE-3')).toBe(true);
  });

  it('leaves it out even when a link on a kept page points at it', async () => {
    const pdf = await markedPdf(3, (doc) => {
      const [first, second] = doc.getPages();
      const link = doc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [0, 0, 50, 50],
        Dest: [second.ref, 'Fit'],
      });
      first.node.addAnnot(doc.context.register(link));
    });

    const result = await deletePages(pdf, [1]);

    expect(contains(result, 'MARKER-PAGE-2')).toBe(false);
  });

  it('leaves it out even when a bookmark points at it', async () => {
    const pdf = await markedPdf(3, (doc) => {
      const second = doc.getPage(1);
      const outlines = doc.context.register(
        doc.context.obj({ Type: 'Outlines' }),
      );
      const item = doc.context.register(
        doc.context.obj({
          Title: PDFString.of('Page 2'),
          Parent: outlines,
          Dest: [second.ref, 'Fit'],
        }),
      );
      const dict = doc.context.lookup(outlines);
      dict.set(PDFName.of('First'), item);
      dict.set(PDFName.of('Last'), item);
      doc.catalog.set(PDFName.of('Outlines'), outlines);
    });

    const result = await deletePages(pdf, [1]);

    expect(contains(result, 'MARKER-PAGE-2')).toBe(false);
  });

  it('removes a form box that was only on a deleted page, and keeps the others', async () => {
    const pdf = await markedPdf(3, (doc) => {
      const form = doc.getForm();
      const kept = form.createTextField('kept');
      kept.setText('stays');
      kept.addToPage(doc.getPage(0), { x: 10, y: 10, width: 100, height: 20 });
      const gone = form.createTextField('gone');
      gone.setText('private');
      gone.addToPage(doc.getPage(1), { x: 10, y: 10, width: 100, height: 20 });
    });

    const result = await deletePages(pdf, [1]);
    const fields = (await PDFDocument.load(result)).getForm().getFields();

    expect(fields.map((field) => field.getName())).toEqual(['kept']);
    expect(contains(result, 'MARKER-PAGE-2')).toBe(false);
  });

  it('falls back to a fresh copy if something unexpected still points at it', async () => {
    // A made-up entry the clean-up doesn't know about, pointing at page 2
    const pdf = await markedPdf(4, (doc) => {
      doc.catalog.set(PDFName.of('Unexpected'), doc.getPage(1).ref);
    });

    const result = await deletePages(pdf, [1]);
    const doc = await PDFDocument.load(result);

    expect(contains(result, 'MARKER-PAGE-2')).toBe(false);
    // The right pages are kept, in order, and the title comes across
    expect(contains(result, 'MARKER-PAGE-1')).toBe(true);
    expect(contains(result, 'MARKER-PAGE-3')).toBe(true);
    expect(contains(result, 'MARKER-PAGE-4')).toBe(true);
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getTitle()).toBe('Generated test file');
  });

  it('keeps the title', async () => {
    const result = await deletePages(await markedPdf(3), [1]);

    expect((await PDFDocument.load(result)).getTitle()).toBe(
      'Generated test file',
    );
  });

  it('makes the file smaller, not just hides the page', async () => {
    const pdf = await markedPdf(20);

    const result = await deletePages(
      pdf,
      [...Array(19).keys()].map((i) => i + 1),
    );

    expect(result.length).toBeLessThan(pdf.length / 2);
  });
});
