import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import { useVirtualRows, type ScrollToRowType } from './useVirtualRows';
import {
    useMeasuredRowHeights,
    VIRTUAL_ROW_KEY,
} from './useMeasuredRowHeights';
import { useKeepPinnedRowInView, useRevealPin } from './useRevealPin';
import type { RowHeightType } from './virtualRowsHelpers';
import {
    toCellWidth,
    toColumnCount,
    toRowCount,
    toRowIndexOfItem,
} from './virtualRowsHelpers';

/** The tallest item of a row, which is what decides the row's own height. */
function toRowContentHeight<T>(
    items: T[],
    columns: number,
    getItemHeight: (item: T, cellWidth: number) => number,
    rowIndex: number,
    cellWidth: number,
) {
    const start = rowIndex * columns;
    const end = Math.min(start + columns, items.length);
    let tallest = 0;
    for (let index = start; index < end; index++) {
        tallest = Math.max(tallest, getItemHeight(items[index], cellWidth));
    }
    return tallest;
}

/**
 * Renders only the rows of `items` that are on screen, wherever the scrolling
 * happens to be done -- the list does not own a scroller.
 *
 * Items are laid out in rows of a computed column count, so a wrapping grid
 * (the background thumbnails, a document's slides) and a single column (list
 * view, a file list) are the same component with a different `columnCount`.
 *
 * There are two ways to know how tall a row is, and a caller picks by whether
 * it passes `getItemHeight`:
 *
 * - WITH it, the data says (a slide knows its own shape), so the geometry is
 *   arithmetic and exact for every row at once, and the only thing measured is
 *   the chrome every card shares -- its header, its margins.
 * - WITHOUT it, nothing can say. A background thumbnail keeps its picture's
 *   own aspect ratio, so a row is as tall as the tallest picture in it and no
 *   two rows need agree. Those rows are MEASURED as they are drawn
 *   (`useMeasuredRowHeights`); laying them all at one measured height is what
 *   left uneven gaps between rows of thumbnails, and rows overlapping the row
 *   below them by up to 26 pixels.
 */
export default function VirtualGridComp<T>({
    items,
    getItemKey,
    renderItem,
    itemWidth,
    itemGap = 0,
    columnCount,
    estimateRowHeight,
    getItemHeight,
    className,
    rowClassName,
    rowStyle,
    overscan = 2,
    isEnabled = true,
}: Readonly<{
    items: T[];
    /** Defaults to the item itself, for a list of strings. */
    getItemKey?: (item: T) => string;
    renderItem: (item: T, index: number) => ReactNode;
    itemWidth: number;
    itemGap?: number;
    columnCount?: number;
    /** A first guess at a WHOLE row; the grid measures real ones and corrects. */
    estimateRowHeight: number;
    /**
     * An item's own height, where the data knows it (a slide's aspect ratio),
     * given the width its cell really gets (`toCellWidth`: `itemWidth`, or
     * less once a narrow pane squeezes it). MUST be stable across renders --
     * it is what every row offset is built from. Leaving it out measures each
     * row instead.
     */
    getItemHeight?: (item: T, cellWidth: number) => number;
    className?: string;
    rowClassName?: string;
    rowStyle?: CSSProperties;
    overscan?: number;
    isEnabled?: boolean;
}>) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    // The part of a row that is not its item: a card's header and margins,
    // and the row it was read off. Only for the `getItemHeight` path -- the
    // measured one needs no such split, since it measures the whole row.
    const [measuredChrome, setMeasuredChrome] = useState<{
        rowIndex: number;
        extraHeight: number;
    } | null>(null);
    const measuredExtraHeight = measuredChrome?.extraHeight ?? null;

    useAppEffect(() => {
        const container = containerRef.current;
        if (container === null) {
            return;
        }
        const update = () => {
            const width = container.clientWidth;
            setContainerWidth((previousWidth) => {
                return previousWidth === width ? previousWidth : width;
            });
        };
        update();
        const resizeObserver = new ResizeObserver(update);
        resizeObserver.observe(container);
        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    const columns =
        columnCount ?? toColumnCount(containerWidth, itemWidth, itemGap);
    const cellWidth = toCellWidth(itemWidth, containerWidth, columns);

    const rowCount = toRowCount(items.length, columns);
    const toKey = getItemKey ?? String;

    // A row is known by its first item AND by how many items share it: the
    // same picture sits in a different row, beside different neighbours, the
    // moment the panel is resized or the zoom moves.
    const rowKeys = useMemo(() => {
        const keyList: string[] = [];
        for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
            const firstItem = items[rowIndex * columns];
            keyList.push(
                firstItem === undefined
                    ? `${columns}:${rowIndex}`
                    : `${columns}:${toKey(firstItem)}`,
            );
        }
        return keyList;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, columns, rowCount, getItemKey]);

    const { rowHeight: measuredRowHeight, handleRowRef } =
        useMeasuredRowHeights({ rowKeys, estimateRowHeight, containerRef });

    const rowHeight = useMemo<RowHeightType>(() => {
        if (getItemHeight === undefined) {
            return measuredRowHeight;
        }
        const extraHeight =
            measuredExtraHeight ??
            // Until a row has been measured: what the caller guessed for a
            // whole row, less what the first one's own item accounts for.
            Math.max(
                0,
                estimateRowHeight -
                    toRowContentHeight(
                        items,
                        columns,
                        getItemHeight,
                        0,
                        cellWidth,
                    ),
            );
        return (rowIndex: number) => {
            return (
                toRowContentHeight(
                    items,
                    columns,
                    getItemHeight,
                    rowIndex,
                    cellWidth,
                ) + extraHeight
            );
        };
    }, [
        items,
        columns,
        cellWidth,
        getItemHeight,
        measuredExtraHeight,
        estimateRowHeight,
        measuredRowHeight,
    ]);

    const itemsRef = useAppCurrentRef(items);
    const getItemKeyRef = useAppCurrentRef(getItemKey);
    const columnsRef = useAppCurrentRef(columns);
    const toContentHeightRef = useAppCurrentRef((rowIndex: number) => {
        return getItemHeight === undefined
            ? 0
            : toRowContentHeight(
                  items,
                  columns,
                  getItemHeight,
                  rowIndex,
                  cellWidth,
              );
    });

    const findIndex = useCallback((key: string) => {
        const itemKey = getItemKeyRef.current ?? String;
        const index = itemsRef.current.findIndex((item) => {
            return itemKey(item) === key;
        });
        return index === -1 ? -1 : toRowIndexOfItem(index, columnsRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const scrollToRowRef = useRef<ScrollToRowType>(() => {
        return false;
    });
    const { pinnedIndexes, behaviorRef } = useRevealPin({
        findIndex,
        scrollToRowRef,
    });

    const { rows, totalHeight, scrollToRow } = useVirtualRows({
        containerRef,
        count: rowCount,
        rowHeight,
        overscan,
        pinnedIndexes,
        isEnabled,
    });
    scrollToRowRef.current = scrollToRow;
    useKeepPinnedRowInView({
        pinnedIndexes,
        totalHeight,
        scrollToRow,
        behaviorRef,
    });

    const handleMeasuringChromeRow = useCallback(
        (element: HTMLDivElement | null) => {
            if (element === null) {
                return;
            }
            const rowIndex = Number.parseInt(
                element.getAttribute(ROW_INDEX_KEY) ?? '',
            );
            if (Number.isNaN(rowIndex)) {
                return;
            }
            const measure = () => {
                const height = element.getBoundingClientRect().height;
                const contentHeight = toContentHeightRef.current(rowIndex);
                // Shorter than its own items: a card whose body is drawn by a
                // root of its own (a slide's shadow root) has not drawn it
                // yet, and the observer brings the real height when it does.
                if (height <= 0 || height < contentHeight) {
                    return;
                }
                const extraHeight = height - contentHeight;
                setMeasuredChrome((previous) => {
                    return previous !== null &&
                        previous.rowIndex === rowIndex &&
                        Math.abs(previous.extraHeight - extraHeight) <= 1
                        ? previous
                        : { rowIndex, extraHeight };
                });
            };
            // On a timer as well as on the observer: a window that is not on
            // screen runs no frames, so it delivers no `ResizeObserver`
            // callback at all, and a grid left waiting for one keeps its
            // estimated rows.
            const timeoutId = setTimeout(measure, 0);
            const resizeObserver = new ResizeObserver(measure);
            resizeObserver.observe(element);
            return () => {
                clearTimeout(timeoutId);
                resizeObserver.disconnect();
            };
        },
        [toContentHeightRef],
    );

    // The chrome is measured only on the path that needs it, off ONE row: the
    // first one drawn, which is then KEPT, so scrolling does not re-observe a
    // new first row every time. It stays observed rather than read once: a
    // slide card's body is sized inside its own shadow root, a render after
    // this grid's, so right after a zoom the row still has the OLD cards'
    // height -- read once, that left every row as tall as the previous zoom's
    // (a gap of ~150px under each row of cards at the smallest zoom). The
    // chrome does not change with the zoom or the column count, so there is
    // nothing to reset when they do.
    const isMeasuringRows = getItemHeight === undefined;
    const chromeMeasuringIndex = isMeasuringRows
        ? undefined
        : (measuredChrome?.rowIndex ?? rows[0]?.index);
    // Every row is the SAME block of `columns` cells, centred as a whole, so a
    // half-empty last row still starts on the column its neighbours start on.
    // Centring each row's own items instead would shift a short last row left
    // of the grid -- which is what the invisible filler boxes used to paper
    // over, and what they got wrong the moment a row could not wrap.
    const rowWidth = itemWidth > 0 ? columns * itemWidth : undefined;
    return (
        <div
            ref={containerRef}
            className={className}
            style={{ position: 'relative', width: '100%', height: totalHeight }}
        >
            {rows.map((row) => {
                const start = row.index * columns;
                const rowItems = items.slice(start, start + columns);
                return (
                    <div
                        key={row.index}
                        {...{
                            [ROW_INDEX_KEY]: row.index,
                            [VIRTUAL_ROW_KEY]: rowKeys[row.index],
                        }}
                        ref={
                            row.index === chromeMeasuringIndex
                                ? handleMeasuringChromeRow
                                : isMeasuringRows
                                  ? handleRowRef
                                  : undefined
                        }
                        className={rowClassName}
                        style={{
                            position: 'absolute',
                            top: `${row.start}px`,
                            left: 0,
                            right: 0,
                            width:
                                rowWidth === undefined
                                    ? undefined
                                    : `${rowWidth}px`,
                            maxWidth: '100%',
                            marginLeft: 'auto',
                            marginRight: 'auto',
                            ...rowStyle,
                        }}
                    >
                        {rowItems.map((item, itemIndex) => {
                            return renderItem(item, start + itemIndex);
                        })}
                    </div>
                );
            })}
        </div>
    );
}

const ROW_INDEX_KEY = 'data-virtual-row-index';
