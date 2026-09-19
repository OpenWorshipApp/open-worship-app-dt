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
