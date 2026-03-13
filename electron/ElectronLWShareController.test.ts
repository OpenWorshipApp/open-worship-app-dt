import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

const {
    guardBrowsing,
    genParentWinCenterPosition,
    genWebPreferences,
    getAppThemeBackgroundColor,
    attemptClosing,
    loadURL,
} = vi.hoisted(() => ({
    guardBrowsing: vi.fn(),
    genParentWinCenterPosition: vi.fn(() => ({ x: 120, y: 240 })),
    genWebPreferences: vi.fn(() => ({ preload: '/tmp/lwShare.preload.js' })),
    getAppThemeBackgroundColor: vi.fn(() => '#ffffff'),
    attemptClosing: vi.fn(),
    loadURL: vi.fn(),
}));

vi.mock('./electronHelpers', () => ({
    attemptClosing,
    genParentWinCenterPosition,
    genWebPreferences,
    getAppThemeBackgroundColor,
    guardBrowsing,
}));

vi.mock('./protocolHelpers', () => ({
    genRoutProps: vi.fn(() => ({
        preloadFilePath: '/tmp/preload.js',
        loadURL,
    })),
}));

import ElectronLWShareController from './ElectronLWShareController';
import { electronMockState } from './testElectronModule';
import { createMockBrowserWindow } from './testUtils';

describe('ElectronLWShareController', () => {
    beforeEach(() => {
        electronMockState.reset();
        guardBrowsing.mockClear();
        genParentWinCenterPosition.mockClear();
        genWebPreferences.mockClear();
        getAppThemeBackgroundColor.mockClear();
        attemptClosing.mockClear();
        loadURL.mockClear();
    });

    test('creates and opens the lw-share window once', () => {
        const controller = new ElectronLWShareController();
        const mainWin = createMockBrowserWindow();

        controller.open(mainWin as any);

        expect(electronMockState.BrowserWindowMock).toHaveBeenCalledTimes(1);
        expect(loadURL).toHaveBeenCalledTimes(1);
        expect(guardBrowsing).toHaveBeenCalledTimes(1);

        controller.open(mainWin as any);
        expect(controller.win?.show).toHaveBeenCalledTimes(1);
    });

    test('closes and clears window references', () => {
        const controller = new ElectronLWShareController();
        const mainWin = createMockBrowserWindow();
        controller.open(mainWin as any);
        const createdWin = controller.win;

        controller.close();

        expect(attemptClosing).toHaveBeenCalledWith(createdWin);
        expect(controller.win).toBeNull();
        expect(controller.mainWin).toBeNull();
    });
});
