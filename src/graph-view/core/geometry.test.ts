import { describe, expect, it } from 'vitest';

import {
    GRAPH_GEOMETRY,
    getEdgeArrowTransform,
    getEdgeCurve,
    getEdgePathD,
    getNodeRect,
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
