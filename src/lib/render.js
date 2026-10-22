import * as pdfjs from 'pdfjs-dist';
// ?url makes Vite bundle the worker file with our app and give us its address,
// so it is served from our own site instead of a CDN
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Opens a PDF for rendering. Open it once, then render as many pages as needed.
 * @param {Uint8Array} bytes - the PDF as bytes
 * @returns {Promise<import('pdfjs-dist').PDFDocumentProxy>}
 * @throws {Error} if the file is corrupted, encrypted or not a PDF
 */
export async function openPdfForRendering(bytes) {
  try {
    // PDF.js takes over the memory it is given, which would empty `bytes` for
    // everyone else. Passing a copy (slice) keeps the original usable for merging.
    return await pdfjs.getDocument({ data: bytes.slice() }).promise;
  } catch (error) {
    throw new Error(
      'The file could not be read. It may be corrupted or encrypted.',
      { cause: error },
    );
  }
}

/**
 * Draws one page onto a new canvas, scaled to the given width.
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdfDoc - from openPdfForRendering
 * @param {number} pageIndex - zero-based page number
 * @param {number} width - thumbnail width in CSS pixels
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderPageThumbnail(pdfDoc, pageIndex, width) {
  // PDF.js counts pages from 1, unlike the rest of our code
  const page = await pdfDoc.getPage(pageIndex + 1);

  // High-resolution screens pack several real pixels into one CSS pixel
  // (devicePixelRatio is 2 on many laptops and phones). Drawing that many
  // pixels keeps the thumbnail sharp when CSS sets the displayed size.
  const pixelWidth = width * window.devicePixelRatio;

  // Work out the scale that makes the page exactly `pixelWidth` pixels wide
  const fullSize = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: pixelWidth / fullSize.width });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({ canvas, viewport }).promise;
  return canvas;
}
