import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

const { syncMainWindow, mainWin, mainController, lwShareController } =
    vi.hoisted(() => {
        const mainWinValue = {
            setBackgroundColor: vi.fn(),
            reload: vi.fn(),
            webContents: {
                on: vi.fn(),
            },
        };
        return {
            syncMainWindow: vi.fn(),
            mainWin: mainWinValue,
            mainController: {
                win: mainWinValue,
                sendMessage: vi.fn(),
            },
            lwShareController: {
                win: null as any,
            },
        };
    });

vi.mock('./ElectronSettingManager', () => ({
    default: class MockElectronSettingManager {
        syncMainWindow = syncMainWindow;
        mainHtmlPath = 'presenter.html';
    },
}));

vi.mock('./ElectronMainController', () => ({
    default: {
        getInstance: vi.fn(() => mainController),
    },
}));

vi.mock('./ElectronLWShareController', () => ({
    default: class MockElectronLWShareController {
        constructor() {
            return lwShareController;
        }
    },
}));

vi.mock('./fsServe', () => ({
    getCurrent: vi.fn(() => 'setting.html'),
    htmlFiles: { screen: 'screen.html' },
}));

vi.mock('./electronHelpers', () => ({
    getAppThemeBackgroundColor: vi.fn(() => '#fefefe'),
}));

import { electronMockState } from './testElectronModule';

describe('ElectronAppController', () => {
    beforeEach(() => {
        electronMockState.reset();
        syncMainWindow.mockClear();
        mainController.sendMessage.mockClear();
        mainWin.setBackgroundColor.mockClear();
        mainWin.reload.mockClear();
        mainWin.webContents.on.mockClear();
        electronMockState.app.on.mockClear();
        lwShareController.win = null;
        vi.resetModules();
    });

    test('syncs the main window on construction and forwards app messages', async () => {
        const { default: Controller } = await import('./ElectronAppController');
        const controller = new Controller();

        controller.openAboutPage();

        expect(syncMainWindow).toHaveBeenCalledWith(mainWin);
        expect(mainController.sendMessage).toHaveBeenCalledWith(
            'main:app:open-about-page',
        );
    });

    test('updates background colors on the known windows', async () => {
        const { default: Controller } = await import('./ElectronAppController');
        const controller = new Controller();
        lwShareController.win = {
            setBackgroundColor: vi.fn(),
            reload: vi.fn(),
        };

        controller.resetThemeBackgroundColor();

        expect(mainWin.setBackgroundColor).toHaveBeenCalledWith('#fefefe');
        expect(lwShareController.win.setBackgroundColor).toHaveBeenCalledWith(
            '#fefefe',
        );
    });

    test('reloads every live window except the screen outputs', async () => {
        const { default: Controller } = await import('./ElectronAppController');
        const { BrowserWindow } = (await import('electron')) as any;
        const controller = new Controller();
        const genWin = (url: string, isDestroyed = false) => ({
            isDestroyed: vi.fn(() => isDestroyed),
            reload: vi.fn(),
            webContents: { getURL: vi.fn(() => url) },
        });
        // a popup (Settings) must reload too — it is not in `allWindows()`
        const presenterWin = genWin('https://localhost:3000/presenter.html');
        const settingWin = genWin('https://localhost:3000/setting.html');
        const screenWin = genWin(
            'https://localhost:3000/screen.html?screenId=2',
        );
        const closedWin = genWin('https://localhost:3000/about.html', true);
        BrowserWindow.getAllWindows.mockReturnValueOnce([
            presenterWin,
            settingWin,
            screenWin,
            closedWin,
        ]);

        controller.reloadAll();

        expect(presenterWin.reload).toHaveBeenCalledTimes(1);
        expect(settingWin.reload).toHaveBeenCalledTimes(1);
        // reloading a live output would blank the presentation
        expect(screenWin.reload).not.toHaveBeenCalled();
        expect(closedWin.reload).not.toHaveBeenCalled();
    });

    test('remembers the landing page and re-syncs when the app is reactivated', async () => {
        const { default: Controller } = await import('./ElectronAppController');
        // `vi.resetModules()` gives the controller its own copy of the electron
        // mock, so read it back through the same module registry
        const { app, BrowserWindow } = (await import('electron')) as any;
        const controller = new Controller();

        // macOS keeps the app alive with no windows; reactivating rebuilds one
        const activateHandler = app.on.mock.calls.find(
            ([eventName]: [string]) => eventName === 'activate',
        )?.[1] as () => void;
        BrowserWindow.getAllWindows.mockReturnValue([{}]);
        activateHandler();
        expect(syncMainWindow).toHaveBeenCalledTimes(1);

        BrowserWindow.getAllWindows.mockReturnValue([]);
        activateHandler();
        expect(syncMainWindow).toHaveBeenCalledTimes(2);

        // the page the user ends up on becomes the next launch's landing page
        const didFinishLoad = mainWin.webContents.on.mock.calls.find(
            ([eventName]: [string]) => eventName === 'did-finish-load',
        )?.[1] as () => void;
        didFinishLoad();
        expect(controller.settingManager.mainHtmlPath).toBe('setting.html');
    });
});
