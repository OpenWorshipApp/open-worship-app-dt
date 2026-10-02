// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { providerMock } = vi.hoisted(() => ({
    providerMock: {
        systemUtils: {
            isWindows: true,
            isMac: false,
            isLinux: false,
            isDev: false,
        },
    },
}));

vi.mock('../server/appProvider', () => ({
    default: providerMock,
}));

vi.mock('../helper/helpers', () => ({
    cloneJson: <T,>(value: T) => structuredClone(value),
    getWindowDim: () => ({ width: 1000, height: 800 }),
}));

vi.mock('../helper/textSelectionHelpers', () => ({
    genSelectedTextContextMenus: () => [],
}));

import KeyboardEventListener from '../event/KeyboardEventListener';
import WindowEventListener from '../event/WindowEventListener';
import {
    APP_CONTEXT_MENU_ID,
    APP_CONTEXT_MENU_ITEM_CLASS,
    contextControl,
    handleMenuTypeahead,
    highlightClass,
    setPositionMenu,
    showAppContextMenu,
} from './appContextMenuHelpers';

/**
 * Stand in for `useAppContextMenuData`, which owns the real delegator: it is
 * what turns "here is a menu" into the keyboard layer, and the layer is what
 * these tests are about.
 */
function mountHost() {
    const seen: (null | { onClose: () => void })[] = [];
    contextControl.setDataDelegator = (data) => {
        WindowEventListener.fireEvent({
            widget: 'context-menu',
            state: data === null ? 'close' : 'open',
        });
        seen.push(data);
    };
    return seen;
}

function genItems() {
    return [{ menuElement: 'Do something', onSelect: () => {} }];
}

describe('showAppContextMenu', () => {
    beforeEach(() => {
        (KeyboardEventListener as any)._layers.length = 0;
        (KeyboardEventListener as any)._layers.push('root');
        contextControl.setDataDelegator = null;
        contextControl.closeCurrent = null;
    });

    test('one menu opened and closed leaves the keyboard on root', () => {
        mountHost();
        const control = showAppContextMenu(
            new MouseEvent('contextmenu') as any,
            genItems(),
        );
        expect(KeyboardEventListener.getLastLayer()).toBe('context-menu');

        control.closeMenu();
        expect(KeyboardEventListener.getLastLayer()).toBe('root');
    });

    test('a second menu replaces the first rather than stacking on it', () => {
        // Menu items are often built asynchronously (a clipboard read, a file
        // read), so two right-clicks both reach here before either menu -- and
        // therefore its full-window backdrop, the thing that normally swallows
        // the second press -- exists. Reproduced live on 2026-09-28: two quick
        // right-clicks on the slides previewer left
        // `['root', 'context-menu', 'context-menu']`, and with the top layer
        // stuck there EVERY root shortcut (Ctrl+B, F5-F10, the slide arrows)
        // was dead for the rest of the session.
        const seen = mountHost();
        showAppContextMenu(new MouseEvent('contextmenu') as any, genItems());
        showAppContextMenu(new MouseEvent('contextmenu') as any, genItems());
        showAppContextMenu(new MouseEvent('contextmenu') as any, genItems());

        // Each later menu closed the one before it, so the host was told.
        expect(seen.filter((data) => data === null)).toHaveLength(2);
        expect((KeyboardEventListener as any)._layers).toEqual([
            'root',
            'context-menu',
        ]);

        contextControl.closeCurrent?.();
        expect(KeyboardEventListener.getLastLayer()).toBe('root');
        expect(contextControl.closeCurrent).toBe(null);
    });

    test('a replaced menu resolves its own promise and unhooks Escape', async () => {
        mountHost();
        const first = showAppContextMenu(
            new MouseEvent('contextmenu') as any,
            genItems(),
        );
        const unregisterSpy = vi.spyOn(
            KeyboardEventListener,
            'unregisterEventListener',
        );
        showAppContextMenu(new MouseEvent('contextmenu') as any, genItems());

        await expect(first.promiseDone).resolves.toBeUndefined();
        expect(unregisterSpy).toHaveBeenCalledTimes(1);
        unregisterSpy.mockRestore();
    });

    test('an empty menu opens nothing and takes no layer', () => {
        const seen = mountHost();
        showAppContextMenu(new MouseEvent('contextmenu') as any, []);
        expect(seen).toHaveLength(0);
        expect(KeyboardEventListener.getLastLayer()).toBe('root');
    });

    test('positions an overflowing menu inward and honours an explicit height', () => {
        const menu = document.createElement('div');
        vi.spyOn(menu, 'getBoundingClientRect').mockReturnValue({
            width: 300,
            height: 250,
        } as DOMRect);
        const event = new MouseEvent('contextmenu', {
            clientX: 900,
            clientY: 700,
            cancelable: true,
        });
        setPositionMenu(menu, event, {
            maxHeigh: 120,
            style: { color: 'red' },
        });
        expect(event.defaultPrevented).toBe(true);
        expect(menu.style.right).toBe('100px');
        expect(menu.style.bottom).toBe('100px');
        expect(menu.style.maxWidth).toBe('210px');
        expect(menu.style.maxHeight).toBe('120px');
        expect(menu.style.color).toBe('red');
    });
});

describe('handleMenuTypeahead', () => {
    test('a letter highlights the next item starting with it', () => {
        // The highlight scrolls the item into view a moment later; jsdom has
        // no layout to scroll.
        vi.useFakeTimers();
        Element.prototype.scrollIntoView = vi.fn();
        document.body.innerHTML =
            `<div id="${APP_CONTEXT_MENU_ID}">` +
            ['Open', 'Copy', 'Close', 'Delete']
                .map((label) => {
                    // The leading gap is the icon's: it is in textContent.
                    return `<div class="${APP_CONTEXT_MENU_ITEM_CLASS}"> ${label}</div>`;
                })
                .join('') +
            '</div>';
        const items = Array.from(
            document.querySelectorAll(`.${APP_CONTEXT_MENU_ITEM_CLASS}`),
        );
        const highlighted = () => {
            return items.findIndex((item) => {
                return item.classList.contains(highlightClass);
            });
        };
        handleMenuTypeahead(new KeyboardEvent('keydown', { key: 'c' }));
        expect(highlighted()).toBe(1);
        handleMenuTypeahead(new KeyboardEvent('keydown', { key: 'C' }));
        expect(highlighted()).toBe(2);
        // Wraps round to the first match again.
        handleMenuTypeahead(new KeyboardEvent('keydown', { key: 'c' }));
        expect(highlighted()).toBe(1);
        handleMenuTypeahead(new KeyboardEvent('keydown', { key: 'x' }));
        expect(highlighted()).toBe(1);
        vi.runAllTimers();
        expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
        vi.useRealTimers();
        document.body.innerHTML = '';
    });
});
