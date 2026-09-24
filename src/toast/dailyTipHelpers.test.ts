import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PRESENTER_DEMO_IDS } from '../../tools/owa-devtools-mcp/presenterDemos.mjs';
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
    getDailyTipGuide,
    getDailyTipPage,
    getDailyTips,
    pickDailyTipIndex,
    rememberDailyTip,
    setAreDailyTipsEnabled,
    startDailyTipGuide,
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
        expect(getDailyTips('presenter').map(({ demoId }) => demoId)).toEqual(
            PRESENTER_DEMO_IDS,
        );
        expect(getDailyTips('presenter')).toHaveLength(56);
        expect(getDailyTips('reader').map(({ demoId }) => demoId)).toEqual(
            READER_DEMO_IDS,
        );
        expect(getDailyTips('reader')).toHaveLength(49);
    });

    it('keeps disruptive View commands in All tips, not the daily rotation', () => {
        for (const page of ['presenter', 'reader'] as const) {
            const tips = getDailyTips(page);
            expect(
                tips.find(({ id }) => id === `${page}-view-relaunch`)?.isDaily,
            ).toBe(false);
            expect(pickDailyTipIndex(page, tips, () => 0)).not.toBe(
                tips.findIndex(({ id }) => id === `${page}-view-reload`),
            );
        }
    });

    it('can send every tip as an inline guide to an older tool host', () => {
        for (const page of ['presenter', 'reader'] as const) {
            for (const tip of getDailyTips(page)) {
                const guide = getDailyTipGuide(page, tip);
                expect(guide?.title).toBe(tip.title);
                expect(guide?.steps.length).toBeGreaterThan(0);
                expect(
                    guide?.steps.every((step) => {
                        return step.text.length > 0 && !('finds' in step);
                    }),
                ).toBe(true);
                expect(guide?.mode).toMatch(/^(show|demo)$/);
            }
        }
    });

    it('retries an unknown built-in demo with its inline demo steps', async () => {
        const tip = getDailyTips('presenter').find(
            ({ id }) => id === 'presenter-build-flow',
        );
        expect(tip).toBeDefined();
        const callTool = vi
            .fn()
            .mockRejectedValueOnce(
                new Error('Unknown built-in demo "presenter-build-flow".'),
            )
            .mockResolvedValueOnce('{}');
        await startDailyTipGuide('presenter', tip!, callTool);
        expect(callTool).toHaveBeenNthCalledWith(1, 'owa_guide_start', {
            demoId: 'presenter-build-flow',
        });
        expect(callTool).toHaveBeenNthCalledWith(
            2,
            'owa_guide_start',
            expect.objectContaining({
                mode: 'demo',
                page: 'presenter.html',
                title: 'Build a service presenting flow',
                steps: expect.arrayContaining([
                    expect.objectContaining({
                        find: 'Presenting Flow List',
                        action: 'click',
                    }),
                ]),
            }),
        );
    });

    it('upgrades a stale show-only built-in to the current inline demo', async () => {
        const tip = getDailyTips('presenter').find(
            ({ id }) => id === 'presenter-build-flow',
        );
        expect(tip).toBeDefined();
        const callTool = vi
            .fn()
            .mockResolvedValueOnce('{"isRunning":true,"canDemo":false}')
            .mockResolvedValueOnce('{"isRunning":true,"canDemo":true}');

        await startDailyTipGuide('presenter', tip!, callTool);

        expect(callTool).toHaveBeenCalledTimes(2);
        expect(callTool).toHaveBeenNthCalledWith(
            2,
            'owa_guide_start',
            expect.objectContaining({
                mode: 'demo',
                page: 'presenter.html',
                steps: [
                    expect.objectContaining({
                        find: 'Presenting Flow List',
                        action: 'click',
                    }),
                ],
            }),
        );
    });

    it('does not hide a real guide-start failure behind the compatibility retry', async () => {
        const tip = getDailyTips('presenter')[0];
        const callTool = vi.fn().mockRejectedValue(new Error('Host offline'));
        await expect(
            startDailyTipGuide('presenter', tip, callTool),
        ).rejects.toThrow('Host offline');
        expect(callTool).toHaveBeenCalledTimes(1);
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
