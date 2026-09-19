import { beforeEach, describe, expect, test, vi } from 'vitest';

const { mkdir, readdir, rm, writeFile } = vi.hoisted(() => ({
    mkdir: vi.fn(),
    readdir: vi.fn(),
    rm: vi.fn(),
    writeFile: vi.fn(),
}));

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

vi.mock('node:fs/promises', () => ({
    mkdir,
    readdir,
    rm,
    writeFile,
}));

const { settingManagerMock } = vi.hoisted(() => ({
    settingManagerMock: {
        getPopupWinBounds: vi.fn(() => null as any),
        setPopupWinBounds: vi.fn(),
        clearPopupWinBounds: vi.fn(),
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
    applyRendererRecovery,
    attemptClosing,
    genCenterSubDisplay,
    genParentWinCenterPosition,
    genTimeoutAttempt,
    genWebPreferences,
    getAppThemeBackgroundColor,
    getUpdatePageUrl,
    goDownload,
    guardBrowsing,
    POPUP_FRAME_NAME_PREFIX,
    previewPrintCurrentWindow,
    printCurrentWindow,
    setGuideRunning,
    askGuideHelp,
    answerGuideHelp,
    sweepStalePrintPreviewFiles,
    toShortcutKey,
    toUnpackedPath,
    unlocking,
} from './electronHelpers';
import { electronMockState } from './testElectronModule';
import { createMockBrowserWindow, createMockWebContents } from './testUtils';
import type { MockBrowserWindow } from './testUtils';

describe('electronHelpers', () => {
    beforeEach(() => {
        electronMockState.reset();
        mkdir.mockReset();
        mkdir.mockResolvedValue(undefined);
        readdir.mockReset();
        readdir.mockResolvedValue([]);
        rm.mockReset();
        rm.mockResolvedValue(undefined);
        writeFile.mockReset();
        writeFile.mockResolvedValue(undefined);
    });

    test('replaces app.asar with unpacked path', () => {
        expect(toUnpackedPath('/tmp/app.asar/bin')).toBe(
            '/tmp/app.asar.unpacked/bin',
        );
    });

    test('swallows close errors', () => {
        const close = vi.fn(() => {
            throw new Error('no-op');
        });
        expect(() => attemptClosing({ close })).not.toThrow();
        expect(close).toHaveBeenCalled();
    });

    test('reloads a gone renderer, capping the crash-loop', () => {
        const webContents = createMockWebContents();
        const win = createMockBrowserWindow({ webContents } as any);
        const reloadContent = vi.fn();
        applyRendererRecovery(win as any, reloadContent);

        const goneHandler = webContents.on.mock.calls.find(
            ([eventName]: any[]) => eventName === 'render-process-gone',
        )?.[1] as (event: unknown, details: { reason: string }) => void;
        expect(goneHandler).toBeDefined();

        goneHandler(null, { reason: 'clean-exit' });
        expect(reloadContent).not.toHaveBeenCalled();

        goneHandler(null, { reason: 'crashed' });
        goneHandler(null, { reason: 'oom' });
        goneHandler(null, { reason: 'killed' });
        expect(reloadContent).toHaveBeenCalledTimes(3);

        // The 4th death inside the window is a crash-loop — stop reloading.
        goneHandler(null, { reason: 'crashed' });
        expect(reloadContent).toHaveBeenCalledTimes(3);
    });

    test('offers Reload on an unresponsive renderer and force-kills on accept', async () => {
        const forcefullyCrashRenderer = vi.fn();
        const webContents = createMockWebContents({
            forcefullyCrashRenderer,
        } as any);
        const win = createMockBrowserWindow({
            webContents,
            isDestroyed: vi.fn(() => false),
        } as any);
        applyRendererRecovery(win as any, vi.fn());

        const unresponsiveHandler = (win.on as any).mock.calls.find(
            ([eventName]: any[]) => eventName === 'unresponsive',
        )?.[1] as () => Promise<void>;
        expect(unresponsiveHandler).toBeDefined();

        // Default mock answer is 1 (Wait) — nothing is killed.
        await unresponsiveHandler();
        expect(forcefullyCrashRenderer).not.toHaveBeenCalled();

        // Reload (0) force-kills; `render-process-gone` then does the reload.
        electronMockState.dialog.showMessageBox.mockResolvedValueOnce({
            response: 0,
        } as any);
        await unresponsiveHandler();
        expect(forcefullyCrashRenderer).toHaveBeenCalledOnce();
    });

    test('formats shortcut keys and capitalizes single-letter key', () => {
        expect(
            toShortcutKey({
                allControlKey: ['Shift', 'Ctrl'],
                key: 'a',
            }),
        ).toBe('Ctrl + Shift + A');
    });

    test('opens download page with current app version', () => {
        goDownload();

        expect(electronMockState.shell.openExternal).toHaveBeenCalledWith(
            'https://www.openworship.app/download?mv=1.2.3',
        );
    });

    test('uses the Microsoft Store product page for a Store install', () => {
        expect(getUpdatePageUrl(true, '9NBLGGH4NNS1')).toBe(
            'ms-windows-store://pdp/?ProductId=9NBLGGH4NNS1',
        );
    });

    test('a Store install with no product id opens the Store updates page', () => {
        // Never the self-hosted download page: its NSIS installer cannot
        // update an MSIX package.
        expect(getUpdatePageUrl(true, '')).toBe(
            'ms-windows-store://downloadsandupdates',
        );
    });

    test('any other install keeps the website download page', () => {
        // Even with a product id to hand: the Store cannot update a copy it
        // did not install.
        expect(getUpdatePageUrl(false, '9NBLGGH4NNS1')).toBe(
            'https://www.openworship.app/download?mv=1.2.3',
        );
    });

    test('serializes unlocking calls with the same key', async () => {
        let releaseFirst: () => void = () => {};
        const order: string[] = [];

        const first = unlocking('shared-key', async () => {
            order.push('first:start');
            await new Promise<void>((resolve) => {
                releaseFirst = resolve;
            });
            order.push('first:end');
            return 'first';
        });

        const second = unlocking('shared-key', async () => {
            order.push('second:start');
            return 'second';
        });

        await Promise.resolve();
        releaseFirst();

        await expect(first).resolves.toBe('first');
        await expect(second).resolves.toBe('second');
        expect(order).toEqual(['first:start', 'first:end', 'second:start']);
    });

    test('returns theme background from nativeTheme', () => {
        electronMockState.nativeTheme.shouldUseDarkColors = true;
        expect(getAppThemeBackgroundColor()).toBe('#000000');

        electronMockState.nativeTheme.shouldUseDarkColors = false;
        expect(getAppThemeBackgroundColor()).toBe('#ffffff');
    });

    test('calculates centered bounds relative to parent window', () => {
        const mainWin = createMockBrowserWindow({
            getBounds: vi.fn(() => ({
                x: 100,
                y: 200,
                width: 800,
                height: 600,
            })),
        });

        expect(
            genParentWinCenterPosition(mainWin as any, {
                width: 400,
                height: 200,
            }),
        ).toEqual({ x: 300, y: 400 });
    });

    test('creates centered sub display bounds', () => {
        expect(
            genCenterSubDisplay({
                displayPercent: 0.8,
                x: 100,
                y: 50,
                width: 1000,
                height: 600,
            }),
        ).toEqual({
            x: 199,
            y: 149,
            width: 800,
            height: 400,
            background: 'transparent',
        });
    });

    test('builds Electron web preferences with preload path', () => {
        expect(genWebPreferences('/tmp/preload.js')).toEqual({
            webSecurity: false,
            nodeIntegration: true,
            contextIsolation: false,
            preload: '/tmp/preload.js',
        });
    });

    test('registers a window open handler when browsing is guarded', () => {
        const win = createMockBrowserWindow();

        guardBrowsing(win as any, { preload: '/tmp/preload.js' } as any);

        expect(win.webContents.setWindowOpenHandler).toHaveBeenCalledTimes(1);
    });

    test('prints current window with backgrounds', () => {
        const win = createMockBrowserWindow();

        printCurrentWindow(win as any);

        expect(win.webContents.print).toHaveBeenCalledWith(
            { printBackground: true },
            expect.any(Function),
        );
    });

    test('opens a PDF preview window for current window print output', async () => {
        const pdfData = Buffer.from('%PDF');
        const sourceWin = createMockBrowserWindow({
            webContents: createMockWebContents({
                printToPDF: vi.fn(async () => pdfData),
            }),
        });
        const previewWin = createMockBrowserWindow();
        electronMockState.setBrowserWindowFactory(() => previewWin);

        await expect(previewPrintCurrentWindow(sourceWin as any)).resolves.toBe(
            previewWin,
        );

        expect(sourceWin.webContents.printToPDF).toHaveBeenCalledWith({
            printBackground: true,
            preferCSSPageSize: true,
        });
        expect(mkdir).toHaveBeenCalledWith(
            expect.stringContaining('open-worship-print-preview'),
            { recursive: true },
        );
        expect(writeFile).toHaveBeenCalledTimes(1);
        const [previewFilePath, writtenData] = writeFile.mock.calls[0];
        expect(previewFilePath).toEqual(
            expect.stringMatching(/print-preview-\d+-\d+\.pdf$/),
        );
        expect(writtenData).toBe(pdfData);
        expect(electronMockState.BrowserWindowMock).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Print Preview',
                webPreferences: expect.objectContaining({
                    plugins: true,
                }),
            }),
        );
        expect(previewWin.loadURL).toHaveBeenCalledWith(
            expect.stringMatching(/^file:.*print-preview-/),
        );

        const closedHandler = previewWin.on.mock.calls.find(
            ([event]) => event === 'closed',
        )?.[1];
        expect(closedHandler).toBeTypeOf('function');
        closedHandler();

        expect(rm).toHaveBeenCalledWith(previewFilePath, { force: true });
    });

    test('sweeps only old print preview leftovers at startup', async () => {
        const staleTimestamp = Date.now() - 1000 * 60 * 60 * 2;
        const freshTimestamp = Date.now();
        readdir.mockResolvedValue([
            `print-preview-${staleTimestamp}-1.pdf`,
            `print-content-${staleTimestamp}-2.html`,
            `print-preview-${freshTimestamp}-3.pdf`,
            'unrelated.txt',
        ]);

        await sweepStalePrintPreviewFiles();

        expect(readdir).toHaveBeenCalledWith(
            expect.stringContaining('open-worship-print-preview'),
        );
        expect(rm).toHaveBeenCalledTimes(2);
        expect(rm).toHaveBeenCalledWith(
            expect.stringContaining(`print-preview-${staleTimestamp}-1.pdf`),
            { force: true },
        );
        expect(rm).toHaveBeenCalledWith(
            expect.stringContaining(`print-content-${staleTimestamp}-2.html`),
            { force: true },
        );
    });

    test('never crashes when the print preview dir is unreadable', async () => {
        readdir.mockRejectedValue(new Error('ENOENT'));

        await expect(sweepStalePrintPreviewFiles()).resolves.toBeUndefined();
        expect(rm).not.toHaveBeenCalled();
    });

    test('parents popup window to opener only when appTopToMain is enabled', () => {
        const parentWin = createMockBrowserWindow();

        guardBrowsing(parentWin as any, { preload: '/tmp/preload.js' } as any);

        const windowOpenHandler =
            parentWin.webContents.setWindowOpenHandler.mock.calls[0][0];
        const responseWithParent = windowOpenHandler({
            url: 'https://localhost:3000/about.html?uuid=about',
            frameName: `${POPUP_FRAME_NAME_PREFIX}_about`,
            features: 'popup,width=700,appTopToMain',
        } as any);

        expect(responseWithParent.action).toBe('allow');
        expect(responseWithParent.overrideBrowserWindowOptions).toEqual(
            expect.objectContaining({
                parent: parentWin,
            }),
        );

        const popupWin = createMockBrowserWindow();
        electronMockState.setBrowserWindowFactory(() => popupWin);
        responseWithParent.createWindow(
            responseWithParent.overrideBrowserWindowOptions,
        );

        expect(electronMockState.BrowserWindowMock).toHaveBeenCalledWith(
            expect.objectContaining({
                parent: parentWin,
            }),
        );
        expect(popupWin.setAlwaysOnTop).not.toHaveBeenCalled();

        const responseWithoutParent = windowOpenHandler({
            url: 'https://localhost:3000/find.html?uuid=find',
            frameName: `${POPUP_FRAME_NAME_PREFIX}_find`,
            features: 'popup,width=270,appTopToMain=false',
        } as any);

        expect(responseWithoutParent.action).toBe('allow');
        expect(
            responseWithoutParent.overrideBrowserWindowOptions,
        ).not.toHaveProperty('parent');
    });

    test('enables blink features per window only when a popup asks for them', () => {
        const parentWin = createMockBrowserWindow();

        guardBrowsing(parentWin as any, { preload: '/tmp/preload.js' } as any);

        const windowOpenHandler =
            parentWin.webContents.setWindowOpenHandler.mock.calls[0][0];
        const responseWithFeatures = windowOpenHandler({
            url: 'https://localhost:3000/experiment.html?uuid=experiment',
            frameName: `${POPUP_FRAME_NAME_PREFIX}_experiment`,
            features:
                'popup,appBlinkFeatures=CanvasDrawElement+SomethingElse,noopener',
        } as any);

        expect(responseWithFeatures.action).toBe('allow');
        expect(
            responseWithFeatures.overrideBrowserWindowOptions.webPreferences,
        ).toEqual({
            preload: '/tmp/preload.js',
            enableBlinkFeatures: 'CanvasDrawElement,SomethingElse',
        });

        const popupWin = createMockBrowserWindow();
        electronMockState.setBrowserWindowFactory(() => popupWin);
        responseWithFeatures.createWindow(
            responseWithFeatures.overrideBrowserWindowOptions,
        );
        expect(electronMockState.BrowserWindowMock).toHaveBeenCalledWith(
            expect.objectContaining({
                webPreferences: expect.objectContaining({
                    enableBlinkFeatures: 'CanvasDrawElement,SomethingElse',
                }),
            }),
        );

        const responseWithout = windowOpenHandler({
            url: 'https://localhost:3000/find.html?uuid=find',
            frameName: `${POPUP_FRAME_NAME_PREFIX}_find`,
            features: 'popup,width=270',
        } as any);

        expect(
            responseWithout.overrideBrowserWindowOptions.webPreferences,
        ).not.toHaveProperty('enableBlinkFeatures');
    });

    describe('setGuideRunning', () => {
        // A walkthrough rings a control in the app window; the help window
        // sits on top of it and hides whatever it covers. These four cases are
        // the whole contract: get out of the way, but only when in the way,
        // and only ever undo your own doing.
        const genWindows = (chatbotBounds: {
            x: number;
            y: number;
            width: number;
            height: number;
        }) => {
            const guidedWin = createMockBrowserWindow({
                webContents: createMockWebContents({
                    getURL: vi.fn(
                        () => 'https://localhost:3000/presenter.html',
                    ),
                }),
                getBounds: vi.fn(() => ({
                    x: 0,
                    y: 0,
                    width: 1400,
                    height: 900,
                })),
            });
            const chatbotWin = createMockBrowserWindow({
                webContents: createMockWebContents({
                    getURL: vi.fn(() => {
                        return 'https://localhost:3000/chatbot.html?uuid=chatbot';
                    }),
                }),
                getBounds: vi.fn(() => chatbotBounds),
                // Opened as a child of the window it helps (`appTopToMain`).
                getParentWindow: vi.fn(() => guidedWin),
            });
            electronMockState.browserWindows.push(guidedWin, chatbotWin);
            return { guidedWin, chatbotWin };
        };

        // `setGuideRunning` reads the platform when it is called, so a case
        // can pick one whatever machine the suite runs on.
        const withPlatform = (platform: string, callback: () => void) => {
            const descriptor = Object.getOwnPropertyDescriptor(
                process,
                'platform',
            );
            Object.defineProperty(process, 'platform', {
                configurable: true,
                value: platform,
            });
            try {
                callback();
            } finally {
                if (descriptor !== undefined) {
                    Object.defineProperty(process, 'platform', descriptor);
                }
            }
        };

        // What the window itself would tell the main process when the user
        // brings it back from the taskbar.
        const fireOn = (win: MockBrowserWindow, eventName: string) => {
            for (const [name, handler] of win.once.mock.calls) {
                if (name === eventName) {
                    (handler as () => void)();
                }
            }
        };

        test('minimises the help window over the guided one, and brings it back', () => {
            const { guidedWin, chatbotWin } = genWindows({
                x: 100,
                y: 100,
                width: 500,
                height: 540,
            });

            setGuideRunning(guidedWin as any, true);
            expect(chatbotWin.minimize).toHaveBeenCalledTimes(1);
            // The walkthrough happens in the app window from here on.
            expect(guidedWin.focus).toHaveBeenCalledTimes(1);

            setGuideRunning(guidedWin as any, false);
            expect(chatbotWin.restore).toHaveBeenCalledTimes(1);
        });

        test('leaves a help window that is not in the way where it is', () => {
            const { guidedWin, chatbotWin } = genWindows({
                x: 1500,
                y: 100,
                width: 500,
                height: 540,
            });

            setGuideRunning(guidedWin as any, true);
            expect(chatbotWin.minimize).not.toHaveBeenCalled();

            // Nothing was moved, so nothing is "restored" either -- otherwise
            // a second monitor would pop the window up at the end of every
            // walkthrough it never took part in.
            setGuideRunning(guidedWin as any, false);
            expect(chatbotWin.restore).not.toHaveBeenCalled();
        });

        test('never restores a window the user minimised themselves', () => {
            const { guidedWin, chatbotWin } = genWindows({
                x: 100,
                y: 100,
                width: 500,
                height: 540,
            });
            chatbotWin.isMinimized.mockReturnValue(true);

            setGuideRunning(guidedWin as any, true);
            expect(chatbotWin.minimize).not.toHaveBeenCalled();

            setGuideRunning(guidedWin as any, false);
            expect(chatbotWin.restore).not.toHaveBeenCalled();
        });

        test('leaves a window the user brought back mid-walkthrough alone', () => {
            const { guidedWin, chatbotWin } = genWindows({
                x: 100,
                y: 100,
                width: 500,
                height: 540,
            });

            setGuideRunning(guidedWin as any, true);
            expect(chatbotWin.minimize).toHaveBeenCalledTimes(1);

            // The user pressed the taskbar button: the window says so, and it
            // is theirs again. Told, not re-read -- asking `isMinimized()` a
            // beat later is what used to leave it down with no way back.
            fireOn(chatbotWin, 'restore');
            setGuideRunning(guidedWin as any, false);
            expect(chatbotWin.restore).not.toHaveBeenCalled();
        });

        test('gives up a help window that was closed while it was away', () => {
            const { guidedWin, chatbotWin } = genWindows({
                x: 100,
                y: 100,
                width: 500,
                height: 540,
            });

            setGuideRunning(guidedWin as any, true);
            fireOn(chatbotWin, 'closed');
            chatbotWin.isDestroyed.mockReturnValue(true);

            setGuideRunning(guidedWin as any, false);
            expect(chatbotWin.restore).not.toHaveBeenCalled();
        });

        // Reported from a Mac with a picture: pressing Do it for me sent the
        // whole app into the Dock. An AppKit child window cannot be
        // miniaturised by itself, so its parent went instead.
        test('on macOS, leaves the app window up: detaches first, rejoins on restore', () => {
            const { guidedWin, chatbotWin } = genWindows({
                x: 100,
                y: 100,
                width: 500,
                height: 540,
            });

            withPlatform('darwin', () => {
                setGuideRunning(guidedWin as any, true);
            });
            expect(chatbotWin.setParentWindow).toHaveBeenCalledWith(null);
            expect(
                chatbotWin.setParentWindow.mock.invocationCallOrder[0],
            ).toBeLessThan(chatbotWin.minimize.mock.invocationCallOrder[0]);

            setGuideRunning(guidedWin as any, false);
            expect(chatbotWin.restore).toHaveBeenCalledTimes(1);
            // Not yet: the window is still miniaturised, and a parent set now
            // would be remembered without ever being attached.
            expect(chatbotWin.setParentWindow).toHaveBeenCalledTimes(1);

            fireOn(chatbotWin, 'restore');
            expect(chatbotWin.setParentWindow).toHaveBeenLastCalledWith(
                guidedWin,
            );
        });

        test('on macOS, rejoins the parent when the user brings it back from the Dock', () => {
            const { guidedWin, chatbotWin } = genWindows({
                x: 100,
                y: 100,
                width: 500,
                height: 540,
            });

            withPlatform('darwin', () => {
                setGuideRunning(guidedWin as any, true);
            });
            fireOn(chatbotWin, 'restore');
            expect(chatbotWin.setParentWindow).toHaveBeenLastCalledWith(
                guidedWin,
            );

            setGuideRunning(guidedWin as any, false);
            expect(chatbotWin.restore).not.toHaveBeenCalled();
        });

        test('on macOS, does not rejoin a parent that closed while it was away', () => {
            const { guidedWin, chatbotWin } = genWindows({
                x: 100,
                y: 100,
                width: 500,
                height: 540,
            });

            withPlatform('darwin', () => {
                setGuideRunning(guidedWin as any, true);
            });
            guidedWin.isDestroyed.mockReturnValue(true);
            fireOn(chatbotWin, 'restore');
            expect(chatbotWin.setParentWindow).toHaveBeenCalledTimes(1);
        });

        test('elsewhere, minimises the owned window without detaching it', () => {
            const { guidedWin, chatbotWin } = genWindows({
                x: 100,
                y: 100,
                width: 500,
                height: 540,
            });

            withPlatform('win32', () => {
                setGuideRunning(guidedWin as any, true);
            });
            expect(chatbotWin.minimize).toHaveBeenCalledTimes(1);
            expect(chatbotWin.setParentWindow).not.toHaveBeenCalled();
        });
    });

    // The other half of the same relay: a walkthrough step the card could not
    // press, carried to the chat window and the answer carried back. Neither
    // renderer can reach the other, so all of it goes through here.
    describe('askGuideHelp / answerGuideHelp', () => {
        const genWindows = () => {
            const guidedWin = createMockBrowserWindow({
                webContents: createMockWebContents({
                    getURL: vi.fn(
                        () => 'https://localhost:3000/presenter.html',
                    ),
                }),
            });
            const chatbotWin = createMockBrowserWindow({
                webContents: createMockWebContents({
                    getURL: vi.fn(() => {
                        return 'https://localhost:3000/chatbot.html?uuid=chatbot';
                    }),
                }),
            });
            electronMockState.browserWindows.push(guidedWin, chatbotWin);
            return { guidedWin, chatbotWin };
        };

        test('carries the question over and the answer back', () => {
            const { guidedWin, chatbotWin } = genWindows();

            expect(askGuideHelp(guidedWin as any, { token: 7 })).toBe(true);
            expect(chatbotWin.webContents.send).toHaveBeenCalledWith(
                'main:app:guide-help',
                { token: 7 },
            );

            expect(answerGuideHelp({ token: 7, text: 'Do it twice' })).toBe(
                true,
            );
            expect(guidedWin.webContents.send).toHaveBeenCalledWith(
                'main:app:guide-help-answer',
                { token: 7, text: 'Do it twice' },
            );
        });

        test('answers itself when there is no chat window to ask', () => {
            const guidedWin = createMockBrowserWindow({
                webContents: createMockWebContents({
                    getURL: vi.fn(
                        () => 'https://localhost:3000/presenter.html',
                    ),
                }),
            });
            electronMockState.browserWindows.push(guidedWin);

            // The card must not sit on "asking the assistant" for half a
            // minute when nobody was ever going to be asked.
            expect(askGuideHelp(guidedWin as any, { token: 3 })).toBe(false);
            expect(guidedWin.webContents.send).toHaveBeenCalledWith(
                'main:app:guide-help-answer',
                { token: 3, text: '' },
            );
        });

        test('drops an answer whose window has gone', () => {
            const { guidedWin } = genWindows();
            askGuideHelp(guidedWin as any, { token: 1 });
            guidedWin.isDestroyed.mockReturnValue(true);

            expect(answerGuideHelp({ token: 1, text: 'too late' })).toBe(false);
        });

        test('does not answer the same request twice', () => {
            const { guidedWin } = genWindows();
            askGuideHelp(guidedWin as any, { token: 2 });

            expect(answerGuideHelp({ token: 2, text: 'once' })).toBe(true);
            // A second answer has no window to go to: the request is spent.
            // Without this a later stray answer would be drawn on whatever
            // card happens to be up.
            expect(answerGuideHelp({ token: 2, text: 'twice' })).toBe(false);
        });
    });

    test('debounces callback execution', () => {
        vi.useFakeTimers();
        const callback = vi.fn();
        const schedule = genTimeoutAttempt(50);

        schedule(callback);
        schedule(callback);
        vi.advanceTimersByTime(49);
        expect(callback).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(callback).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });
});
