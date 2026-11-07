// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const fake = vi.hoisted(() => ({
    measuredHeights: [11, 22, 33],
    rowKeys: [] as string[],
    findIndex: null as null | ((key: string) => number),
}));

vi.mock('../helper/appHooks', async () => {
    const React = await vi.importActual<typeof import('react')>('react');
    return {
        useAppEffect: React.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = React.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('./useMeasuredRowHeights', () => ({
    VIRTUAL_ROW_KEY: 'data-virtual-row-key',
    useMeasuredRowHeights: ({ rowKeys }: { rowKeys: string[] }) => {
        fake.rowKeys = rowKeys;
        return {
            rowHeight: (index: number) => fake.measuredHeights[index] ?? 10,
            handleRowRef: () => {},
        };
    },
}));
vi.mock('./useRevealPin', () => ({
    useRevealPin: ({ findIndex }: { findIndex: (key: string) => number }) => {
        fake.findIndex = findIndex;
        return { pinnedIndexes: [], behaviorRef: { current: null } };
    },
    useKeepPinnedRowInView: () => {},
}));
vi.mock('./useVirtualRows', () => ({
    useVirtualRows: ({
        count,
        rowHeight,
    }: {
        count: number;
        rowHeight: (index: number) => number;
    }) => {
        let start = 0;
        const rows = Array.from({ length: count }, (_, index) => {
            const row = { index, start };
            start += rowHeight(index);
            return row;
        });
        return { rows, totalHeight: start, scrollToRow: () => false };
    },
}));

import VirtualGridComp from './VirtualGridComp';

describe('virtual grid geometry', () => {
    let container: HTMLDivElement;
    let root: Root;
    const originalResizeObserver = globalThis.ResizeObserver;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        globalThis.ResizeObserver = class {
            observe() {}
            disconnect() {}
        } as unknown as typeof ResizeObserver;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        globalThis.ResizeObserver = originalResizeObserver;
    });

    test('uses the tallest card in each row and keeps a short last row aligned', () => {
        const items = [
            { id: 'a', height: 30 },
            { id: 'b', height: 60 },
            { id: 'c', height: 20 },
        ];
        act(() =>
            root.render(
                <VirtualGridComp
                    items={items}
                    getItemKey={(item) => item.id}
                    renderItem={(item, index) => (
                        <span key={item.id} data-item-index={index}>
                            {item.id}
                        </span>
                    )}
                    itemWidth={100}
                    columnCount={2}
                    estimateRowHeight={50}
                    getItemHeight={(item) => item.height}
                />,
            ),
        );
        const rows = container.querySelectorAll<HTMLElement>(
            '[data-virtual-row-index]',
        );
        expect(rows).toHaveLength(2);
        expect(fake.rowKeys).toEqual(['2:a', '2:c']);
        expect(rows[1].style.top).toBe('60px');
        expect(rows[1].style.width).toBe('200px');
        expect(rows[1].textContent).toBe('c');
        expect(container.firstElementChild?.getAttribute('style')).toContain(
            'height: 80px',
        );
    });

    test('a reveal finds the ROW holding an item, at the current column count', () => {
        const items = [
            { id: 'a', height: 30 },
            { id: 'b', height: 60 },
            { id: 'c', height: 20 },
        ];
        const renderGrid = (columnCount: number) => {
            act(() =>
                root.render(
                    <VirtualGridComp
                        items={items}
                        getItemKey={(item) => item.id}
                        renderItem={(item) => (
                            <span key={item.id}>{item.id}</span>
                        )}
                        itemWidth={100}
                        columnCount={columnCount}
                        estimateRowHeight={50}
                        getItemHeight={(item) => item.height}
                    />,
                ),
            );
        };
        renderGrid(2);
        expect(['a', 'b', 'c', 'zzz'].map(fake.findIndex!)).toEqual([
            0, 0, 1, -1,
        ]);
        renderGrid(1);
        expect(fake.findIndex!('c')).toBe(2);

        // Without `getItemKey` an item is its own key.
        act(() =>
            root.render(
                <VirtualGridComp
                    items={['one', 'two', 'three']}
                    renderItem={(item) => <span key={item}>{item}</span>}
                    itemWidth={80}
                    columnCount={2}
                    estimateRowHeight={34}
                />,
            ),
        );
        expect(fake.findIndex!('three')).toBe(1);
        expect(fake.findIndex!('four')).toBe(-1);
    });

    test("measures the cards' chrome off one row and adds it to every row", () => {
        vi.useFakeTimers();
        const observerCallbacks: Array<() => void> = [];
        globalThis.ResizeObserver = class {
            constructor(callback: () => void) {
                observerCallbacks.push(callback);
            }
            observe() {}
            disconnect() {}
        } as unknown as typeof ResizeObserver;
        try {
            const items = [
                { id: 'a', height: 30 },
                { id: 'b', height: 60 },
                { id: 'c', height: 20 },
            ];
            act(() =>
                root.render(
                    <VirtualGridComp
                        items={items}
                        getItemKey={(item) => item.id}
                        renderItem={(item) => (
                            <span key={item.id}>{item.id}</span>
                        )}
                        itemWidth={100}
                        columnCount={2}
                        estimateRowHeight={50}
                        getItemHeight={(item) => item.height}
                    />,
                ),
            );
            const rowTop = (rowIndex: number) => {
                return container.querySelector<HTMLElement>(
                    `[data-virtual-row-index="${rowIndex}"]`,
                )!.style.top;
            };
            // Before any measuring: the guess, less the first row's items.
            expect(rowTop(1)).toBe('60px');
            const firstRow = container.querySelector(
                '[data-virtual-row-index="0"]',
            )!;
            const rect = vi
                .spyOn(firstRow, 'getBoundingClientRect')
                .mockReturnValue({ height: 75 } as DOMRect);
            // Measured on a timer too: an occluded window delivers no
            // observer callbacks at all.
            act(() => vi.advanceTimersByTime(0));
            // The tallest card is 60, so every row carries 15 of chrome.
            expect(rowTop(1)).toBe('75px');
            expect(
                container.firstElementChild?.getAttribute('style'),
            ).toContain('height: 110px');

            const notifyRow = () => {
                act(() => {
                    for (const callback of observerCallbacks) {
                        callback();
                    }
                });
            };
            // Shorter than its own items: the body has not drawn yet.
            rect.mockReturnValue({ height: 40 } as DOMRect);
            notifyRow();
            expect(rowTop(1)).toBe('75px');
            rect.mockReturnValue({ height: 0 } as DOMRect);
            notifyRow();
            expect(rowTop(1)).toBe('75px');
            // Under a pixel is the same chrome.
            rect.mockReturnValue({ height: 75.6 } as DOMRect);
            notifyRow();
            expect(rowTop(1)).toBe('75px');
            rect.mockReturnValue({ height: 82 } as DOMRect);
            notifyRow();
            expect(rowTop(1)).toBe('82px');
        } finally {
            vi.useRealTimers();
        }
    });

    test('uses individually measured heights when cards cannot report them', () => {
        act(() =>
            root.render(
                <VirtualGridComp
                    items={['one', 'two', 'three']}
                    renderItem={(item) => <span key={item}>{item}</span>}
                    itemWidth={80}
                    columnCount={1}
                    estimateRowHeight={34}
                />,
            ),
        );
        const rows = container.querySelectorAll<HTMLElement>(
            '[data-virtual-row-index]',
        );
        expect(rows).toHaveLength(3);
        expect([...rows].map((row) => row.style.top)).toEqual([
            '0px',
            '11px',
            '33px',
        ]);
        expect(container.firstElementChild?.getAttribute('style')).toContain(
            'height: 66px',
        );
    });
});
