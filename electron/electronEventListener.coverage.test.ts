import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

const {
    attemptClosing,
    captureWebScreenShot,
    docxToHtmls,
    getAllNoneFinderWindows,
    getDocxToHtmlsVersion,
    getFonts,
    getPagesCount,
    getPptxSlidesCount,
    getPptxToHtmlsVersion,
    goDownload,
    initMenu,
    officeFileToPdf,
    pdfToImages,
    previewPrintCurrentWindow,
    printHTMLContent,
    pptxToHtmls,
    screenControllerMocks,
    screenInstance,
    sendMenuClicked,
    setCustomMenusData,
    tarCreate,
    tarExtract,
} = vi.hoisted(() => ({
    attemptClosing: vi.fn(),
    captureWebScreenShot: vi.fn(),
    docxToHtmls: vi.fn(),
    getAllNoneFinderWindows: vi.fn(() => [] as any[]),
    getDocxToHtmlsVersion: vi.fn(),
    getFonts: vi.fn(async () => ['Arial', 'Khmer OS']),
    getPagesCount: vi.fn(),
    getPptxSlidesCount: vi.fn(),
    getPptxToHtmlsVersion: vi.fn(),
    goDownload: vi.fn(),
    initMenu: vi.fn(),
    officeFileToPdf: vi.fn(),
    pdfToImages: vi.fn(),
    previewPrintCurrentWindow: vi.fn(async () => undefined),
    printHTMLContent: vi.fn(async () => undefined),
    pptxToHtmls: vi.fn(),
    screenControllerMocks: {
        closeAll: vi.fn(),
        createInstance: vi.fn(),
        getAllIds: vi.fn(() => [3, 4]),
        getInstance: vi.fn(),
    },
    screenInstance: {
        win: { on: vi.fn() },
        listenLoading: vi.fn(async () => undefined),
        setDisplay: vi.fn(),
        destroyInstance: vi.fn(),
        sendMessage: vi.fn(),
    },
    sendMenuClicked: vi.fn(),
    setCustomMenusData: vi.fn(),
    tarCreate: vi.fn(),
    tarExtract: vi.fn(),
}));

vi.mock('font-list', () => ({
    default: { getFonts },
    getFonts,
}));

vi.mock('./electronHelpers', () => ({
    attemptClosing,
    captureWebScreenShot,
    getAllNoneFinderWindows,
    goDownload,
    isMac: true,
    messageChannels: { screenMessage: 'app:screen:message' },
    previewPrintCurrentWindow,
    printHTMLContent,
    tarCreate,
    tarExtract,
}));

vi.mock('./electronOfficeHelpers', () => ({ officeFileToPdf }));
vi.mock('./pdfToImagesHelpers', () => ({ getPagesCount, pdfToImages }));
vi.mock('./msHelpers', () => ({
    docxToHtmls,
    getDocxToHtmlsVersion,
    getPptxSlidesCount,
    getPptxToHtmlsVersion,
    pptxToHtmls,
}));
vi.mock('./electronMenu', () => ({
    initMenu,
    sendMenuClicked,
    setCustomMenusData,
}));
vi.mock('./ElectronScreenController', () => ({
    default: screenControllerMocks,
}));

import {
    initEventListenerApp,
    initEventOther,
    initEventScreen,
    initFinderEvent,
} from './electronEventListener';
import { electronMockState } from './testElectronModule';
import { createMockBrowserWindow, flushPromises } from './testUtils';

function findOnHandler(eventName: string) {
    const handler = electronMockState.ipcMain.on.mock.calls.find(
        ([name]) => name === eventName,
    )?.[1];
    if (handler === undefined) {
        throw new Error(`No "on" handler registered for ${eventName}`);
    }
    return handler as (...args: any[]) => any;
}

function findInvokeHandler(eventName: string) {
    const handler = electronMockState.ipcMain.handle.mock.calls.find(
        ([name]) => name === eventName,
    )?.[1];
    if (handler === undefined) {
        throw new Error(`No "handle" handler registered for ${eventName}`);
    }
    return handler as (...args: any[]) => any;
}

function createAppController(overrides: Record<string, any> = {}) {
    return {
        mainWin: {
            focus: vi.fn(),
            webContents: { getZoomFactor: vi.fn(() => 1.5) },
        },
        mainController: {
            sendScreenMessage: vi.fn(),
            changeBible: vi.fn(),
            sendNotifyInvisibility: vi.fn(),
        },
        settingManager: {
            themeSource: 'system',
            primaryDisplay: { id: 1, size: { width: 1280, height: 720 } },
            allDisplays: [{ id: 1 }, { id: 8 }],
            getDisplayById: vi.fn(() => ({ id: 8, bounds: { x: 1, y: 2 } })),
            getClientSetting: vi.fn(() => 'stored-value'),
            setClientSetting: vi.fn(),
            deleteClientSetting: vi.fn(),
            getAllClientSettingKeys: vi.fn(() => ['a', 'b']),
            clearClientSettings: vi.fn(),
        },
        resetThemeBackgroundColor: vi.fn(),
        reloadAll: vi.fn(),
        ...overrides,
    } as any;
}

describe('electronEventListener handlers', () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        electronMockState.reset();
        vi.clearAllMocks();
        screenControllerMocks.createInstance.mockReturnValue(screenInstance);
        screenControllerMocks.getInstance.mockReturnValue(screenInstance);
        screenControllerMocks.getAllIds.mockReturnValue([3, 4]);
        getFonts.mockResolvedValue(['Arial', 'Khmer OS']);
        getAllNoneFinderWindows.mockReturnValue([]);
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    test('app handlers expose packaging, paths, and directory selection', async () => {
        electronMockState.dialog.showOpenDialog.mockResolvedValue({
            filePaths: ['/tmp/dir'],
        });
        electronMockState.app.getPath.mockImplementation(
            (name: string) => `/mock/${name}`,
        );
        const appController = createAppController();

        initEventListenerApp(appController);

        expect(findInvokeHandler('get-is-packaged')()).toBe(false);
        expect(findInvokeHandler('get-app-path')()).toBe('/mock-app');

        const dataPathEvent: any = {};
        findOnHandler('main:app:get-data-path')(dataPathEvent);
        expect(dataPathEvent.returnValue).toBe('/mock/userData');

        const appPathEvent: any = {};
        findOnHandler('main:app:get-app-path')(appPathEvent);
        expect(appPathEvent.returnValue).toBe('/mock-app');

        const specialPathEvent: any = {};
        findOnHandler('main:app:get-special-path')(
            specialPathEvent,
            'downloads',
        );
        expect(specialPathEvent.returnValue).toBe('/mock/downloads');

        const tempPathEvent: any = {};
        findOnHandler('main:app:get-temp-path')(tempPathEvent);
        expect(tempPathEvent.returnValue).toBe('/mock/temp');

        const sender = { send: vi.fn() };
        await findOnHandler('main:app:select-dirs')(
            { sender },
            { replyEventName: 'reply:dirs' },
        );
        expect(sender.send).toHaveBeenCalledWith('reply:dirs', ['/tmp/dir']);
    });

    test('an async handler needs a reply channel and reports its failures', async () => {
        const appController = createAppController();
        initEventListenerApp(appController);
        const selectDirs = findOnHandler('main:app:select-dirs');
        const sender = { send: vi.fn() };

        await selectDirs({ sender }, {});
        expect(sender.send).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'main:app:select-dirs: replyEventName is required',
        );

        // a thrown error is replied as an Error so the renderer's promise
        // rejects instead of hanging forever
        electronMockState.dialog.showOpenDialog.mockRejectedValue(
            new Error('dialog failed'),
        );
        await selectDirs({ sender }, { replyEventName: 'reply:dirs' });
        expect(sender.send).toHaveBeenCalledWith(
            'reply:dirs',
            expect.objectContaining({ message: 'dialog failed' }),
        );

        // a non-Error rejection is wrapped
        sender.send.mockClear();
        electronMockState.dialog.showOpenDialog.mockRejectedValue('nope');
        await selectDirs({ sender }, { replyEventName: 'reply:dirs' });
        expect(sender.send).toHaveBeenCalledWith(
            'reply:dirs',
            expect.objectContaining({ message: 'nope' }),
        );

        // a dead sender must not take the handler down with it
        electronMockState.dialog.showOpenDialog.mockResolvedValue({
            filePaths: [],
        });
        const deadSender = {
            send: vi.fn(() => {
                throw new Error('sender destroyed');
            }),
        };
        await selectDirs(
            { sender: deadSender },
            { replyEventName: 'reply:dirs' },
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'main:app:select-dirs: failed to reply',
            expect.any(Error),
        );
    });

    test('screen handlers show, hide, retarget, and message screens', async () => {
        const appController = createAppController();
        initEventScreen(appController);

        const displaysEvent: any = {};
        findOnHandler('main:app:get-displays')(displaysEvent);
        expect(displaysEvent.returnValue).toEqual({
            primaryDisplay: appController.settingManager.primaryDisplay,
            displays: appController.settingManager.allDisplays,
        });

        const screensEvent: any = {};
        findOnHandler('main:app:get-screens')(screensEvent);
        expect(screensEvent.returnValue).toEqual([3, 4]);

        // an unknown display leaves the screen where it is
        appController.settingManager.getDisplayById.mockReturnValueOnce(
            undefined,
        );
        await findOnHandler('main:app:show-screen')(
            { sender: { send: vi.fn() } },
            { replyEventName: 'reply:show', screenId: 3, displayId: 99 },
        );
        expect(screenInstance.setDisplay).not.toHaveBeenCalled();

        findOnHandler('app:hide-screen')({}, 3);
        expect(attemptClosing).toHaveBeenCalledWith(screenInstance);
        expect(screenInstance.destroyInstance).toHaveBeenCalledTimes(1);

        // hiding a screen that is already gone is a no-op
        screenControllerMocks.getInstance.mockReturnValueOnce(null);
        findOnHandler('app:hide-screen')({}, 3);
        expect(screenInstance.destroyInstance).toHaveBeenCalledTimes(1);

        findOnHandler('app:hide-all-screens')({});
        expect(screenControllerMocks.closeAll).toHaveBeenCalledTimes(1);

        findOnHandler('main:app:set-screen-display')(
            {},
            { screenId: 3, displayId: 8 },
        );
        expect(screenInstance.setDisplay).toHaveBeenCalledWith({
            id: 8,
            bounds: { x: 1, y: 2 },
        });

        // no matching display: nothing to retarget
        screenInstance.setDisplay.mockClear();
        appController.settingManager.getDisplayById.mockReturnValueOnce(
            undefined,
        );
        findOnHandler('main:app:set-screen-display')(
            {},
            { screenId: 3, displayId: 99 },
        );
        expect(screenInstance.setDisplay).not.toHaveBeenCalled();
    });

    test('screen messages route to the presenter or to the screen window', async () => {
        const appController = createAppController();
        initEventScreen(appController);
        const messageHandler = findOnHandler('app:screen:message');

        const fromScreenEvent: any = {};
        await messageHandler(fromScreenEvent, {
            isScreen: true,
            screenId: 3,
            type: 'draw',
            data: { action: 'clear' },
        });
        expect(
            appController.mainController.sendScreenMessage,
        ).toHaveBeenCalledWith({
            screenId: 3,
            type: 'draw',
            data: { action: 'clear' },
        });
        expect(fromScreenEvent.returnValue).toBe(true);

        const toScreenEvent: any = {};
        await messageHandler(toScreenEvent, {
            isScreen: false,
            screenId: 3,
            type: 'draw',
            data: { action: 'clear' },
        });
        expect(screenInstance.sendMessage).toHaveBeenCalledWith('draw', {
            action: 'clear',
        });

        // a closed screen simply drops the message
        screenInstance.sendMessage.mockClear();
        screenControllerMocks.getInstance.mockReturnValueOnce(null);
        await messageHandler(
            {},
            { isScreen: false, screenId: 9, type: 'draw' },
        );
        expect(screenInstance.sendMessage).not.toHaveBeenCalled();

        findOnHandler('screen:app:change-bible')(
            {},
            {
                screenId: 2,
                isNext: true,
            },
        );
        expect(appController.mainController.changeBible).toHaveBeenCalledWith({
            screenId: 2,
            isNext: true,
        });
    });

    test('finder handlers fan out to every non-finder window', () => {
        const targetWin = createMockBrowserWindow();
        getAllNoneFinderWindows.mockReturnValue([targetWin] as any);

        initFinderEvent();

        findOnHandler('finder:app:search-in-page')({}, 'grace');
        expect(targetWin.webContents.findInPage).toHaveBeenCalledWith(
            'grace',
            {},
        );

        findOnHandler('finder:app:stop-search-in-page')({}, 'clearSelection');
        expect(targetWin.webContents.stopFindInPage).toHaveBeenCalledWith(
            'clearSelection',
        );
    });

    test('archive, conversion, and office handlers forward their payloads', async () => {
        const appController = createAppController();
        initEventOther(appController);
        const sender = { send: vi.fn() };
        const call = async (eventName: string, data: Record<string, any>) => {
            await findOnHandler(eventName)(
                { sender },
                { replyEventName: `reply:${eventName}`, ...data },
            );
        };

        await call('main:app:tar-extract', {
            filePath: '/tmp/a.tar.gz',
            outputDir: '/tmp/out',
        });
        expect(tarExtract).toHaveBeenCalledWith(
            '/tmp/a.tar.gz',
            '/tmp/out',
            // Only the whole-data archive asks for specific entries.
            undefined,
        );

        await call('main:app:convert-to-pdf', {
            officeFilePath: '/tmp/a.docx',
            pdfFilePath: '/tmp/a.pdf',
        });
        expect(officeFileToPdf).toHaveBeenCalledWith(
            '/tmp/a.docx',
            '/tmp/a.pdf',
        );

        await call('main:app:pdf-to-images', {
            filePath: '/tmp/a.pdf',
            outDir: '/tmp/out',
            isForce: true,
        });
        expect(pdfToImages).toHaveBeenCalledWith(
            '/tmp/a.pdf',
            '/tmp/out',
            1280,
            true,
        );

        await call('main:app:pdf-pages-count', { filePath: '/tmp/a.pdf' });
        expect(getPagesCount).toHaveBeenCalledWith('/tmp/a.pdf');

        await call('main:app:ms-pp-slides-count', {
            filePath: '/tmp/a.pptx',
        });
        expect(getPptxSlidesCount).toHaveBeenCalledWith('/tmp/a.pptx');

        await call('main:app:capture-web-screen-shot', {
            url: 'https://example.com',
            width: 800,
            height: 600,
        });
        expect(captureWebScreenShot).toHaveBeenCalledWith(
            'https://example.com',
            expect.objectContaining({ width: 800, height: 600 }),
        );

        await call('main:app:pptx-to-htmls', { filePath: '/tmp/a.pptx' });
        expect(pptxToHtmls).toHaveBeenCalledWith(
            expect.objectContaining({ filePath: '/tmp/a.pptx' }),
        );

        await call('main:app:get-pptx-to-htmls-version', {});
        expect(getPptxToHtmlsVersion).toHaveBeenCalledTimes(1);

        await call('main:app:docx-to-htmls', { filePath: '/tmp/a.docx' });
        expect(docxToHtmls).toHaveBeenCalledTimes(1);

        await call('main:app:get-docx-to-htmls-version', {});
        expect(getDocxToHtmlsVersion).toHaveBeenCalledTimes(1);
    });

    test('the font list is enumerated once and cached for the app run', async () => {
        const appController = createAppController();
        initEventOther(appController);
        await flushPromises();

        const sender = { send: vi.fn() };
        await findOnHandler('main:app:get-font-list')(
            { sender },
            { replyEventName: 'reply:fonts' },
        );

        expect(sender.send).toHaveBeenCalledWith('reply:fonts', {
            Arial: [],
            'Khmer OS': [],
        });

        // enumerating fonts spawns a shell helper, so the map is built once for
        // the whole app run however many windows ask for it
        const callCount = getFonts.mock.calls.length;
        await findOnHandler('main:app:get-font-list')(
            { sender },
            { replyEventName: 'reply:fonts' },
        );
        expect(getFonts.mock.calls).toHaveLength(callCount);
    });

    test('reveal and trash guard against empty paths and retry deletions', async () => {
        vi.useFakeTimers();
        try {
            const appController = createAppController();
            initEventOther(appController);

            findOnHandler('main:app:reveal-path')({}, '');
            expect(
                electronMockState.shell.showItemInFolder,
            ).not.toHaveBeenCalled();
            findOnHandler('main:app:reveal-path')({}, '/tmp/a.txt');
            expect(
                electronMockState.shell.showItemInFolder,
            ).toHaveBeenCalledTimes(1);

            const trashPath = findOnHandler('main:app:trash-path');
            const sender = { send: vi.fn() };
            await trashPath(
                { sender },
                { replyEventName: 'reply:t', path: '' },
            );
            expect(sender.send).toHaveBeenCalledWith('reply:t', false);

            // a locked file is retried after a back-off
            electronMockState.shell.trashItem
                .mockRejectedValueOnce(new Error('locked'))
                .mockResolvedValueOnce(undefined);
            sender.send.mockClear();
            const pending = trashPath(
                { sender },
                { replyEventName: 'reply:t', path: '/tmp/a.txt' },
            );
            await vi.advanceTimersByTimeAsync(1000);
            await pending;
            expect(sender.send).toHaveBeenCalledWith('reply:t', true);

            // still locked after every attempt: report the failure
            electronMockState.shell.trashItem.mockRejectedValue(
                new Error('locked'),
            );
            sender.send.mockClear();
            const failing = trashPath(
                { sender },
                { replyEventName: 'reply:t', path: '/tmp/a.txt' },
            );
            await vi.advanceTimersByTimeAsync(5000);
            await failing;
            expect(sender.send).toHaveBeenCalledWith('reply:t', false);
        } finally {
            vi.useRealTimers();
        }
    });

    test('theme, download, reload, log, and zoom handlers', async () => {
        const appController = createAppController();
        initEventOther(appController);

        findOnHandler('main:app:go-download')({});
        expect(goDownload).toHaveBeenCalledTimes(1);

        const setTheme = findOnHandler('main:app:set-theme');
        setTheme({}, 'nonsense');
        expect(appController.settingManager.themeSource).toBe('system');
        // already the active theme: nothing to do
        electronMockState.nativeTheme.themeSource = 'dark';
        setTheme({}, 'dark');
        expect(appController.settingManager.themeSource).toBe('system');
        electronMockState.nativeTheme.themeSource = 'system';
        setTheme({}, 'light');
        expect(appController.settingManager.themeSource).toBe('light');

        findOnHandler('all:app:force-reload')({});
        expect(appController.reloadAll).toHaveBeenCalledTimes(1);

        findOnHandler('all:app:log')({}, ['hello', 'world']);
        expect(consoleLogSpy).toHaveBeenCalledWith('hello', 'world');

        const zoomEvent: any = {};
        findOnHandler('all:app:get-zoom-factor')(zoomEvent);
        expect(zoomEvent.returnValue).toBe(1.5);
    });

    test('camera access is granted on macOS and reported when it throws', async () => {
        const appController = createAppController();
        initEventOther(appController);
        const askCamera = findOnHandler('main:app:ask-camera-access');
        const sender = { send: vi.fn() };

        electronMockState.systemPreferences.askForMediaAccess.mockResolvedValue(
            true,
        );
        await askCamera({ sender }, { replyEventName: 'reply:cam' });
        expect(sender.send).toHaveBeenCalledWith('reply:cam', true);

        sender.send.mockClear();
        electronMockState.systemPreferences.askForMediaAccess.mockRejectedValue(
            new Error('denied'),
        );
        await askCamera({ sender }, { replyEventName: 'reply:cam' });
        expect(sender.send).toHaveBeenCalledWith('reply:cam', false);
    });

    test('printing reports both content and preview failures', async () => {
        const win = createMockBrowserWindow();
        electronMockState.setBrowserWindowFactory(() => win);
        electronMockState.BrowserWindowMock();
        const appController = createAppController();
        initEventOther(appController);
        const printHandler = findOnHandler('all:app:print');

        printHTMLContent.mockRejectedValueOnce(new Error('print failed'));
        printHandler({ sender: win.webContents }, '<html>Note</html>');
        await flushPromises();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Print content failed:',
            expect.any(Error),
        );

        previewPrintCurrentWindow.mockRejectedValueOnce(
            new Error('preview failed'),
        );
        printHandler({ sender: win.webContents });
        await flushPromises();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Print preview failed:',
            expect.any(Error),
        );
    });

    test('always-on-top handlers act only on a resolvable window', () => {
        const win = createMockBrowserWindow();
        win.isAlwaysOnTop = vi.fn(() => true) as any;
        electronMockState.setBrowserWindowFactory(() => win);
        electronMockState.BrowserWindowMock();
        const appController = createAppController();
        initEventOther(appController);

        const checkEvent: any = { sender: win.webContents };
        findOnHandler('all:app:check-is-window-on-top')(checkEvent);
        expect(checkEvent.returnValue).toBe(true);

        findOnHandler('all:app:set-is-window-on-top')(
            { sender: win.webContents },
            { isOnTop: true },
        );
        expect(win.setAlwaysOnTop).toHaveBeenCalledWith(true);

        // an unknown sender resolves to no window at all
        const unknownEvent: any = { sender: { id: 'gone' } };
        expect(
            findOnHandler('all:app:check-is-window-on-top')(unknownEvent),
        ).toBe(false);
        expect(unknownEvent.returnValue).toBeUndefined();
        expect(
            findOnHandler('all:app:set-is-window-on-top')(unknownEvent, {
                isOnTop: true,
            }),
        ).toBe(false);
    });

    test('custom menu items are registered and routed to their owner window', () => {
        const ownerWin = createMockBrowserWindow();
        electronMockState.setBrowserWindowFactory(() => ownerWin);
        electronMockState.BrowserWindowMock();
        const appController = createAppController();
        initEventOther(appController);

        findOnHandler('main:app:set-menu-items')(
            { sender: ownerWin.webContents },
            { key: 'lang', menusData: { tools: [{ label: 'Editor' }] } },
        );

        expect(initMenu).toHaveBeenCalledWith(appController);
        const [key, payload] = setCustomMenusData.mock.calls.at(-1) as any;
        expect(key).toBe('lang');
        payload.clickMenu({ openExternalUrl: 'https://example.com' });
        expect(sendMenuClicked).toHaveBeenCalledWith(
            { openExternalUrl: 'https://example.com' },
            ownerWin,
        );

        findOnHandler('main:app:set-menu-items')(
            { sender: ownerWin.webContents },
            { key: 'lang', menusData: null },
        );
        expect(setCustomMenusData).toHaveBeenLastCalledWith('lang', null);
    });

    test('client settings are read, written, deleted, listed, and cleared', () => {
        const appController = createAppController();
        initEventOther(appController);
        const clientSetting = findOnHandler('main:app:client-setting');
        const call = (data: Record<string, any>) => {
            const event: any = {};
            clientSetting(event, data);
            return event.returnValue;
        };

        expect(call({ key: 'a', type: 'get' })).toBe('stored-value');
        expect(call({ key: 'a', type: 'set', value: 1 })).toBe(true);
        expect(
            appController.settingManager.setClientSetting,
        ).toHaveBeenCalledWith('a', 1);
        expect(call({ key: 'a', type: 'delete' })).toBe(true);
        expect(call({ key: '', type: 'get-all-keys' })).toBe('["a","b"]');
        expect(call({ key: '', type: 'clear' })).toBe(true);
        // an unknown operation returns nothing rather than throwing
        expect(call({ key: 'a', type: 'unknown' as any })).toBeNull();
    });
});
