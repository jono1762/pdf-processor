import './style.css';

const fileInput = document.querySelector('#file-input');
const fileList = document.querySelector('#file-list');

// The files the user has chosen, in order. Merging will use this list.
let files = [];

// Rebuilds the visible list from the `files` array
function renderFileList() {
  fileList.replaceChildren(
    ...files.map((file) => {
      const item = document.createElement('li');
      // textContent (not innerHTML) so a file name can never be treated as HTML
      item.textContent = file.name;
      return item;
    }),
  );
}

fileInput.addEventListener('change', () => {
  // fileInput.files is not a real array; Array.from copies it into one
  files = Array.from(fileInput.files);
  renderFileList();
});
