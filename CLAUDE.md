# CLAUDE.md

## What this project is

An open-source, browser-only PDF toolkit: merge, split, reorder, rotate and delete pages, and OCR scanned PDFs into searchable PDFs. It is a portfolio project for entry-level software engineering roles. See `PLAN.md` for the roadmap.

## Hard constraints

- **All file processing happens in the browser.** File contents never leave the user's device: no backend, no API calls carrying file data, no analytics that capture anything about the user's files.
- Static assets (app code, OCR language data, worker scripts, models) may be fetched, but prefer self-hosting them over third-party CDNs.
- Must deploy as a plain static site (e.g. GitHub Pages, Netlify).
- No paid services or API keys.

## Stack

I'm keeping to languages I already know: plain JavaScript, HTML and CSS. No TypeScript and no UI framework (React, Vue, etc.).

- Vite as the dev server and build tool (vanilla JavaScript template)
- `pdf-lib` for editing and creating PDFs
- `pdfjs-dist` for rendering pages and thumbnails
- `tesseract.js` for OCR, run in a Web Worker
- Vitest for unit tests
- Use modern JavaScript (ES modules). JSDoc comments on key functions are welcome where they make types clearer.

Do not add new dependencies without asking me first and explaining why.

## How I want to work

I'm learning while building, and I need to be able to explain every part of this codebase in interviews. I'm deliberately building this incrementally, for quality and explainability, rather than trying to generate the whole app in one go.

- Never build a whole milestone or several features at once, even if asked to "continue" or "keep going". Finish one small piece, then stop for my review.
- Work in small, reviewable steps: one feature or concern per change.
- Before a non-trivial change, outline the plan briefly and wait for my OK.
- Keep responses simple and concise.
- After a change, briefly explain what you did and why, including key trade-offs.
- When there are several reasonable approaches, briefly list them with your recommendation instead of choosing silently.
- Prefer simple, readable code over clever code. Add brief comments where intent or JavaScript behaviour isn't obvious, since I'm still learning the language.
- Don't call something done unless it builds, lints and tests pass.
- When we make a significant design decision, add a short entry to the Decisions log in `PLAN.md`.

## Git workflow

- Each feature gets its own branch, built as a sequence of small commits (one step each, e.g. function, then tests, then edge cases). I commit after each step, so stop after each one. Milestones are marked with version tags.
- You implement; I review the code and do all commits, merges and tags myself. Never run `git commit`, `git push`, `git merge` or `git tag`.
- At the start of a task, check the current branch. If it doesn't match the feature, tell me and suggest a branch name rather than switching yourself.
- When a change is ready for review, suggest a short commit message.

## Code conventions

- Keep PDF logic as plain functions in `src/lib/`, separate from the UI code, so it can be unit tested without the UI.
- Heavy work (OCR, rendering many pages) must not block the main thread.
- Fail visibly: encrypted, corrupted or very large files should show a clear message, never crash or fail silently.

## Test and sample data

- All test fixtures and demo samples must be generated or public domain. Never use, request or commit personal files.
- Prefer generating test PDFs in code (e.g. with `pdf-lib`) so tests don't depend on binary files. Store any fixed sample files in one clearly named folder.
- Never read files outside this repo to use as test data.

## Commands

- `npm run dev`
- `npm run build`
- `npm test`
- `npm run lint`
- `npm run format`
