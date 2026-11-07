// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { mocks } = vi.hoisted(() => ({
    mocks: {
        onChoose: vi.fn(),
        onClose: vi.fn(),
        onAdd: vi.fn(),
        onRename: vi.fn(),
        onTogglingLock: vi.fn(),
        onSolo: vi.fn(),
        onClearAll: vi.fn(),
        onReorder: vi.fn(),
        onTearOff: vi.fn(),
    },
}));

vi.mock('../helper/appHooks', () => ({
    useAppEffect: useEffect,
}));
// `chatSessionHelpers` keeps the tabs through the settings store; the strip
// only asks it which tabs a sweep would take.
vi.mock('../helper/settingHelpers', () => ({
    getSetting: () => null,
    setSetting: () => {},
}));

import RenderSessionTabsComp from './RenderSessionTabsComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

type TabType = { id: string; isLocked: boolean };

const OPEN_TABS: TabType[] = [
    { id: 'a', isLocked: false },
    { id: 'b', isLocked: false },
    { id: 'c', isLocked: true },
];

let container: HTMLDivElement;
let root: Root;
let originalScrollIntoView: typeof Element.prototype.scrollIntoView;

function render(sessions: TabType[] = OPEN_TABS, canClearAll = true) {
    act(() => {
        root.render(
            <RenderSessionTabsComp
                sessions={sessions}
                activeId="a"
                genTitle={(session) => {
                    return `Tab ${session.id}`;
                }}
                canAdd
                canClearAll={canClearAll}
                onChoose={mocks.onChoose}
                onClose={mocks.onClose}
                onAdd={mocks.onAdd}
                onRename={mocks.onRename}
                onTogglingLock={mocks.onTogglingLock}
                onSolo={mocks.onSolo}
                onClearAll={mocks.onClearAll}
                onReorder={mocks.onReorder}
                onTearOff={mocks.onTearOff}
            />,
        );
    });
}

function getTabs() {
    return [...container.querySelectorAll<HTMLElement>('.chat-tab')];
}

function getMenu() {
    return container.querySelector<HTMLElement>('[role="menu"]');
}

function findMenuItem(text: string) {
    return [...container.querySelectorAll<HTMLElement>('.chat-menu-item')].find(
        (element) => {
            return element.textContent === text;
        },
    );
}

function press(element: Element | null | undefined) {
    if (!element) {
        throw new Error('Nothing to press');
    }
    act(() => {
        (element as HTMLElement).click();
    });
}

function pressKey(element: Element, key: string) {
    act(() => {
        element.dispatchEvent(
            new KeyboardEvent('keydown', { key, bubbles: true }),
        );
    });
}

function openMenuOf(sessionId: string) {
    press(container.querySelector(`[aria-label="More for Tab ${sessionId}"]`));
}

// jsdom has no DragEvent; React reads `dataTransfer` and the pointer off
// whatever native event arrives, so a mouse event carrying one is enough.
function fireDrag(
    target: Element,
    type: string,
    init: { clientX?: number; screenX?: number; screenY?: number } = {},
) {
    const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        ...init,
    });
    Object.defineProperty(event, 'dataTransfer', {
        value: {
            setData: () => {},
            getData: () => '',
            types: [],
            effectAllowed: 'all',
            dropEffect: 'none',
        },
    });
    act(() => {
        target.dispatchEvent(event);
    });
    return event;
}

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    // jsdom lays nothing out, so it has nothing to scroll into view.
    originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = () => {};
    Object.assign(window, {
        screenX: 100,
        screenY: 100,
        outerWidth: 460,
        outerHeight: 640,
    });
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    Element.prototype.scrollIntoView = originalScrollIntoView;
});

describe('a tab’s menu', () => {
    test('a right-click on the tab opens the same menu as its dots', () => {
        render();
        const [, tabB] = getTabs();
        const event = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
        });
        act(() => {
            tabB.dispatchEvent(event);
        });
        // The OS menu is not drawn over it.
        expect(event.defaultPrevented).toBe(true);
        expect(getMenu()?.getAttribute('aria-label')).toBe('Tab b');
        expect(tabB.className).toContain('is-menu-on');
        expect(
            container
                .querySelector('[aria-label="More for Tab b"]')
                ?.getAttribute('aria-expanded'),
        ).toBe('true');
    });

    test('goes on a right-click anywhere else, and on Escape', () => {
        render();
        openMenuOf('b');
        const sheet = container.querySelector('.chat-menu-sheet')!;
        const event = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
        });
        act(() => {
            sheet.dispatchEvent(event);
        });
        expect(event.defaultPrevented).toBe(true);
        expect(getMenu()).toBeNull();
        openMenuOf('a');
        expect(getMenu()).not.toBeNull();
        pressKey(getMenu()!, 'Escape');
        expect(getMenu()).toBeNull();
        // Another key leaves it up.
        openMenuOf('a');
        pressKey(getMenu()!, 'ArrowDown');
        expect(getMenu()).not.toBeNull();
    });

    test('Close this chat closes THAT tab, and a locked tab offers no close', () => {
        render();
        openMenuOf('b');
        press(findMenuItem('Close this chat'));
        expect(mocks.onClose).toHaveBeenCalledWith('b');
        expect(getMenu()).toBeNull();
        openMenuOf('c');
        expect(findMenuItem('Close this chat')).toBeUndefined();
        expect(findMenuItem('Unlock this chat')).toBeDefined();
    });

    test('a menu whose tab went out from under it is not drawn', () => {
        render();
        openMenuOf('b');
        render([OPEN_TABS[0], OPEN_TABS[2]]);
        expect(getMenu()).toBeNull();
    });
});

describe('renaming a tab', () => {
    test('from the menu: the box starts on the name, Enter keeps the new one', () => {
        render();
        openMenuOf('b');
        press(findMenuItem('Rename this chat'));
        expect(getMenu()).toBeNull();
        const input =
            container.querySelector<HTMLInputElement>('.chat-tab-input')!;
        expect(input.value).toBe('Tab b');
        // A tab being renamed is a text box, not a thing to drag.
        expect(getTabs()[1].getAttribute('draggable')).toBe('false');
        act(() => {
            const setValue = Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                'value',
            )!.set!;
            setValue.call(input, 'Sunday songs');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        pressKey(input, 'Enter');
        expect(mocks.onRename).toHaveBeenCalledWith('b', 'Sunday songs');
        expect(container.querySelector('.chat-tab-input')).toBeNull();
    });

    test('Escape gives the old name back and renames nothing', () => {
        render();
        act(() => {
            getTabs()[0]
                .querySelector('.chat-tab-name')!
                .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        });
        const input =
            container.querySelector<HTMLInputElement>('.chat-tab-input')!;
        expect(input.value).toBe('Tab a');
        pressKey(input, 'a');
        expect(container.querySelector('.chat-tab-input')).not.toBeNull();
        pressKey(input, 'Escape');
        expect(container.querySelector('.chat-tab-input')).toBeNull();
        expect(mocks.onRename).not.toHaveBeenCalled();
        expect(getTabs()[0].textContent).toContain('Tab a');
    });
});

describe('the two sweeps, asked twice', () => {
    test('Close other chats asks first, counting only what it takes', () => {
        render();
        openMenuOf('a');
        press(findMenuItem('Close other chats…'));
        const ask = container.querySelector('[role="alertdialog"]')!;
        expect(ask.getAttribute('aria-label')).toBe('Close other chats');
        // `b` goes; `c` is locked, and `a` is the one being kept.
        expect(ask.textContent).toContain(
            'Close 1 chat? The locked one stays. This cannot be undone.',
        );
        expect(mocks.onSolo).not.toHaveBeenCalled();
        press(ask.querySelector('.chat-clear-yes'));
        expect(mocks.onSolo).toHaveBeenCalledWith('a');
        expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    });

    test('Keep them and Escape both take the question away, sweeping nothing', () => {
        render();
        openMenuOf('a');
        press(findMenuItem('Clear all chats…'));
        let ask = container.querySelector('[role="alertdialog"]')!;
        expect(ask.getAttribute('aria-label')).toBe('Clear all chats');
        expect(ask.textContent).toContain(
            'Clear 2 chats? The locked one stays. This cannot be undone.',
        );
        press(ask.querySelector('.chat-clear-no'));
        expect(container.querySelector('[role="alertdialog"]')).toBeNull();
        openMenuOf('b');
        press(findMenuItem('Clear all chats…'));
        ask = container.querySelector('[role="alertdialog"]')!;
        pressKey(ask, 'Enter');
        expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();
        pressKey(ask, 'Escape');
        expect(container.querySelector('[role="alertdialog"]')).toBeNull();
        expect(mocks.onClearAll).not.toHaveBeenCalled();
        expect(mocks.onSolo).not.toHaveBeenCalled();
    });

    test('Clear all, confirmed, clears; with no lock it names no lock', () => {
        render([
            { id: 'a', isLocked: false },
            { id: 'b', isLocked: false },
        ]);
        openMenuOf('a');
        press(findMenuItem('Clear all chats…'));
        const ask = container.querySelector('[role="alertdialog"]')!;
        expect(ask.textContent).toContain(
            'Clear 2 chats? This cannot be undone.',
        );
        expect(ask.textContent).not.toContain('locked');
        press(ask.querySelector('.chat-clear-yes'));
        expect(mocks.onClearAll).toHaveBeenCalledOnce();
    });

    test('two locked tabs are counted as such', () => {
        render([
            { id: 'a', isLocked: false },
            { id: 'b', isLocked: true },
            { id: 'c', isLocked: true },
        ]);
        openMenuOf('a');
        // Nothing else to close: no "Close other chats…".
        expect(findMenuItem('Close other chats…')).toBeUndefined();
        press(findMenuItem('Clear all chats…'));
        expect(
            container.querySelector('[role="alertdialog"]')?.textContent,
        ).toContain('Clear 1 chat? The locked ones stay.');
    });

    test('a question that would now take nothing goes by itself', () => {
        render();
        openMenuOf('a');
        press(findMenuItem('Close other chats…'));
        expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();
        // `b` was closed some other way: the only other tab left is locked.
        render([OPEN_TABS[0], OPEN_TABS[2]]);
        expect(container.querySelector('[role="alertdialog"]')).toBeNull();
        expect(mocks.onSolo).not.toHaveBeenCalled();
    });
});

describe('dragging along the strip', () => {
    test('back over the dragged tab itself the mark goes, and a drop there moves nothing', () => {
        render();
        const [tabA, tabB] = getTabs();
        fireDrag(tabA, 'dragstart');
        // jsdom's boxes are all 0 wide, so any x past 0 is the right half.
        fireDrag(tabB, 'dragover', { clientX: 5 });
        expect(tabB.className).toContain('is-drop-after');
        // The same half again changes nothing.
        const again = fireDrag(tabB, 'dragover', { clientX: 6 });
        expect(again.defaultPrevented).toBe(true);
        expect(tabB.className).toContain('is-drop-after');
        // The left half of the same tab moves the mark to before it.
        fireDrag(tabB, 'dragover', { clientX: 0 });
        expect(tabB.className).toContain('is-drop-before');
        fireDrag(tabA, 'dragover', { clientX: 5 });
        expect(tabB.className).not.toContain('is-drop');
        expect(tabA.className).not.toContain('is-drop');
        fireDrag(tabA, 'drop', { clientX: 5 });
        expect(mocks.onReorder).not.toHaveBeenCalled();
    });

    test('a drag Chromium could not place (0,0) is not torn off', () => {
        render();
        const [, tabB] = getTabs();
        fireDrag(tabB, 'dragstart');
        fireDrag(tabB, 'dragend', { screenX: 0, screenY: 0 });
        expect(mocks.onTearOff).not.toHaveBeenCalled();
        // Above the window is outside it.
        fireDrag(tabB, 'dragstart');
        fireDrag(tabB, 'dragend', { screenX: 300, screenY: 40 });
        expect(mocks.onTearOff).toHaveBeenCalledWith('b', 300, 40);
    });
});
