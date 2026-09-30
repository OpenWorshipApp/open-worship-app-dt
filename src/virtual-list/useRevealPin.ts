import type { RefObject } from 'react';
import { useCallback, useRef, useState } from 'react';

import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import { registerVirtualReveal } from './virtualRevealHelpers';

const EMPTY_PINNED_INDEXES: number[] = [];
// Long enough for a caller to take the element and scroll it into view, short
// enough that a row nobody went to stops being drawn.
const PIN_DURATION = 4000;

/**
 * Answers a reveal by DRAWING the row, not only by scrolling at it.
 *
 * Scrolling alone cannot land on a far row whose neighbours have never been
 * measured: the aim is computed from estimates, the screenful it draws is then
 * measured for real, everything after it moves, and the target slides out from
 * under the scroll. Pinned, the row is drawn wherever it currently is and the
 * caller finishes the job from its own box, which is exact.
 *
 * The pin is released on a timer rather than when the band reaches the row: a
 * caller that asked and then did nothing must not leave a row rendered for the
 * rest of the session.
 */
export function useRevealPin({
    findIndex,
    scrollToRowRef,
}: {
    /** The row holding `key`, or -1 when this list does not hold it. */
    findIndex: (key: string) => number;
    /**
     * Filled in by the caller AFTER `useVirtualRows` has run -- the pin is what
     * that hook takes, so the two cannot be ordered any other way.
     */
    scrollToRowRef: RefObject<
        (index: number, align?: 'nearest' | 'center') => boolean
    >;
}) {
    const [pinnedIndexes, setPinnedIndexes] =
        useState<number[]>(EMPTY_PINNED_INDEXES);
    const unpinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useAppEffect(() => {
        return () => {
            if (unpinTimeoutRef.current !== null) {
                clearTimeout(unpinTimeoutRef.current);
            }
        };
    }, []);

    const findIndexRef = useAppCurrentRef(findIndex);
    const reveal = useCallback(
        (key: string) => {
            const index = findIndexRef.current(key);
            if (index === -1) {
                return false;
            }
            setPinnedIndexes((previousIndexes) => {
                return previousIndexes.length === 1 &&
                    previousIndexes[0] === index
                    ? previousIndexes
                    : [index];
            });
            if (unpinTimeoutRef.current !== null) {
                clearTimeout(unpinTimeoutRef.current);
            }
            unpinTimeoutRef.current = setTimeout(() => {
                unpinTimeoutRef.current = null;
                setPinnedIndexes(EMPTY_PINNED_INDEXES);
            }, PIN_DURATION);
            scrollToRowRef.current(index, 'center');
            // Answers "this list HOLDS it", not "it had to scroll": an item
            // already in view needs no scrolling, and that is exactly the case
            // a caller waiting for its element must not be told no about.
            return true;
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const revealRef = useAppCurrentRef(reveal);
    useAppEffect(() => {
        return registerVirtualReveal((key: string) => {
            return revealRef.current(key);
        });
    }, [revealRef]);

    return pinnedIndexes;
}

/**
 * Keeps a pinned row in view while the list is still working out its
 * geometry.
 *
 * Pinning alone brings the row into view ONCE, and once is not enough: a run
 * sheet line holding a document reads its slides off the disk after it is
 * drawn and then stands twenty thousand pixels tall, which pushes every line
 * after it that far down -- including the one the operator was just sent to.
 * Re-aimed on every change of the list's own height, and only until the pin is
 * released, so a row that settles is left exactly where it is.
 *
 * `nearest`, unlike the first aim: a row already on screen must not be
 * re-centred under the operator each time something below it is measured.
 */
export function useKeepPinnedRowInView({
    pinnedIndexes,
    totalHeight,
    scrollToRow,
}: {
    pinnedIndexes: number[];
    totalHeight: number;
    scrollToRow: (index: number, align?: 'nearest' | 'center') => boolean;
}) {
    const scrollToRowRef = useAppCurrentRef(scrollToRow);
    useAppEffect(() => {
        if (pinnedIndexes.length === 0) {
            return;
        }
        scrollToRowRef.current(pinnedIndexes[0], 'nearest');
    }, [pinnedIndexes, totalHeight, scrollToRowRef]);
}
