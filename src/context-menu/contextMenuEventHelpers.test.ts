// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    createMouseEvent,
    createMouseEventUnder,
    getMenuItemAnchor,
} from './contextMenuEventHelpers';

function placeAt(element: Element, left: number, top: number) {
    element.getBoundingClientRect = () => {
        return {
            left,
            top,
            right: left + 40,
            bottom: top + 20,
            width: 40,
            height: 20,
            x: left,
            y: top,
            toJSON: () => ({}),
        };
    };
}

// The anchor is read AT the press, the way a menu item reads it.
function anchorOf(target: Element, event: Event) {
    let anchor: ReturnType<typeof getMenuItemAnchor> | undefined;
    target.addEventListener(
        event.type,
        (firedEvent) => {
            anchor = getMenuItemAnchor(firedEvent as MouseEvent);
        },
        { once: true },
    );
    target.dispatchEvent(event);
    return anchor;
}

beforeEach(() => {
    // Vitest's jsdom makes `window` the Node global, which jsdom's own
    // MouseEvent refuses as a `view`; in a page `window` is the Window.
    vi.stubGlobal('window', (globalThis as any).jsdom.window);
});

afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
});

describe('where a menu opens', () => {
    test('a menu event is a bubbling, cancelable click at the point given', () => {
        const event = createMouseEvent(12, 34);
        expect(event).toBeInstanceOf(MouseEvent);
        expect(event.type).toBe('click');
        expect([event.clientX, event.clientY]).toEqual([12, 34]);
        expect(event.bubbles).toBe(true);
        expect(event.cancelable).toBe(true);
        expect(event.view).toBe(window);
    });

    test('a menu opened by a key hangs under the control the key stands for', () => {
        const control = document.createElement('button');
        placeAt(control, 30, 50);
        const event = createMouseEventUnder(control);
        expect([event.clientX, event.clientY]).toEqual([30, 70]);
    });

    test('an item chosen by the pointer anchors the next menu at the pointer', () => {
        const item = document.createElement('div');
        placeAt(item, 5, 6);
        document.body.appendChild(item);
        expect(
            anchorOf(
                item,
                new MouseEvent('click', { clientX: 200, clientY: 0 }),
            ),
        ).toEqual({ x: 200, y: 0 });
        expect(
            anchorOf(
                item,
                new MouseEvent('click', { clientX: 0, clientY: 90 }),
            ),
        ).toEqual({ x: 0, y: 90 });
    });

    test('an item chosen by a key, or a click with no position, anchors at the item', () => {
        const item = document.createElement('div');
        placeAt(item, 70, 80);
        document.body.appendChild(item);
        expect(
            anchorOf(item, new KeyboardEvent('keydown', { key: 'Enter' })),
        ).toEqual({ x: 70, y: 80 });
        expect(anchorOf(item, new MouseEvent('click'))).toEqual({
            x: 70,
            y: 80,
        });
    });

    test('with no position and no item still in the page there is no anchor', () => {
        const gone = document.createElement('div');
        placeAt(gone, 70, 80);
        expect(
            anchorOf(gone, new KeyboardEvent('keydown', { key: 'Enter' })),
        ).toBeNull();
        expect(
            getMenuItemAnchor(new KeyboardEvent('keydown', { key: 'Enter' })),
        ).toBeNull();
    });
});
