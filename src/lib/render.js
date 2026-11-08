import * as pdfjs from 'pdfjs-dist';
// ?url makes Vite bundle the worker file with our app and give us its address,
// so it is served from our own site instead of a CDN
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// The full address of a folder in public/pdfjs. PDF.js needs the trailing slash.
function pdfjsFolder(name) {
  return new URL(`pdfjs/${name}/`, document.baseURI).href;
}

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
    return await pdfjs.getDocument({
      data: bytes.slice(),
      // Folders of files PDF.js loads only when a PDF needs them (copied there by
      // scripts/copy-pdfjs-assets.js). Without them, the images or text that need
      // them are skipped with no error. They must be full addresses, as the
      // worker runs from a different folder.
      wasmUrl: pdfjsFolder('wasm'),
      standardFontDataUrl: pdfjsFolder('standard_fonts'),
      cMapUrl: pdfjsFolder('cmaps'),
    }).promise;
  } catch (error) {
    throw new Error(
      'The file could not be read. It may be corrupted or encrypted.',
      { cause: error },
    );
  }
}

// The viewport that draws a page exactly `width` CSS pixels wide.
// High-resolution screens pack several real pixels into one CSS pixel
// (devicePixelRatio is 2 on many laptops and phones). Drawing that many pixels
// keeps the thumbnail sharp when CSS sets the displayed size.
function thumbnailViewport(page, width) {
  const pixelWidth = width * window.devicePixelRatio;
  // Work out the scale that makes the page exactly `pixelWidth` pixels wide
  const fullSize = page.getViewport({ scale: 1 });
  return page.getViewport({ scale: pixelWidth / fullSize.width });
}

/**
 * Works out the size in pixels of a page's thumbnail, without drawing it. Fast,
 * so the grid can lay out every page before any is drawn.
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdfDoc - from openPdfForRendering
 * @param {number} pageIndex - zero-based page number
 * @param {number} width - thumbnail width in CSS pixels
 * @returns {Promise<{ width: number, height: number }>}
 */
export async function getThumbnailSize(pdfDoc, pageIndex, width) {
  // PDF.js counts pages from 1, unlike the rest of our code
  const page = await pdfDoc.getPage(pageIndex + 1);
  const viewport = thumbnailViewport(page, width);
  return {
    width: Math.floor(viewport.width),
    height: Math.floor(viewport.height),
  };
}

/**
 * Draws one page onto a canvas, scaled to the given width.
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdfDoc - from openPdfForRendering
 * @param {number} pageIndex - zero-based page number
 * @param {number} width - thumbnail width in CSS pixels
 * @param {HTMLCanvasElement} [canvas] - a canvas already on the page to draw into;
 *   a new one is made if none is given
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderPageThumbnail(pdfDoc, pageIndex, width, canvas) {
  // No canvas given (e.g. when rotating): draw into a new one, which the caller
  // swaps in once it is finished, so the thumbnail is never blank meanwhile
  if (!canvas) canvas = document.createElement('canvas');

  const page = await pdfDoc.getPage(pageIndex + 1);
  const viewport = thumbnailViewport(page, width);
  const pixelWidth = Math.floor(viewport.width);
  const pixelHeight = Math.floor(viewport.height);
  // Setting a canvas's size clears it and changes the page, even to the same size,
  // so only set it when it is different
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

  await page.render({ canvas, viewport }).promise;
  return canvas;
}
