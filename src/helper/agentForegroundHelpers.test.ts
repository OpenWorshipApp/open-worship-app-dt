import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        isPagePresenter: true,
        managers: [] as any[],
        settings: new Map<string, string>(),
        restoresList: [] as any[][],
        appendedList: [] as any[][],
        notified: [] as string[],
        opened: [] as string[],
        presets: [] as [string, string][],
        longTextHidden: [] as [string, number | undefined][],
    };
});

vi.mock('../server/appProvider', () => ({
    default: {
        get isPagePresenter() {
            return h.isPagePresenter;
        },
    },
}));
vi.mock('./settingHelpers', () => ({
    getSetting: (key: string) => h.settings.get(key) ?? null,
    setSetting: (key: string, value: string | null) => {
        h.settings.set(key, value ?? '');
    },
    removeSetting: (key: string) => {
        h.settings.delete(key);
    },
}));
vi.mock('../_screen/managers/screenManagerHelpers', () => ({
    getAllScreenManagers: () => h.managers,
}));
vi.mock('../_screen/managers/ScreenLongTextManager', () => ({
    default: {
        getLongTextShowingList: () => [],
        hideLongText: (sourceId: string, screenId?: number) => {
            h.longTextHidden.push([sourceId, screenId]);
        },
        restyleLongText: () => {},
        getInstance: () => null,
    },
}));
// The Properties panel's own style, marked so a test can tell whose it is.
vi.mock('../presenter-foreground/propertiesSettingHelpers', () => ({
    genForegroundExtraStyle: (prefix: string) => {
        return {
            look: prefix,
            fontSize: `${h.settings.get(`${prefix}-setting-show-widget-font-size`) ?? 100}px`,
        };
    },
    getForegroundIsBehind: () => false,
    getForegroundWidthScale: () => 50,
}));
vi.mock('../presenter-foreground/foregroundTransitionHelpers', () => ({
    resolveForegroundTransition: () => undefined,
}));
vi.mock('../presenter-foreground/foregroundSessionHelpers', () => ({
    checkIsSessionData: (
        data: { id?: string },
        sessionId: string,
        sessionIds: string[],
    ) => {
        const owner = data.id ?? '';
        const resolved =
            sessionIds.length === 0 || sessionIds.includes(owner)
                ? owner
                : sessionIds[0];
        return resolved === sessionId;
    },
}));
vi.mock('../presenter-foreground/ForegroundSoundControlComp', () => ({
    getForegroundSoundData: () => ({ isSoundOn: false, soundVolume: 100 }),
}));
vi.mock('../presenter-foreground/foregroundPanelRevisionHelpers', () => ({
    notifyForegroundPanel: (key: string) => {
        h.notified.push(key);
    },
}));
vi.mock('../presenter-foreground/foregroundWidgetHelpers', () => ({
    FOREGROUND_OPEN_PANELS_SETTING_NAME: 'foreground-open-panels',
    requestForegroundPanelOpening: (key: string) => {
        h.opened.push(key);
        return true;
    },
    toOpenedPanelKeys: (raw: string, key: string) => `${raw},${key}`,
}));
vi.mock('../presenter-foreground/quickTextPresetHelpers', () => ({
    applyQuickTextPreset: (suffix: string, presetId: string) => {
        h.presets.push([suffix, presetId]);
        return true;
    },
}));
vi.mock('../lyric-list/markdownHelpers', () => ({
    renderMarkdown: async (text: string) => ({ html: `<p>${text}</p>` }),
}));
vi.mock('./agentBibleHelpers', () => ({
    resolveVersionOrder: async () => ({ order: ['KJV'], installed: ['KJV'] }),
    resolveBibleItem: async (reference: string) => {
        return reference === 'John 3:16'
            ? {
                  toText: async () => 'For God so loved the world.',
              }
            : null;
    },
}));
vi.mock('../presenter-foreground/foregroundQuickTextOpenHelpers', () => ({
    genBibleItemQuickTextMarkdown: async () => ({
        title: '(KJV) John 3:16',
        markdown: '**(KJV) John 3:16**\n\nFor God so loved the world.',
        fontFamily: 'app-Sample Serif',
    }),
    applyBibleVerseFont: (suffix: string, fontFamily: string) => {
        h.settings.set(`quick-text${suffix}-common-font-family`, fontFamily);
    },
}));
vi.mock('../presenter-foreground/ForegroundMessageComp', () => ({
    toStoredText: (list: { text: string }[]) => {
        return list
            .map((one) => {
                return one.text;
            })
            .join('\n\n');
    },
}));
vi.mock('./agentScreenHelpers', () => ({
    toForegroundSummary: (data: any) => {
        return Object.entries(data ?? {})
            .filter(([, value]) => {
                return Array.isArray(value) ? value.length > 0 : value !== null;
            })
            .map(([key]) => key);
    },
    // A stand-in for the text layer's line: `{ longText: 'title' }`.
    toLongTextSummary: (viewData: any) => {
        return viewData?.longText ? [`long text "${viewData.longText}"`] : [];
    },
}));
vi.mock('./agentBackupHelpers', () => ({
    runWithAgentBackup: async (
        _summary: string,
        restores: any[],
        change: () => Promise<unknown>,
    ) => {
        h.restoresList.push(restores);
        return { meta: { id: 'undo-1' }, value: await change() };
    },
    genUndoField: (meta: { id: string }) => ({ undoId: meta.id }),
    // What a show did to the screens joins the backup after it (EC-540).
    appendAgentBackupRestores: async (_id: string, restores: any[]) => {
        h.appendedList.push(restores);
    },
}));

import {
    AGENT_FOREGROUND_ACTIONS,
    AGENT_FOREGROUND_EDIT_ACTIONS,
    AGENT_FOREGROUND_WIDGETS,
    handleAgentForegroundRequest,
    parseClockTimeToday,
} from './agentForegroundHelpers';
import {
    AGENT_FOREGROUND_ACTIONS as MJS_ACTIONS,
    AGENT_FOREGROUND_WIDGETS as MJS_WIDGETS,
} from '../../tools/owa-devtools-mcp/agentForeground.mjs';
import {
    FOREGROUND_EDIT_ACTIONS as MJS_EDIT_ACTIONS,
    FOREGROUND_TIMER_DOS as MJS_TIMER_DOS,
} from '../../tools/owa-devtools-mcp/agentForegroundEdit.mjs';
import { AGENT_FOREGROUND_TIMER_DOS } from './agentForegroundComponentHelpers';

// A stand-in for `ScreenForegroundManager`: the data object the screens hold,
// and the setters the panels' own Show buttons call.
function genForegroundManager() {
    const manager: any = {
        foregroundData: {
            messageDataList: [],
            countdownDataList: [],
            stopwatchDataList: [],
            timeDataList: [],
            marqueeTopDataList: [],
            marqueeBottomDataList: [],
            quickTextDataList: [],
            cameraDataList: [],
            screenDataList: [],
            webDataList: [],
            videoDataList: [],
            imageDataList: [],
        },
        calls: [] as string[],
    };
    const setter = (key: string) => {
        return (data: any) => {
            manager.calls.push(key);
            manager.foregroundData = { ...manager.foregroundData, [key]: data };
        };
    };
    // The per-session lists: a session's entry is put or taken off by its
    // `id` (none for Default), every other session's left as it was -- the
    // real manager's `putSessionData` / `removeSessionData`.
    const toSessionKey = (data: any) => {
        return typeof data?.id === 'string' ? data.id : '';
    };
    manager.putSessionData = (key: string, data: any) => {
        manager.calls.push(`put:${key}`);
        const dataList: any[] = manager.foregroundData[key];
        const index = dataList.findIndex((one) => {
            return toSessionKey(one) === toSessionKey(data);
        });
        manager.foregroundData = {
            ...manager.foregroundData,
            [key]:
                index === -1
                    ? [...dataList, data]
                    : dataList.map((one, oneIndex) => {
                          return oneIndex === index ? data : one;
                      }),
        };
    };
    manager.removeSessionData = (key: string, data: any) => {
        manager.calls.push(`remove:${key}`);
        manager.foregroundData = {
            ...manager.foregroundData,
            [key]:
                data === null
                    ? []
                    : manager.foregroundData[key].filter((one: any) => {
                          return toSessionKey(one) !== toSessionKey(data);
                      }),
        };
    };
    for (const [name, key] of [
        ['setCountdownData', 'countdownDataList'],
        ['setStopwatchData', 'stopwatchDataList'],
        ['setMarqueeTopData', 'marqueeTopDataList'],
        ['setMarqueeBottomData', 'marqueeBottomDataList'],
        ['setQuickTextData', 'quickTextDataList'],
    ]) {
        manager[name] = (data: any) => {
            manager.putSessionData(key, data);
        };
    }
    for (const key of [
        'timeDataList',
        'messageDataList',
        'videoDataList',
        'imageDataList',
        'webDataList',
        'cameraDataList',
        'screenDataList',
    ]) {
        manager[`set${key.charAt(0).toUpperCase()}${key.slice(1)}`] =
            setter(key);
    }
    manager.addTimeData = (data: any) => {
        manager.calls.push('addTimeData');
        manager.foregroundData = {
            ...manager.foregroundData,
            timeDataList: [
                ...manager.foregroundData.timeDataList.filter((one: any) => {
                    return one.id !== data.id;
                }),
                data,
            ],
        };
    };
    manager.removeTimeData = (data: any) => {
        manager.calls.push('removeTimeData');
        manager.foregroundData = {
            ...manager.foregroundData,
            timeDataList: manager.foregroundData.timeDataList.filter(
                (one: any) => {
                    return one !== data;
                },
            ),
        };
    };
    return manager;
}

function genManager(screenId: number, extra: any = {}) {
    const screenManager: any = {
        screenId,
        isShowing: false,
        isLocked: false,
        isSelected: true,
        isDeleted: false,
        screenForegroundManager: genForegroundManager(),
        screenLongTextManager: { screenViewData: null },
        ...extra,
    };
    screenManager.clearForeground = () => {
        screenManager.screenForegroundManager.calls.push('clearForeground');
        screenManager.screenForegroundManager.foregroundData =
            genForegroundManager().foregroundData;
    };
    return screenManager;
}

function dataOf(index = 0) {
    return h.managers[index].screenForegroundManager.foregroundData;
}

// A fixed "now": 10:00 in the morning, local time.
const NOW = new Date(2026, 8, 11, 10, 0, 0, 0);

beforeEach(() => {
    h.isPagePresenter = true;
    h.managers = [genManager(0)];
    h.settings.clear();
    h.restoresList = [];
    h.appendedList = [];
    h.notified = [];
    h.opened = [];
    h.presets = [];
    h.longTextHidden = [];
});

describe('the lists the tools are held to', () => {
    it('are the same on the app side and the tool side', () => {
        expect([...AGENT_FOREGROUND_WIDGETS]).toEqual([...MJS_WIDGETS]);
        expect([...AGENT_FOREGROUND_ACTIONS]).toEqual([...MJS_ACTIONS]);
        expect([...AGENT_FOREGROUND_EDIT_ACTIONS]).toEqual([
            ...MJS_EDIT_ACTIONS,
        ]);
        expect([...AGENT_FOREGROUND_TIMER_DOS]).toEqual([...MJS_TIMER_DOS]);
    });
});

describe('parseClockTimeToday', () => {
    it('reads the shapes a person writes, as a time later today', () => {
        for (const [text, hours, minutes] of [
            ['10:30', 10, 30],
            ['6:45 pm', 18, 45],
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

    it('is null for a bare number and refuses a time gone by', () => {
        expect(parseClockTimeToday('10', NOW)).toBeNull();
        expect(parseClockTimeToday('9:30', NOW)).toMatchObject({
            reason: expect.stringContaining('has already passed today'),
        });
    });
});

describe('a countdown started through its panel', () => {
    it('uses the Default session when it already holds five minutes', async () => {
        const result: any = await handleAgentForegroundRequest(
            { widget: 'countdown', minutes: 5 },
            NOW,
        );
        expect(result).toMatchObject({
            did: 'started',
            component: 'Countdown',
            session: { id: '', isNew: false },
            isChanged: true,
            undoId: 'undo-1',
        });
        expect(dataOf().countdownDataList).toHaveLength(1);
        const countdown = dataOf().countdownDataList[0];
        // The Default session's own look, a datum with no session id (the
        // Default panel's own), running at once with its length kept.
        expect(countdown.extraStyle.look).toBe('countdown');
        expect(countdown.id).toBeUndefined();
        expect(countdown.dateTime.getTime()).toBe(NOW.getTime() + 300000);
        expect(countdown.durationMillisecond).toBe(300000);
        expect(countdown.pausedMillisecond).toBeUndefined();
        expect(h.settings.get('foreground-countdown-sessions')).toBeUndefined();
        // An off screen holds it unseen: offered, never pressed.
        expect(result.note).toContain('Never turn it on unasked');
        // It can, on a yes: a bare ban was read as "I can't" (EC-586).
        expect(result.note).toContain('you can: on a yes, owa_click');
        expect(result.note).toContain('never tell them you cannot');
        expect(h.notified).toEqual(['countdown']);
        expect(h.opened).toEqual(['countdown']);
    });

    it('puts new minutes into a NEW session that looks like the current one', async () => {
        h.settings.set('countdown-setting-show-widget-font-size', '60');
        const result: any = await handleAgentForegroundRequest(
            { widget: 'countdown', minutes: 10 },
            NOW,
        );
        expect(result.session).toMatchObject({ name: '10:00', isNew: true });
        const sessionId = result.session.id;
        const sessions = JSON.parse(
            h.settings.get('foreground-countdown-sessions') ?? '[]',
        );
        expect(sessions).toEqual([
            { id: '', name: 'Default' },
            { id: sessionId, name: '10:00' },
        ]);
        expect(h.settings.get('foreground-countdown-active-session')).toBe(
            sessionId,
        );
        expect(h.settings.get(`foreground-minutes-setting-${sessionId}`)).toBe(
            '10',
        );
        // The Default session's 60px went with it, and the datum wears it.
        expect(
            h.settings.get(
                `countdown-${sessionId}-setting-show-widget-font-size`,
            ),
        ).toBe('60');
        expect(dataOf().countdownDataList).toHaveLength(1);
        expect(dataOf().countdownDataList[0]).toMatchObject({
            id: sessionId,
            extraStyle: { look: `countdown-${sessionId}`, fontSize: '60px' },
        });
        // Every key of that session was backed up, absent ones as null.
        const restores = h.restoresList[0];
        expect(restores).toContainEqual({
            type: 'app-setting',
            key: `foreground-minutes-setting-${sessionId}`,
            text: null,
            foreground: 'countdown',
        });
        // What it put on screen 0 was kept too, so an undo takes the
        // countdown off the wall and not only out of the panel (EC-540).
        expect(h.appendedList).toEqual([
            [
                {
                    type: 'screen-foreground',
                    screenId: 0,
                    listKey: 'countdownDataList',
                    itemKey: sessionId,
                    items: [],
                    foreground: 'countdown',
                },
            ],
        ]);
        // The same minutes again reuse it: no "(2)".
        const again: any = await handleAgentForegroundRequest(
            { widget: 'countdown', minutes: 10 },
            NOW,
        );
        expect(again.session).toMatchObject({ id: sessionId, isNew: false });
        // Shown again the same to the moment, nothing on the wall changed:
        // no slot is kept, and an undo of it leaves the countdown up.
        expect(h.appendedList[1]).toEqual([]);
    });

    it('is paused and reset on the wall in place', async () => {
        await handleAgentForegroundRequest(
            { widget: 'countdown', minutes: 5 },
            NOW,
        );
        const paused: any = await handleAgentForegroundRequest({
            action: 'timer',
            widget: 'countdown',
            timer: 'pause',
        });
        expect(paused.did).toBe('timer');
        // Paused in place: still the one entry of the Default session.
        expect(dataOf().countdownDataList).toHaveLength(1);
        expect(typeof dataOf().countdownDataList[0].pausedMillisecond).toBe(
            'number',
        );
        const missing: any = await handleAgentForegroundRequest({
            action: 'timer',
            widget: 'quick-text',
            timer: 'pause',
        });
        expect(missing.isError).toBe(true);
    });
});

describe('words and a verse', () => {
    it('makes a quick text of a verse from the installed Bible, its own look', async () => {
        const result: any = await handleAgentForegroundRequest(
            { widget: 'quick-text', ref: 'John 3:16' },
            NOW,
        );
        expect(result.session).toMatchObject({
            name: '(KJV) John 3:16',
            isNew: true,
        });
        const suffix = `-${result.session.id}`;
        expect(h.settings.get(`foreground-quick-text-setting${suffix}`)).toBe(
            '**(KJV) John 3:16**\n\nFor God so loved the world.',
        );
        // The Bibles list's own Open in Quick Text look, in the Bible's font.
        expect(h.presets).toEqual([[suffix, 'bible-verse']]);
        expect(h.settings.get(`quick-text${suffix}-common-font-family`)).toBe(
            'app-Sample Serif',
        );
        expect(dataOf().quickTextDataList).toHaveLength(1);
        expect(dataOf().quickTextDataList[0].htmlText).toContain(
            'For God so loved',
        );
    });

    it('refuses a reference no Bible reads, and a verse where it cannot go', async () => {
        const unread: any = await handleAgentForegroundRequest(
            { widget: 'quick-text', ref: 'Hezekiah 9:9' },
            NOW,
        );
        expect(unread.isError).toBe(true);
        expect(unread.reason).toContain('could not be read');
        const clock: any = await handleAgentForegroundRequest(
            { widget: 'clock', ref: 'John 3:16' },
            NOW,
        );
        expect(clock.reason).toContain('owa_present_bible');
    });

    it('scrolls a marquee in its session, at its own speed', async () => {
        const result: any = await handleAgentForegroundRequest(
            { widget: 'marquee-top', text: 'Welcome  to   church' },
            NOW,
        );
        expect(result.session.name).toBe('Welcome to church');
        expect(dataOf().marqueeTopDataList).toHaveLength(1);
        expect(dataOf().marqueeTopDataList[0]).toMatchObject({
            text: 'Welcome to church',
            speedPercentage: 100,
        });
    });

    it('puts a clock up as a session of its own, and takes that one off', async () => {
        const result: any = await handleAgentForegroundRequest(
            { widget: 'clock', title: 'London', utcOffset: 0 },
            NOW,
        );
        expect(result.session.name).toBe('London');
        expect(dataOf().timeDataList).toHaveLength(1);
        expect(dataOf().timeDataList[0]).toMatchObject({
            title: 'London',
            timezoneMinuteOffset: 0,
        });
        // A clock of another session stays when this one comes off.
        h.managers[0].screenForegroundManager.foregroundData.timeDataList.push({
            id: 'theirs',
            title: null,
            timezoneMinuteOffset: 7,
        });
        const stopped: any = await handleAgentForegroundRequest({
            action: 'stop',
            widget: 'clock',
            session: 'London',
        });
        expect(stopped.did).toBe('stopped');
        expect(
            dataOf().timeDataList.map((one: any) => {
                return one.id;
            }),
        ).toEqual(['theirs']);
    });
});

describe('a session changed, and what of it is up', () => {
    it('restyles the overlay on the screen holding it, the panel told', async () => {
        await handleAgentForegroundRequest(
            { widget: 'countdown', minutes: 5 },
            NOW,
        );
        h.notified = [];
        const result: any = await handleAgentForegroundRequest({
            action: 'set',
            widget: 'countdown',
            session: 'Default',
            look: { size: 'larger', position: 'top' },
        });
        expect(result).toMatchObject({
            did: 'changed',
            changed: ['size 100 → 125px', 'position top'],
            isChanged: true,
        });
        // Restyled: the session's old entry replaced, not joined by a twin.
        expect(dataOf().countdownDataList).toHaveLength(1);
        expect(dataOf().countdownDataList[0].extraStyle.fontSize).toBe('125px');
        expect(h.notified).toEqual(['countdown']);
    });

    it('keeps what was up, so its undo puts the old one back up (EC-546)', async () => {
        await handleAgentForegroundRequest(
            { widget: 'countdown', minutes: 5 },
            NOW,
        );
        const shownBefore = JSON.parse(
            JSON.stringify(dataOf().countdownDataList),
        );
        h.appendedList = [];
        const result: any = await handleAgentForegroundRequest(
            {
                action: 'set',
                widget: 'countdown',
                session: 'Default',
                minutes: 8,
            },
            NOW,
        );
        expect(result.did).toBe('changed');
        // The undo had put the session's 5 minutes back and left 8 on the
        // wall: the slot it changed is kept with what it held.
        expect(h.appendedList).toEqual([
            [
                {
                    type: 'screen-foreground',
                    screenId: 0,
                    listKey: 'countdownDataList',
                    itemKey: '',
                    items: shownBefore,
                    foreground: 'countdown',
                },
            ],
        ]);
        // Not up anywhere, a change reads no screen and keeps none.
        await handleAgentForegroundRequest({
            action: 'stop',
            widget: 'countdown',
            session: 'Default',
        });
        h.appendedList = [];
        await handleAgentForegroundRequest(
            {
                action: 'set',
                widget: 'countdown',
                session: 'Default',
                minutes: 9,
            },
            NOW,
        );
        expect(h.appendedList).toEqual([]);
    });

    it('says a countdown given a time on no screen is not counting down (EC-578)', async () => {
        const result: any = await handleAgentForegroundRequest(
            {
                action: 'set',
                widget: 'countdown',
                session: 'Default',
                at: '11:45 pm',
                autoStart: true,
            },
            NOW,
        );
        expect(result.did).toBe('changed');
        expect(result.detail).toContain('is NOT counting down');
        expect(result.detail).toContain('call `start` with this time');
        // A look changed off the screen keeps the plain sentence.
        const look: any = await handleAgentForegroundRequest({
            action: 'set',
            widget: 'countdown',
            session: 'Default',
            look: { color: 'red' },
        });
        expect(look.detail).toContain(
            'It is not on a screen; the panel holds the change.',
        );
        expect(look.detail).not.toContain('start');
    });

    it('puts a countdown set to a time up as that time, asking which only when both could be meant (EC-579)', async () => {
        await handleAgentForegroundRequest(
            {
                action: 'set',
                widget: 'countdown',
                session: 'Default',
                at: '11:45 pm',
            },
            NOW,
        );
        // The session holds its 5 minutes too, and nothing says which.
        const asked: any = await handleAgentForegroundRequest(
            { action: 'show', widget: 'countdown', session: 'Default' },
            NOW,
        );
        expect(asked.isError).toBe(true);
        expect(asked.reason).toContain('`minutes: 5`');
        expect(asked.reason).toContain('`at: "23:45"`');
        expect(dataOf().countdownDataList).toHaveLength(0);
        const shown: any = await handleAgentForegroundRequest(
            {
                action: 'show',
                widget: 'countdown',
                session: 'Default',
                at: '11:45 pm',
            },
            NOW,
        );
        expect(shown.isError).toBeUndefined();
        expect(dataOf().countdownDataList).toHaveLength(1);
        const up = dataOf().countdownDataList[0];
        expect(up.durationMillisecond).toBeUndefined();
        expect(new Date(up.dateTime).getHours()).toBe(23);
        // A change to the session up keeps it counting to that time.
        await handleAgentForegroundRequest(
            {
                action: 'set',
                widget: 'countdown',
                session: shown.session?.name ?? 'Default',
                autoStart: false,
            },
            NOW,
        );
        expect(dataOf().countdownDataList).toHaveLength(1);
        expect(dataOf().countdownDataList[0].durationMillisecond).toBe(
            undefined,
        );
        expect(
            new Date(dataOf().countdownDataList[0].dateTime).getHours(),
        ).toBe(23);
    });

    it('counts down to another day as the panel does, the day named (EC-580)', async () => {
        const started: any = await handleAgentForegroundRequest(
            { action: 'start', widget: 'countdown', at: '2026-12-25 09:00' },
            NOW,
        );
        expect(started.isError).toBeUndefined();
        expect(started.detail).toContain(
            `on ${new Date(2026, 11, 25).toDateString()}`,
        );
        expect(dataOf().countdownDataList).toHaveLength(1);
        const up = dataOf().countdownDataList[0];
        expect(up.durationMillisecond).toBeUndefined();
        expect(new Date(up.dateTime).getTime()).toBe(
            new Date(2026, 11, 25, 9, 0).getTime(),
        );
        // A year the model guessed wrong is refused with today to fix it by.
        const past: any = await handleAgentForegroundRequest(
            { action: 'start', widget: 'countdown', at: '2025-12-25 09:00' },
            NOW,
        );
        expect(past.isError).toBe(true);
        expect(past.reason).toContain('today is 2026-09-11');
    });

    it('asks which of a length and another day, giving the day as `at` takes it (EC-580)', async () => {
        await handleAgentForegroundRequest(
            {
                action: 'set',
                widget: 'countdown',
                session: 'Default',
                at: '2026-12-25 09:00',
            },
            NOW,
        );
        const asked: any = await handleAgentForegroundRequest(
            { action: 'show', widget: 'countdown', session: 'Default' },
            NOW,
        );
        expect(asked.isError).toBe(true);
        expect(asked.reason).toContain('`at: "2026-12-25 09:00"`');
        expect(asked.reason).not.toContain('Start Countdown to DateTime');
    });

    it('refuses a look the component lacks, writing nothing', async () => {
        const result: any = await handleAgentForegroundRequest({
            action: 'set',
            widget: 'marquee-bottom',
            look: { position: 'top' },
        });
        expect(result.isError).toBe(true);
        expect(h.restoresList).toEqual([]);
    });

    it('dresses any component with one of its own presets, what is up restyled', async () => {
        await handleAgentForegroundRequest(
            { widget: 'countdown', minutes: 5 },
            NOW,
        );
        h.notified = [];
        const result: any = await handleAgentForegroundRequest({
            action: 'set',
            widget: 'countdown',
            session: 'Default',
            preset: 'center',
        });
        expect(result.isError).toBeUndefined();
        expect(h.settings.get('countdown-setting-show-widget-scale')).toBe('1');
        expect(
            JSON.parse(
                h.settings.get('countdown-setting-show-widget-alignment-data')!,
            ),
        ).toEqual({
            horizontalAlignment: 'center',
            verticalAlignment: 'center',
        });
        // The countdown on screen 0 was restyled from the keys just written.
        expect(result.detail).toContain('Screen 0 shows the change now');
        expect(result.changed).toEqual(['the center look']);
        expect(h.notified).toEqual(['countdown']);
        // A Quick Text preset still goes through Quick Text's own door.
        expect(h.presets).toEqual([]);
    });

    it('puts a preset on its light side, and turns a session by a side alone', async () => {
        await handleAgentForegroundRequest(
            { widget: 'countdown', minutes: 5 },
            NOW,
        );
        const lit: any = await handleAgentForegroundRequest({
            action: 'set',
            widget: 'countdown',
            session: 'Default',
            preset: 'center light',
        });
        expect(lit.isError).toBeUndefined();
        expect(lit.changed).toEqual(['the center look, light']);
        expect(h.settings.get('countdown-setting-show-widget-scale')).toBe('1');
        expect(h.settings.get('countdown-common-color')).toBe('#000000');
        expect(h.settings.get('countdown-common-background-color')).toBe(
            '#D5DDF0CC',
        );
        const read: any = await handleAgentForegroundRequest({
            action: 'read',
            widget: 'countdown',
            session: 'Default',
        });
        expect(read.presetSide).toBe('light');
        const dark: any = await handleAgentForegroundRequest({
            action: 'set',
            widget: 'countdown',
            session: 'Default',
            preset: 'dark',
        });
        expect(dark.changed).toEqual(['its words and box turned dark']);
        expect(h.settings.get('countdown-common-color')).toBe('#FFFFFF');
        expect(h.settings.get('countdown-common-background-color')).toBe(
            '#0F172ACC',
        );
        // A picture has no words or box to turn.
        const video: any = await handleAgentForegroundRequest({
            action: 'set',
            widget: 'video',
            preset: 'light',
        });
        expect(video.isError).toBe(true);
        expect(video.reason).toContain('no words or box');
    });

    it('puts on a look somebody saved, by its name', async () => {
        h.settings.set(
            'foreground-countdown-saved-presets',
            JSON.stringify([
                {
                    id: 'y1',
                    name: 'Youth Night',
                    values: {
                        'props.scale': '3',
                        'common.color': '#FACC15',
                    },
                },
            ]),
        );
        h.settings.set('countdown-setting-show-widget-offset-x', '60');
        const result: any = await handleAgentForegroundRequest({
            action: 'set',
            widget: 'countdown',
            session: 'Default',
            preset: 'youth night',
        });
        expect(result.isError).toBeUndefined();
        expect(result.changed).toEqual(['the saved look "Youth Night"']);
        expect(h.settings.get('countdown-setting-show-widget-scale')).toBe('3');
        expect(h.settings.get('countdown-common-color')).toBe('#FACC15');
        expect(h.settings.has('countdown-setting-show-widget-offset-x')).toBe(
            false,
        );
        const read: any = await handleAgentForegroundRequest({
            action: 'read',
            widget: 'countdown',
        });
        expect(read.savedPresets).toEqual(['Youth Night']);
        const wrong: any = await handleAgentForegroundRequest({
            action: 'set',
            widget: 'countdown',
            preset: 'Old Night',
        });
        expect(wrong.reason).toContain('"Youth Night"');
    });

    it('refuses a preset the component does not have, naming its own', async () => {
        const wrong: any = await handleAgentForegroundRequest({
            action: 'set',
            widget: 'countdown',
            preset: 'bible-verse',
        });
        expect(wrong.isError).toBe(true);
        expect(wrong.reason).toContain(
            'top-right, bottom-right, center, bottom-banner',
        );
        const none: any = await handleAgentForegroundRequest({
            action: 'set',
            widget: 'long-text',
            preset: 'center',
        });
        expect(none.reason).toContain('has no presets');
        expect(h.restoresList).toEqual([]);
    });

    it('names the sessions there are for one it cannot find', async () => {
        const result: any = await handleAgentForegroundRequest({
            action: 'set',
            widget: 'quick-text',
            session: 'Nowhere',
            look: { size: 50 },
        });
        expect(result.reason).toContain('"Default"');
    });
});

describe('taking things off and reading', () => {
    it('takes a component off every screen holding it, ticked or not', async () => {
        h.managers = [genManager(0), genManager(1, { isSelected: false })];
        // Two sessions' countdowns: a stop of the whole kind takes both.
        dataOf(1).countdownDataList = [
            { dateTime: NOW },
            { id: 'other', dateTime: NOW },
        ];
        const result: any = await handleAgentForegroundRequest({
            action: 'stop',
            widget: 'countdown',
        });
        expect(result.did).toBe('stopped');
        expect(dataOf(1).countdownDataList).toEqual([]);
    });

    // Each session owns its own overlay: a second session's words go up
    // BESIDE the first one's, and a stop that names a session takes that
    // one's down alone.
    it("puts a second session's marquee up beside the first, and stops only the one named", async () => {
        // Both asks in ONE millisecond: a new session's id is the clock's,
        // and two made at once must still be two sessions
        // (`genMediaSessionId`), or the second Show replaces the first.
        const dateNowSpy = vi
            .spyOn(Date, 'now')
            .mockReturnValue(NOW.getTime() + 10_000_000_000);
        const first: any = await handleAgentForegroundRequest(
            { widget: 'marquee-bottom', text: 'Welcome' },
            NOW,
        );
        const second: any = await handleAgentForegroundRequest(
            { widget: 'marquee-bottom', text: 'Parking full' },
            NOW,
        );
        dateNowSpy.mockRestore();
        expect(first.session.id).not.toBe(second.session.id);
        expect(
            dataOf().marqueeBottomDataList.map((one: any) => {
                return [one.id, one.text];
            }),
        ).toEqual([
            [first.session.id, 'Welcome'],
            [second.session.id, 'Parking full'],
        ]);
        const stopped: any = await handleAgentForegroundRequest({
            action: 'stop',
            widget: 'marquee-bottom',
            session: 'Welcome',
        });
        expect(stopped.did).toBe('stopped');
        expect(
            dataOf().marqueeBottomDataList.map((one: any) => {
                return one.text;
            }),
        ).toEqual(['Parking full']);
    });

    it('stops every extra as F10, a locked screen left as it was', async () => {
        h.managers = [genManager(0), genManager(1, { isLocked: true })];
        const result: any = await handleAgentForegroundRequest({
            action: 'stop',
            widget: 'all',
        });
        expect(h.managers[0].screenForegroundManager.calls).toEqual([
            'clearForeground',
        ]);
        expect(h.managers[1].screenForegroundManager.calls).toEqual([]);
        expect(result.note).toContain('Screen 1 is locked');
        expect(result.detail).toBe(
            'Every foreground extra is off the screen now: nothing was up.',
        );
    });

    it('names what a clear took off and that it keeps no Undo (EC-554)', async () => {
        h.managers = [
            genManager(0, {
                screenLongTextManager: {
                    screenViewData: { longText: 'Morning Psalm' },
                },
            }),
        ];
        const result: any = await handleAgentForegroundRequest({
            action: 'stop',
            widget: 'all',
        });
        expect(result.detail).toContain(
            'took off long text "Morning Psalm" from screen 0.',
        );
        expect(result.detail).toContain('A clear keeps no Undo');
        expect(result.undoId).toBeUndefined();
    });

    it('lists the open panels and their sessions', async () => {
        h.settings.set('foreground-open-panels', 'countdown,camera,nonsense');
        const result: any = await handleAgentForegroundRequest({
            action: 'read',
            open: true,
        });
        expect(
            result.panels.map((one: any) => {
                return one.widget;
            }),
        ).toEqual(['countdown', 'camera']);
        expect(result.panels[0].sessions[0]).toMatchObject({
            id: '',
            name: 'Default',
            isActive: true,
        });
    });

    it("shows a session's quick text until hidden when its Infinite is on", async () => {
        h.settings.set('foreground-quick-text-setting', 'Hello');
        h.settings.set('foreground-quick-text-is-infinite', 'true');
        const read: any = await handleAgentForegroundRequest({
            action: 'read',
            widget: 'quick-text',
        });
        expect(read.content).toMatchObject({
            text: 'Hello',
            delay: 0,
            seconds: 5,
            infinite: true,
        });
        const shown: any = await handleAgentForegroundRequest(
            { widget: 'quick-text', text: 'Hello' },
            NOW,
        );
        expect(JSON.stringify(shown)).toContain('until it is hidden');
        expect(dataOf().quickTextDataList).toHaveLength(1);
        expect(dataOf().quickTextDataList[0]).toMatchObject({
            timeSecondToLive: 5,
            isInfinite: true,
        });
    });

    it("reads a session's words and look without changing anything", async () => {
        h.settings.set('foreground-quick-text-setting', 'Hello');
        const result: any = await handleAgentForegroundRequest({
            action: 'read',
            widget: 'quick-text',
        });
        expect(result.content.text).toBe('Hello');
        expect(result.look.size).toBe('100px');
        expect(h.restoresList).toEqual([]);
    });
});

describe('what is refused, in sentences', () => {
    it('off the Presenter page', async () => {
        h.isPagePresenter = false;
        const result: any = await handleAgentForegroundRequest({
            widget: 'countdown',
            minutes: 5,
        });
        expect(result.reason).toContain('Presenter page');
    });

    it('with no screen ticked, or all of them locked', async () => {
        h.managers = [genManager(0, { isSelected: false })];
        const unticked: any = await handleAgentForegroundRequest(
            { widget: 'stopwatch' },
            NOW,
        );
        expect(unticked.reason).toContain('No screen is chosen');
        h.managers = [genManager(0, { isLocked: true })];
        const locked: any = await handleAgentForegroundRequest(
            { widget: 'stopwatch' },
            NOW,
        );
        expect(locked.reason).toContain('locked');
    });

    it('a Fill or Animation Show put up by words, before anything is written', async () => {
        const settingsBefore = [...h.settings.entries()];
        const backupsBefore = h.restoresList.length;
        for (const [widget, action, opening] of [
            ['fill', 'show', 'A Fill Show'],
            ['animation', 'start', 'An Animation Show'],
        ] as const) {
            const result: any = await handleAgentForegroundRequest(
                { action, widget, session: 'Default' },
                NOW,
            );
            expect(result.isError).toBe(true);
            expect(result.reason.startsWith(opening)).toBe(true);
            // Nothing was set, so there is nothing to undo and none offered.
            expect(result.reason).not.toContain('owa_undo');
        }
        expect([...h.settings.entries()]).toEqual(settingsBefore);
        expect(h.restoresList).toHaveLength(backupsBefore);
    });

    it('an unknown component, and "all" anywhere but stop', async () => {
        const unknown: any = await handleAgentForegroundRequest({
            widget: 'fireworks',
        });
        expect(unknown.reason).toContain('quick-text');
        const all: any = await handleAgentForegroundRequest({ widget: 'all' });
        expect(all.reason).toContain('only stops');
    });
});
