import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

const {
    attemptClosing,
    captureWebScreenShot,
    goDownload,
    printHTMLContent,
    tarExtract,
    officeFileToPdf,
    pdfToImages,
    getPagesCount,
    countSlides,
    exportBibleMSWord,
    getAllNoneFinderWindows,
    removeSlideBackground,
    screenInstance,
} = vi.hoisted(() => ({
    attemptClosing: vi.fn(),
    captureWebScreenShot: vi.fn(),
    goDownload: vi.fn(),
    printHTMLContent: vi.fn(),
    tarExtract: vi.fn(),
    officeFileToPdf: vi.fn(),
    pdfToImages: vi.fn(),
    getPagesCount: vi.fn(),
    countSlides: vi.fn(),
    exportBibleMSWord: vi.fn(),
    getAllNoneFinderWindows: vi.fn(() => []),
    removeSlideBackground: vi.fn(),
    screenInstance: {
        win: {
            on: vi.fn(),
        },
        listenLoading: vi.fn(async () => undefined),
        setDisplay: vi.fn(),
        destroyInstance: vi.fn(),
        sendMessage: vi.fn(),
    },
}));

vi.mock('./electronHelpers', () => ({
    attemptClosing,
    captureWebScreenShot,
    goDownload,
    getAllNoneFinderWindows,
    isMac: true,
    messageChannels: {
        screenMessage: 'app:screen:message',
    },
    printHTMLContent,
    tarExtract,
}));

vi.mock('./electronOfficeHelpers', () => ({ officeFileToPdf }));
vi.mock('./pdfToImagesHelpers', () => ({
    getPagesCount,
    pdfToImages,
}));
vi.mock('./msHelpers', () => ({
    countSlides,
    exportBibleMSWord,
    removeSlideBackground,
}));
vi.mock('./ElectronScreenController', () => ({
    default: {
        createInstance: vi.fn(() => screenInstance),
        getAllIds: vi.fn(() => [3]),
        getInstance: vi.fn(() => screenInstance),
        closeAll: vi.fn(),
    },
}));

import {
    initEventListenerApp,
    initEventOther,
    initEventScreen,
    initFinderEvent,
} from './electronEventListener';
import { electronMockState } from './testElectronModule';

describe('electronEventListener', () => {
    beforeEach(() => {
        electronMockState.reset();
        tarExtract.mockReset();
        officeFileToPdf.mockReset();
        pdfToImages.mockReset();
        getPagesCount.mockReset();
        countSlides.mockReset();
        exportBibleMSWord.mockReset();
        removeSlideBackground.mockReset();
        captureWebScreenShot.mockReset();
        printHTMLContent.mockReset();
        goDownload.mockReset();
        electronMockState.dialog.showOpenDialog.mockReset();
        screenInstance.listenLoading.mockClear();
        screenInstance.setDisplay.mockClear();
        screenInstance.destroyInstance.mockClear();
        screenInstance.sendMessage.mockClear();
        screenInstance.win.on.mockClear();
    });

    test('registers app IPC handlers and async file selection replies', async () => {
        electronMockState.dialog.showOpenDialog.mockResolvedValue({
            filePaths: ['/tmp/a.txt'],
        });

        const appController = {
            mainWin: {},
        };
        initEventListenerApp(appController as any);

        const selectFilesHandler = electronMockState.ipcMain.on.mock.calls.find(
            ([eventName]) => eventName === 'main:app:select-files',
        )?.[1];
        const sender = { send: vi.fn() };

        await selectFilesHandler(
            { sender },
            {
                replyEventName: 'reply:files',
                filters: [{ name: 'Text', extensions: ['txt'] }],
            },
        );

        expect(sender.send).toHaveBeenCalledWith('reply:files', ['/tmp/a.txt']);
    });

    test('shows a screen on a display and notifies the main window', async () => {
        const focus = vi.fn();
        const sendNotifyInvisibility = vi.fn();
        const appController = {
            mainWin: { focus },
            mainController: { sendNotifyInvisibility },
            settingManager: {
                primaryDisplay: { size: { width: 1280 } },
                allDisplays: [],
                getDisplayById: vi.fn(() => ({
                    id: 8,
                    bounds: { x: 1, y: 2 },
                })),
            },
        };

        initEventScreen(appController as any);

        const showScreenHandler = electronMockState.ipcMain.on.mock.calls.find(
            ([eventName]) => eventName === 'main:app:show-screen',
        )?.[1];

        await showScreenHandler(
            { sender: { send: vi.fn() } },
            { replyEventName: 'reply:show', screenId: 3, displayId: 8 },
        );

        expect(screenInstance.listenLoading).toHaveBeenCalledTimes(1);
        expect(screenInstance.setDisplay).toHaveBeenCalledWith({
            id: 8,
            bounds: { x: 1, y: 2 },
        });
        expect(focus).toHaveBeenCalledTimes(1);

        const closeHandler = screenInstance.win.on.mock.calls[0][1];
        closeHandler();
        expect(sendNotifyInvisibility).toHaveBeenCalledWith(3);
    });

    test('registers finder and theme-related handlers', () => {
        const mainWebContents = {
            getZoomFactor: vi.fn(() => 1.25),
        };
        const searchWebContents = {
            findInPage: vi.fn(() => 11),
            stopFindInPage: vi.fn(),
        };
        getAllNoneFinderWindows.mockReturnValue([
            { webContents: searchWebContents },
        ] as any);
        const appController = {
            mainWin: { webContents: mainWebContents },
            mainController: {
                sendScreenMessage: vi.fn(),
                changeBible: vi.fn(),
                ctrlScrolling: vi.fn(),
            },
            settingManager: {
                themeSource: 'system',
                primaryDisplay: { size: { width: 1280 } },
            },
            resetThemeBackgroundColor: vi.fn(),
            reloadAll: vi.fn(),
        };

        initFinderEvent();
        initEventOther(appController as any);

        const searchHandler = electronMockState.ipcMain.on.mock.calls.find(
            ([eventName]) => eventName === 'finder:app:search-in-page',
        )?.[1];
        const getThemeHandler = electronMockState.ipcMain.on.mock.calls.find(
            ([eventName]) => eventName === 'main:app:get-theme',
        )?.[1];
        const setThemeHandler = electronMockState.ipcMain.on.mock.calls.find(
            ([eventName]) => eventName === 'main:app:set-theme',
        )?.[1];

        const event = { returnValue: undefined as unknown };
        searchHandler(event, 'grace', { forward: true });
        expect(searchWebContents.findInPage).toHaveBeenCalledWith('grace', {
            forward: true,
        });

        const themeEvent = { returnValue: undefined as unknown };
        getThemeHandler(themeEvent);
        expect(themeEvent.returnValue).toBe('system');

        setThemeHandler({}, 'dark');
        expect(appController.settingManager.themeSource).toBe('dark');
        expect(appController.resetThemeBackgroundColor).toHaveBeenCalledTimes(
            1,
        );
    });
});
