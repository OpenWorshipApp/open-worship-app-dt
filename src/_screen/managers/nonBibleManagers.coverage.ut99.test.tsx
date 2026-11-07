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
            fontFamily: expect.stringMatching(
                /^app-Google-Sans, system-ui, .*sans-serif/,
            ),
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

    test('a camera taken off while it is still opening is closed once it opens', async () => {
        const manager = new ScreenForegroundManager(
            createScreenManagerBase(613),
            createEffectManager(),
        );
        const lateClearTracks = vi.fn();
        let finishOpening: (clearTracks: () => void) => void = () => {};
        mocks.getCameraAndShowMedia.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finishOpening = resolve;
                }),
        );
        const slow = { deviceId: 'camera-1', label: 'Slow', extraStyle: {} };
        manager.renderCamera(slow as any);
        manager.removeDivContainer(slow);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(lateClearTracks).not.toHaveBeenCalled();

        finishOpening(lateClearTracks);
        await new Promise((resolve) => setTimeout(resolve, 0));
        // Nobody is left to close it later: the box is already gone.
        expect(lateClearTracks).toHaveBeenCalledOnce();

        // One that opened first is closed by the removal itself, once.
        const openedClearTracks = vi.fn();
        mocks.getCameraAndShowMedia.mockImplementationOnce(
            async () => openedClearTracks,
        );
        const quick = { deviceId: 'camera-2', label: 'Quick', extraStyle: {} };
        manager.renderCamera(quick as any);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(openedClearTracks).not.toHaveBeenCalled();
        manager.removeDivContainer(quick);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(openedClearTracks).toHaveBeenCalledOnce();
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

    test('a background already up, or a locked screen, changes nothing', () => {
        const base = createScreenManagerBase(501);
        const manager = new ScreenBackgroundManager(
            base,
            createEffectManager(),
        );
        manager.backgroundSrc = { type: 'color', src: '#101010' };
        base.sendScreenMessage.mockClear();
        mocks.setSetting.mockClear();

        manager.backgroundSrc = { type: 'color', src: '#101010' };
        expect(base.sendScreenMessage).not.toHaveBeenCalled();
        expect(mocks.setSetting).not.toHaveBeenCalled();

        base.checkIsLockedWithMessage.mockReturnValue(true);
        manager.backgroundSrc = { type: 'color', src: '#202020' };
        expect(manager.backgroundSrc).toEqual({
            type: 'color',
            src: '#101010',
        });
        expect(base.sendScreenMessage).not.toHaveBeenCalled();
        expect(mocks.setSetting).not.toHaveBeenCalled();
        manager.delete();
    });

    test('the presenter rebuilds an unreadable background map from the screens it holds', () => {
        mocks.appProvider.isPagePresenter = true;
        mocks.getBackgroundSrcListOnScreenSetting.mockReturnValue({
            502: { type: 'color', src: '#aaaaaa' },
        });
        const kept = new ScreenBackgroundManager(
            createScreenManagerBase(502),
            createEffectManager(),
        );
        const changing = new ScreenBackgroundManager(
            createScreenManagerBase(503),
            createEffectManager(),
        );
        expect(kept.backgroundSrc).toEqual({ type: 'color', src: '#aaaaaa' });
        mocks.getBackgroundSrcListOnScreenSetting.mockImplementation(
            () => ({}),
        );
        mocks.getSetting.mockImplementation((key: string) => {
            return key === 'screen-bg-manager' ? '{"502": {bro' : undefined;
        });

        changing.backgroundSrc = { type: 'color', src: '#bbbbbb' };

        expect(mocks.handleError).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining('rebuilding'),
            }),
        );
        const [, json] = mocks.setSetting.mock.calls
            .filter(([name]) => name === 'screen-bg-manager')
            .at(-1)!;
        const written = JSON.parse(json as string);
        expect(written['502']).toEqual({ type: 'color', src: '#aaaaaa' });
        expect(written['503']).toEqual({ type: 'color', src: '#bbbbbb' });
        kept.delete();
        changing.delete();
    });

    test('video time sync needs a root, and leaves a video in its fade alone', () => {
        const manager = new ScreenBackgroundManager(
            createScreenManagerBase(504),
            createEffectManager(),
        );
        const sync = {
            videoId: 'video-x',
            videoTime: 50,
            timestamp: Date.now(),
            isFromScreen: true,
        };
        // No root yet: nothing to move, and no throw.
        expect(() => manager.setVideoCurrentTime(sync)).not.toThrow();

        const genVideo = (currentTime: number) => {
            const video = document.createElement('video');
            video.id = 'video-x';
            Object.defineProperties(video, {
                currentTime: {
                    configurable: true,
                    writable: true,
                    value: currentTime,
                },
                duration: { configurable: true, writable: true, value: 120 },
            });
            return video;
        };
        const fadingIn = genVideo(1);
        const fadingOut = genVideo(118);
        const playing = genVideo(40);
        const root = document.createElement('div');
        root.append(fadingIn, fadingOut, playing);
        vi.spyOn(manager, 'rootContainer', 'get').mockReturnValue(root as any);
        // Its audio is paused: the screen's clock is the one to follow.
        const audio = document.createElement('audio');
        audio.dataset.videoId = 'video-x';
        document.body.appendChild(audio);

        manager.setVideoCurrentTime(sync);

        expect(fadingIn.currentTime).toBe(1);
        expect(fadingOut.currentTime).toBe(118);
        expect(playing.currentTime).toBeGreaterThanOrEqual(50);
        expect(playing.currentTime).toBeLessThan(51);
        manager.delete();
    });

    test('the presenter tells a virtual display page how its video sounds', () => {
        const base = createScreenManagerBase(505);
        const manager = new ScreenBackgroundManager(
            base,
            createEffectManager(),
        );
        manager.sendSyncVideoSound('video-a', true, 0.4);
        expect(base.sendScreenMessage).toHaveBeenCalledWith(
            {
                screenId: 505,
                type: 'background-video-sound',
                data: { videoId: 'video-a', isPlaying: true, volume: 0.4 },
            },
            true,
        );

        const receiveSound = vi.spyOn(manager, 'receiveSyncVideoSound');
        const receiveTime = vi.spyOn(manager, 'receiveSyncVideoTime');
        const message = {
            screenId: 505,
            type: 'background-video-sound',
            data: { videoId: 'video-a', isPlaying: false, volume: 1 },
        } as any;
        ScreenBackgroundManager.receiveSyncVideoSound(message);
        expect(receiveSound).toHaveBeenCalledWith(message);
        // For a screen that is not here: dropped.
        ScreenBackgroundManager.receiveSyncVideoSound({
            ...message,
            screenId: 9990,
        });
        ScreenBackgroundManager.receiveSyncVideoTime({
            screenId: 9990,
            type: 'background-video-time',
            data: { videoId: 'video-a', videoTime: 1 },
        } as any);
        expect(receiveSound).toHaveBeenCalledOnce();
        expect(receiveTime).not.toHaveBeenCalled();
        manager.delete();
    });

    test('a background picked for a closed screen is reported, the open one still gets it', async () => {
        const manager = new ScreenBackgroundManager(
            createScreenManagerBase(506),
            createEffectManager(),
        );
        vi.spyOn(ScreenBackgroundManager, 'chooseScreenIds').mockResolvedValue([
            9991, 506,
        ]);

        await ScreenBackgroundManager.handleBackgroundSelecting(
            new MouseEvent('click'),
            'color',
            { src: '#00ff00' } as any,
        );

        expect(mocks.showSimpleToast).toHaveBeenCalledOnce();
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Failed to apply to screen. Please make sure the screen is open.',
            'Error',
        );
        await vi.waitFor(() => {
            expect(manager.backgroundSrc).toEqual(
                expect.objectContaining({ type: 'color', src: '#00ff00' }),
            );
        });
        manager.delete();
    });

    test('a video whose size cannot be read still goes up, without one', async () => {
        mocks.getVideoDim.mockRejectedValueOnce(new Error('bad-video'));
        await expect(
            ScreenBackgroundManager.extractDim({
                type: 'video',
                src: '/bad.mp4',
            }),
        ).resolves.toEqual([undefined, undefined]);
        expect(mocks.handleError).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'bad-video' }),
        );
        // A web page, a camera or a colour has no size to read at all.
        await expect(
            ScreenBackgroundManager.extractDim({
                type: 'web',
                src: 'https://example.com',
            }),
        ).resolves.toEqual([undefined, undefined]);
        expect(mocks.getImageDim).not.toHaveBeenCalled();
        expect(mocks.getVideoDim).toHaveBeenCalledOnce();
    });

    test('the projector reports its video clock, and fades only in the last seconds', () => {
        mocks.appProvider.isPageScreen = true;
        const manager = new ScreenBackgroundManager(
            createScreenManagerBase(507),
            createEffectManager(),
        );
        const sendTime = vi
            .spyOn(manager, 'sendSyncVideoTime')
            .mockImplementation(() => {});
        const groupTime = vi.spyOn(
            manager,
            'setBackgroundVideoCurrentTimeForce',
        );
        const fade = vi
            .spyOn(manager, '_fadeOverVideoLoop')
            .mockResolvedValue(undefined);
        const container = document.createElement('div');
        const video = document.createElement('video');
        video.id = 'video-screen';
        Object.defineProperties(video, {
            currentTime: { configurable: true, writable: true, value: 30 },
            duration: { configurable: true, writable: true, value: 120 },
        });
        container.appendChild(video);
        mocks.getIsFadingAtTheEndSetting.mockReturnValue(false);

        manager._handleBackgroundVideo(container);
        expect(video.dataset.ignoreMediaGuarding).toBe('true');
        video.dispatchEvent(new Event('timeupdate'));
        expect(sendTime).toHaveBeenCalledWith('video-screen', 30, true);
        // The presenter's group sync is not the projector's to start.
        expect(groupTime).not.toHaveBeenCalled();
        expect(fade).not.toHaveBeenCalled();

        mocks.getIsFadingAtTheEndSetting.mockReturnValue(true);
        video.dispatchEvent(new Event('timeupdate'));
        expect(fade).not.toHaveBeenCalled();
        (video as any).currentTime = 118;
        video.dispatchEvent(new Event('timeupdate'));
        expect(fade).toHaveBeenCalledWith(container, video);
        // One fade per lap: the listener went with it.
        video.dispatchEvent(new Event('timeupdate'));
        expect(fade).toHaveBeenCalledOnce();
        manager.delete();
    });

    test('no loop twin without a root, or for a background with no video', async () => {
        const effectManager = createEffectManager();
        const manager = new ScreenBackgroundManager(
            createScreenManagerBase(508),
            effectManager,
        );
        const container = document.createElement('div');
        const video = document.createElement('video');
        video.id = 'video-loop';
        container.appendChild(video);
        expect(manager._ensureVideoLoopTwin(container, video)).toBeNull();

        const root = document.createElement('div');
        document.body.appendChild(root);
        vi.spyOn(manager, 'rootContainer', 'get').mockReturnValue(root as any);
        const bare = document.createElement('div');
        root.appendChild(bare);
        expect(manager._ensureVideoLoopTwin(bare, video)).toBeNull();
        expect(root.children).toHaveLength(1);

        await manager._fadeOverVideoLoop(bare, video);
        expect(effectManager.styleAnimList.fade.animIn).not.toHaveBeenCalled();
        expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
        root.remove();
        manager.delete();
    });

    test('a crossfade gives up when the background goes while the copy loads or fades in', async () => {
        const effectManager = createEffectManager();
        const manager = new ScreenBackgroundManager(
            createScreenManagerBase(509),
            effectManager,
        );
        const root = document.createElement('div');
        const container = document.createElement('div');
        const video = document.createElement('video');
        video.id = 'video-gone';
        container.appendChild(video);
        root.appendChild(container);
        document.body.appendChild(root);
        vi.spyOn(manager, 'rootContainer', 'get').mockReturnValue(root as any);
        let pictureReady: () => void = () => {};
        const wait = vi
            .spyOn(manager, '_waitForVideoPicture')
            .mockImplementation(() => {
                return new Promise<void>((resolve) => {
                    pictureReady = resolve;
                });
            });

        const fading = manager._fadeOverVideoLoop(container, video);
        // Swapped for another background while the copy's first frame loads.
        container.remove();
        pictureReady();
        await fading;
        expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
        expect(effectManager.styleAnimList.fade.animIn).not.toHaveBeenCalled();

        // This time the copy is taken away during its own fade-in.
        wait.mockResolvedValue(undefined);
        root.replaceChildren(container);
        container.style.opacity = '';
        effectManager.styleAnimList.fade.animIn = vi.fn(
            async (element: HTMLElement) => {
                element.remove();
            },
        );
        await manager._fadeOverVideoLoop(container, video);
        expect(effectManager.styleAnimList.fade.animIn).toHaveBeenCalledOnce();
        // The clip still showing is not parked behind a copy that is gone.
        expect(container.style.opacity).toBe('');
        expect(root.lastElementChild).toBe(container);
        root.remove();
        manager.delete();
    });

    test('the copy coming in leaves the way the background came in, and the wrapper is what parks', async () => {
        const effectManager = createEffectManager();
        effectManager.styleAnimList.fade.animIn = vi.fn(
            async (element: HTMLElement, parent: HTMLElement) => {
                parent.appendChild(element);
            },
        );
        const manager = new ScreenBackgroundManager(
            createScreenManagerBase(510),
            effectManager,
        );
        const genWrapped = (transition: string, isZoom: boolean) => {
            const root = document.createElement('div');
            const wrapper = document.createElement('div');
            wrapper.dataset.owaTransition = transition;
            if (isZoom) {
                wrapper.classList.add('zoom-container');
            }
            const container = document.createElement('div');
            const video = document.createElement('video');
            video.id = 'video-wrapped';
            container.appendChild(video);
            wrapper.appendChild(container);
            root.appendChild(wrapper);
            document.body.appendChild(root);
            return { root, wrapper, container, video };
        };
        const rootSpy = vi.spyOn(manager, 'rootContainer', 'get');

        const moved = genWrapped('move', false);
        rootSpy.mockReturnValue(moved.root as any);
        await manager._fadeOverVideoLoop(moved.container, moved.video);
        const movedTwin = moved.root.lastElementChild as HTMLElement;
        expect(movedTwin).not.toBe(moved.wrapper);
        expect(movedTwin.dataset.owaTransition).toBe('move');
        // The node in the root is parked, never the picture inside it.
        expect(moved.wrapper.style.opacity).toBe('0');
        expect(moved.container.style.opacity).toBe('');

        // A zoom needs its wrapper to zoom with; a plain copy has none.
        const zoomed = genWrapped('zoom', true);
        rootSpy.mockReturnValue(zoomed.root as any);
        await manager._fadeOverVideoLoop(zoomed.container, zoomed.video);
        const zoomedTwin = zoomed.root.lastElementChild as HTMLElement;
        expect(zoomedTwin).not.toBe(zoomed.wrapper);
        expect(zoomedTwin.dataset.owaTransition).toBeUndefined();
        expect(zoomed.wrapper.style.opacity).toBe('0');

        moved.root.remove();
        zoomed.root.remove();
        manager.delete();
    });

    test('a background sync reaches its screen; for a closed one it is said in English', () => {
        const manager = new ScreenBackgroundManager(
            createScreenManagerBase(511),
            createEffectManager(),
        );
        ScreenBackgroundManager.receiveSyncScreen({
            screenId: 511,
            type: 'background',
            data: { type: 'color', src: '#0000ff' },
        } as any);
        expect(manager.backgroundSrc).toEqual({
            type: 'color',
            src: '#0000ff',
        });

        ScreenBackgroundManager.receiveSyncScreen({
            screenId: 9992,
            type: 'background',
            data: null,
        } as any);
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Failed to apply to screen. Please make sure the screen is open.',
            'error',
        );
        manager.delete();
    });

    test('deleting a background screen tears it down locally', async () => {
        const base = createScreenManagerBase(512);
        const manager = new ScreenBackgroundManager(
            base,
            createEffectManager(),
        );
        manager.backgroundSrc = { type: 'camera', src: 'camera-1' };
        const root = document.createElement('div');
        manager.rootContainer = root;
        await flushVarySlideData();
        root.append(document.createElement('div'));
        const clearTracks = vi.fn();
        manager.clearTracks = clearTracks;
        base.sendScreenMessage.mockClear();
        mocks.setSetting.mockClear();
        // Like a real ScreenManagerBase's, the ghost can make a ghost too.
        base.createScreenManagerBaseGhost.mockImplementation(
            (targetScreenId: number) => ({
                screenId: targetScreenId,
                createScreenManagerBaseGhost: vi.fn(() => ({
                    screenId: targetScreenId,
                })),
            }),
        );

        manager.delete();

        expect(clearTracks).toHaveBeenCalledOnce();
        expect(root.children).toHaveLength(0);
        expect(manager.rootContainer).toBeNull();
        expect(manager.backgroundSrc).toBeNull();
        expect(ScreenBackgroundManager.getInstance(512)).toBeNull();
        expect(base.createScreenManagerBaseGhost).toHaveBeenCalledWith(512);
        // No broadcast to the colour group, nothing written.
        expect(base.sendScreenMessage).not.toHaveBeenCalled();
        expect(mocks.setSetting).not.toHaveBeenCalled();
        // A second teardown does not stop the camera twice.
        manager.delete();
        expect(clearTracks).toHaveBeenCalledOnce();
    });

    test('a clock change the widget can take is handed to it in place', async () => {
        const handleUpdating = vi.fn(() => true);
        const handleRemoving = vi.fn(async () => {});
        mocks.genCountdown.mockImplementation(() => ({
            handleAdding: (parent: HTMLElement) => {
                parent.appendChild(document.createElement('span'));
            },
            handleRemoving,
            handleUpdating,
        }));
        const manager = new ScreenForegroundManager(
            createScreenManagerBase(601),
            createEffectManager(),
        );
        const root = document.createElement('div');
        manager.rootContainer = root;
        const running = {
            dateTime: new Date(Date.now() + 60_000),
            extraStyle: {},
        };
        manager.setCountdownData(running as any);
        const container = root.firstElementChild;
        expect(container).not.toBeNull();

        const paused = { ...running, pausedMillisecond: 30_000 };
        manager.setCountdownData(paused as any);

        // Paused on the wall without a fade out and back in.
        expect(handleUpdating).toHaveBeenCalledWith(paused);
        expect(mocks.genCountdown).toHaveBeenCalledOnce();
        expect(handleRemoving).not.toHaveBeenCalled();
        expect(root.firstElementChild).toBe(container);
        expect(manager.foregroundData.countdownData).toBe(paused);

        // Hidden later, it is that same widget that comes down.
        manager.setCountdownData(null);
        await flushVarySlideData();
        expect(handleRemoving).toHaveBeenCalledOnce();
        expect(root.children).toHaveLength(0);
        manager.delete();
    });

    test('the presenter rebuilds an unreadable foreground map from the screens it holds', () => {
        mocks.appProvider.isPagePresenter = true;
        const keptMarquee = { text: 'kept', extraStyle: {} };
        mocks.getForegroundDataListOnScreenSetting.mockReturnValue({
            602: { marqueeTopData: keptMarquee },
        });
        const kept = new ScreenForegroundManager(
            createScreenManagerBase(602),
            createEffectManager(),
        );
        const changing = new ScreenForegroundManager(
            createScreenManagerBase(603),
            createEffectManager(),
        );
        mocks.getForegroundDataListOnScreenSetting.mockImplementation(
            () => ({}),
        );
        mocks.getSetting.mockImplementation((key: string) => {
            return key === 'screen-foreground-manager'
                ? '{"602": {bro'
                : undefined;
        });

        changing.setMarqueeTopData({ text: 'new', extraStyle: {} } as any);

        expect(mocks.handleError).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining('rebuilding'),
            }),
        );
        const [, json] = mocks.setSetting.mock.calls
            .filter(([name]) => name === 'screen-foreground-manager')
            .at(-1)!;
        const written = JSON.parse(json as string);
        expect(written['602'].marqueeTopData).toEqual(keptMarquee);
        expect(written['603'].marqueeTopData).toEqual({
            text: 'new',
            extraStyle: {},
        });
        kept.delete();
        changing.delete();
    });

    test('a message is replaced by its id, never stacked, and taken down by it', async () => {
        const base = createScreenManagerBase(604);
        const manager = new ScreenForegroundManager(
            base,
            createEffectManager(),
        );
        const toIds = () => {
            return manager.foregroundData.messageDataList.map(
                ({ id }: any) => id,
            );
        };
        const first = {
            id: 'm1',
            textList: ['Welcome'],
            intervalSecond: null,
            extraStyle: {},
        };
        manager.addMessageData(first as any);
        expect(manager.foregroundData.messageDataList).toEqual([first]);
        base.sendScreenMessage.mockClear();

        // Pressing Show again on the same message is no change at all.
        manager.addMessageData({ ...first } as any);
        expect(base.sendScreenMessage).not.toHaveBeenCalled();

        const edited = { ...first, textList: ['Welcome back'] };
        manager.addMessageData(edited as any);
        expect(manager.foregroundData.messageDataList).toEqual([edited]);
        manager.addMessageData({ ...first, id: 'm2' } as any);
        expect(toIds()).toEqual(['m1', 'm2']);
        manager.removeMessageData('m1');
        expect(toIds()).toEqual(['m2']);

        vi.spyOn(ScreenForegroundManager, 'chooseScreenIds').mockResolvedValue([
            604,
        ]);
        await ScreenForegroundManager.addMessageData(new MouseEvent('click'), {
            ...first,
            id: 'm3',
        } as any);
        await vi.waitFor(() => {
            expect(toIds()).toEqual(['m2', 'm3']);
        });
        expect(base.sendScreenMessage).toHaveBeenLastCalledWith(
            expect.objectContaining({ screenId: 604, type: 'foreground' }),
            false,
        );
        manager.delete();
    });

    test('a quick text takes itself down when its time is up', async () => {
        const manager = new ScreenForegroundManager(
            createScreenManagerBase(605),
            createEffectManager(),
        );
        manager.rootContainer = document.createElement('div');
        const quickText = {
            htmlText: '<p>Now</p>',
            timeSecondDelay: 0,
            timeSecondToLive: 5,
            extraStyle: {},
        };
        manager.setQuickTextData(quickText as any);
        const call = mocks.genQuickText.mock.calls.find(([data]) => {
            return data === quickText;
        }) as any[];
        expect(call).toBeDefined();
        const { handleRemoving } =
            mocks.genQuickText.mock.results[
                mocks.genQuickText.mock.calls.indexOf(call)
            ].value;

        call[2]();

        expect(manager.foregroundData.quickTextData).toBeNull();
        expect(handleRemoving).toHaveBeenCalledOnce();
        manager.delete();
    });

    test('a camera hidden before it opened takes its box away', async () => {
        mocks.getCameraAndShowMedia.mockImplementation(() => {
            return new Promise(() => {});
        });
        const manager = new ScreenForegroundManager(
            createScreenManagerBase(606),
            createEffectManager(),
        );
        const root = document.createElement('div');
        manager.rootContainer = root;
        const camera = { id: 'cam-1', label: 'Cam', extraStyle: {} };
        manager.addCameraData(camera as any);
        expect(root.children).toHaveLength(1);

        manager.removeCameraData({ ...camera } as any);
        await flushVarySlideData();

        expect(root.children).toHaveLength(0);
        expect(manager.foregroundData.cameraDataList).toEqual([]);
        manager.delete();
    });

    test('Show Screen, video and image are added once and taken down by the panel', async () => {
        const base = createScreenManagerBase(607);
        base.sendScreenShowSnapshots = vi.fn();
        const manager = new ScreenForegroundManager(
            base,
            createEffectManager(),
        );
        const video = { src: '/clip.mp4', extraStyle: {} };
        const image = { src: '/logo.png', extraStyle: {} };
        manager.addVideoData(video as any);
        manager.addVideoData({ ...video } as any);
        manager.addImageData(image as any);
        manager.addImageData({ ...image } as any);
        expect(manager.foregroundData.videoDataList).toEqual([video]);
        expect(manager.foregroundData.imageDataList).toEqual([image]);
        manager.removeVideoData({ ...video } as any);
        manager.removeImageData({ ...image } as any);
        expect(manager.foregroundData.videoDataList).toEqual([]);
        expect(manager.foregroundData.imageDataList).toEqual([]);

        vi.spyOn(ScreenForegroundManager, 'chooseScreenIds').mockResolvedValue([
            607,
        ]);
        const event = new MouseEvent('click');
        await ScreenForegroundManager.addVideoData(event, video as any);
        await ScreenForegroundManager.addImageData(event, image as any);
        await ScreenForegroundManager.addScreenData(event, { id: 608 } as any);
        await vi.waitFor(() => {
            expect(manager.foregroundData.videoDataList).toEqual([video]);
            expect(manager.foregroundData.imageDataList).toEqual([image]);
            expect(manager.foregroundData.screenDataList).toEqual([
                { id: 608 },
            ]);
        });

        await ScreenForegroundManager.removeVideoData(event, video as any);
        await ScreenForegroundManager.removeImageData(event, image as any);
        await ScreenForegroundManager.removeScreenData(event, {
            id: 608,
        } as any);
        await vi.waitFor(() => {
            expect(manager.foregroundData.videoDataList).toEqual([]);
            expect(manager.foregroundData.imageDataList).toEqual([]);
            expect(manager.foregroundData.screenDataList).toEqual([]);
        });
        expect(manager.isShowing).toBe(false);
        manager.delete();
    });

    test('a locked screen keeps its foreground', () => {
        const base = createScreenManagerBase(609);
        const manager = new ScreenForegroundManager(
            base,
            createEffectManager(),
        );
        base.checkIsLockedWithMessage.mockReturnValue(true);

        manager.setMarqueeTopData({ text: 'refused', extraStyle: {} } as any);

        expect(manager.foregroundData.marqueeTopData).toBeNull();
        expect(base.sendScreenMessage).not.toHaveBeenCalled();
        expect(mocks.setSetting).not.toHaveBeenCalled();
        manager.delete();
    });
});
