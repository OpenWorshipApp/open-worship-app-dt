import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        showAppContextMenu: vi.fn(),
    };
});

vi.mock('../context-menu/appContextMenuHelpers', () => {
    return {
        showAppContextMenu: h.showAppContextMenu,
    };
});

vi.mock('../context-menu/contextMenuIconHelpers', () => {
    return {
        genContextMenuItemIcon: (name: string) => {
            return `icon:${name}`;
        },
    };
});

vi.mock('../lang/langHelpers', () => {
    return {
        tran: (key: string) => {
            return `t(${key})`;
        },
    };
});

import { GRAPH_ZOOM_RANGE } from './core';
import {
    GRAPH_FIT_MAX_ZOOM_PERCENT,
    fitGraphOnScreen,
    getGraphFitArea,
} from './graphFitHelpers';
import {
    GRAPH_PREVIEW_ICON_CLASS,
    genGraphPreviewContextMenuItems,
    showGraphPreviewContextMenu,
} from './graphContextMenuHelpers';
import {
    closeGraphPreview,
    getGraphEngine,
    openGraphPreview,
} from './graphViewStore';
import { LOOKUP_GRAPH_SOURCE_ID, LOOKUP_NODE_KIND } from './lookupGraphIds';

const RELATION_DEF_LIST = [
    {
        kind: 'child',
        canonicalKind: 'child',
        canonicalFrom: 'origin' as const,
        isDirected: true,
        label: 'Children',
        styleKey: 'parentage',
    },
];

// What a fit reads off the viewport: its client box and the floating dock.
function genViewport(
    width: number,
    height: number,
    dockHeight: number | null = null,
) {
    return {
        clientWidth: width,
        clientHeight: height,
        querySelector: (selector: string) => {
            if (selector !== '.graph-view__dock' || dockHeight === null) {
                return null;
            }
            return { offsetHeight: dockHeight };
        },
    } as any as HTMLElement;
}

function findGraph(graphKey: string) {
    return (
        getGraphEngine()
            .getSnapshot()
            .find((graph) => {
                return graph.key === graphKey;
            }) ?? null
    );
}

function openAbraham() {
    return openGraphPreview(LOOKUP_GRAPH_SOURCE_ID, {
        kind: LOOKUP_NODE_KIND.NAME,
        recordId: 'abraham',
        name: 'Abraham',
    });
}

beforeEach(() => {
    getGraphEngine().closeAll();
});

afterEach(() => {
    getGraphEngine().closeAll();
});

describe('lookup graph ids', () => {
    test('name the lookup source and its two node kinds', () => {
        expect(LOOKUP_GRAPH_SOURCE_ID).toBe('location-name');
        expect(LOOKUP_NODE_KIND).toEqual({
            NAME: 'name',
            LOCATION: 'location',
        });
    });
});

describe('graph view store', () => {
    test('opens a graph once per record and closes it by key', () => {
        const graphKey = openAbraham();
        expect(graphKey).toBe('location-name:name:abraham');
        expect(findGraph(graphKey)).toMatchObject({
            title: 'Abraham',
            raiseCount: 0,
        });
        // A second open raises the same panel rather than adding one.
        expect(openAbraham()).toBe(graphKey);
        expect(getGraphEngine().getSnapshot()).toHaveLength(1);
        expect(findGraph(graphKey)?.raiseCount).toBe(1);
        closeGraphPreview(graphKey);
        expect(findGraph(graphKey)).toBeNull();
    });
});

describe('getGraphFitArea', () => {
    test('uses the whole viewport when there is no dock', () => {
        expect(getGraphFitArea(genViewport(640, 480))).toEqual({
            width: 640,
            height: 480,
        });
    });

    test('leaves the dock and its gap out of the height', () => {
        expect(getGraphFitArea(genViewport(640, 480, 40))).toEqual({
            width: 640,
            height: 480 - 40 - 8,
        });
    });

    test('never answers a height below one pixel', () => {
        expect(getGraphFitArea(genViewport(640, 30, 40)).height).toBe(1);
    });
});

describe('fitGraphOnScreen', () => {
    test('caps the fit at 100% so a lone box is not blown up', () => {
        expect(GRAPH_FIT_MAX_ZOOM_PERCENT).toBe(100);
        const graphKey = openAbraham();
        fitGraphOnScreen(graphKey, genViewport(800, 600));
        expect(findGraph(graphKey)).toMatchObject({
            panX: 400,
            panY: 300,
            zoomPercent: 100,
        });
        // A fit the user asked for is an undo step.
        expect(getGraphEngine().canUndo(graphKey)).toBe(true);
    });

    test('a fit the app makes itself is not an undo step', () => {
        const graphKey = openAbraham();
        fitGraphOnScreen(graphKey, genViewport(800, 648, 40), undefined, false);
        // The dock takes 48 of the 648: centred in the 600 left over.
        expect(findGraph(graphKey)).toMatchObject({ panX: 400, panY: 300 });
        expect(getGraphEngine().canUndo(graphKey)).toBe(false);
    });

    test('fits the node list it is handed rather than the stored graph', () => {
        const graphKey = openAbraham();
        fitGraphOnScreen(graphKey, genViewport(800, 600), [
            { x: 0, y: 0 },
            { x: 2000, y: 1000 },
        ]);
        const graph = findGraph(graphKey);
        expect(graph?.zoomPercent).toBe(35);
        expect(graph?.panX).toBeCloseTo(800 / 0.35 / 2 - 1000);
        expect(graph?.panY).toBeCloseTo(600 / 0.35 / 2 - 500);
    });

    test('fits only the boxes a relation filter leaves visible', () => {
        const graphKey = openAbraham();
        const engine = getGraphEngine();
        engine.addNeighbours(graphKey, {
            originKey: 'name:abraham',
            neighbourList: ['isaac', 'ishmael', 'midian'].map((recordId) => {
                return {
                    kind: 'name',
                    recordId,
                    name: recordId,
                    relation: 'child',
                };
            }),
            relationDefList: RELATION_DEF_LIST,
        });
        fitGraphOnScreen(graphKey, genViewport(400, 300));
        const withChildren = findGraph(graphKey);
        // Three children on a ring do not fit a 400 x 300 panel at 100%.
        expect(withChildren?.zoomPercent).toBeLessThan(100);
        expect(withChildren?.zoomPercent).toBeGreaterThanOrEqual(
            GRAPH_ZOOM_RANGE.min,
        );
        engine.toggleRelationHidden(graphKey, 'child');
        fitGraphOnScreen(graphKey, genViewport(400, 300));
        // Only the root is visible now: back to 100%, centred on it.
        expect(findGraph(graphKey)).toMatchObject({
            panX: 200,
            panY: 150,
            zoomPercent: 100,
        });
    });

    test('does nothing without a viewport, a graph or any box', () => {
        const graphKey = openAbraham();
        const before = getGraphEngine().getSnapshot();
        fitGraphOnScreen(graphKey, null);
        fitGraphOnScreen('location-name:name:nobody', genViewport(800, 600));
        fitGraphOnScreen(graphKey, genViewport(800, 600), []);
        expect(getGraphEngine().getSnapshot()).toBe(before);
    });
});

describe('graph preview context menu', () => {
    test('a verse yields no item, and no menu is shown for it', () => {
        expect(
            genGraphPreviewContextMenuItems({
                kind: 'verse',
                recordId: 'GEN 1:1',
                name: 'Genesis 1:1',
            }),
        ).toEqual([]);
        showGraphPreviewContextMenu({} as MouseEvent, {
            kind: 'verse',
            recordId: 'GEN 1:1',
            name: 'Genesis 1:1',
        });
        expect(h.showAppContextMenu).not.toHaveBeenCalled();
    });

    test('a record yields one translated item that opens its graph', () => {
        expect(GRAPH_PREVIEW_ICON_CLASS).toBe('bi bi-diagram-3');
        const itemList = genGraphPreviewContextMenuItems({
            kind: 'location',
            recordId: 'bethel',
            name: 'Bethel',
        });
        expect(itemList).toHaveLength(1);
        expect(itemList[0]).toMatchObject({
            id: 'open-graph-preview',
            menuElement: 't(Open Graph Preview)',
            childBefore: 'icon:diagram-3',
        });
        (itemList[0] as any).onSelect();
        expect(findGraph('location-name:location:bethel')).toMatchObject({
            title: 'Bethel',
            rootKey: 'location:bethel',
        });
    });

    test('a right-click on a record shows the menu on that event', () => {
        const event = { type: 'contextmenu' } as any as MouseEvent;
        showGraphPreviewContextMenu(event, {
            kind: 'name',
            recordId: 'sarah',
            name: 'Sarah',
        });
        expect(h.showAppContextMenu).toHaveBeenCalledTimes(1);
        const [calledEvent, itemList] = h.showAppContextMenu.mock.calls[0];
        expect(calledEvent).toBe(event);
        expect(itemList).toHaveLength(1);
        expect(itemList[0].id).toBe('open-graph-preview');
    });
});
