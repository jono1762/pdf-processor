import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRef } from 'pdf-lib';

// pdf-lib's removePage hides a page, but saving still writes it into the file.
// saveWithout makes sure removed pages are really gone.

/**
 * Saves a document after removing pages, leaving out everything only they used.
 * @param {PDFDocument} doc - edited in place with removePage
 * @param {PDFRef[]} removedPages - the refs of the removed pages, taken before removing
 * @returns {Promise<Uint8Array>} the saved PDF
 */
export async function saveWithout(doc, removedPages) {
  // A ref's tag is text like "12 0 R", easy to keep in a Set
  const removed = new Set(removedPages.map((ref) => ref.tag));
  if (removed.size > 0) {
    detachFromRemovedPages(doc, removed);
    const reachable = sweep(doc);
    // Something unexpected still points at a removed page. Rather than risk it, copy
    // the kept pages into a new file (losing form fields and bookmarks).
    if ([...removed].some((tag) => reachable.has(tag))) {
      return copyIntoNewFile(doc, removed);
    }
  }
  return doc.save();
}

// Removes references to removed pages, which would keep them in the file
function detachFromRemovedPages(doc, removed) {
  const catalog = doc.catalog;
  const pointsAtRemoved = (destination) => {
    // A destination is a page and a view, e.g. [page /Fit]
    const array = doc.context.lookup(destination);
    const page = array instanceof PDFArray ? array.get(0) : undefined;
    return page instanceof PDFRef && removed.has(page.tag);
  };

  // File-wide lists that refer to pages are dropped rather than rebuilt: bookmarks,
  // custom page numbers, named targets, accessibility tags and article threads
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

  // Links on kept pages that jump to a removed page
  const keptAnnotations = new Set();
  for (const page of keptPages(doc, removed)) {
    const annots = page.node.Annots();
    if (!annots) continue;
    // Backwards, since removing one shifts the rest
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

  // Form fields only on removed pages go, with their values. A field's box (its
  // "widget") is either the field itself or one of its Kids.
  const acroForm = catalog.getAcroForm();
  if (!acroForm) return;
  for (const [field, ref] of acroForm.getAllFields()) {
    // Skip parent fields, which only group others
    if (typeof field.getWidgets !== 'function') continue;
    const kids = field.Kids()?.asArray() ?? [];
    const boxes = kids.length > 0 ? kids : [ref];
    const onAKeptPage = boxes.some(
      (box) => box instanceof PDFRef && keptAnnotations.has(box.tag),
    );
    if (!onAKeptPage) {
      acroForm.removeField(field);
    } else if (kids.length > 0) {
      // A field on several pages keeps its other boxes
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

// Mark and sweep: mark every object reachable from the top of the file, delete the
// rest, and return the reachable tags.
function sweep(doc) {
  const { context } = doc;
  const reachable = new Set();
  // Start from the catalog (Root) and the title and author (Info)
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
      // A stream (content, image, font) can refer to more in its dict
      toVisit.push(object.dict);
    }
  }
  for (const [ref] of context.enumerateIndirectObjects()) {
    if (!reachable.has(ref.tag)) context.delete(ref);
  }
  return reachable;
}

// The pages still in the document. pdf-lib's getPages still lists removed pages.
function keptPages(doc, removed) {
  return doc.getPages().filter((page) => !removed.has(page.ref.tag));
}

// Fallback: a new file with copies of the kept pages, plus the title and author
async function copyIntoNewFile(doc, removed) {
  const fresh = await PDFDocument.create();
  // copyPages uses getPages' list, so find the kept pages' positions in it
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
