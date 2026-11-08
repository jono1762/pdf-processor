// Added to every question about throwing work away, because edits exist only in
// the page's memory until they are downloaded
export const LOST_CHANGES_WARNING =
  "Any changes you haven't downloaded will be lost.";

const dialog = document.querySelector('#confirm-dialog');
const text = document.querySelector('#confirm-text');
const cancelButton = document.querySelector('#confirm-cancel');
const confirmButton = document.querySelector('#confirm-button');

// The value passed to close() becomes the dialog's returnValue
cancelButton.addEventListener('click', () => dialog.close());
confirmButton.addEventListener('click', () => dialog.close('confirm'));

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
  // Cancel and Esc close the dialog without setting this, so clear the previous
  // answer first
  dialog.returnValue = '';
  // showModal blocks the rest of the page and handles Esc and keyboard focus
  dialog.showModal();

  // The answer comes later, so hand back a promise that the caller can wait for.
  // once: true removes the listener after it runs, so old answers can't pile up.
  return new Promise((resolve) => {
    dialog.addEventListener(
      'close',
      () => resolve(dialog.returnValue === 'confirm'),
      { once: true },
    );
  });
}
