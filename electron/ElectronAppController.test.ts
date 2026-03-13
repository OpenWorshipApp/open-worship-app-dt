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
        controller.openFindPage();

        expect(syncMainWindow).toHaveBeenCalledWith(mainWin);
        expect(mainController.sendMessage).toHaveBeenCalledWith(
            'main:app:open-about-page',
        );
        expect(mainController.sendMessage).toHaveBeenCalledWith(
            'main:app:open-find-page',
        );
    });

    test('updates background colors and reloads all known windows', async () => {
        const { default: Controller } = await import('./ElectronAppController');
        const controller = new Controller();
        lwShareController.win = {
            setBackgroundColor: vi.fn(),
            reload: vi.fn(),
        };

        controller.resetThemeBackgroundColor();
        controller.reloadAll();

        expect(mainWin.setBackgroundColor).toHaveBeenCalledWith('#fefefe');
        expect(lwShareController.win.setBackgroundColor).toHaveBeenCalledWith(
            '#fefefe',
        );
        expect(mainWin.reload).toHaveBeenCalledTimes(1);
        expect(lwShareController.win.reload).toHaveBeenCalledTimes(1);
    });
});
