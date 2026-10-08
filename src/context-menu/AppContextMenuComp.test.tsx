// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: { data: null as any },
    mocks: {
        position: vi.fn(),
        currentRef: <T,>(value: T) => ({ current: value }),
    },
}));
vi.mock('../helper/appHooks', () => ({ useAppCurrentRef: mocks.currentRef }));
vi.mock('./appContextMenuHelpers', () => ({
    APP_CONTEXT_MENU_ID: 'app-context-menu-container',
    APP_CONTEXT_MENU_ITEM_CLASS: 'app-context-menu-item',
    setPositionMenu: mocks.position,
    useAppContextMenuData: () => state.data,
}));
vi.mock('../event/KeyboardEventListener', () => ({
    toShortcutKey: () => 'Ctrl + K',
}));
import AppContextMenuComp from './AppContextMenuComp';

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    vi.clearAllMocks();
});
afterEach(() => {
    act(() => root.unmount());
    host.remove();
    state.data = null;
    vi.restoreAllMocks();
    Reflect.deleteProperty(document, 'fullscreenElement');
});

test('keeps a fullscreen graph menu visible and selectable, then returns it on exit', async () => {
    const graph = document.createElement('div');
    document.body.append(graph);
    let fullscreenElement: Element | null = graph;
    Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => fullscreenElement,
    });
    const select = vi.fn();
    const close = vi.fn();
    state.data = {
        event: new MouseEvent('click', { clientX: 400, clientY: 40 }),
        onClose: close,
        items: [{ menuElement: 'Save preset', onSelect: select }],
    };
    try {
        await act(async () => root.render(<AppContextMenuComp />));
        expect(host.querySelector('[role="menu"]')).toBeNull();
        const item = graph.querySelector('[role="menuitem"]');
        expect(item?.textContent).toBe('Save preset');
        await act(async () => {
            (item as HTMLElement).click();
            await new Promise((resolve) => setTimeout(resolve));
        });
        expect(close).toHaveBeenCalledOnce();
        expect(select).toHaveBeenCalledOnce();

        await act(async () => {
            fullscreenElement = null;
            document.dispatchEvent(new Event('fullscreenchange'));
        });
        expect(graph.querySelector('[role="menu"]')).toBeNull();
        expect(host.querySelector('[role="menuitem"]')?.textContent).toBe(
            'Save preset',
        );
    } finally {
        graph.remove();
    }
});

test('renders an accessible menu, positions it, and closes before selecting an enabled item', async () => {
    const close = vi.fn();
    const select = vi.fn();
    state.data = {
        event: new MouseEvent('contextmenu'),
        onClose: close,
        options: { shouldAutoFocusContainer: true },
        items: [
            {
                menuElement: 'Open',
                onSelect: select,
                keyboardShortcut: { key: 'k' },
            },
            { menuElement: 'Unavailable', disabled: true, onSelect: vi.fn() },
        ],
    };
    await act(async () => root.render(<AppContextMenuComp />));
    const menu = host.querySelector('[role="menu"]') as HTMLDivElement;
    expect(menu).not.toBeNull();
    expect(mocks.position).toHaveBeenCalledWith(
        menu,
        state.data.event,
        state.data.options,
    );
    const items = host.querySelectorAll('[role="menuitem"]');
    expect(items).toHaveLength(2);
    expect(items[1].getAttribute('aria-disabled')).toBe('true');
    expect(items[0].textContent).toContain('Ctrl + K');
    await act(async () => (items[0] as HTMLDivElement).click());
    await new Promise((resolve) => setTimeout(resolve));
    expect(close).toHaveBeenCalledOnce();
    expect(select).toHaveBeenCalledOnce();
});
