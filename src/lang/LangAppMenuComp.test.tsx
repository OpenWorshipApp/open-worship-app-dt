// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const unregister = vi.fn();
    return {
        unregister,
        registerLangAppMenuClicked: vi.fn(() => unregister),
        initLangAppMenu: vi.fn(),
        checkIsMainWindow: vi.fn(() => true),
    };
});

vi.mock('./langHelpers', () => ({
    registerLangAppMenuClicked: mocks.registerLangAppMenuClicked,
    initLangAppMenu: mocks.initLangAppMenu,
}));
vi.mock('../server/mainWindowHelpers', () => ({
    checkIsMainWindow: mocks.checkIsMainWindow,
}));
vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});

import LangAppMenuComp from './LangAppMenuComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkIsMainWindow.mockReturnValue(true);
});

async function mount() {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
        root.render(<LangAppMenuComp />);
    });
    return { container, root };
}

test('in the main window it builds the language Tools items and answers them until unmounted', async () => {
    const { container, root } = await mount();
    expect(mocks.initLangAppMenu).toHaveBeenCalledTimes(1);
    expect(mocks.registerLangAppMenuClicked).toHaveBeenCalledTimes(1);
    expect(mocks.unregister).not.toHaveBeenCalled();
    expect(container.innerHTML).toBe('');

    await act(async () => {
        root.unmount();
    });
    expect(mocks.unregister).toHaveBeenCalledTimes(1);
});

test('a popup leaves the items to the main window', async () => {
    mocks.checkIsMainWindow.mockReturnValue(false);
    const { root } = await mount();
    expect(mocks.initLangAppMenu).not.toHaveBeenCalled();
    expect(mocks.registerLangAppMenuClicked).not.toHaveBeenCalled();
    await act(async () => {
        root.unmount();
    });
});
