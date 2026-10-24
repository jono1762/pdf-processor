# PDF Processor

A free, open-source PDF toolkit that runs entirely in your browser.

Popular PDF tools either cost money or upload your files to their servers. This one is free, and your files never leave your device.

See [PLAN.md](PLAN.md) for the roadmap.

## Features

- Merge, split, reorder, rotate and delete pages
- OCR scanned PDFs into searchable PDFs

## Privacy

All processing happens locally in the browser. There is no backend, and no file data is sent anywhere.

## Tech stack

Plain JavaScript, HTML and CSS, built with [Vite](https://vite.dev/). PDF handling uses [pdf-lib](https://pdf-lib.js.org/) and [PDF.js](https://mozilla.github.io/pdf.js/), drag-and-drop reordering uses [SortableJS](https://sortablejs.github.io/Sortable/), and OCR uses [Tesseract.js](https://tesseract.projectnaptha.com/).

## Disclaimer

Only open PDFs you trust. This tool processes files locally, but it can't make a malicious file safe.

## Licence

[MIT](LICENSE)
