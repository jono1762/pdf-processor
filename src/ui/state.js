// Data shared by the UI modules. It is one object because a module can't reassign
// a variable it imported, but every module can change the properties of an object.
export const state = {
  // The PDFs the user has chosen, in order, as { name, bytes, originalBytes }. The
  // bytes are read once when a file is added; edits replace them. originalBytes keeps
  // what the file started as, for Reset. Until the first edit both point to the same
  // array, so an unedited file uses no extra memory. Merging uses this list.
  // A file made by extracting pages also has `extractedFrom` (its source file), and
  // a file that has been extracted from has `extractionCount`. A file the user has
  // unticked for merging has `excludedFromMerge: true`; without it, it is merged.
  files: [],
  // The file the user wants previewed. Stays put when other files are added or removed.
  previewedFile: null,
};

/**
 * Says whether a file has been edited since it was added (or extracted, or reset).
 * @param {{ bytes: Uint8Array, originalBytes: Uint8Array }} file - from state.files
 * @returns {boolean}
 */
export function isEdited(file) {
  // Compares the arrays themselves, not their contents: every edit makes a new
  // array, so they only match until the first edit. This is instant for any size.
  return file.bytes !== file.originalBytes;
}
