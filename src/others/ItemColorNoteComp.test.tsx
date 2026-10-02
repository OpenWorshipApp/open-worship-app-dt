// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/appHooks', () => ({ useAppEffectAsync: () => {} }));
vi.mock('../helper/helpers', () => ({
    freezeObject: () => {},
    pressElementLikeButton: () => {},
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: vi.fn(),
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

function renderNameOf(colorNote: string | null) {
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
    return host.querySelector('[role="button"]')?.getAttribute('aria-label');
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
});
