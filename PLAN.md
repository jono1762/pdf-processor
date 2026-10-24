# PLAN.md

## Goal

A free, open-source PDF toolkit that runs entirely in the browser.

**Pitch:** Popular PDF tools either cost money or upload your files to their servers. This one is free, and your files never leave your device.

## v1a: Core page editor

- Open one or more PDFs (file picker and drag-and-drop)
- Page grid with thumbnails
- Reorder pages (drag-and-drop), rotate, delete
- Merge multiple PDFs; split or extract page ranges
- Download the result
- "Try a sample" buttons using bundled sample documents

## v1b: OCR for scans

- Detect pages with no text layer and offer OCR only for those
- Add an invisible text layer aligned with the page so text can be selected and searched
- Progress indicator and cancel button for OCR jobs

**v1 is done when:**

- There is a live deployed link
- It works in recent Chrome, Firefox and Safari
- Core PDF operations have unit tests
- The DevTools Network tab shows no file data being sent anywhere

## v2: Images to clean PDF (tentative)

Value here is engineering depth rather than a product gap, since phone scanner apps already do much of this.

- Import photos of pages
- Auto-detect page edges, crop and straighten (perspective correction)
- Clean up: contrast, shadow removal, whitened background
- Compress to a target file size (e.g. "under 10 MB")
- Sensible default download names based on the original file (e.g. `report-merged.pdf`, `report-ocr.pdf`)

## v3: Polish and stretch goals

- Optional handwriting recognition (TrOCR via Transformers.js), downloaded only when the user asks for it
- End-to-end tests
- Performance on large files (hundreds of pages)
- Accessibility pass (keyboard use, screen reader labels)
- README with demo GIF, feature list and key design decisions

## Sample documents

Use content I create myself or that is public domain.

- Multi-page digital PDF (reorder, merge, split)
- Scanned printed page (OCR)
- PDF with a sideways page (rotate)
- Large PDF (performance)

## Out of scope

- User accounts, cloud storage, or any backend
- Editing the text content of PDFs
- AI features that need a server

## Decisions log

_Add an entry for each significant decision: date, decision, reason, alternatives considered._

- **Client-side only.** Privacy is the core pitch, and it avoids hosting costs. Alternative: a backend with Python libraries, rejected because files would leave the device.
- **Plain JavaScript, HTML and CSS; no TypeScript or UI framework.** The app is small with little UI state, so a framework would add weight without much benefit. Fewer dependencies means a smaller, faster site and less to maintain, and it keeps the focus on browser APIs, Web Workers and PDF handling. Alternatives: TypeScript and React, worth revisiting if the UI grows significantly.
- **Strict Content-Security-Policy (2026-10-22).** A CSP (e.g. `connect-src 'self'`) makes the browser itself block requests to other servers, so the privacy promise is enforced rather than only checked in DevTools. It will be set with a `<meta>` tag because GitHub Pages can't set custom headers. It will need to allow Web Workers (`worker-src 'self' blob:`) and WebAssembly for Tesseract (`'wasm-unsafe-eval'`), and must not break Vite's dev server. Alternative: rely only on code review and the Network tab, rejected because it is a promise rather than a guarantee.
- **File list holds `{ name, bytes }`, not `File` objects (2026-10-24).** A `File` can't be edited, and page edits (rotate, delete) produce new bytes. Reading the bytes once on add and replacing them after each edit means merge, preview and download always use the current version. Alternative: keep per-page rotation and deletion as state and apply it all at download time, rejected as more complicated. Trade-off: every file stays in memory as bytes, worth revisiting for large files.
- **SortableJS for drag-and-drop page reordering (2026-10-24).** It handles touch screens, animation and autoscroll, and works on plain DOM elements without a framework. The page thumbnails are `<button>` elements, and the browser's built-in drag-and-drop doesn't work on buttons in Firefox, so SortableJS is set to do the dragging itself (`forceFallback`). Alternatives: the browser's drag-and-drop API (no dependency, but no touch support and the Firefox button problem), and custom pointer-event code (works everywhere, but much more code to write and explain). Trade-off: one more dependency, about 41 kB added to the bundle.
- **UI split into modules sharing one `state` object (2026-10-24).** `main.js` had grown to over 300 lines doing five jobs. It is now `src/ui/file-list.js`, `src/ui/page-grid.js` and `src/ui/state.js`, with PDF logic staying in `src/lib/`. Modules can't reassign variables they import, so the shared data (`files`, `previewedFile`) lives in an exported object whose properties they change. Only the file list calls into the grid, so there are no circular imports. Alternatives: events between modules (more indirection than this size needs) and a class holding everything (nothing else here uses classes).
- **Sample PDFs are generated in the browser, not committed (2026-10-24).** The "Try a sample" buttons build their PDFs with `pdf-lib` when clicked, using functions in `src/lib/samples.js` that have unit tests. No binary files are stored in the repo, the content is always original, and the large sample doesn't bloat the download. Alternative: commit pre-made PDFs in a samples folder, which can look more realistic but adds binary files and still needs a generator script. The scanned-page sample for OCR will be added with v1b.
