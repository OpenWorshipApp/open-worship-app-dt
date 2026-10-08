import { EventEmitter } from 'node:events';
import type http from 'node:http';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ client: new Map<string, string>() }));
vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});
vi.mock('./ElectronSettingManager', () => ({
    default: {
        getInstance: () => ({
            getClientSetting: (key: string) => fixture.client.get(key) ?? null,
            setClientSetting: (key: string, value: string) => {
                fixture.client.set(key, value);
            },
        }),
    },
}));
vi.mock('./electronHelpers', () => ({
    isDev: false,
    genWebPreferences: () => ({}),
    messageChannels: { screenMessage: 'screen-message' },
}));
vi.mock('./protocolHelpers', () => ({
    genRouteUrl: () => 'owa://screen.html',
    genRoutProps: () => ({ preloadFilePath: '/preload.js', loadURL: () => {} }),
}));
vi.mock('./fsServe', () => ({
    htmlFiles: { virtualDisplay: 'virtual-display', screen: 'screen' },
}));
vi.mock('./displayWallpaperHelpers', () => ({
    readVirtualDisplayWallpaper: async () => null,
}));
vi.mock('./VirtualScreenController', () => ({ default: class {} }));

import { createMockBrowserWindow } from './testUtils';
import { electronMockState } from './testElectronModule';
import type { ScreenMirrorService } from './screenMirrorService';
import {
    MAX_VIRTUAL_DISPLAYS,
    VIRTUAL_DISPLAY_SETTING_KEY,
    clampResolution,
    type VirtualDisplayNetwork,
} from './virtualDisplayProtocol';
import { VirtualDisplayService } from './virtualDisplayService';

// A stand-in Screen Mirror: the service only reads these. Its port is a
// number, nothing is bound.
function createMirror() {
    return {
        port: 40000,
        error: null as string | null,
        isVirtualDisplayShareEnabled: false,
        isInternetEnabled: false,
        routerState: { state: 'off' },
        addressList: vi.fn(() => []),
        content: {
            createScope: vi.fn(() => 'scope-1'),
            publish: vi.fn(() => '/content/scope-1/wallpaper.png'),
            revoke: vi.fn(),
        },
        refreshContext: vi.fn(async () => {}),
        getOutputContext: vi.fn(() => null),
        sendDevicesChanged: vi.fn(),
        broadcast: vi.fn(),
        serveAppFile: vi.fn(async () => {}),
        trusted: vi.fn(() => true),
        setVirtualDisplayShareEnabled: vi.fn(async () => {}),
        id: '00000000-0000-4000-8000-000000000000',
        setViewerCameraSink: vi.fn(),
        routeViewerCamera: vi.fn(),
        closeViewerCameras: vi.fn(),
        forwardViewerFeedback: vi.fn(),
    };
}

class FakeResponse extends EventEmitter {
    headersSent = false;
    statusCode = 0;
    headers: Record<string, string> = {};
    writableLength = 0;
    isEnded = false;
    writeHead(statusCode: number, headers: Record<string, string> = {}) {
        this.statusCode = statusCode;
        this.headers = headers;
        this.headersSent = true;
        return this;
    }
    write() {
        return true;
    }
    end() {
        this.isEnded = true;
        return this;
    }
    destroy() {
        this.emit('close');
        return this;
    }
}

let mirror: ReturnType<typeof createMirror>;
let services: VirtualDisplayService[];

function createService() {
    const service = new VirtualDisplayService(
        mirror as unknown as ScreenMirrorService,
    );
    services.push(service);
    return service;
}

function readStored() {
    return JSON.parse(fixture.client.get(VIRTUAL_DISPLAY_SETTING_KEY) ?? '');
}

async function request(
    service: VirtualDisplayService,
    path: string,
    {
        network = 'this-computer' as VirtualDisplayNetwork,
        address = '127.0.0.1',
        method = 'GET',
    } = {},
) {
    const res = new FakeResponse();
    await service.route(
        {
            method,
            headers: { 'user-agent': 'Player/1.0' },
            socket: { remoteAddress: address },
        } as unknown as http.IncomingMessage,
        res as unknown as http.ServerResponse,
        new URL(path, 'http://127.0.0.1:40000'),
        network,
    );
    return res;
}

beforeEach(() => {
    vi.useFakeTimers();
    fixture.client.clear();
    electronMockState.reset();
    // A compositor window the service sizes after creating it.
    electronMockState.setBrowserWindowFactory(() => ({
        ...createMockBrowserWindow(),
        setContentSize: vi.fn(),
        destroy: vi.fn(),
    }));
    mirror = createMirror();
    services = [];
});

afterEach(() => {
    for (const service of services) {
        service.stop();
    }
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('virtual display records', () => {
    test('create stores the record and the next number', () => {
        const service = createService();
        expect(
            service.create({ name: 'Lobby', width: 1280, height: 720 }),
        ).toBe(1);
        expect(readStored()).toEqual({
            nextNumber: 2,
            list: [
                {
                    number: 1,
                    name: 'Lobby 1',
                    width: 1280,
                    height: 720,
                    wallpaper: { kind: 'none' },
                },
            ],
        });
        // No name: the fallback; a bad size: clamped; a bad wallpaper: none.
        expect(
            service.create({
                width: 10,
                height: 99999,
                wallpaper: { kind: 'image', filePath: 'relative.png' },
            }),
        ).toBe(2);
        expect(service.getRecord(2)).toEqual({
            number: 2,
            name: 'Virtual Display 2',
            ...clampResolution(10, 99999),
            wallpaper: { kind: 'none' },
        });
    });

    test('a service started later reads what was stored', () => {
        const first = createService();
        first.create({ name: 'A', width: 1280, height: 720 });
        first.create({ name: 'B' });
        const second = createService();
        expect(second.displays().map((item) => item.label)).toEqual([
            'A 1',
            'B 2',
        ]);
        expect(second.displays()[0]).toMatchObject({
            id: -500001,
            bounds: { x: 0, y: 0, width: 1280, height: 720 },
            size: { width: 1280, height: 720 },
            scaleFactor: 1,
            isPrimary: false,
            virtualNumber: 1,
        });
    });

    test('a number is never handed out twice, even after a restart', () => {
        const service = createService();
        service.create({ name: 'A' });
        service.create({ name: 'B' });
        service.delete(2);
        expect(service.getRecord(2)).toBeNull();
        expect(readStored()).toMatchObject({
            nextNumber: 3,
            list: [{ number: 1 }],
        });
        expect(service.create({ name: 'C' })).toBe(3);
        service.delete(3);
        // The highest one deleted, then the app restarted.
        const restarted = createService();
        expect(restarted.create({ name: 'D' })).toBe(4);
        // Deleting what is not there changes nothing.
        const before = fixture.client.get(VIRTUAL_DISPLAY_SETTING_KEY);
        restarted.delete(99);
        expect(fixture.client.get(VIRTUAL_DISPLAY_SETTING_KEY)).toBe(before);
    });

    test(`at most ${MAX_VIRTUAL_DISPLAYS} displays`, () => {
        const service = createService();
        for (let index = 0; index < MAX_VIRTUAL_DISPLAYS; index++) {
            service.create({ name: 'D' });
        }
        expect(() => service.create({ name: 'D' })).toThrow(
            'Too many virtual displays',
        );
        expect(readStored().list).toHaveLength(MAX_VIRTUAL_DISPLAYS);
        expect(readStored().nextNumber).toBe(MAX_VIRTUAL_DISPLAYS + 1);
        service.delete(3);
        expect(service.create({ name: 'D' })).toBe(MAX_VIRTUAL_DISPLAYS + 1);
    });

    test('update clamps the size, keeps the side not given, and stores it', () => {
        const service = createService();
        service.create({ name: 'A', width: 1920, height: 1080 });
        service.update({ number: 1, width: 99999 });
        expect(service.getRecord(1)).toMatchObject(
            clampResolution(99999, 1080),
        );
        service.update({ number: 1, width: 3841, height: 3000 });
        // Scaled down under 4K pixels (see the clampResolution test.fails in
        // virtualDisplayProtocol.test.ts for the few pixels it can overshoot).
        const clamped = clampResolution(3841, 3000);
        expect(clamped.width).toBeLessThan(3840);
        expect(service.getRecord(1)).toMatchObject(clamped);
        service.update({ number: '1', height: 721 });
        expect(service.getRecord(1)).toMatchObject({ height: 722 });
        expect(readStored().list[0]).toMatchObject({
            width: clamped.width,
            height: 722,
        });
    });

    test('update sanitizes the name and the wallpaper', () => {
        const service = createService();
        service.create({ name: 'A' });
        service.update({ number: 1, name: '  Side   wall  ' });
        expect(service.getRecord(1)?.name).toBe('Side wall');
        service.update({ number: 1, name: '' });
        expect(service.getRecord(1)?.name).toBe('Virtual Display 1');
        service.update({
            number: 1,
            wallpaper: { kind: 'color', color: '#ABCDEF' },
        });
        expect(service.getRecord(1)?.wallpaper).toEqual({
            kind: 'color',
            color: '#abcdef',
        });
        service.update({
            number: 1,
            wallpaper: { kind: 'video', filePath: '/a/page.html' },
        });
        expect(readStored().list[0].wallpaper).toEqual({ kind: 'none' });
    });

    test('update of a display that does not exist throws', () => {
        const service = createService();
        expect(() => service.update({ number: 1, name: 'x' })).toThrow(
            'Virtual display not found',
        );
    });

    test('a wallpaper file is published once and revoked when it changes', () => {
        const service = createService();
        service.create({
            name: 'A',
            wallpaper: { kind: 'image', filePath: '/pictures/a.png' },
        });
        expect(service.getLayout(1)?.wallpaper).toEqual({
            kind: 'image',
            url: '/content/scope-1/wallpaper.png',
        });
        service.getLayout(1);
        expect(mirror.content.createScope).toHaveBeenCalledTimes(1);
        expect(mirror.content.publish).toHaveBeenCalledWith(
            'scope-1',
            '/pictures/a.png',
        );
        service.update({
            number: 1,
            wallpaper: { kind: 'color', color: '#000000' },
        });
        expect(mirror.content.revoke).toHaveBeenCalledWith('scope-1');
        expect(service.getLayout(1)?.wallpaper).toEqual({
            kind: 'color',
            color: '#000000',
        });
        expect(service.getLayout(2)).toBeNull();
    });

    test('the device list is told once per burst, and only on a change', () => {
        const service = createService();
        service.create({ name: 'A' });
        service.create({ name: 'B' });
        vi.advanceTimersByTime(299);
        expect(mirror.sendDevicesChanged).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(mirror.sendDevicesChanged).toHaveBeenCalledTimes(1);
        // The same values again: nothing changed for the device list.
        const record = service.getRecord(1)!;
        service.update({
            number: 1,
            name: record.name,
            width: record.width,
            height: record.height,
            wallpaper: record.wallpaper,
        });
        vi.advanceTimersByTime(1000);
        expect(mirror.sendDevicesChanged).toHaveBeenCalledTimes(1);
        service.delete(2);
        vi.advanceTimersByTime(300);
        expect(mirror.sendDevicesChanged).toHaveBeenCalledTimes(2);
    });

    test('the state is broadcast once per burst', () => {
        const service = createService();
        service.create({ name: 'A' });
        service.update({ number: 1, name: 'Renamed' });
        vi.advanceTimersByTime(50);
        expect(mirror.broadcast).toHaveBeenCalledTimes(1);
        const [channel, state] = mirror.broadcast.mock.calls[0] as any[];
        expect(channel).toBe('vd:state');
        expect(state).toMatchObject({
            available: true,
            port: 40000,
            shareEnabled: false,
            addresses: [
                { host: '127.0.0.1', port: 40000, kind: 'this-computer' },
            ],
            displays: [
                {
                    number: 1,
                    name: 'Renamed',
                    displayId: -500001,
                    screenIds: [],
                    stream: 'idle',
                    isWallpaperMissing: false,
                    clients: [],
                },
            ],
        });
    });

    test('a wallpaper file that is gone is flagged in the state', () => {
        const service = createService();
        service.create({
            name: 'A',
            wallpaper: {
                kind: 'video',
                filePath: '/no/such/dir/owa-test-missing.mp4',
            },
        });
        expect(service.state().displays[0].isWallpaperMissing).toBe(true);
    });
});

describe('virtual display MP4 route', () => {
    test('404 for an unknown display, a socket path, or a network not let in', async () => {
        const service = createService();
        service.create({ name: 'A' });
        expect((await request(service, '/vd/2/video')).statusCode).toBe(404);
        expect((await request(service, '/vd/1/ws')).statusCode).toBe(404);
        expect((await request(service, '/vd/x/video')).statusCode).toBe(404);
        // Sharing is off: only this computer.
        expect(
            (await request(service, '/vd/1/video', { network: 'local' }))
                .statusCode,
        ).toBe(404);
        mirror.isVirtualDisplayShareEnabled = true;
        expect(
            (await request(service, '/vd/1/video', { network: 'internet' }))
                .statusCode,
        ).toBe(404);
    });

    test('HEAD answers the type without taking a seat', async () => {
        const service = createService();
        service.create({ name: 'A' });
        const res = await request(service, '/vd/1/video', { method: 'HEAD' });
        expect(res.statusCode).toBe(200);
        expect(res.headers).toEqual({
            'Content-Type': 'video/mp4',
            'Cache-Control': 'no-store',
        });
        expect(res.isEnded).toBe(true);
        expect(service.state().displays[0].clients).toEqual([]);
        expect(electronMockState.BrowserWindowMock).not.toHaveBeenCalled();
    });

    test('three players per address from the network, eight in all', async () => {
        mirror.isVirtualDisplayShareEnabled = true;
        const service = createService();
        service.create({ name: 'A' });
        for (let index = 0; index < 3; index++) {
            const res = await request(service, '/vd/1/video', {
                network: 'local',
                address: '192.168.1.5',
            });
            expect(res.statusCode).toBe(0);
        }
        const fourth = await request(service, '/vd/1/video', {
            network: 'local',
            address: '::ffff:192.168.1.5',
        });
        expect(fourth.statusCode).toBe(503);
        // One compositor for the display, however many watch.
        expect(electronMockState.BrowserWindowMock).toHaveBeenCalledTimes(1);
        for (let index = 0; index < 5; index++) {
            await request(service, '/vd/1/video');
        }
        expect(
            (await request(service, '/vd/1/video', { address: '127.0.0.2' }))
                .statusCode,
        ).toBe(503);
        // A preview on this computer is never counted.
        expect(
            (await request(service, '/vd/1/video?preview=1')).statusCode,
        ).toBe(0);
        const clients = service.state().displays[0].clients;
        expect(clients).toHaveLength(9);
        expect(clients.filter((client) => client.isPreview)).toHaveLength(1);
        expect(clients[0]).toMatchObject({
            kind: 'video',
            address: '192.168.1.5',
            network: 'local',
            userAgent: 'Player/1.0',
        });
    });

    test('a disconnected player is kept out; a preview is not', async () => {
        mirror.isVirtualDisplayShareEnabled = true;
        const service = createService();
        service.create({ name: 'A' });
        const res = await request(service, '/vd/1/video', {
            network: 'local',
            address: '192.168.1.5',
        });
        const [client] = service.state().displays[0].clients;
        service.disconnect(1, client.id);
        expect(res.statusCode).toBe(503);
        expect(res.isEnded).toBe(true);
        expect(service.state().displays[0].clients).toEqual([]);
        expect(
            (
                await request(service, '/vd/1/video', {
                    network: 'local',
                    address: '192.168.1.5',
                })
            ).statusCode,
        ).toBe(403);
        expect(
            (
                await request(service, '/vd/1/video', {
                    network: 'local',
                    address: '192.168.1.6',
                })
            ).statusCode,
        ).toBe(0);
        // Ten minutes later the address may come back.
        vi.advanceTimersByTime(10 * 60 * 1000 + 1);
        expect(
            (
                await request(service, '/vd/1/video', {
                    network: 'local',
                    address: '192.168.1.5',
                    method: 'HEAD',
                })
            ).statusCode,
        ).toBe(200);
    });

    // Listed under Disconnected, and Allow again lets it straight back in
    // rather than after ten minutes.
    test('a disconnected player is listed, and Allow again lets it back', async () => {
        mirror.isVirtualDisplayShareEnabled = true;
        const service = createService();
        service.create({ name: 'A' });
        await request(service, '/vd/1/video', {
            network: 'local',
            address: '192.168.1.5',
        });
        const [client] = service.state().displays[0].clients;
        service.disconnect(1, client.id);
        const [entry] = service.state().displays[0].blocked;
        expect(entry).toMatchObject({ kind: 'video', address: '192.168.1.5' });
        // Another display's key does nothing.
        service.unblock(2, entry.key);
        expect(service.state().displays[0].blocked).toHaveLength(1);
        service.unblock(1, entry.key);
        expect(service.state().displays[0].blocked).toEqual([]);
        expect(
            (
                await request(service, '/vd/1/video', {
                    network: 'local',
                    address: '192.168.1.5',
                    method: 'HEAD',
                })
            ).statusCode,
        ).toBe(200);
    });

    test('deleting a display ends its players', async () => {
        const service = createService();
        service.create({ name: 'A' });
        const res = await request(service, '/vd/1/video');
        const [win] = electronMockState.browserWindows;
        service.delete(1);
        expect(res.isEnded).toBe(true);
        expect(win.destroy).toHaveBeenCalled();
        expect((await request(service, '/vd/1/video')).statusCode).toBe(404);
    });
});
