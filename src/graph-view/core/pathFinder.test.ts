import { describe, expect, test } from 'vitest';

import type { GraphAdjacencyType } from './pathFinder';
import {
    GRAPH_MAX_PATH_HOP,
    findShortestPath,
    linkAdjacency,
} from './pathFinder';

function genAdjacency(pairList: [string, string][]) {
    const adjacency: GraphAdjacencyType = new Map();
    for (const [aId, bId] of pairList) {
        linkAdjacency(adjacency, aId, bId);
    }
    return adjacency;
}

// n0 - n1 - n2 - n3 - n4, one hop between each neighbour.
function genChain() {
    return genAdjacency([
        ['n0', 'n1'],
        ['n1', 'n2'],
        ['n2', 'n3'],
        ['n3', 'n4'],
    ]);
}

describe('linkAdjacency', () => {
    test('links both ends, appending to sets that already exist', () => {
        const adjacency = genAdjacency([
            ['a', 'b'],
            ['a', 'c'],
            ['c', 'b'],
        ]);
        expect([...(adjacency.get('a') ?? [])]).toEqual(['b', 'c']);
        expect([...(adjacency.get('b') ?? [])]).toEqual(['a', 'c']);
        expect([...(adjacency.get('c') ?? [])]).toEqual(['a', 'b']);
    });

    test('a record linked to itself adds nothing at all', () => {
        const adjacency: GraphAdjacencyType = new Map();
        linkAdjacency(adjacency, 'a', 'a');
        expect(adjacency.size).toBe(0);
        linkAdjacency(adjacency, 'a', 'b');
        linkAdjacency(adjacency, 'a', 'a');
        expect([...(adjacency.get('a') ?? [])]).toEqual(['b']);
    });
});

describe('findShortestPath', () => {
    test('the same record is a one-box path only when it is known', () => {
        const adjacency = genChain();
        expect(findShortestPath(adjacency, 'n2', 'n2')).toEqual(['n2']);
        expect(findShortestPath(adjacency, 'ghost', 'ghost')).toBeNull();
    });

    test('an end the adjacency has never seen has no path', () => {
        const adjacency = genChain();
        expect(findShortestPath(adjacency, 'ghost', 'n1')).toBeNull();
        expect(findShortestPath(adjacency, 'n1', 'ghost')).toBeNull();
    });

    test('takes the shortcut rather than the long way round', () => {
        const adjacency = genChain();
        linkAdjacency(adjacency, 'n0', 'shortcut');
        linkAdjacency(adjacency, 'shortcut', 'n4');
        expect(findShortestPath(adjacency, 'n0', 'n4')).toEqual([
            'n0',
            'shortcut',
            'n4',
        ]);
        // Undirected: the walk works from the other end too.
        expect(findShortestPath(adjacency, 'n4', 'n0')).toEqual([
            'n4',
            'shortcut',
            'n0',
        ]);
    });

    test('two records in separate families have no path', () => {
        const adjacency = genAdjacency([
            ['a', 'b'],
            ['b', 'c'],
            ['x', 'y'],
        ]);
        expect(findShortestPath(adjacency, 'a', 'y')).toBeNull();
    });

    test('walks the whole chain when the cap allows it', () => {
        expect(
            findShortestPath(genChain(), 'n0', 'n4', { maxHopCount: 4 }),
        ).toEqual(['n0', 'n1', 'n2', 'n3', 'n4']);
        expect(findShortestPath(genChain(), 'n0', 'n3')).toEqual([
            'n0',
            'n1',
            'n2',
            'n3',
        ]);
    });

    test('gives up on a path far longer than the hop cap', () => {
        expect(
            findShortestPath(genChain(), 'n0', 'n3', { maxHopCount: 1 }),
        ).toBeNull();
        expect(
            findShortestPath(genChain(), 'n0', 'n4', { maxHopCount: 2 }),
        ).toBeNull();
    });

    // 2026-11-04: the cap was checked only after a level had been walked, so
    // a record found while walking the last level allowed came back one step
    // past the cap -- a 31-step path under "within 30 steps".
    test('the cap is the most steps a path may take, not one more', () => {
        expect(
            findShortestPath(genChain(), 'n0', 'n2', { maxHopCount: 2 }),
        ).toEqual(['n0', 'n1', 'n2']);
        expect(
            findShortestPath(genChain(), 'n0', 'n3', { maxHopCount: 2 }),
        ).toBeNull();
        const pairList: [string, string][] = [];
        for (let index = 0; index < 31; index++) {
            pairList.push([`g${index}`, `g${index + 1}`]);
        }
        const adjacency = genAdjacency(pairList);
        expect(findShortestPath(adjacency, 'g0', 'g30')).toHaveLength(31);
        expect(findShortestPath(adjacency, 'g0', 'g31')).toBeNull();
    });

    test('the default cap is the documented 30 hops', () => {
        expect(GRAPH_MAX_PATH_HOP).toBe(30);
        const pairList: [string, string][] = [];
        for (let index = 0; index < 28; index++) {
            pairList.push([`g${index}`, `g${index + 1}`]);
        }
        // David to Jesus is roughly 28 generations: the default must reach it.
        expect(
            findShortestPath(genAdjacency(pairList), 'g0', 'g28'),
        ).toHaveLength(29);
    });
});
