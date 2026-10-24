# PDF Processor

A free, open-source PDF toolkit that runs entirely in your browser.

Popular PDF tools either cost money or upload your files to their servers. This one is free, and your files never leave your device.

**Live demo:** https://jono1762.github.io/pdf-processor/ (tested in recent Chrome and Edge)

See [PLAN.md](PLAN.md) for the roadmap.

## Features

- Merge the PDFs you choose, in the order you want (drag to reorder)
- Select pages to rotate, delete, reorder (by dragging) or extract into a new file
- Open files by choosing them or dropping them on the page
- Built-in sample documents, so you can try it without your own files

## Privacy

All processing happens locally in the browser. There is no backend, and no file data is sent anywhere. A Content-Security-Policy makes the browser block requests to any other site, so this is enforced and not only promised. You can check it yourself: open DevTools, go to the Network tab, and use the app. The only requests are the page's own files.

## Tech stack

Plain JavaScript, HTML and CSS, built with [Vite](https://vite.dev/). PDF handling uses [pdf-lib](https://pdf-lib.js.org/) and [PDF.js](https://mozilla.github.io/pdf.js/), and drag-and-drop reordering uses [SortableJS](https://sortablejs.github.io/Sortable/).

## Disclaimer

Only open PDFs you trust. This tool processes files locally, but it can't make a malicious file safe.

## Licence

[MIT](LICENSE)
