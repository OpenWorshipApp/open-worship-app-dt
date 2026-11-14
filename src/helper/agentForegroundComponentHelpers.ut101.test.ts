// @vitest-environment jsdom

/**
 * Each foreground component put up, restyled, timed and taken down the
 * PANEL's way (`agentForegroundComponentHelpers.ts`): the datum built from
 * the session's settings, with `withForegroundLayer` and `toTransitionPart`,
 * onto a stand-in of the screen's foreground manager.
 *
 * Real here: the component rules, the session ownership rule
 * (`foregroundSessionHelpers`), the transition resolver, the timer rules,
 * the sound settings, the Messages panel's stacking and the Long Text
 * session checks. Stubbed: the Properties style builder (its own tests are
 * `propertiesSettingHelpers.test.tsx`; here it only marks WHOSE style a datum
 * carries), the Markdown renderer, the screens, and the React panels these
 * modules sit beside.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        settings: new Map<string, string>(),
        hideLongText: vi.fn(),
        restyleLongText: vi.fn(),
        getLongTextShowingList: vi.fn(),
        getLongTextInstance: vi.fn(),
    };
});

vi.mock('../server/appProvider', () => ({
    default: {
        isPagePresenter: true,
        isPageScreen: false,
        systemUtils: { isDev: false },
        messageUtils: { listenForData: () => {}, sendData: () => {} },
    },
}));
vi.mock('./settingHelpers', () => ({
    getSetting: (key: string) => h.settings.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        h.settings.set(key, value);
    },
    removeSetting: (key: string) => {
        h.settings.delete(key);
    },
}));
vi.mock('../_screen/managers/ScreenLongTextManager', () => ({
    default: {
        hideLongText: h.hideLongText,
        restyleLongText: h.restyleLongText,
        getLongTextShowingList: h.getLongTextShowingList,
        getInstance: h.getLongTextInstance,
    },
}));
// Only types of it are read by the module under test; the Messages panel
// takes its "all" id from it.
vi.mock('../_screen/managers/ScreenForegroundManager', () => ({
    default: {},
    MESSAGE_ALL_ID: 'message-all',
}));
// Marks whose look a datum carries: the prefix, the panel rows asked for,
// and a colour a test can change between a show and a restyle.
vi.mock('../presenter-foreground/propertiesSettingHelpers', () => ({
    genForegroundExtraStyle: (prefix: string, flags: object) => {
        const color = h.settings.get(`${prefix}-look-color`);
        return {
            look: prefix,
            rows: Object.entries(flags)
                .filter(([, value]) => {
                    return value === true;
                })
                .map(([key]) => {
                    return key;
                })
                .join(','),
            ...(color === undefined ? {} : { color }),
        };
    },
    getForegroundIsBehind: (prefix: string) => {
        return (
            h.settings.get(`${prefix}-setting-show-widget-is-behind`) === 'true'
        );
    },
    getForegroundWidthScale: (prefix: string) => {
        return Number(
            h.settings.get(`${prefix}-setting-show-widget-width-percentage`) ??
                50,
        );
    },
}));
vi.mock('../lyric-list/markdownHelpers', () => ({
    renderMarkdown: async (text: string) => {
        return { id: 'md', html: `<p>${text}</p>` };
    },
}));
// No label is read on these paths; one read would be a bug, so it throws.
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => {
        throw new Error(`no label is read here: ${key}`);
    },
    DEFAULT_LOCALE: 'en-US',
    reversedLocalesMap: {},
    getLangDataByCodeAsync: async () => null,
    toLocaleNum: async (_locale: string, num: number) => `${num}`,
}));
// The session strip's React side, beside the ownership rule that is real.
vi.mock('../media-sessions/MediaSessionsComp', async () => {
    const data = await import('../media-sessions/mediaSessionData');
    return {
        default: () => null,
        DEFAULT_SESSION_ID: data.DEFAULT_SESSION_ID,
        toSessionSuffix: data.toSessionSuffix,
        useMediaSessions: () => ({}),
    };
});
vi.mock(
    '../presenter-foreground/ForegroundCommonPropertiesSettingComp',
    () => ({
        default: () => null,
        genCommonStyleSettingNames: () => ({}),
    }),
);
vi.mock('./ai/foregroundChatbotMenuHelpers', () => ({}));
vi.mock('../others/AppRangeComp', () => ({ default: () => null }));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: () => null,
}));
vi.mock('../presenter-foreground/foregroundHelpers', () => ({}));
vi.mock('../_screen/managers/screenManagerBaseHelpers', () => ({}));
vi.mock('../presenter-foreground/ScreensRendererComp', () => ({
    default: () => null,
}));
vi.mock('../_screen/managers/screenEventHelpers', () => ({}));
vi.mock('../presenter-foreground/ForegroundPropRowComp', () => ({
    default: () => null,
}));
vi.mock('../presenter-foreground/ForegroundLayoutComp', () => ({
    default: () => null,
}));
vi.mock('../presenter-foreground/SavedTextSessionButtonsComp', () => ({
    default: () => null,
}));
vi.mock('./dragHelpers', () => ({}));
vi.mock('../presenter-foreground/foregroundDragHelpers', () => ({}));
vi.mock('./timeoutHelpers', () => ({}));
vi.mock('./appHooks', () => ({}));
vi.mock('../event/KeyboardEventListener', () => ({}));
vi.mock('../toast/toastHelpers', () => ({}));
vi.mock('./errorHelpers', () => ({ handleError: () => {} }));
vi.mock('./helpers', () => ({
    cloneJson: (value: unknown) => structuredClone(value),
}));

import type ScreenManager from '../_screen/managers/ScreenManager';
import {
    applyTimerOnScreen,
    checkIsOnScreen,
    checkIsReason,
    hideOnScreen,
    listOwnedData,
    planShow,
    readCountdownSeconds,
    readCountdownTarget,
    restyleOnScreen,
    toLookPrefix,
    toMessageOwnerId,
    toMinutesLabel,
    type AgentForegroundContextType,
    type AgentForegroundShowOptionsType,
    type AgentForegroundShowPlanType,
} from './agentForegroundComponentHelpers';

// 09:00 local on an ordinary day.
const NOW = new Date(2026, 10, 11, 9, 0, 0, 0);
const OPTIONS: AgentForegroundShowOptionsType = {
    now: NOW,
    isRunning: false,
    countdownMode: 'duration',
};

const LIST_KEYS = [
    'messageDataList',
    'countdownDataList',
    'stopwatchDataList',
    'timeDataList',
    'marqueeTopDataList',
    'marqueeBottomDataList',
    'quickTextDataList',
    'cameraDataList',
    'screenDataList',
    'webDataList',
    'videoDataList',
    'imageDataList',
] as const;

/**
 * A stand-in of `ScreenForegroundManager` with its setters' semantics: a
 * per-session list is put and taken by the datum's session (`id`, none for
 * Default), a clock and a source screen by their id, a camera by its whole
 * datum. Every call is recorded.
 */
function genManager(initial: Record<string, any[]> = {}) {
    const calls: [string, any][] = [];
    const toSessionKey = (item: any) => {
        return typeof item?.id === 'string' ? item.id : '';
    };
    const toText = (item: unknown) => {
        return JSON.stringify(item);
    };
    const manager: any = {
        calls,
        foregroundData: Object.fromEntries(
            LIST_KEYS.map((key) => {
                return [key, initial[key] ?? []];
            }),
        ),
    };
    const assign = (key: string, list: any[]) => {
        manager.foregroundData = { ...manager.foregroundData, [key]: list };
    };
    const put = (key: string, item: any) => {
        const list: any[] = manager.foregroundData[key];
        const index = list.findIndex((one) => {
            return toSessionKey(one) === toSessionKey(item);
        });
        assign(
            key,
            index === -1
                ? [...list, item]
                : list.map((one, oneIndex) => {
                      return oneIndex === index ? item : one;
                  }),
        );
    };
    manager.putSessionData = (key: string, item: any) => {
        calls.push([`put:${key}`, item]);
        put(key, item);
    };
    manager.removeSessionData = (key: string, item: any) => {
        calls.push([`remove:${key}`, item]);
        assign(
            key,
            manager.foregroundData[key].filter((one: any) => {
                return toSessionKey(one) !== toSessionKey(item);
            }),
        );
    };
    manager.setCountdownData = (item: any) => {
        calls.push(['setCountdownData', item]);
        put('countdownDataList', item);
    };
    manager.setStopwatchData = (item: any) => {
        calls.push(['setStopwatchData', item]);
        put('stopwatchDataList', item);
    };
    for (const [name, key] of [
        ['setMessageDataList', 'messageDataList'],
        ['setVideoDataList', 'videoDataList'],
        ['setImageDataList', 'imageDataList'],
        ['setWebDataList', 'webDataList'],
    ] as const) {
        manager[name] = (list: any[]) => {
            calls.push([name, list]);
            assign(key, list);
        };
    }
    manager.addTimeData = (item: any) => {
        calls.push(['addTimeData', item]);
        const list: any[] = manager.foregroundData.timeDataList;
        assign(
            'timeDataList',
            list.some((one) => {
                return one.id === item.id;
            })
                ? list.map((one) => {
                      return one.id === item.id ? item : one;
                  })
                : [...list, item],
        );
    };
    manager.removeTimeData = (item: any) => {
        calls.push(['removeTimeData', item]);
        assign(
            'timeDataList',
            manager.foregroundData.timeDataList.filter((one: any) => {
                return toText(one) !== toText(item);
            }),
        );
    };
    manager.addCameraData = (item: any) => {
        calls.push(['addCameraData', item]);
        assign('cameraDataList', [
            ...manager.foregroundData.cameraDataList,
            item,
        ]);
    };
    manager.removeCameraData = (item: any) => {
        calls.push(['removeCameraData', item]);
        assign(
            'cameraDataList',
            manager.foregroundData.cameraDataList.filter((one: any) => {
                return toText(one) !== toText(item);
            }),
        );
    };
    manager.addScreenData = (item: any) => {
        calls.push(['addScreenData', item]);
        const list: any[] = manager.foregroundData.screenDataList;
        assign(
            'screenDataList',
            list.some((one) => {
                return one.id === item.id;
            })
                ? list.map((one) => {
                      return one.id === item.id ? item : one;
                  })
                : [...list, item],
        );
    };
    manager.removeScreenData = (item: any) => {
        calls.push(['removeScreenData', item]);
        assign(
            'screenDataList',
            manager.foregroundData.screenDataList.filter((one: any) => {
                return one.id !== item.id;
            }),
        );
    };
    return manager;
}

function genScreen(screenId = 1, initial: Record<string, any[]> = {}) {
    const manager = genManager(initial);
    const screen = {
        screenId,
        screenForegroundManager: manager,
    } as unknown as ScreenManager;
    return { screen, manager };
}

function toContext(
    widget: AgentForegroundContextType['widget'],
    extra: Partial<AgentForegroundContextType> = {},
): AgentForegroundContextType {
    return { widget, sessionId: '', suffix: '', sessionIds: [''], ...extra };
}

function toSession(
    widget: AgentForegroundContextType['widget'],
    sessionId: string,
    sessionIds: string[] = ['', sessionId],
): AgentForegroundContextType {
    return toContext(widget, {
        sessionId,
        suffix: sessionId === '' ? '' : `-${sessionId}`,
        sessionIds,
    });
}

function toTimeLabel(date: Date) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

async function planOk(
    context: AgentForegroundContextType,
    options: Partial<
        AgentForegroundShowOptionsType & {
            filePath: string;
            cameraLabel: string;
        }
    > = {},
) {
    const plan = await planShow(context, { ...OPTIONS, ...options });
    if (checkIsReason(plan)) {
        throw new Error(`expected a plan, got: ${plan.reason}`);
    }
    return plan as AgentForegroundShowPlanType;
}

async function planReason(
    context: AgentForegroundContextType,
    options: Partial<
        AgentForegroundShowOptionsType & { filePath: string }
    > = {},
) {
    const plan = await planShow(context, { ...OPTIONS, ...options });
    expect(checkIsReason(plan)).toBe(true);
    return (plan as { reason: string }).reason;
}

const TEXT_ROWS = 'isFontSize,isGeometry,isCommonStyle';
const PICTURE_ROWS = 'isGeometry,isBlendMode';

beforeEach(() => {
    h.settings.clear();
    h.getLongTextShowingList.mockReturnValue([]);
    h.getLongTextInstance.mockReturnValue(null);
});

describe('checkIsReason', () => {
    it('tells a reason from a plan and from anything else', () => {
        expect(checkIsReason({ reason: 'No words.' })).toBe(true);
        expect(checkIsReason({ detail: 'x', apply: () => {} })).toBe(false);
        expect(checkIsReason({ reason: 5 })).toBe(false);
        expect(checkIsReason(null)).toBe(false);
        expect(checkIsReason('reason')).toBe(false);
    });
});

describe('toLookPrefix', () => {
    it("is the session's Properties prefix, or the item's", () => {
        expect(toLookPrefix(toSession('message', 's2'))).toBe('message-s2');
        expect(toLookPrefix(toSession('video', 'v'))).toBe('video-show-v');
        expect(toLookPrefix(toContext('quick-text'))).toBe('quick-text');
        expect(toLookPrefix(toContext('time', { itemId: 'c1' }))).toBe(
            'time-c1',
        );
        expect(toLookPrefix(toContext('camera', { itemId: 'cam' }))).toBe(
            'camera-cam',
        );
        expect(toLookPrefix(toContext('screen', { itemId: '2' }))).toBe(
            'screen-show-2',
        );
    });

    it('is none for a clock not named, or for Long Text Show', () => {
        expect(toLookPrefix(toContext('time'))).toBeNull();
        expect(toLookPrefix(toContext('camera'))).toBeNull();
        expect(toLookPrefix(toSession('long-text', 's5'))).toBeNull();
    });
});

describe('toMessageOwnerId', () => {
    it("reads the session out of a message's id", () => {
        expect(toMessageOwnerId('message-2-s5k1')).toBe('s5k1');
        expect(toMessageOwnerId('message-all-s5k1')).toBe('s5k1');
        expect(toMessageOwnerId('message-3')).toBe('');
        expect(toMessageOwnerId('message-all')).toBe('');
        expect(toMessageOwnerId('custom-id')).toBe('');
    });
});

describe('listOwnedData', () => {
    it("finds each per-session component in its own list, a gone session's under the first", () => {
        const keyMap = {
            countdown: 'countdownDataList',
            stopwatch: 'stopwatchDataList',
            'marquee-top': 'marqueeTopDataList',
            'marquee-bottom': 'marqueeBottomDataList',
            'quick-text': 'quickTextDataList',
        } as const;
        for (const [widget, key] of Object.entries(keyMap)) {
            const mine = { id: 'a', n: 1 };
            const fallback = { n: 2 };
            const orphan = { id: 'gone', n: 3 };
            const { manager } = genScreen(1, {
                [key]: [mine, fallback, orphan],
                // Another component's list is never read for this one.
                messageDataList: [{ id: 'message-0-a' }],
            });
            const data = manager.foregroundData;
            const sessionIds = ['', 'a'];
            expect(
                listOwnedData(toSession(widget as any, 'a', sessionIds), data),
            ).toEqual([mine]);
            expect(
                listOwnedData(toSession(widget as any, '', sessionIds), data),
            ).toEqual([fallback, orphan]);
        }
    });

    it("finds a session's messages by the session their id carries", () => {
        const own = { id: 'message-0-s2' };
        const ownAll = { id: 'message-all-s2' };
        const fallback = { id: 'message-1' };
        const bareAll = { id: 'message-all' };
        const { manager } = genScreen(1, {
            messageDataList: [own, fallback, ownAll, bareAll],
        });
        const sessionIds = ['', 's2'];
        expect(
            listOwnedData(
                toSession('message', 's2', sessionIds),
                manager.foregroundData,
            ),
        ).toEqual([own, ownAll]);
        expect(
            listOwnedData(
                toSession('message', '', sessionIds),
                manager.foregroundData,
            ),
        ).toEqual([fallback, bareAll]);
    });

    it("finds a Time session's clocks by its list, or the one clock named", () => {
        h.settings.set(
            'foreground-time-id-list-t',
            JSON.stringify(['c1', 'c3']),
        );
        const clocks = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];
        const { manager } = genScreen(1, { timeDataList: clocks });
        expect(
            listOwnedData(toSession('time', 't'), manager.foregroundData),
        ).toEqual([clocks[0], clocks[2]]);
        expect(
            listOwnedData(
                { ...toSession('time', 't'), itemId: 'c2' },
                manager.foregroundData,
            ),
        ).toEqual([clocks[1]]);
        h.settings.set('foreground-time-id-list-t', 'not json');
        expect(
            listOwnedData(toSession('time', 't'), manager.foregroundData),
        ).toEqual([]);
    });

    it('finds a media session in its own kind of list only', () => {
        const { manager } = genScreen(1, {
            videoDataList: [{ id: 'v', filePath: 'a.mp4' }, { filePath: 'b' }],
            imageDataList: [{ id: 'v', filePath: 'a.png' }],
            webDataList: [{ filePath: 'page.html' }],
        });
        const data = manager.foregroundData;
        expect(listOwnedData(toSession('video', 'v'), data)).toEqual([
            { id: 'v', filePath: 'a.mp4' },
        ]);
        expect(listOwnedData(toSession('image', 'v'), data)).toEqual([
            { id: 'v', filePath: 'a.png' },
        ]);
        expect(listOwnedData(toSession('web', ''), data)).toEqual([
            { filePath: 'page.html' },
        ]);
        // A datum with no string id is the Default session's.
        expect(
            listOwnedData(toSession('web', ''), {
                ...data,
                webDataList: [{ id: 7, filePath: 'x' } as any],
            }),
        ).toHaveLength(1);
    });

    it('finds every camera or source screen, or the one named', () => {
        const { manager } = genScreen(1, {
            cameraDataList: [{ id: 'front' }, { id: 'side' }],
            screenDataList: [{ id: 2 }, { id: 3 }],
        });
        const data = manager.foregroundData;
        expect(listOwnedData(toContext('camera'), data)).toHaveLength(2);
        expect(
            listOwnedData(toContext('camera', { itemId: 'side' }), data),
        ).toEqual([{ id: 'side' }]);
        expect(listOwnedData(toContext('screen'), data)).toHaveLength(2);
        expect(
            listOwnedData(toContext('screen', { itemId: '3' }), data),
        ).toEqual([{ id: 3 }]);
    });

    it('lists nothing for Long Text Show, which is not a foreground list', () => {
        const { manager } = genScreen(1, {
            messageDataList: [{ id: 'message-0' }],
        });
        expect(
            listOwnedData(toContext('long-text'), manager.foregroundData),
        ).toEqual([]);
        // A list missing from the data is an empty one.
        expect(listOwnedData(toContext('countdown'), {} as any)).toEqual([]);
        expect(listOwnedData(toContext('message'), {} as any)).toEqual([]);
        expect(listOwnedData(toContext('video'), {} as any)).toEqual([]);
        expect(listOwnedData(toContext('camera'), {} as any)).toEqual([]);
        expect(listOwnedData(toContext('screen'), {} as any)).toEqual([]);
        expect(
            listOwnedData(toContext('time', { itemId: 'c1' }), {} as any),
        ).toEqual([]);
    });
});

describe('readCountdownSeconds, readCountdownTarget, toMinutesLabel', () => {
    it("reads a countdown's length as its three boxes hold it, five minutes by default", () => {
        expect(readCountdownSeconds('')).toBe(300);
        h.settings.set('foreground-hours-setting-a', '1');
        h.settings.set('foreground-minutes-setting-a', '2.9');
        h.settings.set('foreground-seconds-setting-a', '3');
        expect(readCountdownSeconds('-a')).toBe(3723);
        h.settings.set('foreground-minutes-setting-a', '-4');
        h.settings.set('foreground-seconds-setting-a', 'x');
        expect(readCountdownSeconds('-a')).toBe(3600);
    });

    it('reads the date and time boxes as one moment, or none', () => {
        expect(readCountdownTarget('-d')).toBeNull();
        h.settings.set('foreground-date-setting-d', '2026-11-11');
        expect(readCountdownTarget('-d')).toBeNull();
        h.settings.set('foreground-time-setting-d', '10:30');
        expect(readCountdownTarget('-d')?.getTime()).toBe(
            new Date(2026, 10, 11, 10, 30).getTime(),
        );
        h.settings.set('foreground-time-setting-d', 'half past');
        expect(readCountdownTarget('-d')).toBeNull();
    });

    it('says a length in minutes', () => {
        expect(toMinutesLabel(60)).toBe('1 minute');
        expect(toMinutesLabel(300)).toBe('5 minute');
        expect(toMinutesLabel(90)).toBe('1.5 minute');
        expect(toMinutesLabel(100)).toBe('1.67 minute');
    });
});

describe('planShow: countdown', () => {
    it('puts up a duration countdown stopped on its full length, the session and its look on it', async () => {
        h.settings.set('foreground-minutes-setting-s2', '10');
        const plan = await planOk(toSession('countdown', 's2'));
        expect(plan.detail).toBe('a 10 minute countdown, waiting for Start');
        const { screen, manager } = genScreen();
        plan.apply(screen);
        expect(manager.calls).toHaveLength(1);
        const [name, data] = manager.calls[0];
        expect(name).toBe('setCountdownData');
        expect(data).toEqual({
            id: 's2',
            dateTime: new Date(NOW.getTime() + 600_000),
            durationMillisecond: 600_000,
            pausedMillisecond: 600_000,
            extraStyle: { look: 'countdown-s2', rows: TEXT_ROWS },
        });
    });

    it('runs at once when started, and says when it ends', async () => {
        const plan = await planOk(toContext('countdown'), { isRunning: true });
        const end = new Date(NOW.getTime() + 300_000);
        expect(plan.detail).toBe(
            `a 5 minute countdown, ending at ${toTimeLabel(end)}`,
        );
        const { screen, manager } = genScreen();
        plan.apply(screen);
        const data = manager.calls[0][1];
        // The Default session's datum carries no id at all.
        expect(data).not.toHaveProperty('id');
        expect(data).not.toHaveProperty('pausedMillisecond');
        expect(data.dateTime).toEqual(end);
    });

    it("carries the session's transition, else the component's, and its layer", async () => {
        h.settings.set('foreground-component-transition-countdown', 'move');
        const fromComponent = await planOk(toSession('countdown', 'b'));
        const first = genScreen();
        fromComponent.apply(first.screen);
        expect(first.manager.calls[0][1]).toMatchObject({
            transitionEffect: 'move',
        });
        expect(first.manager.calls[0][1]).not.toHaveProperty('isBehind');

        h.settings.set('countdown-b-setting-show-widget-transition', 'zoom');
        h.settings.set('countdown-b-setting-show-widget-is-behind', 'true');
        const fromSession = await planOk(toSession('countdown', 'b'));
        const second = genScreen();
        fromSession.apply(second.screen);
        expect(second.manager.calls[0][1]).toMatchObject({
            transitionEffect: 'zoom',
            isBehind: true,
        });

        // An effect no screen knows is no override at all.
        h.settings.set('countdown-b-setting-show-widget-transition', 'spin');
        h.settings.delete('foreground-component-transition-countdown');
        const unknown = await planOk(toSession('countdown', 'b'));
        const third = genScreen();
        unknown.apply(third.screen);
        expect(third.manager.calls[0][1]).not.toHaveProperty(
            'transitionEffect',
        );
    });

    it('hands every screen a datum of its own', async () => {
        const plan = await planOk(toContext('countdown'));
        const one = genScreen(1);
        const two = genScreen(2);
        plan.apply(one.screen);
        plan.apply(two.screen);
        const first = one.manager.calls[0][1];
        const second = two.manager.calls[0][1];
        expect(first).toEqual(second);
        expect(first).not.toBe(second);
        expect(first.extraStyle).not.toBe(second.extraStyle);
    });

    it('refuses a countdown of no length', async () => {
        h.settings.set('foreground-minutes-setting', '0');
        expect(await planReason(toContext('countdown'))).toContain(
            '0 minutes long',
        );
    });

    it('counts to the time of day its boxes hold', async () => {
        h.settings.set('foreground-date-setting-c', '2026-11-11');
        h.settings.set('foreground-time-setting-c', '10:30');
        const plan = await planOk(toSession('countdown', 'c'), {
            countdownMode: 'date',
        });
        const target = new Date(2026, 10, 11, 10, 30);
        expect(plan.detail).toBe(`a countdown to ${toTimeLabel(target)}`);
        const { screen, manager } = genScreen();
        plan.apply(screen);
        expect(manager.calls[0][1]).toEqual({
            id: 'c',
            dateTime: target,
            extraStyle: { look: 'countdown-c', rows: TEXT_ROWS },
        });
    });

    it('refuses a time of day that has passed, or none at all', async () => {
        expect(
            await planReason(toContext('countdown'), {
                countdownMode: 'date',
            }),
        ).toContain('already passed');
        h.settings.set('foreground-date-setting', '2026-11-11');
        h.settings.set('foreground-time-setting', '08:00');
        expect(
            await planReason(toContext('countdown'), {
                countdownMode: 'date',
            }),
        ).toContain('already passed');
    });
});

describe('planShow: stopwatch', () => {
    it('puts up a stopwatch on zero waiting for Start, or running from now', async () => {
        const waiting = await planOk(toSession('stopwatch', 'w'));
        expect(waiting.detail).toBe('a stopwatch at zero, waiting for Start');
        const first = genScreen();
        waiting.apply(first.screen);
        expect(first.manager.calls[0]).toEqual([
            'setStopwatchData',
            {
                id: 'w',
                dateTime: NOW,
                pausedMillisecond: 0,
                extraStyle: { look: 'stopwatch-w', rows: TEXT_ROWS },
            },
        ]);

        const running = await planOk(toContext('stopwatch'), {
            isRunning: true,
        });
        expect(running.detail).toBe(
            `a stopwatch, started at ${toTimeLabel(NOW)}`,
        );
        const second = genScreen();
        running.apply(second.screen);
        expect(second.manager.calls[0][1]).not.toHaveProperty(
            'pausedMillisecond',
        );
    });
});

describe('planShow: marquees', () => {
    it('refuses a marquee with no words', async () => {
        expect(await planReason(toContext('marquee-top'))).toBe(
            'That marquee has no words. Give the words (text).',
        );
        h.settings.set('foreground-marquee-top-setting', '   ');
        expect(await planReason(toContext('marquee-top'))).toBe(
            'That marquee has no words. Give the words (text).',
        );
    });

    it('puts the words up at the speed and size the session is set to', async () => {
        h.settings.set('foreground-marquee-top-setting-m', ' Welcome all ');
        h.settings.set('foreground-marquee-top-speed-percentage-m', '150');
        h.settings.set('foreground-marquee-top-font-size-m', '40');
        const plan = await planOk(toSession('marquee-top', 'm'));
        expect(plan.detail).toBe(
            'a message scrolling along the top: "Welcome all"',
        );
        const { screen, manager } = genScreen();
        plan.apply(screen);
        expect(manager.calls).toEqual([
            [
                'put:marqueeTopDataList',
                {
                    id: 'm',
                    text: 'Welcome all',
                    speedPercentage: 150,
                    // The marquee's own Font Size row over its Properties.
                    extraStyle: {
                        look: 'marquee-top-m',
                        rows: 'isCommonStyle',
                        fontSize: '40px',
                    },
                },
            ],
        ]);
    });

    it('fits the band and runs at the usual speed when nothing is set', async () => {
        h.settings.set('foreground-marquee-bottom-setting', 'Parking full');
        h.settings.set('foreground-marquee-bottom-speed-percentage', '0');
        h.settings.set('foreground-marquee-bottom-font-size', '0');
        const plan = await planOk(toContext('marquee-bottom'));
        expect(plan.detail).toBe(
            'a message scrolling along the bottom: "Parking full"',
        );
        const { screen, manager } = genScreen();
        plan.apply(screen);
        expect(manager.calls[0][0]).toBe('put:marqueeBottomDataList');
        expect(manager.calls[0][1]).toEqual({
            text: 'Parking full',
            speedPercentage: 100,
            extraStyle: { look: 'marquee-bottom', rows: 'isCommonStyle' },
        });
        // Never set at all reads the same.
        h.settings.delete('foreground-marquee-bottom-speed-percentage');
        h.settings.delete('foreground-marquee-bottom-font-size');
        const unset = await planOk(toContext('marquee-bottom'));
        const again = genScreen();
        unset.apply(again.screen);
        expect(again.manager.calls[0][1]).toEqual(manager.calls[0][1]);
    });
});

describe('planShow: quick text', () => {
    it('refuses a quick text with no words', async () => {
        expect(await planReason(toContext('quick-text'))).toBe(
            'That quick text has no words. Give the words (text).',
        );
    });

    it("renders the session's Markdown and times it as the session is set", async () => {
        h.settings.set(
            'foreground-quick-text-setting-q',
            '\n## **Blue car**, lights on\nSecond line',
        );
        h.settings.set('foreground-quick-text-time-delay-q', '3');
        h.settings.set('foreground-quick-text-time-to-live-q', '0');
        const plan = await planOk(toSession('quick-text', 'q'));
        // A stay of 0 seconds is the least a quick text stays: one.
        expect(plan.detail).toBe(
            'a line of text for 1 seconds after 3 seconds, in the middle of ' +
                'the screen: "Blue car, lights on"',
        );
        const { screen, manager } = genScreen();
        plan.apply(screen);
        expect(manager.calls).toEqual([
            [
                'put:quickTextDataList',
                {
                    id: 'q',
                    htmlText: '<p>## **Blue car**, lights on\nSecond line</p>',
                    timeSecondDelay: 3,
                    timeSecondToLive: 1,
                    extraStyle: {
                        look: 'quick-text-q',
                        rows: `${TEXT_ROWS},isMargin`,
                    },
                },
            ],
        ]);
    });

    // EC-591: the ordinary tool takes no place, and a message asked for at
    // the bottom went up in the middle with nothing said.
    it('names where it shows, as its panel places it', async () => {
        h.settings.set('foreground-quick-text-setting-q', 'Parking');
        h.settings.set(
            'quick-text-q-setting-show-widget-alignment-data',
            JSON.stringify({
                horizontalAlignment: 'left',
                verticalAlignment: 'end',
            }),
        );
        const plan = await planOk(toSession('quick-text', 'q'));
        expect(plan.detail).toBe(
            'a line of text for 5 seconds, at the bottom left of the screen: ' +
                '"Parking"',
        );
    });

    it('stays until hidden when the session says so, five seconds by default otherwise', async () => {
        h.settings.set('foreground-quick-text-setting', 'Hello');
        const timed = await planOk(toContext('quick-text'));
        expect(timed.detail).toBe(
            'a line of text for 5 seconds, in the middle of the screen: "Hello"',
        );
        h.settings.set('foreground-quick-text-is-infinite', 'true');
        h.settings.set('foreground-quick-text-time-delay', '-2');
        const infinite = await planOk(toContext('quick-text'));
        expect(infinite.detail).toBe(
            'a line of text until it is hidden, in the middle of the screen: ' +
                '"Hello"',
        );
        const { screen, manager } = genScreen();
        infinite.apply(screen);
        expect(manager.calls[0][1]).toMatchObject({
            isInfinite: true,
            timeSecondDelay: 0,
            timeSecondToLive: 5,
        });
        expect(manager.calls[0][1]).not.toHaveProperty('id');
    });
});

describe('planShow: messages', () => {
    it('refuses a session whose editors hold no words', async () => {
        h.settings.set('foreground-message-setting-s2', '  \n\n  ');
        expect(await planReason(toSession('message', 's2'))).toContain(
            'has no words to show',
        );
        expect(await planReason(toContext('message'))).toContain(
            'has no words to show',
        );
    });

    it("stacks the session's messages one under another, replacing only its own", async () => {
        h.settings.set(
            'foreground-message-setting-s2',
            'Welcome\n\nCoffee after\nthe service',
        );
        const plan = await planOk(toSession('message', 's2'));
        expect(plan.detail).toBe('2 messages, one under another');
        const otherSession = { id: 'message-0', textList: ['Default'] };
        const { screen, manager } = genScreen(1, {
            messageDataList: [
                { id: 'message-0-s2', textList: ['Old'] },
                otherSession,
                { id: 'message-all-s2', textList: ['Old', 'all'] },
            ],
        });
        plan.apply(screen);
        const list = manager.foregroundData.messageDataList;
        expect(list[0]).toBe(otherSession);
        expect(
            list.map((item: any) => {
                return [item.id, item.textList];
            }),
        ).toEqual([
            ['message-0', ['Default']],
            ['message-0-s2', ['Welcome']],
            ['message-1-s2', ['Coffee after', 'the service']],
        ]);
        expect(list[1].extraStyle).toEqual({
            look: 'message-s2',
            rows: TEXT_ROWS,
        });
        // The second is pushed down below the first.
        expect(list[1].stackKey).toBe('message-s2');
        expect(list[2].extraStyle.marginTop).toMatch(/em/);
        expect(list[1].extraStyle).not.toHaveProperty('marginTop');
    });

    it('says the words of one message', async () => {
        h.settings.set('foreground-message-setting', ' Doors open at six ');
        // Rotating ONE message is just showing it.
        h.settings.set('foreground-message-is-rotating', 'true');
        const plan = await planOk(toContext('message'));
        expect(plan.detail).toBe('a message: "Doors open at six"');
    });

    it("rotates the session's messages in one box, in place of its single ones", async () => {
        h.settings.set('foreground-message-setting-s2', 'One\n\nTwo');
        h.settings.set('foreground-message-is-rotating-s2', 'true');
        h.settings.set('foreground-message-interval-s2', '12');
        h.settings.set('message-s2-setting-show-widget-transition', 'fade');
        const plan = await planOk(toSession('message', 's2'));
        expect(plan.detail).toBe('2 messages shown in turn, 12 seconds each');
        const otherSession = { id: 'message-1', textList: ['Default'] };
        const { screen, manager } = genScreen(1, {
            messageDataList: [
                { id: 'message-1-s2', textList: ['Two'] },
                otherSession,
                { id: 'message-all-s2', textList: ['stale'] },
            ],
        });
        plan.apply(screen);
        expect(manager.foregroundData.messageDataList).toEqual([
            otherSession,
            {
                id: 'message-all-s2',
                transitionEffect: 'fade',
                textList: ['One', 'Two'],
                intervalSecond: 12,
                extraStyle: { look: 'message-s2', rows: TEXT_ROWS },
            },
        ]);
    });

    it('rotates every eight seconds when no interval is set', async () => {
        h.settings.set('foreground-message-setting', 'One\n\nTwo');
        h.settings.set('foreground-message-is-rotating', 'true');
        const plan = await planOk(toContext('message'));
        expect(plan.detail).toBe('2 messages shown in turn, 8 seconds each');
    });
});

describe('planShow: time', () => {
    it('refuses a Time session that has no clock', async () => {
        expect(await planReason(toSession('time', 't'))).toContain(
            'has no clock yet',
        );
    });

    it('puts up every clock of the session, each from its own settings', async () => {
        h.settings.set(
            'foreground-time-id-list-t',
            JSON.stringify(['c1', 'c2']),
        );
        h.settings.set('foreground-city-name-setting-c1', 'Springfield');
        h.settings.set('foreground-timezone-minute-offset-setting-c1', '0');
        h.settings.set('foreground-time-is-24-hour-format-setting-c1', 'true');
        h.settings.set('time-c2-setting-show-widget-is-behind', 'true');
        const plan = await planOk(toSession('time', 't'));
        expect(plan.detail).toBe('2 clocks');
        const { screen, manager } = genScreen();
        plan.apply(screen);
        expect(manager.calls).toEqual([
            [
                'addTimeData',
                {
                    id: 'c1',
                    // UTC itself is an offset like any other.
                    timezoneMinuteOffset: 0,
                    title: 'Springfield',
                    is24HourFormat: true,
                    extraStyle: { look: 'time-c1', rows: TEXT_ROWS },
                },
            ],
            [
                'addTimeData',
                {
                    id: 'c2',
                    timezoneMinuteOffset: -new Date().getTimezoneOffset() / 60,
                    title: null,
                    is24HourFormat: false,
                    extraStyle: { look: 'time-c2', rows: TEXT_ROWS },
                    isBehind: true,
                },
            ],
        ]);
    });

    it('puts up the one clock named, by its city when it has one', async () => {
        h.settings.set('foreground-city-name-setting-c1', 'Springfield');
        expect(
            (await planOk({ ...toSession('time', 't'), itemId: 'c1' })).detail,
        ).toBe('a clock for Springfield');
        expect(
            (await planOk({ ...toSession('time', 't'), itemId: 'c9' })).detail,
        ).toBe('a clock');
    });
});

describe('planShow: video, image and web', () => {
    it('asks which file when none is named', async () => {
        for (const widget of ['video', 'image', 'web'] as const) {
            expect(await planReason(toContext(widget))).toBe(
                `Say which ${widget} to show: file, by its name.`,
            );
        }
    });

    it("puts the session's clip up in place of its last one, with its sound", async () => {
        h.settings.set('video-show-v-sound-on', 'true');
        h.settings.set('video-show-v-sound-volume', '40');
        const plan = await planOk(toSession('video', 'v'), {
            filePath: String.raw`C:\clips\snow.mp4`,
        });
        expect(plan.detail).toBe('"snow.mp4"');
        const otherSession = { filePath: 'sparks.mp4' };
        const { screen, manager } = genScreen(1, {
            videoDataList: [{ id: 'v', filePath: 'old.mp4' }, otherSession],
        });
        plan.apply(screen);
        expect(manager.calls.map(([name]: [string]) => name)).toEqual([
            'setVideoDataList',
        ]);
        expect(manager.foregroundData.videoDataList).toEqual([
            otherSession,
            {
                filePath: String.raw`C:\clips\snow.mp4`,
                id: 'v',
                extraStyle: { look: 'video-show-v', rows: PICTURE_ROWS },
                isSoundOn: true,
                soundVolume: 40,
            },
        ]);
    });

    it('puts a picture up for the Default session, with no sound of its own', async () => {
        const plan = await planOk(toContext('image'), {
            filePath: '/pictures/logo.png',
        });
        expect(plan.detail).toBe('"logo.png"');
        const otherSession = { id: 'b', filePath: 'b.png' };
        const { screen, manager } = genScreen(1, {
            imageDataList: [{ filePath: 'old.png' }, otherSession],
        });
        plan.apply(screen);
        expect(manager.calls[0][0]).toBe('setImageDataList');
        expect(manager.foregroundData.imageDataList).toEqual([
            otherSession,
            {
                filePath: '/pictures/logo.png',
                extraStyle: { look: 'image-show', rows: PICTURE_ROWS },
            },
        ]);
    });

    it('draws a web page at its width of the screen, sixteen by nine', async () => {
        h.settings.set('web-show-w-setting-show-widget-width-percentage', '80');
        h.settings.set('web-show-w-setting-show-widget-is-behind', 'true');
        const plan = await planOk(toSession('web', 'w'), {
            filePath: 'clock.html',
        });
        const { screen, manager } = genScreen();
        plan.apply(screen);
        expect(manager.calls[0][0]).toBe('setWebDataList');
        expect(manager.foregroundData.webDataList).toEqual([
            {
                filePath: 'clock.html',
                id: 'w',
                extraStyle: { look: 'web-show-w', rows: PICTURE_ROWS },
                widthScale: 0.8,
                heightScale: 0.45,
                isBehind: true,
            },
        ]);
    });
});

describe('planShow: camera and screen', () => {
    it('asks which camera, then puts it up by its label', async () => {
        expect(await planReason(toContext('camera'))).toBe(
            'Say which camera to show: camera, by its name.',
        );
        const plan = await planOk(toContext('camera', { itemId: 'cam-1' }), {
            cameraLabel: 'Front',
        });
        expect(plan.detail).toBe('the camera "Front"');
        const { screen, manager } = genScreen();
        plan.apply(screen);
        expect(manager.calls).toEqual([
            [
                'addCameraData',
                {
                    id: 'cam-1',
                    label: 'Front',
                    extraStyle: {
                        look: 'camera-cam-1',
                        rows: 'isGeometry,isCommonStyle,isBlendMode',
                    },
                },
            ],
        ]);
        const unnamed = await planOk(toContext('camera', { itemId: 'cam-2' }));
        expect(unnamed.detail).toBe('the camera "cam-2"');
    });

    it('asks which screen by number, and never shows a screen itself', async () => {
        expect(await planReason(toContext('screen', { itemId: 'abc' }))).toBe(
            'Say which screen to show: source, its number.',
        );
        expect(await planReason(toContext('screen'))).toContain('which screen');
        const plan = await planOk(toContext('screen', { itemId: '2' }));
        expect(plan.detail).toBe('what screen 2 shows');
        const itself = genScreen(2);
        plan.apply(itself.screen);
        expect(itself.manager.calls).toEqual([]);
        const other = genScreen(1);
        plan.apply(other.screen);
        expect(other.manager.calls).toEqual([
            [
                'addScreenData',
                {
                    id: 2,
                    extraStyle: { look: 'screen-show-2', rows: PICTURE_ROWS },
                },
            ],
        ]);
    });
});

describe('planShow: Long Text Show', () => {
    function setSession(suffix: string, session: object) {
        h.settings.set(`long-text-setting${suffix}`, JSON.stringify(session));
    }

    it('refuses a session that holds no text', async () => {
        expect(await planReason(toSession('long-text', 's5'))).toContain(
            'holds no text yet',
        );
    });

    it('refuses languages that do not line up, or a song it cannot read', async () => {
        setSession('-s5', {
            languages: [
                { langCode: 'en', source: 'raw', sections: ['One', 'Two'] },
                { langCode: 'xx', source: 'raw', sections: ['Uno'] },
            ],
        });
        expect(await planReason(toSession('long-text', 's5'))).toContain(
            'cannot go up as it is',
        );
        setSession('-s5', {
            languages: [{ langCode: 'en', source: 'lyric', lyricFilePath: '' }],
        });
        expect(await planReason(toSession('long-text', 's5'))).toContain(
            'cannot go up as it is',
        );
    });

    it("puts the session's columns up on the screen's long-text layer, a copy each", async () => {
        setSession('-s5', {
            languages: [
                {
                    langCode: 'en',
                    source: 'raw',
                    title: 'Hymn',
                    sections: ['First verse', 'Second verse'],
                    style: { fontSizeScale: 1.5 },
                },
                {
                    langCode: 'xx',
                    source: 'raw',
                    title: '',
                    sections: ['Primo', 'Secondo'],
                },
            ],
            isStacked: true,
            isNumberHidden: true,
        });
        const plan = await planOk(toSession('long-text', 's5'));
        expect(plan.detail).toBe('the long text "Hymn"');
        const applyList: any[] = [];
        h.getLongTextInstance.mockImplementation((screenId: number) => {
            return screenId === 3
                ? null
                : {
                      applyFullDataSrcWithSyncGroup: (data: any) => {
                          applyList.push(data);
                      },
                  };
        });
        plan.apply(genScreen(1).screen);
        plan.apply(genScreen(2).screen);
        // A screen with no long-text manager is passed over.
        plan.apply(genScreen(3).screen);
        expect(h.getLongTextInstance.mock.calls).toEqual([[1], [2], [3]]);
        expect(applyList).toHaveLength(2);
        expect(applyList[0]).toEqual(applyList[1]);
        expect(applyList[0]).not.toBe(applyList[1]);
        const [item] = applyList;
        expect(item).toMatchObject({
            type: 'long-text',
            locale: 'en-US',
            longTextData: {
                sourceId: 'long-text-s5',
                isStacked: true,
                isNumberHidden: true,
            },
        });
        expect(
            item.longTextData.renderedList.map((column: any) => {
                return [
                    column.code,
                    column.title,
                    column.sections.map((section: any) => {
                        return `${section.num}:${section.text}`;
                    }),
                ];
            }),
        ).toEqual([
            ['EN', 'Hymn', ['1:First verse', '2:Second verse']],
            ['XX', '', ['1:Primo', '2:Secondo']],
        ]);
        expect(item.longTextData.renderedList[0].style).toEqual({
            fontSizeScale: 1.5,
        });
    });

    it('stacks one language with nothing, and names no title it lacks', async () => {
        setSession('', {
            languages: [{ langCode: 'en', source: 'raw', sections: ['Only'] }],
            isStacked: true,
        });
        const plan = await planOk(toContext('long-text'));
        expect(plan.detail).toBe('the long text');
        let applied: any = null;
        h.getLongTextInstance.mockReturnValue({
            applyFullDataSrcWithSyncGroup: (data: any) => {
                applied = data;
            },
        });
        plan.apply(genScreen().screen);
        expect(applied.longTextData).not.toHaveProperty('isStacked');
        expect(applied.longTextData.sourceId).toBe('long-text');
    });
});

describe('planShow: no such component', () => {
    it('says so', async () => {
        expect(await planReason(toContext('nothing' as any))).toBe(
            'There is no component called "nothing".',
        );
    });
});

describe('hideOnScreen', () => {
    it("takes a Long Text Show session's text off that screen only", () => {
        const { screen } = genScreen(4);
        hideOnScreen(toSession('long-text', 's5'), screen);
        expect(h.hideLongText).toHaveBeenCalledWith('long-text-s5', 4);
    });

    it('touches nothing when the session has nothing up', () => {
        const { screen, manager } = genScreen(1, {
            countdownDataList: [{ id: 'other' }],
        });
        hideOnScreen(
            toSession('countdown', 'mine', ['', 'mine', 'other']),
            screen,
        );
        expect(manager.calls).toEqual([]);
    });

    it("takes off a session's entry, and a gone session's with the first", () => {
        const other = { id: 'b', text: 'Theirs' };
        const { screen, manager } = genScreen(1, {
            marqueeTopDataList: [{ text: 'Default' }, other, { id: 'gone' }],
        });
        hideOnScreen(toSession('marquee-top', '', ['', 'b']), screen);
        expect(manager.calls.map(([name]: [string]) => name)).toEqual([
            'remove:marqueeTopDataList',
            'remove:marqueeTopDataList',
        ]);
        expect(manager.foregroundData.marqueeTopDataList).toEqual([other]);
    });

    it("takes a session's messages off and leaves the others", () => {
        const other = { id: 'message-0' };
        const { screen, manager } = genScreen(1, {
            messageDataList: [
                { id: 'message-0-s2' },
                other,
                { id: 'message-all-s2' },
            ],
        });
        hideOnScreen(toSession('message', 's2'), screen);
        expect(manager.foregroundData.messageDataList).toEqual([other]);
    });

    it('takes off the clock named, and leaves the others', () => {
        const { screen, manager } = genScreen(1, {
            timeDataList: [{ id: 'c1' }, { id: 'c2' }],
        });
        hideOnScreen({ ...toSession('time', 't'), itemId: 'c2' }, screen);
        expect(manager.calls).toEqual([['removeTimeData', { id: 'c2' }]]);
        expect(manager.foregroundData.timeDataList).toEqual([{ id: 'c1' }]);
    });

    it("takes a media session's file off its own list", () => {
        for (const [widget, key] of [
            ['video', 'videoDataList'],
            ['image', 'imageDataList'],
            ['web', 'webDataList'],
        ] as const) {
            const other = { id: 'b', filePath: 'b' };
            const { screen, manager } = genScreen(1, {
                [key]: [{ id: 'a', filePath: 'a' }, other],
            });
            hideOnScreen(toSession(widget, 'a', ['', 'a', 'b']), screen);
            expect(manager.foregroundData[key]).toEqual([other]);
        }
    });

    it('takes off the camera or source screen named', () => {
        const { screen, manager } = genScreen(1, {
            cameraDataList: [{ id: 'front' }, { id: 'side' }],
            screenDataList: [{ id: 2 }, { id: 3 }],
        });
        hideOnScreen(toContext('camera', { itemId: 'front' }), screen);
        hideOnScreen(toContext('screen', { itemId: '3' }), screen);
        expect(manager.foregroundData.cameraDataList).toEqual([{ id: 'side' }]);
        expect(manager.foregroundData.screenDataList).toEqual([{ id: 2 }]);
        expect(manager.calls.map(([name]: [string]) => name)).toEqual([
            'removeCameraData',
            'removeScreenData',
        ]);
    });
});

describe('checkIsOnScreen', () => {
    it("asks the long-text layer whether this screen shows the session's text", () => {
        h.getLongTextShowingList.mockReturnValue([
            [1, {}],
            [3, {}],
        ]);
        const context = toSession('long-text', 's5');
        expect(checkIsOnScreen(context, genScreen(3).screen)).toBe(true);
        expect(checkIsOnScreen(context, genScreen(2).screen)).toBe(false);
        expect(h.getLongTextShowingList).toHaveBeenCalledWith('long-text-s5');
    });

    it('is whether the session owns something on that screen', () => {
        const { screen } = genScreen(1, {
            stopwatchDataList: [{ id: 'b' }],
        });
        expect(
            checkIsOnScreen(toSession('stopwatch', 'b', ['', 'b']), screen),
        ).toBe(true);
        expect(
            checkIsOnScreen(toSession('stopwatch', '', ['', 'b']), screen),
        ).toBe(false);
    });
});

describe('restyleOnScreen', () => {
    it("re-dresses Long Text Show's columns by their language", async () => {
        h.settings.set(
            'long-text-setting-s5',
            JSON.stringify({
                languages: [
                    {
                        langCode: 'en',
                        source: 'raw',
                        sections: ['x'],
                        style: { fontSizeScale: 2 },
                    },
                ],
            }),
        );
        await restyleOnScreen(toSession('long-text', 's5'), genScreen().screen);
        expect(h.restyleLongText).toHaveBeenCalledWith('long-text-s5', {
            EN: { fontSizeScale: 2 },
        });
    });

    it('touches nothing when the session has nothing up', async () => {
        const { screen, manager } = genScreen(1, {
            quickTextDataList: [{ id: 'b' }],
        });
        await restyleOnScreen(
            toSession('quick-text', 'a', ['', 'a', 'b']),
            screen,
        );
        expect(manager.calls).toEqual([]);
    });

    it('takes a timer down and puts a NEW datum up, its timing kept', async () => {
        const old = {
            id: 'b',
            dateTime: new Date(NOW.getTime() + 60_000),
            durationMillisecond: 60_000,
            pausedMillisecond: 30_000,
            extraStyle: { look: 'stale' },
            isBehind: true,
        };
        const { screen, manager } = genScreen(1, { countdownDataList: [old] });
        h.settings.set('countdown-b-look-color', 'red');
        await restyleOnScreen(toSession('countdown', 'b'), screen);
        expect(manager.calls.map(([name]: [string]) => name)).toEqual([
            'remove:countdownDataList',
            'put:countdownDataList',
        ]);
        const [restyled] = manager.foregroundData.countdownDataList;
        expect(restyled).not.toBe(old);
        // Its layer setting is off now: the datum leaves the back layer.
        expect(restyled).toEqual({
            id: 'b',
            dateTime: old.dateTime,
            durationMillisecond: 60_000,
            pausedMillisecond: 30_000,
            extraStyle: { look: 'countdown-b', rows: TEXT_ROWS, color: 'red' },
        });
        // The datum the screen held is never written into.
        expect(old.extraStyle).toEqual({ look: 'stale' });
        expect(old.isBehind).toBe(true);
    });

    it("re-dresses a quick text and a stopwatch from their own session's look", async () => {
        const quick = { id: 'q', htmlText: '<p>Hi</p>', extraStyle: {} };
        const watch = { dateTime: NOW, pausedMillisecond: 0, extraStyle: {} };
        const { screen, manager } = genScreen(1, {
            quickTextDataList: [quick],
            stopwatchDataList: [watch],
        });
        h.settings.set('quick-text-q-setting-show-widget-is-behind', 'true');
        await restyleOnScreen(toSession('quick-text', 'q'), screen);
        await restyleOnScreen(toContext('stopwatch'), screen);
        expect(manager.foregroundData.quickTextDataList).toEqual([
            {
                id: 'q',
                htmlText: '<p>Hi</p>',
                extraStyle: {
                    look: 'quick-text-q',
                    rows: `${TEXT_ROWS},isMargin`,
                },
                isBehind: true,
            },
        ]);
        expect(manager.foregroundData.stopwatchDataList).toEqual([
            {
                dateTime: NOW,
                pausedMillisecond: 0,
                extraStyle: { look: 'stopwatch', rows: TEXT_ROWS },
            },
        ]);
    });

    it('re-dresses a marquee with its speed and size, its words kept', async () => {
        const old = {
            id: 'm',
            text: 'Welcome',
            speedPercentage: 100,
            extraStyle: {},
        };
        const { screen, manager } = genScreen(1, {
            marqueeBottomDataList: [old],
        });
        h.settings.set('foreground-marquee-bottom-speed-percentage-m', '250');
        h.settings.set('foreground-marquee-bottom-font-size-m', '36');
        await restyleOnScreen(toSession('marquee-bottom', 'm'), screen);
        expect(manager.calls.map(([name]: [string]) => name)).toEqual([
            'put:marqueeBottomDataList',
        ]);
        expect(manager.foregroundData.marqueeBottomDataList).toEqual([
            {
                id: 'm',
                text: 'Welcome',
                speedPercentage: 250,
                extraStyle: {
                    look: 'marquee-bottom-m',
                    rows: 'isCommonStyle',
                    fontSize: '36px',
                },
            },
        ]);
        expect(old.speedPercentage).toBe(100);
    });

    it("puts a session's messages up again in its new look, or leaves them when its words are gone", async () => {
        const { screen, manager } = genScreen(1, {
            messageDataList: [
                { id: 'message-0-s2', textList: ['Hi'], extraStyle: {} },
            ],
        });
        h.settings.set('foreground-message-setting-s2', 'Hi');
        h.settings.set('message-s2-look-color', 'blue');
        await restyleOnScreen(toSession('message', 's2'), screen);
        expect(manager.foregroundData.messageDataList).toEqual([
            {
                id: 'message-0-s2',
                textList: ['Hi'],
                intervalSecond: null,
                stackKey: 'message-s2',
                extraStyle: {
                    look: 'message-s2',
                    rows: TEXT_ROWS,
                    color: 'blue',
                },
            },
        ]);
        h.settings.set('foreground-message-setting-s2', '');
        const before = manager.foregroundData.messageDataList;
        await restyleOnScreen(toSession('message', 's2'), screen);
        expect(manager.foregroundData.messageDataList).toBe(before);
    });

    it('re-makes each clock of the session from its settings', async () => {
        h.settings.set('foreground-time-id-list-t', JSON.stringify(['c1']));
        const old = {
            id: 'c1',
            timezoneMinuteOffset: 3,
            title: 'Old',
            is24HourFormat: false,
            extraStyle: {},
        };
        const { screen, manager } = genScreen(1, { timeDataList: [old] });
        h.settings.set('foreground-city-name-setting-c1', 'Springfield');
        h.settings.set('foreground-timezone-minute-offset-setting-c1', '-5');
        await restyleOnScreen(toSession('time', 't'), screen);
        expect(manager.calls.map(([name]: [string]) => name)).toEqual([
            'removeTimeData',
            'addTimeData',
        ]);
        expect(manager.foregroundData.timeDataList).toEqual([
            {
                id: 'c1',
                timezoneMinuteOffset: -5,
                title: 'Springfield',
                is24HourFormat: false,
                extraStyle: { look: 'time-c1', rows: TEXT_ROWS },
            },
        ]);
    });

    it("puts each of a media session's files up again in its new look", async () => {
        const { screen, manager } = genScreen(1, {
            imageDataList: [{ id: 'i', filePath: 'logo.png', extraStyle: {} }],
        });
        h.settings.set('image-show-i-look-color', 'green');
        await restyleOnScreen(toSession('image', 'i'), screen);
        expect(manager.foregroundData.imageDataList).toEqual([
            {
                filePath: 'logo.png',
                id: 'i',
                extraStyle: {
                    look: 'image-show-i',
                    rows: PICTURE_ROWS,
                    color: 'green',
                },
            },
        ]);
    });

    it('re-dresses each camera and source screen from its own Properties', async () => {
        const camera = { id: 'front', label: 'Front', extraStyle: {} };
        const source = { id: 2, extraStyle: {} };
        const { screen, manager } = genScreen(1, {
            cameraDataList: [camera],
            screenDataList: [source],
        });
        h.settings.set('camera-front-setting-show-widget-is-behind', 'true');
        h.settings.set('screen-show-2-look-color', 'black');
        await restyleOnScreen(toContext('camera'), screen);
        await restyleOnScreen(toContext('screen'), screen);
        expect(manager.calls.map(([name]: [string]) => name)).toEqual([
            'removeCameraData',
            'addCameraData',
            'addScreenData',
        ]);
        expect(manager.foregroundData.cameraDataList).toEqual([
            {
                id: 'front',
                label: 'Front',
                extraStyle: {
                    look: 'camera-front',
                    rows: 'isGeometry,isCommonStyle,isBlendMode',
                },
                isBehind: true,
            },
        ]);
        expect(manager.foregroundData.screenDataList).toEqual([
            {
                id: 2,
                extraStyle: {
                    look: 'screen-show-2',
                    rows: PICTURE_ROWS,
                    color: 'black',
                },
            },
        ]);
        expect(camera.extraStyle).toEqual({});
    });
});

describe('applyTimerOnScreen', () => {
    const START = NOW.getTime();

    it('does nothing when the session has no timer up', () => {
        const { screen, manager } = genScreen();
        expect(
            applyTimerOnScreen(toContext('countdown'), screen, 'start', START),
        ).toBe(false);
        expect(manager.calls).toEqual([]);
    });

    it('starts, pauses, resumes and resets a countdown in place', () => {
        const notStarted = {
            id: 'a',
            dateTime: new Date(START + 300_000),
            durationMillisecond: 300_000,
            pausedMillisecond: 300_000,
            extraStyle: {},
        };
        const { screen, manager } = genScreen(1, {
            countdownDataList: [notStarted],
        });
        const context = toSession('countdown', 'a');
        const current = () => {
            return manager.foregroundData.countdownDataList[0];
        };
        expect(applyTimerOnScreen(context, screen, 'start', START)).toBe(true);
        expect(current()).toEqual({
            id: 'a',
            dateTime: new Date(START + 300_000),
            durationMillisecond: 300_000,
            extraStyle: {},
        });
        // Paused 100 seconds in: 200 seconds are left.
        applyTimerOnScreen(context, screen, 'pause', START + 100_000);
        expect(current().pausedMillisecond).toBe(200_000);
        applyTimerOnScreen(context, screen, 'resume', START + 500_000);
        expect(current()).not.toHaveProperty('pausedMillisecond');
        expect(current().dateTime).toEqual(new Date(START + 700_000));
        applyTimerOnScreen(context, screen, 'reset', START + 600_000);
        expect(current()).toMatchObject({
            durationMillisecond: 300_000,
            pausedMillisecond: 300_000,
        });
        expect(manager.calls.map(([name]: [string]) => name)).toEqual([
            'setCountdownData',
            'setCountdownData',
            'setCountdownData',
            'setCountdownData',
        ]);
        expect(notStarted.pausedMillisecond).toBe(300_000);
    });

    it('starts, pauses and resets a stopwatch in place', () => {
        const { screen, manager } = genScreen(1, {
            stopwatchDataList: [
                {
                    dateTime: new Date(START),
                    pausedMillisecond: 0,
                    extraStyle: {},
                },
            ],
        });
        const context = toContext('stopwatch');
        const current = () => {
            return manager.foregroundData.stopwatchDataList[0];
        };
        expect(applyTimerOnScreen(context, screen, 'start', START)).toBe(true);
        expect(current()).not.toHaveProperty('pausedMillisecond');
        expect(current().dateTime).toEqual(new Date(START));
        applyTimerOnScreen(context, screen, 'pause', START + 42_000);
        expect(current().pausedMillisecond).toBe(42_000);
        applyTimerOnScreen(context, screen, 'resume', START + 50_000);
        expect(current().dateTime).toEqual(new Date(START + 8_000));
        applyTimerOnScreen(context, screen, 'reset', START + 60_000);
        expect(current().pausedMillisecond).toBe(0);
    });

    it('has no timer to work on a marquee', () => {
        const { screen, manager } = genScreen(1, {
            marqueeTopDataList: [{ text: 'x' }],
        });
        expect(
            applyTimerOnScreen(
                toContext('marquee-top'),
                screen,
                'pause',
                START,
            ),
        ).toBe(false);
        expect(manager.calls).toEqual([]);
    });
});
