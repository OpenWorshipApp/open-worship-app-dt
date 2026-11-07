import { describe, expect, it } from 'vitest';

import {
    GRAPH_GEOMETRY,
    centreGraphInViewport,
    fitGraphToViewport,
    getEdgeArrowTransform,
    getEdgeCurve,
    getEdgePathD,
    getNodeAnchor,
    getNodeRect,
    getWorldBounds,
    layoutPathChain,
} from './geometry';

function parseTransform(transform: string) {
    const match = transform.match(
        /^translate\((-?[\d.]+) (-?[\d.]+)\) rotate\((-?[\d.]+)\)$/,
    );
    if (match === null) {
        throw new Error(`unparsable transform: ${transform}`);
    }
    return {
        x: Number(match[1]),
        y: Number(match[2]),
        angle: Number(match[3]),
    };
}

function checkIsInsideRect(
    point: { x: number; y: number },
    rect: { left: number; top: number; right: number; bottom: number },
) {
    return (
        point.x > rect.left &&
        point.x < rect.right &&
        point.y > rect.top &&
        point.y < rect.bottom
    );
}

// A ring of targets around one origin, which is how an expansion actually
// lays out: the trim has to hold in every direction, not just the easy
// left-to-right one.
const DIRECTION_LIST = Array.from({ length: 16 }, (_unused, index) => {
    const angle = (Math.PI * 2 * index) / 16;
    return { angle, index };
});

describe('getNodeRect', () => {
    it('matches what the box renders at, collapsed or not', () => {
        const rect = getNodeRect({ x: 0, y: 0 });
        expect(rect).toEqual({
            left: -GRAPH_GEOMETRY.NODE_WIDTH / 2,
            right: GRAPH_GEOMETRY.NODE_WIDTH / 2,
            top: -GRAPH_GEOMETRY.NODE_HEIGHT / 2,
            bottom: GRAPH_GEOMETRY.NODE_HEIGHT / 2,
        });
        // A collapsed box keeps its TOP and stops short, so it is not centred
        // on the node point.
        const collapsed = getNodeRect({ x: 0, y: 0 }, true);
        expect(collapsed.top).toBe(-GRAPH_GEOMETRY.NODE_HEIGHT / 2);
        expect(collapsed.bottom).toBe(
            -GRAPH_GEOMETRY.NODE_HEIGHT / 2 +
                GRAPH_GEOMETRY.NODE_COLLAPSED_HEIGHT,
        );
    });
});

describe('getEdgeCurve', () => {
    it('leaves both ends outside the boxes they join', () => {
        const from = { x: 0, y: 0 };
        for (const { angle } of DIRECTION_LIST) {
            for (const distance of [260, 400, 700]) {
                for (const bow of [0, GRAPH_GEOMETRY.EDGE_BOW]) {
                    const to = {
                        x: Math.cos(angle) * distance,
                        y: Math.sin(angle) * distance,
                    };
                    const fromRect = getNodeRect(from);
                    const toRect = getNodeRect(to);
                    const [start, , , end] = getEdgeCurve(
                        from,
                        to,
                        bow,
                        fromRect,
                        toRect,
                    );
                    expect(checkIsInsideRect(start, fromRect)).toBe(false);
                    expect(checkIsInsideRect(end, toRect)).toBe(false);
                }
            }
        }
    });

    it('is untrimmed when no rect is given', () => {
        const from = { x: 0, y: 0 };
        const to = { x: 400, y: 120 };
        const [start, , , end] = getEdgeCurve(from, to, 0);
        expect(start).toEqual(from);
        expect(end).toEqual(to);
        expect(getEdgePathD(from, to, 0)).toContain('M 0 0');
    });

    it('falls back to the whole line when the boxes overlap', () => {
        // Nothing to draw between two boxes sitting on each other; an
        // inverted or empty path would be worse than the honest full line.
        const from = { x: 0, y: 0 };
        const to = { x: 12, y: 6 };
        const [start, , , end] = getEdgeCurve(
            from,
            to,
            0,
            getNodeRect(from),
            getNodeRect(to),
        );
        expect(start).toEqual(from);
        expect(end).toEqual(to);
    });
});

describe('getEdgeArrowTransform', () => {
    it('parks the arrowhead outside the box it points at', () => {
        // The bug this guards: the arrow used to ride an SVG `marker-end`,
        // which sits at the path's end — the target box's CENTRE, underneath
        // the box, where no reader could see which way the relation ran.
        const from = { x: 0, y: 0 };
        for (const { angle } of DIRECTION_LIST) {
            for (const isCollapsed of [false, true]) {
                const to = {
                    x: Math.cos(angle) * 320,
                    y: Math.sin(angle) * 320,
                };
                const toRect = getNodeRect(to, isCollapsed);
                const point = parseTransform(
                    getEdgeArrowTransform(
                        from,
                        to,
                        0,
                        getNodeRect(from),
                        toRect,
                    ),
                );
                expect(checkIsInsideRect(point, toRect)).toBe(false);
            }
        }
    });

    it('points along the line, at the end the relation runs to', () => {
        const arrow = parseTransform(
            getEdgeArrowTransform(
                { x: 0, y: 0 },
                { x: 500, y: 0 },
                0,
                getNodeRect({ x: 0, y: 0 }),
                getNodeRect({ x: 500, y: 0 }),
            ),
        );
        expect(arrow.angle).toBeCloseTo(0, 1);
        // Just short of the target box's left border, not at its centre.
        expect(arrow.x).toBeGreaterThan(340);
        expect(arrow.x).toBeLessThan(420);
    });

    it('reverses with the edge', () => {
        const reversed = parseTransform(
            getEdgeArrowTransform(
                { x: 500, y: 0 },
                { x: 0, y: 0 },
                0,
                getNodeRect({ x: 500, y: 0 }),
                getNodeRect({ x: 0, y: 0 }),
            ),
        );
        expect(Math.abs(reversed.angle)).toBeCloseTo(180, 1);
        expect(reversed.x).toBeLessThan(160);
    });
});

describe('degenerate inputs and the viewport fits', () => {
    it('a path with no boxes lays out nothing', () => {
        expect(layoutPathChain({ nodeCount: 0, availableWidth: 1200 })).toEqual(
            [],
        );
        expect(
            layoutPathChain({ nodeCount: -3, availableWidth: 1200 }),
        ).toEqual([]);
    });

    it('two boxes too close to trim between keep the untrimmed line', () => {
        const from = { x: 0, y: 0 };
        // 190 apart leaves a 4-unit strip between the two box gaps: far too
        // little to draw a trimmed line in.
        const to = { x: 190, y: 0 };
        const curve = getEdgeCurve(
            from,
            to,
            0,
            getNodeRect(from),
            getNodeRect(to),
        );
        expect(curve[0]).toEqual(from);
        expect(curve[3]).toEqual(to);
        // Far enough apart, the same call does trim to the borders.
        const farTo = { x: 400, y: 0 };
        const trimmed = getEdgeCurve(
            from,
            farTo,
            0,
            getNodeRect(from),
            getNodeRect(farTo),
        );
        expect(trimmed[0].x).toBeGreaterThan(
            GRAPH_GEOMETRY.NODE_WIDTH / 2 + GRAPH_GEOMETRY.EDGE_BOX_GAP,
        );
        expect(trimmed[3].x).toBeLessThan(
            farTo.x -
                GRAPH_GEOMETRY.NODE_WIDTH / 2 -
                GRAPH_GEOMETRY.EDGE_BOX_GAP,
        );
    });

    it('a collapsed box is anchored at the centre of what is left of it', () => {
        const centre = { x: 50, y: 100 };
        expect(getNodeAnchor(centre)).toBe(centre);
        const anchor = getNodeAnchor(centre, true);
        expect(anchor.x).toBe(50);
        // The collapsed box keeps its top (y 56) and is 32 tall: centre 72.
        expect(anchor.y).toBeCloseTo(72);
        const rect = getNodeRect(centre, true);
        expect((rect.top + rect.bottom) / 2).toBeCloseTo(anchor.y);
    });

    it('an empty graph still has a one-unit world box', () => {
        expect(getWorldBounds([])).toEqual({
            left: 0,
            top: 0,
            width: 1,
            height: 1,
        });
    });

    it('centring an empty graph or a zero-size viewport does not pan', () => {
        expect(
            centreGraphInViewport({
                nodeList: [],
                viewportWidth: 800,
                viewportHeight: 600,
                zoomPercent: 100,
            }),
        ).toEqual({ panX: 0, panY: 0 });
        expect(
            centreGraphInViewport({
                nodeList: [{ x: 10, y: 10 }],
                viewportWidth: 0,
                viewportHeight: 600,
                zoomPercent: 100,
            }),
        ).toEqual({ panX: 0, panY: 0 });
        expect(
            centreGraphInViewport({
                nodeList: [{ x: 10, y: 10 }],
                viewportWidth: 800,
                viewportHeight: -1,
                zoomPercent: 100,
            }),
        ).toEqual({ panX: 0, panY: 0 });
    });

    it('centres one box, and the middle of several, at the zoom given', () => {
        const single = centreGraphInViewport({
            nodeList: [{ x: 0, y: 0 }],
            viewportWidth: 800,
            viewportHeight: 600,
            zoomPercent: 100,
        });
        expect(single.panX).toBeCloseTo(400);
        expect(single.panY).toBeCloseTo(300);
        const zoomed = centreGraphInViewport({
            nodeList: [{ x: 0, y: 0 }],
            viewportWidth: 800,
            viewportHeight: 600,
            zoomPercent: 200,
        });
        expect(zoomed.panX).toBeCloseTo(200);
        expect(zoomed.panY).toBeCloseTo(150);
        const several = centreGraphInViewport({
            nodeList: [
                { x: -100, y: -50 },
                { x: 300, y: 150 },
                { x: 20, y: 0 },
            ],
            viewportWidth: 800,
            viewportHeight: 600,
            zoomPercent: 50,
        });
        // Content centre (100, 50); the viewport is 1600 x 1200 graph units.
        expect(several.panX).toBeCloseTo(700);
        expect(several.panY).toBeCloseTo(550);
    });

    it('fitting nothing, or into nothing, is the identity viewport', () => {
        const identity = { panX: 0, panY: 0, zoomPercent: 100 };
        expect(
            fitGraphToViewport({
                nodeList: [],
                viewportWidth: 800,
                viewportHeight: 600,
                minZoomPercent: 25,
                maxZoomPercent: 500,
            }),
        ).toEqual(identity);
        expect(
            fitGraphToViewport({
                nodeList: [{ x: 0, y: 0 }],
                viewportWidth: 800,
                viewportHeight: 0,
                minZoomPercent: 25,
                maxZoomPercent: 500,
            }),
        ).toEqual(identity);
    });

    it('fits one box up to the zoom cap and centres it', () => {
        const capped = fitGraphToViewport({
            nodeList: [{ x: 0, y: 0 }],
            viewportWidth: 800,
            viewportHeight: 600,
            minZoomPercent: 25,
            maxZoomPercent: 100,
        });
        expect(capped).toEqual({ panX: 400, panY: 300, zoomPercent: 100 });
        // Uncapped, one 168 x 88 box plus 48 padding a side fills the width at
        // 800 / 264 = 3.03x.
        const free = fitGraphToViewport({
            nodeList: [{ x: 0, y: 0 }],
            viewportWidth: 800,
            viewportHeight: 600,
            minZoomPercent: 25,
            maxZoomPercent: 500,
        });
        expect(free.zoomPercent).toBe(303);
        expect(free.panX).toBeCloseTo(800 / 3.03 / 2);
        expect(free.panY).toBeCloseTo(600 / 3.03 / 2);
    });

    it('shrinks a wide graph to fit, but never below the minimum zoom', () => {
        const nodeList = [
            { x: 0, y: 0 },
            { x: 2000, y: 1000 },
        ];
        const fitted = fitGraphToViewport({
            nodeList,
            viewportWidth: 800,
            viewportHeight: 600,
            minZoomPercent: 25,
            maxZoomPercent: 500,
        });
        // Content 2264 x 1184: the width binds, 800 / 2264 = 0.353.
        expect(fitted.zoomPercent).toBe(35);
        expect(fitted.panX).toBeCloseTo(800 / 0.35 / 2 - 1000);
        expect(fitted.panY).toBeCloseTo(600 / 0.35 / 2 - 500);
        const floored = fitGraphToViewport({
            nodeList,
            viewportWidth: 800,
            viewportHeight: 600,
            minZoomPercent: 50,
            maxZoomPercent: 500,
        });
        expect(floored).toEqual({ panX: -200, panY: 100, zoomPercent: 50 });
    });
});
