import Sortable from 'sortablejs';

/**
 * Makes the children of `element` draggable to reorder, with the drag settings
 * shared by every sortable list in the app. SortableJS moves the elements on
 * screen; the caller's `onEnd` makes the real data match.
 * @param {HTMLElement} element - the list or grid whose children can be dragged
 * @param {import('sortablejs').Options} options - settings specific to this list,
 *   which also override the shared ones
 * @returns {Sortable}
 */
export function createSortable(element, options) {
  return Sortable.create(element, {
    // Items slide into place over 150 milliseconds
    animation: 150,
    // SortableJS does the dragging itself instead of the browser. The browser's own
    // support doesn't work on <button> elements in Firefox, and this gives the same
    // lifted-copy look everywhere.
    forceFallback: true,
    // Moving less than this many pixels counts as a click, so clicking still works
    fallbackTolerance: 5,
    ...options,
  });
}
