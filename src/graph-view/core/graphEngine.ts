import {
    addNeighbours,
    createGraphView,
    moveNode,
    reRootGraph,
    relayoutGraph,
    removeNode,
    resetGraphToNode,
    setAllNodesCollapsed,
    setNodeCollapsed,
    setPath,
    soloRelation,
    toggleRelationHidden,
} from './graphModel';
import type { AddNeighboursResultType } from './graphModel';
import type {
    GraphNeighbourType,
    GraphNodeRefType,
    GraphPathHopType,
    GraphRelationDefType,
    GraphRelationKindType,
    GraphViewType,
} from './types';
import { toGraphNodeKey } from './types';
import { clampZoomPercent } from './viewport';

/**
 * A tiny observable holding the open graphs.
 *
 * Framework-agnostic on purpose — it exposes `subscribe` / `getSnapshot` and
 * nothing else, which is exactly the shape React's `useSyncExternalStore`
 * wants without this file ever importing React. Any other host can drive it
 * just as well.
 *
 * Snapshots are REPLACED, never mutated, so a consumer can compare by identity
 * and re-render only when something really changed.
 */
export type GraphEngineType = ReturnType<typeof createGraphEngine>;

/**
 * How many steps back one graph remembers.
 *
 * An entry is a whole snapshot, but every transform is structural — a box
 * nobody touched is the SAME object in each entry — so a step costs one array
 * of pointers, not a copy of the graph. The cap is what keeps that bounded on
 * a machine with little memory, and the whole history is dropped with the
 * panel it belongs to.
 */
const HISTORY_LIMIT = 30;

/**
 * Consecutive viewport changes inside this window count as ONE step.
 *
 * A wheel zoom or a pinch fires a change per tick. Without this, undo would
 * walk back one tick at a time and the history would be nothing but zoom
 * frames; a pause this long ends the gesture and starts a new step. A box drag
 * needs no such treatment — it already commits once, on pointer-up.
 */
const VIEWPORT_COALESCE_MS = 700;

type HistoryKindType = 'edit' | 'viewport';

type HistoryType = {
    pastList: GraphViewType[];
    futureList: GraphViewType[];
    lastKind: HistoryKindType | null;
    lastAt: number;
};

export function createGraphEngine(
    // Injected so a test can drive coalescing without waiting in real time;
    // the core stays free of any host clock of its own.
    getNow: () => number = () => {
        return Date.now();
    },
) {
    let graphList: GraphViewType[] = [];
    const listenerSet = new Set<() => void>();
    const historyMap = new Map<string, HistoryType>();

    function getHistory(graphKey: string) {
        const found = historyMap.get(graphKey);
        if (found !== undefined) {
            return found;
        }
        const history: HistoryType = {
            pastList: [],
            futureList: [],
            lastKind: null,
            lastAt: 0,
        };
        historyMap.set(graphKey, history);
        return history;
    }

    /** Files the state a change is about to leave behind. */
    function record(
        graphKey: string,
        previous: GraphViewType,
        kind: HistoryKindType,
    ) {
        const history = getHistory(graphKey);
        const now = getNow();
        const isSameGesture =
            kind === 'viewport' &&
            history.lastKind === 'viewport' &&
            history.pastList.length > 0 &&
            now - history.lastAt < VIEWPORT_COALESCE_MS;
        history.lastKind = kind;
        history.lastAt = now;
        if (isSameGesture) {
            // The step already holds where this gesture started from.
            return;
        }
        history.pastList.push(previous);
        if (history.pastList.length > HISTORY_LIMIT) {
            history.pastList.shift();
        }
        // Acting is what makes a redo meaningless: the future it pointed at is
        // no longer reachable from here.
        history.futureList = [];
    }

    function setGraph(graphKey: string, next: GraphViewType) {
        graphList = graphList.map((item) => {
            return item.key === graphKey ? next : item;
        });
        notify();
    }

    function notify() {
        for (const listener of listenerSet) {
            listener();
        }
    }

    function replace(
        graphKey: string,
        transform: (graph: Readonly<GraphViewType>) => GraphViewType,
        // `null` for changes that are not the user moving anything — opening
        // the path bar, typing an endpoint — which have no business filling
        // the undo history.
        historyKind: HistoryKindType | null = 'edit',
    ) {
        let isChanged = false;
        const nextList = graphList.map((graph) => {
            if (graph.key !== graphKey) {
                return graph;
            }
            const next = transform(graph);
            if (next !== graph) {
                isChanged = true;
                if (historyKind !== null) {
                    record(graphKey, graph, historyKind);
                }
            }
            return next;
        });
        // A no-op must not notify: an unknown key, or a transform that decided
        // to change nothing, would otherwise re-render every consumer.
        if (!isChanged) {
            return;
        }
        graphList = nextList;
        notify();
    }

    return {
        subscribe(listener: () => void) {
            listenerSet.add(listener);
            return () => {
                listenerSet.delete(listener);
            };
        },

        getSnapshot() {
            return graphList;
        },

        /**
         * Opens a graph rooted at a record, or raises the one already open for
         * it. Re-opening keeps every box the user has explored — only the
         * raise counter moves.
         */
        open({
            sourceId,
            root,
        }: {
            sourceId: string;
            root: Readonly<GraphNodeRefType>;
        }) {
            const key = `${sourceId}:${toGraphNodeKey(
                root.kind,
                root.recordId,
            )}`;
            if (
                graphList.some((graph) => {
                    return graph.key === key;
                })
            ) {
                graphList = graphList.map((graph) => {
                    return graph.key === key
                        ? { ...graph, raiseCount: graph.raiseCount + 1 }
                        : graph;
                });
                notify();
                return key;
            }
            graphList = [...graphList, createGraphView({ sourceId, root })];
            notify();
            return key;
        },

        close(graphKey: string) {
            const nextList = graphList.filter((graph) => {
                return graph.key !== graphKey;
            });
            if (nextList.length === graphList.length) {
                return;
            }
            // The history goes with the panel: keeping it would let a
            // reopened graph undo back into a shape the user has since
            // left, and would hold those snapshots for the whole session.
            historyMap.delete(graphKey);
            graphList = nextList;
            notify();
        },

        closeAll() {
            historyMap.clear();
            if (graphList.length === 0) {
                return;
            }
            graphList = [];
            notify();
        },

        /**
         * Replaces the whole list, e.g. when restoring a saved preset.
         *
         * Restoring is a new baseline, not a step: a graph coming back from
         * settings has no earlier state in this window to undo to. Histories
         * of graphs that survive the swap are kept, the rest dropped so a
         * graph that has gone cannot leak its snapshots.
         */
        restore(nextList: GraphViewType[]) {
            const keySet = new Set(
                nextList.map((graph) => {
                    return graph.key;
                }),
            );
            for (const graphKey of [...historyMap.keys()]) {
                if (!keySet.has(graphKey)) {
                    historyMap.delete(graphKey);
                }
            }
            graphList = nextList;
            notify();
        },

        canUndo(graphKey: string) {
            return (historyMap.get(graphKey)?.pastList.length ?? 0) > 0;
        },

        canRedo(graphKey: string) {
            return (historyMap.get(graphKey)?.futureList.length ?? 0) > 0;
        },

        /** Steps back one action: a move, a zoom, an expansion, a filter. */
        undo(graphKey: string) {
            const history = historyMap.get(graphKey);
            const current = graphList.find((item) => {
                return item.key === graphKey;
            });
            const previous = history?.pastList.pop();
            if (
                history === undefined ||
                current === undefined ||
                previous === undefined
            ) {
                return false;
            }
            history.futureList.push(current);
            // Undoing ends whatever gesture was in progress, so the next zoom
            // opens a step of its own instead of merging into the one just
            // restored.
            history.lastKind = null;
            setGraph(graphKey, previous);
            return true;
        },

        redo(graphKey: string) {
            const history = historyMap.get(graphKey);
            const current = graphList.find((item) => {
                return item.key === graphKey;
            });
            const next = history?.futureList.pop();
            if (
                history === undefined ||
                current === undefined ||
                next === undefined
            ) {
                return false;
            }
            history.pastList.push(current);
            history.lastKind = null;
            setGraph(graphKey, next);
            return true;
        },

        addNeighbours(
            graphKey: string,
            options: {
                originKey: string;
                neighbourList: readonly GraphNeighbourType[];
                relationDefList: readonly GraphRelationDefType[];
            },
        ): AddNeighboursResultType | null {
            const graph = graphList.find((item) => {
                return item.key === graphKey;
            });
            if (graph === undefined) {
                return null;
            }
            const result = addNeighbours(graph, options);
            if (result.graph !== graph) {
                record(graphKey, graph, 'edit');
                graphList = graphList.map((item) => {
                    return item.key === graphKey ? result.graph : item;
                });
                notify();
            }
            return result;
        },

        moveNode(graphKey: string, nodeKey: string, x: number, y: number) {
            replace(graphKey, (graph) => {
                return moveNode(graph, nodeKey, x, y);
            });
        },

        setNodeCollapsed(
            graphKey: string,
            nodeKey: string,
            isCollapsed: boolean,
        ) {
            replace(graphKey, (graph) => {
                return setNodeCollapsed(graph, nodeKey, isCollapsed);
            });
        },

        setAllNodesCollapsed(graphKey: string, isCollapsed: boolean) {
            replace(graphKey, (graph) => {
                return setAllNodesCollapsed(graph, isCollapsed);
            });
        },

        removeNode(graphKey: string, nodeKey: string) {
            replace(graphKey, (graph) => {
                return removeNode(graph, nodeKey);
            });
        },

        toggleRelationHidden(
            graphKey: string,
            relation: GraphRelationKindType,
        ) {
            replace(graphKey, (graph) => {
                return toggleRelationHidden(graph, relation);
            });
        },

        soloRelation(
            graphKey: string,
            relation: GraphRelationKindType,
            relationDefList: readonly GraphRelationDefType[],
        ) {
            replace(graphKey, (graph) => {
                return soloRelation(graph, relation, relationDefList);
            });
        },

        /**
         * Makes a box the new centre.
         *
         * The re-layout happens inside the SAME step: re-rooting moves the new
         * centre to the world origin and clears the pan, so on its own it
         * dumped the graph into the viewport's top-left corner still arranged
         * around the box it used to hang from. Callers pass the relation
         * vocabulary to get the boxes re-fanned around the new centre — and
         * one undo takes the whole thing back.
         */
        reRoot(
            graphKey: string,
            nodeKey: string,
            relationDefList?: readonly GraphRelationDefType[],
            availableWidth?: number,
        ) {
            replace(graphKey, (graph) => {
                const next = reRootGraph(graph, nodeKey);
                if (next === graph || relationDefList === undefined) {
                    return next;
                }
                return relayoutGraph(next, relationDefList, availableWidth);
            });
        },

        /** Throws the graph away and starts again from one of its boxes. */
        resetToNode(graphKey: string, nodeKey: string) {
            replace(graphKey, (graph) => {
                return resetGraphToNode(graph, nodeKey);
            });
        },

        relayout(
            graphKey: string,
            relationDefList: readonly GraphRelationDefType[],
            availableWidth?: number,
        ) {
            replace(graphKey, (graph) => {
                return relayoutGraph(graph, relationDefList, availableWidth);
            });
        },

        setPath(
            graphKey: string,
            options: {
                refList: readonly GraphNodeRefType[];
                hopList: readonly GraphPathHopType[];
                availableWidth: number;
            },
        ) {
            replace(graphKey, (graph) => {
                return setPath(graph, options);
            });
        },

        setPathEndpoints(
            graphKey: string,
            endpoints: { pathFromId?: string | null; pathToId?: string | null },
        ) {
            replace(
                graphKey,
                (graph) => {
                    return { ...graph, ...endpoints };
                },
                null,
            );
        },

        setPathBarOpen(graphKey: string, isPathBarOpen: boolean) {
            replace(
                graphKey,
                (graph) => {
                    return graph.isPathBarOpen === isPathBarOpen
                        ? (graph as GraphViewType)
                        : { ...graph, isPathBarOpen };
                },
                null,
            );
        },

        clearPath(graphKey: string) {
            replace(graphKey, (graph) => {
                return graph.pathNodeKeyList.length === 0
                    ? (graph as GraphViewType)
                    : { ...graph, pathNodeKeyList: [] };
            });
        },

        setViewport(
            graphKey: string,
            viewport: {
                panX?: number;
                panY?: number;
                zoomPercent?: number;
            },
            // False for viewport moves the APP makes rather than the user:
            // centring a graph on first mount, and the auto-fit belonging to
            // the expansion that triggered it. Recording those would cost an
            // extra undo press to get past a step nobody asked for.
            isUserMove = true,
        ) {
            replace(
                graphKey,
                (graph) => {
                    const next = { ...graph, ...viewport };
                    if (viewport.zoomPercent !== undefined) {
                        next.zoomPercent = clampZoomPercent(
                            viewport.zoomPercent,
                        );
                    }
                    const isSame =
                        next.panX === graph.panX &&
                        next.panY === graph.panY &&
                        next.zoomPercent === graph.zoomPercent;
                    return isSame ? (graph as GraphViewType) : next;
                },
                isUserMove ? 'viewport' : null,
            );
        },
    };
}
