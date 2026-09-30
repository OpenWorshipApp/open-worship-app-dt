/**
 * Row geometry for a windowed list. Everything here is arithmetic over row
 * indexes, so a list of ten thousand rows costs what a list of ten costs.
 *
 * A uniform row height allocates NOTHING -- offset <-> index is one division,
 * the way VS Code's `RangeMap` answers from run-length groups instead of
 * measuring the DOM. Only a per-row height function builds an array, one
 * `Float64Array` of `count + 1`, which is the single allocation this module
 * ever holds.
 */

export type RowHeightType = number | ((index: number) => number);

export type RowMetricsType = {
    count: number;
    totalHeight: number;
    startOf: (index: number) => number;
    heightOf: (index: number) => number;
    indexAt: (offset: number) => number;
};

export type RowRangeType = {
    first: number;
    // `-1` when there is nothing to render, so `first > last` reads as empty.
    last: number;
};

export const EMPTY_ROW_RANGE: RowRangeType = { first: 0, last: -1 };

function toClampedIndex(index: number, count: number) {
    if (count < 1) {
        return 0;
    }
    return Math.min(Math.max(index, 0), count - 1);
}

export function genRowMetrics(
    count: number,
    rowHeight: RowHeightType,
): RowMetricsType {
    const safeCount = Math.max(0, Math.floor(count));
    if (typeof rowHeight === 'number') {
        // A row of zero height would make `indexAt` divide by zero and every
        // row start at the same offset.
        const height = Math.max(1, rowHeight);
        return {
            count: safeCount,
            totalHeight: safeCount * height,
            startOf: (index: number) => {
                return toClampedIndex(index, safeCount) * height;
            },
            heightOf: () => {
                return height;
            },
            indexAt: (offset: number) => {
                return toClampedIndex(Math.floor(offset / height), safeCount);
            },
        };
    }
    const starts = new Float64Array(safeCount + 1);
    for (let index = 0; index < safeCount; index++) {
        starts[index + 1] = starts[index] + Math.max(1, rowHeight(index));
    }
    return {
        count: safeCount,
        totalHeight: starts[safeCount],
        startOf: (index: number) => {
            return starts[toClampedIndex(index, safeCount)];
        },
        heightOf: (index: number) => {
            const safeIndex = toClampedIndex(index, safeCount);
            return starts[safeIndex + 1] - starts[safeIndex];
        },
        indexAt: (offset: number) => {
            let low = 0;
            let high = safeCount - 1;
            while (low < high) {
                const middle = (low + high + 1) >> 1;
                if (starts[middle] <= offset) {
                    low = middle;
                } else {
                    high = middle - 1;
                }
            }
            return toClampedIndex(low, safeCount);
        },
    };
}

/** How many items of `itemWidth` (plus `gap` between them) fit in a row. */
export function toColumnCount(
    availableWidth: number,
    itemWidth: number,
    gap = 0,
) {
    if (itemWidth <= 0 || availableWidth <= 0) {
        return 1;
    }
    return Math.max(1, Math.floor((availableWidth + gap) / (itemWidth + gap)));
}

/**
 * The rows overlapping `[visibleTop, visibleBottom]`, both measured from the
 * TOP OF THE LIST, widened by `overscan` rows on each side. VS Code can render
 * the visible rows and nothing more because it moves the rows itself in the
 * same frame; a native scroller hands the compositor a frame before React can
 * answer, so a row or two of overscan is what keeps a blank band off screen.
 */
export function toRowRange({
    metrics,
    visibleTop,
    visibleBottom,
    overscan,
}: {
    metrics: RowMetricsType;
    visibleTop: number;
    visibleBottom: number;
    overscan: number;
}): RowRangeType {
    if (metrics.count < 1 || visibleBottom <= visibleTop) {
        return EMPTY_ROW_RANGE;
    }
    const first = Math.max(0, metrics.indexAt(visibleTop) - overscan);
    const last = Math.min(
        metrics.count - 1,
        metrics.indexAt(visibleBottom) + overscan,
    );
    return { first, last };
}

export function checkIsSameRowRange(one: RowRangeType, other: RowRangeType) {
    return one.first === other.first && one.last === other.last;
}

export function toRowIndexOfItem(itemIndex: number, columnCount: number) {
    return Math.floor(itemIndex / Math.max(1, columnCount));
}

export function toRowCount(itemCount: number, columnCount: number) {
    return Math.ceil(itemCount / Math.max(1, columnCount));
}
