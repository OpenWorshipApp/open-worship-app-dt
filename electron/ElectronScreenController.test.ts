import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

const { guardBrowsing, genWebPreferences, attemptClosing, loadURL } =
    vi.hoisted(() => ({
        guardBrowsing: vi.fn(),
        genWebPreferences: vi.fn(() => ({ preload: '/tmp/preload.js' })),
        attemptClosing: vi.fn(),
        loadURL: vi.fn(),
    }));

vi.mock('./electronHelpers', () => ({
    attemptClosing,
    genWebPreferences,
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

import ElectronScreenController from './ElectronScreenController';
import { electronMockState } from './testElectronModule';

describe('ElectronScreenController', () => {
    beforeEach(() => {
        ElectronScreenController.closeAll();
        electronMockState.reset();
        guardBrowsing.mockClear();
        genWebPreferences.mockClear();
        attemptClosing.mockClear();
        loadURL.mockClear();
    });

    test('creates one controller per screen id and loads the screen route', () => {
        const controller = ElectronScreenController.createInstance(7);

        expect(controller).toBe(ElectronScreenController.getInstance(7));
        expect(loadURL).toHaveBeenCalledWith(controller.win, '?screenId=7');
        expect(guardBrowsing).toHaveBeenCalledTimes(1);
    });

    test('updates display bounds and forwards screen messages', () => {
        const controller = ElectronScreenController.createInstance(8);

        controller.setDisplay({
            bounds: { x: 10, y: 20, width: 300, height: 400 },
        } as any);
        controller.sendMessage('visible', { isShowing: true });

        expect(controller.win.setBounds).toHaveBeenCalledWith({
            x: 10,
            y: 20,
            width: 300,
            height: 400,
        });
        expect(controller.win.webContents.reload).toHaveBeenCalledTimes(1);
        expect(controller.win.webContents.send).toHaveBeenCalledWith(
            'app:screen:message',
            {
                screenId: 8,
                type: 'visible',
                data: { isShowing: true },
            },
        );
    });

    test('closes all screen windows through attemptClosing', () => {
        ElectronScreenController.createInstance(1);
        ElectronScreenController.createInstance(2);

        ElectronScreenController.closeAll();

        expect(attemptClosing).toHaveBeenCalledTimes(2);
        expect(ElectronScreenController.getAllIds()).toEqual([]);
    });
});
