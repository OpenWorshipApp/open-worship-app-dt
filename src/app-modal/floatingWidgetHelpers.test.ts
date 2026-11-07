// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('../helper/settingHelpers', () => ({
    getSetting: vi.fn(),
    setSetting: vi.fn(),
}));

import { getSetting } from '../helper/settingHelpers';
import {
    bringFloatingWidgetToFront,
    checkAreChildrenOnscreen,
    FLOATING_WIDGET_MAX_Z_OFFSET,
    getInitialWidgetRect,
    getMaximizedWidgetRect,
    isIgnored,
    readPersistedRect,
    registerFloatingWidget,
    resizeWidgetRect,
} from './floatingWidgetHelpers';

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

describe('the widget stack', () => {
    test('the newest widget is on top, and a press brings an older one back up', () => {
        const offsets = { a: -1, b: -1, c: -1 };
        const a = vi.fn((offset: number) => {
            offsets.a = offset;
        });
        const b = vi.fn((offset: number) => {
            offsets.b = offset;
        });
        const c = vi.fn((offset: number) => {
            offsets.c = offset;
        });
        const unregisterA = registerFloatingWidget(a);
        expect(offsets.a).toBe(FLOATING_WIDGET_MAX_Z_OFFSET);
        const unregisterB = registerFloatingWidget(b);
        const unregisterC = registerFloatingWidget(c);
        expect([offsets.a, offsets.b, offsets.c]).toEqual([7, 8, 9]);

        bringFloatingWidgetToFront(a);
        expect([offsets.a, offsets.b, offsets.c]).toEqual([9, 7, 8]);

        // Already on top, or no widget at all: nobody is told anything.
        a.mockClear();
        b.mockClear();
        c.mockClear();
        bringFloatingWidgetToFront(a);
        bringFloatingWidgetToFront(() => {});
        expect(a).not.toHaveBeenCalled();
        expect(b).not.toHaveBeenCalled();
        expect(c).not.toHaveBeenCalled();

        unregisterA();
        expect([offsets.b, offsets.c]).toEqual([8, 9]);
        b.mockClear();
        unregisterA();
        expect(b).not.toHaveBeenCalled();
        unregisterB();
        unregisterC();
    });
});

describe('the viewport outside a browser', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('a page with no window fills a default-sized one', () => {
        vi.stubGlobal('window', undefined);
        expect(getMaximizedWidgetRect()).toEqual({
            left: 8,
            top: 8,
            width: 360,
            height: 240,
        });
    });
});

describe('resizing from the left and top edges', () => {
    const start = { left: 300, top: 200, width: 400, height: 300 };

    test('the opposite edge stays where it was', () => {
        expect(resizeWidgetRect(start, 'left', 100, 0, {})).toEqual({
            left: 400,
            top: 200,
            width: 300,
            height: 300,
        });
        expect(resizeWidgetRect(start, 'top', 0, 100, {})).toEqual({
            left: 300,
            top: 300,
            width: 400,
            height: 200,
        });
        expect(resizeWidgetRect(start, 'top-left', -50, -40, {})).toEqual({
            left: 250,
            top: 160,
            width: 450,
            height: 340,
        });
    });

    test('shrunk past its minimum, the edge stops at the minimum', () => {
        expect(resizeWidgetRect(start, 'top-left', 1000, 1000, {})).toEqual({
            left: 700 - 220,
            top: 500 - 140,
            width: 220,
            height: 140,
        });
    });
});

describe('a Mini Screen pane with no box', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('is not kept clear', () => {
        addPane(
            { 'data-fs': 'mini', 'data-widget-name': 'Mini Screen' },
            { left: 700, top: 0, width: 0, height: 400 },
        );
        expect(getInitialWidgetRect({})).toEqual({
            left: 640,
            top: 64,
            width: 360,
            height: 240,
        });
    });
});

describe('saved rects and no-drag parts', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('a malformed or partial saved rect is not believed', () => {
        vi.mocked(getSetting).mockReturnValue('{not json');
        expect(readPersistedRect('notes')).toBeNull();
        vi.mocked(getSetting).mockReturnValue(
            JSON.stringify({ left: 1, top: 2, width: 'wide', height: 4 }),
        );
        expect(readPersistedRect('notes')).toBeNull();
        vi.mocked(getSetting).mockReturnValue(
            JSON.stringify({ left: 1, top: 2, width: 3, height: 4, x: 9 }),
        );
        expect(readPersistedRect('notes')).toEqual({
            left: 1,
            top: 2,
            width: 3,
            height: 4,
        });
    });

    test('a press in a no-drag part of a widget is ignored, the widget never is', () => {
        document.body.innerHTML =
            '<div class="floating-widget">' +
            '<div data-no-widget-drag="true"><span id="inside"></span></div>' +
            '<span id="free"></span></div>';
        expect(isIgnored(document.getElementById('inside'))).toBe(true);
        expect(isIgnored(document.getElementById('free'))).toBe(false);
        expect(isIgnored(document.querySelector('.floating-widget'))).toBe(
            false,
        );
        expect(isIgnored(null)).toBe(false);
    });
});

describe('checkAreChildrenOnscreen', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('marks a widget holding something on screen, and only on a change', async () => {
        document.body.innerHTML =
            '<div class="floating-widget"><div id="row"><span id="icon">' +
            '</span></div></div><div id="elsewhere"></div>';
        const widgetElement =
            document.querySelector<HTMLElement>('.floating-widget')!;
        const row = document.getElementById('row')!;
        row.classList.add('app-on-screen');
        // With no widget open nothing is even looked at.
        checkAreChildrenOnscreen(row, 'attr-modified');
        expect(widgetElement.dataset.hasOnscreenChild).toBeUndefined();

        const unregister = registerFloatingWidget(() => {});
        checkAreChildrenOnscreen(document.createTextNode('x'), 'added');
        checkAreChildrenOnscreen(widgetElement, 'attr-modified');
        checkAreChildrenOnscreen(row, 'removed');
        checkAreChildrenOnscreen(
            document.getElementById('elsewhere')!,
            'added',
        );
        expect(widgetElement.dataset.hasOnscreenChild).toBeUndefined();

        const records: MutationRecord[] = [];
        const observer = new MutationObserver((list) => {
            records.push(...list);
        });
        observer.observe(widgetElement, { attributes: true });
        checkAreChildrenOnscreen(row, 'attr-modified');
        expect(widgetElement.dataset.hasOnscreenChild).toBe('true');
        checkAreChildrenOnscreen(row, 'added');
        await Promise.resolve();
        expect(records).toHaveLength(1);

        row.classList.remove('app-on-screen');
        checkAreChildrenOnscreen(row, 'attr-modified');
        expect(widgetElement.dataset.hasOnscreenChild).toBe('false');
        // A screen icon inside counts as well.
        document.getElementById('icon')!.dataset.screenIconId = '1';
        checkAreChildrenOnscreen(row, 'added');
        expect(widgetElement.dataset.hasOnscreenChild).toBe('true');
        observer.disconnect();
        unregister();
    });
});
