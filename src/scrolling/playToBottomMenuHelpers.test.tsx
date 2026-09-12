// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest';

// The menu labels are not what is under test, and `tran` throws in dev on a key
// the Khmer dictionary has not learned yet.
vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

// Pulled in transitively by the context-menu module this one imports; it reads
// its own source object at module scope, so it has to answer before then.
vi.mock('../server/appProvider', () => ({
    default: {
        isPageReader: false,
        isPagePresenter: false,
        isPageScreen: false,
        isMainPage: false,
        systemUtils: { isDev: true },
        messageUtils: { sendData: vi.fn(), listenForData: vi.fn() },
        appInfo: { version: '1.0.0' },
        pathUtils: { sep: '/', join: (...parts: string[]) => parts.join('/') },
        fileUtils: { watch: vi.fn() },
    },
}));

// Reached through the same chain; nothing here reads a setting.
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        defaultStorage: '/data',
        localStorageDir: '/data/local-storage',
        getItem: () => null,
        setItem: vi.fn(),
    },
}));

import { genPlayToBottomContextMenuItems } from './playToBottomMenuHelpers';

function genPlayElement(speed?: string) {
    const element = document.createElement('i');
    if (speed !== undefined) {
        element.dataset['speed'] = speed;
    }
    return element;
}

function recordGestures(element: HTMLElement) {
    const gestures: { type: string; altKey: boolean }[] = [];
    for (const type of ['click', 'dblclick', 'contextmenu']) {
        element.addEventListener(type, (event) => {
            gestures.push({ type, altKey: (event as MouseEvent).altKey });
        });
    }
    return gestures;
}

describe('the auto-scroll menu', () => {
    test('reads the speed the button is carrying', () => {
        const items = genPlayToBottomContextMenuItems(genPlayElement('0.21'));
        expect(items[0]?.menuElement).toBe('Auto Scroll Speed');
        // A readout, not an action: no `onSelect` is how the menu draws an item
        // disabled.
        expect(items[0]?.onSelect).toBeUndefined();
    });

    test('reads a stopped button as zero rather than NaN', () => {
        const items = genPlayToBottomContextMenuItems(genPlayElement(''));
        expect(items[0]?.onSelect).toBeUndefined();
        expect(JSON.stringify(items[0]?.childAfter)).toContain('0.00');
    });

    // Every action fires the gesture itself, so the menu can never drift from
    // what the mouse does.
    test('fires the real gesture for each action', () => {
        const playElement = genPlayElement('0.21');
        document.body.append(playElement);
        const gestures = recordGestures(playElement);
        const items = genPlayToBottomContextMenuItems(playElement);

        for (const item of items) {
            item.onSelect?.(new MouseEvent('click'));
        }

        expect(gestures).toEqual([
            { type: 'click', altKey: false },
            { type: 'dblclick', altKey: false },
            { type: 'contextmenu', altKey: false },
            { type: 'contextmenu', altKey: true },
        ]);
        playElement.remove();
    });

    test('names the gesture beside every action', () => {
        const items = genPlayToBottomContextMenuItems(genPlayElement('0.21'));
        const hints = items
            .filter((item) => item.onSelect !== undefined)
            .map((item) => JSON.stringify(item.childAfter));
        expect(hints).toHaveLength(4);
        expect(hints[0]).toContain('Click');
        expect(hints[1]).toContain('Double Click');
        expect(hints[2]).toContain('Right Click');
        expect(hints[3]).toContain('Alt + Right Click');
    });
});
