/**
 * Mapping between a DOM selection and the character offsets a verse mark is
 * stored as.
 *
 * Deliberately dependency-free — no React, no app modules — so it can be unit
 * tested against real DOM in jsdom with nothing mocked. Importing it must never
 * drag `appProvider` (and therefore `document` at module scope) into a node-env
 * test.
 *
 * The offset space is the concatenation of the text nodes inside the verse's
 * anchor element, which is NOT the same as the verse's source text: the
 * words-of-Christ markup renders through `dangerouslySetInnerHTML`, and the
 * in-text lookup splits text nodes around every matched name.
 */

/** Stamped on the element whose text the offsets are measured against. */
export const VERSE_ANNOTATION_ANCHOR_ATTR = 'data-bible-verse-key';
export const VERSE_ANNOTATION_ANCHOR_SELECTOR = `[${VERSE_ANNOTATION_ANCHOR_ATTR}]`;

export type VerseOffsetsType = {
    start: number;
    end: number;
    text: string;
};

/**
 * `Range.toString()` concatenates text-node data only — unlike
 * `Selection.toString()`, which inserts newlines for `<br>` and block
 * boundaries. Measuring with a probe range therefore gives exactly the offset
 * space `createRangeFromOffsets` walks back over, and it normalizes the two
 * shapes a real selection arrives in: a double-click lands its boundary on an
 * element rather than a text node, and a triple-click hands over
 * `(element, childIndex)`.
 */
export function getOffsetsFromRange(
    rootElement: Element,
    range: Range,
): VerseOffsetsType | null {
    if (
        !rootElement.contains(range.startContainer) ||
        !rootElement.contains(range.endContainer)
    ) {
        // The selection runs past this verse. Anchoring it here would silently
        // mark the wrong words, so it is refused outright.
        return null;
    }
    const text = range.toString();
    if (text.length === 0) {
        return null;
    }
    const probeRange = document.createRange();
    probeRange.selectNodeContents(rootElement);
    probeRange.setEnd(range.startContainer, range.startOffset);
    const start = probeRange.toString().length;
    return { start, end: start + text.length, text };
}

/**
 * Rebuild a live `Range` from stored offsets, or null when the text underneath
 * has changed enough that the offsets no longer land.
 */
export function createRangeFromOffsets(
    rootElement: Element,
    start: number,
    end: number,
): Range | null {
    if (start < 0 || end <= start) {
        return null;
    }
    const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let offset = 0;
    let isStartSet = false;
    let node = walker.nextNode() as Text | null;
    while (node !== null) {
        const nextOffset = offset + node.length;
        // `<` for the start and `<=` for the end: a boundary offset belongs to
        // the START of the next node and to the END of this one. That is what
        // keeps a mark ending on a lookup-link span from also swallowing the
        // space after it, and it drops zero-length nodes for free.
        if (!isStartSet && start < nextOffset) {
            range.setStart(node, start - offset);
            isStartSet = true;
        }
        if (isStartSet && end <= nextOffset) {
            range.setEnd(node, end - offset);
            return range;
        }
        offset = nextOffset;
        node = walker.nextNode() as Text | null;
    }
    return null;
}

/**
 * The character offset under a screen point, for hit-testing a hover against
 * marks that are painted by CSS and therefore have no element to hover.
 */
export function getOffsetFromPoint(
    rootElement: Element,
    clientX: number,
    clientY: number,
): number | null {
    const caretPosition = (
        document as unknown as {
            caretPositionFromPoint?: (
                x: number,
                y: number,
            ) => { offsetNode: Node; offset: number } | null;
        }
    ).caretPositionFromPoint?.(clientX, clientY);
    if (
        caretPosition == null ||
        !rootElement.contains(caretPosition.offsetNode)
    ) {
        return null;
    }
    const probeRange = document.createRange();
    probeRange.selectNodeContents(rootElement);
    probeRange.setEnd(caretPosition.offsetNode, caretPosition.offset);
    return probeRange.toString().length;
}

export function checkIsOffsetInside(
    annotation: { start: number; end: number },
    offset: number,
) {
    return offset >= annotation.start && offset < annotation.end;
}

export function checkIsOverlapping(
    annotation: { start: number; end: number },
    start: number,
    end: number,
) {
    return annotation.start < end && start < annotation.end;
}
