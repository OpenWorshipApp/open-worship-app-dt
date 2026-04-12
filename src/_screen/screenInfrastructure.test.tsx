// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const getSettingMock = vi.fn();
const setSettingMock = vi.fn();
const sendDataMock = vi.fn();
const sendDataSyncMock = vi.fn();
const createMouseEventMock = vi.fn((x: number, y: number) => ({
    clientX: x,
    clientY: y,
}));
const electronSendAsyncMock = vi.fn(async () => undefined);
const showSimpleToastMock = vi.fn();
const receiveDroppedMock = vi.fn();
const enableSyncGroupMocks = {
    background: vi.fn(),
    vary: vi.fn(),
    bible: vi.fn(),
    foreground: vi.fn(),
};
const useScreenEventsSpy = vi.fn();
const useScreenBackgroundManagerEventsSpy = vi.fn();
const useScreenVaryAppDocumentManagerEventsSpy = vi.fn();
const useScreenBibleManagerEventsSpy = vi.fn();
const useScreenForegroundManagerEventsSpy = vi.fn();

const appProviderMock = {
    getIsMouseOverApp: () => true,
    getIsWindowFocused: () => true,
    isPagePresenter: true,
    isPageScreen: false,
    messageUtils: {
        sendData: sendDataMock,
        sendDataSync: sendDataSyncMock,
    },
    systemUtils: {
        generateMD5: (src: string) => `md5-${src}`,
        isDev: false,
    },
};

vi.mock('../helper/settingHelpers', () => ({
    getSetting: getSettingMock,
    setSetting: setSettingMock,
}));

vi.mock('../server/unlockingHelpers', () => ({
    unlocking: vi.fn((_key: string, callback: () => unknown) => callback()),
}));

vi.mock('../server/appProvider', () => ({
    default: appProviderMock,
}));

vi.mock('../scrolling/scrollingHandlerHelpers', () => ({
    PLAY_TO_BOTTOM_CLASSNAME: 'play-to-bottom',
    TO_THE_TOP_CLASSNAME: 'to-the-top',
    TO_THE_TOP_STYLE_STRING: '.floating-control { position: fixed; }',
    applyPlayToBottom: vi.fn(),
    applyToTheTop: vi.fn(),
}));

vi.mock('../context-menu/appContextMenuHelpers', () => ({
    createMouseEvent: createMouseEventMock,
}));

vi.mock('../helper/loggerHelpers', () => ({
    appLog: vi.fn(),
    appError: vi.fn(),
}));

vi.mock('../helper/errorHelpers', () => ({
    handleError: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (value: string) => value,
    checkIsValidLocale: vi.fn(() => true),
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('../server/appHelpers', () => ({
    electronSendAsync: electronSendAsyncMock,
}));

vi.mock('../helper/debuggerHelpers', () => ({
    useAppEffect: vi.fn(),
    useAppStateAsync: vi.fn(() => [false, vi.fn()]),
}));

vi.mock('../bible-list/BibleItem', () => ({
    default: class BibleItem {
        static readonly validate = vi.fn();
    },
}));

vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: {
        getAttachedBackground: vi.fn(async () => ({ type: 'bg-color', item: '#fff' })),
    },
}));

vi.mock('./managers/ScreenBackgroundManager', () => ({
    default: class ScreenBackgroundManager {
        static readonly eventNamePrefix = 'screen-bg';
        static readonly enableSyncGroup = enableSyncGroupMocks.background;
        static readonly getInstance = vi.fn(() => ({
            receiveScreenDropped: receiveDroppedMock,
        }));
    },
}));

vi.mock('./managers/ScreenForegroundManager', () => ({
    default: class ScreenForegroundManager {
        static readonly eventNamePrefix = 'screen-fg';
        static readonly enableSyncGroup = enableSyncGroupMocks.foreground;
    },
}));

vi.mock('./managers/ScreenBibleManager', () => ({
    default: class ScreenBibleManager {
        static readonly eventNamePrefix = 'screen-bible';
        static readonly enableSyncGroup = enableSyncGroupMocks.bible;
    },
}));

vi.mock('./managers/ScreenVaryAppDocumentManager', () => ({
    default: class ScreenVaryAppDocumentManager {
        static readonly eventNamePrefix = 'screen-vary';
        static readonly enableSyncGroup = enableSyncGroupMocks.vary;
    },
}));

vi.mock('./managers/ScreenManager', () => ({
    default: class MockScreenManager {
        static readonly initReceiveScreenMessage = vi.fn();

        readonly screenId: number;
        readonly key: string;
        isDeleted = false;
        colorNote: string | null = null;
        width = 1280;
        height = 720;
        _isSelected = false;
        _isLocked = false;
        _stageNumber = 0;
        screenBackgroundManager = {
            backgroundSrc: {
                type: 'video',
                src: '/video.mp4',
            },
        };

        constructor(screenId: number) {
            this.screenId = screenId;
            this.key = `${screenId}`;
        }

        get isSelected() {
            return this._isSelected;
        }

        set isSelected(value: boolean) {
            this._isSelected = value;
        }

        get isLocked() {
            return this._isLocked;
        }

        set isLocked(value: boolean) {
            this._isLocked = value;
        }

        get stageNumber() {
            return this._stageNumber;
        }

        set stageNumber(value: number) {
            this._stageNumber = value;
        }

        async getColorNote() {
            return this.colorNote;
        }

        fireRefreshEvent = vi.fn();
        registerEventListener = vi.fn(() => []);
        unregisterEventListener = vi.fn();
    },
}));

vi.mock('./managers/screenEventHelpers', () => ({
    useScreenEvents: useScreenEventsSpy,
    useScreenBackgroundManagerEvents: useScreenBackgroundManagerEventsSpy,
    useScreenVaryAppDocumentManagerEvents:
        useScreenVaryAppDocumentManagerEventsSpy,
    useScreenBibleManagerEvents: useScreenBibleManagerEventsSpy,
    useScreenForegroundManagerEvents: useScreenForegroundManagerEventsSpy,
}));

function createTimeContainer() {
    const container = document.createElement('div');
    container.innerHTML =
        '<div id="hour"></div><div id="minute"></div><div id="second"></div>';
    return container;
}

describe('screen infrastructure', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-12T10:11:12.000Z'));
        document.body.innerHTML = '';
        (globalThis as any).URL.createObjectURL = vi.fn(() => 'blob:test');
        appProviderMock.isPagePresenter = true;
        appProviderMock.isPageScreen = false;
        sendDataSyncMock.mockImplementation((channel: string) => {
            if (channel === 'main:app:get-screens') {
                return [0, 1];
            }
            if (channel === 'main:app:get-displays') {
                return {
                    primaryDisplay: {
                        id: 1,
                        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
                    },
                    displays: [
                        {
                            id: 1,
                            bounds: { x: 0, y: 0, width: 1920, height: 1080 },
                            label: 'Main',
                        },
                        {
                            id: 2,
                            bounds: { x: 1920, y: 0, width: 1280, height: 720 },
                            label: 'Side',
                        },
                    ],
                };
            }
            return null;
        });
        getSettingMock.mockReset();
        getSettingMock.mockImplementation((key: string) => {
            const settingMap: Record<string, string | undefined> = {
                'screen-manager-setting': undefined,
            };
            return settingMap[key];
        });
    });

    test('updates clock-like controllers and resets them on stop', async () => {
        const { default: TimingController } = await import(
            './managers/TimingController'
        );
        const { default: CountdownController } = await import(
            './managers/CountdownController'
        );
        const { default: StopwatchController } = await import(
            './managers/StopwatchController'
        );

        const timing = new TimingController(createTimeContainer(), 0);
        expect(timing.hourStr).toBe('10');
        expect(timing.minuteStr).toBe('11');
        expect(timing.secondStr).toBe('12');

        const countdown = new CountdownController(
            createTimeContainer(),
            new Date(Date.now() + 3_661_000),
        );
        expect(countdown.hourStr).toBe('01');
        expect(countdown.minuteStr).toBe('01');
        expect(countdown.secondStr).toBe('01');

        const stopwatch = new StopwatchController(
            createTimeContainer(),
            new Date(Date.now() - 3_661_000),
        );
        expect(stopwatch.hourStr).toBe('01');
        expect(stopwatch.minuteStr).toBe('01');
        expect(stopwatch.secondStr).toBe('01');

        timing.stop();
        countdown.stop();
        stopwatch.stop();

        expect(timing.divHour.textContent).toBe('00');
        expect(countdown.divMinute.textContent).toBe('00');
        expect(stopwatch.divSecond.textContent).toBe('00');
    });

    test('reads screen settings, sizes media, and decorates scroll containers', async () => {
        const { screenManagerSettingNames } = await import(
            '../helper/constants'
        );
        const screenHelpers = await import('./screenHelpers');

        getSettingMock.mockImplementation((key: string) => {
            if (key === screenManagerSettingNames.MANAGERS) {
                return JSON.stringify([{ screenId: 1 }, { screenId: 2 }]);
            }
            if (key === screenManagerSettingNames.FOREGROUND) {
                return JSON.stringify({
                    1: { marqueeData: { text: 'hello' }, timeDataList: [] },
                    9: { marqueeData: { text: 'skip' }, timeDataList: [] },
                });
            }
            if (key === screenManagerSettingNames.BACKGROUND) {
                return JSON.stringify({
                    1: { type: 'color', src: '#fff' },
                    9: { type: 'color', src: '#000' },
                });
            }
            if (key === screenManagerSettingNames.FULL_TEXT) {
                return JSON.stringify({
                    1: {
                        type: 'bible-item',
                        locale: 'en-US',
                        bibleItemData: {
                            renderedList: [],
                            bibleItem: {
                                id: 1,
                                bibleKey: 'KJV',
                                target: {
                                    bookKey: 'GEN',
                                    chapter: 1,
                                    verseStart: 1,
                                    verseEnd: 1,
                                },
                                metadata: {},
                            },
                        },
                        scroll: 0,
                        selectedKJVVerseKey: null,
                    },
                });
            }
            return undefined;
        });

        expect(
            screenHelpers.calMediaSizes(
                { parentWidth: 800, parentHeight: 600 },
                { width: 1600, height: 800 },
                'fit',
            ),
        ).toEqual({
            width: 800,
            height: 400,
            offsetH: 0,
            offsetV: 100,
        });

        screenHelpers.setDisplay({ screenId: 1, displayId: 2 });
        expect(sendDataMock).toHaveBeenCalledWith(
            'main:app:set-screen-display',
            { screenId: 1, displayId: 2 },
        );

        expect(screenHelpers.getAllShowingScreenIds()).toEqual([0, 1]);
        expect(screenHelpers.getAllDisplays().displays).toHaveLength(2);

        await screenHelpers.showScreen({ screenId: 1, displayId: 2 });
        expect(electronSendAsyncMock).toHaveBeenCalledWith(
            'main:app:show-screen',
            { screenId: 1, displayId: 2 },
        );

        screenHelpers.hideScreen(1);
        screenHelpers.hideAllScreens();
        expect(sendDataMock).toHaveBeenCalledWith('app:hide-screen', 1);
        expect(sendDataMock).toHaveBeenCalledWith('app:hide-all-screens');

        const miniScreen = document.createElement('div');
        miniScreen.className = 'mini-screen';
        miniScreen.getBoundingClientRect = () => ({
            x: 12,
            y: 24,
        }) as DOMRect;
        document.body.appendChild(miniScreen);
        expect(screenHelpers.genScreenMouseEvent()).toEqual({
            clientX: 12,
            clientY: 24,
        });
        expect(createMouseEventMock).toHaveBeenCalledWith(12, 24);

        expect(screenHelpers.getForegroundDataListOnScreenSetting()).toEqual({
            1: { marqueeData: { text: 'hello' }, timeDataList: [] },
        });
        expect(screenHelpers.getBackgroundSrcListOnScreenSetting()).toEqual({
            1: { type: 'color', src: '#fff' },
        });
        expect(Object.keys(screenHelpers.getBibleListOnScreenSetting())).toEqual([
            '1',
        ]);

        const topContainer = document.createElement('div');
        screenHelpers.addToTheTop(topContainer);
        expect(topContainer.querySelector('img.to-the-top')).not.toBeNull();

        const bottomContainer = document.createElement('div');
        screenHelpers.addPlayToBottom(bottomContainer);
        expect(
            bottomContainer.querySelector('img.play-to-bottom'),
        ).not.toBeNull();

        expect(screenHelpers.genVideoIDFromSrc('/video.mp4')).toBe(
            'video-md5-/video.mp4',
        );
    });

    test('syncs effect settings and routes attached backgrounds', async () => {
        const { default: ScreenEffectManager } = await import(
            './managers/ScreenEffectManager'
        );
        const { applyAttachBackground } = await import(
            './managers/screenBackgroundHelpers'
        );

        getSettingMock.mockImplementation((key: string) => {
            if (key === 'pt-effect-5-background') {
                return 'invalid';
            }
            return undefined;
        });

        const screenManagerBase = {
            screenId: 5,
            sendScreenMessage: vi.fn(),
            createScreenManagerBaseGhost: vi.fn((screenId: number) => ({
                screenId,
            })),
        } as any;
        const effectManager = new ScreenEffectManager(
            screenManagerBase,
            'background',
        );

        expect(effectManager.effectType).toBe('fade');
        effectManager.effectType = 'zoom';
        expect(setSettingMock).toHaveBeenCalledWith(
            'pt-effect-5-background',
            'zoom',
        );
        expect(screenManagerBase.sendScreenMessage).toHaveBeenCalledWith(
            {
                screenId: 5,
                type: 'effect',
                data: {
                    target: 'background',
                    effect: 'zoom',
                },
            },
            false,
        );

        ScreenEffectManager.receiveSyncScreen({
            screenId: 5,
            type: 'effect',
            data: {
                target: 'background',
                effect: 'move',
            },
        } as any);
        expect(effectManager.effectType).toBe('move');

        await applyAttachBackground(1, '/tmp/file.app', 3);
        expect(receiveDroppedMock).toHaveBeenCalledWith({
            type: 'bg-color',
            item: '#fff',
        });
    });

    test('manages cached screen-manager settings and display helpers', async () => {
        const { screenManagerSettingNames } = await import(
            '../helper/constants'
        );
        const baseHelpers = await import('./managers/screenManagerBaseHelpers');
        const managerScreenHelpers = await import('./managers/screenHelpers');

        baseHelpers.cache.clear();
        getSettingMock.mockImplementation((key: string) => {
            if (key === screenManagerSettingNames.MANAGERS) {
                return JSON.stringify([
                    { screenId: 1, isSelected: true },
                    { screenId: 1, isSelected: false },
                    { screenId: 2, isSelected: false },
                    { nope: true },
                ]);
            }
            if (key === 'screen-display--pid-2') {
                return '2';
            }
            return undefined;
        });

        expect(baseHelpers.getScreenManagersInstanceSetting()).toEqual([
            { screenId: 1, isSelected: true },
            { screenId: 2, isSelected: false },
        ]);
        expect(baseHelpers.getValidOnScreen({ 1: 'ok', 7: 'skip' })).toEqual({
            1: 'ok',
        });

        baseHelpers.setScreenManagerBaseCache({
            key: '1',
            screenId: 1,
            isSelected: true,
            isLocked: false,
            stageNumber: 2,
            getColorNote: vi.fn(async () => 'blue'),
        } as any);
        baseHelpers.setScreenManagerBaseCache({
            key: '2',
            screenId: 2,
            isSelected: false,
            isLocked: true,
            stageNumber: 4,
            getColorNote: vi.fn(async () => 'red'),
        } as any);

        await baseHelpers.saveScreenManagersSetting(2);
        expect(setSettingMock).toHaveBeenCalledWith(
            screenManagerSettingNames.MANAGERS,
            JSON.stringify([
                {
                    screenId: 1,
                    isSelected: true,
                    isLocked: false,
                    stageNumber: 2,
                    colorNote: 'blue',
                },
            ]),
        );

        expect(managerScreenHelpers.getDefaultScreenDisplay().id).toBe(2);
        expect(managerScreenHelpers.getDisplayIdByScreenId(2)).toBe(2);
        expect(managerScreenHelpers.getDisplayByScreenId(2).bounds.width).toBe(
            1280,
        );
    });

    test('sends sync messages from event handlers and applies base manager behaviors', async () => {
        const { default: ScreenEventHandler } = await import(
            './managers/ScreenEventHandler'
        );
        const { default: ScreenManagerBase } = await import(
            './managers/ScreenManagerBase'
        );

        class TestScreenEventHandler extends ScreenEventHandler<'update'> {
            static readonly eventNamePrefix = 'test-handler';

            get isShowing() {
                return true;
            }

            toSyncMessage() {
                return {
                    type: 'background',
                    data: { enabled: true },
                } as any;
            }

            receiveSyncScreen() {
                return undefined;
            }
            render() {
                return undefined;
            }
            clear() {
                return undefined;
            }
        }

        class TestScreenManagerBase extends ScreenManagerBase {
            sendSyncScreen = vi.fn();
            clear = vi.fn();
            delete = vi.fn(async () => {});
            receiveScreenDropped = vi.fn();
            sendScreenMessage = vi.fn();
            createScreenManagerBaseGhost = vi.fn((screenId: number) => ({
                screenId,
            })) as any;
            getScreenManagerBaseForce = vi.fn();
        }

        const base = new TestScreenManagerBase(3);
        const handler = new TestScreenEventHandler(base);
        handler.sendSyncScreen();
        expect(base.sendScreenMessage).toHaveBeenCalledWith(
            {
                screenId: 3,
                type: 'background',
                data: { enabled: true },
            },
            false,
        );

        handler.sendSyncScrollPercentage('.scroll-target', { x: 0.5, y: 0.25 });
        await vi.runAllTimersAsync();
        expect(base.sendScreenMessage).toHaveBeenCalledWith(
            {
                screenId: 3,
                type: 'sync-scroll-percentage',
                data: {
                    domSelector: '.scroll-target',
                    scroll: { x: 0.5, y: 0.25 },
                },
            },
            true,
        );

        const scroller = document.createElement('div');
        Object.defineProperties(scroller, {
            scrollWidth: { value: 300, configurable: true },
            clientWidth: { value: 100, configurable: true },
            scrollHeight: { value: 500, configurable: true },
            clientHeight: { value: 100, configurable: true },
        });
        scroller.scrollTo = vi.fn();
        base.getElementsByDomSelector = vi.fn(() => [scroller]);
        base.syncScrollPercentage({
            domSelector: '.scroll-target',
            scroll: { x: 0.5, y: 0.25 },
        });
        expect(scroller.scrollTo).toHaveBeenCalledWith({ left: 100, top: 100 });

        base._isLocked = true;
        appProviderMock.isPagePresenter = true;
        expect(base.checkIsLockedWithMessage()).toBe(true);
        expect(showSimpleToastMock).toHaveBeenCalledOnce();

        base.isShowing = true;
        base.displayId = 2;
        expect(setSettingMock).toHaveBeenCalledWith('screen-display--pid-3', '2');

        await base.setColorNote('green');
        expect(enableSyncGroupMocks.background).toHaveBeenCalledWith(3);
        expect(enableSyncGroupMocks.vary).toHaveBeenCalledWith(3);
        expect(enableSyncGroupMocks.bible).toHaveBeenCalledWith(3);
        expect(enableSyncGroupMocks.foreground).toHaveBeenCalledWith(3);
        expect(base.sendSyncScreen).toHaveBeenCalledOnce();

        handler.delete();
        expect(base.createScreenManagerBaseGhost).toHaveBeenCalledWith(3);
    });

    test('creates cached screen managers and exposes screen manager hooks', async () => {
        const baseHelpers = await import('./managers/screenManagerBaseHelpers');
        const screenManagerHelpers = await import('./managers/screenManagerHelpers');
        const screenManagerHooks = await import('./managers/screenManagerHooks');

        baseHelpers.cache.clear();
        getSettingMock.mockImplementation(() => JSON.stringify([]));

        const first = screenManagerHelpers.createScreenManager(7);
        const second = screenManagerHelpers.createScreenManager(7);
        expect(first).toBe(second);

        baseHelpers.cache.clear();
        const managers = screenManagerHelpers.getAllScreenManagers();
        expect(managers.map((manager) => manager.screenId)).toEqual([0, 1]);

        function BaseHost() {
            const screenManagerBase =
                screenManagerHooks.useScreenManagerBaseContext();
            return <div>{screenManagerBase.screenId}</div>;
        }

        function ManagerHost() {
            const screenManager = screenManagerHooks.useScreenManagerContext();
            screenManagerHooks.useScreenManagerEvents(['refresh'], screenManager as any);
            screenManagerHooks.useScreenUpdateEvents(screenManager as any);
            const videoSources = screenManagerHooks.useScreenVideoSources();
            return <div>{videoSources.map(([_, id]) => id).join('|')}</div>;
        }

        const baseHtml = renderToStaticMarkup(
            <screenManagerHooks.ScreenManagerBaseContext value={{ screenId: 9 } as any}>
                <BaseHost />
            </screenManagerHooks.ScreenManagerBaseContext>,
        );
        expect(baseHtml).toContain('9');

        const managerInstance = new (await import('./managers/ScreenManager')).default(11) as any;
        const managerHtml = renderToStaticMarkup(
            <screenManagerHooks.ScreenManagerBaseContext value={managerInstance}>
                <ManagerHost />
            </screenManagerHooks.ScreenManagerBaseContext>,
        );
        expect(managerHtml).toContain('video-md5-/video.mp4');
        expect(useScreenEventsSpy).toHaveBeenCalled();
        expect(useScreenBackgroundManagerEventsSpy).toHaveBeenCalled();
        expect(useScreenVaryAppDocumentManagerEventsSpy).toHaveBeenCalled();
        expect(useScreenBibleManagerEventsSpy).toHaveBeenCalled();
        expect(useScreenForegroundManagerEventsSpy).toHaveBeenCalled();
    });
});
