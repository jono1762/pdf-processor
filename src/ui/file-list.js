import { mergePdfs } from '../lib/merge.js';
import { readFileBytes, downloadPdf } from './download.js';
import { state } from './state.js';
import { renderPageGrid, clearPreviewError } from './page-grid.js';

const fileInput = document.querySelector('#file-input');
const fileList = document.querySelector('#file-list');
const mergeButton = document.querySelector('#merge-button');
const message = document.querySelector('#message');

// Rebuilds the visible list from `state.files`
function renderFileList() {
  // If the previewed file is gone (or nothing was chosen yet), use the first file
  if (!state.files.includes(state.previewedFile))
    state.previewedFile = state.files[0] ?? null;

  fileList.replaceChildren(
    ...state.files.map((file) => {
      const item = document.createElement('li');
      if (file === state.previewedFile) item.classList.add('previewed');

      const name = document.createElement('span');
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
      item.append(name, actions);

      return item;
    }),
  );
  // Merging needs at least two files
  mergeButton.disabled = state.files.length < 2;
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
    state.files = [...state.files, ...added];
    renderFileList();
  } catch {
    // No variable after catch, since we don't need the technical details here
    message.textContent = 'A file could not be read from your device.';
  }
});

mergeButton.addEventListener('click', async () => {
  message.textContent = '';
  // A file that can't be previewed won't merge either, so the merge error covers it
  clearPreviewError();
  try {
    const pdfs = state.files.map((file) => file.bytes);
    // The names let the error say which files are bad
    const names = state.files.map((file) => file.name);
    downloadPdf(await mergePdfs(pdfs, names), 'merged.pdf');
  } catch (error) {
    // Our own functions throw messages written for users, so show them as they are
    message.textContent = error.message;
  }
});
