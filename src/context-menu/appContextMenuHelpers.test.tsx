// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { providerMock, selectedTextMenus } = vi.hoisted(() => ({
    providerMock: {
        systemUtils: {
            isWindows: true,
            isMac: false,
            isLinux: false,
            isDev: false,
        },
    },
    selectedTextMenus: { items: [] as any[] },
}));

vi.mock('../server/appProvider', () => ({
    default: providerMock,
}));

vi.mock('../helper/helpers', () => ({
    cloneJson: <T,>(value: T) => structuredClone(value),
    getWindowDim: () => ({ width: 1000, height: 800 }),
}));

vi.mock('../helper/textSelectionHelpers', () => ({
    genSelectedTextContextMenus: () => selectedTextMenus.items,
}));

import KeyboardEventListener from '../event/KeyboardEventListener';
import WindowEventListener from '../event/WindowEventListener';
import {
    APP_CONTEXT_MENU_ID,
    APP_CONTEXT_MENU_ITEM_CLASS,
    contextControl,
    handleMenuTypeahead,
    highlightClass,
    markOverflowingMenuLabels,
    setPositionMenu,
    showAppContextMenu,
    useAppContextMenuData,
    type AppContextMenuPropsType,
} from './appContextMenuHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Stand in for `useAppContextMenuData`, which owns the real delegator: it is
 * what turns "here is a menu" into the keyboard layer, and the layer is what
 * these tests are about.
 */
function mountHost() {
    const seen: (null | AppContextMenuPropsType)[] = [];
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
        selectedTextMenus.items = [];
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

    test('selected-text items are prepended when requested', () => {
        const selected = { menuElement: 'Search selected text' };
        selectedTextMenus.items = [selected];
        const seen = mountHost();
        const regular = genItems();

        showAppContextMenu(new MouseEvent('contextmenu') as any, regular, {
            shouldHandleSelectedText: true,
            extraSelectedTextContextMenuItems: [
                { menuElement: 'Translate selection' },
            ],
        });

        expect(seen[0]?.items).toEqual([selected, ...regular]);
        contextControl.closeCurrent?.();
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
        expect(menu.style.top).toBe('450px');
        expect(menu.style.bottom).toBe('');
        expect(menu.style.maxWidth).toBe('210px');
        expect(menu.style.maxHeight).toBe('120px');
        expect(menu.style.color).toBe('red');
    });

    test('uses explicit coordinates and clamps a menu taller than the viewport', () => {
        const menu = document.createElement('div');
        vi.spyOn(menu, 'getBoundingClientRect').mockReturnValue({
            width: 100,
            height: 900,
        } as DOMRect);
        Object.assign(menu.style, { right: '1px', bottom: '2px' });
        const event = new MouseEvent('contextmenu', {
            clientX: 900,
            clientY: 700,
            cancelable: true,
        });

        setPositionMenu(menu, event, { coord: { x: 100, y: 10 } });

        expect(menu.style.left).toBe('100px');
        expect(menu.style.right).toBe('');
        expect(menu.style.bottom).toBe('');
        expect(menu.style.top).toBe('0px');
        expect(menu.style.maxHeight).toBe('800px');
    });
});

describe('markOverflowingMenuLabels', () => {
    function genLabel(html: string, scrollWidth: number, clientWidth = 180) {
        const label = document.createElement('div');
        label.className = 'app-context-menu-item-label';
        label.innerHTML = `<div class="app-context-menu-item-text">${html}</div>`;
        const text = label.firstElementChild as HTMLElement;
        Object.defineProperty(text, 'clientWidth', { value: clientWidth });
        Object.defineProperty(text, 'scrollWidth', {
            configurable: true,
            value: scrollWidth,
        });
        Object.defineProperty(text, 'offsetLeft', { value: 20 });
        const first = text.firstElementChild;
        if (first !== null) {
            Object.defineProperty(first, 'offsetLeft', { value: 30 });
        }
        return { label, text };
    }

    test('a label too long gets the scrolling line; one that fits does not', () => {
        const menu = document.createElement('div');
        const long = genLabel(
            '<span data-locale-ff="km">(AMP)  English\n Amplified</span>',
            420,
        );
        const short = genLabel('Open', 180);
        // One pixel over still draws the "…", so it needs the line too.
        const barely = genLabel('Korean (한국어) &lt;ko-KR&gt;', 181);
        menu.append(long.label, short.label, barely.label);

        markOverflowingMenuLabels(menu);
        expect(barely.label.dataset.marqueeText).toBe(
            'Korean (한국어) <ko-KR>',
        );

        // The words once: the second line is a pseudo-element, and the
        // label's own text (what an agent reads a row by) is untouched.
        expect(long.label.dataset.marqueeText).toBe('(AMP) English Amplified');
        expect(long.text.textContent).toBe('(AMP)  English\n Amplified');
        expect(
            long.label.style.getPropertyValue(
                '--app-context-menu-marquee-duration',
            ),
        ).toBe('12s');
        expect(
            long.label.style.getPropertyValue(
                '--app-context-menu-marquee-indent',
            ),
        ).toBe('10px');
        expect(long.label.dataset.localeFf).toBe('km');
        expect(short.label.dataset.marqueeText).toBeUndefined();
        expect(short.label.getAttribute('style')).toBeNull();

        // Once it fits (its font came in narrower), the line goes again.
        Object.defineProperty(long.text, 'scrollWidth', { value: 180 });
        markOverflowingMenuLabels(menu);
        expect(long.label.dataset.marqueeText).toBeUndefined();
        expect(
            long.label.style.getPropertyValue(
                '--app-context-menu-marquee-duration',
            ),
        ).toBe('');
    });

    test('a short label scrolls for at least four seconds, from its edge', () => {
        const menu = document.createElement('div');
        // A menu squeezed against the window's edge.
        const { label } = genLabel('Plain text label', 110, 60);
        menu.append(label);
        markOverflowingMenuLabels(menu);
        expect(
            label.style.getPropertyValue('--app-context-menu-marquee-duration'),
        ).toBe('4s');
        expect(
            label.style.getPropertyValue('--app-context-menu-marquee-indent'),
        ).toBe('0px');
        expect(label.dataset.localeFf).toBeUndefined();
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

    test('ignores modifiers and menu control keys without preventing them', () => {
        const modified = new KeyboardEvent('keydown', {
            key: 'o',
            ctrlKey: true,
            cancelable: true,
        });
        const named = new KeyboardEvent('keydown', {
            key: 'ArrowDown',
            cancelable: true,
        });

        handleMenuTypeahead(modified);
        handleMenuTypeahead(named);

        expect(modified.defaultPrevented).toBe(false);
        expect(named.defaultPrevented).toBe(false);
    });
});

describe('useAppContextMenuData keyboard behavior', () => {
    let host: HTMLDivElement;
    let root: Root;

    function MenuHost() {
        const data = useAppContextMenuData();
        if (data === null) {
            return null;
        }
        return (
            <div id={APP_CONTEXT_MENU_ID}>
                <div className="app-context-menu" tabIndex={0}>
                    {data.items.map((item, index) => (
                        <div
                            className={APP_CONTEXT_MENU_ITEM_CLASS}
                            key={index}
                        >
                            {item.menuElement}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    async function renderHost() {
        await act(async () => root.render(<MenuHost />));
    }

    async function fireKey(key: string) {
        const event = new KeyboardEvent('keydown', {
            key,
            cancelable: true,
        });
        await act(async () => {
            KeyboardEventListener.fireEvent(event);
            await Promise.resolve();
            await Promise.resolve();
        });
        return event;
    }

    beforeEach(async () => {
        (KeyboardEventListener as any)._layers.length = 0;
        (KeyboardEventListener as any)._layers.push('root');
        contextControl.setDataDelegator = null;
        contextControl.closeCurrent = null;
        host = document.createElement('div');
        document.body.append(host);
        root = createRoot(host);
        await renderHost();
    });

    afterEach(() => {
        act(() => {
            contextControl.closeCurrent?.();
            root.unmount();
        });
        host.remove();
        vi.useRealTimers();
        contextControl.setDataDelegator = null;
        contextControl.closeCurrent = null;
    });

    test('arrow keys move and wrap the highlight in both directions', async () => {
        vi.useFakeTimers();
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;
        let menuControl!: ReturnType<typeof showAppContextMenu>;
        await act(async () => {
            menuControl = showAppContextMenu(
                new MouseEvent('contextmenu') as any,
                [{ menuElement: 'Alpha' }, { menuElement: 'Beta' }],
            );
        });
        expect(KeyboardEventListener.getLastLayer()).toBe('context-menu');

        const highlightedIndex = () => {
            return Array.from(
                host.querySelectorAll(`.${APP_CONTEXT_MENU_ITEM_CLASS}`),
            ).findIndex((item) => item.classList.contains(highlightClass));
        };

        await fireKey('ArrowDown');
        expect(highlightedIndex()).toBe(0);
        await fireKey('ArrowDown');
        expect(highlightedIndex()).toBe(1);
        await fireKey('ArrowDown');
        expect(highlightedIndex()).toBe(0);
        await fireKey('ArrowUp');
        expect(highlightedIndex()).toBe(1);
        await act(async () => vi.advanceTimersByTimeAsync(100));
        expect(scrollIntoView).toHaveBeenCalled();

        act(() => contextControl.closeCurrent?.());
        expect(KeyboardEventListener.getLastLayer()).toBe('root');
        await expect(menuControl.promiseDone).resolves.toBeUndefined();
    });

    test('Tab applies the first item when none is highlighted and closes', async () => {
        const select = vi.fn();
        let menuControl!: ReturnType<typeof showAppContextMenu>;
        await act(async () => {
            menuControl = showAppContextMenu(
                new MouseEvent('contextmenu') as any,
                [{ menuElement: 'Run', onSelect: select }],
                { applyOnTab: true },
            );
        });

        const event = await fireKey('Tab');

        expect(event.defaultPrevented).toBe(true);
        expect(select).toHaveBeenCalledOnce();
        expect(KeyboardEventListener.getLastLayer()).toBe('root');
        await expect(menuControl.promiseDone).resolves.toBeUndefined();
    });

    test('Tab consumes a disabled item without selecting it', async () => {
        const select = vi.fn();
        let menuControl!: ReturnType<typeof showAppContextMenu>;
        await act(async () => {
            menuControl = showAppContextMenu(
                new MouseEvent('contextmenu') as any,
                [
                    {
                        menuElement: 'Unavailable',
                        disabled: true,
                        onSelect: select,
                    },
                ],
                { applyOnTab: true },
            );
        });

        const event = await fireKey('Tab');

        expect(event.defaultPrevented).toBe(true);
        expect(select).not.toHaveBeenCalled();
        expect(KeyboardEventListener.getLastLayer()).toBe('root');
        await expect(menuControl.promiseDone).resolves.toBeUndefined();
    });

    test('Enter acts only when the menu container is focused', async () => {
        vi.useFakeTimers();
        const select = vi.fn();
        let menuControl!: ReturnType<typeof showAppContextMenu>;
        await act(async () => {
            menuControl = showAppContextMenu(
                new MouseEvent('contextmenu') as any,
                [{ menuElement: 'Run', onSelect: select }],
            );
        });
        const menu = host.querySelector('.app-context-menu') as HTMLElement;

        const unfocused = await fireKey('Enter');
        expect(unfocused.defaultPrevented).toBe(false);
        expect(select).not.toHaveBeenCalled();

        menu.focus();
        await fireKey('ArrowDown');
        await act(async () => vi.advanceTimersByTimeAsync(100));
        const focused = await fireKey('Enter');
        expect(focused.defaultPrevented).toBe(true);
        expect(select).toHaveBeenCalledOnce();
        await expect(menuControl.promiseDone).resolves.toBeUndefined();
    });

    test('noKeystroke disables document typeahead while retaining menu keys', async () => {
        vi.useFakeTimers();
        let menuControl!: ReturnType<typeof showAppContextMenu>;
        await act(async () => {
            menuControl = showAppContextMenu(
                new MouseEvent('contextmenu') as any,
                [{ menuElement: 'Alpha' }, { menuElement: 'Beta' }],
                { noKeystroke: true },
            );
        });

        const typeahead = new KeyboardEvent('keydown', {
            key: 'b',
            cancelable: true,
        });
        document.dispatchEvent(typeahead);
        expect(typeahead.defaultPrevented).toBe(false);
        expect(
            host
                .querySelector(`.${APP_CONTEXT_MENU_ITEM_CLASS}`)
                ?.classList.contains(highlightClass),
        ).toBe(false);

        const arrow = await fireKey('ArrowDown');
        expect(arrow.defaultPrevented).toBe(true);
        act(() => contextControl.closeCurrent?.());
        await expect(menuControl.promiseDone).resolves.toBeUndefined();
    });

    test('document typeahead is removed when the menu closes', async () => {
        vi.useFakeTimers();
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;
        let menuControl!: ReturnType<typeof showAppContextMenu>;
        await act(async () => {
            menuControl = showAppContextMenu(
                new MouseEvent('contextmenu') as any,
                [{ menuElement: 'Alpha' }, { menuElement: 'Beta' }],
            );
        });

        const chooseBeta = new KeyboardEvent('keydown', {
            key: 'b',
            cancelable: true,
        });
        await act(async () => document.dispatchEvent(chooseBeta));
        expect(chooseBeta.defaultPrevented).toBe(true);
        expect(
            host
                .querySelectorAll(`.${APP_CONTEXT_MENU_ITEM_CLASS}`)[1]
                .classList.contains(highlightClass),
        ).toBe(true);
        await act(async () => vi.advanceTimersByTimeAsync(100));
        expect(scrollIntoView).toHaveBeenCalled();

        act(() => contextControl.closeCurrent?.());
        const afterClose = new KeyboardEvent('keydown', {
            key: 'a',
            cancelable: true,
        });
        document.dispatchEvent(afterClose);
        expect(afterClose.defaultPrevented).toBe(false);
        await expect(menuControl.promiseDone).resolves.toBeUndefined();
    });
});
