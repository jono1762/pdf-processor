import { mergePdfs } from '../lib/merge.js';
import {
  createMultiPageSample,
  createSidewaysSample,
  createLargeSample,
} from '../lib/samples.js';
import { readFileBytes, downloadPdf, isPdfFile } from './download.js';
import { state } from './state.js';
import { createSortable } from './sortable.js';
import {
  renderPageGrid,
  clearPreviewError,
  setFileListRedraw,
} from './page-grid.js';

const fileInput = document.querySelector('#file-input');
const dropArea = document.querySelector('#drop-area');
const fileList = document.querySelector('#file-list');
const mergeButton = document.querySelector('#merge-button');
const message = document.querySelector('#message');
const sampleButtons = document.querySelector('#sample-buttons');
const reorderHint = document.querySelector('#reorder-hint');

// The "Try a sample" buttons: what each says, what its file is called, how to make it
const SAMPLES = [
  {
    label: 'Multi-page document',
    filename: 'sample-document.pdf',
    create: createMultiPageSample,
  },
  {
    label: 'Sideways page',
    filename: 'sample-sideways-page.pdf',
    create: createSidewaysSample,
  },
  {
    label: 'Large (300 pages)',
    filename: 'sample-large.pdf',
    create: createLargeSample,
  },
];

// The files that Merge will use: every file except those the user has unticked
function filesToMerge() {
  return state.files.filter((file) => !file.excludedFromMerge);
}

// Says on the Merge button how many files it will merge, and disables it if that's
// fewer than two
function updateMergeButton() {
  const total = state.files.length;
  const count = filesToMerge().length;
  mergeButton.disabled = count < 2;
  if (total < 2) {
    mergeButton.textContent = 'Merge';
  } else if (count === total) {
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

      const previewButton = document.createElement('button');
      previewButton.type = 'button';
      previewButton.textContent = 'Preview';
      // The file already being previewed has nothing to switch to
      previewButton.disabled = file === state.previewedFile;
      previewButton.addEventListener('click', () => {
        state.previewedFile = file;
        renderFileList();
      });

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.textContent = 'Remove';
      removeButton.addEventListener('click', () => {
        // Keep every file except this one, then redraw
        state.files = state.files.filter((other) => other !== file);
        renderFileList();
      });

      const actions = document.createElement('div');
      actions.className = 'file-actions';
      actions.append(previewButton, removeButton);
      item.append(handle, include, name, actions);

      return item;
    }),
  );
  updateMergeButton();
  // Choosing a merge order needs at least two files
  reorderHint.hidden = state.files.length < 2;
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
      state.files = [...state.files, { name: sample.filename, bytes }];
      renderFileList();
    } finally {
      button.disabled = false;
    }
  });
  sampleButtons.append(button);
}

// The page grid adds files too (extracted pages), so it needs a way to redraw the list
setFileListRedraw(renderFileList);

// Adds files to the end of the list. Used by the file picker, and later by drops.
async function addFiles(files) {
  // The picker only offers PDFs, but a dropped file can be anything
  const accepted = files.filter(isPdfFile);
  const rejected = files.filter((file) => !isPdfFile(file));

  if (accepted.length > 0) {
    try {
      // Read every file's bytes in parallel, keeping their order
      const added = await Promise.all(
        accepted.map(async (file) => ({
          name: file.name,
          bytes: await readFileBytes(file),
        })),
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
  if (rejected.length > 0) {
    const names = rejected.map((file) => file.name).join(', ');
    message.textContent = `Only PDF files can be added: ${names}`;
  }
}

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
    downloadPdf(await mergePdfs(pdfs, names), 'merged.pdf');
  } catch (error) {
    // Our own functions throw messages written for users, so show them as they are
    message.textContent = error.message;
  }
});
