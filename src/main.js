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

// The PDFs the user has chosen, in order, as { name, bytes }. The bytes are read
// once when a file is added; edits will replace them. Merging uses this list.
let files = [];

// The file the user wants previewed. Stays put when other files are added or removed.
let previewedFile = null;
// The file whose pages are actually drawn in the grid right now
let drawnFile = null;
// Counts grid renders, so a slow older render can tell it has been replaced
let latestRender = 0;

// Shows a thumbnail of every page of the previewed file
async function renderPageGrid() {
  const file = previewedFile;
  // The grid already shows this file, so skip the redraw
  if (file === drawnFile) return;
  drawnFile = file;

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
    pdfDoc = await openPdfForRendering(file.bytes);
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
  // If the previewed file is gone (or nothing was chosen yet), use the first file
  if (!files.includes(previewedFile)) previewedFile = files[0] ?? null;

  fileList.replaceChildren(
    ...files.map((file) => {
      const item = document.createElement('li');
      if (file === previewedFile) item.classList.add('previewed');

      const name = document.createElement('span');
      // textContent (not innerHTML) so a file name can never be treated as HTML
      name.textContent = file.name;

      const previewButton = document.createElement('button');
      previewButton.type = 'button';
      previewButton.textContent = 'Preview';
      // The file already being previewed has nothing to switch to
      previewButton.disabled = file === previewedFile;
      previewButton.addEventListener('click', () => {
        previewedFile = file;
        renderFileList();
      });

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.textContent = 'Remove';
      removeButton.addEventListener('click', () => {
        // Keep every file except this one, then redraw
        files = files.filter((other) => other !== file);
        renderFileList();
      });

      const actions = document.createElement('div');
      actions.className = 'file-actions';
      actions.append(previewButton, removeButton);
      item.append(name, actions);

      return item;
    }),
  );
  // Merging needs at least two files
  mergeButton.disabled = files.length < 2;
  // An old error is about the old list, so clear it whenever the list changes
  message.textContent = '';
  renderPageGrid();
}

fileInput.addEventListener('change', async () => {
  // fileInput.files is not a real array; Array.from copies it into one
  const picked = Array.from(fileInput.files);
  // Clear the picker, otherwise choosing the same file again would not fire "change"
  fileInput.value = '';

  try {
    // Read every picked file's bytes in parallel, keeping their order
    const added = await Promise.all(
      picked.map(async (file) => ({
        name: file.name,
        bytes: await readFileBytes(file),
      })),
    );
    // Adding to the list (not replacing it) lets the user pick files in several rounds
    files = [...files, ...added];
    renderFileList();
  } catch {
    // No variable after catch, since we don't need the technical details here
    message.textContent = 'A file could not be read from your device.';
  }
});

mergeButton.addEventListener('click', async () => {
  message.textContent = '';
  // A file that can't be previewed won't merge either, so the merge error covers it
  previewError.textContent = '';
  try {
    const pdfs = files.map((file) => file.bytes);
    // The names let the error say which files are bad
    const names = files.map((file) => file.name);
    downloadPdf(await mergePdfs(pdfs, names), 'merged.pdf');
  } catch (error) {
    // Our own functions throw messages written for users, so show them as they are
    message.textContent = error.message;
  }
});
