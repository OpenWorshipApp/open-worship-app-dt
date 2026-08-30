/**
 * Pan and zoom maths. Pure, and deliberately free of the app's range type so
 * the core carries no app import.
 */
export type GraphZoomRangeType = {
    size: number;
    min: number;
    max: number;
    step: number;
};

/**
 * Zoom is an INTEGER PERCENT, not a fraction.
 *
 * The app's shared zoom hook rounds whatever it is handed in its pinch branch,
 * so a 0.25..3 fraction would collapse to 0/1/2/3 the first time anyone used a
 * trackpad. Percent is also what a zoom slider wants to display.
 */
export const GRAPH_ZOOM_RANGE: GraphZoomRangeType = {
    size: 100,
    min: 25,
    max: 500,
    step: 5,
};

export type GraphViewportType = {
    panX: number;
    panY: number;
    zoomPercent: number;
};

export function clampZoomPercent(zoomPercent: number) {
    if (!Number.isFinite(zoomPercent)) {
        return GRAPH_ZOOM_RANGE.size;
    }
    return Math.round(
        Math.max(
            GRAPH_ZOOM_RANGE.min,
            Math.min(GRAPH_ZOOM_RANGE.max, zoomPercent),
        ),
    );
}

/**
 * A viewport-relative client point, in graph units.
 *
 * The rect MUST be the UNZOOMED viewport's. Under CSS `zoom`,
 * `getBoundingClientRect()` on a zoomed descendant reports the rendered box —
 * zoom already multiplied in — while pointer `clientX/Y` are plain viewport
 * pixels. Mixing the two gives a drag that runs away from the cursor as soon
 * as the graph is zoomed.
 */
export function clientToGraphPoint(
    viewportRect: Readonly<{ left: number; top: number }>,
    client: Readonly<{ x: number; y: number }>,
    viewport: Readonly<GraphViewportType>,
) {
    const scale = viewport.zoomPercent / 100;
    return {
        x: (client.x - viewportRect.left) / scale - viewport.panX,
        y: (client.y - viewportRect.top) / scale - viewport.panY,
    };
}

/**
 * A client-space movement in graph units.
 *
 * Drags only ever need the delta, and a delta needs no rect — which removes a
 * whole class of zoom/rect bugs. Prefer this over `clientToGraphPoint`.
 */
export function toGraphDelta(
    deltaClient: Readonly<{ x: number; y: number }>,
    zoomPercent: number,
) {
    const scale = zoomPercent / 100;
    return { x: deltaClient.x / scale, y: deltaClient.y / scale };
}

/**
 * The pan that keeps the graph point currently at the viewport centre still at
 * the centre after a zoom change. Without it, zooming walks the content off
 * screen and the user re-pans after every wheel notch.
 */
export function adjustPanForZoom(
    viewport: Readonly<GraphViewportType>,
    nextZoomPercent: number,
    viewportSize: Readonly<{ width: number; height: number }>,
): GraphViewportType {
    const currentScale = viewport.zoomPercent / 100;
    const nextZoom = clampZoomPercent(nextZoomPercent);
    const nextScale = nextZoom / 100;
    const centreX = viewportSize.width / currentScale / 2 - viewport.panX;
    const centreY = viewportSize.height / currentScale / 2 - viewport.panY;
    return {
        panX: viewportSize.width / nextScale / 2 - centreX,
        panY: viewportSize.height / nextScale / 2 - centreY,
        zoomPercent: nextZoom,
    };
}

/**
 * Zoom while keeping one point fixed under the cursor.
 *
 * Zooming about the viewport CENTRE instead makes the thing you were looking
 * at slide away, so every wheel notch has to be followed by a re-pan. The
 * anchor is in viewport-local pixels (client minus the UNZOOMED viewport
 * rect).
 */
export function zoomAtPoint(
    viewport: Readonly<GraphViewportType>,
    nextZoomPercent: number,
    anchor: Readonly<{ x: number; y: number }>,
): GraphViewportType {
    const nextZoom = clampZoomPercent(nextZoomPercent);
    const currentScale = viewport.zoomPercent / 100;
    const nextScale = nextZoom / 100;
    // The graph point currently under the anchor.
    const graphX = anchor.x / currentScale - viewport.panX;
    const graphY = anchor.y / currentScale - viewport.panY;
    return {
        panX: anchor.x / nextScale - graphX,
        panY: anchor.y / nextScale - graphY,
        zoomPercent: nextZoom,
    };
}

/**
 * One wheel notch as a zoom percentage.
 *
 * Multiplicative rather than a fixed step, so zooming feels the same at 30%
 * as at 200% instead of crawling when zoomed out and leaping when zoomed in.
 */
export function getWheelZoomPercent(
    zoomPercent: number,
    deltaY: number,
): number {
    const factor = Math.exp(-deltaY / 400);
    return clampZoomPercent(zoomPercent * factor);
}
