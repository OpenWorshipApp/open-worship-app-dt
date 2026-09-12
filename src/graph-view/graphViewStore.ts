import { useSyncExternalStore } from 'react';

import type { GraphNodeRefType, GraphViewType } from './core';
import { createGraphEngine } from './core';

/**
 * The app's single graph engine, plus its React binding.
 *
 * The engine itself is framework-agnostic (`core/graphEngine.ts`); this module
 * is the only place that knows React exists, which is what keeps the core
 * liftable into a package of its own later.
 *
 * Graphs are window-scoped rather than owned by whatever opened them, for the
 * same reason the detail panels are: closing the lookup panel must not yank
 * away a graph the user opened from it, and a graph can be opened from a
 * context menu with no React tree in scope at all.
 */
const graphEngine = createGraphEngine();

export function getGraphEngine() {
    return graphEngine;
}

/**
 * Opens a FRESH graph on a record, or raises the one already open for it.
 *
 * Deliberately not resumed from anything on disk. An implicit "last session"
 * used to come back instead, and it made opening a record unpredictable: run a
 * path or re-root inside the panel and what came back days later was some
 * other person's family, under the name that was clicked. Coming back to an
 * arrangement is what NAMED PRESETS are for — the user says when one is worth
 * keeping. A panel still open is raised rather than reset, since that is the
 * one the user is working in.
 *
 * Imperative on purpose: every entry point is a context-menu selection or a
 * button click, neither of which has the store in React context.
 */
export function openGraphPreview(sourceId: string, root: GraphNodeRefType) {
    return graphEngine.open({ sourceId, root });
}

export function closeGraphPreview(graphKey: string) {
    graphEngine.close(graphKey);
}

export function useOpenGraphList(): GraphViewType[] {
    return useSyncExternalStore(
        graphEngine.subscribe,
        graphEngine.getSnapshot,
        graphEngine.getSnapshot,
    );
}

/**
 * One graph by key, or null once it has been closed.
 *
 * Selecting here rather than in each consumer keeps the identity contract in
 * one place: the engine replaces the graph object on every change, so this
 * returns a new value only when that graph really changed.
 */
export function useGraphView(graphKey: string): GraphViewType | null {
    const graphList = useOpenGraphList();
    return (
        graphList.find((graph) => {
            return graph.key === graphKey;
        }) ?? null
    );
}
