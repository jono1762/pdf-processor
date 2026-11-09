import * as pdfjs from 'pdfjs-dist';
// ?url makes Vite include the worker file and give its address, so it's self-hosted
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// Full address of a folder in public/pdfjs (PDF.js needs the trailing slash)
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
    // PDF.js takes over the memory it's given, so pass a copy
    return await pdfjs.getDocument({
      data: bytes.slice(),
      // Extra files PDF.js loads when needed (see scripts/copy-pdfjs-assets.js).
      // Without them, some images and text are silently skipped.
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

// The viewport that draws a page `width` CSS pixels wide. Sharp screens have several
// pixels per CSS pixel (devicePixelRatio). Capped at 2: 3 looks no sharper at this
// size but uses far more memory, which made iPhones reload the page.
function thumbnailViewport(page, width) {
  const pixelWidth = width * Math.min(window.devicePixelRatio, 2);
  // The scale that makes the page `pixelWidth` pixels wide
  const fullSize = page.getViewport({ scale: 1 });
  return page.getViewport({ scale: pixelWidth / fullSize.width });
}

/**
 * A page's thumbnail size in pixels, worked out without drawing it.
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdfDoc - from openPdfForRendering
 * @param {number} pageIndex - zero-based page number
 * @param {number} width - thumbnail width in CSS pixels
 * @returns {Promise<{ width: number, height: number }>}
 */
export async function getThumbnailSize(pdfDoc, pageIndex, width) {
  // PDF.js counts pages from 1
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
  // Without one (e.g. rotating), draw on a new canvas the caller swaps in when done
  if (!canvas) canvas = document.createElement('canvas');

  const page = await pdfDoc.getPage(pageIndex + 1);
  const viewport = thumbnailViewport(page, width);
  const pixelWidth = Math.floor(viewport.width);
  const pixelHeight = Math.floor(viewport.height);
  // Setting the size clears the canvas, so only set it if it differs
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

  await page.render({ canvas, viewport }).promise;
  return canvas;
}
