// Copies PDF.js's image decoders into public/, because PDF.js asks for them by
// their exact names from a folder, so they can't be imported (Vite would rename
// them). npm runs this before `dev` and `build`. The copies aren't committed, so
// they always match the installed version of PDF.js.
import { copyFileSync, mkdirSync } from 'node:fs';

const FROM = 'node_modules/pdfjs-dist/wasm';
const TO = 'public/wasm';

const FILES = [
  'jbig2.wasm', // fax and JBIG2 images, common in scans
  'openjpeg.wasm', // JPEG 2000 images
  'qcms_bg.wasm', // colour profiles
  // Slower versions for browsers that block WebAssembly
  'jbig2_nowasm_fallback.js',
  'openjpeg_nowasm_fallback.js',
];

mkdirSync(TO, { recursive: true });
for (const file of FILES) {
  copyFileSync(`${FROM}/${file}`, `${TO}/${file}`);
}
