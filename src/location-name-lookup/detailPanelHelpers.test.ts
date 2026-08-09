import { afterEach, describe, expect, test, vi } from 'vitest';

// `useOpenDetailPanels` is the store's only public reader. Stubbing
// `useSyncExternalStore` with a pass-through drives the real store exactly the
// way React drives it, with no renderer for what is plain store logic.
const h = vi.hoisted(() => ({
    capturedSubscribe: null as null | ((listener: () => void) => () => void),
}));
vi.mock('react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react')>();
    return {
        ...actual,
        useSyncExternalStore: (
            subscribe: (listener: () => void) => () => void,
            getSnapshot: () => unknown,
        ) => {
            h.capturedSubscribe = subscribe;
            return getSnapshot();
        },
    };
});

import {
    closeAllDetailPanels,
    closeDetailPanel,
    openDetailPanel,
    useOpenDetailPanels,
} from './detailPanelHelpers';

function readPanels() {
    return useOpenDetailPanels();
}

function subscribe(listener: () => void) {
    readPanels();
    return h.capturedSubscribe!(listener);
}

// The store is module-level on purpose — panels outlive the lookup that opened
// them — so every test has to hand it back empty.
afterEach(() => {
    closeAllDetailPanels();
});

describe('opening a detail panel', () => {
    test('raises the existing panel instead of stacking a duplicate', () => {
        openDetailPanel({ kind: 'name', target: 'n-1', name: 'Moses' });
        // The same record again — followed from a reference in another panel.
        openDetailPanel({ kind: 'name', target: 'n-1', name: 'Moses' });

        expect(readPanels().map((panel) => panel.key)).toEqual(['name:n-1']);
    });

    // Ids are only unique within their own dataset, and a verse key is not an
    // id at all, so the kind has to be part of the identity.
    test('the same target under a different kind is a different panel', () => {
        openDetailPanel({ kind: 'name', target: 'x', name: 'A name' });
        openDetailPanel({ kind: 'location', target: 'x', name: 'A place' });

        expect(readPanels().map((panel) => panel.key)).toEqual([
            'name:x',
            'location:x',
        ]);
    });

    test('new panels go on the end, so the cascade offset stays stable', () => {
        openDetailPanel({ kind: 'name', target: 'n-1', name: 'Moses' });
        openDetailPanel({ kind: 'verse', target: 'EXO 6:23', name: 'Exodus' });

        expect(readPanels().map((panel) => panel.target)).toEqual([
            'n-1',
            'EXO 6:23',
        ]);
    });

    test('notifies subscribers, with a NEW array each time', () => {
        const snapshots: unknown[] = [];
        const unsubscribe = subscribe(() => {
            snapshots.push(readPanels());
        });

        openDetailPanel({ kind: 'name', target: 'n-1', name: 'Moses' });
        openDetailPanel({ kind: 'name', target: 'n-2', name: 'Aaron' });

        expect(snapshots).toHaveLength(2);
        // A mutated array would be `===` and React would skip the re-render.
        expect(snapshots[0]).not.toBe(snapshots[1]);
        unsubscribe();
    });

    test('a duplicate notifies nobody', () => {
        openDetailPanel({ kind: 'name', target: 'n-1', name: 'Moses' });
        const listener = vi.fn();
        const unsubscribe = subscribe(listener);

        openDetailPanel({ kind: 'name', target: 'n-1', name: 'Moses' });

        expect(listener).not.toHaveBeenCalled();
        unsubscribe();
    });
});

describe('closing detail panels', () => {
    test('closes only the requested key', () => {
        openDetailPanel({ kind: 'name', target: 'n-1', name: 'Moses' });
        openDetailPanel({ kind: 'name', target: 'n-2', name: 'Aaron' });

        closeDetailPanel('name:n-1');

        expect(readPanels().map((panel) => panel.key)).toEqual(['name:n-2']);
    });

    // A no-op notify would re-render every open widget for nothing.
    test('an unknown key notifies nobody', () => {
        openDetailPanel({ kind: 'name', target: 'n-1', name: 'Moses' });
        const listener = vi.fn();
        const unsubscribe = subscribe(listener);

        closeDetailPanel('name:does-not-exist');

        expect(listener).not.toHaveBeenCalled();
        unsubscribe();
    });

    // The lookup header clears the store when it unmounts (the presenter drops
    // the whole bible-lookup popup on close); nothing may survive to be
    // resurrected the next time it opens.
    test('closing all of them empties the store', () => {
        openDetailPanel({ kind: 'name', target: 'n-1', name: 'Moses' });
        openDetailPanel({ kind: 'verse', target: 'EXO 6:23', name: 'Exodus' });

        closeAllDetailPanels();

        expect(readPanels()).toEqual([]);
    });

    test('closing all of them when already empty notifies nobody', () => {
        const listener = vi.fn();
        const unsubscribe = subscribe(listener);

        closeAllDetailPanels();

        expect(listener).not.toHaveBeenCalled();
        unsubscribe();
    });

    test('an unsubscribed listener stops being notified', () => {
        const listener = vi.fn();
        const unsubscribe = subscribe(listener);
        unsubscribe();

        openDetailPanel({ kind: 'name', target: 'n-1', name: 'Moses' });

        expect(listener).not.toHaveBeenCalled();
    });
});
