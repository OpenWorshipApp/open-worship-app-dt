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
    // The bible view the words live in, so that view going away (closed, or
    // its last comment deleted) can take its own tooltip with it and nobody
    // else's.
    containerElement: Element;
};

// One tooltip for the window, so one store and one grace timer.
let hoveredComment: HoveredVerseCommentType | null = null;
const listeners = new Set<() => void>();
let clearTimeoutId: ReturnType<typeof setTimeout> | null = null;
// The pointer is on the tooltip, which keeps it up for as long as it stays.
// A flag, not just a cancelled timer: the tooltip's `mouseenter` is built by
// React from the words' `mouseout`, which the browser sends BEFORE the bible
// view's own `mouseleave` -- so the view scheduled the clearing again right
// behind the cancel, and a tooltip with the pointer resting on its Edit button
// went away 1.2 s later (RD-110).
let isPointerOnTooltip = false;

// Long enough to READ the comment and then walk the pointer onto the tooltip,
// which is the only way to reach its buttons.
//
// The timer restarts on every mousemove that lands outside the marked words, so
// it is not the transit that spends it — it is stopping to read. At 250ms the
// tooltip vanished the moment the pointer went still, before it could be used;
// the pointer resting ON the tooltip keeps it however long it stays, so a
// generous value costs nothing but a moment of a tooltip nobody wanted.
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

function stopClearing() {
    if (clearTimeoutId !== null) {
        clearTimeout(clearTimeoutId);
        clearTimeoutId = null;
    }
}

function startClearing() {
    stopClearing();
    if (isPointerOnTooltip) {
        // Whoever asked: the pointer resting on the tooltip keeps it.
        return;
    }
    clearTimeoutId = setTimeout(() => {
        clearTimeoutId = null;
        setHoveredComment(null);
    }, HOVER_GRACE_MILLISECOND);
}

/**
 * The tooltip's `mouseenter`: it stays until the pointer leaves it, whatever
 * the words the pointer came from schedule meanwhile.
 */
export function cancelHoveredCommentClearing() {
    isPointerOnTooltip = true;
    stopClearing();
}

/**
 * The tooltip's `mouseleave`: it goes after the grace, unless the pointer
 * comes back to it or to the words.
 */
export function scheduleHoveredCommentClearing() {
    isPointerOnTooltip = false;
    startClearing();
}

/** Now, not after the grace: the close button, and an action that made the comment moot. */
export function clearHoveredComment() {
    stopClearing();
    setHoveredComment(null);
}

function clearHoveredCommentOf(containerElement: Element) {
    if (hoveredComment?.containerElement === containerElement) {
        clearHoveredComment();
    }
}

export function checkIsCommentInMap(
    annotationsMap: VerseAnnotationsMapType,
    verseKey: string,
    commentId: string,
) {
    const comments = annotationsMap[verseKey]?.comments ?? [];
    return comments.some(({ comment }) => {
        return comment.id === commentId;
    });
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
        containerElement,
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
    // The tooltip must not outlive the comment it shows: deleted from the
    // notes panel, or its file gone, while the pointer has not moved since.
    useAppEffect(() => {
        if (
            hoveredComment !== null &&
            !checkIsCommentInMap(
                annotationsMap,
                hoveredComment.verseKey,
                hoveredComment.commentId,
            )
        ) {
            clearHoveredComment();
        }
    }, [annotationsMap]);
    useAppEffect(() => {
        const containerElement = containerRef.current;
        if (containerElement === null || !hasAnyComment) {
            return;
        }
        // The hit test is debounced, so its trailing run can land AFTER the
        // pointer has left this view, still holding the last coordinates,
        // which were over the commented words. Left unchecked it cancelled the
        // clearing that `mouseleave` had just scheduled, and with no further
        // event in this view the tooltip stayed up for good. A late run for a
        // pointer that is gone does nothing at all: `mouseleave` has already
        // had its say -- the clearing scheduled, or nothing if the pointer went
        // onto the tooltip -- and from here on the tooltip decides: the pointer
        // resting on it keeps it, leaving it schedules the clearing.
        let isPointerInside = false;
        const handleMouseMove = (event: MouseEvent) => {
            const { clientX, clientY } = event;
            isPointerInside = true;
            attemptHitTest(() => {
                if (!isPointerInside) {
                    return;
                }
                // Over this view, so not on the tooltip. Said here because a
                // tooltip taken away from under the pointer -- its own Edit,
                // Delete or Close -- sends no `mouseleave`, and the flag left
                // set would hold the next tooltip up for good.
                isPointerOnTooltip = false;
                const found = hitTestComment(
                    containerElement,
                    annotationsMapRef.current,
                    clientX,
                    clientY,
                );
                if (found === null) {
                    // Scheduled, not immediate: the pointer may be on its way to
                    // the tooltip, which is not over the verse text.
                    startClearing();
                    return;
                }
                stopClearing();
                setHoveredComment(found);
            });
        };
        const handleMouseLeave = () => {
            isPointerInside = false;
            // Nothing at all when it left onto the tooltip: that `mouseenter`
            // has already run.
            startClearing();
        };
        containerElement.addEventListener('mousemove', handleMouseMove);
        containerElement.addEventListener('mouseleave', handleMouseLeave);
        return () => {
            isPointerInside = false;
            containerElement.removeEventListener('mousemove', handleMouseMove);
            containerElement.removeEventListener(
                'mouseleave',
                handleMouseLeave,
            );
            // This view is going (closed, or its last comment deleted):
            // nothing here will ever schedule the clearing again, so its
            // tooltip goes with it.
            clearHoveredCommentOf(containerElement);
        };
    }, [containerRef, hasAnyComment, attemptHitTest]);
}
