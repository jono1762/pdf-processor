import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRef } from 'pdf-lib';

// pdf-lib's removePage takes a page out of the document's page list, so no reader
// shows it, but the page's content stays in the file when it is saved, where a PDF
// inspection tool could still find it. saveWithout makes sure removed pages are
// really gone.

/**
 * Saves a document after pages have been removed from it, leaving out everything
 * that only those pages used.
 * @param {PDFDocument} doc - edited in place with removePage
 * @param {PDFRef[]} removedPages - the refs of the removed pages, taken before removing
 * @returns {Promise<Uint8Array>} the saved PDF
 */
export async function saveWithout(doc, removedPages) {
  // A ref's tag is a short text like "12 0 R", easy to keep in a Set and compare
  const removed = new Set(removedPages.map((ref) => ref.tag));
  if (removed.size > 0) {
    detachFromRemovedPages(doc, removed);
    const reachable = sweep(doc);
    // Something we don't know about still points at a removed page. Rather than
    // risk keeping it, copy the remaining pages into a brand-new file, which can
    // only contain what those pages use (but loses the file-level details).
    if ([...removed].some((tag) => reachable.has(tag))) {
      return copyIntoNewFile(doc, removed);
    }
  }
  return doc.save();
}

// Takes away everything that points at a removed page, which would otherwise keep
// it in the file
function detachFromRemovedPages(doc, removed) {
  const catalog = doc.catalog;
  const pointsAtRemoved = (destination) => {
    // A destination is a page plus where to look on it, e.g. [page /Fit]
    const array = doc.context.lookup(destination);
    const page = array instanceof PDFArray ? array.get(0) : undefined;
    return page instanceof PDFRef && removed.has(page.tag);
  };

  // File-wide lists that refer to pages. Rebuilding them without the removed pages
  // would be complex, so they are dropped: the bookmarks sidebar, custom page
  // numbers ("i, ii, iii"), named jump targets, the accessibility tags (which
  // record which page each piece of text is on) and article threads.
  for (const key of ['Outlines', 'PageLabels', 'Dests', 'StructTreeRoot']) {
    catalog.delete(PDFName.of(key));
  }
  catalog.delete(PDFName.of('MarkInfo'));
  catalog.delete(PDFName.of('Threads'));
  catalog
    .lookupMaybe(PDFName.of('Names'), PDFDict)
    ?.delete(PDFName.of('Dests'));
  // The page the file opens at
  if (pointsAtRemoved(catalog.get(PDFName.of('OpenAction')))) {
    catalog.delete(PDFName.of('OpenAction'));
  }

  // Links on the kept pages that jump to a removed page
  const keptAnnotations = new Set();
  for (const page of keptPages(doc, removed)) {
    const annots = page.node.Annots();
    if (!annots) continue;
    // Backwards, so removing one doesn't shift the ones still to check
    for (let i = annots.size() - 1; i >= 0; i--) {
      const entry = annots.get(i);
      const annot = doc.context.lookup(entry);
      const action = annot?.lookupMaybe?.(PDFName.of('A'), PDFDict);
      const target =
        annot?.get?.(PDFName.of('Dest')) ?? action?.get(PDFName.of('D'));
      if (target && pointsAtRemoved(target)) {
        annots.remove(i);
      } else if (entry instanceof PDFRef) {
        keptAnnotations.add(entry.tag);
      }
    }
  }

  // Form boxes that were only on removed pages. Their typed-in values are part of
  // the field, so the field itself must go. A box (a "widget") is either the field
  // itself or one of its Kids.
  const acroForm = catalog.getAcroForm();
  if (!acroForm) return;
  for (const [field, ref] of acroForm.getAllFields()) {
    // Only fields that have boxes; parent fields just group others
    if (typeof field.getWidgets !== 'function') continue;
    const kids = field.Kids()?.asArray() ?? [];
    const boxes = kids.length > 0 ? kids : [ref];
    const onAKeptPage = boxes.some(
      (box) => box instanceof PDFRef && keptAnnotations.has(box.tag),
    );
    if (!onAKeptPage) {
      acroForm.removeField(field);
    } else if (kids.length > 0) {
      // A field with boxes on several pages stays, but loses its boxes on removed
      // pages, since each box points back at its page. Backwards, as above.
      const kidList = field.Kids();
      for (let i = kidList.size() - 1; i >= 0; i--) {
        const box = kidList.get(i);
        if (box instanceof PDFRef && !keptAnnotations.has(box.tag)) {
          kidList.remove(i);
        }
      }
    }
  }
}

// Mark and sweep: starting from the top of the file, mark every object that can
// still be reached by following references, then delete every object that wasn't
// marked. Returns the tags of the reachable objects.
function sweep(doc) {
  const { context } = doc;
  const reachable = new Set();
  // Objects still to look inside. The trailer's Root (the catalog) and Info (title,
  // author) are where every reader starts.
  const toVisit = [context.trailerInfo.Root, context.trailerInfo.Info];
  while (toVisit.length > 0) {
    const object = toVisit.pop();
    if (object instanceof PDFRef) {
      if (reachable.has(object.tag)) continue;
      reachable.add(object.tag);
      toVisit.push(context.lookup(object));
    } else if (object instanceof PDFDict) {
      toVisit.push(...object.values());
    } else if (object instanceof PDFArray) {
      toVisit.push(...object.asArray());
    } else if (object?.dict instanceof PDFDict) {
      // A stream (page content, an image, a font): its settings can refer to more
      toVisit.push(object.dict);
    }
  }
  for (const [ref] of context.enumerateIndirectObjects()) {
    if (!reachable.has(ref.tag)) context.delete(ref);
  }
  return reachable;
}

// The pages still in the document. pdf-lib's removePage doesn't update the list that
// getPages returns, so removed pages are still in it, and are filtered out here.
function keptPages(doc, removed) {
  return doc.getPages().filter((page) => !removed.has(page.ref.tag));
}

// The fallback: a new file with copies of the remaining pages, plus the title and
// author, which are plain text and safe to carry over
async function copyIntoNewFile(doc, removed) {
  const fresh = await PDFDocument.create();
  // copyPages counts pages in getPages' list too, so find the kept ones' places in it
  const all = doc.getPages();
  const keptIndices = keptPages(doc, removed).map((page) => all.indexOf(page));
  const pages = await fresh.copyPages(doc, keptIndices);
  pages.forEach((page) => fresh.addPage(page));
  const title = doc.getTitle();
  const author = doc.getAuthor();
  if (title) fresh.setTitle(title);
  if (author) fresh.setAuthor(author);
  return fresh.save();
}
