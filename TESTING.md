# Testing

## Automated

Unit tests (Vitest) cover the PDF operations in `src/lib/` and the file helpers in `src/ui/download.js`, including that deleted and unchosen pages are really gone from saved files. GitHub Actions runs them on every push, with lint, the format check and the build. The site only deploys if all pass.

## Manual, on real devices

The live site was tested by hand in November 2026:

| Device                                      | System          | Browser              |
| ------------------------------------------- | --------------- | -------------------- |
| Honor MagicBook Pro 16 (2025) laptop        | Windows 11 26H2 | Chrome 156, Edge 157 |
| Samsung Galaxy Z Fold5, folded and unfolded | Android 17      | Chrome 156           |
| iPhone 12                                   | iOS 26.3.1      | Safari               |

Test files: generated ones (100 pages, 20 image-heavy pages, password-protected, broken, and not a PDF), the built-in samples, a public US tax form, and real PDFs from different software, including a faxed scan. Real files stayed on the tester's devices.

**Computer:** adding files, broken and protected files, rotate, delete, drag, extract, merge, Reset, dialogs with the keyboard, large files and Remove all. Downloads were checked in a separate PDF reader.

**Phones:** layout, the file chooser, swiping versus tapping versus holding to drag, the bottom bar, edits, dialogs (including Android's back button), downloads, the 300-page sample, and folding and unfolding.

## What testing found

| Found                                             | Where  | Fix                                      |
| ------------------------------------------------- | ------ | ---------------------------------------- |
| A faxed scan showed blank pages                   | All    | PDF.js's image decoders are now included |
| Downloads always ended in `-edited`               | All    | Only edited files get it                 |
| The 300-page sample refilled after a rotate       | All    | Edits update the grid in place           |
| A focus ring showed on Cancel in dialogs          | iPhone | Hidden on touch screens                  |
| Scrolling back up to the tools was tedious        | All    | The tools moved to a bar at the bottom   |
| Taps did nothing while a long file drew           | iPhone | Pages are laid out before drawing        |
| The page sometimes reloaded, likely out of memory | iPhone | Thumbnails are drawn at their shown size |

A code review before release also found that deleted pages stayed hidden in saved files, and extracted files could carry other pages through links. Both are fixed and unit tested.

## Known gaps

- Firefox and desktop Safari aren't tested, and the page itself has no automated tests yet (planned for v3).
- The image-heavy file wasn't tried on the iPhone, so the reloads may not be fully ruled out.
- The code review fixes are unit tested but weren't retested on the phones.
- Nothing has been tested with a screen reader yet (v3).
