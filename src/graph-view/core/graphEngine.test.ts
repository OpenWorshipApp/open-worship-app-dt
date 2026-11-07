import { describe, expect, test } from 'vitest';

import { createGraphEngine } from './graphEngine';
import type { GraphRelationDefType } from './types';

const RELATION_DEF_LIST: GraphRelationDefType[] = [
    {
        kind: 'child',
        canonicalKind: 'child',
        canonicalFrom: 'origin',
        isDirected: true,
        label: 'Children',
        styleKey: 'parentage',
    },
];

// The engine's clock is injected precisely so coalescing can be tested without
// waiting in real time.
function createTestEngine() {
    let now = 0;
    const engine = createGraphEngine(() => {
        return now;
    });
    const graphKey = engine.open({
        sourceId: 'test',
        root: { kind: 'name', recordId: 'root', name: 'Root' },
    });
    const getGraph = () => {
        const found = engine.getSnapshot().find((graph) => {
            return graph.key === graphKey;
        });
        if (found === undefined) {
            throw new Error('graph went missing');
        }
        return found;
    };
    return {
        engine,
        graphKey,
        getGraph,
        advance(ms: number) {
            now += ms;
        },
    };
}

describe('graph history', () => {
    test('resolving the root title preserves the graph and its edit history', () => {
        const { engine, graphKey, getGraph } = createTestEngine();
        const rootKey = getGraph().rootKey;
        const initial = getGraph();
        engine.setResolvedTitle(graphKey, rootKey, '✝ root');
        expect(getGraph()).toEqual({ ...initial, title: '✝ root' });
        expect(getGraph().nodeList).toBe(initial.nodeList);
        expect(getGraph().edgeList).toBe(initial.edgeList);
        expect(engine.canUndo(graphKey)).toBe(false);

        engine.moveNode(graphKey, rootKey, 120, 60);
        engine.undo(graphKey);
        engine.setResolvedTitle(graphKey, rootKey, 'Root');
        expect(engine.canUndo(graphKey)).toBe(false);
        expect(engine.canRedo(graphKey)).toBe(true);
        expect(engine.redo(graphKey)).toBe(true);
        expect(getGraph().nodeList[0].x).toBe(120);
        // A restored snapshot can carry old wording; resolving it again must
        // leave the actual edit as the next undo step.
        engine.setResolvedTitle(graphKey, rootKey, 'Root');
        expect(engine.undo(graphKey)).toBe(true);
        expect(getGraph().nodeList[0].x).toBe(0);
        expect(engine.canUndo(graphKey)).toBe(false);
    });

    test('title resolution ignores stale roots and leaves other graphs alone', () => {
        const { engine, graphKey, getGraph } = createTestEngine();
        const secondKey = engine.open({
            sourceId: 'test',
            root: { kind: 'name', recordId: 'second', name: 'Second' },
        });
        const initial = engine.getSnapshot();
        let notifications = 0;
        engine.subscribe(() => {
            notifications++;
        });
        engine.setResolvedTitle(graphKey, 'stale-root', 'Wrong root');
        engine.setResolvedTitle('closed-graph', getGraph().rootKey, 'Closed');
        engine.setResolvedTitle(graphKey, getGraph().rootKey, 'Root');
        expect(engine.getSnapshot()).toBe(initial);
        expect(notifications).toBe(0);

        engine.setResolvedTitle(graphKey, getGraph().rootKey, 'Translated');
        expect(getGraph().title).toBe('Translated');
        expect(notifications).toBe(1);
        expect(
            engine.getSnapshot().find((graph) => graph.key === secondKey),
        ).toBe(initial.find((graph) => graph.key === secondKey));
    });

    test('a fresh graph has nothing to undo or redo', () => {
        const { engine, graphKey } = createTestEngine();
        expect(engine.canUndo(graphKey)).toBe(false);
        expect(engine.canRedo(graphKey)).toBe(false);
        expect(engine.undo(graphKey)).toBe(false);
        expect(engine.redo(graphKey)).toBe(false);
    });

    test('a box move steps back and forward again', () => {
        const { engine, graphKey, getGraph } = createTestEngine();
        const rootKey = getGraph().rootKey;
        engine.moveNode(graphKey, rootKey, 120, 60);
        expect(getGraph().nodeList[0].x).toBe(120);
        expect(engine.canUndo(graphKey)).toBe(true);

        expect(engine.undo(graphKey)).toBe(true);
        expect(getGraph().nodeList[0].x).toBe(0);
        expect(engine.canUndo(graphKey)).toBe(false);
        expect(engine.canRedo(graphKey)).toBe(true);

        expect(engine.redo(graphKey)).toBe(true);
        expect(getGraph().nodeList[0].x).toBe(120);
        expect(engine.canRedo(graphKey)).toBe(false);
    });

    test('an expansion and everything it added come back in one step', () => {
        const { engine, graphKey, getGraph } = createTestEngine();
        engine.addNeighbours(graphKey, {
            originKey: getGraph().rootKey,
            neighbourList: [
                {
                    kind: 'name',
                    recordId: 'a',
                    name: 'A',
                    relation: 'child',
                },
                {
                    kind: 'name',
                    recordId: 'b',
                    name: 'B',
                    relation: 'child',
                },
            ],
            relationDefList: RELATION_DEF_LIST,
        });
        expect(getGraph().nodeList).toHaveLength(3);
        engine.undo(graphKey);
        expect(getGraph().nodeList).toHaveLength(1);
        engine.redo(graphKey);
        expect(getGraph().nodeList).toHaveLength(3);
    });

    test('one wheel gesture is ONE step, however many ticks it fires', () => {
        const { engine, graphKey, getGraph, advance } = createTestEngine();
        for (const zoomPercent of [105, 110, 115, 120]) {
            advance(30);
            engine.setViewport(graphKey, { zoomPercent });
        }
        expect(getGraph().zoomPercent).toBe(120);

        engine.undo(graphKey);
        // All the way back to where the gesture started, not one tick back.
        expect(getGraph().zoomPercent).toBe(100);
        expect(engine.canUndo(graphKey)).toBe(false);
    });

    test('a pause ends the gesture, so the next zoom is its own step', () => {
        const { engine, graphKey, getGraph, advance } = createTestEngine();
        engine.setViewport(graphKey, { zoomPercent: 120 });
        advance(5000);
        engine.setViewport(graphKey, { zoomPercent: 140 });

        engine.undo(graphKey);
        expect(getGraph().zoomPercent).toBe(120);
        engine.undo(graphKey);
        expect(getGraph().zoomPercent).toBe(100);
    });

    test('a viewport move the app makes is not a step at all', () => {
        const { engine, graphKey, getGraph } = createTestEngine();
        engine.setViewport(graphKey, { panX: 40, panY: 20 }, false);
        expect(getGraph().panX).toBe(40);
        expect(engine.canUndo(graphKey)).toBe(false);
    });

    test('acting after an undo drops the redo it can no longer reach', () => {
        const { engine, graphKey, getGraph } = createTestEngine();
        const rootKey = getGraph().rootKey;
        engine.moveNode(graphKey, rootKey, 10, 10);
        engine.undo(graphKey);
        expect(engine.canRedo(graphKey)).toBe(true);

        engine.moveNode(graphKey, rootKey, 50, 50);
        expect(engine.canRedo(graphKey)).toBe(false);
        expect(getGraph().nodeList[0].x).toBe(50);
    });

    test('typing a path endpoint is not an undoable move', () => {
        const { engine, graphKey } = createTestEngine();
        engine.setPathEndpoints(graphKey, { pathFromId: 'root' });
        engine.setPathBarOpen(graphKey, true);
        expect(engine.canUndo(graphKey)).toBe(false);
    });

    test('the history is bounded and drops its OLDEST step', () => {
        const { engine, graphKey, getGraph } = createTestEngine();
        const rootKey = getGraph().rootKey;
        for (let index = 1; index <= 40; index++) {
            engine.moveNode(graphKey, rootKey, index, index);
        }
        let steps = 0;
        while (engine.undo(graphKey)) {
            steps += 1;
        }
        expect(steps).toBe(30);
        // The earliest positions are gone, so undoing all the way lands on the
        // oldest step still held rather than back at the origin.
        expect(getGraph().nodeList[0].x).toBe(10);
    });

    test('closing a graph takes its history with it', () => {
        const { engine, graphKey, getGraph } = createTestEngine();
        engine.moveNode(graphKey, getGraph().rootKey, 10, 10);
        expect(engine.canUndo(graphKey)).toBe(true);
        engine.close(graphKey);
        expect(engine.canUndo(graphKey)).toBe(false);
    });

    test('restoring keeps the history of graphs that survive it', () => {
        const { engine, graphKey, getGraph } = createTestEngine();
        engine.moveNode(graphKey, getGraph().rootKey, 10, 10);
        engine.restore([...engine.getSnapshot()]);
        expect(engine.canUndo(graphKey)).toBe(true);
        engine.restore([]);
        expect(engine.canUndo(graphKey)).toBe(false);
    });
});

describe('graph engine operations', () => {
    function genChild(recordId: string) {
        return {
            kind: 'name',
            recordId,
            name: recordId.toUpperCase(),
            relation: 'child',
        };
    }

    function genExpandedEngine() {
        const testEngine = createTestEngine();
        testEngine.engine.addNeighbours(testEngine.graphKey, {
            originKey: testEngine.getGraph().rootKey,
            neighbourList: [genChild('a'), genChild('b')],
            relationDefList: RELATION_DEF_LIST,
        });
        return testEngine;
    }

    test('opening an open graph raises it instead of adding a second', () => {
        const { engine, graphKey, getGraph } = createTestEngine();
        engine.moveNode(graphKey, getGraph().rootKey, 30, 40);
        let notifications = 0;
        engine.subscribe(() => {
            notifications++;
        });
        const againKey = engine.open({
            sourceId: 'test',
            root: { kind: 'name', recordId: 'root', name: 'Root' },
        });
        expect(againKey).toBe(graphKey);
        expect(engine.getSnapshot()).toHaveLength(1);
        expect(getGraph().raiseCount).toBe(1);
        // Re-opening keeps what the user had explored.
        expect(getGraph().nodeList[0].x).toBe(30);
        expect(notifications).toBe(1);
    });

    test('closing a graph that is not open changes and notifies nothing', () => {
        const { engine } = createTestEngine();
        const before = engine.getSnapshot();
        let notifications = 0;
        engine.subscribe(() => {
            notifications++;
        });
        engine.close('test:name:nobody');
        expect(engine.getSnapshot()).toBe(before);
        expect(notifications).toBe(0);
    });

    test('expanding inside a graph that is not open answers null', () => {
        const { engine } = createTestEngine();
        expect(
            engine.addNeighbours('test:name:nobody', {
                originKey: 'name:root',
                neighbourList: [genChild('a')],
                relationDefList: RELATION_DEF_LIST,
            }),
        ).toBeNull();
    });

    test('collapsing every box is one undoable step', () => {
        const { engine, graphKey, getGraph } = genExpandedEngine();
        engine.setAllNodesCollapsed(graphKey, true);
        expect(
            getGraph().nodeList.map((node) => {
                return node.isCollapsed;
            }),
        ).toEqual([true, true, true]);
        expect(engine.undo(graphKey)).toBe(true);
        expect(
            getGraph().nodeList.some((node) => {
                return node.isCollapsed;
            }),
        ).toBe(false);
    });

    test('hiding a relation and soloing another', () => {
        const { engine, graphKey, getGraph } = genExpandedEngine();
        engine.toggleRelationHidden(graphKey, 'child');
        expect(getGraph().hiddenRelationList).toEqual(['child']);
        engine.toggleRelationHidden(graphKey, 'child');
        expect(getGraph().hiddenRelationList).toEqual([]);
        const definitionList = [
            ...RELATION_DEF_LIST,
            { ...RELATION_DEF_LIST[0], kind: 'spouse', label: 'Spouses' },
        ];
        engine.soloRelation(graphKey, 'child', definitionList);
        expect(getGraph().hiddenRelationList).toEqual(['spouse']);
        // Soloing what is already solo shows everything again.
        engine.soloRelation(graphKey, 'child', definitionList);
        expect(getGraph().hiddenRelationList).toEqual([]);
    });

    test('re-rooting without a vocabulary moves the box to the origin only', () => {
        const { engine, graphKey, getGraph } = genExpandedEngine();
        const child = getGraph().nodeList[1];
        const offsetX = getGraph().nodeList[0].x - child.x;
        engine.reRoot(graphKey, child.key);
        const graph = getGraph();
        expect(graph.rootKey).toBe(child.key);
        expect(graph.title).toBe(child.name);
        expect(graph.nodeList[1]).toMatchObject({ x: 0, y: 0 });
        // Not re-fanned: the old root sits exactly where it was, relatively.
        expect(graph.nodeList[0].x).toBeCloseTo(offsetX);
        expect(engine.undo(graphKey)).toBe(true);
        expect(getGraph().rootKey).toBe('name:root');
    });

    test('re-rooting at a box that is not there is no step at all', () => {
        const { engine, graphKey } = genExpandedEngine();
        const before = engine.getSnapshot();
        engine.reRoot(graphKey, 'name:ghost', RELATION_DEF_LIST);
        expect(engine.getSnapshot()).toBe(before);
    });

    test('a path replaces the canvas and clearing it is undoable', () => {
        const { engine, graphKey, getGraph } = genExpandedEngine();
        engine.setPath(graphKey, {
            refList: [
                { kind: 'name', recordId: 'x', name: 'X' },
                { kind: 'name', recordId: 'y', name: 'Y' },
            ],
            hopList: [{ relation: 'child', isReversed: false }],
            availableWidth: 1000,
        });
        expect(getGraph().pathNodeKeyList).toEqual(['name:x', 'name:y']);
        expect(getGraph().rootKey).toBe('name:x');
        engine.clearPath(graphKey);
        expect(getGraph().pathNodeKeyList).toEqual([]);
        // Clearing an already-empty path is not another step.
        let notifications = 0;
        engine.subscribe(() => {
            notifications++;
        });
        engine.clearPath(graphKey);
        expect(notifications).toBe(0);
        expect(engine.undo(graphKey)).toBe(true);
        expect(getGraph().pathNodeKeyList).toEqual(['name:x', 'name:y']);
    });
});
