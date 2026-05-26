// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { genSelectedTextContextMenusMock } = vi.hoisted(() => ({
    genSelectedTextContextMenusMock: vi.fn(),
}));

vi.mock('../helper/debuggerHelpers', async () => {
    const React = await vi.importActual<typeof import('react')>('react');
    return {
        useAppEffect: React.useEffect,
    };
});

vi.mock('../helper/textSelectionHelpers', () => ({
    genSelectedTextContextMenus: genSelectedTextContextMenusMock,
}));

import KeyboardEventListener from '../event/KeyboardEventListener';
import WindowEventListener from '../event/WindowEventListener';
import AppContextMenuComp, {
    elementDivider,
    genContextMenuItemIcon,
    genContextMenuItemShortcutKey,
} from './AppContextMenuComp';
import {
    APP_CONTEXT_MENU_CLASS,
    APP_CONTEXT_MENU_ID,
    APP_CONTEXT_MENU_ITEM_CLASS,
    contextControl,
    createMouseEvent,
    highlightClass,
    setPositionMenu,
    showAppContextMenu,
} from './appContextMenuHelpers';

async function flushAsyncEvents(times = 2) {
    for (let i = 0; i < times; i++) {
        await Promise.resolve();
    }
}

describe('appContextMenuHelpers', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;
    let scrollIntoViewMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        vi.useRealTimers();
        (KeyboardEventListener as any).eventHandler = null;
        (WindowEventListener as any).eventHandler = null;
        (KeyboardEventListener as any)._layers.length = 0;
        (KeyboardEventListener as any)._layers.push('root');
        contextControl.setDataDelegator = null;
        genSelectedTextContextMenusMock.mockReturnValue([]);

        Object.defineProperty(globalThis, 'innerWidth', {
            configurable: true,
            writable: true,
            value: 640,
        });
        Object.defineProperty(globalThis, 'innerHeight', {
            configurable: true,
            writable: true,
            value: 480,
        });

        scrollIntoViewMock = vi.fn();
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            configurable: true,
            value(...args: any[]) {
                scrollIntoViewMock(this, ...args);
            },
        });

        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root !== null) {
            await act(async () => {
                root?.unmount();
            });
        }
        root = null;
        container?.remove();
        container = null;
        contextControl.setDataDelegator = null;
        (KeyboardEventListener as any).eventHandler = null;
        (WindowEventListener as any).eventHandler = null;
        (KeyboardEventListener as any)._layers.length = 0;
        (KeyboardEventListener as any)._layers.push('root');
        delete (HTMLElement.prototype as any).scrollIntoView;
        vi.useRealTimers();
    });

    test('creates mouse events and positions menus in each viewport direction', () => {
        const originalMouseEvent = globalThis.MouseEvent;
        const constructedEvent = { type: 'click', clientX: 12, clientY: 34 };
        const mouseEventMock = vi.fn(function MouseEventMock() {
            return constructedEvent;
        });
        vi.stubGlobal('MouseEvent', mouseEventMock as any);

        expect(createMouseEvent(12, 34)).toBe(constructedEvent);
        expect(mouseEventMock).toHaveBeenCalledWith(
            'click',
            expect.objectContaining({
                clientX: 12,
                clientY: 34,
                bubbles: true,
                cancelable: true,
                view: globalThis.window,
            }),
        );

        vi.stubGlobal('MouseEvent', originalMouseEvent);

        const menu = document.createElement('div');
        Object.defineProperty(menu, 'getBoundingClientRect', {
            value: () => ({ width: 150, height: 120 }),
        });

        const bottomRightEvent = {
            clientX: 500,
            clientY: 420,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        };

        setPositionMenu(menu, bottomRightEvent as any);

        expect(bottomRightEvent.preventDefault).toHaveBeenCalledTimes(1);
        expect(bottomRightEvent.stopPropagation).toHaveBeenCalledTimes(1);
        expect(menu.style.display).toBe('block');
        expect(menu.style.right).toBe('140px');
        expect(menu.style.bottom).toBe('60px');
        expect(menu.style.maxWidth).toBe('210px');
        expect(menu.style.maxHeight).toBe('420px');
        expect(menu.scrollTop).toBe(0);

        const topLeftEvent = {
            clientX: 1,
            clientY: 1,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        };

        setPositionMenu(menu, topLeftEvent as any, {
            coord: { x: 20, y: 30 },
            maxHeigh: 99,
            style: { zIndex: '20' },
        });

        expect(menu.style.left).toBe('20px');
        expect(menu.style.top).toBe('30px');
        expect(menu.style.maxHeight).toBe('99px');
        expect(menu.style.zIndex).toBe('20');

        const nullMenuEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        };
        setPositionMenu(null as any, nullMenuEvent as any);
        expect(nullMenuEvent.preventDefault).not.toHaveBeenCalled();
        expect(nullMenuEvent.stopPropagation).not.toHaveBeenCalled();
    });

    test('shows empty menus as resolved no-ops and merges selected text menu items', async () => {
        const emptyEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        };

        const emptyControl = showAppContextMenu(emptyEvent as any, []);
        await expect(emptyControl.promiseDone).resolves.toBeUndefined();
        expect(emptyEvent.preventDefault).toHaveBeenCalledTimes(1);
        expect(emptyEvent.stopPropagation).toHaveBeenCalledTimes(1);

        const delegatorMock = vi.fn();
        contextControl.setDataDelegator = delegatorMock;
        const selectedMenuItem = { menuElement: 'Selected Text Item' };
        const item = { menuElement: 'Base Item' };
        genSelectedTextContextMenusMock.mockReturnValue([selectedMenuItem]);

        const registerSpy = vi.spyOn(
            KeyboardEventListener,
            'registerEventListener',
        );
        const unregisterSpy = vi.spyOn(
            KeyboardEventListener,
            'unregisterEventListener',
        );

        const control = showAppContextMenu(
            {
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
            } as any,
            [item],
            {
                shouldHandleSelectedText: true,
                extraSelectedTextContextMenuItems: [{ menuElement: 'Extra' }],
            },
        );

        expect(genSelectedTextContextMenusMock).toHaveBeenCalledWith([
            { menuElement: 'Extra' },
        ]);
        const delegatedData = delegatorMock.mock.calls[0][0];
        expect(delegatedData.items).toEqual([selectedMenuItem, item]);
        expect(registerSpy).toHaveBeenCalledOnce();

        control.closeMenu();
        expect(delegatorMock).toHaveBeenLastCalledWith(null);

        delegatedData.onClose();
        await expect(control.promiseDone).resolves.toBeUndefined();
        expect(unregisterSpy).toHaveBeenCalledOnce();
    });

    test('renders the component, applies positioning, cycles type-ahead matches, and closes through click and escape', async () => {
        const fireEventSpy = vi.spyOn(WindowEventListener, 'fireEvent');
        const firstSelectMock = vi.fn();
        const secondSelectMock = vi.fn();

        await act(async () => {
            if (container === null) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<AppContextMenuComp />);
        });

        let control: ReturnType<typeof showAppContextMenu>;
        await act(async () => {
            control = showAppContextMenu(
                {
                    clientX: 24,
                    clientY: 36,
                    preventDefault: vi.fn(),
                    stopPropagation: vi.fn(),
                } as any,
                [
                    {
                        menuElement: 'Apple',
                        onSelect: firstSelectMock,
                        keyboardShortcut: { key: 'a' },
                    },
                    {
                        menuElement: 'Banana',
                        title: 'Banana Title',
                        onSelect: secondSelectMock,
                    },
                    {
                        menuElement: 'Berry',
                        onSelect: secondSelectMock,
                    },
                    {
                        menuElement: elementDivider,
                    },
                ],
            );
            await flushAsyncEvents();
        });

        const overlay = document.getElementById(APP_CONTEXT_MENU_ID);
        const menu = overlay?.querySelector(`.${APP_CONTEXT_MENU_CLASS}`);
        const items = Array.from(
            document.querySelectorAll(`.${APP_CONTEXT_MENU_ITEM_CLASS}`),
        ) as HTMLDivElement[];

        expect(overlay).not.toBeNull();
        expect(menu?.style.left).toBe('24px');
        expect(menu?.style.top).toBe('36px');
        expect(items).toHaveLength(3);
        expect(items[0].textContent).toContain('Apple');
        expect(items[0].textContent).toContain('A');
        expect(items[1].title).toBe('Banana Title');
        expect(overlay?.querySelector('hr')).not.toBeNull();
        expect(fireEventSpy).toHaveBeenCalledWith({
            widget: 'context-menu',
            state: 'open',
        });

        scrollIntoViewMock.mockClear();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));

        expect(scrollIntoViewMock).toHaveBeenCalledTimes(2);
        expect(scrollIntoViewMock.mock.calls[0]?.[0]).toBe(items[1]);
        expect(scrollIntoViewMock.mock.calls[1]?.[0]).toBe(items[2]);

        vi.useFakeTimers();
        await act(async () => {
            items[1].click();
            await vi.runAllTimersAsync();
        });

        expect(secondSelectMock).toHaveBeenCalledTimes(1);
        await expect(control!.promiseDone).resolves.toBeUndefined();
        expect(fireEventSpy).toHaveBeenCalledWith({
            widget: 'context-menu',
            state: 'close',
        });

        let escapeControl: ReturnType<typeof showAppContextMenu>;
        await act(async () => {
            escapeControl = showAppContextMenu(
                {
                    clientX: 12,
                    clientY: 18,
                    preventDefault: vi.fn(),
                    stopPropagation: vi.fn(),
                } as any,
                [{ menuElement: 'Escape Item', onSelect: vi.fn() }],
            );
            await flushAsyncEvents();
        });

        await act(async () => {
            KeyboardEventListener.fireEvent(
                new KeyboardEvent('keydown', { key: 'Escape' }) as any,
            );
            await flushAsyncEvents();
        });
        await expect(escapeControl!.promiseDone).resolves.toBeUndefined();
    });

    test('supports arrow navigation, tab apply, enter apply, and noKeystroke mode', async () => {
        vi.useFakeTimers();
        const alphaSelectMock = vi.fn();
        const betaSelectMock = vi.fn();

        await act(async () => {
            if (container === null) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<AppContextMenuComp />);
        });

        await act(async () => {
            showAppContextMenu(
                {
                    clientX: 40,
                    clientY: 50,
                    preventDefault: vi.fn(),
                    stopPropagation: vi.fn(),
                } as any,
                [
                    { menuElement: 'Alpha', onSelect: alphaSelectMock },
                    { menuElement: 'Beta', onSelect: betaSelectMock },
                ],
                { applyOnTab: true },
            );
            await flushAsyncEvents();
        });

        let items = Array.from(
            document.querySelectorAll(`.${APP_CONTEXT_MENU_ITEM_CLASS}`),
        ) as HTMLDivElement[];
        const menu = document.querySelector(
            `#${APP_CONTEXT_MENU_ID} .${APP_CONTEXT_MENU_CLASS}`,
        ) as HTMLDivElement;
        const focusSpy = vi.spyOn(menu, 'focus');

        scrollIntoViewMock.mockClear();
        await act(async () => {
            KeyboardEventListener.fireEvent(
                new KeyboardEvent('keydown', { key: 'ArrowDown' }) as any,
            );
            await vi.advanceTimersByTimeAsync(100);
        });
        expect(items[0].classList.contains(highlightClass)).toBe(true);
        expect(scrollIntoViewMock.mock.calls[0]?.[0]).toBe(items[0]);
        expect(focusSpy).toHaveBeenCalled();

        await act(async () => {
            KeyboardEventListener.fireEvent(
                new KeyboardEvent('keydown', { key: 'ArrowUp' }) as any,
            );
            await vi.advanceTimersByTimeAsync(100);
        });
        expect(items[1].classList.contains(highlightClass)).toBe(true);

        await act(async () => {
            KeyboardEventListener.fireEvent(
                new KeyboardEvent('keydown', { key: 'Tab' }) as any,
            );
            await flushAsyncEvents();
        });
        expect(betaSelectMock).toHaveBeenCalledTimes(1);
        expect(document.getElementById(APP_CONTEXT_MENU_ID)).toBeNull();

        await act(async () => {
            showAppContextMenu(
                {
                    clientX: 44,
                    clientY: 60,
                    preventDefault: vi.fn(),
                    stopPropagation: vi.fn(),
                } as any,
                [
                    { menuElement: 'Alpha', onSelect: alphaSelectMock },
                    { menuElement: 'Beta', onSelect: betaSelectMock },
                ],
            );
            await flushAsyncEvents();
        });
        items = Array.from(
            document.querySelectorAll(`.${APP_CONTEXT_MENU_ITEM_CLASS}`),
        ) as HTMLDivElement[];
        const reopenedMenu = document.querySelector(
            `#${APP_CONTEXT_MENU_ID} .${APP_CONTEXT_MENU_CLASS}`,
        ) as HTMLDivElement;
        reopenedMenu.focus();

        await act(async () => {
            KeyboardEventListener.fireEvent(
                new KeyboardEvent('keydown', { key: 'ArrowDown' }) as any,
            );
            await vi.advanceTimersByTimeAsync(100);
            KeyboardEventListener.fireEvent(
                new KeyboardEvent('keydown', { key: 'Enter' }) as any,
            );
            await flushAsyncEvents();
        });
        expect(alphaSelectMock).toHaveBeenCalledTimes(1);

        await act(async () => {
            showAppContextMenu(
                {
                    clientX: 70,
                    clientY: 80,
                    preventDefault: vi.fn(),
                    stopPropagation: vi.fn(),
                } as any,
                [{ menuElement: 'Alpha', onSelect: alphaSelectMock }],
                { noKeystroke: true },
            );
            await flushAsyncEvents();
        });
        scrollIntoViewMock.mockClear();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
        expect(scrollIntoViewMock).toHaveBeenCalledTimes(0);
    });

    test('renders shortcut and icon helpers', () => {
        const shortcutElement = genContextMenuItemShortcutKey({ key: 'k' });
        const iconElement = genContextMenuItemIcon('copy', {
            marginLeft: '4px',
        });

        expect(shortcutElement.props.children.props.children).toBe('K');
        expect(iconElement.props.className).toBe('bi bi-copy');
        expect(iconElement.props.style).toEqual(
            expect.objectContaining({
                color: 'var(--bs-info-text-emphasis)',
                marginRight: '2px',
                marginLeft: '4px',
            }),
        );
    });
});
