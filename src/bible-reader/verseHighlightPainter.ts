import { useMemo } from 'react';
import type { RefObject } from 'react';

import { useAppEffect } from '../helper/appHooks';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import {
    VERSE_HIGHLIGHT_COLOR_KEYS,
    type VerseHighlightColorKeyType,
} from '../bible-list/note/noteItemHelpers';
import { useBibleVerseAnnotations } from '../bible-list/note/bibleNoteShortVerseHelpers';
import type { VerseAnnotationsMapType } from '../bible-list/note/verseAnnotationHelpers';
import {
    VERSE_ANNOTATION_ANCHOR_ATTR,
    VERSE_ANNOTATION_ANCHOR_SELECTOR,
    createRangeFromOffsets,
} from './bibleVerseAnnotationHelpers';

/**
 * Verse marks are painted with the CSS Custom Highlight API rather than by
 * wrapping the marked words in `span`s.
 *
 * Two reasons, both decisive. It adds ZERO DOM nodes however many marks are on
 * screen, which is what this app's target hardware needs; and the verse text is
 * not always React's to wrap — the words-of-Christ markup arrives through
 * `dangerouslySetInnerHTML`, and the in-text lookup splits text nodes outside
 * React. Painting over live `Range`s sidesteps both.
 *
 * The cost is that a highlight is not an element: it cannot be hovered or
 * clicked. That is what `getOffsetFromPoint` hit-testing is for.
 */
export function toHighlightName(color: VerseHighlightColorKeyType) {
    return `owa-verse-hl-${color}`;
}
export const VERSE_COMMENT_HIGHLIGHT_NAME = 'owa-verse-comment';

// Module level, evaluated once: jsdom has neither `Highlight` nor
// `CSS.highlights`, and an unguarded `.set()` throws in every test that mounts a
// verse. `globalThis.CSS` itself DOES exist there (escape/supports).
const isHighlightApiAvailable =
    typeof Highlight === 'function' &&
    typeof globalThis.CSS?.highlights?.set === 'function';

/**
 * `CSS.highlights` is per-document, so these are correctly one set per window.
 * Created once and then only ever cleared and refilled — re-registering a name
 * on every repaint would drop the stylesheet's binding for a frame.
 */
const highlightMap = new Map<string, Highlight>();
function getHighlight(name: string) {
    let highlight = highlightMap.get(name);
    if (highlight === undefined) {
        highlight = new Highlight();
        highlightMap.set(name, highlight);
        globalThis.CSS.highlights.set(name, highlight);
    }
    return highlight;
}

const containerElements = new Set<Element>();
let verseAnnotationsMap: VerseAnnotationsMapType = {};

function clearAllHighlights() {
    for (const highlight of highlightMap.values()) {
        highlight.clear();
    }
}

function paintContainer(containerElement: Element) {
    const anchorElements = containerElement.querySelectorAll(
        VERSE_ANNOTATION_ANCHOR_SELECTOR,
    );
    for (const anchorElement of anchorElements) {
        const verseKey = anchorElement.getAttribute(
            VERSE_ANNOTATION_ANCHOR_ATTR,
        );
        if (verseKey === null) {
            continue;
        }
        const annotations = verseAnnotationsMap[verseKey];
        if (annotations === undefined) {
            continue;
        }
        for (const { highlight } of annotations.highlights) {
            addAnnotationRange(
                anchorElement,
                highlight,
                toHighlightName(highlight.color),
            );
        }
        for (const { comment } of annotations.comments) {
            addAnnotationRange(
                anchorElement,
                comment,
                VERSE_COMMENT_HIGHLIGHT_NAME,
            );
        }
    }
}

function addAnnotationRange(
    anchorElement: Element,
    annotation: { start: number; end: number; text: string },
    highlightName: string,
) {
    const range = createRangeFromOffsets(
        anchorElement,
        annotation.start,
        annotation.end,
    );
    if (range === null) {
        return;
    }
    // The only integrity check available. Offsets are positions in text that can
    // change under them — a re-imported bible, an edited custom verse — and a
    // mark painted at a stale offset is worse than one not painted at all,
    // because it silently colours words the user never chose.
    if (range.toString() !== annotation.text) {
        return;
    }
    getHighlight(highlightName).add(range);
}

// Module level, and correctly so: this guards a registry that is singleton by
// construction — one per document — not one instance among many.
const attemptRepaint = genTimeoutAttempt(200);

function repaint() {
    if (!isHighlightApiAvailable) {
        return;
    }
    clearAllHighlights();
    for (const containerElement of containerElements) {
        paintContainer(containerElement);
    }
}

export function requestVerseHighlightRepaint() {
    attemptRepaint(repaint);
}

/**
 * Keeps a bible view's marks painted.
 *
 * The repaint is driven by a `MutationObserver` on the whole container rather
 * than by enumerating the things that can invalidate a `Range` — and there are
 * many: the chapter changing while React REUSES the verse elements and only
 * rewrites their text, the lookup index resolving and re-segmenting a verse
 * hundreds of milliseconds after mount, custom verse HTML being re-set,
 * comparison columns appearing. One observer per bible view is a handful per
 * window; the per-verse alternative would be 500+ on a long psalm.
 *
 * Painting never touches the DOM, so the observer cannot re-trigger itself.
 */
export function useVerseHighlightPainting(
    containerRef: RefObject<HTMLElement | null>,
) {
    const annotationsMap = useBibleVerseAnnotations();
    useAppEffect(() => {
        verseAnnotationsMap = annotationsMap;
        requestVerseHighlightRepaint();
    }, [annotationsMap]);
    // Per instance: several bible views can be mounted at once, and a shared
    // timer would let one view's pending repaint be cancelled by another's.
    const attemptObservedRepaint = useMemo(() => {
        return genTimeoutAttempt(200);
    }, []);
    useAppEffect(() => {
        const containerElement = containerRef.current;
        if (containerElement === null || !isHighlightApiAvailable) {
            return;
        }
        containerElements.add(containerElement);
        requestVerseHighlightRepaint();
        const observer = new MutationObserver(() => {
            attemptObservedRepaint(repaint);
        });
        observer.observe(containerElement, {
            childList: true,
            subtree: true,
            characterData: true,
        });
        return () => {
            observer.disconnect();
            containerElements.delete(containerElement);
            // Nothing is held once the last bible view goes: the ranges point at
            // detached nodes the moment the container unmounts.
            if (containerElements.size === 0) {
                clearAllHighlights();
                verseAnnotationsMap = {};
            } else {
                requestVerseHighlightRepaint();
            }
        };
    }, [containerRef, attemptObservedRepaint]);
}

export { VERSE_HIGHLIGHT_COLOR_KEYS };
