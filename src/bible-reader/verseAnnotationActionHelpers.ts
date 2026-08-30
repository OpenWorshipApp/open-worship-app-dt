import BibleItem from '../bible-list/BibleItem';
import { bibleRenderHelper } from '../bible-list/bibleRenderHelpers';
import type BibleItemsViewController from './BibleItemsViewController';
import {
    removeVerseAnnotation,
    type VerseAnchorType,
    type VerseAnnotationsType,
} from '../bible-list/note/verseAnnotationHelpers';
import {
    VERSE_ANNOTATION_ANCHOR_ATTR,
    VERSE_ANNOTATION_ANCHOR_SELECTOR,
    checkIsOverlapping,
    getOffsetsFromRange,
    type VerseOffsetsType,
} from './bibleVerseAnnotationHelpers';

/** Everything the comment editor needs to open on one comment. */
export type VerseCommentTargetType = {
    filePath: string;
    noteItemId: number;
    commentId: string;
    comment: string;
    title: string;
    // Carried so the editor can set itself in the bible's own face. Derivable
    // from `title` — the key is in its parentheses — but a display string is a
    // poor thing to parse, and every caller already has this one.
    verseKey: string;
};

export type VerseSelectionType = {
    verseKey: string;
    offsets: VerseOffsetsType;
    rect: DOMRect;
};

function toAnchorElement(node: Node | null): Element | null {
    const element =
        node === null || node.nodeType === Node.ELEMENT_NODE
            ? (node as Element | null)
            : node.parentElement;
    return element?.closest(VERSE_ANNOTATION_ANCHOR_SELECTOR) ?? null;
}

/**
 * What is selected right now, if it is a run of text inside ONE verse.
 *
 * A selection that spans two verses is refused rather than clamped: marks are
 * offsets into a single verse's text, so half of such a selection would be
 * silently dropped and the user would have no way to see which half.
 */
export function readVerseSelection(): VerseSelectionType | null {
    const selection = globalThis.getSelection();
    if (
        selection === null ||
        selection.isCollapsed ||
        selection.rangeCount === 0
    ) {
        return null;
    }
    const range = selection.getRangeAt(0);
    const anchorElement = toAnchorElement(range.commonAncestorContainer);
    if (anchorElement === null) {
        return null;
    }
    const verseKey = anchorElement.getAttribute(VERSE_ANNOTATION_ANCHOR_ATTR);
    if (verseKey === null) {
        return null;
    }
    const offsets = getOffsetsFromRange(anchorElement, range);
    if (offsets === null) {
        return null;
    }
    return { verseKey, offsets, rect: range.getBoundingClientRect() };
}

/**
 * `(KJV) GEN 22:1` → everything the note file wants to file a mark under it,
 * including the localized `(KJV) Genesis 22:1` label the tree row shows.
 */
export async function toVerseAnchor(
    verseKey: string,
): Promise<VerseAnchorType | null> {
    const index = verseKey.indexOf(') ');
    if (index === -1) {
        return null;
    }
    const shortVerse = verseKey.slice(index + 2);
    try {
        const { bibleKey, ...target } =
            bibleRenderHelper.fromBibleVerseKey(verseKey);
        const localeTitle = await bibleRenderHelper.toTitle(bibleKey, target);
        return {
            verseKey,
            shortVerse,
            title: `(${bibleKey}) ${localeTitle}`,
        };
    } catch (_error) {
        // A key this malformed cannot be filed against a verse at all; the
        // caller shows nothing rather than writing a row nobody can read.
        return null;
    }
}

/**
 * Every mark on this verse that the given range touches, in the form the delete
 * call wants. Used by the toolbar's erase button, which acts on what the user
 * dragged over rather than asking them to pick a mark out of a list.
 */
export function toOverlappingAnnotationRefs(
    annotations: VerseAnnotationsType | undefined,
    start: number,
    end: number,
) {
    if (annotations === undefined) {
        return [];
    }
    const refs: { filePath: string; noteItemId: number; id: string }[] = [];
    for (const { filePath, noteItemId, highlight } of annotations.highlights) {
        if (checkIsOverlapping(highlight, start, end)) {
            refs.push({ filePath, noteItemId, id: highlight.id });
        }
    }
    for (const { filePath, noteItemId, comment } of annotations.comments) {
        if (checkIsOverlapping(comment, start, end)) {
            refs.push({ filePath, noteItemId, id: comment.id });
        }
    }
    return refs;
}

/**
 * Deleted one after another, never in parallel: the write path serializes per
 * note file anyway, and two overlapping read-modify-writes of the same file
 * would only queue behind each other with the second holding a stale copy.
 */
export async function removeAnnotationRefs(
    refs: { filePath: string; noteItemId: number; id: string }[],
) {
    for (const { filePath, noteItemId, id } of refs) {
        await removeVerseAnnotation(filePath, noteItemId, id);
    }
    return refs.length;
}

/**
 * The verse a mark belongs to, as a bible item.
 *
 * Built synchronously out of the stored key rather than through
 * `BibleItem.fromTitleText`, which is async: `dragstart` has to have its payload
 * ready in the same tick, and an item that resolves a moment later is an item
 * that never makes it into the drag.
 */
export function toVerseBibleItem(verseKey: string) {
    try {
        const { bibleKey, ...target } =
            bibleRenderHelper.fromBibleVerseKey(verseKey);
        return BibleItem.fromJson({
            // -1 until the receiving list assigns one, the same as every other
            // newly created bible item.
            id: -1,
            bibleKey,
            target,
            metadata: {},
        });
    } catch (_error) {
        return null;
    }
}

/**
 * The bible key a verse key was marked in — `"(KJV) GEN 22:1"` → `"KJV"`.
 *
 * Read off the string rather than through `fromBibleVerseKey` so a row can pick
 * its font without parsing a target it is not going to use.
 */
export function toVerseBibleKey(verseKey: string) {
    const index = verseKey.indexOf(') ');
    return index === -1 ? null : verseKey.slice(1, index);
}

/**
 * Open a verse as ANOTHER bible view rather than replacing what is on screen.
 *
 * `BibleItemRenderComp`'s own opening is a plain click on a list of passages you
 * are choosing between, so it takes over the lookup; a mark is a place you kept
 * inside a passage you are already reading, and losing that passage to reach it
 * would be the opposite of the point.
 */
export function openVerseBibleItem(
    viewController: BibleItemsViewController,
    bibleItem: BibleItem,
) {
    const lastBibleItem = viewController.straightBibleItems.pop();
    if (lastBibleItem === undefined) {
        viewController.addBibleItem(null, bibleItem, false, false, false);
        return;
    }
    viewController.addBibleItemRight(lastBibleItem, bibleItem);
}
