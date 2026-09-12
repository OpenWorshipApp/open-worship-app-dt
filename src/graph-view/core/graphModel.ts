import type { GraphPointType } from './geometry';
import {
    GRAPH_GEOMETRY,
    layoutPathChain,
    layoutRadialNeighbours,
} from './geometry';
import type {
    GraphEdgeType,
    GraphNeighbourType,
    GraphNodeRefType,
    GraphNodeType,
    GraphPathHopType,
    GraphRelationDefType,
    GraphRelationKindType,
    GraphViewType,
} from './types';
import { GRAPH_NODE_LIMIT, toGraphNodeKey } from './types';

/**
 * Pure transformations over a graph. Every function returns a NEW graph and
 * never touches its input, which is what lets a `useSyncExternalStore` binding
 * compare snapshots by identity.
 */

export type RelationDefMapType = {
    [kind: string]: GraphRelationDefType;
};

export function toRelationDefMap(
    relationDefList: readonly GraphRelationDefType[],
): RelationDefMapType {
    const result: RelationDefMapType = {};
    for (const definition of relationDefList) {
        result[definition.kind] = definition;
    }
    return result;
}

/**
 * Canonical edge identity: the unordered pair plus the canonical relation.
 *
 * Sorting the two keys is what makes the same edge found from either end
 * produce the same identity.
 */
export function getEdgeKey(
    aKey: string,
    bKey: string,
    canonicalKind: GraphRelationKindType,
) {
    const [first, second] = aKey < bKey ? [aKey, bKey] : [bKey, aKey];
    return `${first}|${second}|${canonicalKind}`;
}

export function findGraphNode(
    graph: Readonly<GraphViewType>,
    nodeKey: string,
): GraphNodeType | null {
    return (
        graph.nodeList.find((node) => {
            return node.key === nodeKey;
        }) ?? null
    );
}

export function createGraphView({
    sourceId,
    root,
}: {
    sourceId: string;
    root: Readonly<GraphNodeRefType>;
}): GraphViewType {
    const rootKey = toGraphNodeKey(root.kind, root.recordId);
    return {
        key: `${sourceId}:${rootKey}`,
        sourceId,
        rootKey,
        title: root.name,
        nodeList: [
            {
                key: rootKey,
                kind: root.kind,
                recordId: root.recordId,
                name: root.name,
                x: 0,
                y: 0,
                // The root is where the user started; nothing should move it.
                isPinned: true,
                isCollapsed: false,
                originKey: null,
                isExpanded: false,
            },
        ],
        edgeList: [],
        panX: 0,
        panY: 0,
        zoomPercent: 100,
        hiddenRelationList: [],
        pathNodeKeyList: [],
        pathFromId: null,
        pathToId: null,
        isPathBarOpen: false,
        raiseCount: 0,
    };
}

/**
 * The direction the given node was reached from, in radians, or null when it
 * has no origin left to face away from.
 */
function getIncomingAngle(
    graph: Readonly<GraphViewType>,
    node: Readonly<GraphNodeType>,
) {
    if (node.originKey === null) {
        return null;
    }
    const origin = findGraphNode(graph, node.originKey);
    if (origin === null) {
        return null;
    }
    const deltaX = node.x - origin.x;
    const deltaY = node.y - origin.y;
    if (deltaX === 0 && deltaY === 0) {
        return null;
    }
    return Math.atan2(deltaY, deltaX);
}

export type AddNeighboursResultType = {
    graph: GraphViewType;
    addedCount: number;
    isCapped: boolean;
};

/**
 * Materializes a node's neighbours as boxes ringed around it, and connects
 * them.
 *
 * A neighbour already on the canvas gets an EDGE ONLY — it is never moved and
 * never duplicated, so following a relation back to somewhere you have already
 * been draws the connection instead of scattering a second copy.
 */
export function addNeighbours(
    graph: Readonly<GraphViewType>,
    {
        originKey,
        neighbourList,
        relationDefList,
    }: {
        originKey: string;
        neighbourList: readonly GraphNeighbourType[];
        relationDefList: readonly GraphRelationDefType[];
    },
): AddNeighboursResultType {
    const origin = findGraphNode(graph, originKey);
    if (origin === null) {
        return {
            graph: graph as GraphViewType,
            addedCount: 0,
            isCapped: false,
        };
    }
    const relationDefMap = toRelationDefMap(relationDefList);
    const relationOrder = relationDefList.map((definition) => {
        return definition.kind;
    });

    const existingKeySet = new Set(
        graph.nodeList.map((node) => {
            return node.key;
        }),
    );
    // Neighbours that need a box, in the source's own order.
    const pendingList: GraphNeighbourType[] = [];
    const seenPendingKeySet = new Set<string>();
    for (const neighbour of neighbourList) {
        const key = toGraphNodeKey(neighbour.kind, neighbour.recordId);
        if (existingKeySet.has(key) || seenPendingKeySet.has(key)) {
            continue;
        }
        seenPendingKeySet.add(key);
        pendingList.push(neighbour);
    }

    const room = Math.max(0, GRAPH_NODE_LIMIT - graph.nodeList.length);
    const isCapped = pendingList.length > room;
    const acceptedList = pendingList.slice(0, room);

    const groupCountMap = new Map<GraphRelationKindType, number>();
    for (const neighbour of acceptedList) {
        groupCountMap.set(
            neighbour.relation,
            (groupCountMap.get(neighbour.relation) ?? 0) + 1,
        );
    }
    const placementList = layoutRadialNeighbours({
        origin: { x: origin.x, y: origin.y },
        incomingAngle: getIncomingAngle(graph, origin),
        groupList: Array.from(groupCountMap.entries()).map(
            ([relation, count]) => {
                return { relation, count };
            },
        ),
        occupiedList: graph.nodeList.map((node) => {
            return { x: node.x, y: node.y };
        }),
        relationOrder,
    });

    // Placements come back grouped in `relationOrder`; hand them out in that
    // same order so a neighbour lands in its own relation's arc.
    const placementByRelation = new Map<
        GraphRelationKindType,
        GraphPointType[]
    >();
    for (const placement of placementList) {
        const list = placementByRelation.get(placement.relation) ?? [];
        list.push({ x: placement.x, y: placement.y });
        placementByRelation.set(placement.relation, list);
    }

    const addedNodeList: GraphNodeType[] = [];
    for (const neighbour of acceptedList) {
        const point = placementByRelation.get(neighbour.relation)?.shift();
        if (point === undefined) {
            continue;
        }
        addedNodeList.push({
            key: toGraphNodeKey(neighbour.kind, neighbour.recordId),
            kind: neighbour.kind,
            recordId: neighbour.recordId,
            name: neighbour.name,
            x: point.x,
            y: point.y,
            isPinned: false,
            isCollapsed: false,
            originKey,
            isExpanded: false,
        });
    }

    const nodeList = [...graph.nodeList, ...addedNodeList];
    const liveKeySet = new Set(
        nodeList.map((node) => {
            return node.key;
        }),
    );
    // Every neighbour that IS on the canvas now gets its edge, including the
    // ones that were already there before this call.
    const edgeList = [...graph.edgeList];
    const edgeKeySet = new Set(
        edgeList.map((edge) => {
            return edge.key;
        }),
    );
    for (const neighbour of neighbourList) {
        const targetKey = toGraphNodeKey(neighbour.kind, neighbour.recordId);
        if (!liveKeySet.has(targetKey) || targetKey === originKey) {
            continue;
        }
        const definition = relationDefMap[neighbour.relation];
        if (definition === undefined) {
            continue;
        }
        const key = getEdgeKey(originKey, targetKey, definition.canonicalKind);
        if (edgeKeySet.has(key)) {
            continue;
        }
        edgeKeySet.add(key);
        // Normalize to the canonical direction so one midpoint label reads
        // correctly whichever end the user expanded from.
        const isOriginFirst = definition.canonicalFrom === 'origin';
        edgeList.push({
            key,
            fromKey: isOriginFirst ? originKey : targetKey,
            toKey: isOriginFirst ? targetKey : originKey,
            relation: definition.canonicalKind,
        });
    }

    return {
        graph: {
            ...graph,
            nodeList: nodeList.map((node) => {
                return node.key === originKey
                    ? { ...node, isExpanded: true }
                    : node;
            }),
            edgeList,
        },
        addedCount: addedNodeList.length,
        isCapped,
    };
}

export function moveNode(
    graph: Readonly<GraphViewType>,
    nodeKey: string,
    x: number,
    y: number,
): GraphViewType {
    return {
        ...graph,
        nodeList: graph.nodeList.map((node) => {
            // Dragging is what pins a node: from here on the layout leaves it
            // exactly where the user put it.
            return node.key === nodeKey
                ? { ...node, x, y, isPinned: true }
                : node;
        }),
    };
}

export function setNodeCollapsed(
    graph: Readonly<GraphViewType>,
    nodeKey: string,
    isCollapsed: boolean,
): GraphViewType {
    return {
        ...graph,
        nodeList: graph.nodeList.map((node) => {
            return node.key === nodeKey ? { ...node, isCollapsed } : node;
        }),
    };
}

export function setAllNodesCollapsed(
    graph: Readonly<GraphViewType>,
    isCollapsed: boolean,
): GraphViewType {
    return {
        ...graph,
        nodeList: graph.nodeList.map((node) => {
            return { ...node, isCollapsed };
        }),
    };
}

/**
 * Drops a node and every edge touching it.
 *
 * The root is refused: removing it would leave a graph with no subject, and
 * the panel is identified by that root.
 */
export function removeNode(
    graph: Readonly<GraphViewType>,
    nodeKey: string,
): GraphViewType {
    if (nodeKey === graph.rootKey) {
        return graph as GraphViewType;
    }
    const nodeList = graph.nodeList.filter((node) => {
        return node.key !== nodeKey;
    });
    if (nodeList.length === graph.nodeList.length) {
        return graph as GraphViewType;
    }
    return {
        ...graph,
        nodeList: nodeList.map((node) => {
            // Orphaned children lose their aiming hint rather than pointing at
            // a node that is gone.
            return node.originKey === nodeKey
                ? { ...node, originKey: null }
                : node;
        }),
        edgeList: graph.edgeList.filter((edge) => {
            return edge.fromKey !== nodeKey && edge.toKey !== nodeKey;
        }),
        // A chain with a link removed is not a path any more.
        pathNodeKeyList: graph.pathNodeKeyList.includes(nodeKey)
            ? []
            : graph.pathNodeKeyList,
    };
}

/**
 * Shows ONE relation and hides the rest — and restores everything when the
 * relation is already the only one showing, so the same gesture undoes itself.
 *
 * Reaching this by clicking off seven chips one at a time is the tedious path
 * the solo gesture exists to replace.
 */
export function soloRelation(
    graph: Readonly<GraphViewType>,
    relation: GraphRelationKindType,
    relationDefList: readonly GraphRelationDefType[],
): GraphViewType {
    const otherKindList = relationDefList
        .map((definition) => {
            return definition.kind;
        })
        .filter((kind) => {
            return kind !== relation;
        });
    const isAlreadySolo =
        graph.hiddenRelationList.length === otherKindList.length &&
        otherKindList.every((kind) => {
            return graph.hiddenRelationList.includes(kind);
        });
    return {
        ...graph,
        hiddenRelationList: isAlreadySolo ? [] : otherKindList,
    };
}

export function toggleRelationHidden(
    graph: Readonly<GraphViewType>,
    relation: GraphRelationKindType,
): GraphViewType {
    const isHidden = graph.hiddenRelationList.includes(relation);
    return {
        ...graph,
        hiddenRelationList: isHidden
            ? graph.hiddenRelationList.filter((item) => {
                  return item !== relation;
              })
            : [...graph.hiddenRelationList, relation],
    };
}

/**
 * Replaces the whole canvas with a found path, laid out end to end.
 *
 * Deliberately bypasses `GRAPH_NODE_LIMIT`: it replaces rather than adds, and
 * a path is bounded by its own hop cap well below that limit.
 */
export function setPath(
    graph: Readonly<GraphViewType>,
    {
        refList,
        hopList,
        availableWidth,
    }: {
        refList: readonly GraphNodeRefType[];
        // One hop per gap, so `hopList.length` is `refList.length - 1`.
        hopList: readonly GraphPathHopType[];
        availableWidth: number;
    },
): GraphViewType {
    if (refList.length === 0) {
        return graph as GraphViewType;
    }
    const pointList = layoutPathChain({
        nodeCount: refList.length,
        availableWidth,
    });
    const nodeList: GraphNodeType[] = refList.map((ref, index) => {
        return {
            key: toGraphNodeKey(ref.kind, ref.recordId),
            kind: ref.kind,
            recordId: ref.recordId,
            name: ref.name,
            x: pointList[index]?.x ?? 0,
            y: pointList[index]?.y ?? 0,
            // The chain is a deliberate arrangement; a later expansion must
            // fan out around it rather than disturb it.
            isPinned: true,
            isCollapsed: false,
            originKey:
                index === 0
                    ? null
                    : toGraphNodeKey(
                          refList[index - 1].kind,
                          refList[index - 1].recordId,
                      ),
            isExpanded: false,
        };
    });
    const edgeList: GraphEdgeType[] = [];
    for (let index = 0; index + 1 < nodeList.length; index++) {
        const earlierKey = nodeList[index].key;
        const laterKey = nodeList[index + 1].key;
        const hop = hopList[index];
        const relation = hop?.relation ?? '';
        // A hop that walks UP to a parent still has to store the canonical
        // parent -> child edge, or the midpoint label would gender the parent
        // and read "son" pointing at the father.
        const isReversed = hop?.isReversed ?? false;
        edgeList.push({
            key: getEdgeKey(earlierKey, laterKey, relation),
            fromKey: isReversed ? laterKey : earlierKey,
            toKey: isReversed ? earlierKey : laterKey,
            relation,
        });
    }
    return {
        ...graph,
        // The chain REPLACES what was on the canvas, so the graph it belongs
        // to is a new one: its first box is the root everything now hangs off,
        // and the panel is named after it. Left alone, `rootKey` pointed at a
        // box the path had just removed — the title still read the record the
        // user started from, and no box on screen was marked as the root.
        rootKey: nodeList[0].key,
        title: nodeList[0].name,
        nodeList,
        edgeList,
        pathNodeKeyList: nodeList.map((node) => {
            return node.key;
        }),
    };
}

/**
 * The edges that lie along the current path, derived rather than stored so the
 * path lives in exactly one place.
 */
export function getPathEdgeKeySet(graph: Readonly<GraphViewType>) {
    const result = new Set<string>();
    for (let index = 0; index + 1 < graph.pathNodeKeyList.length; index++) {
        const fromKey = graph.pathNodeKeyList[index];
        const toKey = graph.pathNodeKeyList[index + 1];
        for (const edge of graph.edgeList) {
            const isSamePair =
                (edge.fromKey === fromKey && edge.toKey === toKey) ||
                (edge.fromKey === toKey && edge.toKey === fromKey);
            if (isSamePair) {
                result.add(edge.key);
            }
        }
    }
    return result;
}

/**
 * Makes a node the new centre: it moves to the origin and everything is laid
 * out around it again, unpinned so the fresh layout actually applies.
 */
export function reRootGraph(
    graph: Readonly<GraphViewType>,
    nodeKey: string,
): GraphViewType {
    const node = findGraphNode(graph, nodeKey);
    if (node === null) {
        return graph as GraphViewType;
    }
    const deltaX = -node.x;
    const deltaY = -node.y;
    return {
        ...graph,
        rootKey: nodeKey,
        title: node.name,
        nodeList: graph.nodeList.map((item) => {
            return {
                ...item,
                x: item.x + deltaX,
                y: item.y + deltaY,
                isPinned: item.key === nodeKey,
            };
        }),
        // Re-rooting is a fresh question; the old answer no longer describes
        // what is on screen.
        pathNodeKeyList: [],
        panX: 0,
        panY: 0,
    };
}

/**
 * Empties the graph down to one box and starts again from it.
 *
 * The filters are kept — they say how the user likes to read a graph, not what
 * this one holds — but every other box, edge and any found path goes: the point
 * is a clean slate around a record already in front of them, without hunting
 * for it in the lookup panel again.
 */
export function resetGraphToNode(
    graph: Readonly<GraphViewType>,
    nodeKey: string,
): GraphViewType {
    const node = findGraphNode(graph, nodeKey);
    if (node === null) {
        return graph as GraphViewType;
    }
    return {
        ...graph,
        rootKey: node.key,
        title: node.name,
        nodeList: [
            {
                ...node,
                x: 0,
                y: 0,
                isPinned: true,
                isCollapsed: false,
                originKey: null,
                isExpanded: false,
            },
        ],
        edgeList: [],
        pathNodeKeyList: [],
        panX: 0,
        panY: 0,
    };
}

/**
 * Throws away every manual position and rebuilds the picture outward from the
 * root, breadth first, so a graph the user has dragged into a knot can be
 * recovered.
 */
export function relayoutGraph(
    graph: Readonly<GraphViewType>,
    relationDefList: readonly GraphRelationDefType[],
    // Only used when the graph carries a path; the default is a sane page
    // width for a caller with no viewport in hand.
    availableWidth = 1200,
): GraphViewType {
    const relationOrder = relationDefList.map((definition) => {
        return definition.kind;
    });
    // Only the edges currently shown: re-laying out around lines the user has
    // filtered away would leave the visible boxes as far apart as they were
    // when everything was on screen, which is exactly what they pressed this
    // to fix.
    const hiddenSet = new Set(graph.hiddenRelationList);
    const activeEdgeList = graph.edgeList.filter((edge) => {
        return !hiddenSet.has(edge.relation);
    });
    const neighbourKeyListMap = new Map<string, string[]>();
    for (const edge of activeEdgeList) {
        const fromList = neighbourKeyListMap.get(edge.fromKey) ?? [];
        fromList.push(edge.toKey);
        neighbourKeyListMap.set(edge.fromKey, fromList);
        const toList = neighbourKeyListMap.get(edge.toKey) ?? [];
        toList.push(edge.fromKey);
        neighbourKeyListMap.set(edge.toKey, toList);
    }

    const positionMap = new Map<string, GraphPointType>();
    const originMap = new Map<string, string | null>();
    const queue: string[] = [];
    // A found path is a CHAIN, and rings are the wrong shape for one: laying
    // 32 generations out radially spirals each box back over the last. So the
    // chain is rebuilt end to end exactly as the search first drew it, and the
    // rings below fan whatever hangs off it around those fixed points.
    const pathKeyList = graph.pathNodeKeyList.filter((key) => {
        return graph.nodeList.some((node) => {
            return node.key === key;
        });
    });
    if (pathKeyList.length > 1) {
        const pointList = layoutPathChain({
            nodeCount: pathKeyList.length,
            availableWidth,
        });
        pathKeyList.forEach((key, index) => {
            positionMap.set(key, pointList[index] ?? { x: 0, y: 0 });
            originMap.set(key, index === 0 ? null : pathKeyList[index - 1]);
            queue.push(key);
        });
    } else {
        positionMap.set(graph.rootKey, { x: 0, y: 0 });
        originMap.set(graph.rootKey, null);
        queue.push(graph.rootKey);
    }
    const pathKeySet = new Set(pathKeyList);
    let head = 0;
    while (head < queue.length) {
        const currentKey = queue[head];
        head += 1;
        const currentPoint = positionMap.get(currentKey) ?? { x: 0, y: 0 };
        const originKey = originMap.get(currentKey) ?? null;
        const originPoint =
            originKey === null ? null : (positionMap.get(originKey) ?? null);
        const incomingAngle =
            originPoint === null
                ? null
                : Math.atan2(
                      currentPoint.y - originPoint.y,
                      currentPoint.x - originPoint.x,
                  );
        const pendingKeyList = (
            neighbourKeyListMap.get(currentKey) ?? []
        ).filter((key) => {
            return !positionMap.has(key);
        });
        if (pendingKeyList.length === 0) {
            continue;
        }
        const groupCountMap = new Map<GraphRelationKindType, number>();
        const relationOfKey = new Map<string, GraphRelationKindType>();
        for (const key of pendingKeyList) {
            const edge = activeEdgeList.find((item) => {
                return (
                    (item.fromKey === currentKey && item.toKey === key) ||
                    (item.toKey === currentKey && item.fromKey === key)
                );
            });
            const relation = edge?.relation ?? relationOrder[0] ?? 'related';
            relationOfKey.set(key, relation);
            groupCountMap.set(relation, (groupCountMap.get(relation) ?? 0) + 1);
        }
        const placementList = layoutRadialNeighbours({
            origin: currentPoint,
            incomingAngle,
            groupList: Array.from(groupCountMap.entries()).map(
                ([relation, count]) => {
                    return { relation, count };
                },
            ),
            occupiedList: Array.from(positionMap.values()),
            relationOrder: relationOrder.concat(
                Array.from(groupCountMap.keys()),
            ),
        });
        const placementByRelation = new Map<
            GraphRelationKindType,
            GraphPointType[]
        >();
        for (const placement of placementList) {
            const list = placementByRelation.get(placement.relation) ?? [];
            list.push({ x: placement.x, y: placement.y });
            placementByRelation.set(placement.relation, list);
        }
        for (const key of pendingKeyList) {
            const relation = relationOfKey.get(key) ?? '';
            const point = placementByRelation.get(relation)?.shift();
            if (point === undefined) {
                continue;
            }
            positionMap.set(key, point);
            originMap.set(key, currentKey);
            queue.push(key);
        }
    }

    return {
        ...graph,
        nodeList: graph.nodeList.map((node) => {
            const point = positionMap.get(node.key);
            // A node no edge reaches keeps whatever position it had rather
            // than collapsing onto the origin with everything else.
            if (point === undefined) {
                return { ...node, isPinned: false };
            }
            return {
                ...node,
                x: point.x,
                y: point.y,
                originKey: originMap.get(node.key) ?? null,
                // The chain is a deliberate arrangement, the same as when the
                // search built it: a later expansion fans around it rather
                // than pulling it apart.
                isPinned:
                    node.key === graph.rootKey || pathKeySet.has(node.key),
            };
        }),
        // Positions moved, so the old pan no longer frames anything.
        panX: 0,
        panY: 0,
    };
}

/**
 * The nodes and edges that should actually be drawn, given the relation
 * filters.
 *
 * A hidden relation hides its edges, and hides any node that nothing else
 * still reaches — but the node keeps its stored position, so switching the
 * filter back on is instant and puts everything exactly where it was.
 */
export function getVisibleGraph(graph: Readonly<GraphViewType>): {
    nodeList: GraphNodeType[];
    edgeList: GraphEdgeType[];
} {
    if (graph.hiddenRelationList.length === 0) {
        return { nodeList: graph.nodeList, edgeList: graph.edgeList };
    }
    const hiddenSet = new Set(graph.hiddenRelationList);
    const edgeList = graph.edgeList.filter((edge) => {
        return !hiddenSet.has(edge.relation);
    });
    const reachableKeySet = new Set<string>([graph.rootKey]);
    for (const key of graph.pathNodeKeyList) {
        reachableKeySet.add(key);
    }
    // Walk out from the root over the surviving edges only.
    const adjacency = new Map<string, string[]>();
    for (const edge of edgeList) {
        const fromList = adjacency.get(edge.fromKey) ?? [];
        fromList.push(edge.toKey);
        adjacency.set(edge.fromKey, fromList);
        const toList = adjacency.get(edge.toKey) ?? [];
        toList.push(edge.fromKey);
        adjacency.set(edge.toKey, toList);
    }
    const queue = Array.from(reachableKeySet);
    let head = 0;
    while (head < queue.length) {
        const currentKey = queue[head];
        head += 1;
        for (const nextKey of adjacency.get(currentKey) ?? []) {
            if (!reachableKeySet.has(nextKey)) {
                reachableKeySet.add(nextKey);
                queue.push(nextKey);
            }
        }
    }
    return {
        nodeList: graph.nodeList.filter((node) => {
            return reachableKeySet.has(node.key);
        }),
        edgeList,
    };
}

/**
 * Edges grouped by the pair they join, so two records related in more than one
 * way (Abraham and Sarah are siblings AND spouses) can be bowed apart instead
 * of drawn on top of each other.
 */
export function getEdgeBowIndexMap(edgeList: readonly GraphEdgeType[]) {
    const countMap = new Map<string, number>();
    for (const edge of edgeList) {
        const pairKey =
            edge.fromKey < edge.toKey
                ? `${edge.fromKey}|${edge.toKey}`
                : `${edge.toKey}|${edge.fromKey}`;
        countMap.set(pairKey, (countMap.get(pairKey) ?? 0) + 1);
    }
    const seenMap = new Map<string, number>();
    const result = new Map<string, number>();
    for (const edge of edgeList) {
        const pairKey =
            edge.fromKey < edge.toKey
                ? `${edge.fromKey}|${edge.toKey}`
                : `${edge.toKey}|${edge.fromKey}`;
        const total = countMap.get(pairKey) ?? 1;
        const seen = seenMap.get(pairKey) ?? 0;
        seenMap.set(pairKey, seen + 1);
        result.set(
            edge.key,
            total === 1
                ? 0
                : (seen - (total - 1) / 2) * GRAPH_GEOMETRY.EDGE_BOW,
        );
    }
    return result;
}
