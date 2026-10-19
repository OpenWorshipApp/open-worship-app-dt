// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    showAppContextMenu: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/appHooks', () => ({ useAppEffectAsync: () => {} }));
vi.mock('../helper/helpers', () => ({
    freezeObject: () => {},
    pressElementLikeButton: () => {},
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: mocks.showAppContextMenu,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));

import ItemColorNoteComp from './ItemColorNoteComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
});

function render(colorNote: string | null) {
    act(() => {
        root.render(
            <ItemColorNoteComp
                item={{
                    colorNote,
                    getColorNote: async () => colorNote,
                    setColorNote: async () => {},
                }}
            />,
        );
    });
}

function renderNameOf(colorNote: string | null) {
    render(colorNote);
    return host.querySelector('[role="button"]')?.getAttribute('aria-label');
}

/** Opens the colour menu and returns `{ label: disabled }` for its rows. */
function openMenuOf(colorNote: string | null) {
    render(colorNote);
    act(() => {
        host.querySelector<HTMLElement>('[role="button"]')!.click();
    });
    const items = mocks.showAppContextMenu.mock.lastCall?.[1] as {
        menuElement: string;
        disabled?: boolean;
    }[];
    return Object.fromEntries(
        items.map((item) => [item.menuElement, !!item.disabled]),
    );
}

describe('ItemColorNoteComp', () => {
    // The button was named `magenta` and nothing else: what it does went
    // unsaid, and in a Khmer window that one English word was all there was.
    test('is named for what it is, then the colour it holds', () => {
        expect(renderNameOf('#ff00ff')).toBe('Color Note: magenta');
    });

    test('says when there is no colour', () => {
        expect(renderNameOf(null)).toBe('Color Note: No Color');
    });

    // A cleared colour comes back as `''` as often as `null`, and "No Color"
    // stayed pressable on it: both mean there is nothing to clear.
    test.each([
        ['an empty string', ''],
        ['null', null],
    ])('offers no "No Color" when the colour is %s', (_name, colorNote) => {
        const disabledOf = openMenuOf(colorNote);
        expect(disabledOf['No Color']).toBe(true);
        expect(disabledOf['magenta']).toBe(false);
    });

    test('disables the colour it holds and offers to clear it', () => {
        const disabledOf = openMenuOf('#ff00ff');
        expect(disabledOf['No Color']).toBe(false);
        expect(disabledOf['magenta']).toBe(true);
        expect(disabledOf['red']).toBe(false);
    });
});
