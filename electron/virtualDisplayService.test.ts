import { EventEmitter } from 'node:events';
import type http from 'node:http';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
    client: new Map<string, string>(),
    secure: new Map<string, string>(),
}));
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
            getSecureSetting: (key: string) => fixture.secure.get(key) ?? null,
            setSecureSetting: (key: string, value: string) => {
                fixture.secure.set(key, value);
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
// No network here: the TVs a search finds and the sessions cast to them are
// stand-ins (`castTargets.test.ts` tests the real ones).
const castMocks = vi.hoisted(() => ({
    discover: vi.fn(async (): Promise<any[]> => []),
    start: vi.fn(),
}));
vi.mock('./castTargets', () => ({
    discoverCastTargets: castMocks.discover,
    startCastSession: castMocks.start,
}));

import { createMockBrowserWindow } from './testUtils';
import { electronMockState } from './testElectronModule';
import type { ScreenMirrorService } from './screenMirrorService';
import {
    MAX_VIRTUAL_DISPLAYS,
    VIRTUAL_DISPLAY_ACCESS_KEY,
    VIRTUAL_DISPLAY_CODE_KEY,
    VIRTUAL_DISPLAY_SETTING_KEY,
    clampResolution,
    type VirtualDisplayNetwork,
} from './virtualDisplayProtocol';
import { VirtualDisplayService } from './virtualDisplayService';

// A stand-in Screen Mirror: the service only reads these. Its port is a
// number, nothing is bound.
function createMirror() {
    const lockedOut = new Set<string>();
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
        publicPort: null,
        isTunnelEnabled: false,
        publicAddress: '',
        customPort: null as number | null,
        isTunnelWanted: false,
        tunnelState: { status: 'off', url: '', error: '' },
        setTunnelEnabled: vi.fn(),
        registerIntercomPeers: vi.fn(),
        registerCameraSource: vi.fn(),
        intercomStateOf: vi.fn(() => ({
            mic: false,
            speaker: false,
            volume: 1,
            remoteMic: false,
        })),
        receiveIntercom: vi.fn(),
        forgetIntercom: vi.fn(),
        // The real one keeps a lockout per sender; here a code is right or
        // wrong, and `lockedOut` stands for five wrong ones.
        lockedOut,
        checkSenderCode: vi.fn(
            (address: string, code: string | null, supplied: string) => {
                if (lockedOut.has(address)) {
                    return 'locked';
                }
                return code && supplied === code ? 'ok' : 'wrong';
            },
        ),
        checkIsSenderLockedOut: vi.fn((address: string) => {
            return lockedOut.has(address);
        }),
    };
}

class FakeResponse extends EventEmitter {
    headersSent = false;
    statusCode = 0;
    headers: Record<string, string> = {};
    setHeaders: Record<string, string> = {};
    setHeader(name: string, value: string) {
        this.setHeaders[name] = value;
        return this;
    }
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
        authorization = undefined as string | undefined,
        headers = {} as Record<string, string>,
    } = {},
) {
    const res = new FakeResponse();
    await service.route(
        {
            method,
            headers: { 'user-agent': 'Player/1.0', authorization, ...headers },
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
    fixture.secure.clear();
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

    // One server, one set of connection settings: the tunnel, the public
    // address and the port are Screen Mirror's, shown in both tabs.
    test('the state carries the shared connection settings', () => {
        const service = createService();
        mirror.publicAddress = 'church.example';
        mirror.customPort = 40500;
        mirror.isTunnelEnabled = true;
        mirror.tunnelState = {
            status: 'up',
            url: 'https://quiet-river.trycloudflare.com',
            progress: 100,
            error: '',
        };
        expect(service.state()).toMatchObject({
            publicAddress: 'church.example',
            customPort: 40500,
            tunnelEnabled: true,
            tunnel: { status: 'up' },
        });
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

    // From the internet a player is held, sent nothing, until the operator's
    // Allow; an address allowed is not asked again.
    test('from the internet a player waits for Allow', async () => {
        mirror.isVirtualDisplayShareEnabled = true;
        mirror.isInternetEnabled = true;
        const service = createService();
        service.create({ name: 'A' });
        const internet = { network: 'internet' as const };
        const res = await request(service, '/vd/1/video', {
            ...internet,
            address: '198.51.100.9',
        });
        expect(res.statusCode).toBe(0);
        expect(res.isEnded).toBe(false);
        const [client] = service.state().displays[0].clients;
        expect(client).toMatchObject({
            kind: 'video',
            network: 'internet',
            waiting: 'approval',
        });
        // Nothing is drawn for a player still waiting.
        expect(electronMockState.BrowserWindowMock).not.toHaveBeenCalled();
        await service.allow(2, client.id);
        expect(service.state().displays[0].clients[0].waiting).toBe('approval');
        await service.allow(1, client.id);
        expect(service.state().displays[0].clients[0].waiting).toBeNull();
        expect(electronMockState.BrowserWindowMock).toHaveBeenCalledTimes(1);
        await request(service, '/vd/1/video', {
            ...internet,
            address: '198.51.100.9',
        });
        expect(
            service
                .state()
                .displays[0].clients.filter((item) => item.waiting !== null),
        ).toEqual([]);
        // Rejected: 403, and that address is kept out.
        const rejected = await request(service, '/vd/1/video', {
            ...internet,
            address: '198.51.100.10',
        });
        const waiting = service
            .state()
            .displays[0].clients.find((item) => item.waiting !== null)!;
        service.disconnect(1, waiting.id);
        expect(rejected.statusCode).toBe(403);
        expect(rejected.isEnded).toBe(true);
        // Never allowed: 403 after five minutes.
        const ignored = await request(service, '/vd/1/video', {
            ...internet,
            address: '198.51.100.11',
        });
        vi.advanceTimersByTime(5 * 60 * 1000 + 1);
        expect(ignored.statusCode).toBe(403);
        expect(
            service
                .state()
                .displays[0].clients.filter((item) => item.waiting !== null),
        ).toEqual([]);
        // This network is never asked.
        expect(
            (
                await request(service, '/vd/1/video', {
                    network: 'local',
                    address: '192.168.1.5',
                })
            ).isEnded,
        ).toBe(false);
    });

    // A player gives the code as its password: answered 401, it asks.
    test('with a code, a player from the internet gives it as its password', async () => {
        mirror.isVirtualDisplayShareEnabled = true;
        mirror.isInternetEnabled = true;
        fixture.client.set(VIRTUAL_DISPLAY_ACCESS_KEY, 'code');
        fixture.secure.set(VIRTUAL_DISPLAY_CODE_KEY, 'church-1234');
        const service = createService();
        service.create({ name: 'A' });
        expect(service.state()).toMatchObject({
            access: 'code',
            hasCode: true,
        });
        const from = (address: string, authorization?: string) => {
            return request(service, '/vd/1/video', {
                network: 'internet',
                address,
                authorization,
            });
        };
        const none = await from('198.51.100.9');
        expect(none.statusCode).toBe(401);
        expect(none.headers['WWW-Authenticate']).toMatch(/^Basic /);
        expect(mirror.checkSenderCode).not.toHaveBeenCalled();
        expect(
            (await from('198.51.100.9', `Basic ${btoa('vlc:nope')}`))
                .statusCode,
        ).toBe(401);
        const right = await from(
            '198.51.100.9',
            `Basic ${btoa('vlc:church-1234')}`,
        );
        expect(right.statusCode).toBe(0);
        expect(service.state().displays[0].clients[0].waiting).toBeNull();
        // Every connection gives it: one right code does not let in the
        // whole address (a site behind one router).
        expect((await from('198.51.100.9')).statusCode).toBe(401);
        mirror.lockedOut.add('198.51.100.20');
        expect(
            (await from('198.51.100.20', `Basic ${btoa('vlc:church-1234')}`))
                .statusCode,
        ).toBe(429);
        // The option changing ends every player from the internet, and the
        // next one is asked again.
        await service['runCommand']({ action: 'access', mode: 'approve' });
        expect(right.isEnded).toBe(true);
        expect(service.state().access).toBe('approve');
        const asked = await from('198.51.100.9');
        expect(service.state().displays[0].clients.at(-1)?.waiting).toBe(
            'approval',
        );
        expect(asked.isEnded).toBe(false);
    });

    // A browser let in casts its display to a TV on ITS OWN network (asked
    // for: _"this is for casting to a tv with same network of the browser
    // not app"_). The TV comes from that network -- the internet, to this
    // computer -- with the browser's token, so it is neither held for Allow
    // nor asked a code it cannot type. The token ends with internet access.
    test('a TV a browser cast to comes in with its token', async () => {
        mirror.isVirtualDisplayShareEnabled = true;
        mirror.isInternetEnabled = true;
        const service = createService();
        service.create({ name: 'A' });
        service.create({ name: 'B' });
        await service['runCommand']({ action: 'access', mode: 'code' });
        const token = service.issueCastToken(1, 'browser-1');
        expect(token).toMatch(/^[0-9a-f]{36}$/);
        expect(service.issueCastToken(1, 'browser-1')).toBe(token);
        expect(service.issueCastToken(1, 'browser-2')).not.toBe(token);
        const tv = (path: string) => {
            return request(service, path, {
                network: 'internet',
                address: '203.0.113.7',
            });
        };
        const played = await tv(`/vd/1/video?cast=${token}`);
        expect(played.statusCode).toBe(0);
        expect(service.state().displays[0].clients).toEqual([
            expect.objectContaining({ kind: 'video', waiting: null }),
        ]);
        // A made-up token, or another display's, is no key: the code is.
        expect((await tv('/vd/1/video?cast=deadbeef')).statusCode).toBe(401);
        expect((await tv(`/vd/2/video?cast=${token}`)).statusCode).toBe(401);
        // The access option changing ends the TV and its token.
        await service['runCommand']({ action: 'access', mode: 'approve' });
        expect(played.isEnded).toBe(true);
        await tv(`/vd/1/video?cast=${token}`);
        expect(service.state().displays[0].clients.at(-1)?.waiting).toBe(
            'approval',
        );
    });

    // A media player cannot answer, so the one thing for it is this
    // computer's microphone in the display's MP4 sound: one switch for every
    // player of that display, off until turned on, taken up again by a
    // compositor that starts later.
    test('the microphone goes into the MP4 sound of one display', async () => {
        const service = createService();
        service.create({ name: 'A' });
        service.create({ name: 'B' });
        expect(service.state().displays.map((item) => item.isMp4MicOn)).toEqual(
            [false, false],
        );
        await service.setMp4Mic(1, true);
        expect(service.state().displays.map((item) => item.isMp4MicOn)).toEqual(
            [true, false],
        );
        // A compositor running and ready is told at once.
        await request(service, '/vd/1/video');
        const session = (service as any).sessions.get(1);
        session.isReady = true;
        const send = session.window.webContents.send;
        await service.setMp4Mic(1, false);
        expect(send).toHaveBeenLastCalledWith('vd:compositor', {
            type: 'mic',
            isOn: false,
        });
        await service['runCommand']({
            action: 'mp4-mic',
            number: 1,
            enabled: true,
        });
        expect(send).toHaveBeenLastCalledWith('vd:compositor', {
            type: 'mic',
            isOn: true,
        });
        // Deleting the display forgets it; an unknown display does nothing.
        service.delete(1);
        await service.setMp4Mic(9, true);
        expect(service.state().displays.map((item) => item.isMp4MicOn)).toEqual(
            [false],
        );
    });

    test("a viewer's camera reaches a window as bytes and a browser's screen as base64, key frames kept", () => {
        const service = createService();
        const cameras = (service as any).viewerCameras;
        const toScreen = vi
            .spyOn((service as any).webViewers, 'sendScreenCamera')
            .mockImplementation(() => {});
        const contents = { isDestroyed: () => false, send: vi.fn() };
        electronMockState.webContentsModule.fromId.mockImplementation(
            (id: number) => (id === 7 ? contents : undefined),
        );
        cameras.receive('viewer-1', '127.0.0.1', {
            type: 'camera-state',
            shared: true,
            label: 'Phone',
        });
        cameras.watch('window:7', 'vd-camera:viewer-1', true);
        cameras.watch('screen:viewer-2:0', 'vd-camera:viewer-1', true);
        cameras.receive('viewer-1', '127.0.0.1', {
            type: 'video',
            key: true,
            timestamp: 40,
            data: Buffer.from([1, 2, 255]).toString('base64'),
        });
        expect(contents.send).toHaveBeenCalledWith('vd:camera-frame', {
            cameraId: 'vd-camera:viewer-1',
            type: 'key',
            timestamp: 40,
            data: new Uint8Array([1, 2, 255]),
        });
        // The packet's `type` names the packet: the frame's goes as
        // `frameType`, or no frame there is ever a key one.
        expect(toScreen).toHaveBeenCalledWith(
            'viewer-2',
            0,
            'vd-camera-frame',
            {
                cameraId: 'vd-camera:viewer-1',
                frameType: 'key',
                timestamp: 40,
                data: 'AQL/',
            },
        );
        cameras.drop('viewer-1');
        expect(contents.send).toHaveBeenLastCalledWith('vd:camera-end', {
            cameraId: 'vd-camera:viewer-1',
        });
        expect(toScreen).toHaveBeenLastCalledWith(
            'viewer-2',
            0,
            'vd-camera-end',
            { cameraId: 'vd-camera:viewer-1' },
        );
    });

    test('a DLNA TV is told the stream is a live stream', async () => {
        const service = createService();
        service.create({ name: 'A' });
        const res = await request(service, '/vd/1/video', {
            method: 'HEAD',
            headers: {
                'getcontentfeatures.dlna.org': '1',
                'transfermode.dlna.org': 'Streaming',
            },
        });
        expect(res.statusCode).toBe(200);
        expect(res.setHeaders['contentFeatures.dlna.org']).toMatch(
            /^DLNA\.ORG_OP=00;/,
        );
        expect(res.setHeaders['transferMode.dlna.org']).toBe('Streaming');
        // A player that did not ask is told nothing of it.
        const plain = await request(service, '/vd/1/video', { method: 'HEAD' });
        expect(plain.setHeaders).toEqual({});
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

// Casting to a TV: looked for on request, cast over this network only, its
// state shown on the display, and stopped with the display.
describe('casting to a TV', () => {
    const TV = {
        id: 'dlna:1',
        kind: 'dlna',
        name: 'Samsung',
        host: '192.168.1.50',
        port: 7676,
        controlUrl: 'http://192.168.1.50:7676/avt',
        serviceType: 'urn:schemas-upnp-org:service:AVTransport:1',
    };

    beforeEach(() => {
        castMocks.discover.mockReset();
        castMocks.start.mockReset();
        castMocks.discover.mockResolvedValue([TV]);
    });

    function startWith() {
        const sessions: { hooks: any; stop: ReturnType<typeof vi.fn> }[] = [];
        const urls: string[] = [];
        castMocks.start.mockImplementation(
            async (_target: unknown, toUrl: any, title: string, hooks: any) => {
                urls.push(`${toUrl('192.168.1.5')} ${title}`);
                const session = { hooks, stop: vi.fn() };
                sessions.push(session);
                return { stop: session.stop };
            },
        );
        return { sessions, urls };
    }

    const casts = (service: VirtualDisplayService) => {
        return service.state().displays[0].casts;
    };

    test('a search lists TVs; a cast connects, plays, and ends', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        expect(service.state().castTargets).toEqual([]);
        await service['runCommand']({ action: 'cast-search' });
        expect(service.state().castTargets).toEqual([
            { id: 'dlna:1', name: 'Samsung', kind: 'dlna' },
        ]);
        expect(service.state().isCastSearching).toBe(false);

        // The TV pulls the stream over this network: only while it may.
        await expect(
            service['runCommand']({
                action: 'cast-start',
                number: 1,
                targetId: 'dlna:1',
            }),
        ).rejects.toThrow('Let other devices watch is off');
        mirror.isVirtualDisplayShareEnabled = true;
        await expect(
            service['runCommand']({
                action: 'cast-start',
                number: 1,
                targetId: 'nobody',
            }),
        ).rejects.toThrow('TV not found');

        const { sessions, urls } = startWith();
        await service['runCommand']({
            action: 'cast-start',
            number: 1,
            targetId: 'dlna:1',
        });
        // Its address on the network facing the TV, and the display's name.
        expect(urls).toEqual(['http://192.168.1.5:40000/vd/1/video Lobby 1']);
        expect(casts(service)).toEqual([
            {
                id: 'dlna:1',
                name: 'Samsung',
                kind: 'dlna',
                status: 'connecting',
                failure: null,
                behind: null,
                playbackRate: 1,
            },
        ]);
        // Asked twice while it connects: one session.
        await service['runCommand']({
            action: 'cast-start',
            number: 1,
            targetId: 'dlna:1',
        });
        expect(sessions).toHaveLength(1);
        sessions[0].hooks.onCasting();
        expect(casts(service)[0].status).toBe('casting');
        // Stopped on the TV: gone from the list, not a failure.
        sessions[0].hooks.onEnded(null);
        expect(casts(service)).toEqual([]);
    });

    test('a failure stays to be read, may be tried again, and Stop stops', async () => {
        mirror.isVirtualDisplayShareEnabled = true;
        const service = createService();
        service.create({ name: 'Lobby' });
        await service['runCommand']({ action: 'cast-search' });
        const { sessions } = startWith();
        const start = () => {
            return service['runCommand']({
                action: 'cast-start',
                number: 1,
                targetId: 'dlna:1',
            });
        };
        await start();
        sessions[0].hooks.onEnded('refused');
        expect(casts(service)[0]).toMatchObject({
            status: 'failed',
            failure: 'refused',
        });
        await start();
        expect(sessions).toHaveLength(2);
        expect(casts(service)[0].status).toBe('connecting');
        // The first one's late word changes nothing.
        sessions[0].hooks.onCasting();
        expect(casts(service)[0].status).toBe('connecting');
        await service['runCommand']({
            action: 'cast-stop',
            number: 1,
            targetId: 'dlna:1',
        });
        expect(sessions[1].stop).toHaveBeenCalledTimes(1);
        expect(casts(service)).toEqual([]);
    });

    test('a display deleted, sharing turned off, or the app closing stops its casts', async () => {
        mirror.isVirtualDisplayShareEnabled = true;
        const service = createService();
        service.create({ name: 'A' });
        service.create({ name: 'B' });
        await service['runCommand']({ action: 'cast-search' });
        const { sessions } = startWith();
        for (const number of [1, 2]) {
            await service['runCommand']({
                action: 'cast-start',
                number,
                targetId: 'dlna:1',
            });
        }
        service.delete(1);
        expect(sessions[0].stop).toHaveBeenCalledTimes(1);
        expect(sessions[1].stop).not.toHaveBeenCalled();
        mirror.isVirtualDisplayShareEnabled = false;
        service.onNetworkChanged();
        expect(sessions[1].stop).toHaveBeenCalledTimes(1);
        expect(service.state().displays[0].casts).toEqual([]);

        mirror.isVirtualDisplayShareEnabled = true;
        await service['runCommand']({
            action: 'cast-start',
            number: 2,
            targetId: 'dlna:1',
        });
        service.stop();
        expect(sessions[2].stop).toHaveBeenCalledTimes(1);
    });

    test('a browser on this computer casts the address on this network', () => {
        const service = createService();
        service.create({ name: 'A' });
        expect(service.getLayout(1)?.castUrl).toBeNull();
        mirror.isVirtualDisplayShareEnabled = true;
        mirror.addressList.mockReturnValue([
            { host: '192.168.1.5', port: 40000, kind: 'lan' },
        ] as any);
        expect(service.getLayout(1)?.castUrl).toBe(
            'http://192.168.1.5:40000/vd/1/video',
        );
    });
});
