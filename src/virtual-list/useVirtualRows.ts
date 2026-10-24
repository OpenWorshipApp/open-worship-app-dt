import type { RefObject } from 'react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import type { RowHeightType, RowRangeType } from './virtualRowsHelpers';
import {
    EMPTY_ROW_RANGE,
    checkIsSameRowRange,
    genRowMetrics,
    toRowRange,
} from './virtualRowsHelpers';
import {
    findClippingAncestors,
    findScrollingAncestors,
    scrollBandIntoView,
    subscribeScrollerList,
    toVisibleWindow,
} from './virtualScrollHelpers';

type VirtualRowType = {
    index: number;
    start: number;
    height: number;
};

export type ScrollToRowType = (
    index: number,
    align?: 'nearest' | 'center',
    behavior?: ScrollBehavior,
) => boolean;

export type UseVirtualRowsOptionsType = {
    /** Must stay mounted for the list's whole life, even while it is empty. */
    containerRef: RefObject<HTMLElement | null>;
    count: number;
    rowHeight: RowHeightType;
    overscan?: number;
    /**
     * Rows that are rendered wherever they are, on top of the visible band.
     *
     * What "scroll to row 995 of a thousand" needs when the rows are not all
     * one height: the offsets of a row nobody has drawn are estimates, so a
     * scroll aimed at one lands near it and the answer moves as the screenful
     * it drew is measured for real. A pinned row is DRAWN instead, at whatever
     * offset it currently has, and the caller then brings that element into
     * view by its own box -- which is exact, and needs no second guess.
     */
    pinnedIndexes?: number[];
    /**
     * `false` renders every row, for printing, exporting and tests -- the one
     * honest escape hatch, rather than each caller growing its own.
     */
    isEnabled?: boolean;
};

const EMPTY_PINNED_INDEXES: number[] = [];

export function useVirtualRows({
    containerRef,
    count,
    rowHeight,
    overscan = 2,
    pinnedIndexes = EMPTY_PINNED_INDEXES,
    isEnabled = true,
}: UseVirtualRowsOptionsType) {
    const metrics = useMemo(() => {
        return genRowMetrics(count, rowHeight);
    }, [count, rowHeight]);
    const [range, setRange] = useState<RowRangeType>(EMPTY_ROW_RANGE);
    const metricsRef = useAppCurrentRef(metrics);
    const overscanRef = useAppCurrentRef(overscan);
    const clippingAncestorListRef = useRef<HTMLElement[]>([]);
    // The effect below owns it; the metrics effect and `scrollToRow` reach it
    // from outside the effect's closure.
    const updateRef = useRef<() => void>(() => {});
    // The row at the top of what is on screen, and where it started, read on
    // every update -- what the metrics effect keeps still. See there.
    const anchorRef = useRef<{
        index: number;
        count: number;
        start: number;
    } | null>(null);

    useAppEffect(() => {
        const container = containerRef.current;
        if (!isEnabled || container === null) {
            return;
        }
        // Walked once rather than per frame: `getComputedStyle` on every
        // ancestor on every scroll event is the cost this module exists to
        // remove. Re-walked when the window resizes, which is when a panel can
        // have been docked, floated or reflowed.
        const recomputeAncestors = () => {
            clippingAncestorListRef.current = findClippingAncestors(container);
        };
        recomputeAncestors();
        const update = () => {
            const { top, bottom } = toVisibleWindow(
                container,
                clippingAncestorListRef.current,
            );
            const currentMetrics = metricsRef.current;
            if (top > 0 && currentMetrics.count > 0) {
                const index = currentMetrics.indexAt(top);
                anchorRef.current = {
                    index,
                    count: currentMetrics.count,
                    start: currentMetrics.startOf(index),
                };
            } else {
                anchorRef.current = null;
            }
            const nextRange = toRowRange({
                metrics: currentMetrics,
                visibleTop: top,
                visibleBottom: bottom,
                overscan: overscanRef.current,
            });
            setRange((previousRange) => {
                return checkIsSameRowRange(previousRange, nextRange)
                    ? previousRange
                    : nextRange;
            });
        };
        const refreshAll = () => {
            recomputeAncestors();
            update();
        };
        updateRef.current = update;
        update();
        const unsubscribe = subscribeScrollerList(
            findScrollingAncestors(clippingAncestorListRef.current),
            update,
        );
        // None of these is a scroll event. The list's own height changes when
        // the folder reloads or the zoom moves every row; its PARENT's changes
        // when a colour-note group above it is collapsed, which moves this
        // list without resizing it; and a clipping ancestor's changes when a
        // panel is resized or another section of it is opened.
        const resizeObserver = new ResizeObserver(update);
        resizeObserver.observe(container);
        if (container.parentElement !== null) {
            resizeObserver.observe(container.parentElement);
        }
        for (const ancestor of clippingAncestorListRef.current) {
            resizeObserver.observe(ancestor);
        }
        window.addEventListener('resize', refreshAll);
        return () => {
            unsubscribe();
            resizeObserver.disconnect();
            window.removeEventListener('resize', refreshAll);
            updateRef.current = () => {};
        };
    }, [containerRef, isEnabled]);

    // Rows ABOVE what is on screen changed height -- measured for the first
    // time, or every row nobody has drawn moving with the median of the ones
    // that have been (`useMeasuredRowHeights`). The rows are absolutely
    // positioned, and the browser's own scroll anchoring skips absolutely
    // positioned boxes, so the view slid by the difference with `scrollTop`
    // unchanged: an Image Show grid scrolled to its last row moved that row
    // 253 pixels down while its slide show ran and nobody touched it. The
    // scroller follows the row at the top instead, before the frame is
    // painted. Not across a change in the row COUNT, where an index no longer
    // names the same row.
    useLayoutEffect(() => {
        const anchor = anchorRef.current;
        if (
            isEnabled &&
            anchor !== null &&
            anchor.count === metrics.count &&
            anchor.index < metrics.count
        ) {
            const shift = metrics.startOf(anchor.index) - anchor.start;
            // Looked up only when something moved: it reads each ancestor's
            // computed style, and the metrics change on every measured row.
            const scroller =
                Math.abs(shift) >= 1
                    ? findScrollingAncestors(clippingAncestorListRef.current)[0]
                    : undefined;
            if (scroller !== undefined) {
                scroller.scrollTop += shift;
            }
        }
        // A reload or a zoom moves every row without a scroll event, and the
        // ancestors have not changed, so only the range is recomputed.
        updateRef.current();
    }, [metrics, isEnabled]);

    const rows = useMemo<VirtualRowType[]>(() => {
        const first = isEnabled ? range.first : 0;
        const last = isEnabled ? range.last : metrics.count - 1;
        const indexes = new Set<number>();
        for (let index = first; index <= last; index++) {
            indexes.add(index);
        }
        for (const index of pinnedIndexes) {
            if (index >= 0 && index < metrics.count) {
                indexes.add(index);
            }
        }
        // In order, so the rows keep the reading order of the list even when a
        // pinned one sits far from the band.
        return Array.from(indexes)
            .sort((one, other) => {
                return one - other;
            })
            .map((index) => {
                return {
                    index,
                    start: metrics.startOf(index),
                    height: metrics.heightOf(index),
                };
            });
    }, [metrics, range, isEnabled, pinnedIndexes]);

    const scrollToRow = useCallback<ScrollToRowType>(
        (index, align = 'nearest', behavior = 'auto') => {
            const container = containerRef.current;
            if (container === null) {
                return false;
            }
            const currentMetrics = metricsRef.current;
            const isScrolled = scrollBandIntoView({
                clippingAncestorList: clippingAncestorListRef.current,
                toBandTop: (scroller) => {
                    const listTop =
                        container.getBoundingClientRect().top -
                        scroller.getBoundingClientRect().top +
                        scroller.scrollTop;
                    return listTop + currentMetrics.startOf(index);
                },
                height: currentMetrics.heightOf(index),
                align,
                behavior,
            });
            // The range is read from the DOM, and the scroll event that would
            // do it arrives a frame later -- a caller that scrolls and then
            // looks for the row needs it mounted now.
            if (isScrolled) {
                updateRef.current();
            }
            return isScrolled;
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    return { rows, totalHeight: metrics.totalHeight, scrollToRow };
}
