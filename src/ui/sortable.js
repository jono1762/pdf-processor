import Sortable from 'sortablejs';

/**
 * Makes `element`'s children draggable, with shared settings. SortableJS moves them
 * on screen; the caller's `onEnd` updates the data.
 * @param {HTMLElement} element - the list or grid whose children can be dragged
 * @param {import('sortablejs').Options} options - settings specific to this list,
 *   which also override the shared ones
 * @returns {Sortable}
 */
export function createSortable(element, options) {
  return Sortable.create(element, {
    // Slide into place over 150 ms
    animation: 150,
    // SortableJS drags, not the browser, which can't drag buttons in Firefox
    forceFallback: true,
    // Moving less than this counts as a click
    fallbackTolerance: 5,
    ...options,
  });
}
