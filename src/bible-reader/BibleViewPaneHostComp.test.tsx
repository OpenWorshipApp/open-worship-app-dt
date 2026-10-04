// @vitest-environment jsdom

import { act, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        mountCountMap: new Map<number, number>(),
        controller: {
            finalRenderer: (_bibleItem: any): any => null,
        },
    };
});

vi.mock('./BibleItemsViewController', () => ({
    toStraightItems: (nestedBibleItems: any) => {
        return [nestedBibleItems].flat(Infinity);
    },
    useBibleItemsViewControllerContext: () => h.controller,
}));
vi.mock('../helper/appHooks', async () => {
    const { useEffect: useReactEffect } = await import('react');
    return { useAppEffect: useReactEffect };
});

import BibleViewPaneHostComp from './BibleViewPaneHostComp';
import BibleViewPaneSlotComp from './BibleViewPaneSlotComp';
import {
    assignPaneKeys,
    BIBLE_VIEW_PANE_CLASS,
    BibleViewPaneStore,
    toPaneKeyMemory,
} from './bibleViewPaneHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Stands in for a bible view: counts its mounts and keeps a state of its own.
function PaneComp({ id }: Readonly<{ id: number }>) {
    const [mountedAt] = useState(() => {
        return `pane-${id}-${Math.random()}`;
    });
    useEffect(() => {
        h.mountCountMap.set(id, (h.mountCountMap.get(id) ?? 0) + 1);
    }, [id]);
    return <div className="pane" data-id={id} data-mounted-at={mountedAt} />;
}

function genItem(id: number) {
    return { id } as any;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    h.mountCountMap.clear();
    h.controller.finalRenderer = (bibleItem: any) => {
        return <PaneComp id={bibleItem.id} />;
    };
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
});

function render(nestedBibleItems: any, layout: React.ReactNode) {
    act(() => {
        root.render(
            <BibleViewPaneHostComp nestedBibleItems={nestedBibleItems}>
                {layout}
            </BibleViewPaneHostComp>,
        );
    });
}

describe('BibleViewPaneHostComp', () => {
    // What a close does to a split: the survivor's place in the layout
    // changes parent, which React can only answer by rebuilding it.
    test('a view whose slot moves to another parent is not rebuilt', () => {
        render(
            [genItem(1), genItem(2)],
            <div className="split">
                <div className="left">
                    <BibleViewPaneSlotComp bibleItemId={1} />
                </div>
                <div className="right">
                    <BibleViewPaneSlotComp bibleItemId={2} />
                </div>
            </div>,
        );
        const pane = host.querySelector('.pane[data-id="2"]')!;
        expect(pane.closest('.right')).not.toBeNull();
        const mountedAt = pane.getAttribute('data-mounted-at');

        render(
            [genItem(2)],
            <section className="alone">
                <BibleViewPaneSlotComp bibleItemId={2} />
            </section>,
        );
        const movedPane = host.querySelector('.pane[data-id="2"]')!;
        expect(movedPane).toBe(pane);
        expect(movedPane.getAttribute('data-mounted-at')).toBe(mountedAt);
        expect(movedPane.closest('.alone')).not.toBeNull();
        expect(h.mountCountMap.get(2)).toBe(1);
        expect(host.querySelector('.pane[data-id="1"]')).toBeNull();
    });

    test('a view no slot shows is not mounted', () => {
        render(
            [genItem(1), genItem(2)],
            <BibleViewPaneSlotComp bibleItemId={1} />,
        );
        expect(host.querySelectorAll('.pane')).toHaveLength(1);
        expect(h.mountCountMap.has(2)).toBe(false);
    });

    test('a closed view releases its element', () => {
        render(
            [genItem(1), genItem(2)],
            <>
                <BibleViewPaneSlotComp bibleItemId={1} />
                <BibleViewPaneSlotComp bibleItemId={2} />
            </>,
        );
        expect(host.querySelectorAll(`.${BIBLE_VIEW_PANE_CLASS}`)).toHaveLength(
            2,
        );
        render([genItem(1)], <BibleViewPaneSlotComp bibleItemId={1} />);
        expect(host.querySelectorAll(`.${BIBLE_VIEW_PANE_CLASS}`)).toHaveLength(
            1,
        );
        expect(host.querySelectorAll('.pane')).toHaveLength(1);
    });

    test('without a slot in the layout nothing is drawn', () => {
        render([genItem(1)], null);
        expect(host.querySelector('.pane')).toBeNull();
    });
});

describe('BibleViewPaneStore', () => {
    function genScroller(element: HTMLElement) {
        const scroller = document.createElement('div');
        let scrollTop = 0;
        Object.defineProperty(scroller, 'scrollTop', {
            get: () => scrollTop,
            set: (value: number) => {
                scrollTop = value;
            },
        });
        element.appendChild(scroller);
        return scroller;
    }

    // A browser drops an element's scroll offsets when it leaves the
    // document; the store reads them before and gives them back after.
    test('a move gives back the scroll offsets and the focus', () => {
        const store = new BibleViewPaneStore();
        const slot1 = document.createElement('div');
        const slot2 = document.createElement('div');
        document.body.append(slot1, slot2);
        store.attach(7, slot1);
        const element = store.getElement(7);
        const scroller = genScroller(element);
        const button = document.createElement('button');
        element.appendChild(button);
        scroller.scrollTop = 240;
        button.focus();

        store.detach(7, slot1);
        expect(element.isConnected).toBe(false);
        scroller.scrollTop = 0;
        store.attach(7, slot2);

        expect(element.parentElement).toBe(slot2);
        expect(scroller.scrollTop).toBe(240);
        expect(document.activeElement).toBe(button);
        slot1.remove();
        slot2.remove();
    });

    test('a slot another took over leaves the view where it is', () => {
        const store = new BibleViewPaneStore();
        const slot1 = document.createElement('div');
        const slot2 = document.createElement('div');
        store.attach(7, slot1);
        store.attach(7, slot2);
        store.detach(7, slot1);
        expect(store.getElement(7).parentElement).toBe(slot2);
    });

    test('sweep releases only what no slot holds', () => {
        const store = new BibleViewPaneStore();
        const slot = document.createElement('div');
        store.attach(1, slot);
        store.attach(2, slot);
        store.detach(2, slot);
        store.sweep();
        expect(store.size).toBe(1);
        expect(store.getElement(1).parentElement).toBe(slot);
    });
});

describe('assignPaneKeys', () => {
    const a = genItem(1);
    const b = genItem(2);
    const c = genItem(3);
    const n = genItem(4);
    function keysAfter(before: any[], after: any[]) {
        const firstKeys = assignPaneKeys(before, new Map());
        return {
            firstKeys,
            keys: assignPaneKeys(after, toPaneKeyMemory(before, firstKeys)),
        };
    }

    test('a view is keyed by its id and a split by its first view', () => {
        expect(assignPaneKeys([a, [b, c]], new Map())).toEqual(['i1', 'g2']);
    });

    // Splitting a group's first view used to rename the group (its first
    // view changed), which rebuilt its container and reset its sizes.
    test('splitting a view keeps every slot around it', () => {
        expect(keysAfter([a, [b, c]], [a, [[n, b], c]]).keys).toEqual([
            'i1',
            'g2',
        ]);
        // ...and the view's own slot goes to the split it became.
        expect(keysAfter([b, c], [[n, b], c]).keys).toEqual(['i2', 'i3']);
    });

    test('closing the first view leaves the others their slots', () => {
        expect(keysAfter([a, b, c], [b, c]).keys).toEqual(['i2', 'i3']);
    });

    test('a split left with one view hands that view its slot', () => {
        expect(keysAfter([a, [b, c]], [a, c]).keys).toEqual(['i1', 'g2']);
    });

    test('keys never repeat among siblings', () => {
        const keys = assignPaneKeys([[a], [b]], new Map([['g2', [1]]]));
        expect(keys).toEqual(['g2', 'g2-1']);
    });
});
