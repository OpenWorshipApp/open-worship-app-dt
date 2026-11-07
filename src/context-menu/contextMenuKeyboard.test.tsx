// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

// The real menu host, the real helpers and the real keyboard layer: the
// other menu tests stand a host in for `useAppContextMenuData`, so none of
// them proved that Escape, pressed with a menu open, reaches the listener the
// menu registered under its own layer.
vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isWindows: true, isMac: false, isLinux: false },
        pathUtils: { sep: '/' },
    },
}));

import AppContextMenuComp from './AppContextMenuComp';
import { showAppContextMenu } from './appContextMenuHelpers';
import KeyboardEventListener from '../event/KeyboardEventListener';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(async () => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root.render(<AppContextMenuComp />));
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
});

async function openMenu(onSelect = vi.fn()) {
    let isDone = false;
    await act(async () => {
        const { promiseDone } = showAppContextMenu(
            new MouseEvent('contextmenu', { clientX: 10, clientY: 10 }) as any,
            [{ menuElement: 'Reset Size', onSelect }],
        );
        promiseDone.then(() => {
            isDone = true;
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
    });
    return () => isDone;
}

async function pressKey(key: string) {
    await act(async () => {
        document.dispatchEvent(
            new KeyboardEvent('keydown', { key, code: key, bubbles: true }),
        );
        // The keyboard layer dispatches on microtasks after an awaited check.
        await new Promise((resolve) => setTimeout(resolve, 25));
    });
}

test('Escape closes an open menu, chooses nothing and gives the keyboard back', async () => {
    const onSelect = vi.fn();
    const checkIsDone = await openMenu(onSelect);
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    expect(KeyboardEventListener.getLastLayer()).toBe('context-menu');

    await pressKey('Escape');

    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(checkIsDone()).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
    expect(KeyboardEventListener.getLastLayer()).toBe('root');
});

test('a key the menu does not answer leaves it open', async () => {
    const checkIsDone = await openMenu();

    await pressKey('F2');

    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    expect(checkIsDone()).toBe(false);
    await pressKey('Escape');
    expect(document.querySelector('[role="menu"]')).toBeNull();
});
