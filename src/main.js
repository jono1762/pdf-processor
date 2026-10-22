import './style.css';
import { mergePdfs } from './lib/merge.js';
import { readFileBytes, downloadPdf } from './download.js';
import { openPdfForRendering, renderPageThumbnail } from './lib/render.js';

const fileInput = document.querySelector('#file-input');
const fileList = document.querySelector('#file-list');
const mergeButton = document.querySelector('#merge-button');
const message = document.querySelector('#message');
const pageGrid = document.querySelector('#page-grid');
const previewStatus = document.querySelector('#preview-status');
const previewError = document.querySelector('#preview-error');

// Roughly the width of one grid column, so thumbnails are drawn at about their shown size
const THUMBNAIL_WIDTH = 320;

// The files the user has chosen, in order. Merging uses this list.
let files = [];

// The file whose pages are currently shown in the grid
let previewedFile = null;
// Counts grid renders, so a slow older render can tell it has been replaced
let latestRender = 0;

// Shows a thumbnail of every page of the first file
async function renderPageGrid() {
  const file = files[0];
  // Removing a later file doesn't change the preview, so skip the redraw
  if (file === previewedFile) return;
  previewedFile = file;

  const thisRender = ++latestRender;
  pageGrid.replaceChildren();
  // The error belongs to the previewed file, so it clears only when that file changes
  previewError.textContent = '';
  if (!file) {
    previewStatus.hidden = true;
    return;
  }

  previewStatus.hidden = false;
  let pdfDoc;
  try {
    pdfDoc = await openPdfForRendering(await readFileBytes(file));
    for (let i = 0; i < pdfDoc.numPages; i++) {
      const canvas = await renderPageThumbnail(pdfDoc, i, THUMBNAIL_WIDTH);
      // The user changed the file list while we were drawing, so stop
      if (thisRender !== latestRender) return;

      const figure = document.createElement('figure');
      const caption = document.createElement('figcaption');
      caption.textContent = `Page ${i + 1}`;
      figure.append(canvas, caption);
      pageGrid.append(figure);
    }
  } catch (error) {
    // Only report errors for the current file, not one the user has moved on from
    if (thisRender === latestRender) {
      previewError.textContent = `Can't preview ${file.name}. ${error.message}`;
    }
  } finally {
    // We only need the document while drawing; this frees its memory in PDF.js
    pdfDoc?.loadingTask.destroy();
    if (thisRender === latestRender) previewStatus.hidden = true;
  }
}

// Rebuilds the visible list from the `files` array
function renderFileList() {
  fileList.replaceChildren(
    ...files.map((file) => {
      const item = document.createElement('li');
      // textContent (not innerHTML) so a file name can never be treated as HTML
      item.textContent = file.name;

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.textContent = 'Remove';
      removeButton.addEventListener('click', () => {
        // Keep every file except this one, then redraw
        files = files.filter((other) => other !== file);
        renderFileList();
      });
      item.append(' ', removeButton);

      return item;
    }),
  );
  // Merging needs at least two files
  mergeButton.disabled = files.length < 2;
  // An old error is about the old list, so clear it whenever the list changes
  message.textContent = '';
  renderPageGrid();
}

fileInput.addEventListener('change', () => {
  // fileInput.files is not a real array; Array.from copies it into one.
  // Adding to the list (not replacing it) lets the user pick files in several rounds.
  files = [...files, ...Array.from(fileInput.files)];
  // Clear the picker, otherwise choosing the same file again would not fire "change"
  fileInput.value = '';
  renderFileList();
});

mergeButton.addEventListener('click', async () => {
  message.textContent = '';
  // A file that can't be previewed won't merge either, so the merge error covers it
  previewError.textContent = '';
  try {
    // Promise.all reads all the files at once and keeps their order
    const pdfs = await Promise.all(files.map(readFileBytes));
    // The names let the error say which files are bad
    const names = files.map((file) => file.name);
    downloadPdf(await mergePdfs(pdfs, names), 'merged.pdf');
  } catch (error) {
    // Our own functions throw messages written for users, so show them as they are
    message.textContent = error.message;
  }
});
