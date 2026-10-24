// Data shared by the UI modules. It is one object because a module can't reassign
// a variable it imported, but every module can change the properties of an object.
export const state = {
  // The PDFs the user has chosen, in order, as { name, bytes }. The bytes are read
  // once when a file is added; edits replace them. Merging uses this list.
  // A file made by extracting pages also has `extractedFrom` (its source file), and
  // a file that has been extracted from has `extractionCount`.
  files: [],
  // The file the user wants previewed. Stays put when other files are added or removed.
  previewedFile: null,
};
