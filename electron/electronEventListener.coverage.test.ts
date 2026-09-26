import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

const {
    attemptClosing,
    answerAiChatMicrophoneAsk,
    answerGuideHelp,
    askGuideHelp,
    captureOAuthRedirectUrl,
    captureWindowImage,
    captureWebScreenShot,
    clearAiChatGuestData,
    docxToHtmls,
    getDocxToHtmlsVersion,
    findScreenWindow,
    getMcpToken,
    getMcpUrl,
    getRemoteDebuggingPort,
    getSystemFontListMap,
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
    readWebPage,
    relaunchApp,
    screenControllerMocks,
    screenInstance,
    sendChatAttachment,
    sendMenuClicked,
    setGuideRunning,
    setCustomMenusData,
    takeChatAttachment,
    tarAppend,
    tarCreate,
    tarExtract,
    closeFindOverlayMock,
    finderOverlayPairs,
    startFindOverlayDraggingMock,
    stopFindOverlayDraggingMock,
} = vi.hoisted(() => ({
    attemptClosing: vi.fn(),
    answerAiChatMicrophoneAsk: vi.fn(),
    answerGuideHelp: vi.fn(),
    askGuideHelp: vi.fn(),
    captureOAuthRedirectUrl: vi.fn(),
    captureWindowImage: vi.fn(),
    captureWebScreenShot: vi.fn(),
    clearAiChatGuestData: vi.fn(async () => undefined),
    docxToHtmls: vi.fn(),
    getDocxToHtmlsVersion: vi.fn(),
    findScreenWindow: vi.fn(),
    getMcpToken: vi.fn(() => 'mcp-token'),
    getMcpUrl: vi.fn(() => 'http://127.0.0.1:43123/mcp'),
    getRemoteDebuggingPort: vi.fn(() => 51234),
    getSystemFontListMap: vi.fn(async () => ({
        Arial: ['400', '700'],
        'Khmer OS': ['400'],
    })),
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
    readWebPage: vi.fn(),
    relaunchApp: vi.fn(),
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
    sendChatAttachment: vi.fn(),
    sendMenuClicked: vi.fn(),
    setGuideRunning: vi.fn(),
    setCustomMenusData: vi.fn(),
    takeChatAttachment: vi.fn(() => ({ image: 'pending' })),
    tarAppend: vi.fn(),
    tarCreate: vi.fn(),
    tarExtract: vi.fn(),
    closeFindOverlayMock: vi.fn(),
    finderOverlayPairs: new Map<any, any>(),
    startFindOverlayDraggingMock: vi.fn(),
    stopFindOverlayDraggingMock: vi.fn(),
}));

vi.mock('./fontListHelpers', () => ({
    getSystemFontListMap,
}));

vi.mock('./electronHelpers', () => ({
    attemptClosing,
    answerGuideHelp,
    askGuideHelp,
    captureWindowImage,
    captureWebScreenShot,
    findScreenWindow,
    getUpdatePageUrl: vi.fn(
        () => 'ms-windows-store://pdp/?ProductId=9NBLGGH4NNS1',
    ),
    goDownload,
    isMac: true,
    messageChannels: { screenMessage: 'app:screen:message' },
    previewPrintCurrentWindow,
    printHTMLContent,
    sendChatAttachment,
    setGuideRunning,
    takeChatAttachment,
    tarAppend,
    tarCreate,
    tarExtract,
}));

vi.mock('./aiHelpers', () => ({
    getMcpToken,
    getMcpUrl,
    getRemoteDebuggingPort,
}));

vi.mock('./aiChatGuestHelpers', () => ({
    AI_CHAT_MICROPHONE_ANSWER_CHANNEL: 'main:app:ai-chat-microphone-answer',
    answerAiChatMicrophoneAsk,
    clearAiChatGuestData,
}));

vi.mock('./oauthHelpers', () => ({ captureOAuthRedirectUrl }));
vi.mock('./taskbarHelpers', () => ({ relaunchApp }));
vi.mock('./webPageHelpers', () => ({ readWebPage }));

// The bar's own web contents is the IPC sender; main resolves it to the page
// it searches. Here the fixture pairs them up directly.
vi.mock('./finderOverlayHelpers', () => ({
    closeFindOverlay: closeFindOverlayMock,
    getFindOverlayHostWebContents: (webContents: any) => {
        return finderOverlayPairs.get(webContents) ?? null;
    },
    getFindOverlayWebContents: (hostWebContents: any) => {
        for (const [overlay, host] of finderOverlayPairs.entries()) {
            if (host === hostWebContents) {
                return overlay;
            }
        }
        return null;
    },
    startFindOverlayDragging: startFindOverlayDraggingMock,
    stopFindOverlayDragging: stopFindOverlayDraggingMock,
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
            getSecureSetting: vi.fn(() => 'stored-secret'),
            setSecureSetting: vi.fn(),
            deleteSecureSetting: vi.fn(),
            clearSecureSettings: vi.fn(),
            checkIsSecureStorageAvailable: vi.fn(() => true),
        },
        resetThemeBackgroundColor: vi.fn(),
        reloadAll: vi.fn(),
        sendMessageToAll: vi.fn(),
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
        getSystemFontListMap.mockResolvedValue({
            Arial: ['400', '700'],
            'Khmer OS': ['400'],
        });
        finderOverlayPairs.clear();
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

    test('finder handlers drive the page the bar is pinned to', () => {
        const targetWin = createMockBrowserWindow();
        const otherWin = createMockBrowserWindow();
        const overlayWebContents = { id: 99, send: vi.fn() };
        finderOverlayPairs.set(overlayWebContents, targetWin.webContents);
        electronMockState.browserWindows.push(targetWin, otherWin);

        initFinderEvent();

        findOnHandler('finder:app:search-in-page')(
            { sender: overlayWebContents },
            'grace',
        );
        expect(targetWin.webContents.findInPage).toHaveBeenCalledWith(
            'grace',
            {},
        );
        expect(otherWin.webContents.findInPage).not.toHaveBeenCalled();

        findOnHandler('finder:app:stop-search-in-page')(
            { sender: overlayWebContents },
            'clearSelection',
        );
        expect(targetWin.webContents.stopFindInPage).toHaveBeenCalledWith(
            'clearSelection',
        );
        expect(otherWin.webContents.stopFindInPage).not.toHaveBeenCalled();
    });

    test('a search from an unknown sender touches nothing', () => {
        const targetWin = createMockBrowserWindow();
        electronMockState.browserWindows.push(targetWin);

        initFinderEvent();
        findOnHandler('finder:app:search-in-page')(
            { sender: { id: 1234 } },
            'grace',
        );

        expect(targetWin.webContents.findInPage).not.toHaveBeenCalled();
    });

    test('forwards the match count back to the find bar once', () => {
        const targetWin = createMockBrowserWindow();
        const overlayWebContents = {
            id: 98,
            send: vi.fn(),
            isDestroyed: () => false,
        };
        finderOverlayPairs.set(overlayWebContents, targetWin.webContents);

        initFinderEvent();

        const searchHandler = findOnHandler('finder:app:search-in-page');
        searchHandler({ sender: overlayWebContents }, 'grace');
        searchHandler({ sender: overlayWebContents }, 'grace', {
            findNext: true,
        });

        // The `found-in-page` listener is attached once per web contents, not
        // once per search -- otherwise every keystroke stacks another one.
        const foundInPageCalls = targetWin.webContents.on.mock.calls.filter(
            ([eventName]: [string]) => {
                return eventName === 'found-in-page';
            },
        );
        expect(foundInPageCalls).toHaveLength(1);

        foundInPageCalls[0][1]({}, {
            activeMatchOrdinal: 2,
            matches: 7,
            finalUpdate: true,
        } as any);
        expect(overlayWebContents.send).toHaveBeenCalledWith(
            'main:app:found-in-page',
            { activeMatchOrdinal: 2, matches: 7, finalUpdate: true },
        );
        overlayWebContents.isDestroyed = () => true;
        overlayWebContents.send.mockClear();
        foundInPageCalls[0][1]({}, {
            activeMatchOrdinal: 3,
            matches: 7,
            finalUpdate: true,
        } as any);
        expect(overlayWebContents.send).not.toHaveBeenCalled();
    });

    test('close and drag requests reach the overlay helpers', () => {
        initFinderEvent();
        const sender = { id: 97 };

        findOnHandler('finder:app:close')({ sender });
        findOnHandler('finder:app:drag-start')({ sender }, 24);
        findOnHandler('finder:app:drag-stop')({ sender });

        expect(closeFindOverlayMock).toHaveBeenCalledWith(sender);
        expect(startFindOverlayDraggingMock).toHaveBeenCalledWith(sender, 24);
        expect(stopFindOverlayDraggingMock).toHaveBeenCalledWith(sender);
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
            progressEventName: 'reply:pdf-progress',
        });
        expect(pdfToImages).toHaveBeenCalledWith(
            '/tmp/a.pdf',
            '/tmp/out',
            1280,
            true,
            expect.any(Function),
        );
        pdfToImages.mock.calls.at(-1)?.[4](12, 25);
        expect(sender.send).toHaveBeenCalledWith('reply:pdf-progress', {
            completed: 12,
            total: 25,
        });

        await call('main:app:pdf-to-images', {
            filePath: '/tmp/no-progress.pdf',
            outDir: '/tmp/out',
            isForce: false,
        });
        pdfToImages.mock.calls.at(-1)?.[4](1, 1);

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
            Arial: ['400', '700'],
            'Khmer OS': ['400'],
        });

        // enumerating fonts spawns a shell helper, so the map is built once for
        // the whole app run however many windows ask for it
        const callCount = getSystemFontListMap.mock.calls.length;
        await findOnHandler('main:app:get-font-list')(
            { sender },
            { replyEventName: 'reply:fonts' },
        );
        expect(getSystemFontListMap.mock.calls).toHaveLength(callCount);
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

            // A drive with no Recycle Bin (a USB stick on Windows) is refused
            // at once: no five seconds of retries before the renderer can ask
            // whether to delete it outright.
            electronMockState.shell.trashItem.mockReset();
            electronMockState.shell.trashItem.mockRejectedValue(
                new Error('Operation was aborted'),
            );
            sender.send.mockClear();
            await trashPath(
                { sender },
                { replyEventName: 'reply:t', path: '/tmp/a.txt' },
            );
            expect(sender.send).toHaveBeenCalledWith('reply:t', false);
            expect(electronMockState.shell.trashItem).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    test('theme, download, reload, log, and zoom handlers', async () => {
        const appController = createAppController();
        initEventOther(appController);

        findOnHandler('main:app:go-download')({});
        expect(goDownload).toHaveBeenCalledTimes(1);

        // The in-app update check's Store/website hand-off: whatever
        // `getUpdatePageUrl` decides is what gets opened, unaltered.
        findOnHandler('main:app:go-update')({});
        expect(electronMockState.shell.openExternal).toHaveBeenCalledWith(
            'ms-windows-store://pdp/?ProductId=9NBLGGH4NNS1',
        );

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

    test('app IPC exposes AI endpoints, guest cleanup, microphone answers, and screenshots', async () => {
        const appController = createAppController();
        const screenWin = createMockBrowserWindow();
        findScreenWindow.mockReturnValue(screenWin);
        captureWindowImage.mockResolvedValue('data:image/png;base64,SHOT');
        initEventListenerApp(appController);

        const endpointsEvent: any = {};
        findOnHandler('main:app:get-ai-endpoints')(endpointsEvent);
        expect(endpointsEvent.returnValue).toEqual({
            mcpUrl: 'http://127.0.0.1:43123/mcp',
            mcpToken: 'mcp-token',
            cdpPort: 51234,
        });

        const sender = { id: 77, send: vi.fn() };
        await findOnHandler('main:app:clear-ai-chat-data')(
            { sender },
            { replyEventName: 'reply:clear' },
        );
        expect(clearAiChatGuestData).toHaveBeenCalledTimes(1);
        expect(sender.send).toHaveBeenCalledWith('reply:clear', true);

        findOnHandler('main:app:ai-chat-microphone-answer')(
            { sender },
            { allow: true },
        );
        expect(answerAiChatMicrophoneAsk).toHaveBeenCalledWith(77, {
            allow: true,
        });

        sender.send.mockClear();
        await findOnHandler('main:app:capture-window')(
            { sender },
            { replyEventName: 'reply:main' },
        );
        expect(captureWindowImage).toHaveBeenCalledWith(appController.mainWin);
        expect(sender.send).toHaveBeenCalledWith(
            'reply:main',
            'data:image/png;base64,SHOT',
        );

        await findOnHandler('main:app:capture-window')(
            { sender },
            { replyEventName: 'reply:screen', screenId: 4 },
        );
        expect(findScreenWindow).toHaveBeenCalledWith(4);
        expect(captureWindowImage).toHaveBeenLastCalledWith(screenWin);
    });

    test('routes remaining main-process services and walkthrough messages', async () => {
        const appController = createAppController();
        initEventOther(appController);
        const sender = { send: vi.fn() };
        const call = async (eventName: string, data: Record<string, any>) => {
            await findOnHandler(eventName)(
                { sender },
                { replyEventName: `reply:${eventName}`, ...data },
            );
        };

        await call('main:app:oauth-authorize', {
            authorizeUrl: 'https://accounts.example/authorize',
            redirectUriPrefix: 'https://app.example/callback',
        });
        expect(captureOAuthRedirectUrl).toHaveBeenCalledTimes(1);

        await call('main:app:tar-append', {
            archiveFilePath: '/tmp/archive.tar',
            inputDir: '/tmp/input',
            files: ['new.txt'],
        });
        expect(tarAppend).toHaveBeenCalledWith(
            '/tmp/archive.tar',
            '/tmp/input',
            ['new.txt'],
        );

        findOnHandler('main:app:copy-to-clipboard')({}, null);
        expect(electronMockState.clipboard.writeText).not.toHaveBeenCalled();
        findOnHandler('main:app:copy-to-clipboard')({}, 'copied');
        expect(electronMockState.clipboard.writeText).toHaveBeenCalledWith(
            'copied',
        );

        electronMockState.shell.openExternal.mockRejectedValueOnce(
            new Error('no browser'),
        );
        findOnHandler('main:app:go-update')({});
        await flushPromises();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to open the update page:',
            expect.any(Error),
        );

        findOnHandler('main:app:relaunch')({});
        expect(relaunchApp).toHaveBeenCalledTimes(1);
        findOnHandler('all:app:extra-bin-changed')({});
        expect(appController.sendMessageToAll).toHaveBeenCalledWith(
            'main:app:extra-bin-changed',
        );

        await call('main:app:read-web-page', {
            url: 'https://example.com',
            maxChars: 400,
        });
        expect(readWebPage).toHaveBeenCalledWith(
            'https://example.com',
            expect.objectContaining({ maxChars: 400 }),
        );

        const mainEvent: any = { sender: appController.mainWin.webContents };
        findOnHandler('all:app:check-is-main-window')(mainEvent);
        expect(mainEvent.returnValue).toBe(true);

        const unknownSender = { id: 'unknown' };
        findOnHandler('all:app:guide-running')(
            { sender: unknownSender },
            { isRunning: true },
        );
        findOnHandler('all:app:guide-help')(
            { sender: unknownSender },
            { question: 'where?' },
        );
        expect(setGuideRunning).not.toHaveBeenCalled();
        expect(askGuideHelp).not.toHaveBeenCalled();

        const win = createMockBrowserWindow();
        electronMockState.setBrowserWindowFactory(() => win);
        electronMockState.BrowserWindowMock();
        findOnHandler('all:app:guide-running')(
            { sender: win.webContents },
            { isRunning: true },
        );
        findOnHandler('all:app:guide-help')({ sender: win.webContents }, null);
        findOnHandler('all:app:guide-help-answer')({}, null);
        findOnHandler('all:app:chat-attach')({}, null);
        const attachmentEvent: any = {};
        findOnHandler('main:app:take-chat-attachment')(attachmentEvent);

        expect(setGuideRunning).toHaveBeenCalledWith(win, true);
        expect(askGuideHelp).toHaveBeenCalledWith(win, {});
        expect(answerGuideHelp).toHaveBeenCalledWith({});
        expect(sendChatAttachment).toHaveBeenCalledWith({});
        expect(attachmentEvent.returnValue).toEqual({ image: 'pending' });
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

    test('secure settings are read, written, deleted, cleared, and probed', () => {
        const appController = createAppController();
        initEventOther(appController);
        const secureSetting = findOnHandler('main:app:secure-setting');
        const call = (data: Record<string, any>) => {
            const event: any = {};
            secureSetting(event, data);
            return event.returnValue;
        };

        expect(call({ key: 'a', type: 'get' })).toBe('stored-secret');
        expect(call({ key: 'a', type: 'set', value: 'sk-key' })).toBe(true);
        expect(
            appController.settingManager.setSecureSetting,
        ).toHaveBeenCalledWith('a', 'sk-key');
        expect(call({ key: 'a', type: 'delete' })).toBe(true);
        expect(
            appController.settingManager.deleteSecureSetting,
        ).toHaveBeenCalledWith('a');
        expect(call({ key: '', type: 'clear' })).toBe(true);
        expect(
            appController.settingManager.clearSecureSettings,
        ).toHaveBeenCalled();
        expect(call({ key: '', type: 'is-available' })).toBe(true);
        // an unknown operation returns nothing rather than throwing
        expect(call({ key: 'a', type: 'unknown' as any })).toBeNull();
    });

    test('retries an empty or failed system-font enumeration', async () => {
        getSystemFontListMap
            .mockResolvedValueOnce({})
            .mockRejectedValueOnce(new Error('font helper failed'));
        vi.resetModules();
        const fresh = await import('./electronEventListener');
        const electron = (await import('electron')) as any;
        fresh.initEventOther(createAppController());
        await flushPromises();
        const fontHandler = electron.ipcMain.on.mock.calls.find(
            ([name]: [string]) => name === 'main:app:get-font-list',
        )?.[1];
        const sender = { send: vi.fn() };

        await fontHandler(
            { sender },
            { replyEventName: 'reply:fonts-after-empty' },
        );

        expect(sender.send).toHaveBeenCalledWith(
            'reply:fonts-after-empty',
            null,
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.any(Error));
    });
});
