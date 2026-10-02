import type { GraphPointType } from './core';
import { GRAPH_ZOOM_RANGE, fitGraphToViewport, getVisibleGraph } from './core';
import { getGraphEngine } from './graphViewStore';

/**
 * A fit only ever SHRINKS the graph to the panel. Fitting a lone box — what
 * **Use as root** leaves on a fresh graph — blew it up to 290%, a giant card
 * that read as a zoom the user never asked for.
 */
export const GRAPH_FIT_MAX_ZOOM_PERCENT = 100;

/** The dock's own gap above the panel's bottom edge, `bottom` in the scss. */
const DOCK_BOTTOM_GAP = 8;

/**
 * The part of the viewport a fit may use: the dock floats over the bottom of
 * the canvas, so a fit to the full height put the last row of boxes under it.
 */
export function getGraphFitArea(viewport: HTMLElement) {
    const dock = viewport.querySelector<HTMLElement>('.graph-view__dock');
    const dockSpace = dock === null ? 0 : dock.offsetHeight + DOCK_BOTTOM_GAP;
    return {
        width: viewport.clientWidth,
        height: Math.max(1, viewport.clientHeight - dockSpace),
    };
}

/**
 * Brings a graph's VISIBLE boxes into view — or `nodeList`, when the caller
 * has just changed the graph and the engine's snapshot is what it should fit.
 *
 * Read from the engine, not from a component's copy: a component's graph only
 * catches up on its next render, and a fit straight after an expansion or a
 * found path measured the graph as it was before.
 */
export function fitGraphOnScreen(
    graphKey: string,
    viewport: HTMLElement | null,
    nodeList?: readonly GraphPointType[],
    isUserMove = true,
) {
    if (viewport === null) {
        return;
    }
    let fitNodeList = nodeList;
    if (fitNodeList === undefined) {
        const graph = getGraphEngine()
            .getSnapshot()
            .find((item) => {
                return item.key === graphKey;
            });
        if (graph === undefined) {
            return;
        }
        // The VISIBLE nodes, not every node: fitting to boxes a relation
        // filter has hidden would leave the graph zoomed out around empty
        // space the user cannot see.
        fitNodeList = getVisibleGraph(graph).nodeList;
    }
    if (fitNodeList.length === 0) {
        return;
    }
    const { width, height } = getGraphFitArea(viewport);
    const next = fitGraphToViewport({
        nodeList: fitNodeList,
        viewportWidth: width,
        viewportHeight: height,
        minZoomPercent: GRAPH_ZOOM_RANGE.min,
        maxZoomPercent: Math.min(
            GRAPH_ZOOM_RANGE.max,
            GRAPH_FIT_MAX_ZOOM_PERCENT,
        ),
    });
    getGraphEngine().setViewport(graphKey, next, isUserMove);
}
