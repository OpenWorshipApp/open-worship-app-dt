import { beforeEach, describe, expect, test, vi } from 'vitest';

const { mkdir, rm, writeFile } = vi.hoisted(() => ({
    mkdir: vi.fn(),
    rm: vi.fn(),
    writeFile: vi.fn(),
}));

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

vi.mock('node:fs/promises', () => ({
    mkdir,
    rm,
    writeFile,
}));

import {
    attemptClosing,
    genCenterSubDisplay,
    genParentWinCenterPosition,
    genTimeoutAttempt,
    genWebPreferences,
    getAppThemeBackgroundColor,
    goDownload,
    guardBrowsing,
    POPUP_FRAME_NAME_PREFIX,
    previewPrintCurrentWindow,
    printCurrentWindow,
    toShortcutKey,
    toUnpackedPath,
    unlocking,
} from './electronHelpers';
import { electronMockState } from './testElectronModule';
import { createMockBrowserWindow, createMockWebContents } from './testUtils';

describe('electronHelpers', () => {
    beforeEach(() => {
        electronMockState.reset();
        mkdir.mockReset();
        mkdir.mockResolvedValue(undefined);
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
