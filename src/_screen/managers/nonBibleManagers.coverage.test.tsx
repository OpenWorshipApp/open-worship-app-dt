// @vitest-environment jsdom

import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vitest';

import { DragTypeEnum } from '../../helper/DragInf';

const mocks = vi.hoisted(() => ({
    getSetting: vi.fn(),
    setSetting: vi.fn(),
    getBackgroundSrcListOnScreenSetting: vi.fn(() => ({})),
    getForegroundDataListOnScreenSetting: vi.fn(() => ({})),
    getAppDocumentListOnScreenSetting: vi.fn(() => ({})),
    applyAttachBackground: vi.fn(),
    registerScrollingSyncEvent: vi.fn(),
    appLog: vi.fn(),
    handleError: vi.fn(),
    getImageDim: vi.fn(async () => [320, 180]),
    getVideoDim: vi.fn(async () => [640, 360]),
    getIsFadingAtTheEndSetting: vi.fn(() => false),
    genHtmlBackground: vi.fn(),
    genCountdown: vi.fn(),
    genStopwatch: vi.fn(),
    genTime: vi.fn(),
    genMarquee: vi.fn(),
    genQuickText: vi.fn(),
    genWeb: vi.fn(),
    getCameraAndShowMedia: vi.fn(),
    genPdfSlide: vi.fn(),
    genPptxSlide: vi.fn(),
    genDocxSlide: vi.fn(),
    genSlideHtml: vi.fn(),
    unlocking: vi.fn((_key: string, callback: () => unknown) => callback()),
    checkAreObjectsEqual: vi.fn((a: unknown, b: unknown) => {
        return JSON.stringify(a) === JSON.stringify(b);
    }),
    checkIsItemInArray: vi.fn((item: unknown, arr: unknown[]) => {
        return arr.some(
            (current) => JSON.stringify(current) === JSON.stringify(item),
        );
    }),
    toKeyByFilePath: vi.fn(
        (filePath: string, id: number) => `${filePath}:${id}`,
    ),
    pdfTryValidate: vi.fn((item: any) => item?.kind === 'pdf'),
    pdfCheckIsThisType: vi.fn(() => false),
    pptxTryValidate: vi.fn((item: any) => item?.kind === 'pptx'),
    pptxCheckIsThisType: vi.fn(() => false),
    docxTryValidate: vi.fn((item: any) => item?.kind === 'docx'),
    docxCheckIsThisType: vi.fn(() => false),
    pptxGetInstance: vi.fn(),
    docxGetInstance: vi.fn(),
    appProvider: {
        isPagePresenter: false,
        isPageScreen: false,
        getIsMouseOverApp: vi.fn(() => true),
        getIsWindowFocused: vi.fn(() => true),
        pathUtils: {
            basename: (value: string) => value.split(/[\\/]/).at(-1) ?? value,
            join: (...parts: string[]) => parts.join('/'),
            resolve: (...parts: string[]) => parts.join('/'),
            sep: '/',
        },
        systemUtils: {
            isDev: false,
        },
    },
}));

vi.mock('../../helper/settingHelpers', () => ({
    getSetting: mocks.getSetting,
    setSetting: mocks.setSetting,
}));

vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: mocks.unlocking,
}));

vi.mock('../../server/appProvider', () => ({
    default: mocks.appProvider,
}));

vi.mock('../../server/comparisonHelpers', () => ({
    checkAreObjectsEqual: mocks.checkAreObjectsEqual,
    checkIsItemInArray: mocks.checkIsItemInArray,
}));

vi.mock('../../helper/loggerHelpers', () => ({
    appLog: mocks.appLog,
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: mocks.handleError,
}));

vi.mock('../../helper/helpers', async () => {
    const actual = (await vi.importActual('../../helper/helpers')) as any;
    return {
        ...actual,
        getImageDim: mocks.getImageDim,
        getVideoDim: mocks.getVideoDim,
    };
});

vi.mock('../../background/videoBackgroundHelpers', () => ({
    getIsFadingAtTheEndSetting: mocks.getIsFadingAtTheEndSetting,
}));

vi.mock('../ScreenBackgroundComp', () => ({
    genHtmlBackground: mocks.genHtmlBackground,
}));

vi.mock('../screenHelpers', () => ({
    getBackgroundSrcListOnScreenSetting:
        mocks.getBackgroundSrcListOnScreenSetting,
    getForegroundDataListOnScreenSetting:
        mocks.getForegroundDataListOnScreenSetting,
}));

vi.mock('../screenForegroundHelpers', () => ({
    genHtmlForegroundCountdown: mocks.genCountdown,
    genHtmlForegroundMarquee: mocks.genMarquee,
    genHtmlForegroundQuickText: mocks.genQuickText,
    genHtmlForegroundStopwatch: mocks.genStopwatch,
    genHtmlForegroundTime: mocks.genTime,
    genHtmlForegroundWeb: mocks.genWeb,
}));

vi.mock('../../helper/cameraHelpers', () => ({
    getCameraAndShowMedia: mocks.getCameraAndShowMedia,
}));

vi.mock('../preview/screenPreviewerHelpers', () => ({
    getAppDocumentListOnScreenSetting: mocks.getAppDocumentListOnScreenSetting,
}));

vi.mock('../../app-document-list/appDocumentHelpers', () => ({
    toKeyByFilePath: mocks.toKeyByFilePath,
}));

vi.mock('../../app-document-presenter/items/PdfSlideRenderComp', () => ({
    genPdfSlide: mocks.genPdfSlide,
}));

vi.mock('../../app-document-presenter/items/PptxSlideRenderComp', () => ({
    genPptxSlide: mocks.genPptxSlide,
}));

vi.mock('../../app-document-presenter/items/DocxSlideRenderComp', () => ({
    genDocxSlide: mocks.genDocxSlide,
}));

vi.mock('../../app-document-presenter/items/SlideRendererComp', () => ({
    genSlideHtml: mocks.genSlideHtml,
}));

vi.mock('./screenBackgroundHelpers', () => ({
    applyAttachBackground: mocks.applyAttachBackground,
}));

vi.mock('./screenEventHelpers', () => ({
    registerScrollingSyncEvent: mocks.registerScrollingSyncEvent,
}));

vi.mock('../../app-document-list/PdfSlide', () => ({
    default: class PdfSlide {
        static readonly tryValidate = mocks.pdfTryValidate;
        static readonly checkIsThisType = mocks.pdfCheckIsThisType;
    },
}));

vi.mock('../../app-document-list/PptxSlide', () => ({
    default: class PptxSlide {
        static readonly tryValidate = mocks.pptxTryValidate;
        static readonly checkIsThisType = mocks.pptxCheckIsThisType;
    },
}));

vi.mock('../../app-document-list/DocxSlide', () => ({
    default: class DocxSlide {
        static readonly tryValidate = mocks.docxTryValidate;
        static readonly checkIsThisType = mocks.docxCheckIsThisType;
    },
}));

vi.mock('../../app-document-list/PptxAppDocument', () => ({
    default: {
        getInstance: mocks.pptxGetInstance,
    },
}));

vi.mock('../../app-document-list/DocxAppDocument', () => ({
    default: {
        getInstance: mocks.docxGetInstance,
    },
}));

let ScreenBackgroundManager: any;
let ScreenForegroundManager: any;
let ScreenVaryAppDocumentManager: any;
let varyModule: any;

function createManagedRenderResult() {
    return {
        handleAdding: vi.fn((parent: HTMLElement) => {
            parent.appendChild(document.createElement('div'));
        }),
        handleRemoving: vi.fn(async () => {}),
    };
}

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
    return {
        styleAnim: {
            animIn: vi.fn(),
            animOut: vi.fn(async () => {}),
        },
        styleAnimList: {
            fade: {
                animIn: vi.fn(),
                animOut: vi.fn(async () => {}),
            },
        },
    } as any;
}

describe('non-Bible manager coverage', () => {
    beforeAll(async () => {
        ({ default: ScreenBackgroundManager } =
            await import('./ScreenBackgroundManager'));
        ({ default: ScreenForegroundManager } =
            await import('./ScreenForegroundManager'));
        varyModule = await import('./ScreenVaryAppDocumentManager');
        ScreenVaryAppDocumentManager = varyModule.default;
    });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        document.body.innerHTML = '';

        mocks.appProvider.isPagePresenter = false;
        mocks.appProvider.isPageScreen = false;
        mocks.getBackgroundSrcListOnScreenSetting.mockReturnValue({});
        mocks.getForegroundDataListOnScreenSetting.mockReturnValue({});
        mocks.getAppDocumentListOnScreenSetting.mockReturnValue({});
        mocks.getSetting.mockReturnValue(undefined);
        mocks.getImageDim.mockResolvedValue([320, 180]);
        mocks.getVideoDim.mockResolvedValue([640, 360]);
        mocks.getIsFadingAtTheEndSetting.mockReturnValue(false);

        mocks.genHtmlBackground.mockImplementation(
            (_screenId: number, backgroundSrc: any) => {
                const newDiv = document.createElement('div');
                if (backgroundSrc?.type === 'video') {
                    const video = document.createElement('video');
                    video.id = 'video-default';
                    Object.defineProperties(video, {
                        currentTime: {
                            configurable: true,
                            writable: true,
                            value: 0,
                        },
                        duration: {
                            configurable: true,
                            writable: true,
                            value: 120,
                        },
                    });
                    newDiv.appendChild(video);
                }
                return {
                    newDiv,
                    promise: Promise.resolve(vi.fn()),
                };
            },
        );
        mocks.genCountdown.mockImplementation(() =>
            createManagedRenderResult(),
        );
        mocks.genStopwatch.mockImplementation(() =>
            createManagedRenderResult(),
        );
        mocks.genTime.mockImplementation(() => createManagedRenderResult());
        mocks.genQuickText.mockImplementation(() =>
            createManagedRenderResult(),
        );
        mocks.genMarquee.mockImplementation(() => ({
            element: document.createElement('div'),
            handleRemoving: vi.fn(async () => {}),
        }));
        mocks.genWeb.mockImplementation(() => createManagedRenderResult());
        mocks.getCameraAndShowMedia.mockImplementation(
            async ({ parentContainer }) => {
                parentContainer.appendChild(document.createElement('video'));
                return vi.fn(async () => {});
            },
        );
        mocks.genPdfSlide.mockImplementation(() =>
            document.createElement('div'),
        );
        mocks.genPptxSlide.mockImplementation(() =>
            document.createElement('div'),
        );
        mocks.genDocxSlide.mockImplementation(() =>
            document.createElement('div'),
        );
        mocks.genSlideHtml.mockImplementation(() =>
            document.createElement('div'),
        );
        mocks.pdfTryValidate.mockImplementation(
            (item: any) => item?.kind === 'pdf',
        );
        mocks.pdfCheckIsThisType.mockReturnValue(false);
        mocks.pptxTryValidate.mockImplementation(
            (item: any) => item?.kind === 'pptx',
        );
        mocks.pptxCheckIsThisType.mockReturnValue(false);
        mocks.docxTryValidate.mockImplementation(
            (item: any) => item?.kind === 'docx',
        );
        mocks.docxCheckIsThisType.mockReturnValue(false);
        mocks.pptxGetInstance.mockReturnValue({
            getItemById: vi.fn(() => null),
        });
        mocks.docxGetInstance.mockReturnValue({
            getItemById: vi.fn(() => null),
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('covers ScreenBackgroundManager utilities, dropped data, sync logic, and render branches', async () => {
        const base = createScreenManagerBase(21);
        const effect = createEffectManager();
        mocks.appProvider.isPagePresenter = true;
        mocks.getBackgroundSrcListOnScreenSetting.mockReturnValue({
            21: { type: 'color', src: '#334455' },
        });
        const presenterManager = new ScreenBackgroundManager(base, effect);
        expect(presenterManager.backgroundSrc).toEqual({
            type: 'color',
            src: '#334455',
        });
        await presenterManager.receiveScreenDropped({
            type: DragTypeEnum.UNKNOWN,
            item: { src: 'ignored' },
        } as any);
        expect(presenterManager.backgroundSrc).toEqual({
            type: 'color',
            src: '#334455',
        });

        mocks.appProvider.isPagePresenter = false;
        mocks.getBackgroundSrcListOnScreenSetting.mockReturnValue({
            21: { type: 'image', src: '/image.png' },
            22: { type: 'video', src: '/video.mp4' },
            23: { type: 'image', src: '/image.png' },
        });
        const manager = new ScreenBackgroundManager(base, effect);
        const root = document.createElement('div');
        const stale = document.createElement('div');
        root.appendChild(stale);
        manager.rootContainer = root;
        expect(
            ScreenBackgroundManager.getBackgroundSrcListByType('image'),
        ).toEqual([
            ['21', { type: 'image', src: '/image.png' }],
            ['23', { type: 'image', src: '/image.png' }],
        ]);
        expect(
            ScreenBackgroundManager.getSelectBackgroundSrcList(
                '/image.png',
                'image',
            ),
        ).toEqual([
            ['21', { type: 'image', src: '/image.png' }],
            ['23', { type: 'image', src: '/image.png' }],
        ]);

        expect(
            await ScreenBackgroundManager.initBackgroundSrcDim(
                '/image.png',
                'image',
            ),
        ).toEqual({
            type: 'image',
            src: '/image.png',
            width: 320,
            height: 180,
        });
        mocks.getImageDim.mockRejectedValueOnce(new Error('bad-image'));
        await expect(
            ScreenBackgroundManager.extractDim({ type: 'image', src: 'bad' }),
        ).resolves.toEqual([undefined, undefined]);
        expect(mocks.handleError).toHaveBeenCalled();

        await manager.receiveScreenDropped({
            type: DragTypeEnum.BACKGROUND_IMAGE,
            item: { src: '/slide-bg.png' },
        } as any);
        expect(manager.backgroundSrc).toEqual({
            type: 'image',
            src: '/slide-bg.png',
            width: 320,
            height: 180,
        });

        await manager.receiveScreenDropped({
            type: DragTypeEnum.BACKGROUND_VIDEO,
            item: { src: '/loop.mp4' },
        } as any);
        expect(manager.backgroundSrc?.type).toBe('video');

        await manager.receiveScreenDropped({
            type: DragTypeEnum.BACKGROUND_WEB,
            item: { src: 'https://example.com' },
        } as any);
        expect(manager.backgroundSrc?.type).toBe('web');

        await manager.receiveScreenDropped({
            type: DragTypeEnum.BACKGROUND_CAMERA,
            item: { src: 'camera:1' },
        } as any);
        expect(manager.backgroundSrc?.type).toBe('camera');

        await manager.receiveScreenDropped({
            type: DragTypeEnum.BACKGROUND_COLOR,
            item: '#112233',
        } as any);
        expect(manager.backgroundSrc).toEqual({
            type: 'color',
            src: '#112233',
        });
        expect(manager.toSyncMessage()).toEqual({
            type: 'background',
            data: { type: 'color', src: '#112233' },
        });
        expect(manager.isShowing).toBe(true);

        await Promise.resolve();
        expect(effect.styleAnim.animIn).toHaveBeenCalled();
        expect(effect.styleAnim.animOut).toHaveBeenCalledWith(stale);

        const videoRoot = document.createElement('div');
        const syncedVideo = document.createElement('video');
        syncedVideo.id = 'video-sync';
        Object.defineProperties(syncedVideo, {
            currentTime: {
                configurable: true,
                writable: true,
                value: 5,
            },
            duration: {
                configurable: true,
                writable: true,
                value: 120,
            },
        });
        videoRoot.appendChild(syncedVideo);
        manager.rootContainer = videoRoot;

        const audio = document.createElement('audio');
        audio.dataset.videoId = 'video-sync';
        Object.defineProperty(audio, 'paused', {
            configurable: true,
            value: false,
        });
        document.body.appendChild(audio);

        manager.setVideoCurrentTime({
            videoId: 'video-sync',
            videoTime: 12,
            timestamp: Date.now(),
            isFromScreen: true,
        });
        expect(syncedVideo.currentTime).toBe(5);

        Object.defineProperty(audio, 'paused', {
            configurable: true,
            value: true,
        });
        manager.setVideoCurrentTime({
            videoId: 'video-sync',
            videoTime: 12,
            timestamp: Date.now(),
            isFromScreen: false,
        });
        expect(syncedVideo.currentTime).toBeGreaterThan(11.9);

        vi.useFakeTimers();
        manager.sendSyncVideoTime('video-sync', 15, false);
        vi.runAllTimers();
        expect(base.sendScreenMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                screenId: 21,
                type: 'background-video-time',
            }),
            true,
        );

        const ownForceSpy = vi.spyOn(manager, 'setVideoCurrentTimeForce');
        const member = {
            setVideoCurrentTimeForce: vi.fn(),
        };
        manager.getMemberInstances = vi.fn(async () => [member]);
        manager.checkIsMainInstance = vi.fn(async () => false);
        await manager.setBackgroundVideoCurrentTimeForce(
            'video-sync',
            20,
            true,
        );
        expect(member.setVideoCurrentTimeForce).not.toHaveBeenCalled();

        manager.checkIsMainInstance = vi.fn(async () => true);
        await manager.setBackgroundVideoCurrentTimeForce(
            'video-sync',
            21,
            true,
        );
        expect(member.setVideoCurrentTimeForce).toHaveBeenCalledWith(
            'video-sync',
            21,
        );

        await manager.setBackgroundVideoCurrentTimeForce(
            'video-sync',
            22,
            false,
        );
        expect(ownForceSpy).toHaveBeenCalledWith('video-sync', 22);

        const instanceTimeSpy = vi.spyOn(manager, 'setVideoCurrentTime');
        manager.receiveSyncVideoTime({
            screenId: 999,
            type: 'background-video-time',
            data: { videoId: 'video-sync' },
        } as any);
        manager.receiveSyncVideoTime({
            screenId: 21,
            type: 'background-video-time',
            data: { videoId: 'video-sync' },
        } as any);
        expect(instanceTimeSpy).not.toHaveBeenCalled();

        manager.receiveSyncVideoTime({
            screenId: 21,
            type: 'background-video-time',
            data: {
                videoId: 'video-sync',
                videoTime: 24,
                timestamp: Date.now(),
                isFromScreen: false,
            },
        } as any);
        expect(instanceTimeSpy).toHaveBeenCalled();

        ScreenBackgroundManager.receiveSyncVideoTime({
            screenId: 21,
            type: 'background-video-time',
            data: {
                videoId: 'video-sync',
                videoTime: 30,
                timestamp: Date.now(),
                isFromScreen: false,
            },
        } as any);
        expect(instanceTimeSpy).toHaveBeenCalledTimes(2);

        const fadingContainer = document.createElement('div');
        const fadingVideo = document.createElement('video');
        fadingVideo.id = 'video-fade';
        Object.defineProperties(fadingVideo, {
            currentTime: {
                configurable: true,
                writable: true,
                value: 8,
            },
            duration: {
                configurable: true,
                writable: true,
                value: 10,
            },
        });
        fadingContainer.appendChild(fadingVideo);
        mocks.getIsFadingAtTheEndSetting.mockReturnValue(true);
        const syncGroupSpy = vi.spyOn(
            manager,
            'setBackgroundVideoCurrentTimeForce',
        );
        const renderSpy = vi.spyOn(manager, 'render');
        manager._handleBackgroundVideo(fadingContainer);
        fadingVideo.dispatchEvent(new Event('timeupdate'));
        expect(syncGroupSpy).toHaveBeenCalledWith('video-fade', 8, true);
        expect(renderSpy).toHaveBeenCalledWith(
            expect.objectContaining({ duration: 3000 }),
        );

        manager.clear();
        expect(manager.backgroundSrc).toBeNull();
    });

    test('covers ScreenForegroundManager parsing, diffing, rendering, wrapper methods, and sync clearing', async () => {
        mocks.getForegroundDataListOnScreenSetting.mockReturnValue({
            41: {
                countdownData: {
                    dateTime: '2026-04-13T10:00:00.000Z',
                    extraStyle: {},
                },
                stopwatchData: {
                    dateTime: '2026-04-13T11:00:00.000Z',
                    extraStyle: {},
                },
                timeDataList: [],
                marqueeBottomData: null,
                quickTextData: null,
                cameraDataList: [],
                webDataList: [],
            },
        });

        const base = createScreenManagerBase(41);
        const effect = createEffectManager();
        const manager = new ScreenForegroundManager(base, effect);
        const host = document.createElement('div');
        manager.div = host;

        expect(manager.foregroundData.countdownData?.dateTime).toBeInstanceOf(
            Date,
        );
        expect(manager.foregroundData.stopwatchData?.dateTime).toBeInstanceOf(
            Date,
        );
        expect(manager.isShowing).toBe(true);
        expect(manager.containerStyle).toEqual({
            pointerEvents: 'none',
            position: 'absolute',
            width: '1280px',
            height: '720px',
            overflow: 'hidden',
        });

        const timeA = {
            id: 'a',
            timezoneMinuteOffset: 9,
            title: 'Tokyo',
            is24HourFormat: true,
            extraStyle: {},
        };
        const timeB = {
            id: 'b',
            timezoneMinuteOffset: 0,
            title: 'UTC',
            is24HourFormat: false,
            extraStyle: {},
        };
        expect(manager._getDiff(null, timeA)).toEqual({
            toRemoveDataList: [],
            toRenderDataList: [timeA],
        });
        expect(manager._getDiff(timeA, null)).toEqual({
            toRemoveDataList: [timeA],
            toRenderDataList: [],
        });
        expect(manager._getDiff([timeA], [timeA, timeB])).toEqual({
            toRemoveDataList: [],
            toRenderDataList: [timeB],
        });
        expect(manager._getDiff([timeA, timeB], [timeB])).toEqual({
            toRemoveDataList: [timeA],
            toRenderDataList: [],
        });

        const oldObject = { id: 'old' };
        const removalSpy = vi.fn();
        manager.createDivContainer(oldObject, removalSpy);
        const renderSpy = vi.fn();
        const newObject = { id: 'new' };
        expect(manager.compareAndRender(oldObject, newObject, renderSpy)).toBe(
            newObject,
        );
        expect(removalSpy).toHaveBeenCalled();
        expect(renderSpy).toHaveBeenCalledWith(newObject);

        manager.renderCountdown({
            dateTime: new Date('2026-04-13T10:00:00.000Z'),
            extraStyle: {},
        } as any);
        manager.renderStopwatch({
            dateTime: new Date('2026-04-13T11:00:00.000Z'),
            extraStyle: {},
        } as any);
        manager.renderTime(timeA as any);
        manager.renderMarqueeTop({ text: 'Hello', extraStyle: {} } as any);
        manager.renderMarqueeBottom({ text: 'Hello', extraStyle: {} } as any);
        manager.renderQuickText({
            htmlText: '<b>Hello</b>',
            timeSecondDelay: 0,
            timeSecondToLive: 3,
            extraStyle: {},
        } as any);
        manager.renderCamera({
            deviceId: 'camera-1',
            label: 'Front camera',
            extraStyle: {},
        } as any);
        manager.renderWeb({
            url: 'https://example.com',
            title: 'Site',
            extraStyle: {},
        } as any);

        expect(mocks.genCountdown).toHaveBeenCalled();
        expect(mocks.genStopwatch).toHaveBeenCalled();
        expect(mocks.genTime).toHaveBeenCalled();
        expect(mocks.genMarquee).toHaveBeenCalledWith(
            { text: 'Hello', extraStyle: {} },
            base,
            'top',
        );
        expect(mocks.genMarquee).toHaveBeenCalledWith(
            { text: 'Hello', extraStyle: {} },
            base,
            'bottom',
        );
        expect(mocks.genQuickText).toHaveBeenCalled();
        expect(mocks.getCameraAndShowMedia).toHaveBeenCalled();
        expect(mocks.genWeb).toHaveBeenCalledWith(
            { url: 'https://example.com', title: 'Site', extraStyle: {} },
            effect.styleAnimList.fade,
            { width: 1280, height: 720 },
        );

        const webData = {
            url: 'https://open.example',
            title: 'Open',
            extraStyle: {},
        };
        manager.addWebData(webData as any);
        manager.addWebData(webData as any);
        expect(manager.foregroundData.webDataList).toEqual([webData]);
        manager.removeWebData(webData as any);
        expect(manager.foregroundData.webDataList).toEqual([]);

        const countdownDate = new Date('2026-04-13T12:00:00.000Z');
        const stopwatchDate = new Date('2026-04-13T13:00:00.000Z');
        vi.spyOn(ScreenForegroundManager, 'chooseScreenIds').mockResolvedValue([
            41,
        ]);
        await ScreenForegroundManager.setCountdown(
            new MouseEvent('click') as any,
            countdownDate,
        );
        await ScreenForegroundManager.setStopwatch(
            new MouseEvent('click') as any,
            stopwatchDate,
        );
        await ScreenForegroundManager.addTimeData(
            new MouseEvent('click') as any,
            timeA as any,
        );
        await ScreenForegroundManager.removeTimeData(
            new MouseEvent('click') as any,
            timeA as any,
        );
        await ScreenForegroundManager.setMarqueeTop(
            new MouseEvent('click') as any,
            'Ticker',
        );
        await ScreenForegroundManager.setMarqueeBottom(
            new MouseEvent('click') as any,
            'Ticker',
        );
        await ScreenForegroundManager.setQuickText(
            new MouseEvent('click') as any,
            '<i>Note</i>',
            1,
            5,
        );
        await ScreenForegroundManager.addCameraData(
            new MouseEvent('click') as any,
            { deviceId: 'camera-2', label: 'Side', extraStyle: {} } as any,
        );
        await ScreenForegroundManager.removeCameraData(
            new MouseEvent('click') as any,
            { deviceId: 'camera-2', label: 'Side', extraStyle: {} } as any,
        );
        await ScreenForegroundManager.addWebData(
            new MouseEvent('click') as any,
            webData as any,
        );
        await ScreenForegroundManager.removeWebData(
            new MouseEvent('click') as any,
            webData as any,
        );

        expect(mocks.setSetting).toHaveBeenCalled();
        expect(base.sendScreenMessage).toHaveBeenCalled();

        manager.receiveSyncScreen({
            screenId: 41,
            type: 'foreground',
            data: {
                countdownData: null,
                stopwatchData: null,
                timeDataList: [timeB],
                marqueeBottomData: { text: 'Synced', extraStyle: {} },
                quickTextData: null,
                cameraDataList: [],
                webDataList: [webData],
            },
        } as any);
        expect(manager.foregroundData.marqueeBottomData).toEqual({
            text: 'Synced',
            extraStyle: {},
        });
        expect(manager.foregroundData.timeDataList).toEqual([timeB]);

        manager.clear();
        expect(manager.foregroundData).toEqual(
            ScreenForegroundManager.parseAllForegroundData({}),
        );

        ScreenForegroundManager.receiveSyncScreen({
            screenId: 41,
            type: 'foreground',
            data: {
                countdownData: null,
                stopwatchData: null,
                timeDataList: [],
                marqueeBottomData: null,
                quickTextData: null,
                cameraDataList: [],
                webDataList: [],
            },
        } as any);
        expect(base.sendScreenMessage).toHaveBeenCalled();
    });

    test('covers ScreenVaryAppDocumentManager selection, render branches, cleanup, loading, and sync clearing', async () => {
        const base = createScreenManagerBase(51);
        const effect = createEffectManager();
        const manager = new ScreenVaryAppDocumentManager(base, effect);
        const host = document.createElement('div');
        document.body.appendChild(host);
        manager.div = host;

        mocks.getSetting.mockImplementation((key: string) => {
            return key === 'pdf-full-width' ? 'true' : undefined;
        });
        expect(varyModule.checkIsPdfFullWidth()).toBe(true);
        varyModule.setIsPdfFullWidth(false);
        expect(mocks.setSetting).toHaveBeenCalledWith(
            'pdf-full-width',
            'false',
        );

        mocks.getAppDocumentListOnScreenSetting.mockReturnValue({
            51: {
                filePath: '/slides/one.slide',
                itemJson: { id: 1 },
                isRenderFullWidth: true,
            },
            52: {
                filePath: '/slides/two.slide',
                itemJson: { id: 2 },
                isRenderFullWidth: false,
            },
        });
        expect(
            ScreenVaryAppDocumentManager.getDataList('/slides/one.slide', 1),
        ).toEqual([
            [
                '51',
                {
                    filePath: '/slides/one.slide',
                    itemJson: { id: 1 },
                    isRenderFullWidth: true,
                },
            ],
        ]);

        const slideJson = {
            id: 7,
            metadata: { width: 640, height: 360 },
            canvasItems: [],
            kind: 'slide',
        };
        expect(
            manager.toSlideData('/slides/a.slide', slideJson as any),
        ).toEqual({
            filePath: '/slides/a.slide',
            itemJson: slideJson,
            isRenderFullWidth: true,
        });

        manager.handleSlideSelecting('/slides/a.slide', slideJson as any);
        expect(manager.varySlideData?.filePath).toBe('/slides/a.slide');
        manager.handleSlideSelecting('/slides/a.slide', slideJson as any);
        expect(manager.varySlideData).toBeNull();

        vi.spyOn(
            ScreenVaryAppDocumentManager,
            'chooseScreenIds',
        ).mockResolvedValue([51]);
        await ScreenVaryAppDocumentManager.handleSlideSelecting(
            new MouseEvent('click') as any,
            '/slides/b.slide',
            slideJson as any,
        );
        expect(manager.varySlideData?.filePath).toBe('/slides/b.slide');

        const svg = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'svg',
        );
        const content = document.createElement('div');
        const video = document.createElement('video');
        const playMock = vi.fn();
        Object.defineProperty(video, 'play', {
            configurable: true,
            value: playMock,
        });
        content.appendChild(svg);
        content.appendChild(video);
        mocks.appProvider.isPageScreen = true;
        manager.cleanupSlideContent(content);
        expect(svg.style.display).toBe('none');
        expect(video.loop).toBe(false);
        expect(video.muted).toBe(false);
        expect(playMock).toHaveBeenCalled();
        mocks.appProvider.isPageScreen = false;

        const existingChild = document.createElement('div');
        host.appendChild(existingChild);

        manager.varySlideData = {
            filePath: '/slides/pdf.slide',
            itemJson: {
                id: 1,
                kind: 'pdf',
                imagePreviewSrc: '/preview.png',
                metadata: { width: 800, height: 600 },
            },
            isRenderFullWidth: true,
        } as any;
        manager.render();
        expect(mocks.genPdfSlide).toHaveBeenCalledWith('/preview.png', true);

        manager.varySlideData = {
            filePath: '/slides/pptx.slide',
            itemJson: {
                id: 2,
                kind: 'pptx',
                html: '<section>PPTX</section>',
                htmlFilePath: '/slides/pptx.html',
                metadata: { width: 400, height: 200 },
            },
            isRenderFullWidth: false,
        } as any;
        manager.render();
        expect(mocks.genPptxSlide).toHaveBeenCalledWith(
            '<section>PPTX</section>',
            '/slides/pptx.html',
            400,
            200,
        );

        manager.varySlideData = {
            filePath: '/slides/docx.slide',
            itemJson: {
                id: 3,
                kind: 'docx',
                html: '<article>DOCX</article>',
                htmlFilePath: '/slides/docx.html',
                metadata: { width: 500, height: 250 },
            },
            isRenderFullWidth: false,
        } as any;
        manager.render();
        expect(mocks.genDocxSlide).toHaveBeenCalledWith(
            '<article>DOCX</article>',
            '/slides/docx.html',
            500,
            250,
            1280,
            false,
        );

        manager.varySlideData = {
            filePath: '/slides/slide.slide',
            itemJson: slideJson,
            isRenderFullWidth: false,
        } as any;
        manager.render();
        expect(mocks.genSlideHtml).toHaveBeenCalledWith([]);
        expect(effect.styleAnim.animIn).toHaveBeenCalled();
        expect(effect.styleAnim.animOut).toHaveBeenCalled();
        expect(mocks.registerScrollingSyncEvent).toHaveBeenCalled();

        const pptxLoadedJson = {
            id: 9,
            kind: 'pptx',
            html: '<section>Loaded</section>',
            htmlFilePath: '/slides/loaded.html',
            metadata: { width: 320, height: 180 },
        };
        mocks.pptxCheckIsThisType.mockReturnValue(true);
        mocks.pptxGetInstance.mockReturnValue({
            getItemById: vi.fn(() => ({ toJson: () => pptxLoadedJson })),
        });
        await expect(
            manager.getRenderableItemJson({
                id: 9,
                filePath: '/slides/deck.pptx',
                html: undefined,
                toJson: () => slideJson,
            } as any),
        ).resolves.toEqual(pptxLoadedJson);

        const docxLoadedJson = {
            id: 10,
            kind: 'docx',
            html: '<article>Loaded DOCX</article>',
            htmlFilePath: '/slides/loaded-docx.html',
            metadata: { width: 300, height: 200 },
        };
        mocks.pptxCheckIsThisType.mockReturnValue(false);
        mocks.docxCheckIsThisType.mockReturnValue(true);
        mocks.docxGetInstance.mockReturnValue({
            getItemById: vi.fn(() => ({ toJson: () => docxLoadedJson })),
        });
        await expect(
            manager.getRenderableItemJson({
                id: 10,
                filePath: '/slides/doc.docx',
                html: undefined,
                toJson: () => slideJson,
            } as any),
        ).resolves.toEqual(docxLoadedJson);

        mocks.docxCheckIsThisType.mockReturnValue(false);
        await expect(
            manager.getRenderableItemJson({
                toJson: () => slideJson,
            } as any),
        ).resolves.toEqual(slideJson);

        await manager.receiveScreenDropped({
            item: {
                id: 11,
                filePath: '/slides/from-drop.slide',
                toJson: () => slideJson,
            },
        } as any);
        expect(manager.varySlideData).toEqual({
            filePath: '/slides/from-drop.slide',
            itemJson: slideJson,
            isRenderFullWidth: true,
        });
        expect(manager.toSyncMessage()).toEqual({
            type: 'vary-app-document',
            data: manager.varySlideData,
        });

        ScreenVaryAppDocumentManager.receiveSyncScreen({
            screenId: 51,
            type: 'vary-app-document',
            data: null,
        } as any);
        expect(manager.varySlideData).toBeNull();

        manager.clear();
        expect(manager.varySlideData).toBeNull();
    });
});
