// Data shared by the UI modules. An object, because modules can't reassign imported
// variables but can change an object's properties.
export const state = {
  // The files in order, as { name, bytes, originalBytes }. Edits replace `bytes`;
  // `originalBytes` is for Reset, and shares the same array until the first edit.
  // Optional: `extractedFrom` (the source file), `extractionCount`, and
  // `excludedFromMerge` (unticked).
  files: [],
  // The file whose pages are shown
  previewedFile: null,
};

/**
 * Says whether a file has been edited since it was added (or extracted, or reset).
 * @param {{ bytes: Uint8Array, originalBytes: Uint8Array }} file - from state.files
 * @returns {boolean}
 */
export function isEdited(file) {
  // Compares the arrays, not their contents: each edit makes a new array
  return file.bytes !== file.originalBytes;
}
