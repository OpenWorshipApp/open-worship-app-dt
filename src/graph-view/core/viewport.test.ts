import { describe, expect, test } from 'vitest';

import {
    GRAPH_ZOOM_RANGE,
    adjustPanForZoom,
    clampZoomPercent,
    clientToGraphPoint,
    getWheelZoomPercent,
    toGraphDelta,
    zoomAtPoint,
} from './viewport';

describe('clampZoomPercent', () => {
    test('a zoom that is not a number falls back to 100%', () => {
        expect(clampZoomPercent(Number.NaN)).toBe(GRAPH_ZOOM_RANGE.size);
        expect(clampZoomPercent(Number.POSITIVE_INFINITY)).toBe(100);
        expect(clampZoomPercent(Number.NEGATIVE_INFINITY)).toBe(100);
    });

    test('clamps to the range and rounds to a whole percent', () => {
        expect(clampZoomPercent(3)).toBe(25);
        expect(clampZoomPercent(9000)).toBe(500);
        expect(clampZoomPercent(123.4)).toBe(123);
        expect(clampZoomPercent(123.6)).toBe(124);
    });
});

describe('clientToGraphPoint', () => {
    test('subtracts the viewport rect, unzooms, then removes the pan', () => {
        const point = clientToGraphPoint(
            { left: 10, top: 20 },
            { x: 110, y: 220 },
            { panX: 5, panY: -5, zoomPercent: 200 },
        );
        expect(point.x).toBeCloseTo(45);
        expect(point.y).toBeCloseTo(105);
    });

    test('at 100% and no pan the graph point is the local client point', () => {
        expect(
            clientToGraphPoint(
                { left: 0, top: 0 },
                { x: 30, y: 40 },
                { panX: 0, panY: 0, zoomPercent: 100 },
            ),
        ).toEqual({ x: 30, y: 40 });
    });
});

describe('adjustPanForZoom', () => {
    test('keeps the graph point at the centre still at the centre', () => {
        const viewportSize = { width: 800, height: 600 };
        const before = { panX: 40, panY: -20, zoomPercent: 100 };
        const after = adjustPanForZoom(before, 200, viewportSize);
        expect(after.zoomPercent).toBe(200);
        expect(after.panX).toBeCloseTo(-160);
        expect(after.panY).toBeCloseTo(-170);
        const centreOf = (viewport: typeof before) => {
            const scale = viewport.zoomPercent / 100;
            return {
                x: viewportSize.width / scale / 2 - viewport.panX,
                y: viewportSize.height / scale / 2 - viewport.panY,
            };
        };
        expect(centreOf(after).x).toBeCloseTo(centreOf(before).x);
        expect(centreOf(after).y).toBeCloseTo(centreOf(before).y);
    });

    test('clamps the requested zoom before using it', () => {
        const after = adjustPanForZoom(
            { panX: 0, panY: 0, zoomPercent: 100 },
            9000,
            { width: 1000, height: 500 },
        );
        expect(after.zoomPercent).toBe(500);
        // Centre (500, 250) at 500% sits 100 x 50 graph units into the view.
        expect(after.panX).toBeCloseTo(100 - 500);
        expect(after.panY).toBeCloseTo(50 - 250);
    });
});

describe('the rest of the pan and zoom maths', () => {
    test('a drag delta is divided by the scale', () => {
        expect(toGraphDelta({ x: 50, y: -30 }, 50)).toEqual({ x: 100, y: -60 });
    });

    test('zooming at a point keeps that point under the cursor', () => {
        const before = { panX: 10, panY: 20, zoomPercent: 100 };
        const anchor = { x: 200, y: 100 };
        const after = zoomAtPoint(before, 250, anchor);
        expect(after.zoomPercent).toBe(250);
        const graphBefore = {
            x: anchor.x / 1 - before.panX,
            y: anchor.y / 1 - before.panY,
        };
        expect(anchor.x / 2.5 - after.panX).toBeCloseTo(graphBefore.x);
        expect(anchor.y / 2.5 - after.panY).toBeCloseTo(graphBefore.y);
    });

    test('a wheel notch zooms in for a negative delta and out for a positive one', () => {
        expect(getWheelZoomPercent(100, -400)).toBe(272);
        expect(getWheelZoomPercent(100, 400)).toBe(37);
        expect(getWheelZoomPercent(30, 4000)).toBe(25);
    });
});
