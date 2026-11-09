# PDF Processor

A free, open-source PDF toolkit that runs entirely in your browser.

Popular PDF tools either cost money or upload your files to their servers. This one is free, and your files never leave your device.

**Live demo:** https://jono1762.github.io/pdf-processor/

**Tested on:** Chrome and Edge on Windows 11, Chrome on a Samsung Galaxy Z Fold5 (folded and unfolded) and Safari on an iPhone 12. See [TESTING.md](TESTING.md) for what was tested and what it found.

See [PLAN.md](PLAN.md) for the roadmap, and [ARCHITECTURE.md](ARCHITECTURE.md) for how the code fits together.

## Features

- Merge the PDFs you choose, in the order you want (drag to reorder)
- Select pages to rotate, delete, reorder (by dragging) or extract into a new file
- Open files by choosing them or dropping them on the page (up to 200 MB each)
- Reset the previewed file to its original, or remove a file, one at a time or all at once, with a confirmation first
- Built-in sample documents, so you can try it without your own files
- Layout and controls adapted for phones and touch screens: tap a page to select it, press and hold to drag it

## Privacy

All processing happens locally in the browser. There is no backend, and no file data is sent anywhere. A Content-Security-Policy makes the browser block requests to any other site, so this is enforced and not only promised. You can check it yourself: open DevTools, go to the Network tab, and use the app. The only requests are the page's own files.

Deleted pages are removed from the saved file, not just hidden, and an extracted file contains only the pages you chose, so other pages can't be recovered from a download.

## Known limitations

- Reordering, extracting or merging pages of a fillable form makes its boxes no longer fillable, and drops the file's title and bookmarks.
- Deleting pages drops the file's bookmarks and custom page numbers (such as i, ii, iii).
- Any edit invalidates a digital signature, as with every PDF editor.
- Password-protected PDFs can't be opened.

## Tech stack

Plain JavaScript, HTML and CSS, built with [Vite](https://vite.dev/). PDF handling uses [pdf-lib](https://pdf-lib.js.org/) and [PDF.js](https://mozilla.github.io/pdf.js/), and drag-and-drop reordering uses [SortableJS](https://sortablejs.github.io/Sortable/).

## Disclaimer

Only open PDFs you trust. This tool processes files locally, but it can't make a malicious file safe.

## Licence

[MIT](LICENSE)
