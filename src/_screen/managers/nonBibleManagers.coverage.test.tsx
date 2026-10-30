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
    genVideoIDFromSrc: vi.fn(() => 'video-abc123'),
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
    genVideo: vi.fn(),
    genImage: vi.fn(),
    getCameraAndShowMedia: vi.fn(),
    requestCameraAccess: vi.fn(async () => true),
    getCurrentLocale: vi.fn(() => 'en'),
    getLangData: vi.fn(() => null),
    getLangDataAsync: vi.fn(async () => null),
    tranByLangData: vi.fn((_data: unknown, period: unknown) => String(period)),
    layOutMessageStack: vi.fn(),
    mountScreenShowFrame: vi.fn((_options: any) => ({
        dispose: vi.fn(async () => {}),
    })),
    checkIsScreenShowFrame: vi.fn(() => false),
    showSimpleToast: vi.fn(),
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
        // langHelpers registers a menu listener at module load.
        messageUtils: {
            listenForData: vi.fn(),
            sendData: vi.fn(),
        },
    },
}));

// A slide's own transition is read from a sidecar beside its document on
// the presenter; none here, so every slide follows the screen's effect.
vi.mock('./screenSlideTransitionHelpers', () => ({
    resolveSlideTransitionEffect: async () => undefined,
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

vi.mock('../../server/comparisonHelpers', () => ({
    checkAreObjectsEqual: mocks.checkAreObjectsEqual,
    checkIsItemInArray: mocks.checkIsItemInArray,
}));

vi.mock('../../lang/langHelpers', async (importOriginal) => {
    const original =
        await importOriginal<typeof import('../../lang/langHelpers')>();
    return {
        ...original,
        getCurrentLocale: mocks.getCurrentLocale,
        getLangData: mocks.getLangData,
        getLangDataAsync: mocks.getLangDataAsync,
        tranByLangData: mocks.tranByLangData,
    };
});

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
    genVideoIDFromSrc: mocks.genVideoIDFromSrc,
}));

vi.mock('../screenForegroundHelpers', () => ({
    genHtmlForegroundMessage: mocks.genQuickText,
    genHtmlForegroundCountdown: mocks.genCountdown,
    genHtmlForegroundMarquee: mocks.genMarquee,
    genHtmlForegroundQuickText: mocks.genQuickText,
    genHtmlForegroundStopwatch: mocks.genStopwatch,
    genHtmlForegroundTime: mocks.genTime,
    genHtmlForegroundWeb: mocks.genWeb,
    genHtmlForegroundVideo: mocks.genVideo,
    genHtmlForegroundImage: mocks.genImage,
}));

vi.mock('../../helper/cameraHelpers', () => ({
    getCameraAndShowMedia: mocks.getCameraAndShowMedia,
    requestCameraAccess: mocks.requestCameraAccess,
}));

vi.mock('../screenShowFrameHelpers', async (importOriginal) => {
    const original =
        await importOriginal<typeof import('../screenShowFrameHelpers')>();
    return {
        ...original,
        checkIsScreenShowFrame: mocks.checkIsScreenShowFrame,
        mountScreenShowFrame: mocks.mountScreenShowFrame,
    };
});

vi.mock('../foregroundMessageStackHelpers', async (importOriginal) => {
    const original =
        await importOriginal<
            typeof import('../foregroundMessageStackHelpers')
        >();
    return { ...original, layOutMessageStack: mocks.layOutMessageStack };
});

vi.mock('../../toast/toastHelpers', async (importOriginal) => {
    const original =
        await importOriginal<typeof import('../../toast/toastHelpers')>();
    return { ...original, showSimpleToast: mocks.showSimpleToast };
});

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

vi.mock('../../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleFontFamily: vi.fn(async () => 'TestFont'),
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

// `varySlideData`'s setter resolves through `getTargetLyricSlideItemData`, so
// an assignment only lands a microtask later even for ordinary slides.
function flushVarySlideData() {
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

describe('non-Bible manager coverage', () => {
    beforeAll(async () => {
        ({ default: ScreenBackgroundManager } =
            await import('./ScreenBackgroundManager'));
        ({ default: ScreenForegroundManager } =
            await import('./ScreenForegroundManager'));
        varyModule = await import('./ScreenVaryAppDocumentManager');
        ScreenVaryAppDocumentManager = varyModule.default;
    }, 60000);

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentLocale.mockReturnValue('en');
        mocks.getLangData.mockReturnValue(null);
        mocks.getLangDataAsync.mockResolvedValue(null);
        mocks.tranByLangData.mockImplementation((_data, period) =>
            String(period),
        );
        mocks.mountScreenShowFrame.mockImplementation(() => ({
            dispose: vi.fn(async () => {}),
        }));
        mocks.checkIsScreenShowFrame.mockReturnValue(false);
        // jsdom implements none of these and writes a "Not
        // implemented" page of stack to the console for every call.
        vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(
            undefined,
        );
        vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(
            () => {},
        );
        vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(
            () => {},
        );
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
        mocks.genVideo.mockImplementation(() => createManagedRenderResult());
        mocks.genImage.mockImplementation(() => createManagedRenderResult());
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
        const loopFadeSpy = vi
            .spyOn(manager, '_fadeOverVideoLoop')
            .mockResolvedValue(undefined);
        manager._handleBackgroundVideo(fadingContainer);
        fadingVideo.dispatchEvent(new Event('timeupdate'));
        expect(syncGroupSpy).toHaveBeenCalledWith('video-fade', 8, true);
        // The end-of-clip fade runs on the element that is already playing.
        // It must NOT go back through `render()`: that builds a fresh
        // `<video src=...>`, and a `file://` media resource is not cached, so
        // every loop re-read the whole clip from disk.
        expect(loopFadeSpy).toHaveBeenCalledWith(fadingContainer, fadingVideo);
        expect(renderSpy).not.toHaveBeenCalled();

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
        manager.rootContainer = host;

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
            lineHeight: 'normal',
            // The screen window's own stack, not whatever the host page
            // inherits into the mini preview's shadow root.
            fontFamily: expect.stringMatching(/^system-ui, .*sans-serif/),
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

    // A virtual display's browser page and a Screen Mirror guest receive the
    // screen's messages as JSON: a running clock with its start as text drew
    // 00:00:00 and never ticked.
    test('a clock that crossed JSON gets its dateTime back as a Date', () => {
        const startedAt = new Date('2026-10-07T20:00:00.000Z');
        const viaJson = JSON.parse(
            JSON.stringify({
                countdownData: {
                    dateTime: startedAt,
                    durationMillisecond: 60000,
                },
                stopwatchData: { dateTime: startedAt },
                timeDataList: [],
            }),
        );
        const revived = ScreenForegroundManager.reviveTimerDates(viaJson);
        expect(revived.countdownData?.dateTime).toBeInstanceOf(Date);
        expect(revived.countdownData?.durationMillisecond).toBe(60000);
        expect(revived.stopwatchData?.dateTime.getTime()).toBe(
            startedAt.getTime(),
        );
        // Untouched when nothing was lost: the same object comes back.
        const native = {
            countdownData: null,
            stopwatchData: { dateTime: startedAt },
        } as any;
        expect(ScreenForegroundManager.reviveTimerDates(native)).toBe(native);
    });

    test('a clock period asks for its locale once and retries after a failed load', async () => {
        mocks.getCurrentLocale.mockReturnValue('km');
        mocks.getLangData.mockReturnValue(null);
        mocks.getLangDataAsync.mockRejectedValue(new Error('offline'));
        const manager = new ScreenForegroundManager(
            createScreenManagerBase(48),
            createEffectManager(),
        );
        const timeData = { id: 'time', extraStyle: {} };
        manager.foregroundData.timeDataList = [timeData] as any;
        manager.renderTime(timeData as any);
        const toPeriodText = mocks.genTime.mock.calls.at(-1)?.[2] as (
            period: string,
        ) => string;

        expect(toPeriodText('AM')).toBe('AM');
        expect(mocks.getLangDataAsync).toHaveBeenCalledExactlyOnceWith('km');
        await Promise.resolve();
        expect(toPeriodText('PM')).toBe('PM');
        expect(mocks.getLangDataAsync).toHaveBeenCalledTimes(2);
        expect(mocks.tranByLangData).toHaveBeenLastCalledWith(null, 'PM');
        manager.delete();
    });

    test('restores older message shapes and drops invalid Screen Show ids', () => {
        const messageDataList = [{ id: 'editor-1', textList: ['Current'] }];
        expect(
            ScreenForegroundManager.parseAllForegroundData({
                messageDataList,
                messageData: { textList: ['Old'] },
            }).messageDataList,
        ).toBe(messageDataList);
        expect(
            ScreenForegroundManager.parseAllForegroundData({
                messageData: { textList: ['Old'] },
            }).messageDataList,
        ).toEqual([{ id: 'message-all', textList: ['Old'] }]);
        expect(
            ScreenForegroundManager.parseAllForegroundData({
                alertData: { text: 'Alert', extraStyle: { color: 'red' } },
            }).messageDataList,
        ).toEqual([
            {
                id: 'message-all',
                textList: ['Alert'],
                intervalSecond: null,
                extraStyle: { color: 'red' },
            },
        ]);
        expect(
            ScreenForegroundManager.parseAllForegroundData({
                announcementData: {
                    textList: ['One', 'Two'],
                    intervalSecond: 5,
                    extraStyle: {},
                },
            }).messageDataList,
        ).toEqual([
            {
                id: 'message-all',
                textList: ['One', 'Two'],
                intervalSecond: 5,
                extraStyle: {},
            },
        ]);
        expect(
            ScreenForegroundManager.parseAllForegroundData({
                screenDataList: 'not a list',
            }).screenDataList,
        ).toEqual([]);
        expect(
            ScreenForegroundManager.parseAllForegroundData({
                screenDataList: [
                    { id: 1 },
                    null,
                    { id: '2' },
                    { id: -1 },
                    { id: 0 },
                ],
            }).screenDataList,
        ).toEqual([{ id: 1 }, { id: 0 }]);

        const saved = {
            countdownData: { dateTime: '2026-10-07T20:00:00.000Z' },
        };
        const restored = ScreenForegroundManager.parseAllForegroundData(saved);
        expect(saved.countdownData.dateTime).toBe('2026-10-07T20:00:00.000Z');
        expect(restored.countdownData?.dateTime).toBeInstanceOf(Date);
    });

    test('mounted roots release only their own foreground containers', async () => {
        const manager = new ScreenForegroundManager(
            createScreenManagerBase(42),
            createEffectManager(),
        );
        const unattachedRoot = manager.rootContainer;
        expect(manager.rootContainer).not.toBe(unattachedRoot);
        const unattachedBehindRoot = manager.rootContainerBehind;
        expect(manager.rootContainerBehind).not.toBe(unattachedBehindRoot);

        const frontRoot = document.createElement('div');
        const behindRoot = document.createElement('div');
        document.body.append(frontRoot, behindRoot);
        manager.rootContainer = frontRoot;
        manager.rootContainerBehind = behindRoot;
        manager.rootContainer = frontRoot;
        manager.rootContainerBehind = behindRoot;

        const frontData = { id: 'front', isBehind: false };
        const behindData = { id: 'behind', isBehind: true };
        manager.foregroundData.messageDataList = [frontData, behindData] as any;
        const removeFront = vi.fn();
        const removeBehind = vi.fn();
        const frontContainer = manager.createDivContainer(
            frontData,
            removeFront,
        )!;
        const behindContainer = manager.createDivContainer(
            behindData,
            removeBehind,
        )!;
        expect(frontContainer.parentElement).toBe(frontRoot);
        expect(behindContainer.parentElement).toBe(behindRoot);

        manager.releaseRootContainer(document.createElement('div'), false);
        expect(frontContainer.isConnected).toBe(true);
        mocks.appProvider.isPageScreen = true;
        manager.releaseRootContainer(frontRoot, false);
        expect(frontContainer.isConnected).toBe(true);
        mocks.appProvider.isPageScreen = false;
        manager.releaseRootContainer(frontRoot, false);
        await Promise.resolve();
        expect(removeFront).toHaveBeenCalledWith(frontContainer);
        expect(frontContainer.isConnected).toBe(false);
        expect(behindContainer.isConnected).toBe(true);
        manager.releaseRootContainer(behindRoot, true);
        await Promise.resolve();
        expect(removeBehind).toHaveBeenCalledWith(behindContainer);
        expect(behindContainer.isConnected).toBe(false);
        expect(manager.rootContainer).not.toBe(frontRoot);
        expect(manager.rootContainerBehind).not.toBe(behindRoot);
        manager.delete();
    });

    test('message layout is coalesced and re-run when fonts finish loading', () => {
        const callbacks: Array<(time: number) => void> = [];
        const cancelFrame = vi.fn();
        const addEventListener = vi.fn();
        const removeEventListener = vi.fn();
        const fonts = { addEventListener, removeEventListener };
        const originalFonts = Object.getOwnPropertyDescriptor(
            document,
            'fonts',
        );
        Object.defineProperty(document, 'fonts', {
            configurable: true,
            value: fonts,
        });
        vi.stubGlobal(
            'requestAnimationFrame',
            (callback: (time: number) => void) => {
                callbacks.push(callback);
                return callbacks.length;
            },
        );
        vi.stubGlobal('cancelAnimationFrame', cancelFrame);
        const manager = new ScreenForegroundManager(
            createScreenManagerBase(43),
            createEffectManager(),
        );
        const layout = vi.spyOn(manager, 'layOutMessages');

        try {
            manager.scheduleMessageLayout();
            manager.scheduleMessageLayout();
            expect(callbacks).toHaveLength(1);
            expect(addEventListener).toHaveBeenCalledTimes(1);
            expect(addEventListener).toHaveBeenCalledWith(
                'loadingdone',
                expect.any(Function),
            );

            callbacks[0](0);
            expect(layout).toHaveBeenCalledTimes(1);
            const onFontsLoaded = addEventListener.mock.calls[0][1];
            onFontsLoaded();
            expect(callbacks).toHaveLength(2);
            manager.delete();
            expect(cancelFrame).toHaveBeenCalledWith(2);
            expect(removeEventListener).toHaveBeenCalledWith(
                'loadingdone',
                onFontsLoaded,
            );
        } finally {
            vi.unstubAllGlobals();
            if (originalFonts) {
                Object.defineProperty(document, 'fonts', originalFonts);
            } else {
                delete (document as any).fonts;
            }
        }
    });

    test('message stacks separate layers, skip rotating text, and ignore detached rows', () => {
        const manager = new ScreenForegroundManager(
            createScreenManagerBase(44),
            createEffectManager(),
        );
        const root = document.createElement('div');
        const behindRoot = document.createElement('div');
        document.body.append(root, behindRoot);
        manager.rootContainer = root;
        manager.rootContainerBehind = behindRoot;

        const frontOne = {
            id: 'one',
            intervalSecond: null,
            textList: ['One'],
            stackKey: 'service',
        };
        const frontTwo = {
            id: 'two',
            intervalSecond: null,
            textList: ['Two'],
            stackKey: 'service',
        };
        const behind = {
            id: 'behind',
            intervalSecond: null,
            textList: ['Behind'],
            stackKey: 'service',
            isBehind: true,
        };
        const rotating = {
            id: 'rotating',
            intervalSecond: 2,
            textList: ['First', 'Second'],
        };
        const detached = {
            id: 'detached',
            intervalSecond: null,
            textList: ['Gone'],
        };
        manager.foregroundData.messageDataList = [
            frontOne,
            frontTwo,
            behind,
            rotating,
            detached,
        ] as any;
        const addMessageElement = (data: any) => {
            const container = manager.createDivContainer(data)!;
            const message = document.createElement('div');
            message.className = 'foreground-message';
            container.appendChild(message);
            return { container, message };
        };
        const one = addMessageElement(frontOne);
        const two = addMessageElement(frontTwo);
        const behindElement = addMessageElement(behind);
        addMessageElement(rotating);
        const detachedElement = addMessageElement(detached);
        detachedElement.container.remove();

        manager.layOutMessages();

        expect(mocks.layOutMessageStack).toHaveBeenCalledTimes(2);
        expect(mocks.layOutMessageStack).toHaveBeenNthCalledWith(
            1,
            [one.message, two.message],
            720,
        );
        expect(mocks.layOutMessageStack).toHaveBeenNthCalledWith(
            2,
            [behindElement.message],
            720,
        );
        manager.delete();
    });

    test('a missing camera is explained in the presenter but stays quiet on screen', () => {
        const manager = new ScreenForegroundManager(
            createScreenManagerBase(45),
            createEffectManager(),
        );
        manager.renderCamera({
            deviceId: 'camera-1',
            label: 'Front camera',
            extraStyle: {},
        } as any);
        const cameraOptions =
            mocks.getCameraAndShowMedia.mock.calls.at(-1)?.[0];
        cameraOptions.onUnavailable('Front camera');
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Camera Not Available',
            'Could not open the camera: Front camera',
        );

        mocks.appProvider.isPageScreen = true;
        cameraOptions.onUnavailable('Front camera');
        expect(mocks.showSimpleToast).toHaveBeenCalledTimes(1);
        mocks.appProvider.isPageScreen = false;
        manager.delete();
    });

    test('Screen Show adds, replaces, and removes its source without creating a loop', () => {
        const base = createScreenManagerBase(46);
        base.sendScreenShowSnapshots = vi.fn();
        const manager = new ScreenForegroundManager(
            base,
            createEffectManager(),
        );
        const root = document.createElement('div');
        document.body.appendChild(root);
        manager.rootContainer = root;
        const first = { id: 47, extraStyle: { opacity: 0.5 } };

        expect(manager.addScreenData(first as any)).toBe(true);
        expect(manager.foregroundData.screenDataList).toEqual([first]);
        expect(base.sendScreenShowSnapshots).toHaveBeenCalledWith([47]);
        expect(mocks.mountScreenShowFrame).toHaveBeenCalledTimes(1);
        const firstMount = mocks.mountScreenShowFrame.mock.calls[0][0];
        expect(firstMount).toMatchObject({
            sourceScreenId: 47,
            ownScreenId: 46,
            parentContainer: expect.any(HTMLElement),
            extraStyle: { opacity: 0.5 },
        });
        expect(firstMount.getSnapshot()).toBeNull();

        expect(manager.addScreenData(first as any)).toBe(true);
        expect(mocks.mountScreenShowFrame).toHaveBeenCalledTimes(1);
        expect(ScreenForegroundManager.getScreenShowTargetIds(47)).toEqual([
            46,
        ]);

        const changed = { id: 47, extraStyle: { opacity: 0.8 } };
        expect(manager.addScreenData(changed as any)).toBe(true);
        expect(manager.foregroundData.screenDataList).toEqual([changed]);
        expect(mocks.mountScreenShowFrame).toHaveBeenCalledTimes(2);
        expect(base.sendScreenShowSnapshots).toHaveBeenCalledTimes(1);

        const sourceManager = new ScreenForegroundManager(
            createScreenManagerBase(47),
            createEffectManager(),
        );
        expect(sourceManager.addScreenData({ id: 46 } as any)).toBe(false);
        expect(mocks.showSimpleToast).toHaveBeenLastCalledWith(
            'Screen Show',
            'These screens would show each other',
        );
        expect(manager.addScreenData({ id: 46 } as any)).toBe(false);
        expect(mocks.showSimpleToast).toHaveBeenLastCalledWith(
            'Screen Show',
            'A screen cannot show itself',
        );
        expect(manager.addScreenData({ id: 'not a screen' } as any)).toBe(
            false,
        );

        mocks.checkIsScreenShowFrame.mockReturnValue(true);
        manager.renderScreen({ id: 48 } as any);
        expect(mocks.mountScreenShowFrame).toHaveBeenCalledTimes(2);
        mocks.checkIsScreenShowFrame.mockReturnValue(false);

        ScreenForegroundManager.removeScreenShowSource(47);
        expect(manager.foregroundData.screenDataList).toEqual([]);
        expect(
            mocks.mountScreenShowFrame.mock.results[0].value.dispose,
        ).toHaveBeenCalled();
        manager.delete();
        sourceManager.delete();
    });

    test('actions aimed at a screen without a manager are reported and skipped', async () => {
        vi.spyOn(ScreenForegroundManager, 'chooseScreenIds').mockResolvedValue([
            999,
        ]);
        await ScreenForegroundManager.setData(
            new MouseEvent('click'),
            vi.fn(),
            false,
        );
        ScreenForegroundManager.receiveSyncScreen({
            screenId: 998,
            type: 'foreground',
            data: {},
        } as any);

        expect(mocks.showSimpleToast).toHaveBeenNthCalledWith(
            1,
            'Failed to apply to screen. Please make sure the screen is open.',
            'Error',
        );
        expect(mocks.showSimpleToast).toHaveBeenNthCalledWith(
            2,
            'Failed to apply to screen. Please make sure the screen is open.',
            'error',
        );
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
            virtualBackgroundColor: null,
        });

        // Selecting a slide re-derives it for the screen's stage through
        // `getTargetLyricSlideItemData`, so it only lands a microtask later.
        manager.handleSlideSelecting('/slides/a.slide', slideJson as any);
        await flushVarySlideData();
        expect(manager.varySlideData?.filePath).toBe('/slides/a.slide');
        // Re-selecting the same slide re-applies it (no toggle-off behavior).
        manager.handleSlideSelecting('/slides/a.slide', slideJson as any);
        await flushVarySlideData();
        expect(manager.varySlideData?.filePath).toBe('/slides/a.slide');

        vi.spyOn(
            ScreenVaryAppDocumentManager,
            'chooseScreenIds',
        ).mockResolvedValue([51]);
        await ScreenVaryAppDocumentManager.handleSlideSelecting(
            new MouseEvent('click') as any,
            '/slides/b.slide',
            slideJson as any,
        );
        await flushVarySlideData();
        expect(manager.varySlideData?.filePath).toBe('/slides/b.slide');

        const playIconSvg = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'svg',
        );
        playIconSvg.setAttribute('data-preview-only', '');
        const contentIconSvg = document.createElementNS(
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
        content.appendChild(playIconSvg);
        content.appendChild(contentIconSvg);
        content.appendChild(video);
        mocks.appProvider.isPageScreen = true;
        manager.cleanupSlideContent(content);
        expect(playIconSvg.style.display).toBe('none');
        // Icons drawn by canvas items, such as the bible item's book icon,
        // must survive onto the screen output.
        expect(contentIconSvg.style.display).toBe('');
        expect(video.loop).toBe(false);
        // The screen holds the first frame, muted and paused; playback is
        // driven from the presenter's mini screen.
        expect(video.muted).toBe(true);
        expect(video.id).toBe('video-abc123');
        expect(playMock).not.toHaveBeenCalled();
        mocks.appProvider.isPageScreen = false;

        // On the presenter's mini screen the video gets native controls
        // and stays paused until the user interacts with it.
        const presenterContent = document.createElement('div');
        const presenterVideo = document.createElement('video');
        presenterContent.appendChild(presenterVideo);
        manager.cleanupSlideContent(presenterContent);
        expect(presenterVideo.controls).toBe(true);
        expect(presenterVideo.muted).toBe(false);
        expect(presenterVideo.style.pointerEvents).toBe('auto');
        expect(presenterVideo.id).toBe('video-abc123');
        expect(playMock).not.toHaveBeenCalled();

        // Embedded audio (e.g. from a PPTX slide) is wired up the same way as
        // video so it can be played and synced from the mini screen.
        const presenterAudioContent = document.createElement('div');
        const presenterAudio = document.createElement('audio');
        presenterAudioContent.appendChild(presenterAudio);
        manager.cleanupSlideContent(presenterAudioContent);
        expect(presenterAudio.controls).toBe(true);
        expect(presenterAudio.muted).toBe(false);
        expect(presenterAudio.style.pointerEvents).toBe('auto');
        expect(presenterAudio.id).toBe('video-abc123');

        // PPTX/DOCX media lives inside a shadow root; cleanup must reach it.
        const shadowHostContent = document.createElement('div');
        const shadowHost = document.createElement('div');
        const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
        const shadowVideo = document.createElement('video');
        shadowRoot.appendChild(shadowVideo);
        shadowHostContent.appendChild(shadowHost);
        manager.cleanupSlideContent(shadowHostContent);
        expect(shadowVideo.controls).toBe(true);
        expect(shadowVideo.id).toBe('video-abc123');

        presenterVideo.dispatchEvent(new Event('play'));
        expect(
            presenterVideo.hasAttribute('data-block-unload-while-playing'),
        ).toBe(true);
        presenterVideo.dispatchEvent(new Event('pause'));
        expect(
            presenterVideo.hasAttribute('data-block-unload-while-playing'),
        ).toBe(false);
        presenterVideo.dispatchEvent(new Event('play'));
        presenterVideo.dispatchEvent(new Event('ended'));
        expect(
            presenterVideo.hasAttribute('data-block-unload-while-playing'),
        ).toBe(false);

        const groupMember = {
            setVideoCurrentTimeForce: vi.fn(),
        };
        manager.getMemberInstances = vi.fn(async () => [groupMember]);
        const sendSyncVideoTimeSpy = vi.spyOn(manager, 'sendSyncVideoTime');
        await manager.setSlideVideoCurrentTimeForce('video-abc123', 33, true);
        // The playback rate and the level ride the time message, left off
        // when nobody set them.
        expect(sendSyncVideoTimeSpy).toHaveBeenCalledWith(
            'video-abc123',
            33,
            true,
            undefined,
            undefined,
        );
        expect(groupMember.setVideoCurrentTimeForce).toHaveBeenCalledWith(
            'video-abc123',
            33,
            true,
            undefined,
        );

        const suppressLoopSpy = vi
            .spyOn(manager, 'setSlideVideoCurrentTimeForce')
            .mockResolvedValue(undefined);
        manager.div = presenterContent;
        manager.setVideoCurrentTime({
            videoId: 'video-abc123',
            videoTime: 8,
            timestamp: Date.now(),
            isPlaying: true,
        });
        presenterVideo.dispatchEvent(new Event('timeupdate'));
        expect(suppressLoopSpy).not.toHaveBeenCalled();
        presenterVideo.dispatchEvent(new Event('timeupdate'));
        expect(suppressLoopSpy).toHaveBeenCalledWith(
            'video-abc123',
            presenterVideo.currentTime,
            !presenterVideo.paused,
            presenterVideo.playbackRate,
            presenterVideo.volume,
        );
        suppressLoopSpy.mockRestore();

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
        await flushVarySlideData();
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
        await flushVarySlideData();
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
        await flushVarySlideData();
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
        await flushVarySlideData();
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
            manager.getRenderingItemJson({
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
            manager.getRenderingItemJson({
                id: 10,
                filePath: '/slides/doc.docx',
                html: undefined,
                toJson: () => slideJson,
            } as any),
        ).resolves.toEqual(docxLoadedJson);

        mocks.docxCheckIsThisType.mockReturnValue(false);
        await expect(
            manager.getRenderingItemJson({
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
            virtualBackgroundColor: null,
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
    test('background group membership, sync adoption, and container style', async () => {
        const base = createScreenManagerBase(24);
        const manager = new ScreenBackgroundManager(
            base,
            createEffectManager(),
        );

        await expect(manager.getMemberInstances()).resolves.toEqual([]);
        await expect(manager.getMemberIds()).resolves.toEqual([]);
        await expect(manager.checkIsMainInstance()).resolves.toBe(false);

        manager.receiveSyncScreen({
            screenId: 24,
            type: 'background',
            data: { type: 'color', src: '#123456' },
        } as any);
        expect(manager.backgroundSrc).toEqual({
            type: 'color',
            src: '#123456',
        });

        expect(manager.containerStyle).toEqual({
            pointerEvents: 'none',
            position: 'absolute',
            width: '1280px',
            height: '720px',
            overflow: 'hidden',
        });

        // picking the background that is already showing clears it
        await manager.applyBackgroundSrc('color', { src: '#123456' } as any);
        expect(manager.backgroundSrc).toBeNull();

        await manager.applyBackgroundSrc('color', {
            src: '#654321',
            scaleType: 'cover',
        } as any);
        expect(manager.backgroundSrc).toEqual(
            expect.objectContaining({ src: '#654321', scaleType: 'cover' }),
        );

        // an explicit "no background" also clears
        await manager.applyBackgroundSrc('color', { src: null } as any);
        expect(manager.backgroundSrc).toBeNull();
    });

    test('the end-of-video crossfade covers the wrap and re-uses one copy', async () => {
        const base = createScreenManagerBase(25);
        const effectManager = createEffectManager();
        // Mirror what the real fade leaves behind, or the assertions below
        // pass whether or not the code puts anything back.
        effectManager.styleAnimList.fade.animOut = vi.fn(
            async (element: HTMLElement) => {
                element.style.opacity = '0';
            },
        );
        effectManager.styleAnimList.fade.animIn = vi.fn(
            async (element: HTMLElement, parent: HTMLElement) => {
                parent.appendChild(element);
            },
        );
        const manager = new ScreenBackgroundManager(base, effectManager);
        const rootContainer = document.createElement('div');
        const container = document.createElement('div');
        const video = document.createElement('video');
        video.id = 'video-ending';
        container.appendChild(video);
        rootContainer.appendChild(container);
        document.body.appendChild(rootContainer);
        vi.spyOn(manager, 'rootContainer', 'get').mockReturnValue(
            rootContainer as any,
        );
        const renderSpy = vi
            .spyOn(manager, 'render')
            .mockImplementation(() => {});
        // What a foreground Opacity slider would have authored.
        container.style.opacity = '0.5';
        mocks.getIsFadingAtTheEndSetting.mockReturnValue(true);

        await manager._fadeOverVideoLoop(container, video);

        const { animIn, animOut } = effectManager.styleAnimList.fade;
        // NOTHING fades out. The copy coming in covers the clip that is still
        // playing its last seconds; dipping the one element to zero and back
        // -- which is what this did for a while -- goes through black, and
        // that black is the blank the audience sees at the end of every clip.
        expect(animOut).not.toHaveBeenCalled();
        const twin = rootContainer.lastElementChild as HTMLElement;
        expect(twin).not.toBe(container);
        expect(animIn).toHaveBeenCalledWith(twin, rootContainer);
        expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
        // The copy comes in at the opacity the background asked for, and the
        // clip that just ended is parked out of sight rather than removed.
        expect(twin.style.opacity).toBe('0.5');
        expect(container.style.opacity).toBe('0');
        expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
        // Nothing may go back through `render()`: that is what re-read the
        // whole clip from disk on every lap.
        expect(renderSpy).not.toHaveBeenCalled();

        // The next lap hands back to the copy that is already there -- two
        // elements for the life of the background, not one more per lap.
        const twinVideo = twin.querySelector('video') as HTMLVideoElement;
        await manager._fadeOverVideoLoop(twin, twinVideo);
        expect(rootContainer.children).toHaveLength(2);
        expect(rootContainer.lastElementChild).toBe(container);
        expect(container.style.opacity).toBe('0.5');
        expect(twin.style.opacity).toBe('0');

        rootContainer.remove();
    });

    test('clearing a background takes both halves of the crossfade away', async () => {
        const base = createScreenManagerBase(27);
        const effectManager = createEffectManager();
        const manager = new ScreenBackgroundManager(base, effectManager);
        const rootContainer = document.createElement('div');
        const showing = document.createElement('div');
        const parked = document.createElement('div');
        // The parked half of a crossfade is already invisible.
        parked.style.opacity = '0';
        rootContainer.append(parked, showing);
        document.body.appendChild(rootContainer);
        vi.spyOn(manager, 'rootContainer', 'get').mockReturnValue(
            rootContainer as any,
        );
        vi.spyOn(manager, 'backgroundSrc', 'get').mockReturnValue(null as any);

        manager.render();
        await Promise.resolve();
        await Promise.resolve();

        // Only the last child used to go, which left the parked copy -- and
        // its media player -- behind for the rest of the service.
        expect(rootContainer.children).toHaveLength(0);
        // The parked one is not faded out on its way: `animOut` puts
        // `opacity: 1` on first, which would bring a frozen frame INTO view.
        expect(effectManager.styleAnim.animOut).toHaveBeenCalledTimes(1);
        expect(effectManager.styleAnim.animOut).toHaveBeenCalledWith(showing);

        rootContainer.remove();
    });

    test('two renders in one tick put up ONE copy, and an overtaken one nothing', async () => {
        const base = createScreenManagerBase(28);
        const effectManager = createEffectManager();
        effectManager.styleAnim.animIn = vi.fn(
            (element: HTMLElement, root: HTMLElement) => {
                root.appendChild(element);
            },
        );
        const manager = new ScreenBackgroundManager(base, effectManager);
        const rootContainer = document.createElement('div');
        document.body.appendChild(rootContainer);
        vi.spyOn(manager, 'rootContainer', 'get').mockReturnValue(
            rootContainer as any,
        );
        const backgroundSrc = vi
            .spyOn(manager, 'backgroundSrc', 'get')
            .mockReturnValue({ type: 'video', src: 'file:///a.mp4' } as any);
        const flush = async () => {
            for (let index = 0; index < 4; index++) {
                await Promise.resolve();
            }
        };

        // The root attached and the background set together, as a screen
        // page does on load: both copies used to go in and play at once.
        manager.render();
        manager.render();
        await flush();
        expect(rootContainer.children).toHaveLength(1);
        expect(effectManager.styleAnim.animIn).toHaveBeenCalledTimes(1);

        // Cleared before the new copy was ready: it does not come back.
        manager.render();
        backgroundSrc.mockReturnValue(null as any);
        manager.render();
        await flush();
        expect(rootContainer.children).toHaveLength(0);
        expect(effectManager.styleAnim.animIn).toHaveBeenCalledTimes(1);
        // The copy dropped hands its media player back.
        expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();

        rootContainer.remove();
    });

    test('the end-of-video fade gives up when the background was swapped', async () => {
        const base = createScreenManagerBase(26);
        const effectManager = createEffectManager();
        const manager = new ScreenBackgroundManager(base, effectManager);
        const rootContainer = document.createElement('div');
        const container = document.createElement('div');
        const video = document.createElement('video');
        video.id = 'video-swapped';
        container.appendChild(video);
        // Never attached: the operator changed the background mid-fade.
        vi.spyOn(manager, 'rootContainer', 'get').mockReturnValue(
            rootContainer as any,
        );

        await manager._fadeOverVideoLoop(container, video);

        expect(effectManager.styleAnimList.fade.animOut).not.toHaveBeenCalled();
        expect(effectManager.styleAnimList.fade.animIn).not.toHaveBeenCalled();
    });

    test('releases background roots without clearing a replacement root', () => {
        const manager = new ScreenBackgroundManager(
            createScreenManagerBase(29),
            createEffectManager(),
        );
        const currentRoot = document.createElement('div');
        const projectedVideo = document.createElement('video');
        currentRoot.appendChild(projectedVideo);
        manager.rootContainer = currentRoot;
        const clearTracks = vi.fn();
        manager.clearTracks = clearTracks;

        mocks.appProvider.isPageScreen = true;
        manager.releaseRootContainer(currentRoot);
        expect(currentRoot.contains(projectedVideo)).toBe(true);
        expect(HTMLMediaElement.prototype.load).not.toHaveBeenCalled();

        mocks.appProvider.isPageScreen = false;
        const staleRoot = document.createElement('div');
        staleRoot.appendChild(document.createElement('video'));
        manager.releaseRootContainer(staleRoot);
        expect(staleRoot.children).toHaveLength(0);
        expect(manager.rootContainer).toBe(currentRoot);
        expect(clearTracks).not.toHaveBeenCalled();

        manager.releaseRootContainer(currentRoot);
        expect(currentRoot.children).toHaveLength(0);
        expect(manager.rootContainer).toBeNull();
        expect(clearTracks).toHaveBeenCalledOnce();
        expect(manager.clearTracks).not.toBe(clearTracks);
    });

    test('plays background video sound only on the selected virtual display copy', () => {
        mocks.appProvider.isPageScreen = true;
        const base = createScreenManagerBase(30);
        base.isOnVirtualDisplay = true;
        const manager = new ScreenBackgroundManager(
            base,
            createEffectManager(),
        );
        const root = document.createElement('div');
        const first = document.createElement('video');
        first.id = 'video-first';
        const second = document.createElement('video');
        second.id = 'video-second';
        Object.defineProperty(first, 'paused', {
            configurable: true,
            value: false,
        });
        Object.defineProperty(second, 'paused', {
            configurable: true,
            value: false,
        });
        root.append(first, second);
        document.body.appendChild(root);
        manager.rootContainer = root;

        manager.receiveSyncVideoSound({
            screenId: 30,
            type: 'background-video-sound',
            data: { videoId: 'video-second', isPlaying: true, volume: 0.4 },
        } as any);
        manager.applyVideoSound(second);
        expect(first.muted).toBe(true);
        expect(second.muted).toBe(false);
        expect(second.volume).toBe(0.4);

        manager.receiveSyncVideoSound({
            screenId: 30,
            type: 'background-video-sound',
            data: { videoId: 'video-second', isPlaying: false, volume: 0.2 },
        } as any);
        expect(second.muted).toBe(true);
        expect(second.volume).toBe(0.2);

        manager.receiveSyncVideoSound({
            screenId: 30,
            type: 'background-video-sound',
            data: { videoId: 'video-second', isPlaying: true, volume: 2 },
        } as any);
        expect(second.muted).toBe(true);
        expect(second.volume).toBe(0.2);
        root.remove();
    });

    test('waits for a video picture only while media is loading', async () => {
        const manager = new ScreenBackgroundManager(
            createScreenManagerBase(31),
            createEffectManager(),
        );
        const ready = document.createElement('video');
        Object.defineProperties(ready, {
            readyState: { configurable: true, value: 2 },
            networkState: { configurable: true, value: 2 },
        });
        await expect(
            manager._waitForVideoPicture(ready),
        ).resolves.toBeUndefined();

        const empty = document.createElement('video');
        Object.defineProperties(empty, {
            readyState: { configurable: true, value: 0 },
            networkState: { configurable: true, value: 0 },
        });
        await expect(
            manager._waitForVideoPicture(empty),
        ).resolves.toBeUndefined();

        vi.useFakeTimers();
        const waiting = document.createElement('video');
        Object.defineProperties(waiting, {
            readyState: { configurable: true, value: 1 },
            networkState: { configurable: true, value: 2 },
        });
        const loaded = manager._waitForVideoPicture(waiting);
        waiting.dispatchEvent(new Event('loadeddata'));
        await expect(loaded).resolves.toBeUndefined();

        const timedOut = manager._waitForVideoPicture(waiting);
        await vi.advanceTimersByTimeAsync(1000);
        await expect(timedOut).resolves.toBeUndefined();
        vi.useRealTimers();
    });

    test('the fading-at-end preference defaults to on', async () => {
        const {
            getIsFadingAtEndSetting,
            BACKGROUND_VIDEO_FADING_SETTING_NAME,
        } = await import('./ScreenBackgroundManager');

        mocks.getSetting.mockReturnValue(undefined);
        expect(getIsFadingAtEndSetting()).toBe(true);

        mocks.getSetting.mockReturnValue('false');
        expect(getIsFadingAtEndSetting()).toBe(false);
        expect(BACKGROUND_VIDEO_FADING_SETTING_NAME).toContain('fading-at-end');
    });

    test('a foreground widget that can take a new datum is updated on the wall, not remounted', () => {
        const manager = new ScreenForegroundManager(
            createScreenManagerBase(311),
            createEffectManager(),
        );
        manager.rootContainer = document.createElement('div');
        const oldData = { dateTime: 'a', extraStyle: {} };
        const newData = { dateTime: 'a', isPaused: true, extraStyle: {} };
        const removing = vi.fn();
        const updateHandler = vi.fn(() => true);
        manager.createDivContainer(oldData, removing, updateHandler);
        const render = vi.fn();

        expect(manager.compareAndRender(oldData, newData, render)).toBe(
            newData,
        );
        expect(updateHandler).toHaveBeenCalledWith(newData);
        expect(render).not.toHaveBeenCalled();
        expect(removing).not.toHaveBeenCalled();
        // The mounted widget is now keyed by the datum the manager holds,
        // so hiding it by that datum takes it down.
        manager.removeDivContainer(newData);
        expect(removing).toHaveBeenCalledTimes(1);

        // A widget that cannot take the change is remounted instead.
        const refusing = vi.fn(() => false);
        manager.createDivContainer(oldData, removing, refusing);
        expect(manager.compareAndRender(oldData, newData, render)).toBe(
            newData,
        );
        expect(refusing).toHaveBeenCalledWith(newData);
        expect(render).toHaveBeenCalledWith(newData);
        expect(removing).toHaveBeenCalledTimes(2);

        // The same object handed back is no change at all.
        expect(manager.compareAndRender(newData, newData, render)).toBe(
            newData,
        );
        expect(render).toHaveBeenCalledTimes(1);
        manager.delete();
    });

    test('an unreadable foreground map is rebuilt from the live screens on the presenter', () => {
        mocks.appProvider.isPagePresenter = true;
        // A fresh map per read, as the real reader hands out a copy.
        mocks.getForegroundDataListOnScreenSetting.mockImplementation(
            () => ({}),
        );
        const other = new ScreenForegroundManager(
            createScreenManagerBase(312),
            createEffectManager(),
        );
        other.setQuickTextData({
            htmlText: '<b>Other</b>',
            timeSecondDelay: 0,
            timeSecondToLive: 5,
            extraStyle: {},
        } as any);
        mocks.getSetting.mockReturnValue('{"312": {"quickTextData": nul');
        mocks.setSetting.mockClear();
        const manager = new ScreenForegroundManager(
            createScreenManagerBase(313),
            createEffectManager(),
        );
        manager.setQuickTextData({
            htmlText: '<i>Mine</i>',
            timeSecondDelay: 0,
            timeSecondToLive: 5,
            extraStyle: {},
        } as any);

        const [settingName, written] = mocks.setSetting.mock.calls.at(-1)!;
        expect(settingName).toBe('screen-foreground-manager');
        const writtenMap = JSON.parse(written);
        expect(writtenMap['312'].quickTextData.htmlText).toBe('<b>Other</b>');
        expect(writtenMap['313'].quickTextData.htmlText).toBe('<i>Mine</i>');
        expect(mocks.handleError).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining('rebuilding it'),
            }),
        );
        other.delete();
        manager.delete();
    });

    test('a message editor replaces its own message rather than stacking a copy', async () => {
        const manager = new ScreenForegroundManager(
            createScreenManagerBase(314),
            createEffectManager(),
        );
        const first = { id: 'editor-1', textList: ['Welcome'], extraStyle: {} };
        manager.addMessageData(first as any);
        expect(manager.foregroundData.messageDataList).toEqual([first]);

        // Pressing Show again on an unchanged message changes nothing.
        mocks.setSetting.mockClear();
        manager.addMessageData({ ...first } as any);
        expect(mocks.setSetting).not.toHaveBeenCalled();

        const edited = { ...first, textList: ['Welcome, all'] };
        manager.addMessageData(edited as any);
        expect(manager.foregroundData.messageDataList).toEqual([edited]);

        const second = {
            id: 'editor-2',
            textList: ['Offering'],
            extraStyle: {},
        };
        manager.addMessageData(second as any);
        expect(manager.foregroundData.messageDataList).toEqual([
            edited,
            second,
        ]);

        manager.removeMessageData('editor-1');
        expect(manager.foregroundData.messageDataList).toEqual([second]);

        // The panel's own entry point picks the screens first.
        vi.spyOn(ScreenForegroundManager, 'chooseScreenIds').mockResolvedValue([
            314,
        ]);
        await ScreenForegroundManager.addMessageData(
            new MouseEvent('click') as any,
            first as any,
        );
        await Promise.resolve();
        expect(manager.foregroundData.messageDataList).toEqual([second, first]);
        manager.delete();
    });

    test('a quick text that runs out takes itself off the screen', () => {
        const manager = new ScreenForegroundManager(
            createScreenManagerBase(315),
            createEffectManager(),
        );
        manager.rootContainer = document.createElement('div');
        manager.setQuickTextData({
            htmlText: 'Gone soon',
            timeSecondDelay: 0,
            timeSecondToLive: 1,
            extraStyle: {},
        } as any);
        expect(manager.foregroundData.quickTextData).not.toBeNull();
        const call = mocks.genQuickText.mock.calls.find((args: any[]) => {
            return typeof args[2] === 'function';
        })!;
        // The widget calls this when its time to live is over.
        call[2]();
        expect(manager.foregroundData.quickTextData).toBeNull();
        manager.delete();
    });

    test('a camera taken down while still opening leaves nothing behind', async () => {
        const manager = new ScreenForegroundManager(
            createScreenManagerBase(316),
            createEffectManager(),
        );
        const root = document.createElement('div');
        manager.rootContainer = root;
        let resolveCamera: (clearTracks: any) => void = () => {};
        mocks.getCameraAndShowMedia.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveCamera = resolve;
                }),
        );
        const opening = { deviceId: 'cam-1', label: 'Slow', extraStyle: {} };
        manager.renderCamera(opening as any);
        expect(root.childElementCount).toBe(1);
        manager.removeDivContainer(opening);
        await Promise.resolve();
        await Promise.resolve();
        expect(root.childElementCount).toBe(0);
        resolveCamera(undefined);

        // Once open, taking it down stops its tracks.
        const clearTracks = vi.fn(async () => {});
        mocks.getCameraAndShowMedia.mockImplementationOnce(
            async () => clearTracks,
        );
        const open = { deviceId: 'cam-2', label: 'Fast', extraStyle: {} };
        manager.renderCamera(open as any);
        await Promise.resolve();
        await Promise.resolve();
        manager.removeDivContainer(open);
        await Promise.resolve();
        expect(clearTracks).toHaveBeenCalledTimes(1);
        manager.delete();
    });

    test('Screen Show is put on and taken off the chosen screens', async () => {
        const manager = new ScreenForegroundManager(
            createScreenManagerBase(317),
            createEffectManager(),
        );
        const addSpy = vi.spyOn(manager, 'addScreenData').mockReturnValue(true);
        const removeSpy = vi
            .spyOn(manager, 'removeScreenData')
            .mockImplementation(() => {});
        const saveSpy = vi.spyOn(manager, 'saveForegroundData');
        vi.spyOn(ScreenForegroundManager, 'chooseScreenIds').mockResolvedValue([
            317,
        ]);
        const data = { id: 318, extraStyle: {} };

        await ScreenForegroundManager.addScreenData(
            new MouseEvent('click') as any,
            data as any,
        );
        await Promise.resolve();
        expect(addSpy).toHaveBeenCalledWith(data);
        await ScreenForegroundManager.removeScreenData(
            new MouseEvent('click') as any,
            data as any,
        );
        await Promise.resolve();
        expect(removeSpy).toHaveBeenCalledWith(data);
        expect(saveSpy).toHaveBeenCalledTimes(2);
        manager.delete();
    });

    test('videos and pictures are added once, removed by value, from either entry point', async () => {
        const manager = new ScreenForegroundManager(
            createScreenManagerBase(319),
            createEffectManager(),
        );
        manager.rootContainer = document.createElement('div');
        const video = { src: '/v/clip.mp4', extraStyle: {} };
        const image = { src: '/i/pic.png', extraStyle: {} };

        manager.addVideoData(video as any);
        manager.addVideoData({ ...video } as any);
        expect(manager.foregroundData.videoDataList).toEqual([video]);
        expect(mocks.genVideo).toHaveBeenCalledTimes(1);
        manager.removeVideoData({ ...video } as any);
        expect(manager.foregroundData.videoDataList).toEqual([]);

        manager.addImageData(image as any);
        manager.addImageData({ ...image } as any);
        expect(manager.foregroundData.imageDataList).toEqual([image]);
        expect(mocks.genImage).toHaveBeenCalledTimes(1);
        manager.removeImageData({ ...image } as any);
        expect(manager.foregroundData.imageDataList).toEqual([]);

        vi.spyOn(ScreenForegroundManager, 'chooseScreenIds').mockResolvedValue([
            319,
        ]);
        const event = new MouseEvent('click') as any;
        await ScreenForegroundManager.addVideoData(event, video as any);
        await ScreenForegroundManager.addImageData(event, image as any);
        await Promise.resolve();
        expect(manager.foregroundData.videoDataList).toEqual([video]);
        expect(manager.foregroundData.imageDataList).toEqual([image]);
        await ScreenForegroundManager.removeVideoData(event, video as any);
        await ScreenForegroundManager.removeImageData(event, image as any);
        await Promise.resolve();
        expect(manager.foregroundData.videoDataList).toEqual([]);
        expect(manager.foregroundData.imageDataList).toEqual([]);
        manager.delete();
    });

    test('a locked screen keeps its foreground', () => {
        const base = createScreenManagerBase(320);
        const manager = new ScreenForegroundManager(
            base,
            createEffectManager(),
        );
        base.checkIsLockedWithMessage.mockReturnValue(true);
        mocks.setSetting.mockClear();
        manager.addImageData({ src: '/i/x.png', extraStyle: {} } as any);
        expect(manager.foregroundData.imageDataList).toEqual([]);
        expect(mocks.setSetting).not.toHaveBeenCalled();
        manager.delete();
    });

    test('the same background again changes nothing, and a locked screen refuses another', () => {
        const base = createScreenManagerBase(321);
        const manager = new ScreenBackgroundManager(
            base,
            createEffectManager(),
        );
        manager.backgroundSrc = { type: 'color', src: '#111111' } as any;
        const renderSpy = vi.spyOn(manager, 'render');
        mocks.setSetting.mockClear();

        manager.backgroundSrc = { type: 'color', src: '#111111' } as any;
        expect(renderSpy).not.toHaveBeenCalled();
        expect(mocks.setSetting).not.toHaveBeenCalled();

        base.checkIsLockedWithMessage.mockReturnValue(true);
        manager.backgroundSrc = { type: 'color', src: '#222222' } as any;
        expect(manager.backgroundSrc).toEqual(
            expect.objectContaining({ src: '#111111' }),
        );
        expect(renderSpy).not.toHaveBeenCalled();
        manager.delete();
    });

    test('an unreadable background map is rebuilt from the live screens on the presenter', () => {
        mocks.appProvider.isPagePresenter = true;
        mocks.getBackgroundSrcListOnScreenSetting.mockImplementation(
            () => ({}),
        );
        const other = new ScreenBackgroundManager(
            createScreenManagerBase(322),
            createEffectManager(),
        );
        other.backgroundSrc = { type: 'color', src: '#333333' } as any;
        mocks.getSetting.mockReturnValue('{"322": {"type": "col');
        mocks.setSetting.mockClear();
        const manager = new ScreenBackgroundManager(
            createScreenManagerBase(323),
            createEffectManager(),
        );
        manager.backgroundSrc = { type: 'color', src: '#444444' } as any;

        const [settingName, written] = mocks.setSetting.mock.calls.at(-1)!;
        expect(settingName).toBe('screen-bg-manager');
        const writtenMap = JSON.parse(written);
        expect(writtenMap['322']).toEqual(
            expect.objectContaining({ src: '#333333' }),
        );
        expect(writtenMap['323']).toEqual(
            expect.objectContaining({ src: '#444444' }),
        );
        other.delete();
        manager.delete();
    });

    test('a background video is synced only outside its fades, and only when off', () => {
        const manager = new ScreenBackgroundManager(
            createScreenManagerBase(324),
            createEffectManager(),
        );
        const data = {
            videoId: 'video-bg',
            videoTime: 50,
            timestamp: Date.now(),
            isFromScreen: false,
        };
        // No root: nothing to sync.
        expect(() => manager.setVideoCurrentTime(data)).not.toThrow();

        const root = document.createElement('div');
        const genVideo = (currentTime: number) => {
            const video = document.createElement('video');
            video.id = 'video-bg';
            Object.defineProperties(video, {
                currentTime: {
                    configurable: true,
                    writable: true,
                    value: currentTime,
                },
                duration: { configurable: true, writable: true, value: 120 },
            });
            root.appendChild(video);
            return video;
        };
        const fadingIn = genVideo(1);
        const fadingOut = genVideo(118);
        const drifted = genVideo(45);
        const close = genVideo(50.05);
        vi.spyOn(manager, 'rootContainer', 'get').mockReturnValue(root as any);

        manager.setVideoCurrentTime({ ...data, timestamp: Date.now() });
        expect(fadingIn.currentTime).toBe(1);
        expect(fadingOut.currentTime).toBe(118);
        expect(drifted.currentTime).toBeGreaterThanOrEqual(50);
        expect(close.currentTime).toBe(50.05);
        expect(mocks.appLog).toHaveBeenCalledTimes(1);
    });

    test('a screen time follows the presenter audio while it plays', () => {
        const manager = new ScreenBackgroundManager(
            createScreenManagerBase(325),
            createEffectManager(),
        );
        const root = document.createElement('div');
        const video = document.createElement('video');
        video.id = 'video-song';
        Object.defineProperties(video, {
            currentTime: { configurable: true, writable: true, value: 30 },
            duration: { configurable: true, writable: true, value: 120 },
        });
        root.appendChild(video);
        vi.spyOn(manager, 'rootContainer', 'get').mockReturnValue(root as any);
        const audio = document.createElement('audio');
        audio.dataset.videoId = 'video-song';
        document.body.appendChild(audio);

        // The audio handler is not playing: a time from the screen applies.
        manager.setVideoCurrentTime({
            videoId: 'video-song',
            videoTime: 40,
            timestamp: Date.now(),
            isFromScreen: true,
        });
        expect(video.currentTime).toBeGreaterThanOrEqual(40);

        // Playing: the audio owns the time, the screen's report is ignored.
        Object.defineProperty(audio, 'paused', {
            configurable: true,
            value: false,
        });
        video.currentTime = 30;
        manager.setVideoCurrentTime({
            videoId: 'video-song',
            videoTime: 60,
            timestamp: Date.now(),
            isFromScreen: true,
        });
        expect(video.currentTime).toBe(30);
        audio.remove();
    });

    test('the presenter audio level for a virtual display goes out as a message', () => {
        const base = createScreenManagerBase(326);
        const manager = new ScreenBackgroundManager(
            base,
            createEffectManager(),
        );
        manager.sendSyncVideoSound('video-x', true, 0.7);
        expect(base.sendScreenMessage).toHaveBeenCalledWith(
            {
                screenId: 326,
                type: 'background-video-sound',
                data: { videoId: 'video-x', isPlaying: true, volume: 0.7 },
            },
            true,
        );
    });

    test('incoming sound, time and screen messages reach the right screen only', () => {
        const manager = new ScreenBackgroundManager(
            createScreenManagerBase(327),
            createEffectManager(),
        );
        const soundSpy = vi
            .spyOn(manager, 'receiveSyncVideoSound')
            .mockImplementation(() => {});
        const timeSpy = vi
            .spyOn(manager, 'receiveSyncVideoTime')
            .mockImplementation(() => {});
        const screenSpy = vi
            .spyOn(manager, 'receiveSyncScreen')
            .mockImplementation(() => {});
        const message = (screenId: number, type: string) => {
            return { screenId, type, data: {} } as any;
        };

        ScreenBackgroundManager.receiveSyncVideoSound(
            message(327, 'background-video-sound'),
        );
        ScreenBackgroundManager.receiveSyncVideoSound(
            message(9327, 'background-video-sound'),
        );
        expect(soundSpy).toHaveBeenCalledTimes(1);

        ScreenBackgroundManager.receiveSyncVideoTime(
            message(327, 'background-video-time'),
        );
        ScreenBackgroundManager.receiveSyncVideoTime(
            message(9327, 'background-video-time'),
        );
        expect(timeSpy).toHaveBeenCalledTimes(1);

        ScreenBackgroundManager.receiveSyncScreen(message(327, 'background'));
        expect(screenSpy).toHaveBeenCalledTimes(1);
        ScreenBackgroundManager.receiveSyncScreen(message(9327, 'background'));
        expect(screenSpy).toHaveBeenCalledTimes(1);
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Failed to apply to screen. Please make sure the screen is open.',
            'error',
        );
        manager.delete();
    });

    test('picking a background applies it to each chosen screen and reports a closed one', async () => {
        const manager = new ScreenBackgroundManager(
            createScreenManagerBase(328),
            createEffectManager(),
        );
        const applySpy = vi
            .spyOn(manager, 'applyBackgroundSrc')
            .mockResolvedValue(undefined);
        vi.spyOn(ScreenBackgroundManager, 'chooseScreenIds').mockResolvedValue([
            9328, 328,
        ]);
        const data = { src: '/img/a.png', scaleType: 'cover' };

        await ScreenBackgroundManager.handleBackgroundSelecting(
            new MouseEvent('click') as any,
            'image',
            data as any,
        );
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Failed to apply to screen. Please make sure the screen is open.',
            'Error',
        );
        expect(applySpy).toHaveBeenCalledWith('image', data);
        manager.delete();
    });

    test('a video whose size cannot be read is put up without one', async () => {
        const failure = new Error('cannot decode');
        mocks.getVideoDim.mockRejectedValueOnce(failure);
        const backgroundSrc =
            await ScreenBackgroundManager.initBackgroundSrcDim(
                '/v/broken.mp4',
                'video',
            );
        expect(backgroundSrc).toEqual({ type: 'video', src: '/v/broken.mp4' });
        expect(mocks.handleError).toHaveBeenCalledWith(failure);

        // Neither an image nor a video: no size to look for.
        await expect(
            ScreenBackgroundManager.extractDim({
                type: 'color',
                src: '#000000',
            } as any),
        ).resolves.toEqual([undefined, undefined]);
    });

    test('on the projected screen a background clip reports its time to the presenter', async () => {
        vi.useFakeTimers();
        mocks.appProvider.isPageScreen = true;
        const base = createScreenManagerBase(329);
        const manager = new ScreenBackgroundManager(
            base,
            createEffectManager(),
        );
        const container = document.createElement('div');
        const video = document.createElement('video');
        video.id = 'video-loop';
        Object.defineProperties(video, {
            currentTime: { configurable: true, writable: true, value: 12 },
            duration: { configurable: true, writable: true, value: 120 },
        });
        container.appendChild(video);
        const fadeSpy = vi
            .spyOn(manager, '_fadeOverVideoLoop')
            .mockResolvedValue(undefined);
        manager._handleBackgroundVideo(container);
        expect(video.dataset.ignoreMediaGuarding).toBe('true');

        video.dispatchEvent(new Event('timeupdate'));
        await vi.advanceTimersByTimeAsync(0);
        expect(base.sendScreenMessage).toHaveBeenCalledWith(
            {
                screenId: 329,
                type: 'background-video-time',
                data: expect.objectContaining({
                    videoId: 'video-loop',
                    videoTime: 12,
                    isFromScreen: true,
                }),
            },
            true,
        );
        // Fading at the end is off: no crossfade, however near the end.
        (video as any).currentTime = 119;
        video.dispatchEvent(new Event('timeupdate'));
        await vi.advanceTimersByTimeAsync(0);
        expect(fadeSpy).not.toHaveBeenCalled();
    });

    test('the crossfade gives up when there is no root or no clip to copy', async () => {
        const manager = new ScreenBackgroundManager(
            createScreenManagerBase(330),
            createEffectManager(),
        );
        const container = document.createElement('div');
        const video = document.createElement('video');
        video.id = 'video-a';
        container.appendChild(video);
        expect(manager._ensureVideoLoopTwin(container, video)).toBeNull();

        const root = document.createElement('div');
        document.body.appendChild(root);
        vi.spyOn(manager, 'rootContainer', 'get').mockReturnValue(root as any);
        // Not a background clip (no `video-` id): nothing to make a twin of.
        const plain = document.createElement('div');
        const plainVideo = document.createElement('video');
        plainVideo.id = 'clip';
        plain.appendChild(plainVideo);
        root.appendChild(plain);
        expect(manager._ensureVideoLoopTwin(plain, plainVideo)).toBeNull();
        await manager._fadeOverVideoLoop(plain, plainVideo);
        const { animIn } = (manager as any).effectManager.styleAnimList.fade;
        expect(animIn).not.toHaveBeenCalled();
        expect(root.children).toHaveLength(1);
        root.remove();
    });

    test('the crossfade stops when the background left while the copy got ready', async () => {
        const effectManager = createEffectManager();
        const manager = new ScreenBackgroundManager(
            createScreenManagerBase(331),
            effectManager,
        );
        const root = document.createElement('div');
        document.body.appendChild(root);
        vi.spyOn(manager, 'rootContainer', 'get').mockReturnValue(root as any);
        const container = document.createElement('div');
        const video = document.createElement('video');
        video.id = 'video-left';
        container.appendChild(video);
        root.appendChild(container);
        vi.spyOn(manager, '_waitForVideoPicture').mockImplementation(
            async () => {
                // The operator swapped the background meanwhile.
                container.remove();
            },
        );

        await manager._fadeOverVideoLoop(container, video);
        expect(effectManager.styleAnimList.fade.animIn).not.toHaveBeenCalled();
        expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
        root.remove();
    });

    test('the clip that ended is not parked when its copy was taken away mid-fade', async () => {
        const effectManager = createEffectManager();
        effectManager.styleAnimList.fade.animIn = vi.fn(
            async (element: HTMLElement) => {
                element.remove();
            },
        );
        const manager = new ScreenBackgroundManager(
            createScreenManagerBase(332),
            effectManager,
        );
        const root = document.createElement('div');
        document.body.appendChild(root);
        vi.spyOn(manager, 'rootContainer', 'get').mockReturnValue(root as any);
        const container = document.createElement('div');
        container.style.opacity = '0.8';
        const video = document.createElement('video');
        video.id = 'video-mid';
        // Its own, so the copy (which uses the prototype's) is told apart.
        const pauseEnded = vi.fn();
        video.pause = pauseEnded;
        container.appendChild(video);
        root.appendChild(container);

        await manager._fadeOverVideoLoop(container, video);
        expect(effectManager.styleAnimList.fade.animIn).toHaveBeenCalled();
        // Still the one on screen: neither paused nor hidden.
        expect(container.style.opacity).toBe('0.8');
        expect(pauseEnded).not.toHaveBeenCalled();
        root.remove();
    });

    test('the copy coming in leaves the way the background came in', async () => {
        const effectManager = createEffectManager();
        effectManager.styleAnimList.fade.animIn = vi.fn(
            async (element: HTMLElement, parent: HTMLElement) => {
                parent.appendChild(element);
            },
        );
        const manager = new ScreenBackgroundManager(
            createScreenManagerBase(333),
            effectManager,
        );
        vi.spyOn(manager, 'render').mockImplementation(() => {});
        const root = document.createElement('div');
        document.body.appendChild(root);
        vi.spyOn(manager, 'rootContainer', 'get').mockReturnValue(root as any);

        // Came in with a fade: the copy is tagged the same.
        const container = document.createElement('div');
        container.dataset.owaTransition = 'fade';
        const video = document.createElement('video');
        video.id = 'video-tagged';
        container.appendChild(video);
        root.appendChild(container);
        await manager._fadeOverVideoLoop(container, video);
        const twin = root.lastElementChild as HTMLElement;
        expect(twin).not.toBe(container);
        expect(twin.dataset.owaTransition).toBe('fade');

        // Came in zoomed, inside a zoom wrapper: the wrapper is the node in
        // the root, and a plain copy is not tagged with a zoom it cannot do.
        root.replaceChildren();
        const wrapper = document.createElement('div');
        wrapper.className = 'zoom-container';
        wrapper.dataset.owaTransition = 'zoom';
        const zoomed = document.createElement('div');
        const zoomedVideo = document.createElement('video');
        zoomedVideo.id = 'video-zoomed';
        zoomed.appendChild(zoomedVideo);
        wrapper.appendChild(zoomed);
        root.appendChild(wrapper);
        expect(manager._toRootLevelNode(zoomedVideo)).toBe(wrapper);
        await manager._fadeOverVideoLoop(zoomed, zoomedVideo);
        const plainTwin = root.lastElementChild as HTMLElement;
        expect(plainTwin).not.toBe(wrapper);
        expect(plainTwin.dataset.owaTransition).toBeUndefined();
        // The wrapper, not the picture inside it, is what is parked.
        expect(wrapper.style.opacity).toBe('0');
        expect(zoomed.style.opacity).toBe('');
        root.remove();
    });

    test('a node outside the root is its own root-level node', () => {
        const manager = new ScreenBackgroundManager(
            createScreenManagerBase(334),
            createEffectManager(),
        );
        const root = document.createElement('div');
        vi.spyOn(manager, 'rootContainer', 'get').mockReturnValue(root as any);
        const loose = document.createElement('div');
        const child = document.createElement('span');
        loose.appendChild(child);
        expect(manager._toRootLevelNode(child)).toBe(child);
        // Inside the root, the child of the root that holds it.
        root.appendChild(loose);
        expect(manager._toRootLevelNode(child)).toBe(loose);
    });

    test('deleting a screen tears down its background without clearing the group', () => {
        const base = createScreenManagerBase(335);
        const manager = new ScreenBackgroundManager(
            base,
            createEffectManager(),
        );
        manager.backgroundSrc = { type: 'color', src: '#555555' } as any;
        const root = document.createElement('div');
        root.appendChild(document.createElement('div'));
        (manager as any)._rootContainer = root;
        const clearTracks = vi.fn();
        manager.clearTracks = clearTracks;
        const clearSpy = vi.spyOn(manager, 'clear');
        mocks.setSetting.mockClear();

        manager.delete();

        expect(clearTracks).toHaveBeenCalledTimes(1);
        expect(root.childElementCount).toBe(0);
        expect(manager.rootContainer).toBeNull();
        expect(manager.backgroundSrc).toBeNull();
        expect(clearSpy).not.toHaveBeenCalled();
        expect(mocks.setSetting).not.toHaveBeenCalled();
        expect(ScreenBackgroundManager.getInstance(335)).toBeNull();
        // The camera is stopped once: what is left is a no-op.
        expect(manager.clearTracks).not.toBe(clearTracks);
        manager.clearTracks();
        expect(clearTracks).toHaveBeenCalledTimes(1);
    });
});
