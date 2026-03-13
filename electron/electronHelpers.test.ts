import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

import {
    attemptClosing,
    genCenterSubDisplay,
    genParentWinCenterPosition,
    genTimeoutAttempt,
    genWebPreferences,
    getAppThemeBackgroundColor,
    goDownload,
    guardBrowsing,
    toShortcutKey,
    toUnpackedPath,
    unlocking,
} from './electronHelpers';
import { electronMockState } from './testElectronModule';
import { createMockBrowserWindow } from './testUtils';

describe('electronHelpers', () => {
    beforeEach(() => {
        electronMockState.reset();
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
