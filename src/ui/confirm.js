// Added to every question about throwing work away, because edits exist only in
// the page's memory until they are downloaded
export const LOST_CHANGES_WARNING =
  "Any changes you haven't downloaded will be lost.";

const dialog = document.querySelector('#confirm-dialog');
const text = document.querySelector('#confirm-text');
const cancelButton = document.querySelector('#confirm-cancel');
const confirmButton = document.querySelector('#confirm-button');

// The waiting caller's resolve function while the dialog is open, so the answer can
// be handed to it. Cleared once answered, so one answer can't be given twice.
let answer = null;

// Answers the open question and closes the dialog. The answer is decided here, when
// the user acts, not when the browser later fires the dialog's "close" event. That
// event arrives a moment after closing, so if the dialog had been opened again in
// that moment, it would answer the new question instead of the old one.
function finish(confirmed) {
  const resolve = answer;
  answer = null;
  dialog.close();
  resolve?.(confirmed);
}

cancelButton.addEventListener('click', () => finish(false));
confirmButton.addEventListener('click', () => finish(true));
// Esc, or Android's back button, fires "cancel" on a modal dialog before closing it
dialog.addEventListener('cancel', () => finish(false));

/**
 * Asks the user to confirm an action that can't be undone.
 * @param {string} question What to ask, shown in the dialog
 * @param {string} actionLabel What the confirm button says
 * @returns {Promise<boolean>} true if the user confirmed; false if they cancelled
 */
export function confirmAction(question, actionLabel) {
  // textContent (not innerHTML) because the question can include a file name
  text.textContent = question;
  confirmButton.textContent = actionLabel;
  // showModal blocks the rest of the page and handles Esc and keyboard focus
  dialog.showModal();

  // The answer comes later, so hand back a promise that the caller can wait for.
  // finish() resolves it when the user chooses.
  return new Promise((resolve) => {
    answer = resolve;
  });
}
