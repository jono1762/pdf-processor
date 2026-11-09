# Architecture

A map of how PDF Processor fits together. For why things are the way they are, see the Decisions log in [PLAN.md](PLAN.md).

## The big picture

Everything runs in the browser. There is no server: GitHub Pages serves the built files, and the user's PDFs never leave their device.

```
index.html ── loads ──> src/main.js ── imports ──> src/ui/file-list.js ──> src/ui/page-grid.js
                                                          │                       │
                                                          └──── both use ─────────┤
                                                                                  ▼
                                                src/lib/  (plain functions: bytes in, bytes out)
                                                          │
                                                          ▼
                                       pdf-lib (edit PDFs)   PDF.js (draw pages)
```

The code is split in two:

- **`src/lib/`: the PDF work.** Plain functions that take a PDF's bytes and return new bytes, with no page code, so each one can be unit tested on its own.
- **`src/ui/`: the page.** Everything that reads clicks and updates what's on screen.

## Folders and files

| Path                                                             | What it does                                                                                                               |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `index.html`                                                     | The page's structure: drop area, file list, bottom bar, page grid, confirmation dialog                                     |
| `src/style.css`                                                  | All styling, including the phone layout (`max-width: 40rem`), the bottom bar (`54rem`) and touch sizes (`pointer: coarse`) |
| `src/main.js`                                                    | Only imports the styles and the UI, which set themselves up                                                                |
| **`src/lib/`**                                                   |                                                                                                                            |
| `rotate.js`, `delete.js`, `reorder.js`, `extract.js`, `merge.js` | One PDF operation each, using pdf-lib                                                                                      |
| `clean.js`                                                       | `saveWithout`: saves a file after pages were removed, making sure they're really gone (used by Delete and Extract)         |
| `validate.js`                                                    | Shared checks: loading a PDF with a clear error, and checking page numbers                                                 |
| `render.js`                                                      | Drawing pages as thumbnails with PDF.js                                                                                    |
| `samples.js`                                                     | Makes the "Try a sample" files in code                                                                                     |
| **`src/ui/`**                                                    |                                                                                                                            |
| `file-list.js`                                                   | Choosing and dropping files, samples, the list of files, Preview, Remove, Reset all, Remove all, Merge                     |
| `page-grid.js`                                                   | The thumbnails, selecting pages, the bottom bar's tools, edits, the page lock, the back-to-top button                      |
| `state.js`                                                       | The data both UI files share (see below)                                                                                   |
| `confirm.js`                                                     | The "are you sure?" dialog                                                                                                 |
| `download.js`                                                    | File checks, download names, and saving a file to the device                                                               |
| `sortable.js`                                                    | Shared settings for dragging (files and pages)                                                                             |
| **Other**                                                        |                                                                                                                            |
| `csp.js`, `vite.config.js`                                       | The Content-Security-Policy, which makes the browser block requests to other sites                                         |
| `scripts/copy-pdfjs-assets.js`                                   | Copies PDF.js's decoders, fonts and character maps into the site before each build                                         |
| `.github/workflows/`                                             | CI: lint, format check, tests and build on every push; deploy from `main`                                                  |

## The shared data

`state.js` holds one object that both UI files read and change:

```js
state.files; // the PDFs in the list, in order
state.previewedFile; // the one whose pages are shown
```

Each file is `{ name, bytes, originalBytes }`. Edits replace `bytes` with a new array and never change the old one, so `originalBytes` is what Reset goes back to, and `bytes !== originalBytes` says whether a file has been edited.

`file-list.js` imports `page-grid.js`. The grid sometimes needs the list redrawn (after an extract, for example), but it can't import the list back without a loop, so the list hands it a function to call (`setFileListRedraw`).

## What happens when…

**A file is added.** `addFiles` checks each file's type and size, reads the bytes, adds `{ name, bytes, originalBytes }` to `state.files`, and calls `renderFileList`. That redraws the list and calls `renderPageGrid`.

**Pages are drawn** (`renderPageGrid`):

1. PDF.js opens the file.
2. Every page's size is read and a blank thumbnail of the right size is added, so the grid has its full size straight away and doesn't move.
3. Each page is drawn into its thumbnail, at the column's real width.
4. If the user switches file meanwhile, a counter (`latestRender`) tells the old drawing to stop.

While drawing, pages can be selected, but Rotate, Extract and Delete wait.

**A page is edited** (`editPreviewedFile`):

1. `runLocked` locks the page: everything except the bottom bar becomes `inert`, so nothing can change mid-edit.
2. The `src/lib/` function makes the new bytes, and they replace `file.bytes`.
3. The grid is updated in place, not redrawn: Rotate redraws only the rotated pages, Delete removes their thumbnails, and dragging just renumbers.
4. The page unlocks, and focus goes back where it was. Any error is shown after unlocking.

Merge uses the same lock.

**Pages are deleted or extracted.** pdf-lib's `removePage` hides a page but leaves it in the saved file. `saveWithout` in `clean.js`:

1. Detaches what points at removed pages: links, form boxes, bookmarks.
2. Follows references from the top of the file and deletes everything it can't reach ("mark and sweep").
3. If a removed page is somehow still reachable, falls back to copying the kept pages into a new file.

**A confirmation is needed.** `confirmAction(question, label)` opens the shared `<dialog>` and returns a promise that resolves to `true` or `false` when the user picks a button, presses Esc, or uses Android's back button.

## Testing

Unit tests sit next to the code they test (`*.test.js`) and run with `npm test`. See [TESTING.md](TESTING.md) for what else was tested.
