import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        isPagePresenter: true,
        managers: [] as any[],
        settings: new Map<string, string>(),
        restoresList: [] as any[][],
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
    }),
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
import { FOREGROUND_EDIT_ACTIONS as MJS_EDIT_ACTIONS } from '../../tools/owa-devtools-mcp/agentForegroundEdit.mjs';

// A stand-in for `ScreenForegroundManager`: the data object the screens hold,
// and the setters the panels' own Show buttons call.
function genForegroundManager() {
    const manager: any = {
        foregroundData: {
            messageDataList: [],
            countdownData: null,
            stopwatchData: null,
            timeDataList: [],
            marqueeTopData: null,
            marqueeBottomData: null,
            quickTextData: null,
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
    for (const key of [
        'countdownData',
        'stopwatchData',
        'marqueeTopData',
        'marqueeBottomData',
        'quickTextData',
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
        const countdown = dataOf().countdownData;
        // The Default session's own look, a datum with no session id (the
        // Default panel's own), running at once with its length kept.
        expect(countdown.extraStyle.look).toBe('countdown');
        expect(countdown.id).toBeUndefined();
        expect(countdown.dateTime.getTime()).toBe(NOW.getTime() + 300000);
        expect(countdown.durationMillisecond).toBe(300000);
        expect(countdown.pausedMillisecond).toBeUndefined();
        expect(h.settings.get('foreground-countdown-sessions')).toBeUndefined();
        // An off screen holds it unseen: offered, never pressed.
        expect(result.note).toContain('do not press it unasked');
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
        expect(dataOf().countdownData).toMatchObject({
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
        // The same minutes again reuse it: no "(2)".
        const again: any = await handleAgentForegroundRequest(
            { widget: 'countdown', minutes: 10 },
            NOW,
        );
        expect(again.session).toMatchObject({ id: sessionId, isNew: false });
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
        expect(typeof dataOf().countdownData.pausedMillisecond).toBe('number');
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
        // The Bibles list's own Open in Quick Text look.
        expect(h.presets).toEqual([[suffix, 'bible-verse']]);
        expect(dataOf().quickTextData.htmlText).toContain('For God so loved');
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
        expect(dataOf().marqueeTopData).toMatchObject({
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
        expect(dataOf().countdownData.extraStyle.fontSize).toBe('125px');
        expect(h.notified).toEqual(['countdown']);
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
        dataOf(1).countdownData = { dateTime: NOW };
        const result: any = await handleAgentForegroundRequest({
            action: 'stop',
            widget: 'countdown',
        });
        expect(result.did).toBe('stopped');
        expect(dataOf(1).countdownData).toBeNull();
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

    it('an unknown component, and "all" anywhere but stop', async () => {
        const unknown: any = await handleAgentForegroundRequest({
            widget: 'fireworks',
        });
        expect(unknown.reason).toContain('quick-text');
        const all: any = await handleAgentForegroundRequest({ widget: 'all' });
        expect(all.reason).toContain('only stops');
    });
});
