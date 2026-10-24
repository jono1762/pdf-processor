import './style.css';
import { mergePdfs } from './lib/merge.js';
import { readFileBytes, downloadPdf, editedFilename } from './ui/download.js';
import { openPdfForRendering, renderPageThumbnail } from './lib/render.js';
import { rotatePages } from './lib/rotate.js';
import { deletePages } from './lib/delete.js';
import { reorderPages } from './lib/reorder.js';
import Sortable from 'sortablejs';

const fileInput = document.querySelector('#file-input');
const fileList = document.querySelector('#file-list');
const mergeButton = document.querySelector('#merge-button');
const message = document.querySelector('#message');
const pageGrid = document.querySelector('#page-grid');
const selectAllButton = document.querySelector('#select-all-button');
const rotateButton = document.querySelector('#rotate-button');
const deleteButton = document.querySelector('#delete-button');
const downloadButton = document.querySelector('#download-button');
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
// Zero-based numbers of the pages the user has selected in the grid
const selectedPages = new Set();
// True while a page edit is running, so a second click can't start before it ends
let editing = false;
// How many pages the drawn file has; 0 until it has been opened
let pageCount = 0;
// True while the thumbnails are still being drawn
let drawing = false;

// Lets the user drag thumbnails to reorder them. SortableJS moves the elements on
// screen; our job is to make the PDF match once a drag ends.
const sortable = Sortable.create(pageGrid, {
  animation: 150,
  // The browser's own drag support doesn't work on <button> elements in Firefox,
  // so SortableJS does the dragging itself
  forceFallback: true,
  // Moving less than this many pixels counts as a click, so selecting still works
  fallbackTolerance: 5,
  onStart({ item }) {
    // The floating copy under the pointer is made with cloneNode, which copies a
    // canvas element but not what is drawn on it. Draw the thumbnail onto the copy.
    const ghostCanvas = Sortable.ghost?.querySelector('canvas');
    ghostCanvas?.getContext('2d').drawImage(item.querySelector('canvas'), 0, 0);
  },
  onEnd({ oldIndex, newIndex }) {
    if (oldIndex === newIndex) return;

    // Start from [0, 1, 2, ...], then take the dragged page out and put it where it
    // was dropped. Array.from with a length builds that list of page numbers.
    const order = Array.from({ length: pageCount }, (_, i) => i);
    const [moved] = order.splice(oldIndex, 1);
    order.splice(newIndex, 0, moved);

    editPreviewedFile(
      'reorder pages in',
      (bytes) => reorderPages(bytes, order),
      false,
    );
  },
});

// Page tools only make sense with a previewed file, selected pages and no edit running
function updatePageTools() {
  // One button for both jobs: it clears the selection once every page is selected
  const allSelected = pageCount > 0 && selectedPages.size === pageCount;
  selectAllButton.textContent = allSelected ? 'Clear selection' : 'Select all';
  selectAllButton.disabled = editing || pageCount === 0;

  const noSelection = editing || !previewedFile || selectedPages.size === 0;
  rotateButton.disabled = noSelection;
  // A PDF can't have zero pages, so deleting every page is not allowed
  deleteButton.disabled = noSelection || selectedPages.size === pageCount;
  // Downloading needs a file but no selection; wait for a running edit so we get its result
  downloadButton.disabled = editing || !previewedFile;
  // Dragging needs the full grid (the page numbers must match) and no edit running
  sortable.option('disabled', editing || drawing);
}

// Shows a thumbnail of every page of the previewed file.
// `force` redraws even if the file is the same, e.g. after its pages were edited.
async function renderPageGrid(force = false) {
  const file = previewedFile;
  // The grid already shows this file, so skip the redraw
  if (file === drawnFile && !force) return;
  // Page numbers belong to one file, so a different file starts with nothing selected
  if (file !== drawnFile) selectedPages.clear();
  drawnFile = file;
  pageCount = 0;
  updatePageTools();

  const thisRender = ++latestRender;
  pageGrid.replaceChildren();
  // The error belongs to the previewed file, so it clears only when that file changes
  previewError.textContent = '';
  if (!file) {
    previewStatus.hidden = true;
    drawing = false;
    updatePageTools();
    return;
  }

  previewStatus.hidden = false;
  drawing = true;
  updatePageTools();
  let pdfDoc;
  try {
    pdfDoc = await openPdfForRendering(file.bytes);
    pageCount = pdfDoc.numPages;
    updatePageTools();
    for (let i = 0; i < pdfDoc.numPages; i++) {
      const canvas = await renderPageThumbnail(pdfDoc, i, THUMBNAIL_WIDTH);
      // The user changed the file list while we were drawing, so stop
      if (thisRender !== latestRender) return;

      // A real button, so pages can be selected with the keyboard as well as the mouse
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'page-thumb';
      // After a forced redraw, pages that were selected stay selected
      thumb.setAttribute('aria-pressed', String(selectedPages.has(i)));

      const caption = document.createElement('span');
      caption.textContent = `Page ${i + 1}`;
      thumb.append(canvas, caption);

      thumb.addEventListener('click', () => {
        // Selected pages: click once to add, click again to remove
        if (selectedPages.has(i)) {
          selectedPages.delete(i);
        } else {
          selectedPages.add(i);
        }
        // aria-pressed tells screen readers the state; the CSS uses it for the highlight
        thumb.setAttribute('aria-pressed', String(selectedPages.has(i)));
        updatePageTools();
      });
      pageGrid.append(thumb);
    }
  } catch (error) {
    // Only report errors for the current file, not one the user has moved on from
    if (thisRender === latestRender) {
      previewError.textContent = `Can't preview ${file.name}. ${error.message}`;
    }
  } finally {
    // We only need the document while drawing; this frees its memory in PDF.js
    pdfDoc?.loadingTask.destroy();
    if (thisRender === latestRender) {
      previewStatus.hidden = true;
      drawing = false;
      updatePageTools();
    }
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

// Runs an edit on the previewed file, then redraws the grid. `edit` gets the file's
// bytes and the selected page numbers. `verb` is only used in the error message.
// `keepSelection` is for edits that don't change page numbers (rotating); after
// deleting or reordering, the old numbers are wrong.
async function editPreviewedFile(verb, edit, keepSelection) {
  const file = previewedFile;
  editing = true;
  updatePageTools();
  try {
    // Replace the file's bytes with the edited version
    file.bytes = await edit(file.bytes, [...selectedPages]);
    if (!keepSelection) selectedPages.clear();
    await renderPageGrid(true);
  } catch (error) {
    // The screen may already show a change that didn't happen (a dragged page),
    // so redraw from the real bytes first, then show the error
    await renderPageGrid(true);
    previewError.textContent = `Can't ${verb} ${file.name}. ${error.message}`;
  } finally {
    editing = false;
    updatePageTools();
  }
}

selectAllButton.addEventListener('click', () => {
  // Anything less than every page selected means "select all"; otherwise clear
  const selectEverything = selectedPages.size < pageCount;
  selectedPages.clear();
  if (selectEverything) {
    for (let i = 0; i < pageCount; i++) selectedPages.add(i);
  }
  // Thumbnails are in page order, so a thumbnail's position in the list is its page number
  pageGrid.querySelectorAll('.page-thumb').forEach((thumb, i) => {
    thumb.setAttribute('aria-pressed', String(selectedPages.has(i)));
  });
  updatePageTools();
});

rotateButton.addEventListener('click', () => {
  editPreviewedFile(
    'rotate',
    (bytes, pages) => rotatePages(bytes, pages, 90),
    true,
  );
});

deleteButton.addEventListener('click', () => {
  editPreviewedFile('delete pages from', deletePages, false);
});

downloadButton.addEventListener('click', () => {
  downloadPdf(previewedFile.bytes, editedFilename(previewedFile.name));
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
