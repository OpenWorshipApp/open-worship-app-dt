/**
 * Shortest-path search over an adjacency the CALLER supplies.
 *
 * Generic on purpose: the core has no idea what a record is, so a source hands
 * in an adjacency it built however it likes and gets back a list of ids. That
 * also keeps the retention policy where it belongs — this function holds
 * nothing after it returns, and the caller decides whether its adjacency was
 * worth keeping (for the lookup source: it is not).
 */

export type GraphAdjacencyType = Map<string, Set<string>>;

/**
 * How far a path may run before it stops being an answer anyone asked for.
 *
 * 30 rather than something tidier because the motivating query is David to
 * Jesus, which is roughly 28 parent-child generations in Matthew 1. A smaller
 * cap would refuse exactly the question the feature exists to answer.
 */
export const GRAPH_MAX_PATH_HOP = 30;

export function findShortestPath(
    adjacency: Readonly<GraphAdjacencyType>,
    fromId: string,
    toId: string,
    { maxHopCount = GRAPH_MAX_PATH_HOP }: { maxHopCount?: number } = {},
): string[] | null {
    if (fromId === toId) {
        return adjacency.has(fromId) ? [fromId] : null;
    }
    if (!adjacency.has(fromId) || !adjacency.has(toId)) {
        return null;
    }
    const cameFrom = new Map<string, string | null>([[fromId, null]]);
    // A plain array with a head index, never `shift()` — on a few thousand
    // records that would turn the walk quadratic.
    const queue: string[] = [fromId];
    let head = 0;
    let hopCount = 0;
    let levelEnd = 1;
    while (head < queue.length) {
        const currentId = queue[head];
        head += 1;
        for (const nextId of adjacency.get(currentId) ?? []) {
            if (cameFrom.has(nextId)) {
                continue;
            }
            cameFrom.set(nextId, currentId);
            if (nextId === toId) {
                const idList: string[] = [];
                let cursor: string | null = nextId;
                while (cursor !== null) {
                    idList.push(cursor);
                    cursor = cameFrom.get(cursor) ?? null;
                }
                return idList.reverse();
            }
            queue.push(nextId);
        }
        if (head === levelEnd) {
            hopCount += 1;
            levelEnd = queue.length;
            if (hopCount > maxHopCount) {
                return null;
            }
        }
    }
    return null;
}

/**
 * Adds an undirected link.
 *
 * Undirected by construction because the datasets are not reliably symmetric —
 * a record may list another under `children` while that record's `parents` is
 * empty. Building only what is written would make the search miss real
 * connections in one direction.
 */
export function linkAdjacency(
    adjacency: GraphAdjacencyType,
    aId: string,
    bId: string,
) {
    if (aId === bId) {
        return;
    }
    const aSet = adjacency.get(aId);
    if (aSet === undefined) {
        adjacency.set(aId, new Set([bId]));
    } else {
        aSet.add(bId);
    }
    const bSet = adjacency.get(bId);
    if (bSet === undefined) {
        adjacency.set(bId, new Set([aId]));
    } else {
        bSet.add(aId);
    }
}
