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
    DAILY_TIP_AUTO_SHOW_DELAY_MS,
    DAILY_TIP_LAUNCHED_AT_SESSION_KEY,
    DAILY_TIPS_DISABLED_SETTING_NAME,
    disableDailyTips,
    getAreDailyTipsDisabled,
    getDailyTipAutoShowDelay,
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
        expect(getDailyTips('presenter')).toHaveLength(74);
        expect(getDailyTips('reader').map(({ demoId }) => demoId)).toEqual(
            READER_DEMO_IDS,
        );
        expect(getDailyTips('reader')).toHaveLength(61);
    });

    it('files the added Reader practice demos under useful tip topics', () => {
        const tips = getDailyTips('reader');
        expect(
            tips.find(({ id }) => id === 'reader-clear-reference-part')
                ?.category,
        ).toBe('Getting started');
        for (const id of [
            'reader-bibles-section',
            'reader-notes-section',
            'reader-filter-notes',
            'reader-sort-notes',
        ]) {
            expect(tips.find((tip) => tip.id === id)?.category, id).toBe(
                'Notes and marks',
            );
        }
        for (const id of ['reader-open-settings', 'reader-open-help']) {
            expect(tips.find((tip) => tip.id === id)?.category, id).toBe(
                'Reader shortcuts',
            );
        }
    });

    it('covers every native menu from File through Help on both pages', () => {
        const suffixes = [
            'menu-file',
            'menu-edit',
            'menu-tools',
            'menu-window',
            'menu-help',
        ];
        for (const page of ['presenter', 'reader'] as const) {
            const tips = getDailyTips(page);
            for (const suffix of suffixes) {
                const tip = tips.find(({ id }) => id === `${page}-${suffix}`);
                expect(tip?.detail.length, `${page}-${suffix}`).toBeGreaterThan(
                    40,
                );
                expect(tip?.category, `${page}-${suffix}`).toMatch(/ menu$/);
                expect(
                    getDailyTipGuide(page, tip!)?.mode,
                    `${page}-${suffix}`,
                ).toBe('show');
            }
        }
    });

    // The browser searches title, detail and category, and a volunteer types
    // the word ON THE BUTTON. Written with friendly titles alone, the lesson
    // for the Countdown could not be found by searching "countdown" -- so each
    // one names its own component somewhere a search can reach.
    it('finds a foreground lesson by the name on its own launcher row', () => {
        const tips = getDailyTips('presenter');
        for (const name of [
            'Marquee Top',
            'Marquee Bottom',
            'Quick Text',
            'Countdown',
            'Stopwatch',
            'Time',
            'Video Show',
            'Image Show',
            'Camera Show',
            'Web Show',
        ]) {
            const found = tips.filter(({ title, detail, category }) => {
                return [title, detail, category ?? '']
                    .join(' ')
                    .toLocaleLowerCase()
                    .includes(name.toLocaleLowerCase());
            });
            expect(
                found.map(({ demoId }) => demoId),
                `no lesson names ${name}`,
            ).not.toHaveLength(0);
        }
    });

    it('files every foreground lesson under one heading', () => {
        const foreground = getDailyTips('presenter').filter(({ demoId }) => {
            return demoId.startsWith('presenter-foreground-');
        });
        expect(foreground).toHaveLength(15);
        expect(
            foreground.every(({ category }) => {
                return category === 'Foreground overlays';
            }),
        ).toBe(true);
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

    it('holds the automatic tip for five minutes from launch', () => {
        const storage = new Map<string, string>();
        const sessionStorage = {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => {
                storage.set(key, value);
            },
        };
        const launchedAt = 1_000_000;
        expect(getDailyTipAutoShowDelay(sessionStorage, launchedAt)).toBe(
            DAILY_TIP_AUTO_SHOW_DELAY_MS,
        );
        expect(DAILY_TIP_AUTO_SHOW_DELAY_MS).toBeGreaterThanOrEqual(
            5 * 60 * 1000,
        );
        expect(storage.get(DAILY_TIP_LAUNCHED_AT_SESSION_KEY)).toBe(
            `${launchedAt}`,
        );
        // A reload or page switch two minutes in keeps the launch's clock.
        expect(
            getDailyTipAutoShowDelay(sessionStorage, launchedAt + 120_000),
        ).toBe(DAILY_TIP_AUTO_SHOW_DELAY_MS - 120_000);
        expect(
            getDailyTipAutoShowDelay(
                sessionStorage,
                launchedAt + DAILY_TIP_AUTO_SHOW_DELAY_MS + 1,
            ),
        ).toBe(0);
        // A stamp that cannot be a past launch starts the wait again.
        storage.set(DAILY_TIP_LAUNCHED_AT_SESSION_KEY, 'not a time');
        expect(getDailyTipAutoShowDelay(sessionStorage, launchedAt)).toBe(
            DAILY_TIP_AUTO_SHOW_DELAY_MS,
        );
        storage.set(DAILY_TIP_LAUNCHED_AT_SESSION_KEY, `${launchedAt * 2}`);
        expect(getDailyTipAutoShowDelay(sessionStorage, launchedAt)).toBe(
            DAILY_TIP_AUTO_SHOW_DELAY_MS,
        );
    });
});
