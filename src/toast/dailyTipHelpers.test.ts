import { beforeEach, describe, expect, it, vi } from 'vitest';

import { READER_DEMO_IDS } from '../../tools/owa-devtools-mcp/readerDemos.mjs';

const settingValues = new Map<string, string>();

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => settingValues.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        settingValues.set(key, value);
    },
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

import {
    DAILY_TIPS_DISABLED_SETTING_NAME,
    disableDailyTips,
    getAreDailyTipsDisabled,
    getDailyTipPage,
    getDailyTips,
    pickDailyTipIndex,
    rememberDailyTip,
    setAreDailyTipsEnabled,
} from './dailyTipHelpers';

describe('daily tip helpers', () => {
    beforeEach(() => {
        settingValues.clear();
    });

    it('recognizes only the two pages that have tips', () => {
        expect(getDailyTipPage('/presenter.html')).toBe('presenter');
        expect(getDailyTipPage('/reader.html')).toBe('reader');
        expect(getDailyTipPage('/setting.html')).toBeNull();
    });

    it('keeps tips page-specific and connected to built-in demos', () => {
        expect(
            getDailyTips('presenter').every(({ demoId }) => {
                return demoId.startsWith('presenter-');
            }),
        ).toBe(true);
        expect(
            getDailyTips('reader').every(({ demoId }) => {
                return demoId.startsWith('reader-');
            }),
        ).toBe(true);
        expect(getDailyTips('reader').map(({ demoId }) => demoId)).toEqual(
            READER_DEMO_IDS,
        );
        expect(getDailyTips('reader')).toHaveLength(49);
    });

    it('keeps disruptive View commands in All tips, not the daily rotation', () => {
        const tips = getDailyTips('reader');
        expect(
            tips.find(({ id }) => id === 'reader-view-relaunch')?.isDaily,
        ).toBe(false);
        expect(pickDailyTipIndex('reader', tips, () => 0)).not.toBe(
            tips.findIndex(({ id }) => id === 'reader-view-reload'),
        );
    });

    it('does not randomly repeat the last tip on a page', () => {
        const tips = getDailyTips('reader');
        rememberDailyTip('reader', tips[0]);
        expect(pickDailyTipIndex('reader', tips, () => 0)).toBe(1);
    });

    it('stores the global automatic-tip opt-out', () => {
        expect(getAreDailyTipsDisabled()).toBe(false);
        disableDailyTips();
        expect(settingValues.get(DAILY_TIPS_DISABLED_SETTING_NAME)).toBe(
            'true',
        );
        expect(getAreDailyTipsDisabled()).toBe(true);
        setAreDailyTipsEnabled(true);
        expect(settingValues.get(DAILY_TIPS_DISABLED_SETTING_NAME)).toBe(
            'false',
        );
        expect(getAreDailyTipsDisabled()).toBe(false);
    });
});
