// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    tabs: [] as any[],
    genTabs: vi.fn(),
    goToPath: vi.fn(),
}));

vi.mock('./routeHelpers', () => ({ goToPath: state.goToPath }));
vi.mock('./layoutHelpers', () => ({ genTabs: state.genTabs }));

import LayoutTabRenderComp from './LayoutTabRenderComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.tabs = [];
    state.genTabs.mockImplementation(() => state.tabs);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

function getButton(text: string) {
    return Array.from(host.querySelectorAll('button')).find(
        (button) => button.textContent === text,
    )!;
}

async function press(text: string) {
    await act(async () => getButton(text).click());
    await act(async () => {
        await Promise.resolve();
    });
}

describe('LayoutTabRenderComp', () => {
    test('a plain tab goes to its page', async () => {
        state.tabs = [{ title: 'Reader', routePath: '/reader.html' }];
        await act(async () => root.render(<LayoutTabRenderComp />));
        await press('Reader');
        expect(state.goToPath).toHaveBeenCalledExactlyOnceWith('/reader.html');
    });

    test('a tab with its own opener opens instead of navigating', async () => {
        const onOpen = vi.fn();
        state.tabs = [
            { title: 'Experiment', routePath: '/presenter.html', onOpen },
        ];
        await act(async () => root.render(<LayoutTabRenderComp />));
        await press('Experiment');
        expect(onOpen).toHaveBeenCalledOnce();
        expect(state.goToPath).not.toHaveBeenCalled();
    });

    test('a tab with a pre-check navigates only when it passes', async () => {
        let isSelected = false;
        const preCheck = vi.fn(async () => isSelected);
        state.tabs = [
            { title: 'Slide Editor', routePath: '/editor.html', preCheck },
        ];
        await act(async () => root.render(<LayoutTabRenderComp />));
        await press('Slide Editor');
        expect(preCheck).toHaveBeenCalledOnce();
        expect(state.goToPath).not.toHaveBeenCalled();
        isSelected = true;
        await press('Slide Editor');
        expect(state.goToPath).toHaveBeenCalledExactlyOnceWith('/editor.html');
    });

    test('the open-in-a-new-window icon is its own button beside the tab', async () => {
        const onExternalOpen = vi.fn();
        state.tabs = [
            {
                title: 'Reader',
                routePath: '/reader.html',
                externalOpen: {
                    title: 'Open Bible Reader in a new window',
                    color: 'blue',
                    onOpen: onExternalOpen,
                },
            },
            { title: 'Screen Mirror', routePath: '/mirror.html' },
        ];
        await act(async () => root.render(<LayoutTabRenderComp />));
        const items = host.querySelectorAll('li');
        expect(items).toHaveLength(2);
        const external = items[0].querySelectorAll('button')[1];
        expect(external.title).toBe('Open Bible Reader in a new window');
        expect(external.getAttribute('aria-label')).toBe(
            'Open Bible Reader in a new window',
        );
        expect(external.style.color).toBe('blue');
        expect(items[1].querySelectorAll('button')).toHaveLength(1);
        await act(async () => external.click());
        expect(onExternalOpen).toHaveBeenCalledOnce();
        expect(state.goToPath).not.toHaveBeenCalled();
    });

    test('the tabs are built once, not on every render', async () => {
        state.tabs = [{ title: 'Reader', routePath: '/reader.html' }];
        await act(async () => root.render(<LayoutTabRenderComp />));
        await act(async () => root.render(<LayoutTabRenderComp />));
        expect(state.genTabs).toHaveBeenCalledOnce();
    });
});
