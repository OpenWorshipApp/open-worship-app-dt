// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('../helper/settingHelpers', () => ({
    getSetting: vi.fn(),
    setSetting: vi.fn(),
}));

import { getInitialWidgetRect } from './floatingWidgetHelpers';

// jsdom lays nothing out: the viewport is its 1024x768 window, and a pane's
// box is whatever the test says it is.
function addPane(
    attributes: Record<string, string>,
    box: { left: number; top: number; width: number; height: number },
) {
    const element = document.createElement('div');
    for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }
    element.getBoundingClientRect = () => {
        return {
            ...box,
            x: box.left,
            y: box.top,
            right: box.left + box.width,
            bottom: box.top + box.height,
            toJSON: () => box,
        };
    };
    document.body.appendChild(element);
    return element;
}

const MINI_SCREEN_BOX = { left: 700, top: 300, width: 324, height: 468 };

describe('getInitialWidgetRect', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test("a widget's first spot is the window's top-right corner", () => {
        expect(getInitialWidgetRect({})).toEqual({
            left: 640,
            top: 64,
            width: 360,
            height: 240,
        });
    });

    test('a widget that would cover the Mini Screen opens beside it instead', () => {
        addPane(
            { 'data-fs': 'v2', 'data-widget-name': 'Mini Screen' },
            MINI_SCREEN_BOX,
        );

        // Was left 640: a Countdown opened over the live preview, and the
        // person starting it lost sight of what the room was seeing.
        expect(getInitialWidgetRect({ height: 500 })).toEqual({
            left: 324,
            top: 64,
            width: 360,
            height: 500,
        });
        // Several opened at once still fan out from that spot.
        expect(
            getInitialWidgetRect({ height: 500, initialOffset: 20 }),
        ).toMatchObject({ left: 304, top: 84 });
    });

    test('a widget that ends above the Mini Screen keeps the corner', () => {
        addPane(
            { 'data-fs': 'v2', 'data-widget-name': 'Mini Screen' },
            MINI_SCREEN_BOX,
        );

        expect(getInitialWidgetRect({ height: 200 })).toMatchObject({
            left: 640,
            top: 64,
        });
    });

    test('a collapsed Mini Screen strip is not kept clear', () => {
        // The strip carries the pane's name but no `data-fs`, and shows
        // nothing to lose sight of.
        addPane({ 'data-widget-name': 'Mini Screen' }, MINI_SCREEN_BOX);

        expect(getInitialWidgetRect({ height: 500 })).toMatchObject({
            left: 640,
        });
    });

    test('with no room beside it, the widget stays rather than leave the window', () => {
        addPane(
            { 'data-fs': 'v2', 'data-widget-name': 'Mini Screen' },
            { left: 200, top: 40, width: 824, height: 728 },
        );

        expect(getInitialWidgetRect({ height: 500 })).toMatchObject({
            left: 640,
            top: 64,
        });
    });
});
