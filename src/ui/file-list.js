import { mergePdfs } from '../lib/merge.js';
import {
  createMultiPageSample,
  createSidewaysSample,
  createLargeSample,
} from '../lib/samples.js';
import {
  readFileBytes,
  downloadPdf,
  isPdfFile,
  isTooLarge,
  MAX_FILE_BYTES,
} from './download.js';
import { state, isEdited } from './state.js';
import { createSortable } from './sortable.js';
import { confirmAction } from './confirm.js';
import {
  renderPageGrid,
  resetFile,
  clearPreviewError,
  setFileListRedraw,
  runLocked,
} from './page-grid.js';

const fileInput = document.querySelector('#file-input');
const fileButton = document.querySelector('#file-button');
const dropArea = document.querySelector('#drop-area');
const fileList = document.querySelector('#file-list');
const mergeButton = document.querySelector('#merge-button');
const mergeHint = document.querySelector('#merge-hint');
const message = document.querySelector('#message');
const sampleButtons = document.querySelector('#sample-buttons');
const listHeader = document.querySelector('#list-header');
const resetAllButton = document.querySelector('#reset-all-button');
const removeAllButton = document.querySelector('#remove-all-button');

// The "Try a sample" buttons: what each says, what its file is called, how to make it
const SAMPLES = [
  {
    label: 'Multi-page',
    filename: 'sample-document.pdf',
    create: createMultiPageSample,
  },
  {
    label: 'Sideways',
    filename: 'sample-sideways-page.pdf',
    create: createSidewaysSample,
  },
  {
    label: '300 pages',
    filename: 'sample-large.pdf',
    create: createLargeSample,
  },
];

// Edits only exist in this page's memory, so removing or resetting a file loses them
const LOST_CHANGES_WARNING = "Any changes you haven't downloaded will be lost.";

// The files that Merge will use: every file except those the user has unticked
function filesToMerge() {
  return state.files.filter((file) => !file.excludedFromMerge);
}

// Says on the Merge button how many files it will merge, and hides it if that's
// fewer than two
function updateMergeButton() {
  const total = state.files.length;
  const count = filesToMerge().length;
  mergeButton.hidden = count < 2;

  // While Merge is hidden, say how to get it. With no files there's no hint, because
  // the drop area already says what to do first.
  mergeHint.hidden = total === 0 || count >= 2;
  mergeHint.textContent =
    total === 1
      ? 'Add another PDF to merge them.'
      : 'Tick at least two files to merge them.';

  if (count === total) {
    mergeButton.textContent = `Merge ${count} files`;
  } else {
    mergeButton.textContent = `Merge ${count} of ${total} files`;
  }
}

// Rebuilds the visible list from `state.files`
function renderFileList() {
  // If the previewed file is gone (or nothing was chosen yet), use the first file
  if (!state.files.includes(state.previewedFile))
    state.previewedFile = state.files[0] ?? null;

  fileList.replaceChildren(
    ...state.files.map((file) => {
      const item = document.createElement('li');
      if (file === state.previewedFile) item.classList.add('previewed');

      // Dragging starts from this handle only, so it never clashes with the buttons
      const handle = document.createElement('span');
      handle.className = 'drag-handle';
      handle.textContent = '⠿';
      handle.title = 'Drag to change the merge order';

      // Ticked files are merged. The label is for screen readers; sighted users see
      // the file name next to the box.
      const include = document.createElement('input');
      include.type = 'checkbox';
      include.checked = !file.excludedFromMerge;
      include.setAttribute('aria-label', `Include ${file.name} in merge`);
      include.addEventListener('change', () => {
        file.excludedFromMerge = !include.checked;
        // Only the button changes. Redrawing the whole list would rebuild this
        // checkbox and lose keyboard focus.
        updateMergeButton();
        // An old merge error was about the old choice of files
        message.textContent = '';
      });

      const name = document.createElement('span');
      name.className = 'file-name';
      // textContent (not innerHTML) so a file name can never be treated as HTML
      name.textContent = file.name;

      const resetButton = document.createElement('button');
      resetButton.type = 'button';
      resetButton.className = 'danger';
      resetButton.textContent = 'Reset';
      // A file with no changes has nothing to reset
      resetButton.hidden = !isEdited(file);
      resetButton.addEventListener('click', async () => {
        const confirmed = await confirmAction(
          `Reset ${file.name} to its original? ${LOST_CHANGES_WARNING}`,
          'Reset',
        );
        if (!confirmed) return;
        resetFile(file);
        renderFileList();
        // Redrawing removed this button, and keyboard focus would be lost with it
        fileButton.focus({ preventScroll: true });
      });

      const previewButton = document.createElement('button');
      previewButton.type = 'button';
      // The file already being previewed has nothing to switch to, so its button
      // is disabled and its text says what is happening now
      const isPreviewed = file === state.previewedFile;
      previewButton.textContent = isPreviewed ? 'Previewing' : 'Preview';
      previewButton.disabled = isPreviewed;
      previewButton.addEventListener('click', () => {
        state.previewedFile = file;
        renderFileList();
      });

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'danger';
      removeButton.textContent = 'Remove';
      removeButton.addEventListener('click', async () => {
        const confirmed = await confirmAction(
          `Remove ${file.name}? ${LOST_CHANGES_WARNING}`,
          'Remove',
        );
        if (!confirmed) return;
        // Keep every file except this one, then redraw
        state.files = state.files.filter((other) => other !== file);
        renderFileList();
        // Redrawing removed this button, and keyboard focus would be lost with it.
        // preventScroll stops the browser jumping up to the new focus.
        fileButton.focus({ preventScroll: true });
      });

      const actions = document.createElement('div');
      actions.className = 'file-actions';
      actions.append(resetButton, previewButton, removeButton);
      item.append(handle, include, name, actions);

      return item;
    }),
  );
  updateMergeButton();
  // Once there are files, adding more is no longer the main thing to do, so the CSS
  // makes the drop area smaller and leaves more room for the pages
  dropArea.classList.toggle('has-files', state.files.length > 0);
  // A merge order and "Remove all" only mean something with at least two files
  listHeader.hidden = state.files.length < 2;
  // Like "Remove all", it needs at least two files to act on. One edited file has its
  // own Reset button in its row.
  resetAllButton.hidden = state.files.filter(isEdited).length < 2;
  // An old error is about the old list, so clear it whenever the list changes
  message.textContent = '';
  renderPageGrid();
}

// Lets the user drag rows to change the order files are merged in. We make
// state.files match the new order and redraw the list.
createSortable(fileList, {
  handle: '.drag-handle',
  onEnd({ oldIndex, newIndex }) {
    if (oldIndex === newIndex) return;

    // Take the dragged file out of the list and put it where it was dropped
    const files = [...state.files];
    const [moved] = files.splice(oldIndex, 1);
    files.splice(newIndex, 0, moved);
    state.files = files;
    renderFileList();
  },
});

for (const sample of SAMPLES) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = sample.label;
  button.addEventListener('click', async () => {
    // Disabled while the sample is made, so a second click can't add it twice
    button.disabled = true;
    try {
      const bytes = await sample.create();
      state.files = [
        ...state.files,
        { name: sample.filename, bytes, originalBytes: bytes },
      ];
      renderFileList();
    } finally {
      button.disabled = false;
    }
  });
  sampleButtons.append(button);
}

// The page grid adds files too (extracted pages), so it needs a way to redraw the list
setFileListRedraw(renderFileList);

// Adds files to the end of the list. Used by the file picker and by drops.
async function addFiles(files) {
  // Sort each file into one group, checking the type first, then the size.
  // `else if` means a non-PDF never has its size checked.
  const notPdf = [];
  const tooLarge = [];
  const accepted = [];
  for (const file of files) {
    if (!isPdfFile(file)) {
      // The picker only offers PDFs, but a dropped file can be anything
      notPdf.push(file);
    } else if (isTooLarge(file)) {
      // Size is checked before reading, so a huge file is never loaded into memory
      tooLarge.push(file);
    } else {
      accepted.push(file);
    }
  }

  if (accepted.length > 0) {
    try {
      // Read every file's bytes in parallel, keeping their order
      const added = await Promise.all(
        accepted.map(async (file) => {
          const bytes = await readFileBytes(file);
          return { name: file.name, bytes, originalBytes: bytes };
        }),
      );
      // Adding to the list (not replacing it) lets the user add files in several rounds
      state.files = [...state.files, ...added];
      renderFileList();
    } catch {
      // No variable after catch, since we don't need the technical details here
      message.textContent = 'A file could not be read from your device.';
      return;
    }
  }

  // Shown after renderFileList, which clears the message line
  const listNames = (list) => list.map((file) => file.name).join(', ');
  const problems = [];
  if (notPdf.length > 0) {
    problems.push(`Only PDF files can be added: ${listNames(notPdf)}.`);
  }
  if (tooLarge.length > 0) {
    const limitMb = MAX_FILE_BYTES / (1024 * 1024);
    problems.push(
      `Too large to open (limit ${limitMb} MB): ${listNames(tooLarge)}.`,
    );
  }
  if (problems.length > 0) {
    // Each problem ends with its own full stop, so they are joined with a space
    message.textContent = problems.join(' ');
  }
}

// The input is hidden, so this button opens its file chooser instead
fileButton.addEventListener('click', () => fileInput.click());

resetAllButton.addEventListener('click', async () => {
  const count = state.files.filter(isEdited).length;
  const confirmed = await confirmAction(
    `Reset ${count} edited files to their originals? ${LOST_CHANGES_WARNING}`,
    'Reset all',
  );
  if (!confirmed) return;
  // Only edited files, so a file with no changes keeps its selected pages
  for (const file of state.files.filter(isEdited)) resetFile(file);
  renderFileList();
  // This button is hidden now, and keyboard focus would be lost with it
  fileButton.focus({ preventScroll: true });
});

removeAllButton.addEventListener('click', async () => {
  const confirmed = await confirmAction(
    `Remove all ${state.files.length} files? ${LOST_CHANGES_WARNING}`,
    'Remove all',
  );
  if (!confirmed) return;
  state.files = [];
  renderFileList();
  // This button is hidden now, and keyboard focus would be lost with it
  fileButton.focus();
});

fileInput.addEventListener('change', () => {
  // fileInput.files is not a real array; Array.from copies it into one
  const picked = Array.from(fileInput.files);
  // Clear the picker, otherwise choosing the same file again would not fire "change"
  fileInput.value = '';
  addFiles(picked);
});

// True for drags that carry files, as opposed to, say, dragged text
function dragHasFiles(event) {
  return event.dataTransfer?.types.includes('Files');
}

dropArea.addEventListener('dragover', (event) => {
  if (!dragHasFiles(event)) return;
  // Without preventDefault the browser doesn't allow dropping here
  event.preventDefault();
  dropArea.classList.add('drag-over');
});

dropArea.addEventListener('dragleave', (event) => {
  // This also fires when the pointer moves onto something inside the area; ignore
  // that, and only remove the highlight when the pointer really leaves
  if (!dropArea.contains(event.relatedTarget)) {
    dropArea.classList.remove('drag-over');
  }
});

dropArea.addEventListener('drop', (event) => {
  event.preventDefault();
  dropArea.classList.remove('drag-over');
  addFiles(Array.from(event.dataTransfer.files));
});

// A file dropped anywhere else would make the browser open it in this tab, and the
// user would lose their work. Cancel the browser's default for file drags.
for (const type of ['dragover', 'drop']) {
  window.addEventListener(type, (event) => {
    if (dragHasFiles(event)) event.preventDefault();
  });
}

mergeButton.addEventListener('click', async () => {
  message.textContent = '';
  // A file that can't be previewed won't merge either, so the merge error covers it
  clearPreviewError();
  try {
    const chosen = filesToMerge();
    const pdfs = chosen.map((file) => file.bytes);
    // The names let the error say which files are bad
    const names = chosen.map((file) => file.name);
    // Locked like an edit, so nothing changes until the merged file is ready.
    // An error comes out after unlocking, so screen readers announce it.
    const merged = await runLocked(() => mergePdfs(pdfs, names));
    downloadPdf(merged, 'merged.pdf');
  } catch (error) {
    // Our own functions throw messages written for users, so show them as they are
    message.textContent = error.message;
  }
});
