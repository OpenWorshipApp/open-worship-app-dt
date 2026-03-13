import { beforeEach, describe, expect, test, vi } from 'vitest';

const { readFileSync, writeFileSync, genTimeoutAttempt } = vi.hoisted(() => ({
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    genTimeoutAttempt: vi.fn(() => {
        return (callback: () => void) => callback();
    }),
}));

vi.mock('node:fs', () => ({
    default: {
        readFileSync,
        writeFileSync,
    },
}));

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

vi.mock('./electronHelpers', () => ({
    genTimeoutAttempt,
}));

import ElectronSettingManager from './ElectronSettingManager';
import { electronMockState } from './testElectronModule';
import { createMockBrowserWindow } from './testUtils';

describe('ElectronSettingManager', () => {
    beforeEach(() => {
        electronMockState.reset();
        readFileSync.mockReset();
        writeFileSync.mockReset();
    });

    test('loads persisted settings from disk', () => {
        readFileSync.mockReturnValue(
            JSON.stringify({
                mainWinBounds: { x: 1, y: 2, width: 3, height: 4 },
                appScreenDisplayId: 9,
                mainHtmlPath: 'setting.html',
                themeSource: 'dark',
            }),
        );

        const manager = new ElectronSettingManager();

        expect(manager.mainWinBounds).toEqual({
            x: 1,
            y: 2,
            width: 3,
            height: 4,
        });
        expect(manager.mainHtmlPath).toBe('setting.html');
        expect(electronMockState.nativeTheme.themeSource).toBe('dark');
    });

    test('saves updated bounds and theme information', () => {
        readFileSync.mockImplementation(() => {
            throw Object.assign(new Error('missing'), { code: 'ENOENT' });
        });
        const manager = new ElectronSettingManager();
        const win = createMockBrowserWindow({
            getPosition: vi.fn(() => [20, 30]),
            getSize: vi.fn(() => [1000, 700]),
        });

        manager.themeSource = 'light';
        manager.applyMainWindowBounds(win as any);

        expect(writeFileSync).toHaveBeenCalled();
        const lastCall = writeFileSync.mock.lastCall;
        expect(lastCall).toBeDefined();
        const [, savedJson] = lastCall!;
        const parsed = JSON.parse(savedJson);
        expect(parsed.mainWinBounds).toEqual({
            x: 20,
            y: 30,
            width: 1000,
            height: 700,
        });
        expect(parsed.themeSource).toBe('light');
    });

    test('restores main window bounds to primary display', () => {
        readFileSync.mockReturnValue('{}');
        const manager = new ElectronSettingManager();
        const win = createMockBrowserWindow();

        manager.restoreMainBounds(win as any);

        expect(win.setBounds).toHaveBeenCalledWith({
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        });
    });
});
