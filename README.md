# PDF Processor

A free, open-source PDF toolkit that runs entirely in your browser.

Popular PDF tools either cost money or upload your files to their servers. This one is free, and your files never leave your device.

**Live demo:** https://jono1762.github.io/pdf-processor/

**Tested on:** Chrome and Edge on Windows 11, Chrome on a Samsung Galaxy Z Fold5, and Safari on an iPhone 12. See [TESTING.md](TESTING.md).

[PLAN.md](PLAN.md) has the roadmap, and [ARCHITECTURE.md](ARCHITECTURE.md) explains the code.

## Features

- Merge PDFs in the order you choose
- Rotate, delete, reorder or extract pages
- Choose files or drop them on the page (up to 200 MB each)
- Reset or remove files, with a confirmation first
- Sample files to try it without your own
- Works on phones: tap a page to select it, press and hold to drag it

## Privacy

Everything happens in your browser. There's no server, and no file data is sent anywhere. A Content-Security-Policy makes the browser block requests to other sites, so this is enforced, not just promised. To check, open DevTools, go to the Network tab and use the app: the only requests are for the site's own files.

Deleted pages are removed from the saved file, not just hidden, and extracted files contain only the pages you chose.

## Known limitations

- Reordering, extracting or merging a fillable form makes its boxes unfillable, and drops the title and bookmarks.
- Deleting pages drops bookmarks and custom page numbers (like i, ii, iii).
- Any edit breaks a digital signature, as in every PDF editor.
- Password-protected PDFs can't be opened.

## Tech stack

Plain JavaScript, HTML and CSS, built with [Vite](https://vite.dev/). [pdf-lib](https://pdf-lib.js.org/) edits PDFs, [PDF.js](https://mozilla.github.io/pdf.js/) draws them, and [SortableJS](https://sortablejs.github.io/Sortable/) handles dragging.

## Disclaimer

Only open PDFs you trust. Working locally doesn't make a malicious file safe.

## Licence

[MIT](LICENSE)
