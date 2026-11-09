// Copies PDF.js's extra files into public/pdfjs before `dev` and `build`. PDF.js wants
// them by exact name, so they can't be imported (Vite renames files).
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

// Fonts for PDFs without their own, and character maps for Chinese, Japanese and Korean
for (const folder of ['standard_fonts', 'cmaps']) {
  cpSync(`${FROM}/${folder}`, `${TO}/${folder}`, { recursive: true });
}
