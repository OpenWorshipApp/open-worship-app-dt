// @vitest-environment jsdom

import { act, type RefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    top: 0,
    bottom: 25,
    scrollCallback: null as null | (() => void),
    scrollBand: vi.fn(),
    unsubscribe: vi.fn(),
    observe: vi.fn(),
    disconnect: vi.fn(),
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});
vi.mock('./virtualScrollHelpers', () => ({
    findClippingAncestors: () => [],
    findScrollingAncestors: () => [],
    toVisibleWindow: () => ({ top: state.top, bottom: state.bottom }),
    subscribeScrollerList: (_list: object[], update: () => void) => {
        state.scrollCallback = update;
        return state.unsubscribe;
    },
    scrollBandIntoView: state.scrollBand,
}));

import {
    useVirtualRows,
    type UseVirtualRowsOptionsType,
} from './useVirtualRows';

let host: HTMLDivElement;
let scrollContainer: HTMLDivElement;
let root: Root;
let current: ReturnType<typeof useVirtualRows>;

function Harness(props: UseVirtualRowsOptionsType) {
    current = useVirtualRows(props);
    return <div>{current.rows.map((row) => row.index).join(',')}</div>;
}

function options(overrides: Partial<UseVirtualRowsOptionsType> = {}) {
    return {
        containerRef: { current: scrollContainer } as RefObject<HTMLElement>,
        count: 10,
        rowHeight: 10,
        overscan: 1,
        pinnedIndexes: [9, -1, 10],
        ...overrides,
    };
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe = state.observe;
            disconnect = state.disconnect;
        },
    );
    state.top = 0;
    state.bottom = 25;
    state.scrollCallback = null;
    state.scrollBand.mockReset().mockReturnValue(true);
    state.unsubscribe.mockReset();
    state.observe.mockReset();
    state.disconnect.mockReset();
    host = document.createElement('div');
    scrollContainer = document.createElement('div');
    host.append(scrollContainer);
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('useVirtualRows', () => {
    it('renders the visible band and valid pinned rows in index order, then follows scrolling', async () => {
        await act(async () => root.render(<Harness {...options()} />));
        expect(current.rows).toEqual([
            { index: 0, start: 0, height: 10 },
            { index: 1, start: 10, height: 10 },
            { index: 2, start: 20, height: 10 },
            { index: 3, start: 30, height: 10 },
            { index: 9, start: 90, height: 10 },
        ]);
        expect(current.totalHeight).toBe(100);
        expect(state.observe).toHaveBeenCalledWith(scrollContainer);

        state.top = 40;
        state.bottom = 60;
        await act(async () => state.scrollCallback!());
        expect(current.rows.map((row) => row.index)).toEqual([
            3, 4, 5, 6, 7, 9,
        ]);
        await act(async () =>
            root.render(<Harness {...options({ count: 5 })} />),
        );
        expect(current.totalHeight).toBe(50);
        expect(current.rows.every((row) => row.index < 5)).toBe(true);
    });

    it('renders every row when disabled and handles a missing container', async () => {
        await act(async () =>
            root.render(
                <Harness
                    {...options({
                        containerRef: { current: null },
                        count: 4,
                        isEnabled: false,
                    })}
                />,
            ),
        );
        expect(current.rows.map((row) => row.index)).toEqual([0, 1, 2, 3]);
        expect(current.scrollToRow(2)).toBe(false);
        expect(state.observe).not.toHaveBeenCalled();
    });

    it('scrolls to a row with the requested alignment and refreshes its band', async () => {
        await act(async () => root.render(<Harness {...options()} />));
        state.top = 40;
        state.bottom = 60;
        await act(async () =>
            expect(current.scrollToRow(4, 'center', 'smooth')).toBe(true),
        );
        const scrollOptions = state.scrollBand.mock.lastCall![0];
        expect(scrollOptions).toMatchObject({
            height: 10,
            align: 'center',
            behavior: 'smooth',
        });
        expect(current.rows.map((row) => row.index)).toContain(4);

        state.scrollBand.mockReturnValue(false);
        expect(current.scrollToRow(8)).toBe(false);
        expect(state.scrollBand.mock.lastCall![0]).toMatchObject({
            align: 'nearest',
            behavior: 'auto',
        });
    });

    it('unsubscribes and disconnects its observer on unmount', async () => {
        await act(async () => root.render(<Harness {...options()} />));
        await act(async () => root.unmount());
        expect(state.unsubscribe).toHaveBeenCalledOnce();
        expect(state.disconnect).toHaveBeenCalledOnce();
        root = createRoot(host);
    });
});
