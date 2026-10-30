// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    isPageLyricEditor: false,
    isPageLWShare: false,
    theme: 'light',
}));

vi.mock('../server/appProvider', () => ({
    default: {
        get isPageLyricEditor() {
            return state.isPageLyricEditor;
        },
        get isPageLWShare() {
            return state.isPageLWShare;
        },
    },
}));
vi.mock('./themeHelpers', () => ({
    useThemeSource: () => ({ theme: state.theme }),
}));
vi.mock('./AppAssistantComp', () => ({
    default: () => <i data-tool="assistant" />,
}));
vi.mock('../keyboard-shortcut/KeyboardShortcutsComp', () => ({
    default: () => <i data-tool="shortcuts" />,
}));
vi.mock('../presenting-control/PresentingControlComp', () => ({
    default: () => <i data-tool="presenting-control" />,
}));
vi.mock('../toast/ToastComp', () => ({
    default: () => <i data-tool="toast" />,
}));

import AppWindowToolsComp from './AppWindowToolsComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.isPageLyricEditor = false;
    state.isPageLWShare = false;
    state.theme = 'light';
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

function listTools() {
    return Array.from(host.querySelectorAll('[data-tool]')).map((element) =>
        element.getAttribute('data-tool'),
    );
}

describe('AppWindowToolsComp', () => {
    test('every window gets the overlay, the assistant and the shortcuts, themed', async () => {
        state.theme = 'dark';
        await act(async () => root.render(<AppWindowToolsComp />));
        const wrapper = host.firstElementChild as HTMLElement;
        expect(wrapper.className).toBe('app');
        expect(wrapper.dataset.bsTheme).toBe('dark');
        // Layout-neutral: the tokens inherit, the box does not exist.
        expect(wrapper.style.display).toBe('contents');
        expect(listTools()).toEqual([
            'presenting-control',
            'assistant',
            'shortcuts',
        ]);
    });

    test.each([
        ['the Lyric Editor', 'isPageLyricEditor'],
        ['the LW Share page', 'isPageLWShare'],
    ] as const)(
        '%s has no layout of its own, so it hosts the toasts here',
        async (_page, flag) => {
            state[flag] = true;
            await act(async () => root.render(<AppWindowToolsComp />));
            expect(listTools()).toEqual([
                'presenting-control',
                'assistant',
                'shortcuts',
                'toast',
            ]);
        },
    );
});
