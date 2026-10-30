import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

const {
    guardBrowsing,
    genWebPreferences,
    attemptClosing,
    applyRendererRecovery,
    loadURL,
} = vi.hoisted(() => ({
    guardBrowsing: vi.fn(),
    genWebPreferences: vi.fn(() => ({ preload: '/tmp/preload.js' })),
    attemptClosing: vi.fn(),
    applyRendererRecovery: vi.fn(),
    loadURL: vi.fn(),
}));

vi.mock('./electronHelpers', () => ({
    applyRendererRecovery,
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
import { screenMirrorRuntime } from './screenMirrorRuntime';

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

    test('keeps the display awake exactly while each screen window is up', () => {
        const { start, stop } = electronMockState.powerSaveBlocker;
        const first = ElectronScreenController.createInstance(12);
        const second = ElectronScreenController.createDetached(12);

        expect(start).toHaveBeenCalledTimes(2);
        expect(start).toHaveBeenCalledWith('prevent-display-sleep');
        const [firstId, secondId] = start.mock.results.map(({ value }) => {
            return value;
        });
        expect(firstId).not.toBe(secondId);
        expect(stop).not.toHaveBeenCalled();

        const getClosedHandler = (controller: ElectronScreenController) => {
            return (controller.win.once as any).mock.calls.find(
                ([eventName]: [string]) => eventName === 'closed',
            )?.[1];
        };
        // One window closing releases only its own request: the other
        // screen is still showing.
        getClosedHandler(second)();
        expect(stop).toHaveBeenCalledTimes(1);
        expect(stop).toHaveBeenCalledWith(secondId);

        getClosedHandler(first)();
        expect(stop).toHaveBeenCalledTimes(2);
        expect(stop).toHaveBeenLastCalledWith(firstId);
    });

    test('waits for the screen page to finish loading before it is used', async () => {
        const controller = ElectronScreenController.createInstance(10);
        // Still loading: a page that has already loaded is not waited for
        // (the test below).
        (controller.win.webContents.isLoading as any).mockReturnValue(true);
        const pending = controller.listenLoading();

        const [eventName, onceHandler] = (
            controller.win.webContents.once as any
        ).mock.calls[0];
        expect(eventName).toBe('did-finish-load');
        onceHandler();

        await expect(pending).resolves.toBeUndefined();
    });

    test('a screen page that has already loaded is used at once', async () => {
        const controller = ElectronScreenController.createInstance(11);
        (controller.win.webContents.isLoading as any).mockReturnValue(false);
        await expect(controller.listenLoading()).resolves.toBeUndefined();
        expect(controller.win.webContents.once as any).not.toHaveBeenCalledWith(
            'did-finish-load',
            expect.any(Function),
        );
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

describe('ElectronScreenController loading through the Screen Mirror', () => {
    beforeEach(() => {
        ElectronScreenController.closeAll();
        electronMockState.reset();
        loadURL.mockClear();
    });

    test('loads the screen from the mirror server, and again after a crash', () => {
        screenMirrorRuntime.screenUrl = (screenId: number) => {
            return `http://127.0.0.1:39240/screen.html?screenId=${screenId}`;
        };
        try {
            const controller = ElectronScreenController.createInstance(12);
            expect(controller.win.loadURL).toHaveBeenCalledExactlyOnceWith(
                'http://127.0.0.1:39240/screen.html?screenId=12',
            );
            expect(loadURL).not.toHaveBeenCalled();

            // The renderer died: the same page is loaded again into the window.
            const [recoveredWin, reload] =
                applyRendererRecovery.mock.calls.at(-1)!;
            expect(recoveredWin).toBe(controller.win);
            reload();
            expect(controller.win.loadURL).toHaveBeenCalledTimes(2);
            expect(controller.win.loadURL).toHaveBeenLastCalledWith(
                'http://127.0.0.1:39240/screen.html?screenId=12',
            );
        } finally {
            delete screenMirrorRuntime.screenUrl;
        }
    });

    test('falls back to the app route when the mirror server gives no address', () => {
        screenMirrorRuntime.screenUrl = () => '';
        try {
            const controller = ElectronScreenController.createInstance(13);
            expect(loadURL).toHaveBeenCalledExactlyOnceWith(
                controller.win,
                '?screenId=13',
            );
            expect(controller.win.loadURL).not.toHaveBeenCalled();
        } finally {
            delete screenMirrorRuntime.screenUrl;
        }
    });
});
