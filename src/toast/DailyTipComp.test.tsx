// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    page: '/setting.html',
    focused: true,
    isMain: false,
    isOnOwnFolder: false,
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
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        get isOnOwnFolder() {
            return state.isOnOwnFolder;
        },
    },
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => state.settings.get(key),
    setSetting: (key: string, value: string) => state.settings.set(key, value),
    removeSetting: (key: string) => state.settings.delete(key),
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
    DAILY_TIP_AUTO_CLOSE_MS,
    DAILY_TIP_AUTO_SHOW_DELAY_MS,
    DAILY_TIPS_HIDE_MS,
    getDailyTips,
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
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.useFakeTimers();
        vi.clearAllMocks();
        sessionStorage.clear();
        state.settings.clear();
        state.listeners.clear();
        state.page = '/setting.html';
        state.focused = true;
        state.isMain = false;
        state.isOnOwnFolder = false;
        container = document.createElement('div');
        document.body.append(container);
        root = createRoot(container);
    });
    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.useRealTimers();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    it('opens All tips in a popup that is not in front, even with automatic tips disabled', async () => {
        state.settings.set('daily-tips-disabled', 'true');
        await act(async () => root.render(<DailyTipComp />));
        // The press is on the main window's menu bar, so the main window has
        // the focus and this popup does not -- every page still shows its own.
        state.focused = false;
        await sendMenu({ isBrowseDailyTips: true });
        expect(container.textContent).toContain('All tips · Setting');
        const settingTipCount = getDailyTips('setting').length;
        expect(settingTipCount).toBeGreaterThan(0);
        expect(container.textContent).toContain(
            `${settingTipCount}/${settingTipCount}`,
        );
        expect(container.textContent).not.toContain('Reader');
        expect(state.menu).not.toHaveBeenCalled();
        await act(async () => root.unmount());
        expect(state.listeners.size).toBe(0);
        expect(state.menu).not.toHaveBeenCalled();
        root = createRoot(container);
    });

    it('has the main window send Help → Tips to every window, each opening its own', async () => {
        state.isMain = true;
        state.page = '/reader.html';
        state.focused = false;
        await act(async () => root.render(<DailyTipComp />));
        expect(state.menu).toHaveBeenCalledWith(
            'daily-tips',
            {
                help: [
                    {
                        label: 'Tips of the Day',
                        clickData: { isOpenDailyTip: true },
                    },
                    {
                        label: 'All tips',
                        clickData: { isBrowseDailyTips: true },
                    },
                ],
            },
            { isSentToAllWindows: true },
        );
        await sendMenu({ isOpenDailyTip: true });
        expect(container.textContent).toContain('Tip of the Day');
        // Asked for from Help, the card does not offer to put the automatic
        // tips away -- not on the tip, nor after Next tip or All tips.
        expect(container.textContent).not.toContain('Hide for 30 days');
        const nextButton = [...container.querySelectorAll('button')].find(
            (element) => element.textContent === 'Next tip',
        )!;
        await act(async () => nextButton.click());
        expect(container.textContent).not.toContain('Hide for 30 days');
        await sendMenu({ isBrowseDailyTips: true });
        const backButton = [...container.querySelectorAll('button')].find(
            (element) => element.textContent === 'Back to tip',
        )!;
        await act(async () => backButton.click());
        expect(container.textContent).toContain('Tip of the Day');
        expect(container.textContent).not.toContain('Hide for 30 days');
        // Closed, the next automatic card offers it again.
        await act(async () =>
            container
                .querySelector<HTMLButtonElement>('[aria-label="Close"]')!
                .click(),
        );
        sessionStorage.clear();
        await act(async () => root.unmount());
        root = createRoot(container);
        await act(async () => root.render(<DailyTipComp />));
        state.focused = true;
        await act(async () =>
            vi.advanceTimersByTime(DAILY_TIP_AUTO_SHOW_DELAY_MS),
        );
        expect(container.textContent).toContain('Hide for 30 days');
        await act(async () => root.unmount());
        expect(state.menu).toHaveBeenLastCalledWith('daily-tips', null);
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

    it('puts no automatic tip over Settings while no data folder is chosen', async () => {
        state.isOnOwnFolder = true;
        await act(async () => root.render(<DailyTipComp />));
        await act(async () =>
            vi.advanceTimersByTime(DAILY_TIP_AUTO_SHOW_DELAY_MS),
        );
        await act(async () => window.dispatchEvent(new Event('focus')));
        expect(container.textContent).toBe('');
        // Asked for from Help, a tip still opens.
        await sendMenu({ isOpenDailyTip: true });
        expect(container.textContent).toContain('Tip of the Day · Setting');
    });

    it('hides the automatic tip for 30 days and shows it again after them', async () => {
        // A launch is a fresh session: nothing shown yet, the wait from zero.
        const launch = async () => {
            await act(async () => root.unmount());
            sessionStorage.clear();
            root = createRoot(container);
            await act(async () => root.render(<DailyTipComp />));
            await act(async () =>
                vi.advanceTimersByTime(DAILY_TIP_AUTO_SHOW_DELAY_MS),
            );
        };
        await launch();
        expect(container.textContent).toContain('Tip of the Day · Setting');
        const button = [...container.querySelectorAll('button')].find(
            (element) => element.textContent === 'Hide for 30 days',
        )!;
        await act(async () => button.click());
        expect(container.textContent).toBe('');
        expect(state.settings.has('daily-tips-disabled')).toBe(false);

        await launch();
        expect(container.textContent).toBe('');
        // Help is never hidden, and asking there does not end the 30 days.
        await sendMenu({ isOpenDailyTip: true });
        expect(container.textContent).toContain('Tip of the Day · Setting');
        expect(container.textContent).not.toContain('Hide for 30 days');
        await launch();
        expect(container.textContent).toBe('');

        vi.setSystemTime(Date.now() + DAILY_TIPS_HIDE_MS);
        await launch();
        expect(container.textContent).toContain('Tip of the Day · Setting');
    });

    it('takes the tip off after a minute and holds it under the pointer', async () => {
        await act(async () => root.render(<DailyTipComp />));
        await sendMenu({ isOpenDailyTip: true });
        const card = container.querySelector<HTMLElement>('.app-daily-tip')!;
        const bar = card.querySelector('.app-daily-tip-countdown-bar')!;
        expect(bar.className).not.toContain('app-paused');
        await act(async () =>
            vi.advanceTimersByTime(DAILY_TIP_AUTO_CLOSE_MS / 2),
        );
        expect(container.textContent).not.toBe('');

        // Reading it holds the minute where it is: the bar stops with the
        // timer, and the half already spent is not handed back on leaving.
        await act(async () =>
            card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })),
        );
        expect(
            container.querySelector('.app-daily-tip-countdown-bar')!.className,
        ).toContain('app-paused');
        await act(async () => vi.advanceTimersByTime(DAILY_TIP_AUTO_CLOSE_MS));
        expect(container.textContent).not.toBe('');
        await act(async () =>
            card.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })),
        );
        await act(async () =>
            vi.advanceTimersByTime(DAILY_TIP_AUTO_CLOSE_MS / 2),
        );
        expect(container.textContent).toBe('');
    });

    it('starts the minute again on Next tip', async () => {
        await act(async () => root.render(<DailyTipComp />));
        await sendMenu({ isOpenDailyTip: true });
        await act(async () =>
            vi.advanceTimersByTime(DAILY_TIP_AUTO_CLOSE_MS - 1000),
        );
        const button = [...container.querySelectorAll('button')].find(
            (element) => element.textContent === 'Next tip',
        )!;
        await act(async () => button.click());
        await act(async () =>
            vi.advanceTimersByTime(DAILY_TIP_AUTO_CLOSE_MS - 1000),
        );
        expect(container.textContent).not.toBe('');
        await act(async () => vi.advanceTimersByTime(1000));
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
