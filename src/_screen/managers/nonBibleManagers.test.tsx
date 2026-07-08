// @vitest-environment jsdom

import path from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const getSettingMock = vi.fn();
const setSettingMock = vi.fn();
const getBackgroundSrcListOnScreenSettingMock = vi.fn(() => ({}));
const getForegroundDataListOnScreenSettingMock = vi.fn(() => ({}));
const getAppDocumentListOnScreenSettingMock = vi.fn(() => ({}));
const applyAttachBackgroundMock = vi.fn();
const registerScrollingSyncEventMock = vi.fn();
const renderForegroundHelperMock = vi.fn(() => ({
    handleAdding: vi.fn((parent: HTMLElement) => {
        parent.appendChild(document.createElement('div'));
    }),
    handleRemoving: vi.fn(async () => {}),
}));

const appProviderMock = {
    isPagePresenter: false,
    isPageScreen: false,
    pathUtils: {
        basename: path.basename,
        join: path.join,
        resolve: path.resolve,
        sep: path.sep,
    },
    systemUtils: {
        isDev: false,
    },
};

vi.mock('../../helper/settingHelpers', () => ({
    getSetting: getSettingMock,
    setSetting: setSettingMock,
}));

vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: vi.fn((_key: string, callback: () => unknown) => callback()),
}));

vi.mock('../../server/appProvider', () => ({
    default: appProviderMock,
}));

vi.mock('../../server/comparisonHelpers', () => ({
    checkAreObjectsEqual: vi.fn((a: unknown, b: unknown) => {
        return JSON.stringify(a) === JSON.stringify(b);
    }),
    checkIsItemInArray: vi.fn((item: unknown, arr: unknown[]) => {
        return arr.some(
            (current) => JSON.stringify(current) === JSON.stringify(item),
        );
    }),
}));

vi.mock('../../helper/loggerHelpers', () => ({
    appLog: vi.fn(),
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: vi.fn(),
}));

vi.mock('../../background/videoBackgroundHelpers', () => ({
    getIsFadingAtTheEndSetting: vi.fn(() => false),
}));

vi.mock('../ScreenBackgroundComp', () => ({
    genHtmlBackground: vi.fn(() => ({
        newDiv: document.createElement('div'),
        promise: Promise.resolve(() => {}),
    })),
}));

vi.mock('../screenHelpers', () => ({
    getBackgroundSrcListOnScreenSetting:
        getBackgroundSrcListOnScreenSettingMock,
    getForegroundDataListOnScreenSetting:
        getForegroundDataListOnScreenSettingMock,
}));

vi.mock('../screenForegroundHelpers', () => ({
    genHtmlForegroundCountdown: renderForegroundHelperMock,
    genHtmlForegroundMarquee: vi.fn(() => ({
        element: document.createElement('div'),
        handleRemoving: vi.fn(async () => {}),
    })),
    genHtmlForegroundQuickText: renderForegroundHelperMock,
    genHtmlForegroundStopwatch: renderForegroundHelperMock,
    genHtmlForegroundTime: renderForegroundHelperMock,
    genHtmlForegroundWeb: renderForegroundHelperMock,
}));

vi.mock('../../helper/cameraHelpers', () => ({
    getCameraAndShowMedia: vi.fn(async () => () => {}),
}));

vi.mock('../preview/screenPreviewerHelpers', () => ({
    getAppDocumentListOnScreenSetting: getAppDocumentListOnScreenSettingMock,
}));

vi.mock('../../app-document-list/appDocumentHelpers', () => ({
    toKeyByFilePath: vi.fn(
        (filePath: string, id: number) => `${filePath}:${id}`,
    ),
}));

vi.mock('../../app-document-presenter/items/PdfSlideRenderComp', () => ({
    genPdfSlide: vi.fn(() => document.createElement('div')),
}));

vi.mock('../../app-document-presenter/items/PptxSlideRenderComp', () => ({
    genPptxSlide: vi.fn(() => document.createElement('div')),
}));

vi.mock('../../app-document-presenter/items/DocxSlideRenderComp', () => ({
    genDocxSlide: vi.fn(() => document.createElement('div')),
}));

vi.mock('../../app-document-presenter/items/SlideRendererComp', () => ({
    genSlideHtml: vi.fn(() => document.createElement('div')),
}));

vi.mock('./screenBackgroundHelpers', () => ({
    applyAttachBackground: applyAttachBackgroundMock,
}));

vi.mock('./screenEventHelpers', () => ({
    registerScrollingSyncEvent: registerScrollingSyncEventMock,
}));

vi.mock('../../app-document-list/PdfSlide', () => ({
    default: class PdfSlide {
        static readonly tryValidate = vi.fn(
            (item: any) => item?.kind === 'pdf',
        );
        static readonly checkIsThisType = vi.fn(() => false);
    },
}));

vi.mock('../../app-document-list/PptxSlide', () => ({
    default: class PptxSlide {
        static readonly tryValidate = vi.fn(
            (item: any) => item?.kind === 'pptx',
        );
        static readonly checkIsThisType = vi.fn(() => false);
    },
}));

vi.mock('../../app-document-list/DocxSlide', () => ({
    default: class DocxSlide {
        static readonly tryValidate = vi.fn(
            (item: any) => item?.kind === 'docx',
        );
        static readonly checkIsThisType = vi.fn(() => false);
    },
}));

vi.mock('../../app-document-list/PptxAppDocument', () => ({
    default: {
        getInstance: vi.fn(() => ({
            getItemById: vi.fn(() => null),
        })),
    },
}));

vi.mock('../../app-document-list/DocxAppDocument', () => ({
    default: {
        getInstance: vi.fn(() => ({
            getItemById: vi.fn(() => null),
        })),
    },
}));

describe('non-Bible screen managers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        appProviderMock.isPagePresenter = false;
        appProviderMock.isPageScreen = false;
        document.body.innerHTML = '';
    });

    test('updates and renders background state', async () => {
        const { default: ScreenBackgroundManager } =
            await import('./ScreenBackgroundManager');

        const screenManagerBase = {
            screenId: 21,
            width: 1280,
            height: 720,
            noSyncGroupMap: new Map<string, boolean>(),
            checkIsLockedWithMessage: vi.fn(() => false),
            sendScreenMessage: vi.fn(),
            createScreenManagerBaseGhost: vi.fn(),
        } as any;
        const effectManager = {
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

        const manager = new ScreenBackgroundManager(
            screenManagerBase,
            effectManager,
        );
        const listener = vi.fn();
        manager.registerEventListener(['color-set'], listener);
        const root = document.createElement('div');
        manager.rootContainer = root;

        manager.backgroundSrc = { type: 'color', src: '#ffffff' } as any;
        await Promise.resolve();

        expect(listener).toHaveBeenCalledWith('#ffffff', expect.any(Number));
        expect(setSettingMock).toHaveBeenCalled();
        expect(screenManagerBase.sendScreenMessage).toHaveBeenCalledWith(
            {
                screenId: 21,
                type: 'background',
                data: { type: 'color', src: '#ffffff' },
            },
            false,
        );

        await manager.receiveScreenDropped({
            type: 'bg-color',
            item: '#000000',
        } as any);
        expect(manager.backgroundSrc).toEqual({
            type: 'color',
            src: '#000000',
        });

        manager.clear();
        expect(manager.backgroundSrc).toBeNull();
    });

    test('manages foreground overlays and sync payloads', async () => {
        const { default: ScreenForegroundManager } =
            await import('./ScreenForegroundManager');

        const screenManagerBase = {
            screenId: 22,
            width: 1280,
            height: 720,
            noSyncGroupMap: new Map<string, boolean>(),
            checkIsLockedWithMessage: vi.fn(() => false),
            sendScreenMessage: vi.fn(),
            createScreenManagerBaseGhost: vi.fn(),
        } as any;
        const effectManager = {
            styleAnimList: {
                fade: {},
            },
        } as any;
        const manager = new ScreenForegroundManager(
            screenManagerBase,
            effectManager,
        );
        manager.div = document.createElement('div');

        const timeData = {
            id: 'tokyo',
            timezoneMinuteOffset: 9,
            title: 'Tokyo',
            is24HourFormat: true,
            extraStyle: {},
        };
        manager.addTimeData(timeData as any);
        expect(manager.foregroundData.timeDataList).toEqual([timeData]);

        manager.addTimeData(timeData as any);
        expect(manager.foregroundData.timeDataList).toEqual([timeData]);

        const timeData12Hour = {
            ...timeData,
            is24HourFormat: false,
        };
        manager.addTimeData(timeData12Hour as any);
        expect(manager.foregroundData.timeDataList).toEqual([timeData12Hour]);

        manager.removeTimeData(timeData12Hour as any);
        expect(manager.foregroundData.timeDataList).toEqual([]);

        manager.receiveSyncScreen({
            screenId: 22,
            type: 'foreground',
            data: {
                countdownData: null,
                stopwatchData: null,
                timeDataList: [],
                marqueeData: { text: 'Hello', extraStyle: {} },
                quickTextData: null,
                cameraDataList: [],
                webDataList: [],
            },
        } as any);
        expect(manager.foregroundData.marqueeData).toEqual({
            text: 'Hello',
            extraStyle: {},
        });

        manager.clear();
        expect(manager.isShowing).toBe(false);
        expect(setSettingMock).toHaveBeenCalled();
        expect(screenManagerBase.sendScreenMessage).toHaveBeenCalled();
    });

    test('deduplicates and removes camera overlays', async () => {
        const { default: ScreenForegroundManager } =
            await import('./ScreenForegroundManager');

        const screenManagerBase = {
            screenId: 24,
            width: 1280,
            height: 720,
            noSyncGroupMap: new Map<string, boolean>(),
            checkIsLockedWithMessage: vi.fn(() => false),
            sendScreenMessage: vi.fn(),
            createScreenManagerBaseGhost: vi.fn(),
        } as any;
        const effectManager = {
            styleAnimList: {
                fade: {},
            },
        } as any;
        const manager = new ScreenForegroundManager(
            screenManagerBase,
            effectManager,
        );

        const cameraData = {
            deviceId: 'camera-1',
            label: 'Front camera',
            extraStyle: {},
        };

        manager.addCameraData(cameraData as any);
        manager.addCameraData(cameraData as any);
        expect(manager.foregroundData.cameraDataList).toEqual([cameraData]);

        manager.removeCameraData(cameraData as any);
        expect(manager.foregroundData.cameraDataList).toEqual([]);
        expect(screenManagerBase.sendScreenMessage).toHaveBeenCalled();
    });

    test('toggles vary-app-document selection and renders slide content', async () => {
        const varyModule = await import('./ScreenVaryAppDocumentManager');
        const ScreenVaryAppDocumentManager = varyModule.default;

        getSettingMock.mockImplementation((key: string) => {
            if (key === 'pdf-full-width') {
                return 'true';
            }
            return undefined;
        });

        const screenManagerBase = {
            screenId: 23,
            width: 1280,
            height: 720,
            noSyncGroupMap: new Map<string, boolean>(),
            checkIsLockedWithMessage: vi.fn(() => false),
            sendScreenMessage: vi.fn(),
            createScreenManagerBaseGhost: vi.fn(),
        } as any;
        const effectManager = {
            styleAnim: {
                animIn: vi.fn(),
                animOut: vi.fn(async () => {}),
            },
        } as any;
        const manager = new ScreenVaryAppDocumentManager(
            screenManagerBase,
            effectManager,
        );
        manager.div = document.createElement('div');

        expect(varyModule.checkIsPdfFullWidth()).toBe(true);
        varyModule.setIsPdfFullWidth(false);
        expect(setSettingMock).toHaveBeenCalledWith('pdf-full-width', 'false');

        const slideJson = {
            id: 7,
            metadata: { width: 640, height: 360 },
            canvasItems: [],
            kind: 'slide',
        };
        manager.handleSlideSelecting('/slides/a.slide', slideJson as any);
        expect(manager.varySlideData?.filePath).toBe('/slides/a.slide');

        manager.handleSlideSelecting('/slides/a.slide', slideJson as any);
        expect(manager.varySlideData).toBeNull();

        await manager.receiveScreenDropped({
            item: {
                filePath: '/slides/b.slide',
                id: 9,
                toJson: () => slideJson,
            },
        } as any);
        expect(manager.varySlideData).toEqual({
            filePath: '/slides/b.slide',
            itemJson: slideJson,
            isRenderFullWidth: true,
        });

        manager.render();
        expect(registerScrollingSyncEventMock).toHaveBeenCalled();
        expect(effectManager.styleAnim.animIn).toHaveBeenCalled();
    });
});
