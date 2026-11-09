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
import { confirmAction, LOST_CHANGES_WARNING } from './confirm.js';
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

// The sample buttons: label, file name, and the function that makes it
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

// The ticked files
function filesToMerge() {
  return state.files.filter((file) => !file.excludedFromMerge);
}

// Shows the Merge count, and hides Merge below two files
function updateMergeButton() {
  const total = state.files.length;
  const count = filesToMerge().length;
  mergeButton.hidden = count < 2;

  // While Merge is hidden, say how to get it (no hint with no files)
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

// Redraws the list from `state.files`
function renderFileList() {
  // If the previewed file is gone, preview the first one
  if (!state.files.includes(state.previewedFile))
    state.previewedFile = state.files[0] ?? null;

  fileList.replaceChildren(
    ...state.files.map((file) => {
      const item = document.createElement('li');
      if (file === state.previewedFile) item.classList.add('previewed');

      // Drag only from the handle, so it doesn't clash with the buttons
      const handle = document.createElement('span');
      handle.className = 'drag-handle';
      handle.textContent = '⠿';
      handle.title = 'Drag to change the merge order';

      // Ticked files are merged. The label is for screen readers.
      const include = document.createElement('input');
      include.type = 'checkbox';
      include.checked = !file.excludedFromMerge;
      include.setAttribute('aria-label', `Include ${file.name} in merge`);
      include.addEventListener('change', () => {
        file.excludedFromMerge = !include.checked;
        // Not a full redraw, which would lose this checkbox's focus
        updateMergeButton();
        // An old merge error no longer applies
        message.textContent = '';
      });

      const name = document.createElement('span');
      name.className = 'file-name';
      // textContent, so a file name is never treated as HTML
      name.textContent = file.name;

      const previewButton = document.createElement('button');
      previewButton.type = 'button';
      // The previewed file's button shows "Previewing" and is disabled
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
        // Keep every other file
        state.files = state.files.filter((other) => other !== file);
        renderFileList();
        // This button is gone, so move focus. preventScroll stops a jump.
        fileButton.focus({ preventScroll: true });
      });

      const actions = document.createElement('div');
      actions.className = 'file-actions';
      actions.append(previewButton, removeButton);
      item.append(handle, include, name, actions);

      return item;
    }),
  );
  updateMergeButton();
  // With files added, the drop area shrinks
  dropArea.classList.toggle('has-files', state.files.length > 0);
  // The header (merge order, Remove all) needs two files
  listHeader.hidden = state.files.length < 2;
  // Needs two edited files; one is reset from the bottom bar
  resetAllButton.hidden = state.files.filter(isEdited).length < 2;
  // An old error no longer applies
  message.textContent = '';
  renderPageGrid();
}

// Dragging rows changes the merge order
createSortable(fileList, {
  handle: '.drag-handle',
  onEnd({ oldIndex, newIndex }) {
    if (oldIndex === newIndex) return;

    // Move the dragged file to where it was dropped
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
    // Disabled while making it, so it can't be added twice
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

// The grid adds files too (extract), so it needs to redraw the list
setFileListRedraw(renderFileList);

// Adds files to the list, from the picker or a drop
async function addFiles(files) {
  // Sort files into groups: type first, then size
  const notPdf = [];
  const tooLarge = [];
  const accepted = [];
  for (const file of files) {
    if (!isPdfFile(file)) {
      // A dropped file can be anything
      notPdf.push(file);
    } else if (isTooLarge(file)) {
      // Checked before reading, so a huge file is never loaded
      tooLarge.push(file);
    } else {
      accepted.push(file);
    }
  }

  if (accepted.length > 0) {
    try {
      // Read all files at once, keeping their order
      const added = await Promise.all(
        accepted.map(async (file) => {
          const bytes = await readFileBytes(file);
          return { name: file.name, bytes, originalBytes: bytes };
        }),
      );
      // Add to the list, not replace it
      state.files = [...state.files, ...added];
      renderFileList();
    } catch {
      // No error variable: the details aren't needed
      message.textContent = 'A file could not be read from your device.';
      return;
    }
  }

  // After renderFileList, which clears the message
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
    // Each ends with a full stop, so join with a space
    message.textContent = problems.join(' ');
  }
}

// The input is hidden; this button opens its chooser
fileButton.addEventListener('click', () => fileInput.click());

resetAllButton.addEventListener('click', async () => {
  const count = state.files.filter(isEdited).length;
  const confirmed = await confirmAction(
    `Reset ${count} edited files to their originals? ${LOST_CHANGES_WARNING}`,
    'Reset all',
  );
  if (!confirmed) return;
  // Only edited files, so others keep their selection
  for (const file of state.files.filter(isEdited)) resetFile(file);
  renderFileList();
  // This button is now hidden, so move focus
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
  // This button is now hidden, so move focus
  fileButton.focus();
});

fileInput.addEventListener('change', () => {
  // fileInput.files isn't a real array; Array.from makes one
  const picked = Array.from(fileInput.files);
  // Clear it, so picking the same file again still fires "change"
  fileInput.value = '';
  addFiles(picked);
});

// True for drags carrying files, not text
function dragHasFiles(event) {
  return event.dataTransfer?.types.includes('Files');
}

dropArea.addEventListener('dragover', (event) => {
  if (!dragHasFiles(event)) return;
  // Needed to allow dropping
  event.preventDefault();
  dropArea.classList.add('drag-over');
});

dropArea.addEventListener('dragleave', (event) => {
  // Also fires when moving onto a child, so check the pointer really left
  if (!dropArea.contains(event.relatedTarget)) {
    dropArea.classList.remove('drag-over');
  }
});

dropArea.addEventListener('drop', (event) => {
  event.preventDefault();
  dropArea.classList.remove('drag-over');
  addFiles(Array.from(event.dataTransfer.files));
});

// Stop a file dropped elsewhere from opening in this tab and losing the user's work
for (const type of ['dragover', 'drop']) {
  window.addEventListener(type, (event) => {
    if (dragHasFiles(event)) event.preventDefault();
  });
}

mergeButton.addEventListener('click', async () => {
  message.textContent = '';
  // The merge error covers any preview error
  clearPreviewError();
  try {
    const chosen = filesToMerge();
    const pdfs = chosen.map((file) => file.bytes);
    // The names let the error say which files are bad
    const names = chosen.map((file) => file.name);
    // Locked like an edit, so nothing changes until it's done
    const merged = await runLocked(() => mergePdfs(pdfs, names));
    downloadPdf(merged, 'merged.pdf');
  } catch (error) {
    // Our errors are written for users, so show them as they are
    message.textContent = error.message;
  }
});
