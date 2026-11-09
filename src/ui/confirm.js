// Edits only exist in memory until downloaded
export const LOST_CHANGES_WARNING =
  "Any changes you haven't downloaded will be lost.";

const dialog = document.querySelector('#confirm-dialog');
const text = document.querySelector('#confirm-text');
const cancelButton = document.querySelector('#confirm-cancel');
const confirmButton = document.querySelector('#confirm-button');

// The open question's resolve function, cleared once answered
let answer = null;

// Answers the open question and closes the dialog. Answering here, not on the later
// "close" event, stops a late event answering a question asked again meanwhile.
function finish(confirmed) {
  const resolve = answer;
  answer = null;
  dialog.close();
  resolve?.(confirmed);
}

cancelButton.addEventListener('click', () => finish(false));
confirmButton.addEventListener('click', () => finish(true));
// Esc or Android's back button
dialog.addEventListener('cancel', () => finish(false));

/**
 * Asks the user to confirm an action that can't be undone.
 * @param {string} question What to ask, shown in the dialog
 * @param {string} actionLabel What the confirm button says
 * @returns {Promise<boolean>} true if the user confirmed; false if they cancelled
 */
export function confirmAction(question, actionLabel) {
  // textContent, since the question can include a file name
  text.textContent = question;
  confirmButton.textContent = actionLabel;
  // showModal blocks the page and handles Esc and focus
  dialog.showModal();

  // finish() resolves this when the user chooses
  return new Promise((resolve) => {
    answer = resolve;
  });
}
