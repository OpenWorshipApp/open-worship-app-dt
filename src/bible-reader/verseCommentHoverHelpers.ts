import { useMemo, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { useBibleVerseAnnotations } from '../bible-list/note/bibleNoteShortVerseHelpers';
import type { VerseAnnotationsMapType } from '../bible-list/note/verseAnnotationHelpers';
import {
    VERSE_ANNOTATION_ANCHOR_ATTR,
    VERSE_ANNOTATION_ANCHOR_SELECTOR,
    checkIsOffsetInside,
    createRangeFromOffsets,
    getOffsetFromPoint,
} from './bibleVerseAnnotationHelpers';

export type HoveredVerseCommentType = {
    filePath: string;
    noteItemId: number;
    commentId: string;
    comment: string;
    verseKey: string;
    rect: DOMRect;
};

// One tooltip for the window, so one store and one grace timer.
let hoveredComment: HoveredVerseCommentType | null = null;
const listeners = new Set<() => void>();
let clearTimeoutId: ReturnType<typeof setTimeout> | null = null;

// Long enough to READ the comment and then walk the pointer onto the tooltip,
// which is the only way to reach its buttons.
//
// The timer restarts on every mousemove that lands outside the marked words, so
// it is not the transit that spends it — it is stopping to read. At 250ms the
// tooltip vanished the moment the pointer went still, before it could be used;
// the pointer resting ON the tooltip cancels it outright, so a generous value
// costs nothing but a moment of a tooltip nobody wanted.
const HOVER_GRACE_MILLISECOND = 1200;

function notifyListeners() {
    for (const listener of listeners) {
        listener();
    }
}

function setHoveredComment(newHoveredComment: HoveredVerseCommentType | null) {
    if (
        hoveredComment?.commentId === newHoveredComment?.commentId &&
        hoveredComment?.rect.top === newHoveredComment?.rect.top
    ) {
        return;
    }
    hoveredComment = newHoveredComment;
    notifyListeners();
}

export function cancelHoveredCommentClearing() {
    if (clearTimeoutId !== null) {
        clearTimeout(clearTimeoutId);
        clearTimeoutId = null;
    }
}

export function scheduleHoveredCommentClearing() {
    cancelHoveredCommentClearing();
    clearTimeoutId = setTimeout(() => {
        clearTimeoutId = null;
        setHoveredComment(null);
    }, HOVER_GRACE_MILLISECOND);
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function getSnapshot() {
    return hoveredComment;
}

export function useHoveredVerseComment() {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Which comment, if any, is under this point.
 *
 * A CSS-painted mark is not an element, so there is nothing to hover: the point
 * is turned into a caret, the caret into a character offset, and the offset
 * looked up against the verse's stored ranges.
 */
function hitTestComment(
    containerElement: Element,
    annotationsMap: VerseAnnotationsMapType,
    clientX: number,
    clientY: number,
) {
    const element = document.elementFromPoint(clientX, clientY);
    const anchorElement =
        element?.closest(VERSE_ANNOTATION_ANCHOR_SELECTOR) ?? null;
    if (anchorElement === null || !containerElement.contains(anchorElement)) {
        return null;
    }
    const verseKey = anchorElement.getAttribute(VERSE_ANNOTATION_ANCHOR_ATTR);
    if (verseKey === null) {
        return null;
    }
    const comments = annotationsMap[verseKey]?.comments;
    if (comments === undefined || comments.length === 0) {
        return null;
    }
    const offset = getOffsetFromPoint(anchorElement, clientX, clientY);
    if (offset === null) {
        return null;
    }
    const found = comments.find(({ comment }) => {
        return checkIsOffsetInside(comment, offset);
    });
    if (found === undefined) {
        return null;
    }
    const range = createRangeFromOffsets(
        anchorElement,
        found.comment.start,
        found.comment.end,
    );
    if (range === null) {
        return null;
    }
    return {
        filePath: found.filePath,
        noteItemId: found.noteItemId,
        commentId: found.comment.id,
        comment: found.comment.comment,
        verseKey,
        rect: range.getBoundingClientRect(),
    };
}

/**
 * Makes commented words respond to the pointer.
 *
 * Three things keep the cost of a `mousemove` listener honest, in order: it is
 * not attached at all while the window holds no comment; it is attached to this
 * bible view rather than to `document`; and the hit test runs behind a
 * per-instance debounce. `shouldWait: false` lets the first move after a pause
 * answer immediately, so a hover feels instant rather than laggy.
 */
export function useVerseCommentHover(
    containerRef: RefObject<HTMLElement | null>,
) {
    const annotationsMap = useBibleVerseAnnotations();
    const annotationsMapRef = useAppCurrentRef(annotationsMap);
    const hasAnyComment = useMemo(() => {
        return Object.values(annotationsMap).some((annotations) => {
            return annotations.comments.length > 0;
        });
    }, [annotationsMap]);
    // Per instance: several bible views can be mounted at once, and a shared
    // timer would let one pane's pending hit test be cancelled by another's.
    const attemptHitTest = useMemo(() => {
        return genTimeoutAttempt(120, false);
    }, []);
    useAppEffect(() => {
        const containerElement = containerRef.current;
        if (containerElement === null || !hasAnyComment) {
            return;
        }
        const handleMouseMove = (event: MouseEvent) => {
            const { clientX, clientY } = event;
            attemptHitTest(() => {
                const found = hitTestComment(
                    containerElement,
                    annotationsMapRef.current,
                    clientX,
                    clientY,
                );
                if (found === null) {
                    // Scheduled, not immediate: the pointer may be on its way to
                    // the tooltip, which is not over the verse text.
                    scheduleHoveredCommentClearing();
                    return;
                }
                cancelHoveredCommentClearing();
                setHoveredComment(found);
            });
        };
        const handleMouseLeave = () => {
            scheduleHoveredCommentClearing();
        };
        containerElement.addEventListener('mousemove', handleMouseMove);
        containerElement.addEventListener('mouseleave', handleMouseLeave);
        return () => {
            containerElement.removeEventListener('mousemove', handleMouseMove);
            containerElement.removeEventListener(
                'mouseleave',
                handleMouseLeave,
            );
        };
    }, [containerRef, hasAnyComment, attemptHitTest]);
}
