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

        expect(ElectronScreenController.getAllIds()).toEqual([1, 2]);

        ElectronScreenController.closeAll();

        expect(attemptClosing).toHaveBeenCalledTimes(2);
        expect(ElectronScreenController.getAllIds()).toEqual([]);
    });

    test('a screen window closed by the OS drops its cached controller', () => {
        const controller = ElectronScreenController.createInstance(9);

        const closeHandler = (controller.win.on as any).mock.calls.find(
            ([eventName]: [string]) => eventName === 'close',
        )?.[1];
        closeHandler();

        expect(ElectronScreenController.getInstance(9)).toBeNull();
    });

    test('waits for the screen page to finish loading before it is used', async () => {
        const controller = ElectronScreenController.createInstance(10);
        const pending = controller.listenLoading();

        const [eventName, onceHandler] = (
            controller.win.webContents.once as any
        ).mock.calls[0];
        expect(eventName).toBe('did-finish-load');
        onceHandler();

        await expect(pending).resolves.toBeUndefined();
    });

    test('closes a single screen window and sends raw channel data', () => {
        const controller = ElectronScreenController.createInstance(11);

        controller.close();
        expect(attemptClosing).toHaveBeenCalledWith(controller.win);

        controller.sendData('app:screen:ping', { at: 1 });
        expect(controller.win.webContents.send).toHaveBeenCalledWith(
            'app:screen:ping',
            { at: 1 },
        );
    });
});
