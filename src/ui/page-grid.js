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

// The width, in CSS pixels, the thumbnails were last drawn at (see columnWidth)
let thumbnailWidth = 320;

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
// True while an edit or a merge is running and the page is locked (see runLocked)
let busy = false;
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
      // SortableJS has already moved the thumbnail, so only the numbers need updating
      renumberPages,
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
  selectAllButton.disabled = busy || pageCount === 0;

  // The tools for selected pages are shown only while there is a selection
  const noSelection = selectedPages.size === 0;
  rotateButton.hidden = noSelection;
  extractButton.hidden = noSelection;
  // A PDF can't have zero pages, so deleting every page is not allowed
  deleteButton.hidden = noSelection || allSelected;
  // A file with no changes has nothing to reset
  resetButton.hidden = !state.previewedFile || !isEdited(state.previewedFile);

  // These wait for a running edit, so it can't overlap with another one, and for the
  // grid to finish drawing, so every thumbnail exists when the grid is updated after
  rotateButton.disabled = busy || drawing;
  deleteButton.disabled = busy || drawing;
  extractButton.disabled = busy || drawing;
  // Downloading needs a file but no selection; wait for a running edit so we get its result
  downloadButton.disabled = busy || !state.previewedFile;
  // Resetting during an edit would race with it
  resetButton.disabled = busy;
  // Dragging needs the full grid (the page numbers must match) and no edit running
  sortable.option('disabled', busy || drawing);

  // This line always has something to say once there are pages, so it never
  // disappears and moves the thumbnails while the user is selecting them
  pageHint.hidden = pageCount === 0;
  pageHint.textContent = pageHintText(noSelection, allSelected);
  // The bar may have grown or shrunk, which moves where the button floats
  placeTopButton();
}

// Says how to get any hidden tools, or else how many pages are selected. While pages
// are drawing, it says so here, in a line that is always there, rather than in a
// separate line that would appear above the grid and push the thumbnails down.
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
  // Redrawing empties the grid until the new thumbnails are added, which would shrink
  // the page and make the browser scroll up. Holding its height until then keeps the
  // user in place after a reset. A different file starts from the top, so nothing is
  // held for that.
  pageGrid.style.minHeight =
    file === drawnFile ? `${pageGrid.offsetHeight}px` : '';
  drawnFile = file;
  updatePageTools();

  const thisRender = ++latestRender;
  pageGrid.replaceChildren();
  // The error belongs to the previewed file, so it clears only when that file changes
  previewError.textContent = '';
  if (!file) {
    drawing = false;
    pageGrid.removeAttribute('aria-busy');
    updatePageTools();
    return;
  }

  drawing = true;
  // Tells screen readers the grid is still being filled in
  pageGrid.setAttribute('aria-busy', 'true');
  updatePageTools();
  let pdfDoc;
  try {
    pdfDoc = await openPdfForRendering(file.bytes);
    // Drawn at the size they're shown, not larger, so long files don't use more
    // memory than they need (a fixed size was about 6 times too big on a phone)
    thumbnailWidth = columnWidth();

    // Every page gets its thumbnail straight away, as a blank page of the right size,
    // and the pictures are drawn into them afterwards. So the grid has its full size
    // from the start and doesn't grow while drawing, any page can be selected at once,
    // and the page doesn't keep changing. (iPhone Safari ignores taps while new
    // content keeps appearing, which made the page unresponsive while drawing.)
    // Working out the sizes reads each page without drawing it, which is quick.
    const sizes = [];
    for (let i = 0; i < pdfDoc.numPages; i++) {
      sizes.push(await getThumbnailSize(pdfDoc, i, thumbnailWidth));
      // The user changed the file list meanwhile, so stop
      if (thisRender !== latestRender) return;
    }
    const canvases = sizes.map((size, i) => addThumbnail(i, size));
    pageCount = pdfDoc.numPages;
    // The grid has its full height again, so it no longer needs holding
    pageGrid.style.minHeight = '';
    updatePageTools();

    for (let i = 0; i < pdfDoc.numPages; i++) {
      await renderPageThumbnail(pdfDoc, i, thumbnailWidth, canvases[i]);
      // The user changed the file list while we were drawing, so stop
      if (thisRender !== latestRender) return;
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
      // Also covers an error before the thumbnails were added
      pageGrid.style.minHeight = '';
      pageGrid.removeAttribute('aria-busy');
      drawing = false;
      updatePageTools();
    }
  }
}

// The width of one grid column now, in CSS pixels. The CSS decides the columns (two
// on phones, three on larger screens), and getComputedStyle reports them as real
// sizes, e.g. "312px 312px 312px". parseFloat reads the first number and stops.
function columnWidth() {
  const width = parseFloat(getComputedStyle(pageGrid).gridTemplateColumns);
  // If the grid isn't laid out yet, there is no real size to read
  return width > 0 ? Math.ceil(width) : 320;
}

// Adds a thumbnail for page `i` to the end of the grid, with a blank canvas of the
// given size for the picture to be drawn into later. Returns that canvas.
function addThumbnail(i, size) {
  // A real button, so pages can be selected with the keyboard as well as the mouse
  const thumb = document.createElement('button');
  thumb.type = 'button';
  thumb.className = 'page-thumb';
  // After a forced redraw, pages that were selected stay selected
  thumb.setAttribute('aria-pressed', String(selectedPages.has(i)));

  // Until it is drawn, the canvas is blank, and the CSS shows it as a white page
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const caption = document.createElement('span');
  caption.textContent = `Page ${i + 1}`;
  thumb.append(canvas, caption);

  thumb.addEventListener('click', () => {
    // Found when clicked, not remembered from now: deleting or dragging pages
    // moves this thumbnail without redrawing it
    const i = pagePosition(thumb);
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
  return canvas;
}

// Thumbnails are in page order, so a thumbnail's position is its page number
function pagePosition(thumb) {
  return [...pageGrid.querySelectorAll('.page-thumb')].indexOf(thumb);
}

// Rewrites each thumbnail's caption and highlight from its position, after pages
// were deleted or moved without being redrawn
function renumberPages() {
  pageGrid.querySelectorAll('.page-thumb').forEach((thumb, i) => {
    thumb.querySelector('span').textContent = `Page ${i + 1}`;
    thumb.setAttribute('aria-pressed', String(selectedPages.has(i)));
  });
}

// Redraws only the given pages of the previewed file, swapping each new picture into
// its existing thumbnail. For edits that change how pages look but not their order
// or count (rotating), so every other thumbnail and its click handler stay correct.
// Much faster than redrawing a long file from scratch, and it doesn't flash.
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

// Runs `task` (an edit or a merge) with the page locked, and returns its result.
// While it runs, the whole page except the bottom bar is inert: clicks, taps, drags,
// drops and the keyboard all pass it by. So nothing can change under it (another
// file previewed, a file removed or reset, a second edit), and it always works on
// the files and the grid it started with. The bar's tools are disabled instead (see
// updatePageTools), so screen readers still announce them as unavailable.
// If the task fails, its error is thrown after the page is unlocked. Callers show it
// then, because screen readers may not announce an alert inside an inert area.
export async function runLocked(task) {
  // Making an element inert, or disabling a button, takes focus away from it. So
  // remember what had focus at the start, and give it back at the end.
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

// Runs an edit on the previewed file, then redraws the grid. `edit` gets the file's
// bytes and the selected page numbers. `verb` is only used in the error message.
// `keepSelection` is for edits that don't change page numbers (rotating); after
// deleting or reordering, the old numbers are wrong. `redraw` updates the grid
// afterwards, and by default redraws every page.
async function editPreviewedFile(
  verb,
  edit,
  keepSelection,
  redraw = () => renderPageGrid(true),
) {
  const file = state.previewedFile;
  try {
    await runLocked(async () => {
      // Replace the file's bytes with the edited version
      file.bytes = await edit(file.bytes, [...selectedPages]);
      if (!keepSelection) selectedPages.clear();
      // The file now has changes to reset, so its row needs a Reset button
      redrawFileList();
      await redraw();
    });
  } catch (error) {
    // The screen may already show a change that didn't happen (a dragged page),
    // so redraw from the real bytes first, then show the error
    await renderPageGrid(true);
    previewError.textContent = `Can't ${verb} ${file.name}. ${error.message}`;
  }
}

selectAllButton.addEventListener('click', () => {
  // Anything less than every page selected means "select all"; otherwise clear
  const selectEverything = selectedPages.size < pageCount;
  selectedPages.clear();
  if (selectEverything) {
    for (let i = 0; i < pageCount; i++) selectedPages.add(i);
  }
  renumberPages();
  updatePageTools();
});

rotateButton.addEventListener('click', () => {
  // Rotating doesn't change page numbers, so only the rotated pages need redrawing
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
      // The other pictures are still right, so just take out the deleted thumbnails
      const thumbs = pageGrid.querySelectorAll('.page-thumb');
      for (const i of pages) thumbs[i].remove();
      pageCount -= pages.length;
      renumberPages();
    },
  );
  // Deleting clears the selection, which hides this button. Keyboard focus would be
  // lost with it, so move focus to the nearest button that stays visible.
  // preventScroll stops the browser jumping up to that button.
  selectAllButton.focus({ preventScroll: true });
});

extractButton.addEventListener('click', async () => {
  const file = state.previewedFile;
  // A Set has no click order, so sort: the new file keeps the original page order
  const pages = [...selectedPages].sort((a, b) => a - b);
  try {
    const bytes = await runLocked(() => extractPages(file.bytes, pages));

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
    // there are none yet
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

// The back-to-top button shows once the page is scrolled more than a screen down.
// It floats just above the bar (see the CSS), until the disclaimer at the end of
// the page scrolls up past that spot. Then it rests on the disclaimer's line, at the
// right, so at the end of the page it lines up with the footer and covers nothing.
function placeTopButton() {
  topButton.hidden = window.scrollY < window.innerHeight;
  if (topButton.hidden) return;
  // Clear any earlier shift first, so we measure where the CSS floats it
  topButton.style.transform = '';
  const floating = topButton.getBoundingClientRect();
  const line = disclaimer.getBoundingClientRect();
  // Where the button's top would be with its middle on the disclaimer's middle
  const onLine = (line.top + line.bottom) / 2 - floating.height / 2;
  // Only ever move it up, so it can never drop onto the bar
  const shift = Math.max(0, floating.top - onLine);
  if (shift > 0) topButton.style.transform = `translateY(-${shift}px)`;
}

// passive: true promises the browser these listeners never block scrolling, so
// scrolling stays smooth
window.addEventListener('scroll', placeTopButton, { passive: true });
window.addEventListener('resize', placeTopButton, { passive: true });

topButton.addEventListener('click', () => {
  // Smooth, unless the user has asked their device for less motion
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' });
  // This button hides at the top, so give keyboard focus to the first control there.
  // preventScroll stops it fighting the smooth scroll.
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
  // The file list's Reset all button depends on how many files have changes
  redrawFileList();
  // Resetting hides this button, and keyboard focus would be lost with it
  selectAllButton.focus({ preventScroll: true });
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
