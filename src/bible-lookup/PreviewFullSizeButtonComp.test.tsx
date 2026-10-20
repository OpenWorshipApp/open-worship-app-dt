// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    entries: [] as Array<{ id: string; isHidden: boolean }>,
    listeners: new Set<() => void>(),
}));

vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: (current: unknown) => {
            const ref = react.useRef(current);
            ref.current = current;
            return ref;
        },
    };
});
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../resize-actor/widgetRegistry', () => ({
    getWidgetEntries: () => {
        return h.entries.map((entry) => {
            return {
                ...entry,
                widgetName: entry.id,
                toggle: () => {
                    entry.isHidden = !entry.isHidden;
                    for (const listener of h.listeners) listener();
                },
            };
        });
    },
    subscribeWidgetsChanged: (listener: () => void) => {
        h.listeners.add(listener);
        return () => {
            h.listeners.delete(listener);
        };
    },
    toggleWidget: (id: string) => {
        const entry = h.entries.find((item) => {
            return item.id === id;
        });
        if (entry === undefined) {
            return false;
        }
        entry.isHidden = !entry.isHidden;
        for (const listener of h.listeners) listener();
        return true;
    },
    toWidgetId: (flexSizeName: string, key: string) => {
        return `${flexSizeName}:${key}`;
    },
}));

import PreviewFullSizeButtonComp from './PreviewFullSizeButtonComp';

const SIDE_WIDGET_KEYS = ['h1', 'h3'];

let root: Root;
let container: HTMLDivElement;

function render() {
    act(() => {
        root.render(
            <PreviewFullSizeButtonComp
                flexSizeName="reader"
                sideWidgetKeys={SIDE_WIDGET_KEYS}
            />,
        );
    });
}

function getButton() {
    return container.querySelector<HTMLButtonElement>('button')!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.entries = [
        { id: 'reader:h1', isHidden: false },
        { id: 'reader:h3', isHidden: false },
    ];
    h.listeners.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    h.listeners.clear();
    vi.unstubAllGlobals();
});

describe('Preview full size button', () => {
    it('collapses every side pane, then brings back only the ones it closed', async () => {
        render();
        expect(getButton().getAttribute('aria-label')).toBe(
            'Full size preview',
        );
        expect(getButton().getAttribute('aria-pressed')).toBe('false');

        await act(async () => getButton().click());
        expect(h.entries.map(({ isHidden }) => isHidden)).toEqual([true, true]);
        expect(getButton().getAttribute('aria-label')).toBe(
            'Exit full size preview',
        );

        await act(async () => getButton().click());
        expect(h.entries.map(({ isHidden }) => isHidden)).toEqual([
            false,
            false,
        ]);
        expect(getButton().getAttribute('aria-label')).toBe(
            'Full size preview',
        );
    });

    it('leaves a pane that was already closed closed when restoring', async () => {
        h.entries[1].isHidden = true;
        render();
        await act(async () => getButton().click());
        expect(h.entries[0].isHidden).toBe(true);
        // The Advance Lookup was not open when the button was pressed, so the
        // button must not put it back on screen.
        await act(async () => getButton().click());
        expect(h.entries[0].isHidden).toBe(false);
        expect(h.entries[1].isHidden).toBe(true);
    });
});
