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

function render(
    colorNote: string | null,
    defaultColorNote: string | null = null,
) {
    act(() => {
        root.render(
            <ItemColorNoteComp
                item={{
                    colorNote,
                    getColorNote: async () => colorNote,
                    setColorNote: async () => {},
                }}
                defaultColorNote={defaultColorNote}
            />,
        );
    });
}

function renderNameOf(
    colorNote: string | null,
    defaultColorNote: string | null = null,
) {
    render(colorNote, defaultColorNote);
    return host.querySelector('[role="button"]')?.getAttribute('aria-label');
}

/** Opens the colour menu and returns `{ label: disabled }` for its rows. */
function openMenuOf(
    colorNote: string | null,
    defaultColorNote: string | null = null,
) {
    render(colorNote, defaultColorNote);
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

    // A bible preview section always has a colour: an unset one shows the
    // default (lime), and clearing would change nothing, so it is not offered.
    // `main` spells lime `#00FF00`, `extension` `#00ff00`; both are the colour.
    test('shows the default colour when the item has none', () => {
        expect(renderNameOf(null, '#00FF00')).toBe('Color Note: lime');
    });

    test('names a colour whichever case its code is stored in', () => {
        expect(renderNameOf('#00FF00')).toBe('Color Note: lime');
    });

    test('offers no "No Color" while the default colour is showing', () => {
        const disabledOf = openMenuOf(null, '#00FF00');
        expect(disabledOf['No Color']).toBe(true);
        expect(disabledOf['lime']).toBe(true);
        expect(disabledOf['magenta']).toBe(false);
    });

    test('marks the current row case-insensitively', () => {
        const disabledOf = openMenuOf('#00FF00');
        expect(disabledOf['lime']).toBe(true);
        expect(disabledOf['No Color']).toBe(false);
    });

    test('offers to clear a colour chosen over the default', () => {
        const disabledOf = openMenuOf('#ff00ff', '#00FF00');
        expect(disabledOf['No Color']).toBe(false);
        expect(disabledOf['magenta']).toBe(true);
    });
});
