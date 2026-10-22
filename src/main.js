import './style.css';
import { mergePdfs } from './lib/merge.js';
import { readFileBytes, downloadPdf } from './download.js';

const fileInput = document.querySelector('#file-input');
const fileList = document.querySelector('#file-list');
const mergeButton = document.querySelector('#merge-button');
const message = document.querySelector('#message');

// The files the user has chosen, in order. Merging uses this list.
let files = [];

// Rebuilds the visible list from the `files` array
function renderFileList() {
  fileList.replaceChildren(
    ...files.map((file) => {
      const item = document.createElement('li');
      // textContent (not innerHTML) so a file name can never be treated as HTML
      item.textContent = file.name;

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.textContent = 'Remove';
      removeButton.addEventListener('click', () => {
        // Keep every file except this one, then redraw
        files = files.filter((other) => other !== file);
        renderFileList();
      });
      item.append(' ', removeButton);

      return item;
    }),
  );
  // Merging needs at least two files
  mergeButton.disabled = files.length < 2;
}

fileInput.addEventListener('change', () => {
  // fileInput.files is not a real array; Array.from copies it into one.
  // Adding to the list (not replacing it) lets the user pick files in several rounds.
  files = [...files, ...Array.from(fileInput.files)];
  // Clear the picker, otherwise choosing the same file again would not fire "change"
  fileInput.value = '';
  message.textContent = '';
  renderFileList();
});

mergeButton.addEventListener('click', async () => {
  message.textContent = '';
  try {
    // Promise.all reads all the files at once and keeps their order
    const pdfs = await Promise.all(files.map(readFileBytes));
    downloadPdf(await mergePdfs(pdfs), 'merged.pdf');
  } catch (error) {
    // Our own functions throw messages written for users, so show them as they are
    message.textContent = error.message;
  }
});
