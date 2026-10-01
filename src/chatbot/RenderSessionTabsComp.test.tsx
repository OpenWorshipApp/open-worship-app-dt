// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../helper/appHooks', () => ({
    useAppEffect: useEffect,
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: () => null,
    setSetting: () => {},
}));

import RenderSessionTabsComp from './RenderSessionTabsComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom lays nothing out, so it has nothing to scroll into view.
Element.prototype.scrollIntoView = () => {};

type TabType = { id: string; isLocked: boolean };

const TABS: TabType[] = [
    { id: 'a', isLocked: false },
    { id: 'b', isLocked: false },
    { id: 'c', isLocked: false },
];

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
    const store = new Map<string, string>();
    Object.defineProperty(event, 'dataTransfer', {
        value: {
            setData: (kind: string, value: string) => {
                store.set(kind, value);
            },
            getData: (kind: string) => store.get(kind) ?? '',
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

describe('RenderSessionTabsComp', () => {
    let container: HTMLDivElement;
    let root: Root;
    const handlers = {
        onReorder: vi.fn(),
        onTearOff: vi.fn(),
        onOpenInNewWindow: vi.fn(),
        onNewWindow: vi.fn(),
    };

    function render(
        extra: Partial<typeof handlers> = handlers,
        sessions: TabType[] = TABS,
    ) {
        act(() => {
            root.render(
                <RenderSessionTabsComp
                    sessions={sessions}
                    activeId="a"
                    genTitle={(session) => {
                        return `Tab ${session.id}`;
                    }}
                    canAdd
                    canClearAll
                    onChoose={vi.fn()}
                    onClose={vi.fn()}
                    onAdd={vi.fn()}
                    onRename={vi.fn()}
                    onTogglingLock={vi.fn()}
                    onSolo={vi.fn()}
                    onClearAll={vi.fn()}
                    {...extra}
                />,
            );
        });
    }
    function getTabs() {
        return [...container.querySelectorAll('.chat-tab')];
    }

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        for (const handler of Object.values(handlers)) {
            handler.mockClear();
        }
        // The window this strip is drawn in, on the screen.
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
    });

    test('a tab dropped on the right half of another goes after it', () => {
        render();
        const [tabA, , tabC] = getTabs();
        fireDrag(tabA, 'dragstart');
        const over = fireDrag(tabC, 'dragover', { clientX: 5 });
        // Taken: a drop here is this strip's.
        expect(over.defaultPrevented).toBe(true);
        expect(tabC.className).toContain('is-drop-after');
        fireDrag(tabC, 'drop', { clientX: 5 });
        // Without `a`, `c` is at 1; after it is 2.
        expect(handlers.onReorder).toHaveBeenCalledWith('a', 2);
        fireDrag(tabA, 'dragend', { screenX: 200, screenY: 200 });
        expect(handlers.onTearOff).not.toHaveBeenCalled();
        expect(tabC.className).not.toContain('is-drop');
    });

    test('a drag from another window is not taken by this strip', () => {
        render();
        const [, tabB] = getTabs();
        const over = fireDrag(tabB, 'dragover', { clientX: 5 });
        expect(over.defaultPrevented).toBe(false);
        fireDrag(tabB, 'drop', { clientX: 5 });
        expect(handlers.onReorder).not.toHaveBeenCalled();
    });

    test('a tab let go outside the window is torn off, with where', () => {
        render();
        const [, tabB] = getTabs();
        fireDrag(tabB, 'dragstart');
        fireDrag(tabB, 'dragend', { screenX: 900, screenY: 300 });
        expect(handlers.onTearOff).toHaveBeenCalledWith('b', 900, 300);
    });

    test('only draggable where there is something to drag it past', () => {
        render(handlers, [TABS[0]]);
        expect(getTabs()[0].getAttribute('draggable')).toBe('false');
        render({});
        expect(getTabs()[0].getAttribute('draggable')).toBe('false');
        render();
        expect(getTabs()[0].getAttribute('draggable')).toBe('true');
    });

    test('the tab menu opens a tab in a new window; the strip opens one', () => {
        render();
        act(() => {
            (
                container.querySelector(
                    '[aria-label="New window"]',
                ) as HTMLElement
            ).click();
        });
        expect(handlers.onNewWindow).toHaveBeenCalledOnce();
        act(() => {
            (
                container.querySelector(
                    '[aria-label="More for Tab b"]',
                ) as HTMLElement
            ).click();
        });
        const item = [...container.querySelectorAll('.chat-menu-item')].find(
            (element) => {
                return element.textContent === 'Open in new window';
            },
        ) as HTMLElement;
        act(() => {
            item.click();
        });
        expect(handlers.onOpenInNewWindow).toHaveBeenCalledWith('b');
    });

    test('a strip given none of it draws none of it', () => {
        render({});
        expect(container.querySelector('[aria-label="New window"]')).toBe(null);
        act(() => {
            (
                container.querySelector(
                    '[aria-label="More for Tab b"]',
                ) as HTMLElement
            ).click();
        });
        expect(container.textContent).not.toContain('Open in new window');
    });
});
