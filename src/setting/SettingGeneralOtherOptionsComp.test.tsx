// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    getAreDailyTipsDisabledMock: vi.fn(() => true),
    setAreDailyTipsEnabledMock: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../toast/dailyTipSettingHelpers', () => ({
    getAreDailyTipsDisabled: h.getAreDailyTipsDisabledMock,
    setAreDailyTipsEnabled: h.setAreDailyTipsEnabledMock,
}));

vi.mock('./directory-setting/appLocalStorage', () => ({
    appLocalStorage: { clear: vi.fn() },
}));

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
});
