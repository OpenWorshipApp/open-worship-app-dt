// @vitest-environment jsdom

/**
 * Every SESSION of the countdown, stopwatch, marquees and quick text owns its
 * own overlay on a screen (`ForegroundDataType`'s per-session lists): a
 * session's Show replaces only what that session had up and leaves every
 * other session's beside it.
 */

import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
    getSetting: vi.fn(),
    setSetting: vi.fn(),
    getForegroundDataListOnScreenSetting: vi.fn(() => ({})),
    genCountdown: vi.fn(),
    genStopwatch: vi.fn(),
    genMarquee: vi.fn(),
    genQuickText: vi.fn(),
    unlocking: vi.fn((_key: string, callback: () => unknown) => callback()),
    appProvider: {
        isPagePresenter: false,
        isPageScreen: false,
        pathUtils: {
            basename: (value: string) => value.split(/[\\/]/).at(-1) ?? value,
            join: (...parts: string[]) => parts.join('/'),
            resolve: (...parts: string[]) => parts.join('/'),
            sep: '/',
        },
        systemUtils: { isDev: false },
        // langHelpers registers a menu listener at module load.
        messageUtils: {
            listenForData: vi.fn(),
            sendData: vi.fn(),
        },
    },
}));

vi.mock('../../helper/settingHelpers', () => ({
    getSetting: mocks.getSetting,
    setSetting: mocks.setSetting,
}));
vi.mock('../../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: mocks.getSetting,
        setItem: mocks.setSetting,
    },
}));
vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: mocks.unlocking,
}));
vi.mock('../../server/appProvider', () => ({
    default: mocks.appProvider,
}));
vi.mock('../../helper/loggerHelpers', () => ({
    appLog: vi.fn(),
}));
vi.mock('../../helper/errorHelpers', () => ({
    handleError: vi.fn(),
}));
vi.mock('../screenHelpers', () => ({
    getForegroundDataListOnScreenSetting:
        mocks.getForegroundDataListOnScreenSetting,
}));
vi.mock('../screenForegroundHelpers', () => ({
    genHtmlForegroundMessage: vi.fn(),
    genHtmlForegroundCountdown: mocks.genCountdown,
    genHtmlForegroundMarquee: mocks.genMarquee,
    genHtmlForegroundQuickText: mocks.genQuickText,
    genHtmlForegroundStopwatch: mocks.genStopwatch,
    genHtmlForegroundTime: vi.fn(),
    genHtmlForegroundWeb: vi.fn(),
    genHtmlForegroundVideo: vi.fn(),
    genHtmlForegroundImage: vi.fn(),
}));
vi.mock('../../helper/cameraHelpers', () => ({
    getCameraAndShowMedia: vi.fn(),
    requestCameraAccess: vi.fn(async () => true),
}));

let ScreenForegroundManager: any;

function createScreenManagerBase(screenId: number) {
    return {
        screenId,
        width: 1280,
        height: 720,
        noSyncGroupMap: new Map<string, boolean>(),
        checkIsLockedWithMessage: vi.fn(() => false),
        sendScreenMessage: vi.fn(),
        createScreenManagerBaseGhost: vi.fn((targetScreenId: number) => ({
            screenId: targetScreenId,
        })),
    } as any;
}

function createEffectManager() {
    const anim = {
        animIn: vi.fn(async (element: HTMLElement, parent: HTMLElement) => {
            parent.appendChild(element);
        }),
        animOut: vi.fn(async () => {}),
    };
    return { effectType: 'fade', styleAnimList: { fade: anim } } as any;
}

/**
 * A quick text the way `genHtmlForegroundQuickText` times it (its own test is
 * in `renderHelpers.test.tsx`): wait the delay, animate in, wait the time to
 * live, then call the manager's remove callback.
 */
function genTimedQuickText(data: any, animData: any, remove: () => void) {
    const element = document.createElement('p');
    element.textContent = data.htmlText;
    return {
        handleAdding: async (parent: HTMLElement) => {
            await new Promise<void>((resolve) => {
                setTimeout(resolve, data.timeSecondDelay * 1000);
            });
            await animData.animIn(element, parent);
            await new Promise<void>((resolve) => {
                setTimeout(resolve, data.timeSecondToLive * 1000);
            });
            remove();
        },
        handleRemoving: vi.fn(async () => {
            await animData.animOut(element);
        }),
    };
}

/** A clock widget that takes a new start or pause where it stands. */
function genClockWidget() {
    return {
        handleAdding: vi.fn((parent: HTMLElement) => {
            parent.appendChild(document.createElement('span'));
        }),
        handleRemoving: vi.fn(async () => {}),
        handleUpdating: vi.fn(() => true),
    };
}

// The remove handlers are async: a container leaves a few microtasks later.
async function flush() {
    await vi.advanceTimersByTimeAsync(0);
}

let nextScreenId = 900;
function createManager() {
    const manager = new ScreenForegroundManager(
        createScreenManagerBase(nextScreenId++),
        createEffectManager(),
    );
    const root = document.createElement('div');
    manager.rootContainer = root;
    return { manager, root };
}

describe('per-session foreground lists', () => {
    beforeAll(async () => {
        ({ default: ScreenForegroundManager } =
            await import('./ScreenForegroundManager'));
    }, 60000);

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '';
        mocks.getSetting.mockReturnValue(undefined);
        mocks.getForegroundDataListOnScreenSetting.mockReturnValue({});
        mocks.unlocking.mockImplementation(
            (_key: string, callback: () => unknown) => callback(),
        );
        mocks.genQuickText.mockImplementation(genTimedQuickText);
        mocks.genCountdown.mockImplementation(genClockWidget);
        mocks.genStopwatch.mockImplementation(genClockWidget);
        mocks.genMarquee.mockImplementation(() => ({
            element: document.createElement('div'),
            handleRemoving: vi.fn(async () => {}),
        }));
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    test("two sessions' quick texts stand side by side, and a session shown again replaces its own only", async () => {
        const { manager, root } = createManager();
        const matthew = {
            id: 'a',
            htmlText: 'Matthew 5:44',
            timeSecondDelay: 0,
            timeSecondToLive: 60,
            extraStyle: {},
        };
        const notice = {
            id: 'b',
            htmlText: 'Session 6',
            timeSecondDelay: 0,
            timeSecondToLive: 60,
            extraStyle: {},
        };
        manager.setQuickTextData(matthew);
        manager.setQuickTextData(notice);
        expect(manager.foregroundData.quickTextDataList).toEqual([
            matthew,
            notice,
        ]);
        expect(root.children).toHaveLength(2);
        const [matthewContainer, noticeContainer] = Array.from(root.children);
        await flush();
        expect(matthewContainer.textContent).toBe('Matthew 5:44');
        expect(noticeContainer.textContent).toBe('Session 6');
        const noticeWidget = mocks.genQuickText.mock.results[1].value;

        // Session A shown again with new words: its entry is replaced in
        // place, Session B's is left as it was -- the same DOM node, never
        // re-rendered, never taken down.
        const matthewAgain = { ...matthew, htmlText: 'Matthew 5:45' };
        manager.setQuickTextData(matthewAgain);
        expect(manager.foregroundData.quickTextDataList).toEqual([
            matthewAgain,
            notice,
        ]);
        expect(manager.foregroundData.quickTextDataList[1]).toBe(notice);
        await flush();
        expect(root.contains(matthewContainer)).toBe(false);
        expect(root.contains(noticeContainer)).toBe(true);
        expect(root.children).toHaveLength(2);
        expect(root.textContent).toContain('Matthew 5:45');
        expect(root.textContent).not.toContain('Matthew 5:44');
        expect(mocks.genQuickText).toHaveBeenCalledTimes(3);
        expect(mocks.genQuickText.mock.calls[2][0]).toBe(matthewAgain);
        expect(noticeWidget.handleRemoving).not.toHaveBeenCalled();
        manager.delete();
    });

    test('a session is taken off by its own id, the Default one by none, and every one by null', async () => {
        const { manager, root } = createManager();
        const key = 'marqueeBottomDataList';
        const sessionA = { id: 'a', text: 'Welcome', extraStyle: {} };
        const sessionB = { id: 'b', text: 'Parking full', extraStyle: {} };
        const fallback = { text: 'Default notice', extraStyle: {} };
        const putAll = () => {
            manager.setMarqueeBottomData(sessionA);
            manager.setMarqueeBottomData(fallback);
            manager.setMarqueeBottomData(sessionB);
        };
        const toTexts = () => {
            return manager.foregroundData[key].map((item: any) => {
                return item.text;
            });
        };
        putAll();
        expect(toTexts()).toEqual([
            'Welcome',
            'Default notice',
            'Parking full',
        ]);
        expect(root.children).toHaveLength(3);

        // Named by any datum of the session, not only the one up.
        manager.removeSessionData(key, { id: 'a', text: 'something else' });
        expect(toTexts()).toEqual(['Default notice', 'Parking full']);
        // No id is the Default session's.
        manager.removeSessionData(key, {});
        expect(toTexts()).toEqual(['Parking full']);
        // A session with nothing up takes nothing down.
        manager.removeSessionData(key, { id: 'missing' });
        expect(toTexts()).toEqual(['Parking full']);
        await flush();
        expect(root.children).toHaveLength(1);

        putAll();
        expect(toTexts()).toEqual([
            'Parking full',
            'Welcome',
            'Default notice',
        ]);
        // Null is a Clear of the whole kind.
        manager.removeSessionData(key, null);
        expect(manager.foregroundData[key]).toEqual([]);
        await flush();
        expect(root.children).toHaveLength(0);
        manager.delete();
    });

    test("the panel's Hide (a null text) takes down only the session it names", async () => {
        const { manager } = createManager();
        vi.spyOn(ScreenForegroundManager, 'chooseScreenIds').mockResolvedValue([
            manager.screenId,
        ]);
        const event = new MouseEvent('click') as any;
        await ScreenForegroundManager.setQuickText(
            event,
            '<p>Mine</p>',
            0,
            60,
            {},
            false,
            'a',
        );
        await ScreenForegroundManager.setQuickText(
            event,
            '<p>Default</p>',
            0,
            60,
        );
        await ScreenForegroundManager.setQuickText(
            event,
            '<p>Theirs</p>',
            0,
            60,
            {},
            false,
            'b',
        );
        const toWords = () => {
            return manager.foregroundData.quickTextDataList.map((item: any) => {
                return [item.id ?? '', item.htmlText];
            });
        };
        expect(toWords()).toEqual([
            ['a', '<p>Mine</p>'],
            ['', '<p>Default</p>'],
            ['b', '<p>Theirs</p>'],
        ]);
        await ScreenForegroundManager.setQuickText(
            event,
            null,
            0,
            0,
            {},
            false,
            'a',
        );
        expect(toWords()).toEqual([
            ['', '<p>Default</p>'],
            ['b', '<p>Theirs</p>'],
        ]);
        // No session named is the Default session.
        await ScreenForegroundManager.setQuickText(event, null, 0, 0);
        expect(toWords()).toEqual([['b', '<p>Theirs</p>']]);
        manager.delete();
    });

    test("a replaced quick text's old timer does not take down the entry that replaced it", async () => {
        const { manager, root } = createManager();
        const first = {
            id: 'a',
            htmlText: 'First',
            timeSecondDelay: 0,
            timeSecondToLive: 5,
            extraStyle: {},
        };
        const other = {
            id: 'b',
            htmlText: 'Other session',
            timeSecondDelay: 0,
            timeSecondToLive: 60,
            extraStyle: {},
        };
        manager.setQuickTextData(first);
        manager.setQuickTextData(other);
        await vi.advanceTimersByTimeAsync(2000);

        // Shown again 2 seconds in: the new entry keeps its OWN 5 seconds.
        const second = { ...first, htmlText: 'Second' };
        manager.setQuickTextData(second);
        // The first one's time runs out at 5 s: it is no longer up, and the
        // entry that replaced it stays.
        await vi.advanceTimersByTimeAsync(3500);
        expect(manager.foregroundData.quickTextDataList).toHaveLength(2);
        expect(manager.foregroundData.quickTextDataList[0]).toBe(second);
        expect(manager.foregroundData.quickTextDataList[1]).toBe(other);
        expect(root.textContent).toContain('Second');

        // The second's own time runs out at 7 s: it alone goes, the other
        // session's stays up.
        await vi.advanceTimersByTimeAsync(1500);
        expect(manager.foregroundData.quickTextDataList).toEqual([other]);
        expect(manager.foregroundData.quickTextDataList[0]).toBe(other);
        await flush();
        expect(root.textContent).not.toContain('Second');
        expect(root.textContent).toContain('Other session');
        manager.delete();
    });

    test("a countdown of one session started and paused is handed to its own widget, another session's untouched", async () => {
        const { manager, root } = createManager();
        const running = {
            id: 'b',
            dateTime: new Date(Date.now() + 300_000),
            durationMillisecond: 300_000,
            extraStyle: {},
        };
        const stopped = {
            id: 'a',
            dateTime: new Date(Date.now() + 60_000),
            durationMillisecond: 60_000,
            pausedMillisecond: 60_000,
            extraStyle: {},
        };
        manager.setCountdownData(running);
        manager.setCountdownData(stopped);
        expect(mocks.genCountdown).toHaveBeenCalledTimes(2);
        const runningWidget = mocks.genCountdown.mock.results[0].value;
        const stoppedWidget = mocks.genCountdown.mock.results[1].value;
        const [runningContainer, stoppedContainer] = Array.from(root.children);

        // Session A started: the same widget takes the new start in place.
        const started = {
            id: 'a',
            dateTime: new Date(Date.now() + 60_000),
            durationMillisecond: 60_000,
            extraStyle: {},
        };
        manager.setCountdownData(started);
        expect(stoppedWidget.handleUpdating).toHaveBeenCalledExactlyOnceWith(
            started,
        );
        // Then paused, still that widget.
        const paused = { ...started, pausedMillisecond: 45_000 };
        manager.setCountdownData(paused);
        expect(stoppedWidget.handleUpdating).toHaveBeenLastCalledWith(paused);
        expect(stoppedWidget.handleUpdating).toHaveBeenCalledTimes(2);

        await flush();
        // Nothing remounted: no new widget, no container taken down.
        expect(mocks.genCountdown).toHaveBeenCalledTimes(2);
        expect(stoppedWidget.handleRemoving).not.toHaveBeenCalled();
        expect(Array.from(root.children)).toEqual([
            runningContainer,
            stoppedContainer,
        ]);
        // Session B's countdown never heard of it.
        expect(runningWidget.handleUpdating).not.toHaveBeenCalled();
        expect(runningWidget.handleRemoving).not.toHaveBeenCalled();
        expect(manager.foregroundData.countdownDataList).toHaveLength(2);
        expect(manager.foregroundData.countdownDataList[0]).toBe(running);
        expect(manager.foregroundData.countdownDataList[1]).toBe(paused);

        // Hidden by its last datum, it is that widget that comes down.
        manager.removeSessionData('countdownDataList', paused);
        await flush();
        expect(stoppedWidget.handleRemoving).toHaveBeenCalledOnce();
        expect(Array.from(root.children)).toEqual([runningContainer]);
        expect(runningWidget.handleRemoving).not.toHaveBeenCalled();
        manager.delete();
    });

    test('a saved entry from before the lists keeps what it showed; nothing saved is five empty lists', () => {
        const quickText = {
            htmlText: '<p>Left up</p>',
            timeSecondDelay: 0,
            timeSecondToLive: 10,
        };
        const saved = {
            quickTextData: quickText,
            countdownData: {
                dateTime: '2026-11-09T10:00:00.000Z',
                durationMillisecond: 300_000,
            },
            stopwatchData: null,
            marqueeTopData: { text: 'Top' },
        };
        const parsed = ScreenForegroundManager.parseAllForegroundData(saved);
        expect(parsed.quickTextDataList).toEqual([quickText]);
        expect(parsed.countdownDataList).toHaveLength(1);
        expect(parsed.countdownDataList[0].dateTime).toBeInstanceOf(Date);
        expect(parsed.countdownDataList[0].dateTime.toISOString()).toBe(
            '2026-11-09T10:00:00.000Z',
        );
        expect(parsed.countdownDataList[0].durationMillisecond).toBe(300_000);
        // The saved entry is shared: it is read, never rewritten.
        expect(saved.countdownData.dateTime).toBe('2026-11-09T10:00:00.000Z');
        expect(parsed.stopwatchDataList).toEqual([]);
        expect(parsed.marqueeTopDataList).toEqual([{ text: 'Top' }]);
        expect(parsed.marqueeBottomDataList).toEqual([]);
        // A list beside an old slot is the newer write, and wins.
        expect(
            ScreenForegroundManager.parseAllForegroundData({
                quickTextDataList: [{ id: 'b', htmlText: 'New' }],
                quickTextData: quickText,
            }).quickTextDataList,
        ).toEqual([{ id: 'b', htmlText: 'New' }]);
        // A saved list's clocks are Dates again, every one of them.
        const savedList = ScreenForegroundManager.parseAllForegroundData({
            stopwatchDataList: [
                { id: 'a', dateTime: '2026-11-09T09:00:00.000Z' },
                { dateTime: '2026-11-09T09:30:00.000Z' },
            ],
        });
        expect(
            savedList.stopwatchDataList.map((item: any) => {
                return item.dateTime instanceof Date;
            }),
        ).toEqual([true, true]);

        const empty = ScreenForegroundManager.parseAllForegroundData({});
        for (const key of [
            'countdownDataList',
            'stopwatchDataList',
            'marqueeTopDataList',
            'marqueeBottomDataList',
            'quickTextDataList',
        ]) {
            expect(empty[key], key).toEqual([]);
        }
    });

    test('a clock list that crossed JSON gets its dates back; one that did not is the same object', () => {
        const startedAt = new Date('2026-11-09T09:00:00.000Z');
        const kept = { id: 'a', dateTime: startedAt };
        const payload = {
            countdownDataList: [
                kept,
                { id: 'b', dateTime: '2026-11-09T09:05:00.000Z' },
            ],
            stopwatchDataList: [{ dateTime: '2026-11-09T08:00:00.000Z' }],
            timeDataList: [],
        };
        const revived = ScreenForegroundManager.reviveTimerDates(payload);
        expect(revived).not.toBe(payload);
        expect(revived.countdownDataList[0]).toBe(kept);
        expect(revived.countdownDataList[1].dateTime).toBeInstanceOf(Date);
        expect(revived.countdownDataList[1].dateTime.toISOString()).toBe(
            '2026-11-09T09:05:00.000Z',
        );
        expect(revived.countdownDataList[1].id).toBe('b');
        expect(revived.stopwatchDataList[0].dateTime).toBeInstanceOf(Date);
        // The payload itself is left as it came.
        expect(payload.countdownDataList[1].dateTime).toBe(
            '2026-11-09T09:05:00.000Z',
        );

        const native = {
            countdownDataList: [kept],
            stopwatchDataList: [{ dateTime: startedAt }],
            timeDataList: [],
        };
        expect(ScreenForegroundManager.reviveTimerDates(native)).toBe(native);
        const noClocks = { timeDataList: [] } as any;
        expect(ScreenForegroundManager.reviveTimerDates(noClocks)).toBe(
            noClocks,
        );
    });

    test('a sync with no list, or a null one, leaves that kind empty', () => {
        const { manager } = createManager();
        manager.setQuickTextData({
            id: 'a',
            htmlText: 'Up',
            timeSecondDelay: 0,
            timeSecondToLive: 60,
            extraStyle: {},
        });
        manager.setStopwatchData({
            id: 'a',
            dateTime: new Date(),
            extraStyle: {},
        });
        manager.receiveSyncScreen({
            screenId: manager.screenId,
            type: 'foreground',
            data: {
                quickTextDataList: null,
                marqueeTopDataList: [{ id: 'b', text: 'Synced' }],
            },
        });
        expect(manager.foregroundData.quickTextDataList).toEqual([]);
        expect(manager.foregroundData.stopwatchDataList).toEqual([]);
        expect(manager.foregroundData.marqueeTopDataList).toEqual([
            { id: 'b', text: 'Synced' },
        ]);
        manager.delete();
    });
});
