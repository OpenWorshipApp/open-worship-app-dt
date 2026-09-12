/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        isPagePresenter: true,
        managers: [] as any[],
    };
});

vi.mock('../server/appProvider', () => ({
    default: {
        get isPagePresenter() {
            return h.isPagePresenter;
        },
        pathUtils: {
            sep: '\\',
            join: (...parts: string[]) => parts.join('\\'),
            basename: (filePath: string) => {
                return filePath.split(/[\\/]/).pop() ?? '';
            },
            dirname: (filePath: string) => {
                return filePath.replace(/[\\/][^\\/]*$/, '');
            },
        },
        systemUtils: { isDev: false },
    },
}));
vi.mock('../_screen/managers/screenManagerHelpers', () => ({
    getAllScreenManagers: () => h.managers,
}));
vi.mock('../lyric-list/markdownHelpers', () => ({
    renderMarkdown: async (text: string) => ({ html: `<p>${text}</p>` }),
}));

import {
    AGENT_FOREGROUND_ACTIONS,
    AGENT_FOREGROUND_WIDGETS,
    handleAgentForegroundRequest,
    parseClockTimeToday,
} from './agentForegroundHelpers';
import {
    AGENT_FOREGROUND_ACTIONS as MJS_ACTIONS,
    AGENT_FOREGROUND_WIDGETS as MJS_WIDGETS,
} from '../../tools/owa-devtools-mcp/agentForeground.mjs';

// A stand-in for `ScreenForegroundManager`: the data object the summary
// reads, and the setters the widget's own Start button calls.
function genForegroundManager() {
    const manager: any = {
        foregroundData: {
            countdownData: null,
            stopwatchData: null,
            timeDataList: [],
            marqueeTopData: null,
            marqueeBottomData: null,
            quickTextData: null,
            cameraDataList: [],
            webDataList: [],
        },
        calls: [] as string[],
    };
    const setter = (key: string) => {
        return (data: any) => {
            manager.calls.push(key);
            manager.foregroundData[key] = data;
        };
    };
    manager.setCountdownData = setter('countdownData');
    manager.setStopwatchData = setter('stopwatchData');
    manager.setMarqueeTopData = setter('marqueeTopData');
    manager.setMarqueeBottomData = setter('marqueeBottomData');
    manager.setQuickTextData = setter('quickTextData');
    manager.setTimeDataList = setter('timeDataList');
    manager.addTimeData = (data: any) => {
        manager.calls.push('addTimeData');
        manager.foregroundData.timeDataList.push(data);
    };
    manager.clear = () => {
        manager.calls.push('clear');
        manager.foregroundData = genForegroundManager().foregroundData;
    };
    return manager;
}

function genManager(screenId: number, extra: any = {}) {
    return {
        screenId,
        isShowing: false,
        isLocked: false,
        isSelected: true,
        isDeleted: false,
        screenForegroundManager: genForegroundManager(),
        ...extra,
    };
}

// A fixed "now": 10:00 in the morning, local time.
const NOW = new Date(2026, 8, 11, 10, 0, 0, 0);

beforeEach(() => {
    h.isPagePresenter = true;
    h.managers = [genManager(0)];
});

describe('the widget and action lists', () => {
    it('are the same on the app side and the tool side', () => {
        expect([...AGENT_FOREGROUND_WIDGETS]).toEqual([...MJS_WIDGETS]);
        expect([...AGENT_FOREGROUND_ACTIONS]).toEqual([...MJS_ACTIONS]);
    });
});

describe('parseClockTimeToday', () => {
    it('reads the shapes a person writes, as a time later today', () => {
        for (const [text, hours, minutes] of [
            ['10:30', 10, 30],
            ['18:30', 18, 30],
            ['6:45 pm', 18, 45],
            ['6.45pm', 18, 45],
            ['7pm', 19, 0],
            ['12:15 am', 0, 15],
        ] as const) {
            const now = new Date(2026, 8, 11, 0, 0, 0, 0);
            const parsed = parseClockTimeToday(text, now);
            expect(parsed, text).toBeInstanceOf(Date);
            expect((parsed as Date).getHours(), text).toBe(hours);
            expect((parsed as Date).getMinutes(), text).toBe(minutes);
        }
    });

    it('is null for words that are not a time, and a bare number', () => {
        expect(parseClockTimeToday('soon', NOW)).toBeNull();
        expect(parseClockTimeToday('10', NOW)).toBeNull();
    });

    it('refuses a time already gone by, and one that is not on a clock', () => {
        expect(parseClockTimeToday('9:30', NOW)).toMatchObject({
            isError: true,
            reason: expect.stringContaining('has already passed today'),
        });
        expect(parseClockTimeToday('25:00', NOW)).toMatchObject({
            isError: true,
            reason: expect.stringContaining('not a time of day'),
        });
    });
});

describe('handleAgentForegroundRequest', () => {
    it('starts a duration countdown on the ticked screen and reads it back', async () => {
        const result = await handleAgentForegroundRequest(
            { widget: 'countdown', minutes: 5 },
            NOW,
        );
        expect(result).toMatchObject({
            did: 'started',
            widget: 'countdown',
            isAnyShowing: false,
        });
        expect((result as any).detail).toContain(
            'a 5 minute countdown, ending at',
        );
        const manager = h.managers[0].screenForegroundManager;
        expect(manager.calls).toEqual(['countdownData']);
        // The widget's own arithmetic: five minutes and one second on.
        expect(manager.foregroundData.countdownData.dateTime.getTime()).toBe(
            NOW.getTime() + (5 * 60 + 1) * 1000,
        );
        expect((result as any).screens[0].foreground[0]).toMatch(
            /^countdown to /,
        );
        // An off screen holds it and shows nothing: said, with the
        // instruction to OFFER the show button rather than press it.
        expect((result as any).note).toContain('OFF');
        expect((result as any).note).toContain('do not press it unasked');
    });

    it('says nothing about an off screen once it is showing', async () => {
        h.managers = [genManager(0, { isShowing: true })];
        const result = await handleAgentForegroundRequest(
            { widget: 'countdown', minutes: 5 },
            NOW,
        );
        expect(result).toMatchObject({ did: 'started', isAnyShowing: true });
        expect((result as any).note).toBeUndefined();
    });

    it('counts down to a clock time later today', async () => {
        const result = await handleAgentForegroundRequest(
            { widget: 'countdown', at: '6:45 pm' },
            NOW,
        );
        expect(result).toMatchObject({ did: 'started' });
        expect((result as any).detail).toMatch(/^a countdown to 6:45/);
        const target = h.managers[0].screenForegroundManager.foregroundData
            .countdownData.dateTime as Date;
        expect(target.getHours()).toBe(18);
        expect(target.getMinutes()).toBe(45);
    });

    it('refuses a countdown with no length and one gone by, in sentences', async () => {
        expect(
            await handleAgentForegroundRequest({ widget: 'countdown' }, NOW),
        ).toMatchObject({
            isError: true,
            reason: expect.stringContaining('Say how long'),
        });
        expect(
            await handleAgentForegroundRequest(
                { widget: 'countdown', at: '9:00' },
                NOW,
            ),
        ).toMatchObject({
            isError: true,
            reason: expect.stringContaining('has already passed today'),
        });
        expect(
            await handleAgentForegroundRequest(
                { widget: 'countdown', at: 'later' },
                NOW,
            ),
        ).toMatchObject({
            isError: true,
            reason: expect.stringContaining('not a time of day'),
        });
        expect(
            await handleAgentForegroundRequest(
                { widget: 'countdown', minutes: 5000 },
                NOW,
            ),
        ).toMatchObject({
            isError: true,
            reason: expect.stringContaining('outside that'),
        });
        expect(h.managers[0].screenForegroundManager.calls).toEqual([]);
    });

    it('scrolls a message along the bottom at the default pace', async () => {
        const result = await handleAgentForegroundRequest({
            widget: 'marquee-bottom',
            text: '  Please silence   your phones ',
        });
        expect(result).toMatchObject({
            did: 'started',
            widget: 'marquee-bottom',
        });
        expect((result as any).detail).toBe(
            'a message scrolling along the bottom: "Please silence your phones"',
        );
        const manager = h.managers[0].screenForegroundManager;
        expect(manager.foregroundData.marqueeBottomData).toEqual({
            text: 'Please silence your phones',
            speedPercentage: 100,
            extraStyle: {},
        });
        expect((result as any).screens[0].foreground[0]).toContain(
            'marquee at the bottom: "Please silence your phones"',
        );
    });

    it('refuses a marquee with no words, and one the length of a sermon', async () => {
        expect(
            await handleAgentForegroundRequest({ widget: 'marquee-top' }),
        ).toMatchObject({
            isError: true,
            reason: expect.stringContaining('Say the words to scroll'),
        });
        expect(
            await handleAgentForegroundRequest({
                widget: 'marquee-top',
                text: 'x'.repeat(301),
            }),
        ).toMatchObject({
            isError: true,
            reason: expect.stringContaining('at most 300'),
        });
    });

    it('shows a quick text for ten seconds unless told otherwise, as the widget renders it', async () => {
        const result = await handleAgentForegroundRequest({
            widget: 'quick-text',
            text: 'Coffee after the service',
        });
        expect((result as any).detail).toBe(
            'a line of text for 10 seconds: "Coffee after the service"',
        );
        const manager = h.managers[0].screenForegroundManager;
        expect(manager.foregroundData.quickTextData).toEqual({
            htmlText: '<p>Coffee after the service</p>',
            timeSecondDelay: 0,
            timeSecondToLive: 10,
            extraStyle: {},
        });
        await handleAgentForegroundRequest({
            widget: 'quick-text',
            text: 'Welcome',
            seconds: 30,
        });
        expect(manager.foregroundData.quickTextData.timeSecondToLive).toBe(30);
    });

    it('puts a clock up with the widget defaults, and a stopwatch from now', async () => {
        await handleAgentForegroundRequest({ widget: 'clock' }, NOW);
        const manager = h.managers[0].screenForegroundManager;
        expect(manager.foregroundData.timeDataList).toHaveLength(1);
        expect(manager.foregroundData.timeDataList[0]).toMatchObject({
            title: null,
            is24HourFormat: false,
            timezoneMinuteOffset: -NOW.getTimezoneOffset() / 60,
        });
        const result = await handleAgentForegroundRequest(
            { widget: 'stopwatch' },
            NOW,
        );
        expect((result as any).detail).toMatch(/^a stopwatch, started at /);
        expect(manager.foregroundData.stopwatchData.dateTime).toBe(NOW);
    });

    it('stops one extra, says when there was none, and clears them all', async () => {
        await handleAgentForegroundRequest(
            { widget: 'countdown', minutes: 5 },
            NOW,
        );
        const stopped = await handleAgentForegroundRequest({
            action: 'stop',
            widget: 'countdown',
        });
        expect(stopped).toMatchObject({
            did: 'stopped',
            detail: 'The countdown is off the screen now.',
        });
        expect((stopped as any).note).toBeUndefined();
        const manager = h.managers[0].screenForegroundManager;
        expect(manager.foregroundData.countdownData).toBeNull();

        const again = await handleAgentForegroundRequest({
            action: 'stop',
            widget: 'countdown',
        });
        expect((again as any).note).toContain('There was no countdown');

        await handleAgentForegroundRequest({ widget: 'clock' });
        const all = await handleAgentForegroundRequest({
            action: 'stop',
            widget: 'all',
        });
        expect(all).toMatchObject({
            did: 'stopped',
            detail: 'Every foreground extra is off the screen now.',
        });
        expect(manager.calls).toContain('clear');
    });

    it('refuses to START all, and names the extras for an unknown one', async () => {
        expect(
            await handleAgentForegroundRequest({ widget: 'all' }),
        ).toMatchObject({
            isError: true,
            reason: expect.stringContaining('only stops'),
        });
        expect(
            await handleAgentForegroundRequest({ widget: 'confetti' }),
        ).toMatchObject({
            isError: true,
            reason: expect.stringContaining(
                'There is no extra called "confetti"',
            ),
        });
        expect(await handleAgentForegroundRequest({})).toMatchObject({
            isError: true,
            reason: expect.stringContaining('Say which extra to start'),
        });
    });

    it('checks without touching a screen, and says what each holds', async () => {
        const empty = await handleAgentForegroundRequest({ action: 'check' });
        expect(empty).toMatchObject({
            did: 'checked',
            detail: 'No foreground extra is on any screen.',
        });
        await handleAgentForegroundRequest({
            widget: 'marquee-bottom',
            text: 'Welcome',
        });
        const held = await handleAgentForegroundRequest({ action: 'check' });
        expect((held as any).detail).toBe(
            'Screen 0 holds marquee at the bottom: "Welcome" (off).',
        );
        expect((held as any).note).toContain('Nothing was changed');
    });

    it('refuses off the Presenter, with no ticked screen, and on a locked one', async () => {
        h.isPagePresenter = false;
        expect(
            await handleAgentForegroundRequest({ widget: 'clock' }),
        ).toMatchObject({
            isError: true,
            reason: expect.stringContaining('started from the Presenter page'),
        });
        h.isPagePresenter = true;
        h.managers = [genManager(0, { isSelected: false })];
        expect(
            await handleAgentForegroundRequest({ widget: 'clock' }),
        ).toMatchObject({
            isError: true,
            reason: expect.stringContaining('No screen is chosen'),
        });
        h.managers = [genManager(0, { isLocked: true })];
        expect(
            await handleAgentForegroundRequest({ widget: 'clock' }),
        ).toMatchObject({
            isError: true,
            reason: expect.stringContaining('Screen 0 is locked'),
        });
        expect(h.managers[0].screenForegroundManager.calls).toEqual([]);
    });

    it('steps over a locked screen when another ticked one is free', async () => {
        h.managers = [genManager(0, { isLocked: true }), genManager(1)];
        const result = await handleAgentForegroundRequest(
            { widget: 'countdown', minutes: 2 },
            NOW,
        );
        expect(result).toMatchObject({ did: 'started' });
        expect(h.managers[0].screenForegroundManager.calls).toEqual([]);
        expect(h.managers[1].screenForegroundManager.calls).toEqual([
            'countdownData',
        ]);
        expect((result as any).note).toContain(
            'Screen 0 is locked and was left as it was',
        );
        expect((result as any).note).toContain('Screen 1 holds it but is OFF');
    });
});
