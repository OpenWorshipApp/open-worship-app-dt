import { tran } from '../lang/langHelpers';
import AppRangeComp from '../others/AppRangeComp';
import type { GraphViewType } from './core';
import { GRAPH_ZOOM_RANGE } from './core';
import { getGraphEngine } from './graphViewStore';

/**
 * The per-glance view controls, floating over the bottom-right of the canvas.
 *
 * They sit ON the canvas rather than in a strip above it so the graph gets the
 * panel's full height — the picture is the point. Fullscreen and the overflow
 * menu are deliberately NOT here: those are panel-level chrome and live in the
 * toolbar's top-right corner.
 */
export default function GraphDockComp({
    graph,
    onFitToView,
    onRelayout,
    onUndo,
    onRedo,
    visibleCount,
}: Readonly<{
    graph: GraphViewType;
    onFitToView: () => void;
    onRelayout: () => void;
    onUndo: () => void;
    onRedo: () => void;
    // What is actually on the canvas, which is fewer than `nodeList.length`
    // whenever a relation filter is off.
    visibleCount: number;
}>) {
    const engine = getGraphEngine();
    const isEveryCollapsed =
        graph.nodeList.length > 0 &&
        graph.nodeList.every((node) => {
            return node.isCollapsed;
        });
    const collapseLabel = isEveryCollapsed
        ? tran('Expand all')
        : tran('Collapse all');
    return (
        <div
            className="graph-view__dock"
            // The viewport starts a pan from any press that is not on a box, so
            // the dock has to say it is not empty canvas.
            data-graph-dock="true"
        >
            <button
                type="button"
                className="graph-view__tool-button"
                title={`${tran('Undo')} (Ctrl+Z)`}
                aria-label={tran('Undo')}
                // Read straight off the engine rather than held in state: any
                // step that changes what these answer also changes the graph,
                // which is what re-renders this dock.
                disabled={!engine.canUndo(graph.key)}
                onClick={onUndo}
            >
                <i className="bi bi-arrow-counterclockwise" />
            </button>
            <button
                type="button"
                className="graph-view__tool-button"
                title={`${tran('Redo')} (Ctrl+Y)`}
                aria-label={tran('Redo')}
                disabled={!engine.canRedo(graph.key)}
                onClick={onRedo}
            >
                <i className="bi bi-arrow-clockwise" />
            </button>
            <span className="graph-view__count app-data">
                {visibleCount === graph.nodeList.length
                    ? graph.nodeList.length
                    : `${visibleCount} / ${graph.nodeList.length}`}
            </span>
            <button
                type="button"
                className="graph-view__tool-button"
                title={tran('Fit to view')}
                aria-label={tran('Fit to view')}
                // Wrapped, NOT passed directly: React hands the click event
                // to the handler, and the fit takes an optional node list.
                onClick={() => {
                    onFitToView();
                }}
            >
                <i className="bi bi-arrows-fullscreen" />
            </button>
            <button
                type="button"
                className="graph-view__tool-button"
                title={tran('Re-layout')}
                aria-label={tran('Re-layout')}
                onClick={onRelayout}
            >
                {/* `magic` rather than `arrow-repeat`: this tidies the boxes
                    back into rings, and a circling arrow reads as "reload". */}
                <i className="bi bi-magic" />
            </button>
            <button
                type="button"
                className="graph-view__tool-button"
                title={collapseLabel}
                aria-label={collapseLabel}
                onClick={() => {
                    engine.setAllNodesCollapsed(graph.key, !isEveryCollapsed);
                }}
            >
                <i
                    className={`bi bi-chevron-${
                        isEveryCollapsed ? 'down' : 'up'
                    }`}
                />
            </button>
            <div className="graph-view__zoom">
                <AppRangeComp
                    value={graph.zoomPercent}
                    title={tran('Zoom')}
                    setValue={(nextValue) => {
                        engine.setViewport(graph.key, {
                            zoomPercent: nextValue,
                        });
                    }}
                    defaultSize={GRAPH_ZOOM_RANGE}
                    isShowValue
                />
            </div>
        </div>
    );
}
