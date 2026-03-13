import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

const {
    attemptClosing,
    genWebPreferences,
    getAppThemeBackgroundColor,
    guardBrowsing,
    loadURL,
} = vi.hoisted(() => ({
    attemptClosing: vi.fn(),
    genWebPreferences: vi.fn(() => ({ preload: '/tmp/preload.js' })),
    getAppThemeBackgroundColor: vi.fn(() => '#101010'),
    guardBrowsing: vi.fn(),
    loadURL: vi.fn(),
}));

vi.mock('./electronHelpers', () => ({
    attemptClosing,
    genWebPreferences,
    getAppThemeBackgroundColor,
    guardBrowsing,
    messageChannels: {
        screenMessage: 'app:screen:message',
    },
}));

vi.mock('./protocolHelpers', () => ({
    genRoutProps: vi.fn(() => ({
        preloadFilePath: '/tmp/preload.js',
        loadURL,
    })),
}));

import ElectronMainController from './ElectronMainController';
import { electronMockState } from './testElectronModule';

describe('ElectronMainController', () => {
    beforeEach(() => {
        electronMockState.reset();
        attemptClosing.mockClear();
        genWebPreferences.mockClear();
        getAppThemeBackgroundColor.mockClear();
        guardBrowsing.mockClear();
        loadURL.mockClear();
    });

    test('creates the main window and loads the configured route', () => {
        const processExit = vi
            .spyOn(process, 'exit')
            .mockImplementation((() => undefined) as any);

        const controller = new ElectronMainController({
            mainHtmlPath: 'presenter.html',
        } as any);

        expect(electronMockState.BrowserWindowMock).toHaveBeenCalledTimes(1);
        expect(loadURL).toHaveBeenCalledWith(controller.win);
        expect(guardBrowsing).toHaveBeenCalledTimes(1);
        processExit.mockRestore();
    });

    test('sends screen messages over the configured channel', () => {
        const processExit = vi
            .spyOn(process, 'exit')
            .mockImplementation((() => undefined) as any);
        const controller = new ElectronMainController({
            mainHtmlPath: 'presenter.html',
        } as any);

        controller.sendScreenMessage({
            screenId: 4,
            type: 'visible',
            data: { isShowing: false },
        });
        controller.gotoSettingHomePage();

        expect(controller.win.webContents.send).toHaveBeenCalledWith(
            'app:screen:message',
            {
                screenId: 4,
                type: 'visible',
                data: { isShowing: false },
            },
        );
        expect(
            controller.win.webContents.executeJavaScript,
        ).toHaveBeenCalledWith('openBibleSetting();');
        processExit.mockRestore();
    });
});
