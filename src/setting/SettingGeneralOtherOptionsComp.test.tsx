// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    getAreDailyTipsDisabledMock: vi.fn(() => true),
    setAreDailyTipsEnabledMock: vi.fn(),
    readDailyTipsHiddenAtMock: vi.fn((): number | null => null),
    showDailyTipsAgainMock: vi.fn(),
    readChatTipsHiddenAtMock: vi.fn((): number | null => null),
    showChatTipsMock: vi.fn(),
    readAiCautionHiddenTimeMock: vi.fn((): number | null => null),
    showAiCautionAgainMock: vi.fn(),
    readAiProviderWarnHiddenTimeMock: vi.fn((): number | null => null),
    showAiProviderWarnAgainMock: vi.fn(),
    readDataDirMoveHiddenAtMock: vi.fn((): number | null => null),
    showDataDirMoveAgainMock: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../toast/dailyTipSettingHelpers', () => ({
    getAreDailyTipsDisabled: h.getAreDailyTipsDisabledMock,
    setAreDailyTipsEnabled: h.setAreDailyTipsEnabledMock,
    readDailyTipsHiddenAt: h.readDailyTipsHiddenAtMock,
    showDailyTipsAgain: h.showDailyTipsAgainMock,
}));

vi.mock('../chatbot/tipHelpers', () => ({
    readChatTipsHiddenAt: h.readChatTipsHiddenAtMock,
    showChatTips: h.showChatTipsMock,
}));

vi.mock('../helper/ai/aiCautionHelpers', () => ({
    readAiCautionHiddenTime: h.readAiCautionHiddenTimeMock,
    showAiCautionAgain: h.showAiCautionAgainMock,
    readAiProviderWarnHiddenTime: h.readAiProviderWarnHiddenTimeMock,
    showAiProviderWarnAgain: h.showAiProviderWarnAgainMock,
}));

vi.mock('./directory-setting/dataDirMoveHelpers', () => ({
    readDataDirMoveHiddenAt: h.readDataDirMoveHiddenAtMock,
    showDataDirMoveAgain: h.showDataDirMoveAgainMock,
}));

vi.mock('./directory-setting/appLocalStorage', () => ({
    DATA_DIR_MOVE_HIDE_CHANGED_EVENT_NAME: 'data-dir-move-hide-changed',
    appLocalStorage: { clear: vi.fn() },
}));
vi.mock('../helper/appHooks', async () => {
    const React = await import('react');
    return { useAppEffect: React.useEffect };
});

vi.mock('./SettingApplyComp', () => ({
    applyStore: { pendingApply: vi.fn() },
}));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: vi.fn(async () => false),
}));

import SettingGeneralOtherOptionsComp from './SettingGeneralOtherOptionsComp';

let container: HTMLDivElement;
let root: Root | null = null;

describe('SettingGeneralOtherOptionsComp', () => {
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        h.getAreDailyTipsDisabledMock.mockReturnValue(true);
        h.readDailyTipsHiddenAtMock.mockReturnValue(null);
        h.readChatTipsHiddenAtMock.mockReturnValue(null);
        h.readAiCautionHiddenTimeMock.mockReturnValue(null);
        h.readAiProviderWarnHiddenTimeMock.mockReturnValue(null);
        h.readDataDirMoveHiddenAtMock.mockReturnValue(null);
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => root?.unmount());
            root = null;
        }
        container.remove();
    });

    test('restores automatic tips with the General setting switch', async () => {
        await act(async () => {
            root = createRoot(container);
            root.render(<SettingGeneralOtherOptionsComp />);
        });
        const input = container.querySelector(
            '#setting-daily-tips-enabled',
        ) as HTMLInputElement;
        expect(input.checked).toBe(false);
        expect(container.textContent).toContain(
            'Show Tips of the Day automatically',
        );

        await act(async () => input.click());

        expect(input.checked).toBe(true);
        expect(h.setAreDailyTipsEnabledMock).toHaveBeenCalledWith(true);
    });

    test('lists nothing extra while nothing is hidden for 30 days', async () => {
        await act(async () => {
            root = createRoot(container);
            root.render(<SettingGeneralOtherOptionsComp />);
        });
        expect(container.textContent).not.toContain('Put away for 30 days');
        expect(container.textContent).not.toContain('Show again');
    });

    test('lists what is hidden and brings it back on a press', async () => {
        const until = Date.now() + 30 * 24 * 60 * 60 * 1000;
        h.readAiProviderWarnHiddenTimeMock.mockReturnValue(until);
        await act(async () => {
            root = createRoot(container);
            root.render(<SettingGeneralOtherOptionsComp />);
        });
        expect(container.textContent).toContain('Put away for 30 days');
        expect(container.textContent).toContain(
            'The notice about the free AI service',
        );
        expect(container.textContent).not.toContain('Tips in the help window');
        const button = Array.from(container.querySelectorAll('button')).find(
            (one) => one.textContent === 'Show again',
        );
        expect(button).toBeDefined();

        // Restored: the row leaves the list.
        h.readAiProviderWarnHiddenTimeMock.mockReturnValue(null);
        await act(async () => button?.click());

        expect(h.showAiProviderWarnAgainMock).toHaveBeenCalledTimes(1);
        expect(container.textContent).not.toContain('Put away for 30 days');
    });
    test('a row put away while the list is open shows up, when told and on focus', async () => {
        await act(async () => {
            root = createRoot(container);
            root.render(<SettingGeneralOtherOptionsComp />);
        });
        expect(container.textContent).not.toContain('Show again');
        // The Desktop card in this window puts the move question away.
        const until = Date.now() + 30 * 24 * 60 * 60 * 1000;
        h.readDataDirMoveHiddenAtMock.mockReturnValue(until);
        await act(async () => {
            globalThis.dispatchEvent(new Event('data-dir-move-hide-changed'));
        });
        expect(container.textContent).toContain(
            'The suggestion to move the data folder',
        );
        expect(container.textContent).toContain('Show again');
        // A tip put away in another window: read as this one comes to the front.
        h.readChatTipsHiddenAtMock.mockReturnValue(until);
        await act(async () => {
            globalThis.dispatchEvent(new Event('focus'));
        });
        expect(container.textContent).toContain('Tips in the help window');
    });
});
