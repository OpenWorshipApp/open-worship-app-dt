// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type ScrollBandOptionsType = {
    toBandTop: (scroller: HTMLElement) => number;
    height: number;
    align: 'nearest' | 'center';
    behavior: ScrollBehavior;
};

const state = vi.hoisted(() => ({
    top: 0,
    bottom: 60,
    scrollBand: vi.fn(),
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
// The geometry jsdom cannot give: what part of the list is on screen, and
// the scroller a reveal aims. Everything above it -- the windowing, the
// measuring, the pin and the reveal registry -- is the real code.
vi.mock('./virtualScrollHelpers', () => ({
    findClippingAncestors: () => [],
    findScrollingAncestors: () => [],
    toVisibleWindow: () => ({ top: state.top, bottom: state.bottom }),
    subscribeScrollerList: () => () => {},
    scrollBandIntoView: (options: ScrollBandOptionsType) => {
        return state.scrollBand(options);
    },
}));

import VirtualListComp from './VirtualListComp';
import { VIRTUAL_ROW_KEY } from './useMeasuredRowHeights';
import {
    registerVirtualReveal,
    revealVirtualElement,
    revealVirtualItem,
    waitForVirtualElement,
} from './virtualRevealHelpers';

const ESTIMATE = 20;
// The scroller a reveal is handed: the list starts at its very top.
const SCROLLER = {
    getBoundingClientRect: () => ({ top: 0 }),
    scrollTop: 0,
} as unknown as HTMLElement;

type ItemType = { id: string; label: string };

function genItems(count: number, prefix = 'item'): ItemType[] {
    return Array.from({ length: count }, (_, index) => {
        return { id: `${prefix}-${index}`, label: `Row ${index}` };
    });
}

const getItemKey = (item: ItemType) => item.id;
const renderItem = (item: ItemType) => <span>{item.label}</span>;

let containers: HTMLDivElement[];
let roots: Root[];

function mountList(
    items: ItemType[],
    props: Partial<Parameters<typeof VirtualListComp<ItemType>>[0]> = {},
) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    containers.push(container);
    roots.push(root);
    const render = (nextItems: ItemType[]) => {
        act(() =>
            root.render(
                <VirtualListComp
                    items={nextItems}
                    getItemKey={getItemKey}
                    renderItem={renderItem}
                    estimateRowHeight={ESTIMATE}
                    {...props}
                />,
            ),
        );
    };
    render(items);
    return { container, root, render };
}

function drawnKeys(container: HTMLElement) {
    return Array.from(
        container.querySelectorAll<HTMLElement>(`[${VIRTUAL_ROW_KEY}]`),
    ).map((row) => {
        return row.getAttribute(VIRTUAL_ROW_KEY);
    });
}

function rowOf(container: HTMLElement, key: string) {
    return container.querySelector<HTMLElement>(
        `[${VIRTUAL_ROW_KEY}="${key}"]`,
    );
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
    state.top = 0;
    state.bottom = 60;
    state.scrollBand.mockReset().mockReturnValue(true);
    containers = [];
    roots = [];
});

afterEach(() => {
    for (const root of roots) {
        act(() => root.unmount());
    }
    for (const container of containers) {
        container.remove();
    }
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('VirtualListComp windowing', () => {
    test('draws only the rows in view (plus overscan), each at its offset', () => {
        const { container } = mountList(genItems(100), {
            className: 'test-list',
            style: { background: 'red' },
            rowClassName: 'test-row',
            rowStyle: { paddingLeft: '4px' },
        });
        // Rows 0..3 are in [0, 60]; two of overscan below.
        expect(drawnKeys(container)).toEqual([
            'item-0',
            'item-1',
            'item-2',
            'item-3',
            'item-4',
            'item-5',
        ]);
        const list = container.firstElementChild as HTMLElement;
        expect(list.className).toBe('test-list');
        // Never-drawn rows count at the estimate: the scrollbar is honest.
        expect(list.style.height).toBe(`${100 * ESTIMATE}px`);
        expect(list.style.position).toBe('relative');
        expect(list.style.background).toBe('red');
        const fifth = rowOf(container, 'item-5')!;
        expect(fifth.className).toBe('test-row');
        expect(fifth.style.top).toBe('100px');
        expect(fifth.style.position).toBe('absolute');
        expect(fifth.style.paddingLeft).toBe('4px');
        expect(fifth.textContent).toBe('Row 5');
    });

    test('a window resize re-reads what is on screen', () => {
        const { container } = mountList(genItems(100), { overscan: 1 });
        state.top = 400;
        state.bottom = 460;
        act(() => window.dispatchEvent(new Event('resize')));
        expect(drawnKeys(container)).toEqual([
            'item-19',
            'item-20',
            'item-21',
            'item-22',
            'item-23',
            'item-24',
        ]);
    });

    test('disabled, it draws every row (printing, exporting)', () => {
        state.bottom = 0;
        const { container } = mountList(genItems(7), { isEnabled: false });
        expect(drawnKeys(container)).toHaveLength(7);
    });
});

describe('a reveal draws the row, then lets it go', () => {
    test('a far row is pinned, aimed at the centre, and released after 4 s', () => {
        const { container } = mountList(genItems(100));
        expect(rowOf(container, 'item-80')).toBeNull();

        let bandTop = -1;
        state.scrollBand.mockImplementation(
            (options: ScrollBandOptionsType) => {
                bandTop = options.toBandTop(SCROLLER);
                return true;
            },
        );
        let isHeld = false;
        act(() => {
            isHeld = revealVirtualItem('item-80');
        });
        expect(isHeld).toBe(true);
        const firstAim = state.scrollBand.mock.calls[0][0];
        expect(firstAim).toMatchObject({
            height: ESTIMATE,
            align: 'center',
            behavior: 'auto',
        });
        // Row 80's own offset, wherever the band is.
        expect(bandTop).toBe(80 * ESTIMATE);
        // Drawn although it is not in the band, in reading order.
        expect(rowOf(container, 'item-80')).not.toBeNull();
        expect(drawnKeys(container).at(-1)).toBe('item-80');

        act(() => vi.advanceTimersByTime(3999));
        expect(rowOf(container, 'item-80')).not.toBeNull();
        act(() => vi.advanceTimersByTime(1));
        expect(rowOf(container, 'item-80')).toBeNull();
    });

    test('a key this list does not hold is a no, and nothing scrolls', () => {
        mountList(genItems(10));
        let isHeld = true;
        act(() => {
            isHeld = revealVirtualItem('somewhere-else');
        });
        expect(isHeld).toBe(false);
        expect(state.scrollBand).not.toHaveBeenCalled();
    });

    test('an item already in view still answers yes', () => {
        state.scrollBand.mockReturnValue(false);
        const { container } = mountList(genItems(10));
        let isHeld = false;
        act(() => {
            isHeld = revealVirtualItem('item-1');
        });
        expect(isHeld).toBe(true);
        expect(rowOf(container, 'item-1')).not.toBeNull();
    });

    test('a newer reveal moves the pin; the timer restarts', () => {
        const { container } = mountList(genItems(100));
        act(() => {
            revealVirtualItem('item-50');
        });
        act(() => vi.advanceTimersByTime(3000));
        act(() => {
            revealVirtualItem('item-70');
        });
        expect(rowOf(container, 'item-50')).toBeNull();
        expect(rowOf(container, 'item-70')).not.toBeNull();
        // 3 s into the second pin: the first pin's timer did not release it.
        act(() => vi.advanceTimersByTime(3000));
        expect(rowOf(container, 'item-70')).not.toBeNull();
        act(() => vi.advanceTimersByTime(1000));
        expect(rowOf(container, 'item-70')).toBeNull();
    });

    test('while pinned, a change in height re-aims: nearest, or centre when smooth', () => {
        const { render } = mountList(genItems(100));
        act(() => {
            revealVirtualItem('item-60');
        });
        state.scrollBand.mockClear();
        // The list grows (a reload): the pinned row is aimed at again.
        render(genItems(120));
        expect(state.scrollBand).toHaveBeenCalled();
        expect(state.scrollBand.mock.lastCall![0]).toMatchObject({
            align: 'nearest',
            behavior: 'auto',
        });

        act(() => {
            revealVirtualItem('item-90', 'smooth');
        });
        state.scrollBand.mockClear();
        render(genItems(130));
        // A smooth reveal in flight is not cut short by an instant jump.
        expect(state.scrollBand.mock.lastCall![0]).toMatchObject({
            align: 'center',
            behavior: 'smooth',
        });

        // Released: growing again aims at nothing.
        act(() => vi.advanceTimersByTime(4000));
        state.scrollBand.mockClear();
        render(genItems(140));
        expect(state.scrollBand).not.toHaveBeenCalled();
    });

    test('every mounted list is asked, and an unmounted one is not', () => {
        // The first aim of a reveal is the centred one; the pin then keeps
        // its row in view with `nearest` aims of its own.
        const countRevealAims = () => {
            return state.scrollBand.mock.calls.filter(([options]) => {
                return options.align === 'center';
            }).length;
        };
        const first = mountList(genItems(30, 'shared'));
        const second = mountList(genItems(30, 'shared'));
        act(() => {
            revealVirtualItem('shared-25');
        });
        expect(countRevealAims()).toBe(2);
        expect(rowOf(first.container, 'shared-25')).not.toBeNull();
        expect(rowOf(second.container, 'shared-25')).not.toBeNull();

        act(() => first.root.unmount());
        roots.splice(roots.indexOf(first.root), 1);
        state.scrollBand.mockClear();
        act(() => {
            revealVirtualItem('shared-26');
        });
        expect(countRevealAims()).toBe(1);

        act(() => second.root.unmount());
        roots.splice(roots.indexOf(second.root), 1);
        expect(revealVirtualItem('shared-26')).toBe(false);
    });

    test('unmounting while pinned leaves no timer behind', () => {
        const { root } = mountList(genItems(100));
        act(() => {
            revealVirtualItem('item-80');
        });
        expect(vi.getTimerCount()).toBeGreaterThan(0);
        act(() => root.unmount());
        roots.splice(roots.indexOf(root), 1);
        // The 4 s release is cleared with the list, not left to fire.
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe('virtualRevealHelpers', () => {
    test('revealVirtualElement answers at once when the element is drawn', async () => {
        const revealer = vi.fn(() => true);
        const unregister = registerVirtualReveal(revealer);
        const element = document.createElement('div');
        await expect(revealVirtualElement('a', () => element)).resolves.toBe(
            element,
        );
        expect(revealer).not.toHaveBeenCalled();
        unregister();
    });

    test('revealVirtualElement gives up at once when no list holds the key', async () => {
        const revealer = vi.fn(() => false);
        const unregister = registerVirtualReveal(revealer);
        const getElement = vi.fn(() => null);
        await expect(revealVirtualElement('gone', getElement)).resolves.toBe(
            null,
        );
        expect(revealer).toHaveBeenCalledWith('gone', undefined);
        // Asked once, not polled.
        expect(getElement).toHaveBeenCalledTimes(1);
        unregister();
    });

    test('a revealed row is waited for, re-asking the lists each turn', async () => {
        const revealer = vi.fn(() => true);
        const unregister = registerVirtualReveal(revealer);
        const element = document.createElement('div');
        let lookCount = 0;
        const getElement = () => {
            lookCount += 1;
            return lookCount >= 4 ? element : null;
        };
        const promise = revealVirtualElement('far', getElement);
        await vi.advanceTimersByTimeAsync(40 * 3);
        await expect(promise).resolves.toBe(element);
        // Once to start, then once after each of the turns that found nothing.
        expect(revealer).toHaveBeenCalledTimes(1 + 2);
        expect(revealer).toHaveBeenLastCalledWith('far', undefined);
        unregister();
    });

    test('waiting is bounded: a key never drawn returns null', async () => {
        const getElement = vi.fn(() => null);
        const promise = waitForVirtualElement(getElement);
        await vi.advanceTimersByTimeAsync(40 * 40);
        await expect(promise).resolves.toBeNull();
        // Forty looks on the timer, and one last look.
        expect(getElement).toHaveBeenCalledTimes(41);
    });

    test('every list is asked even after one answers; the behaviour is passed on', () => {
        const first = vi.fn(() => true);
        const second = vi.fn(() => false);
        const unregisterFirst = registerVirtualReveal(first);
        const unregisterSecond = registerVirtualReveal(second);
        expect(revealVirtualItem('k', 'smooth')).toBe(true);
        expect(first).toHaveBeenCalledWith('k', 'smooth');
        expect(second).toHaveBeenCalledWith('k', 'smooth');
        unregisterFirst();
        expect(revealVirtualItem('k')).toBe(false);
        unregisterSecond();
        expect(revealVirtualItem('k')).toBe(false);
        expect(second).toHaveBeenCalledTimes(2);
    });
});
