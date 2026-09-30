import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useMemo, useRef } from 'react';

import { useVirtualRows } from './useVirtualRows';
import {
    useMeasuredRowHeights,
    VIRTUAL_ROW_KEY,
} from './useMeasuredRowHeights';
import { useKeepPinnedRowInView, useRevealPin } from './useRevealPin';

/**
 * Renders only the rows of `items` that are on screen, for a list whose rows
 * are NOT all one height -- a run sheet, where one line is a folded header and
 * the next is a song opened out into its slides.
 *
 * `VirtualGridComp` is the sibling for items laid out in COLUMNS. Both measure
 * what they draw through `useMeasuredRowHeights`; the difference is only how
 * many items share a row.
 */
export default function VirtualListComp<T>({
    items,
    getItemKey,
    renderItem,
    estimateRowHeight,
    className,
    style,
    rowClassName,
    rowStyle,
    overscan = 2,
    isEnabled = true,
}: Readonly<{
    items: T[];
    getItemKey: (item: T, index: number) => string;
    renderItem: (item: T, index: number) => ReactNode;
    /** What a row that has never been drawn is assumed to be. */
    estimateRowHeight: number;
    className?: string;
    style?: CSSProperties;
    rowClassName?: string;
    rowStyle?: CSSProperties;
    overscan?: number;
    isEnabled?: boolean;
}>) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const rowKeys = useMemo(() => {
        return items.map(getItemKey);
    }, [items, getItemKey]);

    const { rowHeight, handleRowRef } = useMeasuredRowHeights({
        rowKeys,
        estimateRowHeight,
        containerRef,
    });

    const findIndex = useCallback(
        (key: string) => {
            return rowKeys.indexOf(key);
        },
        [rowKeys],
    );
    const scrollToRowRef = useRef<
        (index: number, align?: 'nearest' | 'center') => boolean
    >(() => {
        return false;
    });
    const pinnedIndexes = useRevealPin({ findIndex, scrollToRowRef });

    const { rows, totalHeight, scrollToRow } = useVirtualRows({
        containerRef,
        count: items.length,
        rowHeight,
        overscan,
        pinnedIndexes,
        isEnabled,
    });
    scrollToRowRef.current = scrollToRow;
    useKeepPinnedRowInView({ pinnedIndexes, totalHeight, scrollToRow });

    return (
        <div
            ref={containerRef}
            className={className}
            style={{
                position: 'relative',
                width: '100%',
                height: totalHeight,
                ...style,
            }}
        >
            {rows.map((row) => {
                return (
                    <div
                        key={rowKeys[row.index]}
                        {...{ [VIRTUAL_ROW_KEY]: rowKeys[row.index] }}
                        ref={handleRowRef}
                        className={rowClassName}
                        style={{
                            position: 'absolute',
                            top: `${row.start}px`,
                            left: 0,
                            right: 0,
                            ...rowStyle,
                        }}
                    >
                        {renderItem(items[row.index], row.index)}
                    </div>
                );
            })}
        </div>
    );
}
