// @vitest-environment jsdom
// jsdom because `floatingWidgetHelpers` pulls in `settingHelpers`, which pulls
// in `appProvider` and touches `document` at module scope.

import { describe, expect, test } from 'vitest';

import {
    FLOATING_WIDGET_MAX_Z_OFFSET,
    bringFloatingWidgetToFront,
    registerFloatingWidget,
} from './floatingWidgetHelpers';

// Each widget only ever hears its OWN offset, so the fixture keeps the last one
// it was told — exactly what the component holds in state.
function genWidget() {
    const widget = {
        zIndexOffset: -1,
        listener: (nextOffset: number) => {
            widget.zIndexOffset = nextOffset;
        },
    };
    return widget;
}

describe('floating widget stacking', () => {
    test('the newest widget is on top and the older ones step down', () => {
        const first = genWidget();
        const second = genWidget();
        const unregisterFirst = registerFloatingWidget(first.listener);
        const unregisterSecond = registerFloatingWidget(second.listener);

        expect(second.zIndexOffset).toBe(FLOATING_WIDGET_MAX_Z_OFFSET);
        expect(first.zIndexOffset).toBe(FLOATING_WIDGET_MAX_Z_OFFSET - 1);

        unregisterSecond();
        // The one left is alone again, so it goes back to the top of the band.
        expect(first.zIndexOffset).toBe(FLOATING_WIDGET_MAX_Z_OFFSET);
        unregisterFirst();
    });

    test('the focused widget is raised above its siblings', () => {
        const first = genWidget();
        const second = genWidget();
        const unregisterFirst = registerFloatingWidget(first.listener);
        const unregisterSecond = registerFloatingWidget(second.listener);

        bringFloatingWidgetToFront(first.listener);
        expect(first.zIndexOffset).toBe(FLOATING_WIDGET_MAX_Z_OFFSET);
        expect(second.zIndexOffset).toBe(FLOATING_WIDGET_MAX_Z_OFFSET - 1);

        bringFloatingWidgetToFront(second.listener);
        expect(second.zIndexOffset).toBe(FLOATING_WIDGET_MAX_Z_OFFSET);
        expect(first.zIndexOffset).toBe(FLOATING_WIDGET_MAX_Z_OFFSET - 1);

        unregisterFirst();
        unregisterSecond();
    });

    test('more widgets than the band tie at the floor, never at the top', () => {
        const widgets = Array.from(
            { length: FLOATING_WIDGET_MAX_Z_OFFSET + 3 },
            () => {
                return genWidget();
            },
        );
        const unregisterList = widgets.map((widget) => {
            return registerFloatingWidget(widget.listener);
        });

        const offsets = widgets.map((widget) => {
            return widget.zIndexOffset;
        });
        // The last three registered still stack, the oldest ones share the floor.
        expect(offsets.slice(-3)).toEqual([
            FLOATING_WIDGET_MAX_Z_OFFSET - 2,
            FLOATING_WIDGET_MAX_Z_OFFSET - 1,
            FLOATING_WIDGET_MAX_Z_OFFSET,
        ]);
        expect(offsets.slice(0, 3)).toEqual([0, 0, 0]);

        for (const unregister of unregisterList) {
            unregister();
        }
    });

    test('an unregistered widget cannot reorder the live ones', () => {
        const live = genWidget();
        const gone = genWidget();
        const unregisterLive = registerFloatingWidget(live.listener);
        registerFloatingWidget(gone.listener)();

        bringFloatingWidgetToFront(gone.listener);
        expect(live.zIndexOffset).toBe(FLOATING_WIDGET_MAX_Z_OFFSET);
        unregisterLive();
    });
});
