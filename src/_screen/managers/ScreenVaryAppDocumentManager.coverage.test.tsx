// @vitest-environment jsdom

import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    class FakeSlideYouTubePlayer {
        static instances: FakeSlideYouTubePlayer[] = [];
        readonly iframe: HTMLIFrameElement;
        readonly id: string;
        readonly callbacks: any;
        readonly options: any;
        isPlaying = false;
        pausedBySync = false;
        currentTime = 0;
        readonly mute = vi.fn();
        readonly play = vi.fn();
        readonly pause = vi.fn();
        readonly seekTo = vi.fn();
        readonly destroy = vi.fn();

        constructor(
            iframe: HTMLIFrameElement,
            id: string,
            callbacks: any,
            options: any = {},
        ) {
            this.iframe = iframe;
            this.id = id;
            this.callbacks = callbacks;
            this.options = options;
            FakeSlideYouTubePlayer.instances.push(this);
        }

        getCurrentTime() {
            return this.currentTime;
        }
    }
    return {
        FakeSlideYouTubePlayer,
        getSetting: vi.fn(),
        setSetting: vi.fn(),
        getAppDocumentListOnScreenSetting: vi.fn(() => ({})),
        applyAttachBackground: vi.fn(),
        registerScrollingSyncEvent: vi.fn(),
        // ids end up inside a `video#<id>` CSS selector, so they must be
        // selector-safe exactly like the real `genVideoIDFromSrc` hash
        genVideoIDFromSrc: vi.fn(
            (src: string) => `video-${src.replace(/\W/g, '')}`,
        ),
        genPdfSlide: vi.fn(),
        genPptxSlide: vi.fn(),
        genDocxSlide: vi.fn(),
        genSlideHtml: vi.fn(),
        getBibleFontFamily: vi.fn(async () => 'TestFont'),
        showSimpleToast: vi.fn(),
        playMediaElement: vi.fn(),
        checkMediaPlaying: vi.fn(() => false),
        handleMediaPlaying: vi.fn(),
        handleMediaStopped: vi.fn(),
        checkIsYouTubeSyncIframe: vi.fn((iframe: HTMLIFrameElement) => {
            return (iframe.getAttribute('src') ?? '').includes('youtube.com');
        }),
        genYouTubeSyncId: vi.fn((iframe: HTMLIFrameElement) => {
            return `yt-${(iframe.getAttribute('src') ?? '').replace(/\W/g, '')}`;
        }),
        unlocking: vi.fn((_key: string, callback: () => unknown) => callback()),
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
                basename: (value: string) =>
                    value.split(/[\\/]/).at(-1) ?? value,
                join: (...parts: string[]) => parts.join('/'),
                resolve: (...parts: string[]) => parts.join('/'),
                sep: '/',
            },
            systemUtils: { isDev: false },
            messageUtils: {
                listenForData: vi.fn(),
                sendData: vi.fn(),
            },
        },
    };
});

vi.mock('../../helper/settingHelpers', () => ({
    getSetting: mocks.getSetting,
    setSetting: mocks.setSetting,
}));

vi.mock('../../server/appProvider', () => ({
    default: mocks.appProvider,
}));

vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: mocks.unlocking,
}));

vi.mock('../preview/screenPreviewerHelpers', () => ({
    getAppDocumentListOnScreenSetting: mocks.getAppDocumentListOnScreenSetting,
}));

vi.mock('../../app-document-list/appDocumentHelpers', () => ({
    BLANK_HTML_SLIDE_SRC: '/assets/slide0.html',
    BLANK_IMAGE_SLIDE_SRC: '/assets/blank.png',
    toKeyByFilePath: mocks.toKeyByFilePath,
}));

vi.mock('../screenHelpers', () => ({
    genVideoIDFromSrc: mocks.genVideoIDFromSrc,
}));

vi.mock('./slideYouTubeSyncHelpers', () => ({
    checkIsYouTubeSyncIframe: mocks.checkIsYouTubeSyncIframe,
    genYouTubeSyncId: mocks.genYouTubeSyncId,
    SlideYouTubePlayer: mocks.FakeSlideYouTubePlayer,
}));

vi.mock('../../helper/mediaHelpers', () => ({
    playMediaElement: mocks.playMediaElement,
}));

vi.mock('../../helper/mediaControlHelpers', async (importOriginal) => ({
    ...((await importOriginal()) as any),
    checkMediaPlaying: mocks.checkMediaPlaying,
    handleMediaPlaying: mocks.handleMediaPlaying,
    handleMediaStopped: mocks.handleMediaStopped,
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
    getBibleFontFamily: mocks.getBibleFontFamily,
}));

vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: mocks.showSimpleToast,
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
    default: { getInstance: mocks.pptxGetInstance },
}));

vi.mock('../../app-document-list/DocxAppDocument', () => ({
    default: { getInstance: mocks.docxGetInstance },
}));

let varyModule: any;
let ScreenVaryAppDocumentManager: any;

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
    } as any;
}

// jsdom's HTMLMediaElement has no playback engine: `paused` is a read-only
// getter and `currentTime`/`pause()` are not implemented, so each test media
// element gets its state stubbed in.
function createMedia(
    tagName: 'video' | 'audio',
    {
        src = '',
        paused = true,
        currentTime = 0,
    }: { src?: string; paused?: boolean; currentTime?: number } = {},
) {
    const media = document.createElement(tagName);
    if (src) {
        media.setAttribute('src', src);
    }
    Object.defineProperties(media, {
        paused: { configurable: true, writable: true, value: paused },
        currentTime: { configurable: true, writable: true, value: currentTime },
        pause: { configurable: true, writable: true, value: vi.fn() },
        play: { configurable: true, writable: true, value: vi.fn() },
    });
    return media;
}

function createIframe(src: string) {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('src', src);
    return iframe;
}

function detachAllManagerDivs() {
    for (const manager of ScreenVaryAppDocumentManager.getAllInstances()) {
        manager.div = null;
    }
}

describe('ScreenVaryAppDocumentManager coverage', () => {
    beforeAll(async () => {
        varyModule = await import('./ScreenVaryAppDocumentManager');
        ScreenVaryAppDocumentManager = varyModule.default;
    });

    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
        mocks.FakeSlideYouTubePlayer.instances.length = 0;
        mocks.appProvider.isPagePresenter = false;
        mocks.appProvider.isPageScreen = false;
        mocks.appProvider.getIsMouseOverApp.mockReturnValue(true);
        mocks.appProvider.getIsWindowFocused.mockReturnValue(true);
        mocks.getSetting.mockReturnValue(undefined);
        mocks.getAppDocumentListOnScreenSetting.mockReturnValue({});
        mocks.checkMediaPlaying.mockReturnValue(false);
        mocks.genVideoIDFromSrc.mockImplementation(
            (src: string) => `video-${src.replace(/\W/g, '')}`,
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
        mocks.getBibleFontFamily.mockResolvedValue('TestFont');
        mocks.pdfTryValidate.mockImplementation(
            (item: any) => item?.kind === 'pdf',
        );
        mocks.pptxTryValidate.mockImplementation(
            (item: any) => item?.kind === 'pptx',
        );
        mocks.docxTryValidate.mockImplementation(
            (item: any) => item?.kind === 'docx',
        );
        mocks.pptxCheckIsThisType.mockReturnValue(false);
        mocks.docxCheckIsThisType.mockReturnValue(false);
        mocks.unlocking.mockImplementation(
            (_key: string, callback: () => unknown) => callback(),
        );
    });

    test('restores the persisted slide for the presenter window', () => {
        mocks.appProvider.isPagePresenter = true;
        const persisted = {
            filePath: '/slides/a.slide',
            itemJson: { id: 1 },
            isRenderFullWidth: false,
        };
        mocks.getAppDocumentListOnScreenSetting.mockReturnValue({
            61: persisted,
        });

        const manager = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(61),
            createEffectManager(),
        );
        expect(manager.varySlideData).toEqual(persisted);
        expect(manager.isShowing).toBe(true);

        // no persisted entry for this screen id
        const other = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(62),
            createEffectManager(),
        );
        expect(other.varySlideData).toBeNull();
        expect(other.isShowing).toBe(false);
    });

    test('drops the virtual background color for blank slides', () => {
        const manager = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(63),
            createEffectManager(),
        );

        manager.varySlideData = {
            filePath: '/slides/blank.slide',
            itemJson: { id: 1, htmlFilePath: '/assets/slide0.html' },
            isRenderFullWidth: false,
            virtualBackgroundColor: '#123456',
        };
        expect(manager.varySlideData?.virtualBackgroundColor).toBeNull();

        manager.varySlideData = {
            filePath: '/slides/blank.slide',
            itemJson: { id: 2, imagePreviewSrc: '/assets/blank.png' },
            isRenderFullWidth: false,
            virtualBackgroundColor: '#123456',
        };
        expect(manager.varySlideData?.virtualBackgroundColor).toBeNull();

        // a real slide keeps its color
        manager.varySlideData = {
            filePath: '/slides/real.slide',
            itemJson: { id: 3, htmlFilePath: '/slides/real.html' },
            isRenderFullWidth: false,
            virtualBackgroundColor: '#123456',
        };
        expect(manager.varySlideData?.virtualBackgroundColor).toBe('#123456');
        expect(mocks.applyAttachBackground).toHaveBeenCalledWith(
            63,
            '/slides/real.slide',
            3,
        );
    });

    test('a locked screen never swaps its slide', () => {
        const base = createScreenManagerBase(64);
        base.checkIsLockedWithMessage.mockReturnValue(true);
        const manager = new ScreenVaryAppDocumentManager(
            base,
            createEffectManager(),
        );

        manager.varySlideData = {
            filePath: '/slides/a.slide',
            itemJson: { id: 1 },
            isRenderFullWidth: false,
        };

        expect(manager.varySlideData).toBeNull();
        expect(mocks.setSetting).not.toHaveBeenCalled();
    });

    test('playing media blocks a slide swap on the presenter but not a clear', () => {
        const manager = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(65),
            createEffectManager(),
        );
        // `checkIsMediaPlaying` only inspects a mounted container
        manager.div = document.createElement('div');
        const metadata = { width: 640, height: 360 };
        manager.varySlideData = {
            filePath: '/slides/a.slide',
            itemJson: { id: 1, canvasItems: [], metadata },
            isRenderFullWidth: false,
        };
        mocks.checkMediaPlaying.mockReturnValue(true);

        manager.varySlideData = {
            filePath: '/slides/b.slide',
            itemJson: { id: 2, canvasItems: [], metadata },
            isRenderFullWidth: false,
        };
        expect(manager.varySlideData?.filePath).toBe('/slides/a.slide');

        // an explicit stop must still go through
        manager.varySlideData = null;
        expect(manager.varySlideData).toBeNull();

        // the projected screen always follows a sync update
        mocks.appProvider.isPageScreen = true;
        manager.varySlideData = {
            filePath: '/slides/c.slide',
            itemJson: { id: 3, canvasItems: [], metadata },
            isRenderFullWidth: false,
        };
        expect(manager.varySlideData?.filePath).toBe('/slides/c.slide');

        manager.div = null;
    });

    test('exposes empty group membership by default', async () => {
        const manager = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(66),
            createEffectManager(),
        );

        await expect(manager.getMemberInstances()).resolves.toEqual([]);
        await expect(manager.getMemberIds()).resolves.toEqual([]);
        await expect(manager.checkIsMainInstance()).resolves.toBe(false);
    });

    test('media lookups and playing checks are no-ops without a container', () => {
        const manager = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(67),
            createEffectManager(),
        );

        expect(manager.getMediaElements('video-1')).toEqual([]);
        expect(manager.checkIsMediaPlaying()).toBe(false);
        expect(() => {
            manager.setVideoCurrentTime({
                videoId: 'video-1',
                videoTime: 3,
                timestamp: Date.now(),
                isPlaying: true,
            });
        }).not.toThrow();
    });

    test('the projected screen mirrors the play state of a slide video', () => {
        const manager = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(68),
            createEffectManager(),
        );
        const host = document.createElement('div');
        const pausedVideo = createMedia('video', { paused: true });
        pausedVideo.id = 'video-a';
        host.appendChild(pausedVideo);
        manager.div = host;
        mocks.appProvider.isPageScreen = true;

        manager.setVideoCurrentTime({
            videoId: 'video-a',
            videoTime: 12,
            timestamp: Date.now(),
            isPlaying: true,
        });
        expect(mocks.playMediaElement).toHaveBeenCalledWith(pausedVideo);
        expect(pausedVideo.currentTime).toBeGreaterThanOrEqual(12);

        (pausedVideo as any).paused = false;
        manager.setVideoCurrentTime({
            videoId: 'video-a',
            videoTime: 12,
            timestamp: Date.now(),
            isPlaying: false,
        });
        expect(pausedVideo.pause).toHaveBeenCalledTimes(1);
        // a paused follower uses the raw time with no latency compensation
        expect(pausedVideo.currentTime).toBeCloseTo(12, 1);

        manager.div = null;
    });

    test('a YouTube embed follows the same play/seek sync as a slide video', () => {
        const manager = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(69),
            createEffectManager(),
        );
        const host = document.createElement('div');
        manager.div = host;
        mocks.appProvider.isPageScreen = true;

        const content = document.createElement('div');
        content.appendChild(createIframe('https://www.youtube.com/embed/x'));
        manager.cleanupSlideContent(content);
        const [player] = mocks.FakeSlideYouTubePlayer.instances;
        expect(player.options).toEqual({ muteOnReady: true });

        // an unknown video id matches no player
        manager.setVideoCurrentTime({
            videoId: 'missing',
            videoTime: 1,
            timestamp: Date.now(),
            isPlaying: true,
        });
        expect(player.play).not.toHaveBeenCalled();

        manager.setVideoCurrentTime({
            videoId: player.id,
            videoTime: 30,
            timestamp: Date.now(),
            isPlaying: true,
        });
        expect(player.mute).toHaveBeenCalledTimes(1);
        expect(player.play).toHaveBeenCalledTimes(1);
        expect(player.seekTo).toHaveBeenCalledTimes(1);

        player.isPlaying = true;
        player.currentTime = 30;
        manager.setVideoCurrentTime({
            videoId: player.id,
            videoTime: 30,
            timestamp: Date.now(),
            isPlaying: false,
        });
        expect(player.pause).toHaveBeenCalledTimes(1);
        // still within the seek threshold, so no re-buffering seek
        expect(player.seekTo).toHaveBeenCalledTimes(1);
    });

    test('force-sync broadcasts and applies the time locally', () => {
        const manager = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(70),
            createEffectManager(),
        );
        const sendSpy = vi.spyOn(manager, 'sendSyncVideoTime');
        const applySpy = vi.spyOn(manager, 'setVideoCurrentTime');

        manager.setVideoCurrentTimeForce('video-a', 5, true);

        expect(sendSpy).toHaveBeenCalledWith('video-a', 5, true);
        expect(applySpy).toHaveBeenCalledWith(
            expect.objectContaining({
                videoId: 'video-a',
                videoTime: 5,
                isPlaying: true,
            }),
        );
    });

    test('receiveSyncVideoTime ignores foreign and malformed messages', () => {
        const manager = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(71),
            createEffectManager(),
        );
        const applySpy = vi
            .spyOn(manager, 'setVideoCurrentTime')
            .mockImplementation(() => {});

        manager.receiveSyncVideoTime({
            screenId: 999,
            type: 'vary-app-document-video-time',
            data: {},
        } as any);
        expect(applySpy).not.toHaveBeenCalled();

        const invalidDataList = [
            { videoId: '', videoTime: 1, timestamp: 1, isPlaying: true },
            { videoId: 'v', videoTime: '1', timestamp: 1, isPlaying: true },
            { videoId: 'v', videoTime: 1, timestamp: '1', isPlaying: true },
            { videoId: 'v', videoTime: 1, timestamp: 1, isPlaying: 'yes' },
        ];
        for (const data of invalidDataList) {
            manager.receiveSyncVideoTime({
                screenId: 71,
                type: 'vary-app-document-video-time',
                data,
            } as any);
        }
        expect(applySpy).not.toHaveBeenCalled();

        const validData = {
            videoId: 'v',
            videoTime: 1,
            timestamp: 1,
            isPlaying: true,
        };
        manager.receiveSyncVideoTime({
            screenId: 71,
            type: 'vary-app-document-video-time',
            data: validData,
        } as any);
        expect(applySpy).toHaveBeenCalledWith(validData);

        // the static entry point routes by screen id
        ScreenVaryAppDocumentManager.receiveSyncVideoTime({
            screenId: 71,
            type: 'vary-app-document-video-time',
            data: validData,
        } as any);
        expect(applySpy).toHaveBeenCalledTimes(2);

        expect(() => {
            ScreenVaryAppDocumentManager.receiveSyncVideoTime({
                screenId: 9999,
                type: 'vary-app-document-video-time',
                data: validData,
            } as any);
        }).not.toThrow();
    });

    test('getDataList filters by file path and slide id', () => {
        mocks.getAppDocumentListOnScreenSetting.mockReturnValue({
            1: { filePath: '/a.slide', itemJson: { id: 1 } },
            2: { filePath: '/b.slide', itemJson: { id: 2 } },
        });

        expect(ScreenVaryAppDocumentManager.getDataList()).toHaveLength(2);
        expect(
            ScreenVaryAppDocumentManager.getDataList(undefined, 999),
        ).toEqual([]);
        expect(
            ScreenVaryAppDocumentManager.getDataList('/b.slide', 2),
        ).toHaveLength(1);
    });

    test('selecting a slide for a closed screen reports the failure', async () => {
        vi.spyOn(
            ScreenVaryAppDocumentManager,
            'chooseScreenIds',
        ).mockResolvedValue([98765]);

        await ScreenVaryAppDocumentManager.handleSlideSelecting(
            new MouseEvent('click') as any,
            '/slides/a.slide',
            { id: 1 } as any,
        );

        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Failed to sync slide. Please make sure the screen is open.',
            'error',
        );
    });

    test('renderPdf sizes the page box and paints the virtual background', () => {
        const manager = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(72),
            createEffectManager(),
        );

        expect(
            manager.renderPdf(
                document.createElement('div'),
                { imagePreviewSrc: '', metadata: { width: 0, height: 0 } },
                false,
                null,
            ),
        ).toBeNull();

        const pageDiv = document.createElement('div');
        const pageContent = document.createElement('div');
        mocks.genPdfSlide.mockReturnValue(pageContent);
        const pageResult = manager.renderPdf(
            pageDiv,
            {
                imagePreviewSrc: '/preview.png',
                metadata: { width: 640, height: 360 },
            },
            false,
            '#101010',
        );
        expect(pageContent.style.backgroundColor).toBe('rgb(16, 16, 16)');
        expect(pageDiv.style.width).toBe('640px');
        expect(pageResult?.scale).toBe(2);

        const fullDiv = document.createElement('div');
        const fullContent = document.createElement('div');
        mocks.genPdfSlide.mockReturnValue(fullContent);
        const fullResult = manager.renderPdf(
            fullDiv,
            {
                imagePreviewSrc: '/preview.png',
                metadata: { width: 640, height: 360 },
            },
            true,
            '#202020',
        );
        expect(fullContent.style.backgroundColor).toBe('rgb(32, 32, 32)');
        expect(fullDiv.style.overflow).toBe('auto');
        expect(fullResult?.scale).toBe(1);

        // a page with no usable size falls back to the stretched layout
        const unsizedDiv = document.createElement('div');
        mocks.genPdfSlide.mockReturnValue(document.createElement('div'));
        expect(
            manager.renderPdf(
                unsizedDiv,
                {
                    imagePreviewSrc: '/preview.png',
                    metadata: { width: 0, height: 0 },
                },
                false,
                null,
            )?.scale,
        ).toBe(1);
        expect(unsizedDiv.style.overflow).toBe('hidden');
    });

    test('renderDocx honors the full-width toggle and the virtual background', () => {
        const manager = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(73),
            createEffectManager(),
        );
        const docxData = {
            html: '<article>DOCX</article>',
            htmlFilePath: '/docx.html',
            metadata: { width: 640, height: 360 },
        };

        const fullContent = document.createElement('div');
        mocks.genDocxSlide.mockReturnValue(fullContent);
        const fullDiv = document.createElement('div');
        const fullResult = manager.renderDocx(
            fullDiv,
            docxData,
            true,
            '#303030',
        );
        expect(fullContent.style.backgroundColor).toBe('rgb(48, 48, 48)');
        expect(fullDiv.style.overflow).toBe('auto');
        expect(fullResult?.scale).toBe(1);

        mocks.genDocxSlide.mockReturnValue(document.createElement('div'));
        const pageDiv = document.createElement('div');
        expect(manager.renderDocx(pageDiv, docxData, false, null)?.scale).toBe(
            2,
        );
        expect(pageDiv.style.overflow).toBe('hidden');
    });

    test('playing one slide media stops every other playing media', async () => {
        detachAllManagerDivs();
        const manager = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(74),
            createEffectManager(),
        );
        const otherManager = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(75),
            createEffectManager(),
        );
        vi.spyOn(manager, 'setSlideVideoCurrentTimeForce').mockResolvedValue(
            undefined,
        );
        manager.getMemberInstances = vi.fn(async () => [otherManager]);

        const otherHost = document.createElement('div');
        const sameIdVideo = createMedia('video', {
            src: 'shared.mp4',
            paused: false,
        });
        const otherVideo = createMedia('video', {
            src: 'other.mp4',
            paused: false,
        });
        const pausedVideo = createMedia('video', { src: 'paused.mp4' });
        const fakeVideo = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'video',
        );
        otherHost.append(sameIdVideo, otherVideo, pausedVideo, fakeVideo);
        // ids are derived from the source, so both windows key the same file
        // identically — that is what makes it a "group copy"
        otherManager.cleanupSlideContent(otherHost);
        otherManager.div = otherHost;

        const otherYouTubeContent = document.createElement('div');
        otherYouTubeContent.append(
            createIframe('https://www.youtube.com/embed/shared'),
            createIframe('https://www.youtube.com/embed/idle'),
        );
        otherManager.cleanupSlideContent(otherYouTubeContent);
        const [sharedPlayer, idlePlayer] =
            mocks.FakeSlideYouTubePlayer.instances;
        sharedPlayer.isPlaying = true;
        idlePlayer.isPlaying = false;

        const host = document.createElement('div');
        const playingVideo = createMedia('video', {
            src: 'shared.mp4',
            paused: false,
        });
        host.appendChild(playingVideo);
        manager.div = host;
        manager.cleanupSlideContent(host);

        playingVideo.dispatchEvent(new Event('play'));
        await Promise.resolve();
        await Promise.resolve();

        expect(sameIdVideo.pause).toHaveBeenCalledTimes(1);
        // a group member's copy of the SAME media must not broadcast its pause
        expect(sameIdVideo.dataset.pausedByGroupSync).toBe('1');
        expect(otherVideo.pause).toHaveBeenCalledTimes(1);
        expect(otherVideo.dataset.pausedByGroupSync).toBeUndefined();
        expect(pausedVideo.pause).not.toHaveBeenCalled();
        expect(sharedPlayer.pause).toHaveBeenCalledTimes(1);
        expect(idlePlayer.pause).not.toHaveBeenCalled();

        otherManager.div = null;
        manager.div = null;
    });

    test('a YouTube master broadcasts play, pause, and time updates', async () => {
        detachAllManagerDivs();
        const manager = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(76),
            createEffectManager(),
        );
        const forceSpy = vi
            .spyOn(manager, 'setSlideVideoCurrentTimeForce')
            .mockResolvedValue(undefined);
        manager.div = document.createElement('div');

        const content = document.createElement('div');
        content.appendChild(createIframe('https://www.youtube.com/embed/x'));
        manager.cleanupSlideContent(content);

        // a grouped screen shows the SAME embed; its pause is driven from here
        // and must not be broadcast back as the master's own pause
        const memberManager = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(84),
            createEffectManager(),
        );
        const memberContent = document.createElement('div');
        memberContent.appendChild(
            createIframe('https://www.youtube.com/embed/x'),
        );
        // mount first: assigning `div` re-renders, which tears down the
        // players registered by a previous `cleanupSlideContent`
        memberManager.div = memberContent;
        memberManager.cleanupSlideContent(memberContent);
        manager.getMemberInstances = vi.fn(async () => [memberManager]);

        const [player, memberPlayer] = mocks.FakeSlideYouTubePlayer.instances;
        memberPlayer.isPlaying = true;

        player.callbacks.onPlay(11);
        await Promise.resolve();
        await Promise.resolve();
        expect(forceSpy).toHaveBeenCalledWith(player.id, 11, true);
        expect(memberPlayer.pausedBySync).toBe(true);
        expect(memberPlayer.pause).toHaveBeenCalledTimes(1);
        memberManager.div = null;

        player.callbacks.onPause(12);
        expect(forceSpy).toHaveBeenCalledWith(player.id, 12, false);

        player.callbacks.onTimeUpdate(13, true);
        expect(forceSpy).toHaveBeenCalledWith(player.id, 13, true);

        manager.div = null;
    });

    test('group-sync pauses and sync corrections are never rebroadcast', () => {
        const manager = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(77),
            createEffectManager(),
        );
        const forceSpy = vi
            .spyOn(manager, 'setSlideVideoCurrentTimeForce')
            .mockResolvedValue(undefined);
        const badge = document.createElement('span');
        badge.setAttribute('data-preview-only', '');
        const content = document.createElement('div');
        const video = createMedia('video', { src: 'a.mp4' });
        content.append(badge, video);
        manager.div = content;
        manager.cleanupSlideContent(content);

        video.dataset.pausedByGroupSync = '1';
        video.dispatchEvent(new Event('pause'));
        expect(video.dataset.pausedByGroupSync).toBeUndefined();
        expect(badge.style.display).toBe('');
        expect(forceSpy).not.toHaveBeenCalled();

        video.dataset.pausedByGroupSync = '1';
        video.dispatchEvent(new Event('timeupdate'));
        expect(forceSpy).not.toHaveBeenCalled();
        delete video.dataset.pausedByGroupSync;

        video.dispatchEvent(new Event('play'));
        expect(badge.style.display).toBe('none');

        manager.div = null;
    });

    test('cleanupSlideContent wires iframes per window role', () => {
        const manager = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(78),
            createEffectManager(),
        );

        const presenterContent = document.createElement('div');
        const youTubeIframe = createIframe('https://www.youtube.com/embed/x');
        const websiteIframe = createIframe('https://example.com/');
        const fakeIframe = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'iframe',
        );
        const srcVideo = createMedia('video', { src: 'https://cdn/a.mp4' });
        presenterContent.append(
            youTubeIframe,
            websiteIframe,
            fakeIframe,
            srcVideo,
        );

        manager.cleanupSlideContent(presenterContent);
        expect(youTubeIframe.style.pointerEvents).toBe('auto');
        expect(websiteIframe.style.pointerEvents).toBe('auto');
        expect(mocks.FakeSlideYouTubePlayer.instances).toHaveLength(1);
        // a media element with a direct `src` is keyed by that resolved source
        expect(mocks.genVideoIDFromSrc).toHaveBeenCalledWith(srcVideo.src);

        mocks.appProvider.isPageScreen = true;
        const screenContent = document.createElement('div');
        const screenYouTubeIframe = createIframe(
            'https://www.youtube.com/embed/y',
        );
        const screenWebsiteIframe = createIframe('https://example.com/');
        screenContent.append(screenYouTubeIframe, screenWebsiteIframe);

        manager.cleanupSlideContent(screenContent);
        expect(screenYouTubeIframe.style.pointerEvents).toBe('');
        expect(screenWebsiteIframe.style.pointerEvents).toBe('');
        expect(mocks.FakeSlideYouTubePlayer.instances).toHaveLength(2);
        expect(mocks.FakeSlideYouTubePlayer.instances[1].options).toEqual({
            muteOnReady: true,
        });
    });

    test('renderAppDocument resolves the fonts of every bible canvas item', async () => {
        const manager = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(79),
            createEffectManager(),
        );
        const divHaftScale = document.createElement('div');

        const result = await manager.renderAppDocument(divHaftScale, {
            metadata: { width: 640, height: 360 },
            canvasItems: [
                { type: 'text' },
                { type: 'bible', bibleKeys: ['KJV', 'NIV'] },
                { type: 'bible' },
            ],
        } as any);

        expect(mocks.getBibleFontFamily).toHaveBeenCalledWith('KJV');
        expect(mocks.getBibleFontFamily).toHaveBeenCalledWith('NIV');
        expect(result.scale).toBe(2);
        expect(divHaftScale.style.width).toBe('640px');

        mocks.getBibleFontFamily.mockClear();
        await manager.renderAppDocument(document.createElement('div'), {
            metadata: { width: 640, height: 360 },
            canvasItems: [{ type: 'text' }],
        } as any);
        expect(mocks.getBibleFontFamily).not.toHaveBeenCalled();
    });

    test('getRenderingItemJson falls back to the item when the office slide is gone', async () => {
        const manager = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(80),
            createEffectManager(),
        );
        const itemJson = { id: 3, kind: 'slide' };
        const item = {
            id: 3,
            filePath: '/deck.pptx',
            html: undefined,
            toJson: () => itemJson,
        };

        mocks.pptxCheckIsThisType.mockReturnValue(true);
        mocks.pptxGetInstance.mockReturnValue({
            getItemById: vi.fn(async () => null),
        });
        await expect(manager.getRenderingItemJson(item as any)).resolves.toBe(
            itemJson,
        );

        mocks.pptxCheckIsThisType.mockReturnValue(false);
        mocks.docxCheckIsThisType.mockReturnValue(true);
        mocks.docxGetInstance.mockReturnValue({
            getItemById: vi.fn(async () => null),
        });
        await expect(manager.getRenderingItemJson(item as any)).resolves.toBe(
            itemJson,
        );
    });

    test('render clears the previous content and tears down YouTube players', async () => {
        detachAllManagerDivs();
        const effect = createEffectManager();
        const manager = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(81),
            effect,
        );

        // no container: nothing to render and nothing to clear
        await manager.render();
        expect(effect.styleAnim.animIn).not.toHaveBeenCalled();

        const host = document.createElement('div');
        manager.div = host;

        // an empty container has no junk to animate out
        await manager.clearJunk(host);
        expect(effect.styleAnim.animOut).not.toHaveBeenCalled();

        const junk = document.createElement('div');
        host.appendChild(junk);
        await manager.clearJunk(host);
        expect(effect.styleAnim.animOut).toHaveBeenCalledWith(junk);
        expect(host.contains(junk)).toBe(false);

        const iframeContent = document.createElement('div');
        iframeContent.appendChild(
            createIframe('https://www.youtube.com/embed/x'),
        );
        mocks.genSlideHtml.mockReturnValue(iframeContent);
        manager.varySlideData = {
            filePath: '/slides/a.slide',
            itemJson: {
                id: 1,
                canvasItems: [],
                metadata: { width: 640, height: 360 },
            },
            isRenderFullWidth: false,
        };
        await manager.render();
        const [player] = mocks.FakeSlideYouTubePlayer.instances;
        expect(player).toBeDefined();

        mocks.genSlideHtml.mockReturnValue(document.createElement('div'));
        await manager.render();
        expect(player.destroy).toHaveBeenCalledTimes(1);

        // the scroll sync callback forwards the container selector
        const [[, scrollCallback]] =
            mocks.registerScrollingSyncEvent.mock.calls;
        const base = manager.screenManagerBase;
        vi.useFakeTimers();
        scrollCallback({ x: 0.5, y: 0.25 });
        vi.runAllTimers();
        vi.useRealTimers();
        expect(base.sendScreenMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'sync-scroll-percentage' }),
            true,
        );

        manager.div = null;
    });

    test('render bails out when the slide produces no content', async () => {
        detachAllManagerDivs();
        const effect = createEffectManager();
        const manager = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(82),
            effect,
        );
        manager.div = document.createElement('div');

        manager.varySlideData = {
            filePath: '/slides/pdf.slide',
            itemJson: {
                id: 1,
                kind: 'pdf',
                imagePreviewSrc: '',
                metadata: { width: 0, height: 0 },
            },
            isRenderFullWidth: false,
        };
        await manager.render();

        expect(effect.styleAnim.animIn).not.toHaveBeenCalled();
        manager.div = null;
    });

    test('containerStyle matches the screen size', () => {
        const manager = new ScreenVaryAppDocumentManager(
            createScreenManagerBase(83),
            createEffectManager(),
        );

        expect(manager.containerStyle).toEqual({
            position: 'absolute',
            width: '1280px',
            height: '720px',
            overflow: 'hidden',
        });
    });

    test('a sync message for a closed screen reports the failure', () => {
        ScreenVaryAppDocumentManager.receiveSyncScreen({
            screenId: 98765,
            type: 'vary-app-document',
            data: null,
        } as any);

        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Failed to sync slide. Please make sure the screen is open.',
            'error',
        );
    });
});
