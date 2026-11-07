// @vitest-environment jsdom

import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

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

import {
    useMeasuredRowHeights,
    VIRTUAL_ROW_KEY,
} from './useMeasuredRowHeights';

type ProbeType = { rowHeight: (index: number) => number };

function HeightProbeComp({
    rowKeys,
    visibleKeys,
    onRender,
}: {
    rowKeys: string[];
    visibleKeys: string[];
    onRender: (probe: ProbeType) => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const probe = useMeasuredRowHeights({
        rowKeys,
        estimateRowHeight: 34,
        containerRef,
    });
    onRender(probe);
    return (
        <div ref={containerRef}>
            {visibleKeys.map((key) => (
                <div
                    key={key}
                    {...{ [VIRTUAL_ROW_KEY]: key }}
                    ref={probe.handleRowRef}
                />
            ))}
        </div>
    );
}

// A list whose container is not mounted yet: the rows are, the box is not.
function DetachedProbeComp({
    onRender,
}: {
    onRender: (probe: ReturnType<typeof useMeasuredRowHeights>) => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const probe = useMeasuredRowHeights({
        rowKeys: ['a', 'b'],
        estimateRowHeight: 34,
        containerRef,
    });
    onRender(probe);
    return (
        <>
            {['a', 'b'].map((key) => (
                <div
                    key={key}
                    {...{ [VIRTUAL_ROW_KEY]: key }}
                    ref={probe.handleRowRef}
                />
            ))}
        </>
    );
}

describe('measured virtual row heights', () => {
    let container: HTMLDivElement;
    let root: Root;
    let latest: ProbeType;
    let heights: Record<string, number>;
    let observerCallbacks: Array<(entries: Array<{ target: Element }>) => void>;
    const originalResizeObserver = globalThis.ResizeObserver;
    const originalRect = Element.prototype.getBoundingClientRect;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.useFakeTimers();
        heights = { a: 20, b: 40, c: 2000, d: 50 };
        observerCallbacks = [];
        globalThis.ResizeObserver = class {
            constructor(
                callback: (entries: Array<{ target: Element }>) => void,
            ) {
                observerCallbacks.push(callback);
            }
            observe() {}
            unobserve() {}
            disconnect() {}
        } as unknown as typeof ResizeObserver;
        Element.prototype.getBoundingClientRect = function () {
            const key = this.getAttribute(VIRTUAL_ROW_KEY) ?? '';
            return { height: heights[key] ?? 0 } as DOMRect;
        };
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        globalThis.ResizeObserver = originalResizeObserver;
        Element.prototype.getBoundingClientRect = originalRect;
        vi.useRealTimers();
    });

    function render(rowKeys: string[], visibleKeys: string[]) {
        act(() =>
            root.render(
                <HeightProbeComp
                    rowKeys={rowKeys}
                    visibleKeys={visibleKeys}
                    onRender={(value) => {
                        latest = value;
                    }}
                />,
            ),
        );
    }
    async function measure() {
        await act(async () => vi.runAllTimersAsync());
    }

    test('uses a median for undrawn rows and prunes measurements by key', async () => {
        render(['a', 'b', 'c', 'd'], ['a', 'b', 'c']);
        expect(latest.rowHeight(3)).toBe(34);
        await measure();
        expect([0, 1, 2, 3].map(latest.rowHeight)).toEqual([20, 40, 2000, 40]);

        render(['c', 'd'], ['c']);
        expect(latest.rowHeight(0)).toBe(2000);
        expect(latest.rowHeight(1)).toBe(2000);
    });

    test('without a container it watches nothing, and still measures its rows', async () => {
        const OriginalMutationObserver = globalThis.MutationObserver;
        let mutationObserverCount = 0;
        globalThis.MutationObserver = class extends OriginalMutationObserver {
            constructor(callback: MutationCallback) {
                super(callback);
                mutationObserverCount += 1;
            }
        };
        try {
            // With a container, its content is watched for late growth.
            render(['a', 'b'], ['a']);
            expect(mutationObserverCount).toBe(1);

            mutationObserverCount = 0;
            let probe!: ReturnType<typeof useMeasuredRowHeights>;
            act(() =>
                root.render(
                    <DetachedProbeComp
                        onRender={(value) => {
                            probe = value;
                        }}
                    />,
                ),
            );
            expect(mutationObserverCount).toBe(0);
            await measure();
            expect([0, 1].map(probe.rowHeight)).toEqual([20, 40]);
            // The old ref protocol: a null element is a no-op with no cleanup.
            expect(probe.handleRowRef(null)).toBeUndefined();
        } finally {
            globalThis.MutationObserver = OriginalMutationObserver;
        }
    });

    test('ignores detached rows and sub-pixel changes, then measures a real resize', async () => {
        render(['a', 'b'], ['a']);
        await measure();
        expect(latest.rowHeight(0)).toBe(20);
        const rowHeightBefore = latest.rowHeight;
        const element = container.querySelector(`[${VIRTUAL_ROW_KEY}="a"]`)!;

        heights.a = 20.5;
        act(() => observerCallbacks[0]([{ target: element }]));
        expect(latest.rowHeight).toBe(rowHeightBefore);

        heights.a = 24;
        act(() => observerCallbacks[0]([{ target: element }]));
        expect(latest.rowHeight(0)).toBe(24);

        const detached = document.createElement('div');
        detached.setAttribute(VIRTUAL_ROW_KEY, 'b');
        act(() => observerCallbacks[0]([{ target: detached }]));
        expect(latest.rowHeight(1)).toBe(24);
    });
});
