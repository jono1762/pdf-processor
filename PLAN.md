# PLAN.md

## Goal

A free, open-source PDF toolkit that runs entirely in the browser.

**Pitch:** Popular PDF tools either cost money or upload your files to their servers. This one is free, and your files never leave your device.

## v1: Core page editor (done)

- Open PDFs by picker or drag and drop, with sample files to try
- Rotate, delete, reorder and extract pages; merge files; download the result
- Works on phones and desktops, tested on real devices
- Scanned pages and PDFs without embedded fonts display correctly
- Files never leave the device, and deleted or unchosen pages are removed from the saved file

**v1 is done when:**

- There is a live deployed link
- It works in recent Chrome and Edge, and in Safari and Chrome on phones (Firefox and desktop Safari are checked later, in v3)
- Core PDF operations have unit tests
- The DevTools Network tab shows no file data being sent anywhere
- The live site has been tested on real phones, including the 300-page sample and downloads (see `TESTING.md`)

## v2: Scans and images

- Turn photos and images (JPG, PNG) into PDF pages
- OCR: add searchable, selectable text to scanned pages, with progress and a cancel button

## v3: Hardening

- Keep form boxes, the title and bookmarks when reordering or extracting pages
- Large files: draw only the thumbnails on screen, and move edits off the main thread
- End-to-end tests in Chromium, Firefox and WebKit
- Accessibility pass, including reordering pages with the keyboard
- README demo GIF, plus the smaller fixes from the v1 code review

## Sample documents

Use content I create myself or that is public domain.

- Multi-page digital PDF (reorder, merge, extract)
- Scanned printed page (OCR), added in v2
- PDF with a sideways page (rotate)
- Large PDF (performance)

## Out of scope

- User accounts, cloud storage, or any backend
- Editing the text content of PDFs
- AI features that need a server

## Decisions log

_One entry per significant decision: what, why, alternatives, trade-offs._

- **Client-side only.** Privacy is the pitch, and there's nothing to host. Alternative: a server with Python PDF libraries, rejected because files would leave the device.
- **Plain JavaScript, HTML and CSS.** The app is small, so a framework or TypeScript would add weight for little gain. Worth revisiting if the UI grows.
- **Strict Content-Security-Policy.** The browser blocks requests to other sites, so the privacy promise is enforced, not just claimed. The key rule is `connect-src 'self'`. It's a `<meta>` tag (from `csp.js`, added by `vite.config.js`) because GitHub Pages can't set headers. `'wasm-unsafe-eval'` allows WebAssembly for PDF.js's image decoders. Limit: a meta tag can't do everything a header can, so it's an extra layer, not a proof.
- **Files are kept as `{ name, bytes, originalBytes }`.** A `File` can't be edited, so the bytes are read once and replaced after each edit. Trade-off: every file stays in memory.
- **SortableJS for dragging.** It handles touch, animation and scrolling. `forceFallback` makes it do the dragging itself, because Firefox can't drag `<button>` elements natively. Alternatives: the browser's drag and drop (no touch support) or custom code (much more to write). Trade-off: about 41 kB.
- **UI split into modules sharing one `state` object.** Modules can't reassign imported variables, so shared data lives in one exported object. The grid asks the list to redraw through a callback, avoiding a circular import.
- **Samples are generated in code, not committed.** No binary files in the repo, and the content is always original. Alternative: committed sample PDFs.
- **Extract adds a new file to the list.** The pages can then be edited, merged or downloaded like any file, and the original is untouched. Alternative: downloading straight away. Trade-off: one more file in memory.
- **Merge uses the ticked files, and extracted files start unticked.** An extracted file repeats pages from its source, so ticking it by default would duplicate them. The button shows the count ("Merge 2 of 4 files").
- **Files over 200 MB are rejected before reading.** Every file is held in memory, so a huge one could crash the tab. `File.size` is known without reading. 200 MB is a guess, to tune in v3. Trade-off: several large files can still add up.
- **Two media queries for phones.** `max-width: 40rem` handles layout, because that depends on width. `pointer: coarse` handles tap sizes, because that depends on using a finger. Two columns, because thumbnails are for recognising pages, not reading them.
- **Press and hold to drag on touch.** Otherwise swiping couldn't scroll a grid of thumbnails. Touch waits 200 ms; the mouse doesn't. Trade-off: the hold isn't obvious, so a hint explains it.
- **Controls are hidden until usable, with a hint saying how to get them.** Greyed-out buttons looked cluttered. `disabled` is only used while an edit or drawing is running, when hiding would make buttons flicker.
- **All page tools in a bar fixed to the bottom.** Testing showed scrolling back up a long file was tedious. The bar floats over the page, so it never moves the thumbnails. Each row shares its width evenly, and phones get a second row once pages are selected. A back-to-top button floats above it, resting beside the disclaimer at the end of the page. Alternative: a toolbar stuck to the top (harder to reach on phones). Trade-off: the bar covers the bottom of the screen.
- **A button opens a hidden file input.** The input's own button said "No file chosen" even with files listed. Trade-off: one small event listener.
- **One shared `<dialog>` confirms Remove, Reset and their "all" versions.** Edits only exist in memory and there's no undo. The dialog handles Esc and focus, and focus starts on Cancel so Enter is safe. The answer comes from the button pressed, not the later `close` event, which could answer a question asked again in the meantime. Alternative: `window.confirm` (can't be styled).
- **Reset keeps the starting bytes, not an edit history.** `bytes` and `originalBytes` share one array until the first edit, so `!==` says whether a file is edited. It's in the bottom bar as "Reset changes". Alternative: multi-step undo (more memory and UI). Trade-off: an edited file holds two versions.
- **The page is locked while an edit or merge runs.** Everything except the bottom bar is made `inert`, so nothing can change mid-task, and the grid can be updated in place. Drawing isn't locked, because it only reads and stops cleanly, but edits wait for it. The bar is disabled rather than inert so screen readers still announce its buttons, and errors show after unlocking for the same reason. The page greys out only after 0.4 s, so quick edits don't flash. Alternative: handling each mid-edit case (easy to miss one). Trade-off: a slow edit can't be cancelled.
- **Thumbnails are laid out before being drawn.** On iPhone, taps did nothing while the grid kept growing. Now blank thumbnails of the right size go in first, then get drawn, so nothing moves. The hint line says when pages are drawing. Trade-off: a short wait while page sizes are read.
- **Thumbnails are drawn at the size they're shown.** A fixed size used about six times the memory needed on an iPhone, and the page sometimes reloaded. Now they match the column width, with screen density capped at 2. Trade-off: after the columns widen (unfolding a phone), thumbnails look a little soft. Redrawing was tried, but it blocked editing.
- **Deleted pages are removed from the saved file.** pdf-lib's `removePage` hides a page but still saves it, so it could be recovered. `saveWithout` in `src/lib/clean.js` detaches links, form fields and bookmarks pointing at removed pages, then deletes everything no longer reachable ("mark and sweep"). If a removed page is still reachable, it copies the kept pages into a new file instead. Extract uses it too, because copying alone brings linked pages along. Trade-off: deleting pages drops bookmarks and custom page numbers.
- **PDF.js's extra files are copied in by a script.** Scans, some fonts and Chinese, Japanese and Korean text need extra PDF.js files, and pages drew blank without them. PDF.js wants them by exact name, so `scripts/copy-pdfjs-assets.js` copies them to `public/pdfjs` before each build. Alternatives: importing them (Vite renames files) or committing copies (they'd fall out of date).
