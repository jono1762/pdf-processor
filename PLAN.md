# PLAN.md

## Goal

A free, open-source PDF toolkit that runs entirely in the browser.

**Pitch:** Popular PDF tools either cost money or upload your files to their servers. This one is free, and your files never leave your device.

## v1: Core page editor (done, tagged `v1`)

- Open one or more PDFs (file picker and drag-and-drop)
- Page grid with thumbnails
- Reorder pages (drag-and-drop), rotate, delete
- Merge multiple PDFs; extract selected pages into a new file
- Download the result
- "Try a sample" buttons using generated sample documents

**v1 is done when:**

- There is a live deployed link
- It works in recent Chrome and Edge (Firefox and Safari are checked later, in v3)
- Core PDF operations have unit tests
- The DevTools Network tab shows no file data being sent anywhere

## v1.0.1: File size limit (done, tagged `v1.0.1`)

- Reject files over 200 MB before reading them, with a clear message naming the skipped files

## v1.0.2: Phones and UI polish (in progress)

Phone layout and touch controls:

- Page no longer scrolls sideways at phone width
- Two-column page grid and stacked file rows on phone-sized screens
- Larger tap targets on touch screens
- Press and hold to drag thumbnails, so swiping still scrolls

UI polish:

- Favicon
- Blue hover on buttons
- Restyle the browser's "Choose Files" button to match the others
- General polish

**v1.0.2 is done when:**

- The polish is finished and deployed
- The live site has been tested on a real phone, including the 300-page sample and downloads

## v2: OCR for scans

- Detect pages with no text layer and offer OCR only for those
- Add an invisible text layer aligned with the page so text can be selected and searched
- Progress indicator and cancel button for OCR jobs

## v3: Polish and hardening

- End-to-end tests, run in Chromium, Firefox and WebKit, which also covers the Firefox and Safari check
- Performance on large files (hundreds of pages)
- Accessibility pass (keyboard use, screen reader labels, keyboard reordering)
- README with demo GIF and key design decisions

## Sample documents

Use content I create myself or that is public domain.

- Multi-page digital PDF (reorder, merge, extract)
- Scanned printed page (OCR)
- PDF with a sideways page (rotate)
- Large PDF (performance)

## Out of scope

- User accounts, cloud storage, or any backend
- Editing the text content of PDFs
- AI features that need a server

## Decisions log

_Add an entry for each significant decision: decision, reason, alternatives considered._

- **Client-side only.** Privacy is the core pitch, and it avoids hosting costs. Alternative: a backend with Python libraries, rejected because files would leave the device.
- **Plain JavaScript, HTML and CSS; no TypeScript or UI framework.** The app is small with little UI state, so a framework would add weight without much benefit. Fewer dependencies means a smaller, faster site and less to maintain, and it keeps the focus on browser APIs, Web Workers and PDF handling. Alternatives: TypeScript and React, worth revisiting if the UI grows significantly.
- **Strict Content-Security-Policy.** A policy in a `<meta>` tag makes the browser itself block requests to other servers, so the privacy promise is enforced and not only checked in DevTools. The key rule is `connect-src 'self'`, so `fetch`, XHR and WebSocket can only reach our own site. The rules live in `csp.js`, with unit tests that fail if an outside host, `unsafe-inline` or `unsafe-eval` is added, and a small Vite plugin in `vite.config.js` inserts the tag. It is a meta tag because GitHub Pages can't set headers. The dev server gets two extra allowances (a local WebSocket and inline styles) and the built site does not. `worker-src 'self' blob:` is for the PDF.js worker, and `'wasm-unsafe-eval'` allows WebAssembly (not `eval`) for PDF.js image decoders and, in v2, Tesseract. Alternative: rely only on code review and the Network tab, rejected because it is a promise rather than a guarantee. Limits: it can't stop the whole tab navigating to another address, and a meta tag can't set `frame-ancestors` or reporting, so it is defence in depth and not a proof.
- **File list holds `{ name, bytes }`, not `File` objects.** A `File` can't be edited, and page edits (rotate, delete) produce new bytes. Reading the bytes once on add and replacing them after each edit means merge, preview and download always use the current version. Alternative: keep per-page rotation and deletion as state and apply it all at download time, rejected as more complicated. Trade-off: every file stays in memory as bytes, worth revisiting for large files.
- **SortableJS for drag-and-drop page reordering.** It handles touch screens, animation and autoscroll, and works on plain DOM elements without a framework. The page thumbnails are `<button>` elements, and the browser's built-in drag-and-drop doesn't work on buttons in Firefox, so SortableJS is set to do the dragging itself (`forceFallback`). Alternatives: the browser's drag-and-drop API (no dependency, but no touch support and the Firefox button problem), and custom pointer-event code (works everywhere, but much more code to write and explain). Trade-off: one more dependency, about 41 kB added to the bundle.
- **UI split into modules sharing one `state` object.** `main.js` had grown to over 300 lines doing five jobs. It is now `src/ui/file-list.js`, `src/ui/page-grid.js` and `src/ui/state.js`, with PDF logic staying in `src/lib/`. Modules can't reassign variables they import, so the shared data (`files`, `previewedFile`) lives in an exported object whose properties they change. The file list imports the grid, and the grid asks the list to redraw through a callback the list registers, so there are no circular imports. Alternatives: events between modules (more indirection than this size needs) and a class holding everything (nothing else here uses classes).
- **Sample PDFs are generated in the browser, not committed.** The "Try a sample" buttons build their PDFs with `pdf-lib` when clicked, using functions in `src/lib/samples.js` that have unit tests. No binary files are stored in the repo, the content is always original, and the large sample doesn't bloat the download. Alternative: commit pre-made PDFs in a samples folder, which can look more realistic but adds binary files and still needs a generator script. The scanned-page sample for OCR will be added with v2.
- **Extracting pages makes a new file in the list instead of downloading.** "Extract selected" adds the chosen pages as `<name>-pages-N.pdf`, grouped under the file they came from, and leaves the original alone. The result can be previewed, edited, reordered, merged or downloaded like any other file, and several ranges can be taken from one source. Alternatives: downloading the pages straight away (simpler, but the result can't be used further in the app) and a "keep only the selected pages" button (destroys the original, and there is no undo). Trade-off: extracted pages stay in memory as another file.
- **Merge uses the ticked files, and extracted files start unticked.** Each file in the list has a checkbox, and Merge combines only the ticked ones, in list order. An extracted file contains pages that are also in its source, so ticking it by default would make a plain "merge all" repeat those pages; the Merge button's count ("Merge 2 of 4 files") shows what is included. The flag is stored on the file as `excludedFromMerge`, so a file without it counts as included. Alternative: select rows by clicking them, rejected because it clashes with the highlight that marks the previewed file.
- **Files over 200 MB are rejected before they are read.** Every file is held in memory, so one huge file could freeze or crash the tab with no explanation. `isTooLarge` checks `File.size`, which the browser knows without reading the file, so an oversized file is never loaded, and the user sees which files were skipped and why. 200 MB (1 MB = 1024 × 1024 bytes) is a guess, to be tuned in v3 with real measurements. Alternatives: a page-count limit (closer to what makes rendering slow, but the file must be loaded to count its pages) and no limit (rejected because it breaks the "fail visibly" rule). Trade-off: the limit is per file, so several large files can still add up to too much memory; a limit on the total would also need checks on extract and merge, so it is left for v3.
- **Phone layout uses two separate media queries.** `max-width: 40rem` handles the layout (two columns, stacked file rows), because that depends on the space available. `pointer: coarse` handles tap target sizes, because those depend on using a finger, so large touch tablets get them too and narrow desktop windows don't. Two columns were chosen over one because thumbnails are for recognising and moving pages, not reading them, and one column shows under two pages per screen. Alternatives: a single query for both jobs (wrong for tablets and narrow desktop windows) and `auto-fill` grid columns (would change the desktop layout). Trade-off: file rows are taller on phones, so long lists need more scrolling.
- **Press and hold to drag thumbnails on touch screens.** Thumbnails fill a phone screen, so if a touch started a drag straight away, swiping could not scroll the page. SortableJS's `delay` and `delayOnTouchOnly` options make touch wait 200 milliseconds, while mouse dragging stays instant. The file list has no wait because it only drags from its grip. Alternatives: a grip on every thumbnail (more obvious, but adds clutter to each one) and no touch dragging (simplest, but loses a feature). Trade-off: the hold isn't obvious, so touch screens show a short hint above the grid.
