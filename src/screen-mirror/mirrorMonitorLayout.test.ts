import { describe, expect, test } from 'vitest';

import { layoutMirrorMonitors } from './mirrorMonitorLayout';

function toDisplay(id: number, x: number, y: number, w: number, h: number) {
    return { id, bounds: { x, y, width: w, height: h } };
}

describe('layoutMirrorMonitors', () => {
    test('nothing to draw without a monitor', () => {
        expect(layoutMirrorMonitors([], null, 168, 64)).toEqual({
            width: 0,
            height: 0,
            boxes: [],
        });
    });

    test('a single 16:9 monitor fills the height of the box', () => {
        const layout = layoutMirrorMonitors(
            [toDisplay(1, 0, 0, 1920, 1080)],
            1,
            168,
            64,
        );
        expect(layout.height).toBe(64);
        expect(layout.width).toBe(114);
        expect(layout.boxes).toEqual([
            {
                id: 1,
                left: 0,
                top: 0,
                width: 114,
                height: 64,
                resolution: '1920×1080',
                isPrimary: true,
            },
        ]);
    });

    test('monitors keep the arrangement the operating system gives them', () => {
        // A primary at the origin and a second one to its LEFT, lower down:
        // negative coordinates are normal on Windows.
        const layout = layoutMirrorMonitors(
            [
                toDisplay(1, 0, 0, 1920, 1080),
                toDisplay(2, -1280, 300, 1280, 720),
            ],
            1,
            168,
            64,
        );
        const [primary, second] = layout.boxes;
        expect(second.left).toBe(0);
        expect(primary.left).toBeGreaterThan(second.width - 1);
        expect(second.top).toBeGreaterThan(primary.top);
        expect(layout.width).toBeLessThanOrEqual(168);
        expect(layout.height).toBeLessThanOrEqual(64);
        expect(primary.isPrimary).toBe(true);
        expect(second.isPrimary).toBe(false);
        expect(second.resolution).toBe('1280×720');
    });
});
