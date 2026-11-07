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
import AppContextMenuComp, {
    elementDivider,
    genContextMenuItemGestureHint,
} from './AppContextMenuComp';

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
            { menuElement: 'English', isSectionHeader: true },
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
    expect(items).toHaveLength(3);
    // A section's name is never selectable, but it is not faded either.
    expect(items[1].classList.contains('disabled')).toBe(true);
    expect(items[2].getAttribute('aria-disabled')).toBe('true');
    expect(items[2].getAttribute('tabindex')).toBe('-1');
    expect(items[2].classList.contains('disabled')).toBe(false);
    expect(items[2].classList.contains('app-context-menu-section-header')).toBe(
        true,
    );
    // The one line that ellipsises; the scrolling second line is CSS only.
    expect(
        items[0].querySelector(
            '.app-context-menu-item-label > .app-context-menu-item-text',
        )?.textContent,
    ).toBe('Open');
    expect(items[1].getAttribute('aria-disabled')).toBe('true');
    expect(items[0].textContent).toContain('Ctrl + K');
    await act(async () => (items[0] as HTMLDivElement).click());
    await new Promise((resolve) => setTimeout(resolve));
    expect(close).toHaveBeenCalledOnce();
    expect(select).toHaveBeenCalledOnce();
});

test('nothing is drawn while no menu is open', async () => {
    state.data = null;
    await act(async () => root.render(<AppContextMenuComp />));
    expect(host.innerHTML).toBe('');
});

test('a press beside the menu closes it, and so does a right-click there', async () => {
    const close = vi.fn();
    state.data = {
        event: new MouseEvent('contextmenu'),
        onClose: close,
        items: [{ menuElement: 'Open', onSelect: vi.fn() }],
    };
    await act(async () => root.render(<AppContextMenuComp />));
    const backdrop = host.querySelector(
        '#app-context-menu-container',
    ) as HTMLElement;
    await act(async () => backdrop.click());
    expect(close).toHaveBeenCalledOnce();
    await act(async () => {
        backdrop.dispatchEvent(
            new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
        );
    });
    expect(close).toHaveBeenCalledTimes(2);
});

test('a disabled item swallows its press without closing the menu', async () => {
    const close = vi.fn();
    const select = vi.fn();
    state.data = {
        event: new MouseEvent('contextmenu'),
        onClose: close,
        items: [
            { menuElement: 'Unavailable', disabled: true, onSelect: select },
        ],
    };
    await act(async () => root.render(<AppContextMenuComp />));
    const item = host.querySelector('[role="menuitem"]') as HTMLElement;
    await act(async () => {
        item.click();
        await new Promise((resolve) => setTimeout(resolve));
    });
    // Not even the backdrop under it heard the press.
    expect(close).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
});

test('Enter or Space chooses an item; any other key is left alone', async () => {
    const close = vi.fn();
    const select = vi.fn();
    state.data = {
        event: new MouseEvent('contextmenu'),
        onClose: close,
        items: [{ menuElement: 'Open', onSelect: select }],
    };
    await act(async () => root.render(<AppContextMenuComp />));
    const item = host.querySelector('[role="menuitem"]') as HTMLElement;
    const pressKey = async (key: string) => {
        const event = new KeyboardEvent('keydown', {
            key,
            bubbles: true,
            cancelable: true,
        });
        await act(async () => {
            item.dispatchEvent(event);
            await new Promise((resolve) => setTimeout(resolve));
        });
        return event;
    };
    const arrow = await pressKey('ArrowDown');
    expect(arrow.defaultPrevented).toBe(false);
    expect(select).not.toHaveBeenCalled();

    const space = await pressKey(' ');
    // Space would have scrolled the page behind the menu.
    expect(space.defaultPrevented).toBe(true);
    expect(close).toHaveBeenCalledOnce();
    expect(select).toHaveBeenCalledOnce();

    await pressKey('Enter');
    expect(close).toHaveBeenCalledTimes(2);
    expect(select).toHaveBeenCalledTimes(2);
});

test('a divider is drawn as a rule, not as an item', async () => {
    state.data = {
        event: new MouseEvent('contextmenu'),
        onClose: vi.fn(),
        items: [
            { menuElement: 'Above', onSelect: vi.fn() },
            { menuElement: elementDivider },
            { menuElement: 'Below', onSelect: vi.fn() },
        ],
    };
    await act(async () => root.render(<AppContextMenuComp />));
    const menu = host.querySelector('[role="menu"]') as HTMLElement;
    expect(
        [...menu.children].map((child) => {
            return child.getAttribute('role') ?? child.tagName;
        }),
    ).toEqual(['menuitem', 'HR', 'menuitem']);
});

test('a mouse gesture hint is a chip of its own in the row', async () => {
    state.data = {
        event: new MouseEvent('contextmenu'),
        onClose: vi.fn(),
        items: [
            {
                menuElement: 'Open in new tab',
                onSelect: vi.fn(),
                childAfter: genContextMenuItemGestureHint('Alt + Right Click'),
            },
        ],
    };
    await act(async () => root.render(<AppContextMenuComp />));
    const hint = host.querySelector(
        '[role="menuitem"] .context-menu-gesture-hint',
    );
    expect(hint?.textContent).toBe('Alt + Right Click');
});
