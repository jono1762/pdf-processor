import { openPdfForRendering, renderPageThumbnail } from '../lib/render.js';
import { rotatePages } from '../lib/rotate.js';
import { deletePages } from '../lib/delete.js';
import { reorderPages } from '../lib/reorder.js';
import Sortable from 'sortablejs';
import { downloadPdf, editedFilename } from './download.js';
import { state } from './state.js';

const pageGrid = document.querySelector('#page-grid');
const selectAllButton = document.querySelector('#select-all-button');
const rotateButton = document.querySelector('#rotate-button');
const deleteButton = document.querySelector('#delete-button');
const downloadButton = document.querySelector('#download-button');
const previewStatus = document.querySelector('#preview-status');
const previewError = document.querySelector('#preview-error');

// Roughly the width of one grid column, so thumbnails are drawn at about their shown size
const THUMBNAIL_WIDTH = 320;

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

  const noSelection =
    editing || !state.previewedFile || selectedPages.size === 0;
  rotateButton.disabled = noSelection;
  // A PDF can't have zero pages, so deleting every page is not allowed
  deleteButton.disabled = noSelection || selectedPages.size === pageCount;
  // Downloading needs a file but no selection; wait for a running edit so we get its result
  downloadButton.disabled = editing || !state.previewedFile;
  // Dragging needs the full grid (the page numbers must match) and no edit running
  sortable.option('disabled', editing || drawing);
}

// Shows a thumbnail of every page of the previewed file.
// `force` redraws even if the file is the same, e.g. after its pages were edited.
export async function renderPageGrid(force = false) {
  const file = state.previewedFile;
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

// Runs an edit on the previewed file, then redraws the grid. `edit` gets the file's
// bytes and the selected page numbers. `verb` is only used in the error message.
// `keepSelection` is for edits that don't change page numbers (rotating); after
// deleting or reordering, the old numbers are wrong.
async function editPreviewedFile(verb, edit, keepSelection) {
  const file = state.previewedFile;
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
  downloadPdf(
    state.previewedFile.bytes,
    editedFilename(state.previewedFile.name),
  );
});

// Lets other modules clear the preview error, e.g. when merging starts
export function clearPreviewError() {
  previewError.textContent = '';
}
