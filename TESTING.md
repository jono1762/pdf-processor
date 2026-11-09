# Testing

How PDF Processor is tested, and what was tested for v1.

## Automated

- **Unit tests** (Vitest) cover the PDF operations in `src/lib/` and the file helpers in `src/ui/download.js`: rotating, deleting, reordering, extracting, merging, the sample files, file checks, download names, and that deleted or unchosen pages are really gone from saved files. They run on every push in GitHub Actions, alongside lint, the format check and the build, and the site only deploys if all of them pass.

## Manual, on real devices

The live site was tested by hand in November 2026 on:

| Device                                      | System          | Browser              |
| ------------------------------------------- | --------------- | -------------------- |
| Honor MagicBook Pro 16 (2025) laptop        | Windows 11 26H2 | Chrome 156, Edge 157 |
| Samsung Galaxy Z Fold5, folded and unfolded | Android 17      | Chrome 156           |
| iPhone 12                                   | iOS 26.3.1      | Safari               |

The test files were generated (a 100-page file, a 20-page image-heavy file, a password-protected file, a broken file and a non-PDF), plus the built-in samples, a public US tax form, and real PDFs from different software, including a faxed scan. Real files were opened only on the tester's own devices and are not part of this repo.

### What was checked

- **Computer:** dropping and choosing files, broken and password-protected files, rotating, deleting and dragging pages, extracting, merging files from different software, Reset and Reset all, keyboard use in the dialogs, large files, and Remove all. Downloads were opened in a separate PDF reader.
- **Phones:** the layout with the address bar shown and hidden, the file chooser, swiping versus tapping versus press and hold to drag, the bottom bar, rotate, delete and extract, the confirmation dialogs (including Android's back button), downloads, the 300-page sample, and folding and unfolding with files open.

### What testing found, and the fixes

| Found                                                                                     | Where        | Fix                                                    |
| ----------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------ |
| A faxed scan previewed as blank pages                                                     | Chrome, Edge | PDF.js's image decoders are now served with the site   |
| Downloads always ended in `-edited`                                                       | All          | Only edited files get it                               |
| The 300-page sample visibly refilled after a rotate                                       | Fold, iPhone | Edits update the grid in place                         |
| A focus ring showed on Cancel when a dialog opened                                        | iPhone       | Hidden on touch screens                                |
| Scrolling back up to the page tools was tedious on long files                             | All          | The tools moved into a bar at the bottom of the screen |
| Taps did nothing while a long file was drawing                                            | iPhone       | Every page is laid out before drawing starts           |
| The page sometimes reloaded with a long file open, most likely from running out of memory | iPhone       | Thumbnails are drawn at the size they're shown         |

A code review before the v1 release also found that deleted pages stayed hidden inside saved files, and that extracted files could carry other pages through links. Both are fixed and covered by unit tests.

### Known gaps

- Firefox and desktop Safari haven't been tested, and the page itself has no automated tests yet: end-to-end tests are planned for v3.
- The 20-page image-heavy file wasn't tested on the iPhone, and the reloads there were rare before the fix, so they may not be fully ruled out.
- The fixes from the code review (deleted and unchosen pages removed from saved files) are covered by unit tests, but weren't retested by hand on the phones.
- Nothing has been tested with a real screen reader yet (part of the v3 accessibility pass).
