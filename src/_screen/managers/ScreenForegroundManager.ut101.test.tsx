// @vitest-environment jsdom

/**
 * The panels' own Show and Hide for a countdown, a stopwatch and the two
 * marquees (`ScreenForegroundManager.set{Countdown,Stopwatch,MarqueeTop,
 * MarqueeBottom}`): a datum puts up THAT session's entry, a null takes off
 * that session's entry alone. The mock surface is the one
 * `foregroundSessionLists.test.tsx` uses.
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
    genHtmlForegroundQuickText: vi.fn(),
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

// The static setters do not await their screens: let them land.
async function flush() {
    await vi.advanceTimersByTimeAsync(0);
}

let nextScreenId = 1900;
function createManager() {
    const manager = new ScreenForegroundManager(
        createScreenManagerBase(nextScreenId++),
        createEffectManager(),
    );
    manager.rootContainer = document.createElement('div');
    vi.spyOn(ScreenForegroundManager, 'chooseScreenIds').mockResolvedValue([
        manager.screenId,
    ]);
    return manager;
}

const event = new MouseEvent('click') as any;

describe("a panel's Show and Hide of one session", () => {
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

    test('a countdown goes up as its session, and a null takes that session alone down', async () => {
        const manager = createManager();
        const target = new Date(Date.now() + 600_000);
        await ScreenForegroundManager.setCountdown(event, target);
        await ScreenForegroundManager.setCountdown(
            event,
            {
                dateTime: new Date(Date.now() + 60_000),
                durationMillisecond: 60_000,
                pausedMillisecond: 60_000,
            },
            { color: 'red' },
            false,
            'a',
            true,
            'zoom',
        );
        await flush();
        expect(manager.foregroundData.countdownDataList).toEqual([
            { dateTime: target, extraStyle: {} },
            {
                id: 'a',
                transitionEffect: 'zoom',
                dateTime: expect.any(Date),
                durationMillisecond: 60_000,
                pausedMillisecond: 60_000,
                extraStyle: { color: 'red' },
                isBehind: true,
            },
        ]);

        await ScreenForegroundManager.setCountdown(event, null, {}, false, 'a');
        await flush();
        expect(manager.foregroundData.countdownDataList).toEqual([
            { dateTime: target, extraStyle: {} },
        ]);
        // No session named is the Default session.
        await ScreenForegroundManager.setCountdown(event, null);
        await flush();
        expect(manager.foregroundData.countdownDataList).toEqual([]);
        expect(manager.isShowing).toBe(false);
        manager.delete();
    });

    test('a stopwatch goes up as its session, and a null takes that session alone down', async () => {
        const manager = createManager();
        const started = new Date(Date.now() - 5_000);
        await ScreenForegroundManager.setStopwatch(
            event,
            started,
            {},
            false,
            'a',
        );
        await ScreenForegroundManager.setStopwatch(event, {
            dateTime: new Date(Date.now()),
            pausedMillisecond: 0,
        });
        await flush();
        expect(
            manager.foregroundData.stopwatchDataList.map((item: any) => {
                return [item.id ?? '', item.pausedMillisecond ?? null];
            }),
        ).toEqual([
            ['a', null],
            ['', 0],
        ]);
        expect(manager.foregroundData.stopwatchDataList[0].dateTime).toBe(
            started,
        );
        expect(manager.isShowing).toBe(true);

        await ScreenForegroundManager.setStopwatch(event, null);
        await flush();
        expect(
            manager.foregroundData.stopwatchDataList.map((item: any) => {
                return item.id;
            }),
        ).toEqual(['a']);
        await ScreenForegroundManager.setStopwatch(event, null, {}, false, 'a');
        await flush();
        expect(manager.foregroundData.stopwatchDataList).toEqual([]);
        manager.delete();
    });

    test("each marquee's Hide takes down only the session it names, the other band untouched", async () => {
        const manager = createManager();
        await ScreenForegroundManager.setMarqueeTop(
            event,
            'Welcome',
            {},
            150,
            false,
            'a',
        );
        await ScreenForegroundManager.setMarqueeTop(event, 'Default top');
        await ScreenForegroundManager.setMarqueeBottom(
            event,
            'Parking full',
            { fontSize: '40px' },
            undefined,
            false,
            'b',
            true,
            'move',
        );
        await ScreenForegroundManager.setMarqueeBottom(event, 'Default bottom');
        await flush();
        const toTexts = (key: string) => {
            return manager.foregroundData[key].map((item: any) => {
                return [item.id ?? '', item.text];
            });
        };
        expect(toTexts('marqueeTopDataList')).toEqual([
            ['a', 'Welcome'],
            ['', 'Default top'],
        ]);
        expect(manager.foregroundData.marqueeTopDataList[0]).toMatchObject({
            speedPercentage: 150,
        });
        expect(manager.foregroundData.marqueeBottomDataList[0]).toEqual({
            id: 'b',
            transitionEffect: 'move',
            text: 'Parking full',
            speedPercentage: 100,
            extraStyle: { fontSize: '40px' },
            isBehind: true,
        });

        await ScreenForegroundManager.setMarqueeTop(
            event,
            null,
            {},
            100,
            false,
            'a',
        );
        await ScreenForegroundManager.setMarqueeBottom(event, null);
        await flush();
        expect(toTexts('marqueeTopDataList')).toEqual([['', 'Default top']]);
        expect(toTexts('marqueeBottomDataList')).toEqual([
            ['b', 'Parking full'],
        ]);

        await ScreenForegroundManager.setMarqueeTop(event, null);
        await ScreenForegroundManager.setMarqueeBottom(
            event,
            null,
            {},
            100,
            false,
            'b',
        );
        await flush();
        expect(manager.foregroundData.marqueeTopDataList).toEqual([]);
        expect(manager.foregroundData.marqueeBottomDataList).toEqual([]);
        expect(manager.isShowing).toBe(false);
        manager.delete();
    });

    test('a Hide for a session with nothing up changes nothing on the screen', async () => {
        const manager = createManager();
        await ScreenForegroundManager.setMarqueeTop(event, 'Default top');
        await flush();
        const before = manager.foregroundData.marqueeTopDataList;
        await ScreenForegroundManager.setMarqueeTop(
            event,
            null,
            {},
            100,
            false,
            'missing',
        );
        await flush();
        expect(manager.foregroundData.marqueeTopDataList).toEqual(before);
        expect(manager.rootContainer.children).toHaveLength(1);
        manager.delete();
    });
});
