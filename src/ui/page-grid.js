import { openPdfForRendering, renderPageThumbnail } from '../lib/render.js';
import { rotatePages } from '../lib/rotate.js';
import { deletePages } from '../lib/delete.js';
import { extractPages } from '../lib/extract.js';
import { reorderPages } from '../lib/reorder.js';
import Sortable from 'sortablejs';
import { downloadPdf, editedFilename, extractedFilename } from './download.js';
import { state } from './state.js';
import { createSortable } from './sortable.js';

const pageGrid = document.querySelector('#page-grid');
const pageTools = document.querySelector('#page-tools');
const selectionTools = document.querySelector('#selection-tools');
const selectAllButton = document.querySelector('#select-all-button');
const rotateButton = document.querySelector('#rotate-button');
const deleteButton = document.querySelector('#delete-button');
const extractButton = document.querySelector('#extract-button');
const downloadButton = document.querySelector('#download-button');
const previewStatus = document.querySelector('#preview-status');
const previewError = document.querySelector('#preview-error');
const pageHint = document.querySelector('#page-hint');

// Roughly the width of one grid column on a desktop screen, so thumbnails are drawn
// at about their shown size there
const THUMBNAIL_WIDTH = 320;

// The hint shown while no pages are selected. "coarse" means the main pointer is
// imprecise, like a finger, so touch screens get touch instructions.
const PAGE_HINT = window.matchMedia('(pointer: coarse)').matches
  ? 'Tap to select pages to rotate, delete or extract them. Press and hold to drag.'
  : 'Click to select pages to rotate, delete or extract them. Drag to reorder.';

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

// Lets the user drag thumbnails to reorder them. Our job is to make the PDF match
// once a drag ends.
const sortable = createSortable(pageGrid, {
  // Thumbnails fill a phone screen, so a touch must not start a drag straight away
  // or swiping could never scroll the page. On touch, the finger must stay still
  // for 200 milliseconds first. A mouse doesn't scroll by dragging, so it has no wait.
  delay: 200,
  delayOnTouchOnly: true,
  // How many pixels a finger can wobble during the wait before it counts as a swipe
  touchStartThreshold: 5,
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

// Shows only the tools that can be used right now, and a hint saying how to get the
// ones that are hidden. Disabling is only for the moment while an edit is running.
function updatePageTools() {
  // With no file there are no pages to act on, so the tools aren't shown at all
  pageTools.hidden = !state.previewedFile;

  // One button for both jobs: it clears the selection once every page is selected
  const allSelected = pageCount > 0 && selectedPages.size === pageCount;
  selectAllButton.textContent = allSelected ? 'Clear selection' : 'Select all';
  selectAllButton.disabled = editing || pageCount === 0;

  const noSelection = selectedPages.size === 0;
  selectionTools.hidden = noSelection;
  // A PDF can't have zero pages, so deleting every page is not allowed
  deleteButton.hidden = allSelected;

  // These wait for a running edit, so it can't overlap with another one
  rotateButton.disabled = editing;
  deleteButton.disabled = editing;
  extractButton.disabled = editing;
  // Downloading needs a file but no selection; wait for a running edit so we get its result
  downloadButton.disabled = editing || !state.previewedFile;
  // Dragging needs the full grid (the page numbers must match) and no edit running
  sortable.option('disabled', editing || drawing);

  // This line always has something to say once there are pages, so it never
  // disappears and moves the thumbnails while the user is selecting them
  pageHint.hidden = pageCount === 0;
  pageHint.textContent = pageHintText(noSelection, allSelected);
}

// Says how to get any hidden tools, or else how many pages are selected
function pageHintText(noSelection, allSelected) {
  if (noSelection) return PAGE_HINT;
  if (allSelected) {
    return 'Every page is selected. A PDF needs at least one page, so Delete is hidden.';
  }
  const count = selectedPages.size;
  return `${count} ${count === 1 ? 'page' : 'pages'} selected.`;
}

// Shows a thumbnail of every page of the previewed file.
// `force` redraws even if the file is the same, e.g. after its pages were edited.
export async function renderPageGrid(force = false) {
  const file = state.previewedFile;
  // The grid already shows this file, so skip the redraw
  if (file === drawnFile && !force) return;
  // Page numbers belong to one file, so a different file starts with nothing selected.
  // Redrawing the same file keeps its page count, so that with every page selected,
  // rotating doesn't make Delete flash on screen during the redraw.
  if (file !== drawnFile) {
    selectedPages.clear();
    pageCount = 0;
  }
  // Redrawing empties the grid, which would shrink the page and make the browser
  // scroll up. Holding its height keeps the user in place after editing a file.
  // A different file starts from the top, so nothing is held for that.
  pageGrid.style.minHeight =
    file === drawnFile ? `${pageGrid.offsetHeight}px` : '';
  drawnFile = file;
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
      pageCount = 0;
      previewError.textContent = `Can't preview ${file.name}. ${error.message}`;
    }
  } finally {
    // We only need the document while drawing; this frees its memory in PDF.js
    pdfDoc?.loadingTask.destroy();
    if (thisRender === latestRender) {
      // The new pages are in place, so the grid can take its real height again
      pageGrid.style.minHeight = '';
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
    const before = file.bytes;
    const edited = await edit(before, [...selectedPages]);
    // The user reset this file while the edit ran, so this result is out of date
    if (file.bytes !== before) return;
    // Replace the file's bytes with the edited version
    file.bytes = edited;
    if (!keepSelection) selectedPages.clear();
    // The file now has changes to reset, so its row needs a Reset button
    redrawFileList();
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

deleteButton.addEventListener('click', async () => {
  await editPreviewedFile('delete pages from', deletePages, false);
  // Deleting clears the selection, which hides this button. Keyboard focus would be
  // lost with it, so move focus to the nearest button that stays visible.
  // preventScroll stops the browser jumping up to that button.
  selectAllButton.focus({ preventScroll: true });
});

extractButton.addEventListener('click', async () => {
  const file = state.previewedFile;
  editing = true;
  updatePageTools();
  try {
    // A Set has no click order, so sort: the new file keeps the original page order
    const pages = [...selectedPages].sort((a, b) => a - b);
    const bytes = await extractPages(file.bytes, pages);

    // Each file counts its extractions, and the count only goes up. So removing
    // "report-pages-1.pdf" never leads to a second file with the same name.
    file.extractionCount = (file.extractionCount ?? 0) + 1;
    const extracted = {
      name: extractedFilename(file.name, file.extractionCount),
      bytes,
      // Resetting this file goes back to the pages it was created with
      originalBytes: bytes,
      // Remembers the source, so later extractions can be grouped under it
      extractedFrom: file,
      // Its pages are also in the source, so merging everything would repeat them.
      // The user ticks it when they want it merged.
      excludedFromMerge: true,
    };

    // Go under the last extraction from this file, or under the file itself if
    // there are none yet. (If the file was removed meanwhile, go to the end.)
    let last = state.files.indexOf(file);
    state.files.forEach((other, index) => {
      if (other.extractedFrom === file) last = index;
    });
    const insertAt = last === -1 ? state.files.length : last + 1;
    state.files = [
      ...state.files.slice(0, insertAt),
      extracted,
      ...state.files.slice(insertAt),
    ];
    redrawFileList();
  } catch (error) {
    previewError.textContent = `Can't extract pages from ${file.name}. ${error.message}`;
  } finally {
    editing = false;
    updatePageTools();
  }
});

downloadButton.addEventListener('click', () => {
  downloadPdf(
    state.previewedFile.bytes,
    editedFilename(state.previewedFile.name),
  );
});

// Set by file-list.js. It lets the grid ask for the file list to be redrawn without
// importing file-list.js, which already imports this file.
let redrawFileList = () => {};
export function setFileListRedraw(redraw) {
  redrawFileList = redraw;
}

// Puts a file back to what it started as. Its page numbers may change, so if its
// pages are showing, the selection is cleared and they are redrawn.
export function resetFile(file) {
  file.bytes = file.originalBytes;
  if (file === state.previewedFile) {
    selectedPages.clear();
    renderPageGrid(true);
  }
}

// Lets other modules clear the preview error, e.g. when merging starts
export function clearPreviewError() {
  previewError.textContent = '';
}
