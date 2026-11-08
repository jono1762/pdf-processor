// Copies files PDF.js loads only when a PDF needs them into public/pdfjs. PDF.js
// asks for them by their exact names from a folder, so they can't be imported
// (Vite would rename them). npm runs this before `dev` and `build`. The copies
// aren't committed, so they always match the installed version of PDF.js.
import { copyFileSync, cpSync, mkdirSync } from 'node:fs';

const FROM = 'node_modules/pdfjs-dist';
const TO = 'public/pdfjs';

// Image decoders
const WASM_FILES = [
  'jbig2.wasm', // fax and JBIG2 images, common in scans
  'openjpeg.wasm', // JPEG 2000 images
  'qcms_bg.wasm', // colour profiles
  // Slower versions for browsers that block WebAssembly
  'jbig2_nowasm_fallback.js',
  'openjpeg_nowasm_fallback.js',
];

mkdirSync(`${TO}/wasm`, { recursive: true });
for (const file of WASM_FILES) {
  copyFileSync(`${FROM}/wasm/${file}`, `${TO}/wasm/${file}`);
}

// Whole folders: fonts for PDFs that don't include their own, and character
// maps that many Chinese, Japanese and Korean PDFs need to show any text
for (const folder of ['standard_fonts', 'cmaps']) {
  cpSync(`${FROM}/${folder}`, `${TO}/${folder}`, { recursive: true });
}
