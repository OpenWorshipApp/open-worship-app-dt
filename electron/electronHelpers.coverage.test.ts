import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { mkdir, readdir, readFile, rm, writeFile, tarC, tarX, tarR } =
    vi.hoisted(() => ({
        mkdir: vi.fn(),
        readdir: vi.fn(),
        readFile: vi.fn(),
        rm: vi.fn(),
        writeFile: vi.fn(),
        tarC: vi.fn(async () => undefined),
        tarX: vi.fn(async () => undefined),
        tarR: vi.fn(async () => undefined),
    }));

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

vi.mock('node:fs/promises', () => ({
    mkdir,
    readdir,
    readFile,
    rm,
    writeFile,
}));

vi.mock('tar', () => ({ c: tarC, x: tarX, r: tarR }));

const { settingManagerMock } = vi.hoisted(() => ({
    settingManagerMock: {
        getPopupWinBounds: vi.fn(() => null as any),
        setPopupWinBounds: vi.fn(),
        clearPopupWinBounds: vi.fn(),
        getClientSetting: vi.fn(() => ''),
    },
}));

vi.mock('./ElectronSettingManager', () => ({
    default: {
        getInstance: () => {
            return settingManagerMock;
        },
    },
}));

import {
    captureWindowImage,
    captureWebScreenShot,
    copyDebugInfoToClipboard,
    findScreenWindow,
    genTimeoutAttempt,
    guardBrowsing,
    POPUP_FRAME_NAME_PREFIX,
    previewPrintCurrentWindow,
    printCurrentWindow,
    printHTMLContent,
    resetPopupWindowsBounds,
    sendChatAttachment,
    tarAppend,
    tarCreate,
    tarExtract,
    takeChatAttachment,
} from './electronHelpers';
import { electronMockState } from './testElectronModule';
import {
    createMockBrowserWindow,
    createMockWebContents,
    flushPromises,
} from './testUtils';

function createWindowAt(
    url: string,
    bounds: { x: number; y: number },
    overrides: Record<string, any> = {},
) {
    return createMockBrowserWindow({
        webContents: createMockWebContents({ getURL: vi.fn(() => url) }),
        getBounds: vi.fn(() => ({ ...bounds, width: 800, height: 600 })),
        ...overrides,
    });
}

describe('electronHelpers coverage', () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        electronMockState.reset();
        vi.clearAllMocks();
        mkdir.mockResolvedValue(undefined);
        readdir.mockResolvedValue([]);
        readFile.mockResolvedValue('');
        rm.mockResolvedValue(undefined);
        writeFile.mockResolvedValue(undefined);
        tarC.mockResolvedValue(undefined);
        tarX.mockResolvedValue(undefined);
        tarR.mockResolvedValue(undefined);
        settingManagerMock.getPopupWinBounds.mockClear().mockReturnValue(null);
        settingManagerMock.setPopupWinBounds.mockClear();
        settingManagerMock.clearPopupWinBounds.mockClear();
        settingManagerMock.getClientSetting.mockClear().mockReturnValue('');
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        vi.useRealTimers();
    });

    test('extracts and creates tar archives', async () => {
        await tarExtract('/tmp/a.tar.gz', '/tmp/out');
        expect(tarX).toHaveBeenCalledWith(
            {
                file: '/tmp/a.tar.gz',
                cwd: '/tmp/out',
            },
            undefined,
        );

        // A whole-data archive names the entries it wants so the rest of a
        // multi-gigabyte bundle is never unpacked.
        await tarExtract('/tmp/a.tar', '/tmp/out', ['manifest.json']);
        expect(tarX).toHaveBeenLastCalledWith(expect.any(Object), [
            'manifest.json',
        ]);

        await tarCreate('/tmp/in', '/tmp/a.tar.gz', ['one.json'], true);
        expect(tarC).toHaveBeenCalledWith(
            {
                cwd: '/tmp/in',
                file: '/tmp/a.tar.gz',
                gzip: true,
                portable: true,
                filter: undefined,
            },
            ['one.json'],
        );

        // gzip is opt-in
        await tarCreate('/tmp/in', '/tmp/a.tar', ['one.json']);
        expect(tarC).toHaveBeenLastCalledWith(
            expect.objectContaining({ gzip: false }),
            ['one.json'],
        );
    });

    test('tar-create filters out matching path segments', async () => {
        await tarCreate('/tmp/in', '/tmp/a.tar', ['documents'], false, [
            '\\.[^.]+-htmls$',
        ]);
        const { filter } = tarC.mock.calls.at(-1)?.[0] as {
            filter: (entryPath: string) => boolean;
        };

        // The cache folder and everything under it go; a folder that merely
        // ends in the same word stays.
        expect(filter('documents/a.pptx-htmls')).toBe(false);
        expect(filter('documents/a.pptx-htmls/1.html')).toBe(false);
        expect(filter('documents/wedding-htmls')).toBe(true);
        expect(filter('documents/a.ows')).toBe(true);
    });

    test('appends to an existing tar', async () => {
        await tarAppend('/tmp/a.tar', '/tmp/staging', ['manifest.json']);
        expect(tarR).toHaveBeenCalledWith(
            { file: '/tmp/a.tar', cwd: '/tmp/staging', portable: true },
            ['manifest.json'],
        );
    });

    test('debug info falls back when the build stamp is missing', () => {
        // `package-info.json` is generated by the build, so a source checkout
        // has nothing to report
        copyDebugInfoToClipboard();
        expect(electronMockState.clipboard.writeText).toHaveBeenCalledWith(
            'No package info available',
        );

        copyDebugInfoToClipboard(true);
        expect(electronMockState.clipboard.writeText).toHaveBeenCalledTimes(2);
    });

    test('a popup joins its existing group instead of opening a duplicate', () => {
        vi.useFakeTimers();
        // Same page, different uuid: it belongs to the group but is not the
        // same window, so a new popup is still allowed — offset past the group.
        const groupWin = createWindowAt(
            'https://localhost:3000/about.html?zeta=1&alpha=2&uuid=other',
            { x: 100, y: 200 },
            // minimized to the dock: it has to be restored before it is raised
            { isMinimized: vi.fn(() => true) },
        );
        const parentWin = createMockBrowserWindow();
        electronMockState.browserWindows.push(groupWin, parentWin);

        guardBrowsing(parentWin as any, { preload: '/tmp/preload.js' } as any);
        const windowOpenHandler =
            parentWin.webContents.setWindowOpenHandler.mock.calls[0][0];

        const response = windowOpenHandler({
            url: 'https://localhost:3000/about.html?alpha=2&zeta=1&uuid=about',
            frameName: `${POPUP_FRAME_NAME_PREFIX}_about`,
            features: 'popup,appFollowScale,appAlwaysOnTop,appShowMenuBar',
        } as any);

        expect(response.action).toBe('allow');
        expect(response.overrideBrowserWindowOptions.x).toBe(120);
        expect(response.overrideBrowserWindowOptions.y).toBe(220);

        // the existing group members are raised
        vi.runAllTimers();
        expect(groupWin.restore).toHaveBeenCalledTimes(1);
        expect(groupWin.focus).toHaveBeenCalledTimes(1);

        const popupWin = createMockBrowserWindow();
        electronMockState.setBrowserWindowFactory(() => popupWin);
        response.createWindow(response.overrideBrowserWindowOptions);

        expect(popupWin.setAlwaysOnTop).toHaveBeenCalledWith(
            true,
            'screen-saver',
        );
        expect(popupWin.setMenuBarVisibility).toHaveBeenCalledWith(true);
        expect(popupWin.setAutoHideMenuBar).toHaveBeenCalledWith(false);

        // `appFollowScale` re-sizes the popup to match the app zoom once loaded
        const didFinishLoad = popupWin.webContents.on.mock.calls.find(
            ([event]) => event === 'did-finish-load',
        )?.[1];
        // an unzoomed window keeps the bounds the popup was opened with
        didFinishLoad();
        expect(popupWin.setBounds).not.toHaveBeenCalled();

        popupWin.webContents.getZoomFactor.mockReturnValue(2);
        popupWin.getBounds.mockReturnValue({
            x: 10,
            y: 20,
            width: 100,
            height: 50,
        });
        didFinishLoad();
        expect(popupWin.setBounds).toHaveBeenCalledWith({
            x: -40,
            y: -5,
            width: 200,
            height: 100,
        });

        // focusing the fresh popup is deferred until it has settled
        vi.runAllTimers();
        expect(popupWin.focus).toHaveBeenCalledTimes(1);
    });

    test('an already-open popup is refused instead of duplicated', () => {
        vi.useFakeTimers();
        const url = 'https://localhost:3000/find.html?uuid=find';
        const selfWin = createWindowAt(url, { x: 0, y: 0 });
        const parentWin = createMockBrowserWindow();
        electronMockState.browserWindows.push(selfWin, parentWin);

        guardBrowsing(parentWin as any, { preload: '/tmp/preload.js' } as any);
        const windowOpenHandler =
            parentWin.webContents.setWindowOpenHandler.mock.calls[0][0];

        const response = windowOpenHandler({
            url,
            frameName: `${POPUP_FRAME_NAME_PREFIX}_find`,
            features: 'popup,appResize=false',
        } as any);

        expect(response).toEqual({ action: 'deny' });
        vi.runAllTimers();
        // already on screen, so it is only raised
        expect(selfWin.restore).not.toHaveBeenCalled();
        expect(selfWin.focus).toHaveBeenCalledTimes(1);
    });

    test('reopening the chatbot sends it the current app page', () => {
        vi.useFakeTimers();
        const url = 'https://localhost:3000/chatbot.html?uuid=chatbot';
        const selfWin = createWindowAt(url, { x: 0, y: 0 });
        const parentWin = createMockBrowserWindow({
            webContents: createMockWebContents({
                getURL: vi.fn(() => 'https://localhost:3000/presenter.html'),
            }),
        });
        electronMockState.browserWindows.push(selfWin, parentWin);

        guardBrowsing(parentWin as any, { preload: '/tmp/preload.js' } as any);
        const windowOpenHandler =
            parentWin.webContents.setWindowOpenHandler.mock.calls[0][0];

        expect(
            windowOpenHandler({
                url,
                frameName: `${POPUP_FRAME_NAME_PREFIX}_chatbot`,
                features: 'popup,appTopToMain',
            } as any),
        ).toEqual({ action: 'deny' });
        expect(selfWin.webContents.send).toHaveBeenCalledWith(
            'main:app:chatbot-launch-focus',
            '/presenter.html',
        );
    });

    test('a non-resizable popup without a menu bar', () => {
        vi.useFakeTimers();
        const parentWin = createMockBrowserWindow();
        guardBrowsing(parentWin as any, { preload: '/tmp/preload.js' } as any);
        const windowOpenHandler =
            parentWin.webContents.setWindowOpenHandler.mock.calls[0][0];

        const response = windowOpenHandler({
            url: 'https://localhost:3000/find.html?uuid=find',
            frameName: `${POPUP_FRAME_NAME_PREFIX}_find`,
            features: 'popup,appResize=false',
        } as any);

        const popupWin = createMockBrowserWindow();
        electronMockState.setBrowserWindowFactory(() => popupWin);
        response.createWindow(response.overrideBrowserWindowOptions);

        expect(popupWin.setResizable).toHaveBeenCalledWith(false);
        expect(popupWin.setMenuBarVisibility).toHaveBeenCalledWith(false);
        expect(popupWin.setAutoHideMenuBar).toHaveBeenCalledWith(true);
        vi.runAllTimers();
    });

    function openPopup(
        parentWin: any,
        {
            url = 'https://localhost:3000/about.html?uuid=about',
            features = 'popup',
        }: { url?: string; features?: string } = {},
    ) {
        guardBrowsing(parentWin, { preload: '/tmp/preload.js' } as any);
        const windowOpenHandler =
            parentWin.webContents.setWindowOpenHandler.mock.calls.at(-1)[0];
        const response = windowOpenHandler({
            url,
            frameName: `${POPUP_FRAME_NAME_PREFIX}_test`,
            features,
        } as any);
        const popupWin = createMockBrowserWindow();
        electronMockState.setBrowserWindowFactory(() => popupWin);
        response.createWindow(response.overrideBrowserWindowOptions);
        return { response, popupWin };
    }

    function getWindowListener(win: any, eventName: string) {
        return win.on.mock.calls.find(([name]: [string]) => {
            return name === eventName;
        })?.[1];
    }

    test('a popup reopens where the user last left it', () => {
        vi.useFakeTimers();
        settingManagerMock.getPopupWinBounds.mockReturnValue({
            x: 1400,
            y: 120,
            width: 460,
            height: 640,
            isMaximized: false,
        });
        const parentWin = createMockBrowserWindow();

        const { response, popupWin } = openPopup(parentWin, {
            // the page's own placement is exactly what the remembered geometry
            // has to win over
            features:
                'popup,width=460,height=640,appAlignHorizontal=right,' +
                'appAlignVertical=center,appFollowScale',
        });

        expect(settingManagerMock.getPopupWinBounds).toHaveBeenCalledWith(
            'about.html',
        );
        expect(response.overrideBrowserWindowOptions).toEqual(
            expect.objectContaining({
                x: 1400,
                y: 120,
                width: 460,
                height: 640,
            }),
        );
        // restored bounds are already at the user's zoom, so re-scaling them
        // would grow the window on every launch
        expect(getWindowListener(popupWin.webContents, 'did-finish-load')).toBe(
            undefined,
        );

        popupWin.getBounds.mockReturnValue({
            x: 1410,
            y: 130,
            width: 500,
            height: 600,
        });
        getWindowListener(popupWin, 'move')();
        expect(settingManagerMock.setPopupWinBounds).toHaveBeenCalledWith(
            'about.html',
            { x: 1410, y: 130, width: 500, height: 600, isMaximized: false },
        );
        vi.runAllTimers();
    });

    test('a maximized popup comes back maximized, remembering its normal size', () => {
        vi.useFakeTimers();
        settingManagerMock.getPopupWinBounds.mockReturnValue({
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
            isMaximized: true,
        });
        const parentWin = createMockBrowserWindow();

        const { popupWin } = openPopup(parentWin);

        expect(popupWin.maximize).toHaveBeenCalledTimes(1);

        popupWin.isMaximized.mockReturnValue(true);
        popupWin.getNormalBounds.mockReturnValue({
            x: 300,
            y: 200,
            width: 700,
            height: 500,
        });
        getWindowListener(popupWin, 'maximize')();
        // the maximized rectangle is the screen, never a size worth restoring
        expect(settingManagerMock.setPopupWinBounds).toHaveBeenCalledWith(
            'about.html',
            { x: 300, y: 200, width: 700, height: 500, isMaximized: true },
        );
        vi.runAllTimers();
    });

    test('a popup that is not one of the app pages is not remembered', () => {
        vi.useFakeTimers();
        const parentWin = createMockBrowserWindow();

        const { popupWin } = openPopup(parentWin, {
            // a pdf preview: keying this would add an entry per file opened
            url: 'file:///data/videos/some-file.pdf?uuid=preview',
        });

        expect(settingManagerMock.getPopupWinBounds).not.toHaveBeenCalled();
        expect(getWindowListener(popupWin, 'move')).toBe(undefined);
        vi.runAllTimers();
    });

    test('resetting the bounds recentres open popups and forgets the saved geometry', () => {
        vi.useFakeTimers();
        const parentWin = createMockBrowserWindow();
        const { popupWin } = openPopup(parentWin);
        settingManagerMock.setPopupWinBounds.mockClear();

        const fallbackWin = createMockBrowserWindow();
        resetPopupWindowsBounds(fallbackWin as any);

        expect(settingManagerMock.clearPopupWinBounds).toHaveBeenCalledTimes(1);
        // back to 90% of the opener, centred on it
        expect(popupWin.setBounds).toHaveBeenCalledWith({
            x: 69,
            y: 79,
            width: 1080,
            height: 680,
        });

        // the move event the reset itself causes must not record the defaults
        // it just applied as the user's choice
        getWindowListener(popupWin, 'move')();
        expect(settingManagerMock.setPopupWinBounds).not.toHaveBeenCalled();

        vi.advanceTimersByTime(2000);
        getWindowListener(popupWin, 'move')();
        expect(settingManagerMock.setPopupWinBounds).toHaveBeenCalledTimes(1);
        vi.runAllTimers();
    });

    test('resetting a popup aligned beside a maximised opener keeps it on screen', () => {
        vi.useFakeTimers();
        electronMockState.screen.getDisplayMatching.mockReturnValue({
            id: 1,
            bounds: { x: 0, y: 0, width: 1494, height: 934 },
            workArea: { x: 0, y: 0, width: 1494, height: 886 },
            size: { width: 1494, height: 934 },
        } as any);
        const parentWin = createMockBrowserWindow({
            getBounds: vi.fn(() => ({ x: 0, y: 0, width: 1494, height: 886 })),
        });
        const { popupWin } = openPopup(parentWin, {
            // the chatbot's own placement: beside the opener, which is off the
            // monitor once the opener fills it
            features:
                'popup,width=460,height=640,appAlignHorizontal=right,' +
                'appAlignVertical=center,appFollowScale',
        });

        resetPopupWindowsBounds(parentWin as any);

        // x would be 1494 -- the far side of the screen -- unclamped
        expect(popupWin.setBounds).toHaveBeenCalledWith({
            x: 1494 - 460,
            y: 123,
            width: 460,
            height: 640,
        });
        vi.runAllTimers();
    });

    test('reset skips dead windows, cascades matching popups, and unmaximizes them', () => {
        vi.useFakeTimers();
        settingManagerMock.getPopupWinBounds.mockReturnValue({
            x: 200,
            y: 150,
            width: 500,
            height: 400,
            isMaximized: false,
        });
        const parentWin = createMockBrowserWindow();
        const first = openPopup(parentWin, {
            url: 'https://localhost:3000/about.html?uuid=one',
        }).popupWin;
        const second = openPopup(parentWin, {
            url: 'https://localhost:3000/about.html?uuid=two',
        }).popupWin;
        const dead = openPopup(parentWin, {
            url: 'https://localhost:3000/about.html?uuid=three',
        }).popupWin;
        second.isMaximized.mockReturnValue(true);
        dead.isDestroyed.mockReturnValue(true);
        electronMockState.browserWindows.push(createMockBrowserWindow());

        resetPopupWindowsBounds(parentWin as any);

        expect(second.unmaximize).toHaveBeenCalledTimes(1);
        expect(first.setBounds).toHaveBeenCalled();
        expect(second.setBounds).toHaveBeenCalledWith(
            expect.objectContaining({
                x: expect.any(Number),
                y: expect.any(Number),
            }),
        );
        expect(dead.setBounds).not.toHaveBeenCalled();
        vi.runAllTimers();
    });

    test('a failed print is reported rather than thrown', () => {
        const win = createMockBrowserWindow({
            webContents: createMockWebContents({
                print: vi.fn(
                    (
                        _options: unknown,
                        callback: (ok: boolean, errorType: string) => void,
                    ) => {
                        callback(false, 'cancelled');
                    },
                ),
            }),
        });

        printCurrentWindow(win as any);

        expect(consoleLogSpy).toHaveBeenCalledWith(
            'Print failed:',
            'cancelled',
        );
    });

    test('a preview file that cannot be removed is only logged', async () => {
        const sourceWin = createMockBrowserWindow();
        const previewWin = createMockBrowserWindow();
        electronMockState.setBrowserWindowFactory(() => previewWin);

        await previewPrintCurrentWindow(sourceWin as any);

        const closedHandler = previewWin.on.mock.calls.find(
            ([event]) => event === 'closed',
        )?.[1];
        rm.mockRejectedValueOnce(new Error('busy'));
        closedHandler();
        await flushPromises();

        expect(consoleLogSpy).toHaveBeenCalledWith(
            'Failed to remove print preview file:',
            expect.any(Error),
        );
    });

    test('printing HTML content stages a temp file and cleans it up once', async () => {
        vi.useFakeTimers();
        const printWin = createMockBrowserWindow();
        electronMockState.setBrowserWindowFactory(() => printWin);

        await printHTMLContent('<html>Slide</html>');

        const [contentFilePath, htmlText] = writeFile.mock.calls[0];
        expect(contentFilePath).toEqual(
            expect.stringMatching(/print-content-\d+-\d+\.html$/),
        );
        expect(htmlText).toBe('<html>Slide</html>');
        expect(printWin.loadURL).toHaveBeenCalledWith(
            expect.stringMatching(/^file:.*print-content-/),
        );

        const didFinishLoad = printWin.webContents.on.mock.calls.find(
            ([event]) => event === 'did-finish-load',
        )?.[1];
        printWin.webContents.executeJavaScript.mockResolvedValue(true);
        await didFinishLoad();

        expect(printWin.webContents.printToPDF).toHaveBeenCalledTimes(1);
        expect(printWin.close).toHaveBeenCalledTimes(1);
        expect(rm).toHaveBeenCalledWith(contentFilePath, { force: true });

        // a late did-fail-load must not clean up (or close) a second time
        const didFailLoad = printWin.webContents.on.mock.calls.find(
            ([event]) => event === 'did-fail-load',
        )?.[1];
        didFailLoad({}, -6, 'ERR_FILE_NOT_FOUND');
        expect(printWin.close).toHaveBeenCalledTimes(1);
    });

    test('printing HTML content stops waiting for fonts after a timeout', async () => {
        vi.useFakeTimers();
        const printWin = createMockBrowserWindow();
        electronMockState.setBrowserWindowFactory(() => printWin);

        await printHTMLContent('<html>Slide</html>');

        const didFinishLoad = printWin.webContents.on.mock.calls.find(
            ([event]) => event === 'did-finish-load',
        )?.[1];
        // `document.fonts.ready` can hang forever
        printWin.webContents.executeJavaScript.mockReturnValue(
            new Promise(() => {}),
        );
        const pending = didFinishLoad();
        await vi.advanceTimersByTimeAsync(10_000);
        await pending;

        expect(printWin.webContents.printToPDF).toHaveBeenCalledTimes(1);
    });

    test('printing HTML content reports a preview failure and a stuck load', async () => {
        vi.useFakeTimers();
        const printWin = createMockBrowserWindow();
        electronMockState.setBrowserWindowFactory(() => printWin);

        await printHTMLContent('<html>Slide</html>');

        const didFinishLoad = printWin.webContents.on.mock.calls.find(
            ([event]) => event === 'did-finish-load',
        )?.[1];
        printWin.webContents.executeJavaScript.mockRejectedValue(
            new Error('page gone'),
        );
        rm.mockRejectedValueOnce(new Error('busy'));
        await didFinishLoad();
        await vi.advanceTimersByTimeAsync(0);

        expect(consoleLogSpy).toHaveBeenCalledWith(
            'Print preview failed:',
            expect.any(Error),
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
            'Failed to remove print content file:',
            expect.any(Error),
        );

        // a load that never completes is torn down by the watchdog
        const otherWin = createMockBrowserWindow();
        electronMockState.setBrowserWindowFactory(() => otherWin);
        await printHTMLContent('<html>Other</html>');
        await vi.advanceTimersByTimeAsync(30_000);
        expect(otherWin.close).toHaveBeenCalledTimes(1);
    });

    test('printing HTML content aborts when the temp page fails to load', async () => {
        vi.useFakeTimers();
        const printWin = createMockBrowserWindow();
        electronMockState.setBrowserWindowFactory(() => printWin);

        await printHTMLContent('<html>Slide</html>');

        const didFailLoad = printWin.webContents.on.mock.calls.find(
            ([event]) => event === 'did-fail-load',
        )?.[1];
        didFailLoad({}, -6, 'ERR_FILE_NOT_FOUND');

        expect(consoleLogSpy).toHaveBeenCalledWith(
            'Print content failed to load:',
            'ERR_FILE_NOT_FOUND',
        );
        expect(printWin.close).toHaveBeenCalledTimes(1);
    });

    test('captures a web page into a data URL and always closes the window', async () => {
        const captureWin = createMockBrowserWindow({
            webContents: createMockWebContents({
                capturePage: vi.fn(async () => ({
                    toDataURL: () => 'data:image/png;base64,AAAA',
                })),
            }),
        });
        electronMockState.setBrowserWindowFactory(() => captureWin);

        await expect(
            captureWebScreenShot('https://example.com', {
                width: 800,
                height: 600,
                delay: 0,
            }),
        ).resolves.toBe('data:image/png;base64,AAAA');
        expect(captureWin.webContents.capturePage).toHaveBeenCalledWith({
            x: 0,
            y: 0,
            width: 800,
            height: 600,
        });
        expect(captureWin.close).toHaveBeenCalledTimes(1);

        captureWin.loadURL.mockRejectedValueOnce(new Error('unreachable'));
        await expect(
            captureWebScreenShot('https://example.com', {
                width: 800,
                height: 600,
                delay: 0,
            }),
        ).rejects.toThrow('unreachable');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to capture screenshot:',
            expect.any(Error),
        );
        expect(captureWin.close).toHaveBeenCalledTimes(2);
    });

    test('routes one pending screenshot to the help window and then forgets it', () => {
        expect(sendChatAttachment({ image: 'first' })).toBe(false);
        expect(takeChatAttachment()).toEqual({ image: 'first' });
        expect(takeChatAttachment()).toBeNull();

        const chatbotWin = createWindowAt(
            'https://localhost:3000/chatbot.html?uuid=chatbot',
            { x: 0, y: 0 },
        );
        electronMockState.browserWindows.push(chatbotWin);

        expect(sendChatAttachment({ image: 'second' })).toBe(true);
        expect(chatbotWin.webContents.send).toHaveBeenCalledWith(
            'main:app:chat-attach',
            { image: 'second' },
        );
        expect(takeChatAttachment()).toEqual({ image: 'second' });
    });

    test('captures only a live window and finds a showing screen by id', async () => {
        const destroyedWin = createWindowAt(
            'https://localhost:3000/screen.html?screenId=2',
            { x: 0, y: 0 },
            { isDestroyed: vi.fn(() => true) },
        );
        const screenWin = createWindowAt(
            'https://localhost:3000/screen.html?screenId=2',
            { x: 0, y: 0 },
        );
        screenWin.webContents.capturePage.mockResolvedValue({
            toDataURL: () => 'data:image/png;base64,SCREEN',
        });
        electronMockState.browserWindows.push(destroyedWin, screenWin);

        expect(findScreenWindow(2)).toBe(screenWin);
        expect(findScreenWindow(3)).toBeNull();
        await expect(captureWindowImage(null)).rejects.toThrow(
            'That window is not open',
        );
        await expect(captureWindowImage(destroyedWin as any)).rejects.toThrow(
            'That window is not open',
        );
        await expect(captureWindowImage(screenWin as any)).resolves.toBe(
            'data:image/png;base64,SCREEN',
        );
    });

    test('can run a throttled attempt immediately and debounce the next one', () => {
        vi.useFakeTimers();
        const call = vi.fn();
        const schedule = genTimeoutAttempt(100, false);

        schedule(call);
        schedule(call);
        expect(call).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(100);
        expect(call).toHaveBeenCalledTimes(2);

        schedule(call, true);
        expect(call).toHaveBeenCalledTimes(3);
    });

    test('opens ordinary web popups externally and denies the Electron window', () => {
        const parentWin = createMockBrowserWindow();
        guardBrowsing(parentWin as any, { preload: '/tmp/preload.js' } as any);
        const windowOpenHandler =
            parentWin.webContents.setWindowOpenHandler.mock.calls[0][0];

        expect(
            windowOpenHandler({
                url: 'https://example.com/help',
                frameName: 'ordinary-link',
                features: '',
            } as any),
        ).toEqual({ action: 'deny' });
        expect(electronMockState.shell.openExternal).toHaveBeenCalledWith(
            'https://example.com/help',
        );
    });

    test('honours left, top, centre, and bottom popup alignment', () => {
        vi.useFakeTimers();
        const parentWin = createMockBrowserWindow({
            getBounds: vi.fn(() => ({
                x: 100,
                y: 200,
                width: 800,
                height: 600,
            })),
        });

        const leftTop = openPopup(parentWin, {
            features:
                'popup,width=200,height=100,appAlignHorizontal=left,' +
                'appAlignVertical=top',
        }).response.overrideBrowserWindowOptions;
        expect(leftTop).toMatchObject({ x: 100, y: 200 });

        const centreBottom = openPopup(parentWin, {
            url: 'https://localhost:3000/find.html?uuid=other',
            features:
                'popup,width=200,height=100,appAlignHorizontal=center,' +
                'appAlignVertical=bottom',
        }).response.overrideBrowserWindowOptions;
        expect(centreBottom).toMatchObject({ x: 400, y: 800 });
        vi.runAllTimers();
    });

    test('allows captures only from registered local Webs folders and caches the lookup', async () => {
        const captureWin = createMockBrowserWindow({
            webContents: createMockWebContents({
                capturePage: vi.fn(async () => ({
                    toDataURL: () => 'data:image/png;base64,LOCAL',
                })),
            }),
        });
        electronMockState.setBrowserWindowFactory(() => captureWin);
        settingManagerMock.getClientSetting.mockReturnValue(
            'C:\\mock-user-data',
        );
        readdir.mockResolvedValue([
            'select-dir-web-bg-session-a',
            'unrelated-setting',
        ]);
        readFile.mockResolvedValue('$DATA_DIR_PATH/extra-webs');
        const localUrl = 'file:///C:/mock-user-data/extra-webs/page.html';

        await expect(
            captureWebScreenShot(localUrl, {
                width: 320,
                height: 200,
                delay: 0,
            }),
        ).resolves.toBe('data:image/png;base64,LOCAL');
        await expect(
            captureWebScreenShot('file:///private/setting.json', {
                width: 320,
                height: 200,
                delay: 0,
            }),
        ).rejects.toThrow('Only a web address');
        expect(readdir).toHaveBeenCalledTimes(1);

        vi.useFakeTimers();
        vi.setSystemTime(Date.now() + 6000);
        readdir.mockRejectedValueOnce(new Error('drive unplugged'));
        await expect(
            captureWebScreenShot('file:///C:/outside/page.html', {
                width: 320,
                height: 200,
                delay: 0,
            }),
        ).rejects.toThrow('Only a web address');
        expect(consoleLogSpy).toHaveBeenCalledWith(
            'Could not read the web folders setting:',
            expect.any(Error),
        );
        vi.useRealTimers();
    });
});
