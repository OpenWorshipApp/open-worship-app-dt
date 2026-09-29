// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    page: '/setting.html',
    focused: true,
    isMain: false,
    settings: new Map<string, string>(),
    listeners: new Set<(event: unknown, data: unknown) => void>(),
    menu: vi.fn(),
    callTool: vi.fn(async () => '{}'),
}));
vi.mock('../helper/appHooks', () => ({ useAppEffect: useEffect }));
vi.mock('../helper/ai/aiHelpers', () => ({ getIsAIEnabled: () => true }));
vi.mock('../helper/ai/aiEnableHelpers', () => ({ askToEnableAI: vi.fn() }));
vi.mock('../server/appProvider', () => ({
    default: {
        get currentHomePage() {
            return state.page;
        },
        getIsWindowFocused: () => state.focused,
    },
}));
vi.mock('../server/appHelpers', () => ({
    checkIsMainWindow: () => state.isMain,
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => state.settings.get(key),
    setSetting: (key: string, value: string) => state.settings.set(key, value),
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
    setAppMenuItems: state.menu,
    registerAppMenuClicked: (
        handler: (event: unknown, data: unknown) => void,
    ) => {
        state.listeners.add(handler);
        return () => state.listeners.delete(handler);
    },
}));
vi.mock('../chatbot/mcpClient', () => ({ callTool: state.callTool }));

import DailyTipComp from './DailyTipComp';
import {
    DAILY_TIP_AUTO_SHOW_DELAY_MS,
    getDailyTipSessionKey,
} from './dailyTipHelpers';

let root: Root;
let container: HTMLDivElement;
async function sendMenu(data: object) {
    await act(async () => {
        for (const listener of state.listeners) listener({}, data);
    });
}

describe('tips in each window', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        sessionStorage.clear();
        state.settings.clear();
        state.listeners.clear();
        state.page = '/setting.html';
        state.focused = true;
        state.isMain = false;
        container = document.createElement('div');
        document.body.append(container);
        root = createRoot(container);
    });
    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.useRealTimers();
    });

    it('opens All tips in a focused popup even with automatic tips disabled', async () => {
        state.settings.set('daily-tips-disabled', 'true');
        await act(async () => root.render(<DailyTipComp />));
        state.focused = false;
        await sendMenu({ isBrowseDailyTips: true });
        expect(container.textContent).toBe('');
        state.focused = true;
        await sendMenu({ isBrowseDailyTips: true });
        expect(container.textContent).toContain('All tips · Setting');
        expect(container.textContent).toContain('3/3');
        expect(container.textContent).not.toContain('Reader');
        expect(state.menu).not.toHaveBeenCalled();
        await act(async () => root.unmount());
        expect(state.listeners.size).toBe(0);
        expect(state.menu).not.toHaveBeenCalled();
        root = createRoot(container);
    });

    it('shows the popup automatic tip independently of a tip already seen in Reader', async () => {
        sessionStorage.setItem(getDailyTipSessionKey('reader'), 'true');
        await act(async () => root.render(<DailyTipComp />));
        state.focused = false;
        await act(async () =>
            vi.advanceTimersByTime(DAILY_TIP_AUTO_SHOW_DELAY_MS),
        );
        expect(container.textContent).toBe('');
        state.focused = true;
        await act(async () => window.dispatchEvent(new Event('focus')));
        expect(container.textContent).toContain('Tip of the Day · Setting');
        expect(sessionStorage.getItem(getDailyTipSessionKey('setting'))).toBe(
            'true',
        );
        await act(async () =>
            container
                .querySelector<HTMLButtonElement>('[aria-label="Close"]')!
                .click(),
        );
        await act(async () => window.dispatchEvent(new Event('focus')));
        expect(container.textContent).toBe('');
    });

    it('passes the exact popup URL when Show it starts the assistant demo', async () => {
        await act(async () => root.render(<DailyTipComp />));
        await sendMenu({ isOpenDailyTip: true });
        const button = [...container.querySelectorAll('button')].find(
            (element) => element.textContent === 'Show it',
        )!;
        await act(async () => button.click());
        expect(state.callTool).toHaveBeenCalledWith(
            'owa_guide_start',
            expect.objectContaining({ page: location.href }),
        );
        expect(container.textContent).toBe('');
    });
});
