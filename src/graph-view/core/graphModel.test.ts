import { describe, expect, test } from 'vitest';

import { GRAPH_GEOMETRY } from './geometry';
import {
    addNeighbours,
    createGraphView,
    getEdgeBowIndexMap,
    getEdgeKey,
    getPathEdgeKeySet,
    getVisibleGraph,
    moveNode,
    reRootGraph,
    removeNode,
    resetGraphToNode,
    setAllNodesCollapsed,
    relayoutGraph,
    setPath,
    soloRelation,
    toggleRelationHidden,
} from './graphModel';
import type {
    GraphNeighbourType,
    GraphRelationDefType,
    GraphViewType,
} from './types';
import { GRAPH_NODE_LIMIT } from './types';

// A miniature source vocabulary, shaped exactly like the lookup one: parent and
// child are the same line from opposite ends, sibling and spouse are not.
const RELATION_DEF_LIST: GraphRelationDefType[] = [
    {
        kind: 'parent',
        canonicalKind: 'child',
        canonicalFrom: 'target',
        isDirected: true,
        label: 'Parents',
        styleKey: 'parentage',
    },
    {
        kind: 'spouse',
        canonicalKind: 'spouse',
        canonicalFrom: 'origin',
        isDirected: false,
        label: 'Spouses',
        styleKey: 'spouse',
    },
    {
        kind: 'sibling',
        canonicalKind: 'sibling',
        canonicalFrom: 'origin',
        isDirected: false,
        label: 'Siblings',
        styleKey: 'sibling',
    },
    {
        kind: 'child',
        canonicalKind: 'child',
        canonicalFrom: 'origin',
        isDirected: true,
        label: 'Children',
        styleKey: 'parentage',
    },
];

function genGraph() {
    return createGraphView({
        sourceId: 'test',
        root: { kind: 'name', recordId: 'jacob', name: 'Jacob' },
    });
}

function genNeighbour(
    recordId: string,
    relation: string,
    kind = 'name',
): GraphNeighbourType {
    return { kind, recordId, name: recordId, relation };
}

function addTo(
    graph: GraphViewType,
    originKey: string,
    neighbourList: GraphNeighbourType[],
) {
    return addNeighbours(graph, {
        originKey,
        neighbourList,
        relationDefList: RELATION_DEF_LIST,
    });
}

describe('createGraphView', () => {
    test('starts with a single pinned root and no edges', () => {
        const graph = genGraph();
        expect(graph.nodeList).toHaveLength(1);
        expect(graph.nodeList[0].key).toBe('name:jacob');
        expect(graph.nodeList[0].isPinned).toBe(true);
        expect(graph.rootKey).toBe('name:jacob');
        expect(graph.edgeList).toEqual([]);
        expect(graph.zoomPercent).toBe(100);
    });
});

describe('addNeighbours', () => {
    test('places every neighbour and connects it to the origin', () => {
        const { graph, addedCount, isCapped } = addTo(
            genGraph(),
            'name:jacob',
            [
                genNeighbour('isaac', 'parent'),
                genNeighbour('leah', 'spouse'),
                genNeighbour('joseph', 'child'),
            ],
        );
        expect(addedCount).toBe(3);
        expect(isCapped).toBe(false);
        expect(graph.nodeList).toHaveLength(4);
        expect(graph.edgeList).toHaveLength(3);
        expect(
            graph.nodeList.find((node) => {
                return node.key === 'name:jacob';
            })?.isExpanded,
        ).toBe(true);
    });

    test('normalizes a parentage edge to point parent to child', () => {
        // Jacob lists Isaac as a PARENT, so the stored edge must still run
        // Isaac -> Jacob; that is what lets one midpoint label read `son`.
        const { graph } = addTo(genGraph(), 'name:jacob', [
            genNeighbour('isaac', 'parent'),
        ]);
        const edge = graph.edgeList[0];
        expect(edge.fromKey).toBe('name:isaac');
        expect(edge.toKey).toBe('name:jacob');
        expect(edge.relation).toBe('child');
    });

    test('collapses the reciprocal relation into ONE edge', () => {
        // Expand Jacob (Joseph is a child), then Joseph (Jacob is a parent).
        const first = addTo(genGraph(), 'name:jacob', [
            genNeighbour('joseph', 'child'),
        ]);
        const second = addTo(first.graph, 'name:joseph', [
            genNeighbour('jacob', 'parent'),
        ]);
        expect(second.addedCount).toBe(0);
        expect(second.graph.edgeList).toHaveLength(1);
        expect(second.graph.nodeList).toHaveLength(2);
    });

    test('keeps TWO edges for a pair related in two different ways', () => {
        // Abraham and Sarah are half-siblings and spouses; both facts deserve
        // a line, so the canonical kind must not collapse them.
        const graph = createGraphView({
            sourceId: 'test',
            root: { kind: 'name', recordId: 'abraham', name: 'Abraham' },
        });
        const { graph: next } = addTo(graph, 'name:abraham', [
            genNeighbour('sarah', 'spouse'),
            genNeighbour('sarah', 'sibling'),
        ]);
        expect(next.nodeList).toHaveLength(2);
        expect(next.edgeList).toHaveLength(2);
        expect(
            next.edgeList
                .map((edge) => {
                    return edge.relation;
                })
                .sort(),
        ).toEqual(['sibling', 'spouse']);
    });

    test('an already placed neighbour gains an edge but is never moved', () => {
        const first = addTo(genGraph(), 'name:jacob', [
            genNeighbour('esau', 'sibling'),
            genNeighbour('isaac', 'parent'),
        ]);
        const esauBefore = first.graph.nodeList.find((node) => {
            return node.key === 'name:esau';
        });
        // Isaac also lists Esau as a child.
        const second = addTo(first.graph, 'name:isaac', [
            genNeighbour('esau', 'child'),
        ]);
        const esauAfter = second.graph.nodeList.find((node) => {
            return node.key === 'name:esau';
        });
        expect(second.addedCount).toBe(0);
        expect(esauAfter?.x).toBe(esauBefore?.x);
        expect(esauAfter?.y).toBe(esauBefore?.y);
        expect(second.graph.edgeList).toHaveLength(3);
    });

    test('stops at the node limit and reports it', () => {
        const neighbourList = Array.from({ length: 200 }, (_ignore, index) => {
            return genNeighbour(`child-${index}`, 'child');
        });
        const { graph, addedCount, isCapped } = addTo(
            genGraph(),
            'name:jacob',
            neighbourList,
        );
        expect(isCapped).toBe(true);
        expect(graph.nodeList).toHaveLength(GRAPH_NODE_LIMIT);
        expect(addedCount).toBe(GRAPH_NODE_LIMIT - 1);
    });

    test('never overlaps two boxes it places', () => {
        const neighbourList = Array.from({ length: 44 }, (_ignore, index) => {
            return genNeighbour(`kin-${index}`, index % 2 ? 'child' : 'cousin');
        });
        const { graph } = addTo(genGraph(), 'name:jacob', neighbourList);
        const { nodeList } = graph;
        for (let a = 0; a < nodeList.length; a++) {
            for (let b = a + 1; b < nodeList.length; b++) {
                const isOverlapping =
                    Math.abs(nodeList[a].x - nodeList[b].x) <
                        GRAPH_GEOMETRY.NODE_WIDTH &&
                    Math.abs(nodeList[a].y - nodeList[b].y) <
                        GRAPH_GEOMETRY.NODE_HEIGHT;
                expect(isOverlapping).toBe(false);
            }
        }
    });

    test('is deterministic', () => {
        const neighbourList = [
            genNeighbour('isaac', 'parent'),
            genNeighbour('leah', 'spouse'),
            genNeighbour('joseph', 'child'),
        ];
        const first = addTo(genGraph(), 'name:jacob', neighbourList).graph;
        const second = addTo(genGraph(), 'name:jacob', neighbourList).graph;
        expect(first.nodeList).toEqual(second.nodeList);
    });

    test('an unknown origin changes nothing', () => {
        const graph = genGraph();
        const result = addTo(graph, 'name:nobody', [
            genNeighbour('isaac', 'parent'),
        ]);
        expect(result.graph).toBe(graph);
        expect(result.addedCount).toBe(0);
    });
});

describe('moveNode', () => {
    test('pins the node it moves and replaces the array', () => {
        const graph = addTo(genGraph(), 'name:jacob', [
            genNeighbour('isaac', 'parent'),
        ]).graph;
        const next = moveNode(graph, 'name:isaac', 500, 250);
        const moved = next.nodeList.find((node) => {
            return node.key === 'name:isaac';
        });
        expect(moved?.x).toBe(500);
        expect(moved?.y).toBe(250);
        expect(moved?.isPinned).toBe(true);
        // The identity contract useSyncExternalStore relies on.
        expect(next.nodeList).not.toBe(graph.nodeList);
    });

    test('a pinned node survives a later expansion untouched', () => {
        const first = addTo(genGraph(), 'name:jacob', [
            genNeighbour('isaac', 'parent'),
        ]).graph;
        const moved = moveNode(first, 'name:isaac', 900, 900);
        const after = addTo(moved, 'name:jacob', [
            genNeighbour('leah', 'spouse'),
            genNeighbour('joseph', 'child'),
        ]).graph;
        const isaac = after.nodeList.find((node) => {
            return node.key === 'name:isaac';
        });
        expect(isaac?.x).toBe(900);
        expect(isaac?.y).toBe(900);
    });
});

describe('removeNode', () => {
    test('drops the node and every edge touching it', () => {
        const graph = addTo(genGraph(), 'name:jacob', [
            genNeighbour('isaac', 'parent'),
            genNeighbour('leah', 'spouse'),
        ]).graph;
        const next = removeNode(graph, 'name:isaac');
        expect(next.nodeList).toHaveLength(2);
        expect(next.edgeList).toHaveLength(1);
        expect(
            next.edgeList.every((edge) => {
                return (
                    edge.fromKey !== 'name:isaac' && edge.toKey !== 'name:isaac'
                );
            }),
        ).toBe(true);
    });

    test('refuses to remove the root', () => {
        const graph = genGraph();
        expect(removeNode(graph, 'name:jacob')).toBe(graph);
    });

    test('clears the path when a path member is removed', () => {
        const graph = setPath(genGraph(), {
            refList: [
                { kind: 'name', recordId: 'david', name: 'David' },
                { kind: 'name', recordId: 'solomon', name: 'Solomon' },
                { kind: 'name', recordId: 'jesus', name: 'Jesus' },
            ],
            hopList: [
                { relation: 'child', isReversed: false },
                { relation: 'child', isReversed: false },
            ],
            availableWidth: 1200,
        });
        expect(graph.pathNodeKeyList).toHaveLength(3);
        const next = removeNode(graph, 'name:solomon');
        expect(next.pathNodeKeyList).toEqual([]);
    });
});

describe('resetGraphToNode', () => {
    test('keeps one box and drops everything else', () => {
        const graph = addTo(genGraph(), 'name:jacob', [
            genNeighbour('isaac', 'parent'),
            genNeighbour('leah', 'spouse'),
        ]).graph;
        const next = resetGraphToNode(graph, 'name:isaac');
        expect(next.nodeList).toHaveLength(1);
        expect(next.edgeList).toHaveLength(0);
        expect(next.rootKey).toBe('name:isaac');
        expect(next.title).toBe('isaac');
        expect(next.nodeList[0]).toMatchObject({
            x: 0,
            y: 0,
            originKey: null,
            isExpanded: false,
        });
    });

    test('an unknown box changes nothing', () => {
        const graph = genGraph();
        expect(resetGraphToNode(graph, 'name:nobody')).toBe(graph);
    });
});

describe('relayoutGraph', () => {
    test('rebuilds a PATH as a chain rather than as rings', () => {
        const refList = Array.from({ length: 20 }, (_ignore, index) => {
            return {
                kind: 'name',
                recordId: `gen-${index}`,
                name: `Gen ${index}`,
            };
        });
        const graph = setPath(genGraph(), {
            refList,
            hopList: refList.slice(1).map(() => {
                return { relation: 'child', isReversed: false };
            }),
            availableWidth: 1200,
        });
        // Scrambled the way a session of dragging would leave it.
        const scrambled: GraphViewType = {
            ...graph,
            nodeList: graph.nodeList.map((node, index) => {
                return { ...node, x: index % 3, y: index % 2 };
            }),
        };
        const next = relayoutGraph(scrambled, RELATION_DEF_LIST, 1200);
        // Laying a 20-generation chain out radially spirals it back over
        // itself; the chain layout is what keeps it readable.
        const { nodeList } = next;
        for (let a = 0; a < nodeList.length; a++) {
            for (let b = a + 1; b < nodeList.length; b++) {
                const isOverlapping =
                    Math.abs(nodeList[a].x - nodeList[b].x) <
                        GRAPH_GEOMETRY.NODE_WIDTH &&
                    Math.abs(nodeList[a].y - nodeList[b].y) <
                        GRAPH_GEOMETRY.NODE_HEIGHT;
                expect(isOverlapping).toBe(false);
            }
        }
        expect(
            nodeList.every((node) => {
                return node.isPinned;
            }),
        ).toBe(true);
    });

    test('a graph with no path still fans out around its root', () => {
        const graph = addTo(genGraph(), 'name:jacob', [
            genNeighbour('isaac', 'parent'),
            genNeighbour('leah', 'spouse'),
            genNeighbour('joseph', 'child'),
        ]).graph;
        const scrambled: GraphViewType = {
            ...graph,
            nodeList: graph.nodeList.map((node) => {
                return { ...node, x: 5, y: 5 };
            }),
        };
        const next = relayoutGraph(scrambled, RELATION_DEF_LIST);
        const root = next.nodeList.find((node) => {
            return node.key === next.rootKey;
        });
        expect(root).toMatchObject({ x: 0, y: 0, isPinned: true });
        expect(
            next.nodeList.filter((node) => {
                return node.x === 5 && node.y === 5;
            }),
        ).toHaveLength(0);
    });
});

describe('setPath', () => {
    test('re-roots and re-titles on the first box of the chain', () => {
        const graph = addTo(genGraph(), 'name:jacob', [
            genNeighbour('isaac', 'parent'),
        ]).graph;
        const next = setPath(graph, {
            refList: [
                { kind: 'name', recordId: 'david', name: 'David' },
                { kind: 'name', recordId: 'jesus', name: 'Jesus' },
            ],
            hopList: [{ relation: 'child', isReversed: false }],
            availableWidth: 1200,
        });
        // The chain REPLACED the canvas, so the record the graph was opened on
        // is not on it any more: leaving `rootKey` pointing at that box left a
        // graph with no root at all and a panel titled after a record nobody
        // could see.
        expect(next.rootKey).toBe('name:david');
        expect(next.title).toBe('David');
        expect(
            next.nodeList.some((node) => {
                return node.key === next.rootKey;
            }),
        ).toBe(true);
    });

    test('replaces the canvas, pins every hop and records the order', () => {
        const graph = addTo(genGraph(), 'name:jacob', [
            genNeighbour('isaac', 'parent'),
        ]).graph;
        const next = setPath(graph, {
            refList: [
                { kind: 'name', recordId: 'david', name: 'David' },
                { kind: 'name', recordId: 'jesus', name: 'Jesus' },
            ],
            hopList: [{ relation: 'child', isReversed: false }],
            availableWidth: 1200,
        });
        expect(next.nodeList).toHaveLength(2);
        expect(next.edgeList).toHaveLength(1);
        expect(
            next.nodeList.every((node) => {
                return node.isPinned;
            }),
        ).toBe(true);
        expect(next.pathNodeKeyList).toEqual(['name:david', 'name:jesus']);
    });

    test('bypasses the node limit', () => {
        const refList = Array.from({ length: 31 }, (_ignore, index) => {
            return {
                kind: 'name',
                recordId: `hop-${index}`,
                name: `H${index}`,
            };
        });
        const next = setPath(genGraph(), {
            refList,
            hopList: refList.slice(1).map(() => {
                return { relation: 'child', isReversed: false };
            }),
            availableWidth: 900,
        });
        expect(next.nodeList).toHaveLength(31);
    });

    test('getPathEdgeKeySet marks exactly the consecutive hops', () => {
        const graph = setPath(genGraph(), {
            refList: [
                { kind: 'name', recordId: 'a', name: 'A' },
                { kind: 'name', recordId: 'b', name: 'B' },
                { kind: 'name', recordId: 'c', name: 'C' },
            ],
            hopList: [
                { relation: 'child', isReversed: false },
                { relation: 'child', isReversed: false },
            ],
            availableWidth: 1200,
        });
        expect(getPathEdgeKeySet(graph).size).toBe(2);
    });
});

describe('getVisibleGraph', () => {
    test('returns everything when no relation is hidden', () => {
        const graph = addTo(genGraph(), 'name:jacob', [
            genNeighbour('isaac', 'parent'),
        ]).graph;
        const visible = getVisibleGraph(graph);
        expect(visible.nodeList).toBe(graph.nodeList);
        expect(visible.edgeList).toBe(graph.edgeList);
    });

    test('hides a relation and any node only it reached', () => {
        const graph = addTo(genGraph(), 'name:jacob', [
            genNeighbour('isaac', 'parent'),
            genNeighbour('leah', 'spouse'),
        ]).graph;
        const hidden = toggleRelationHidden(graph, 'spouse');
        const visible = getVisibleGraph(hidden);
        expect(
            visible.nodeList.map((node) => {
                return node.key;
            }),
        ).toEqual(['name:jacob', 'name:isaac']);
        // The node is only hidden, never discarded, so unhiding is instant and
        // puts it back exactly where it was.
        expect(hidden.nodeList).toHaveLength(3);
    });

    test('keeps a node another visible relation still reaches', () => {
        const first = addTo(genGraph(), 'name:jacob', [
            genNeighbour('esau', 'sibling'),
        ]).graph;
        const second = addTo(first, 'name:jacob', [
            genNeighbour('esau', 'spouse'),
        ]).graph;
        const visible = getVisibleGraph(
            toggleRelationHidden(second, 'sibling'),
        );
        expect(visible.nodeList).toHaveLength(2);
    });
});

describe('soloRelation', () => {
    test('hides every other relation', () => {
        const graph = genGraph();
        const next = soloRelation(graph, 'child', RELATION_DEF_LIST);
        expect(next.hiddenRelationList.sort()).toEqual([
            'parent',
            'sibling',
            'spouse',
        ]);
    });

    test('the same gesture again restores everything', () => {
        const graph = genGraph();
        const solo = soloRelation(graph, 'child', RELATION_DEF_LIST);
        const restored = soloRelation(solo, 'child', RELATION_DEF_LIST);
        expect(restored.hiddenRelationList).toEqual([]);
    });

    test('soloing a different relation switches rather than restores', () => {
        const graph = genGraph();
        const solo = soloRelation(graph, 'child', RELATION_DEF_LIST);
        const next = soloRelation(solo, 'spouse', RELATION_DEF_LIST);
        expect(next.hiddenRelationList).not.toContain('spouse');
        expect(next.hiddenRelationList).toContain('child');
    });
});

describe('reRootGraph', () => {
    test('moves the chosen node to the origin and keeps relative offsets', () => {
        const graph = addTo(genGraph(), 'name:jacob', [
            genNeighbour('isaac', 'parent'),
        ]).graph;
        const isaacBefore = graph.nodeList.find((node) => {
            return node.key === 'name:isaac';
        });
        const next = reRootGraph(graph, 'name:isaac');
        const isaacAfter = next.nodeList.find((node) => {
            return node.key === 'name:isaac';
        });
        const jacobAfter = next.nodeList.find((node) => {
            return node.key === 'name:jacob';
        });
        expect(next.rootKey).toBe('name:isaac');
        expect(isaacAfter?.x).toBe(0);
        expect(isaacAfter?.y).toBe(0);
        expect(jacobAfter?.x).toBeCloseTo(-(isaacBefore?.x ?? 0));
    });
});

describe('setAllNodesCollapsed', () => {
    test('collapses every box without moving any', () => {
        const graph = addTo(genGraph(), 'name:jacob', [
            genNeighbour('isaac', 'parent'),
        ]).graph;
        const next = setAllNodesCollapsed(graph, true);
        expect(
            next.nodeList.every((node) => {
                return node.isCollapsed;
            }),
        ).toBe(true);
        expect(
            next.nodeList.map((node) => {
                return node.x;
            }),
        ).toEqual(
            graph.nodeList.map((node) => {
                return node.x;
            }),
        );
    });
});

describe('getEdgeKey and getEdgeBowIndexMap', () => {
    test('the same pair yields the same key from either end', () => {
        expect(getEdgeKey('a', 'b', 'child')).toBe(
            getEdgeKey('b', 'a', 'child'),
        );
    });

    test('a lone edge is straight and a doubled pair is bowed apart', () => {
        const graph = createGraphView({
            sourceId: 'test',
            root: { kind: 'name', recordId: 'abraham', name: 'Abraham' },
        });
        const { graph: next } = addTo(graph, 'name:abraham', [
            genNeighbour('sarah', 'spouse'),
            genNeighbour('sarah', 'sibling'),
            genNeighbour('lot', 'sibling'),
        ]);
        const bowMap = getEdgeBowIndexMap(next.edgeList);
        const bowList = next.edgeList
            .filter((edge) => {
                return (
                    edge.toKey === 'name:sarah' || edge.fromKey === 'name:sarah'
                );
            })
            .map((edge) => {
                return bowMap.get(edge.key) ?? 0;
            });
        expect(bowList).toHaveLength(2);
        expect(bowList[0]).not.toBe(bowList[1]);
        const lotEdge = next.edgeList.find((edge) => {
            return edge.toKey === 'name:lot' || edge.fromKey === 'name:lot';
        });
        expect(bowMap.get(lotEdge?.key ?? '')).toBe(0);
    });
});
