import { beforeEach, describe, expect, test, vi } from 'vitest';

const init = vi.fn();
const getRandomPort = vi.fn();
const getAddressesWithQR = vi.fn();
const app = { set: vi.fn() };
// The latest listener of each event, and every one still attached: an earlier
// set-up's listeners that were never taken off answer an event too.
const handlers: Record<string, (value?: any) => void> = {};
const listeners: Record<string, ((value?: any) => void)[]> = {};
const httpServer = {
    listening: false,
    on: vi.fn((event: string, handler: (value?: any) => void) => {
        handlers[event] = handler;
        (listeners[event] ??= []).push(handler);
    }),
    off: vi.fn((event: string, handler: (value?: any) => void) => {
        listeners[event] = (listeners[event] ?? []).filter(
            (one) => one !== handler,
        );
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
    app,
    init,
    httpServer,
    getRandomPort,
    getAddressesWithQR,
}));

import type * as LwShareHelpersModule from './lwShareHelpers';

let initServer: typeof LwShareHelpersModule.initServer;
let lwShareInfo: typeof LwShareHelpersModule.lwShareInfo;

async function emit(event: string, value?: any) {
    await Promise.all((listeners[event] ?? []).map((one) => one(value)));
}

describe('lwShareHelpers', () => {
    beforeEach(async () => {
        init.mockReset();
        getRandomPort.mockReset();
        getAddressesWithQR.mockReset();
        app.set.mockClear();
        httpServer.on.mockClear();
        httpServer.off.mockClear();
        httpServer.close.mockClear();
        httpServer.listen.mockClear();
        httpServer.listening = false;
        Object.keys(handlers).forEach((key) => delete handlers[key]);
        Object.keys(listeners).forEach((key) => delete listeners[key]);
        // A fresh module each test, as each Local Web Share window has its
        // own: what it set up for one test must not carry into the next.
        vi.resetModules();
        ({ initServer, lwShareInfo } = await import('./lwShareHelpers'));
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

    test('a new port neither sets lw-share up again nor leaves the old port answering', async () => {
        const consoleLogSpy = vi
            .spyOn(console, 'log')
            .mockImplementation(() => {});
        try {
            // As the real init does: the port its /addresses page reads.
            init.mockImplementation((_dir: string, port: number) => {
                app.set('port', port);
            });
            getAddressesWithQR.mockImplementation(async (port: number) => [
                { address: `http://192.168.1.5:${port}`, qrCode: 'qr' },
            ]);
            const firstOnStatus = vi.fn();
            const secondOnStatus = vi.fn();
            await initServer({
                port: 8080,
                targetDir: '/data/lw-share-data',
                onStatus: firstOnStatus,
            });
            const server = await initServer({
                port: 9090,
                targetDir: '/data/lw-share-data',
                onStatus: secondOnStatus,
            });

            // Every route and another socket.io server would be added again.
            expect(init).toHaveBeenCalledOnce();
            expect(app.set).toHaveBeenLastCalledWith('port', 9090);

            server?.restart();
            await emit('listening');
            // Only the new port's addresses and QR codes, said once.
            expect(getAddressesWithQR).toHaveBeenCalledExactlyOnceWith(9090);
            expect(firstOnStatus).not.toHaveBeenCalled();
            expect(secondOnStatus).toHaveBeenCalledExactlyOnceWith({
                status: 'running',
                data: {
                    addressesWithQRList: [
                        { address: 'http://192.168.1.5:9090', qrCode: 'qr' },
                    ],
                },
            });

            await emit('close');
            expect(firstOnStatus).not.toHaveBeenCalled();
            expect(secondOnStatus).toHaveBeenLastCalledWith({
                status: 'stopped',
            });

            // The folder it serves is the one it was set up with.
            const third = await initServer({
                port: 9091,
                targetDir: '/elsewhere',
                onStatus: vi.fn(),
            });
            expect(init).toHaveBeenCalledOnce();
            expect(third?.targetDir).toBe('/data/lw-share-data');
        } finally {
            consoleLogSpy.mockRestore();
        }
    });
});
