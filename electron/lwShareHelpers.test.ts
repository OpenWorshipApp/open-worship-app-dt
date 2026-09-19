import { beforeEach, describe, expect, test, vi } from 'vitest';

const init = vi.fn();
const getRandomPort = vi.fn();
const getAddressesWithQR = vi.fn();
const handlers: Record<string, (value?: any) => void> = {};
const httpServer = {
    listening: false,
    on: vi.fn((event: string, handler: (value?: any) => void) => {
        handlers[event] = handler;
    }),
    close: vi.fn(() => {
        httpServer.listening = false;
    }),
    listen: vi.fn(() => {
        httpServer.listening = true;
    }),
};

vi.mock('lw-share/package.json', () => ({
    default: {
        name: 'lw-share',
        version: '0.0.7',
    },
}));

vi.mock('lw-share', () => ({
    init,
    httpServer,
    getRandomPort,
    getAddressesWithQR,
}));

import { initServer, lwShareInfo } from './lwShareHelpers';

describe('lwShareHelpers', () => {
    beforeEach(() => {
        init.mockReset();
        getRandomPort.mockReset();
        getAddressesWithQR.mockReset();
        httpServer.on.mockClear();
        httpServer.close.mockClear();
        httpServer.listen.mockClear();
        httpServer.listening = false;
        Object.keys(handlers).forEach((key) => delete handlers[key]);
    });

    test('exposes lw-share package info', () => {
        expect(lwShareInfo.lwSharePackage.name).toBe('lw-share');
    });

    test('starts the server on a generated port and reports running state', async () => {
        const onStatus = vi.fn();
        const addresses = [{ address: 'http://localhost:3010', qr: 'qr' }];
        getRandomPort.mockResolvedValue(3010);
        getAddressesWithQR.mockResolvedValue(addresses);

        const server = await initServer({
            targetDir: '/tmp/share',
            onStatus,
        });

        expect(init).toHaveBeenCalledWith('/tmp/share', 3010);
        expect(server?.port).toBe(3010);

        await handlers.listening();

        expect(onStatus).toHaveBeenCalledWith({
            status: 'running',
            data: { addressesWithQRList: addresses },
        });

        server?.restart();
        expect(httpServer.close).toHaveBeenCalled();
        expect(httpServer.listen).toHaveBeenCalledWith(3010);
    });

    test('reports an error when no available port exists', async () => {
        const onStatus = vi.fn();
        getRandomPort.mockResolvedValue(undefined);

        await expect(
            initServer({
                targetDir: '/tmp/share',
                onStatus,
            }),
        ).resolves.toBeNull();

        expect(onStatus).toHaveBeenCalledWith({
            status: 'error',
            message: 'No available port found',
        });
    });

    test('reports server errors and shutdown, and exposes live state', async () => {
        const consoleLogSpy = vi
            .spyOn(console, 'log')
            .mockImplementation(() => {});
        const consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        try {
            const onStatus = vi.fn();
            const addresses = [{ address: 'http://localhost:3020', qr: 'qr' }];
            getAddressesWithQR.mockResolvedValue(addresses);

            const server = await initServer({
                port: 3020,
                targetDir: '/tmp/share',
                onStatus,
            });

            expect(getRandomPort).not.toHaveBeenCalled();
            expect(server?.getIsRunning()).toBe(false);

            handlers.error(new Error('EADDRINUSE'));
            expect(onStatus).toHaveBeenCalledWith({
                status: 'error',
                message: 'EADDRINUSE',
            });

            handlers.close();
            expect(onStatus).toHaveBeenCalledWith({ status: 'stopped' });

            httpServer.listening = true;
            expect(server?.getIsRunning()).toBe(true);
            await expect(server?.getAddressesWithQRList()).resolves.toEqual(
                addresses,
            );

            server?.stop();
            expect(httpServer.close).toHaveBeenCalled();
            expect(server?.getIsRunning()).toBe(false);
        } finally {
            consoleLogSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        }
    });

    test('a restart survives a close that throws', async () => {
        const consoleLogSpy = vi
            .spyOn(console, 'log')
            .mockImplementation(() => {});
        const consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        try {
            const server = await initServer({
                port: 3030,
                targetDir: '/tmp/share',
                onStatus: vi.fn(),
            });
            httpServer.close.mockImplementationOnce(() => {
                throw new Error('not running');
            });

            server?.restart();

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error closing server:',
                expect.any(Error),
            );
            expect(httpServer.listen).toHaveBeenCalledWith(3030);
        } finally {
            consoleLogSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        }
    });
});
