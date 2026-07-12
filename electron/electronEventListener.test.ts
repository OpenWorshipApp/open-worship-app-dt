import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

const {
    attemptClosing,
    captureWebScreenShot,
    docxToHtmls,
    getDocxToHtmlsVersion,
    goDownload,
    printHTMLContent,
    pptxToHtmls,
    getPptxToHtmlsVersion,
    tarExtract,
    tarCreate,
    officeFileToPdf,
    pdfToImages,
    getPagesCount,
    countSlides,
    exportBibleMSWord,
    getAllNoneFinderWindows,
    previewPrintCurrentWindow,
    removeSlideBackground,
    screenInstance,
} = vi.hoisted(() => ({
    attemptClosing: vi.fn(),
    captureWebScreenShot: vi.fn(),
    docxToHtmls: vi.fn(),
    getDocxToHtmlsVersion: vi.fn(),
    goDownload: vi.fn(),
    printHTMLContent: vi.fn(async () => undefined),
    pptxToHtmls: vi.fn(),
    getPptxToHtmlsVersion: vi.fn(),
    tarExtract: vi.fn(),
    tarCreate: vi.fn(),
    officeFileToPdf: vi.fn(),
    pdfToImages: vi.fn(),
    getPagesCount: vi.fn(),
    countSlides: vi.fn(),
    exportBibleMSWord: vi.fn(),
    getAllNoneFinderWindows: vi.fn(() => []),
    previewPrintCurrentWindow: vi.fn(async () => undefined),
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
    previewPrintCurrentWindow,
    printHTMLContent,
    tarCreate,
    tarExtract,
}));

vi.mock('./electronOfficeHelpers', () => ({ officeFileToPdf }));
vi.mock('./pdfToImagesHelpers', () => ({
    getPagesCount,
    pdfToImages,
}));
vi.mock('./msHelpers', () => ({
    countSlides,
    docxToHtmls,
    exportBibleMSWord,
    getDocxToHtmlsVersion,
    getPptxToHtmlsVersion,
    pptxToHtmls,
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
import { createMockBrowserWindow } from './testUtils';

describe('electronEventListener', () => {
    beforeEach(() => {
        electronMockState.reset();
        tarExtract.mockReset();
        tarCreate.mockReset();
        officeFileToPdf.mockReset();
        pdfToImages.mockReset();
        getPagesCount.mockReset();
        pptxToHtmls.mockReset();
        getPptxToHtmlsVersion.mockReset();
        docxToHtmls.mockReset();
        getDocxToHtmlsVersion.mockReset();
        countSlides.mockReset();
        exportBibleMSWord.mockReset();
        removeSlideBackground.mockReset();
        captureWebScreenShot.mockReset();
        printHTMLContent.mockReset();
        previewPrintCurrentWindow.mockReset();
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

    test('registers DOCX conversion IPC handlers', async () => {
        const appController = {
            mainWin: { webContents: { getZoomFactor: vi.fn(() => 1) } },
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
        docxToHtmls.mockResolvedValue({ isSuccessful: true });
        getDocxToHtmlsVersion.mockResolvedValue({ version: '1.0.0' });

        initEventOther(appController as any);

        const docxToHtmlsHandler = electronMockState.ipcMain.on.mock.calls.find(
            ([eventName]) => eventName === 'main:app:docx-to-htmls',
        )?.[1];
        const docxVersionHandler = electronMockState.ipcMain.on.mock.calls.find(
            ([eventName]) => eventName === 'main:app:get-docx-to-htmls-version',
        )?.[1];
        const tarCreateHandler = electronMockState.ipcMain.on.mock.calls.find(
            ([eventName]) => eventName === 'main:app:tar-create',
        )?.[1];
        const sender = { send: vi.fn() };

        await docxToHtmlsHandler(
            { sender },
            {
                replyEventName: 'reply:docx-to-htmls',
                filePath: '/tmp/notes.docx',
                outDir: '/tmp/notes-docx-htmls',
            },
        );
        await docxVersionHandler(
            { sender },
            { replyEventName: 'reply:docx-version' },
        );
        await tarCreateHandler(
            { sender },
            {
                replyEventName: 'reply:tar-create',
                inputDir: '/archives/owabn-export',
                outputFilePath: '/archives/item.owabn.tar.gz',
                files: ['manifest.json', 'note-item.json'],
                isGzip: true,
            },
        );

        expect(docxToHtmls).toHaveBeenCalledWith({
            replyEventName: 'reply:docx-to-htmls',
            filePath: '/tmp/notes.docx',
            outDir: '/tmp/notes-docx-htmls',
        });
        expect(getDocxToHtmlsVersion).toHaveBeenCalledWith({
            replyEventName: 'reply:docx-version',
        });
        expect(sender.send).toHaveBeenCalledWith('reply:docx-to-htmls', {
            isSuccessful: true,
        });
        expect(sender.send).toHaveBeenCalledWith('reply:docx-version', {
            version: '1.0.0',
        });
        expect(tarCreate).toHaveBeenCalledWith(
            '/archives/owabn-export',
            '/archives/item.owabn.tar.gz',
            ['manifest.json', 'note-item.json'],
            true,
        );
        expect(sender.send).toHaveBeenCalledWith('reply:tar-create', undefined);
    });

    test('prints HTML payloads or previews the sender window', () => {
        const sourceWin = createMockBrowserWindow();
        electronMockState.setBrowserWindowFactory(() => sourceWin);
        electronMockState.BrowserWindowMock();
        const appController = {
            mainWin: { webContents: { getZoomFactor: vi.fn(() => 1) } },
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

        initEventOther(appController as any);

        const printHandler = electronMockState.ipcMain.on.mock.calls.find(
            ([eventName]) => eventName === 'all:app:print',
        )?.[1];

        printHandler({ sender: sourceWin.webContents }, '<html>Note</html>');
        printHandler({ sender: sourceWin.webContents });

        expect(printHTMLContent).toHaveBeenCalledWith('<html>Note</html>');
        expect(previewPrintCurrentWindow).toHaveBeenCalledWith(sourceWin);
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
