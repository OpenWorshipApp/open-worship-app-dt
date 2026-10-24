import { beforeEach, describe, expect, test, vi } from 'vitest';
import WebSocket from 'ws';

const mocks = vi.hoisted(() => ({
    setOutput: vi.fn(),
    removeOutput: vi.fn(),
}));

vi.mock('./screenOutputRegistry', () => ({
    setVirtualScreenOutput: mocks.setOutput,
    removeVirtualScreenOutput: mocks.removeOutput,
}));
vi.mock('./electronHelpers', () => ({
    messageChannels: { screenMessage: 'screen-message' },
}));
vi.mock('./virtualDisplayProtocol', () => ({
    readScreenMessageCameras: (message: {
        type?: string;
        data?: { layer?: string; cameras?: unknown[] };
    }) =>
        message.type === 'camera-update'
            ? {
                  layer: message.data?.layer,
                  cameras: message.data?.cameras,
              }
            : null,
}));

import VirtualScreenController from './VirtualScreenController';

function socket(readyState = WebSocket.OPEN, bufferedAmount = 0) {
    return {
        readyState,
        bufferedAmount,
        send: vi.fn(),
        close: vi.fn(),
    } as unknown as WebSocket & {
        send: ReturnType<typeof vi.fn>;
        close: ReturnType<typeof vi.fn>;
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('VirtualScreenController', () => {
    test('registers output and forwards data to a live guest and watching sockets', () => {
        const detach = vi.fn();
        const controller = new VirtualScreenController(7, 2, detach);
        const watching = socket();
        const connecting = socket(WebSocket.CONNECTING);
        const slow = socket(WebSocket.OPEN, 4 * 1024 * 1024 + 1);
        controller.sockets.add(watching);
        controller.sockets.add(connecting);
        controller.sockets.add(slow);
        const guest = { isDestroyed: () => false, send: vi.fn() };
        controller.guest = guest as any;

        expect(mocks.setOutput).toHaveBeenCalledWith(7, controller);
        expect(controller.isLive).toBe(true);
        controller.sendData('mirror:context', { theme: 'dark' });
        expect(guest.send).toHaveBeenCalledWith('mirror:context', {
            theme: 'dark',
        });
        expect(watching.send).toHaveBeenCalledWith(
            JSON.stringify({ type: 'context-update', data: { theme: 'dark' } }),
        );
        expect(connecting.send).not.toHaveBeenCalled();
        expect(slow.close).toHaveBeenCalledWith(1013, 'Too slow');

        controller.sendData('unrelated', 1);
        expect(watching.send).toHaveBeenCalledTimes(1);
        controller.sendMessage('slide', { id: 3 });
        expect(guest.send).toHaveBeenLastCalledWith('screen-message', {
            screenId: 7,
            type: 'slide',
            data: { id: 3 },
        });
        expect(watching.send).toHaveBeenLastCalledWith(
            JSON.stringify({
                type: 'message',
                message: { screenId: 7, type: 'slide', data: { id: 3 } },
            }),
        );
        expect(detach).not.toHaveBeenCalled();
    });

    test('keeps camera visibility current per layer and signals only changes', () => {
        const controller = new VirtualScreenController(8, 1, vi.fn());
        const changed = vi.fn();
        controller.camerasChangedListeners.add(changed);
        controller.sendMessage('camera-update', {
            layer: 'foreground',
            cameras: [{ id: 'front', label: 'Pulpit' }],
        });
        expect(changed).toHaveBeenCalledOnce();
        expect(controller.checkIsCameraShown('front')).toBe(true);
        expect(controller.cameraLabelOf('front')).toBe('Pulpit');
        expect(controller.cameraLabelOf('missing')).toBe('');

        controller.sendMessage('camera-update', {
            layer: 'foreground',
            cameras: [{ id: 'front', label: 'Pulpit' }],
        });
        expect(changed).toHaveBeenCalledOnce();
        controller.sendMessage('camera-update', {
            layer: 'background',
            cameras: [{ id: 'rear', label: 'Choir' }],
        });
        expect(controller.checkIsCameraShown('rear')).toBe(true);
        expect(changed).toHaveBeenCalledTimes(2);
        controller.sendMessage('camera-update', {
            layer: 'foreground',
            cameras: [],
        });
        expect(controller.checkIsCameraShown('front')).toBe(false);
        expect(controller.cameraLabelOf('rear')).toBe('Choir');
        expect(changed).toHaveBeenCalledTimes(3);
    });

    test('closes once, releases watchers, and stops using a destroyed guest', () => {
        const detach = vi.fn();
        const controller = new VirtualScreenController(9, 3, detach);
        const watching = socket();
        controller.sockets.add(watching);
        const listener = vi.fn();
        controller.onClosed(listener);
        const guest = {
            isDestroyed: vi.fn(() => false),
            capturePage: vi.fn(() => 'captured'),
            send: vi.fn(),
        };
        controller.guest = guest as any;
        expect(controller.capture()).toBe('captured');
        guest.isDestroyed.mockReturnValue(true);
        expect(controller.isLive).toBe(false);
        expect(controller.capture()).toBeNull();
        controller.sendData('other', 'ignored');
        expect(guest.send).not.toHaveBeenCalled();

        controller.close();
        controller.close();
        expect(mocks.removeOutput).toHaveBeenCalledOnce();
        expect(mocks.removeOutput).toHaveBeenCalledWith(9, controller);
        expect(detach).toHaveBeenCalledOnce();
        expect(watching.close).toHaveBeenCalledWith(1000, 'Screen hidden');
        expect(controller.sockets.size).toBe(0);
        expect(listener).toHaveBeenCalledOnce();
        expect(controller.guest).toBeNull();
    });
});
