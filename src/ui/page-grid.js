import {
  openPdfForRendering,
  getThumbnailSize,
  renderPageThumbnail,
} from '../lib/render.js';
import { rotatePages } from '../lib/rotate.js';
import { deletePages } from '../lib/delete.js';
import { extractPages } from '../lib/extract.js';
import { reorderPages } from '../lib/reorder.js';
import Sortable from 'sortablejs';
import {
  downloadPdf,
  downloadFilename,
  extractedFilename,
} from './download.js';
import { state, isEdited } from './state.js';
import { confirmAction, LOST_CHANGES_WARNING } from './confirm.js';
import { createSortable } from './sortable.js';

const pageGrid = document.querySelector('#page-grid');
const pageTools = document.querySelector('#page-tools');
const selectAllButton = document.querySelector('#select-all-button');
const rotateButton = document.querySelector('#rotate-button');
const deleteButton = document.querySelector('#delete-button');
const extractButton = document.querySelector('#extract-button');
const resetButton = document.querySelector('#reset-button');
const topButton = document.querySelector('#top-button');
const fileButton = document.querySelector('#file-button');
const disclaimer = document.querySelector('footer p');
const downloadButton = document.querySelector('#download-button');
const previewError = document.querySelector('#preview-error');
const pageHint = document.querySelector('#page-hint');
const main = document.querySelector('main');

// Width the thumbnails were last drawn at, in CSS pixels
let thumbnailWidth = 320;

// Hint when nothing is selected. "coarse" means a finger, so touch gets touch wording.
const PAGE_HINT = window.matchMedia('(pointer: coarse)').matches
  ? 'Tap to select pages to rotate, delete or extract them. Press and hold to drag.'
  : 'Click to select pages to rotate, delete or extract them. Drag to reorder.';

// The file whose pages are in the grid
let drawnFile = null;
// Counts drawings, so an older one can tell it has been replaced
let latestRender = 0;
// Selected page numbers, from 0
const selectedPages = new Set();
// True while the page is locked for an edit or merge
let busy = false;
// Pages in the drawn file; 0 until opened
let pageCount = 0;
// True while thumbnails are being drawn
let drawing = false;

// Dragging thumbnails reorders pages. SortableJS moves them; we update the PDF.
const sortable = createSortable(pageGrid, {
  // On touch, hold for 200 ms before dragging, so swiping still scrolls
  delay: 200,
  delayOnTouchOnly: true,
  // Pixels a finger can move during the hold before it counts as a swipe
  touchStartThreshold: 5,
  onStart({ item }) {
    // The dragged copy's canvas starts blank, so draw the thumbnail onto it
    const ghostCanvas = Sortable.ghost?.querySelector('canvas');
    ghostCanvas?.getContext('2d').drawImage(item.querySelector('canvas'), 0, 0);
  },
  onEnd({ oldIndex, newIndex }) {
    if (oldIndex === newIndex) return;

    // Build [0, 1, 2, ...], then move the dragged page to where it was dropped
    const order = Array.from({ length: pageCount }, (_, i) => i);
    const [moved] = order.splice(oldIndex, 1);
    order.splice(newIndex, 0, moved);

    editPreviewedFile(
      'reorder pages in',
      (bytes) => reorderPages(bytes, order),
      false,
      // The thumbnail has already moved; just renumber
      renumberPages,
    );
  },
});

// Shows the tools that can be used now, and a hint about the hidden ones
function updatePageTools() {
  // No file, no tools
  pageTools.hidden = !state.previewedFile;

  // Becomes "Clear selection" once every page is selected
  const allSelected = pageCount > 0 && selectedPages.size === pageCount;
  selectAllButton.textContent = allSelected ? 'Clear selection' : 'Select all';
  selectAllButton.disabled = busy || pageCount === 0;

  // These need a selection
  const noSelection = selectedPages.size === 0;
  rotateButton.hidden = noSelection;
  extractButton.hidden = noSelection;
  // A PDF needs at least one page
  deleteButton.hidden = noSelection || allSelected;
  // Only edited files can be reset
  resetButton.hidden = !state.previewedFile || !isEdited(state.previewedFile);

  // Edits wait for a running edit, and for drawing to finish
  rotateButton.disabled = busy || drawing;
  deleteButton.disabled = busy || drawing;
  extractButton.disabled = busy || drawing;
  // Wait for a running edit, so the download includes it
  downloadButton.disabled = busy || !state.previewedFile;
  // Resetting mid-edit would clash with it
  resetButton.disabled = busy;
  // Dragging needs the full grid and no edit running
  sortable.option('disabled', busy || drawing);

  // Always shown once there are pages, so the grid never moves
  pageHint.hidden = pageCount === 0;
  pageHint.textContent = pageHintText(noSelection, allSelected);
  // The bar's height may have changed
  placeTopButton();
}

// The hint text: drawing progress, how to get hidden tools, or the selected count.
// Drawing is shown here so no extra line appears above the grid and moves it.
function pageHintText(noSelection, allSelected) {
  if (drawing) {
    const count = selectedPages.size;
    return noSelection
      ? 'Drawing pages… You can select pages now, and edit them once all are drawn.'
      : `Drawing pages… ${count} selected. You can edit them once all are drawn.`;
  }
  if (noSelection) return PAGE_HINT;
  if (allSelected) {
    return 'Every page is selected. A PDF needs at least one page, so Delete is hidden.';
  }
  const count = selectedPages.size;
  return `${count} ${count === 1 ? 'page' : 'pages'} selected.`;
}

// Draws a thumbnail of every page of the previewed file.
// `force` redraws the same file, e.g. after a reset.
export async function renderPageGrid(force = false) {
  const file = state.previewedFile;
  // Already showing this file
  if (file === drawnFile && !force) return;
  // A different file starts with nothing selected
  if (file !== drawnFile) {
    selectedPages.clear();
    pageCount = 0;
  }
  // Hold the grid's height while it's empty, so a redraw doesn't scroll the page up
  pageGrid.style.minHeight =
    file === drawnFile ? `${pageGrid.offsetHeight}px` : '';
  drawnFile = file;
  updatePageTools();

  const thisRender = ++latestRender;
  pageGrid.replaceChildren();
  // Clear the old error. A failed edit sets its error after this redraw.
  previewError.textContent = '';
  if (!file) {
    drawing = false;
    pageGrid.removeAttribute('aria-busy');
    updatePageTools();
    return;
  }

  drawing = true;
  // Tells screen readers the grid is still loading
  pageGrid.setAttribute('aria-busy', 'true');
  updatePageTools();
  let pdfDoc;
  try {
    pdfDoc = await openPdfForRendering(file.bytes);
    // Draw at the shown size, to save memory
    thumbnailWidth = columnWidth();

    // Add a blank thumbnail of the right size for every page first, then draw into
    // them. The grid never grows, so nothing moves, and iPhone Safari keeps
    // responding to taps (it ignores them while new content keeps appearing).
    const sizes = [];
    for (let i = 0; i < pdfDoc.numPages; i++) {
      sizes.push(await getThumbnailSize(pdfDoc, i, thumbnailWidth));
      // A newer drawing started, so stop
      if (thisRender !== latestRender) return;
    }
    const canvases = sizes.map((size, i) => addThumbnail(i, size));
    pageCount = pdfDoc.numPages;
    // The grid is full height again
    pageGrid.style.minHeight = '';
    updatePageTools();

    for (let i = 0; i < pdfDoc.numPages; i++) {
      await renderPageThumbnail(pdfDoc, i, thumbnailWidth, canvases[i]);
      // A newer drawing started, so stop
      if (thisRender !== latestRender) return;
    }
  } catch (error) {
    // Only report errors for the current drawing
    if (thisRender === latestRender) {
      pageCount = 0;
      previewError.textContent = `Can't preview ${file.name}. ${error.message}`;
    }
  } finally {
    // Free PDF.js's memory
    pdfDoc?.loadingTask.destroy();
    if (thisRender === latestRender) {
      // In case of an error before the thumbnails were added
      pageGrid.style.minHeight = '';
      pageGrid.removeAttribute('aria-busy');
      drawing = false;
      updatePageTools();
    }
  }
}

// One grid column's width in CSS pixels. getComputedStyle gives e.g.
// "312px 312px 312px", and parseFloat reads the first number.
function columnWidth() {
  const width = parseFloat(getComputedStyle(pageGrid).gridTemplateColumns);
  // Not laid out yet
  return width > 0 ? Math.ceil(width) : 320;
}

// Adds a blank thumbnail for page `i` and returns its canvas, to draw into later
function addThumbnail(i, size) {
  // A button, so it works with the keyboard
  const thumb = document.createElement('button');
  thumb.type = 'button';
  thumb.className = 'page-thumb';
  // Keep the selection after a redraw
  thumb.setAttribute('aria-pressed', String(selectedPages.has(i)));

  // Blank until drawn; the CSS shows it as a white page
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const caption = document.createElement('span');
  caption.textContent = `Page ${i + 1}`;
  thumb.append(canvas, caption);

  thumb.addEventListener('click', () => {
    // Looked up on click, since deleting or dragging moves thumbnails
    const i = pagePosition(thumb);
    // Toggle
    if (selectedPages.has(i)) {
      selectedPages.delete(i);
    } else {
      selectedPages.add(i);
    }
    // aria-pressed is for screen readers and the CSS highlight
    thumb.setAttribute('aria-pressed', String(selectedPages.has(i)));
    updatePageTools();
  });
  pageGrid.append(thumb);
  return canvas;
}

// A thumbnail's position is its page number
function pagePosition(thumb) {
  return [...pageGrid.querySelectorAll('.page-thumb')].indexOf(thumb);
}

// Updates captions and highlights after pages were deleted or moved
function renumberPages() {
  pageGrid.querySelectorAll('.page-thumb').forEach((thumb, i) => {
    thumb.querySelector('span').textContent = `Page ${i + 1}`;
    thumb.setAttribute('aria-pressed', String(selectedPages.has(i)));
  });
}

// Redraws only the given pages, e.g. after a rotate. Much faster than redrawing all.
async function redrawPages(pages) {
  let pdfDoc;
  try {
    pdfDoc = await openPdfForRendering(state.previewedFile.bytes);
    const thumbs = pageGrid.querySelectorAll('.page-thumb');
    for (const i of pages) {
      const canvas = await renderPageThumbnail(pdfDoc, i, thumbnailWidth);
      thumbs[i].querySelector('canvas').replaceWith(canvas);
    }
  } finally {
    pdfDoc?.loadingTask.destroy();
  }
}

// Runs `task` (an edit or merge) with the page locked, and returns its result.
// Everything but the bottom bar is inert, so nothing can change mid-task. The bar
// is disabled instead, so screen readers still announce it. Errors are thrown after
// unlocking, since screen readers may not announce an alert in an inert area.
export async function runLocked(task) {
  // Locking takes focus away, so restore it afterwards
  const focused = document.activeElement;
  setLocked(true);
  try {
    return await task();
  } finally {
    setLocked(false);
    if (focused?.isConnected) focused.focus({ preventScroll: true });
  }
}

function setLocked(value) {
  busy = value;
  for (const element of main.children) {
    if (element !== pageTools) element.inert = value;
  }
  updatePageTools();
}

// Edits the previewed file, then updates the grid.
// `edit(bytes, pages)` returns new bytes. `verb` is for the error message.
// `keepSelection` is for edits that keep page numbers (rotating).
// `redraw` updates the grid; by default it redraws every page.
async function editPreviewedFile(
  verb,
  edit,
  keepSelection,
  redraw = () => renderPageGrid(true),
) {
  const file = state.previewedFile;
  try {
    await runLocked(async () => {
      // Swap in the edited version
      file.bytes = await edit(file.bytes, [...selectedPages]);
      if (!keepSelection) selectedPages.clear();
      // Reset all depends on which files are edited
      redrawFileList();
      await redraw();
    });
  } catch (error) {
    // The screen may show a change that failed (a dragged page), so redraw first
    await renderPageGrid(true);
    previewError.textContent = `Can't ${verb} ${file.name}. ${error.message}`;
  }
}

selectAllButton.addEventListener('click', () => {
  // Select all, or clear if everything is already selected
  const selectEverything = selectedPages.size < pageCount;
  selectedPages.clear();
  if (selectEverything) {
    for (let i = 0; i < pageCount; i++) selectedPages.add(i);
  }
  renumberPages();
  updatePageTools();
});

rotateButton.addEventListener('click', () => {
  // Only the rotated pages need redrawing
  const pages = [...selectedPages];
  editPreviewedFile(
    'rotate',
    (bytes) => rotatePages(bytes, pages, 90),
    true,
    () => redrawPages(pages),
  );
});

deleteButton.addEventListener('click', async () => {
  const pages = [...selectedPages];
  await editPreviewedFile(
    'delete pages from',
    (bytes) => deletePages(bytes, pages),
    false,
    () => {
      // Just remove the deleted thumbnails
      const thumbs = pageGrid.querySelectorAll('.page-thumb');
      for (const i of pages) thumbs[i].remove();
      pageCount -= pages.length;
      renumberPages();
    },
  );
  // This button is now hidden, so move focus. preventScroll stops a jump.
  selectAllButton.focus({ preventScroll: true });
});

extractButton.addEventListener('click', async () => {
  const file = state.previewedFile;
  // Keep the original page order
  const pages = [...selectedPages].sort((a, b) => a - b);
  try {
    const bytes = await runLocked(() => extractPages(file.bytes, pages));

    // The count only goes up, so names are never reused
    file.extractionCount = (file.extractionCount ?? 0) + 1;
    const extracted = {
      name: extractedFilename(file.name, file.extractionCount),
      bytes,
      // Resetting goes back to these pages
      originalBytes: bytes,
      // For grouping under the source in the list
      extractedFrom: file,
      // Unticked, since merging it too would repeat pages
      excludedFromMerge: true,
    };

    // Place it after the source and its earlier extractions
    let last = state.files.indexOf(file);
    state.files.forEach((other, index) => {
      if (other.extractedFrom === file) last = index;
    });
    const insertAt = last + 1;
    state.files = [
      ...state.files.slice(0, insertAt),
      extracted,
      ...state.files.slice(insertAt),
    ];
    redrawFileList();
  } catch (error) {
    previewError.textContent = `Can't extract pages from ${file.name}. ${error.message}`;
  }
});

// Shows the back-to-top button after a screen of scrolling. It floats above the bar,
// and at the end of the page rests on the disclaimer's line instead.
function placeTopButton() {
  topButton.hidden = window.scrollY < window.innerHeight;
  if (topButton.hidden) return;
  // Measure where the CSS puts it, without the old shift
  topButton.style.transform = '';
  const floating = topButton.getBoundingClientRect();
  const line = disclaimer.getBoundingClientRect();
  // Its top if centred on the disclaimer
  const onLine = (line.top + line.bottom) / 2 - floating.height / 2;
  // Only move it up, never onto the bar
  const shift = Math.max(0, floating.top - onLine);
  if (shift > 0) topButton.style.transform = `translateY(-${shift}px)`;
}

// passive: these never block scrolling, so it stays smooth
window.addEventListener('scroll', placeTopButton, { passive: true });
window.addEventListener('resize', placeTopButton, { passive: true });

topButton.addEventListener('click', () => {
  // Smooth, unless the device asks for less motion
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' });
  // This button hides at the top, so move focus there
  fileButton.focus({ preventScroll: true });
});

downloadButton.addEventListener('click', () => {
  downloadPdf(state.previewedFile.bytes, downloadFilename(state.previewedFile));
});

resetButton.addEventListener('click', async () => {
  const file = state.previewedFile;
  const confirmed = await confirmAction(
    `Reset ${file.name} to its original? ${LOST_CHANGES_WARNING}`,
    'Reset',
  );
  if (!confirmed) return;
  resetFile(file);
  // Reset all depends on which files are edited
  redrawFileList();
  // This button is now hidden, so move focus
  selectAllButton.focus({ preventScroll: true });
});

// Set by file-list.js, so the grid can redraw the list without a circular import
let redrawFileList = () => {};
export function setFileListRedraw(redraw) {
  redrawFileList = redraw;
}

// Puts a file back to how it started, redrawing it if it's showing
export function resetFile(file) {
  file.bytes = file.originalBytes;
  if (file === state.previewedFile) {
    selectedPages.clear();
    renderPageGrid(true);
  }
}

// Lets other modules clear the preview error
export function clearPreviewError() {
  previewError.textContent = '';
}
