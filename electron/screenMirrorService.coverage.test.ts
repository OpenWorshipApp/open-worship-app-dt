import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import dgram from 'node:dgram';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import WebSocket, { WebSocketServer } from 'ws';
import type * as WsModule from 'ws';
import type * as RouterModule from './screenMirrorRouter';
import type * as TlsModule from './mirrorTls';

// Everything the mocks read, and what the tests drive. Each test starts from
// `beforeEach`'s state; nothing here keeps a vi.fn implementation across
// tests (the config resets them).
const fixture = vi.hoisted(() => ({
    client: new Map<string, string>(),
    secure: new Map<string, string>(),
    // Every service registers its own handlers; a call reaches them all and
    // each answers only what is its own, as in the real main process.
    ipc: new Map<string, ((...args: any[]) => void)[]>(),
    displays: [] as any[],
    controllers: [] as any[],
    windows: [] as any[],
    brokers: [] as any[],
    screenHandlers: new Map<string, (() => void)[]>(),
    appOnce: new Map<string, () => void>(),
    isDev: false,
    appPath: '',
    userData: '',
    // Where a socket the service dials really goes: the dev HMR bridge's
    // `wss://localhost:3000` must never reach a real Vite server.
    redirect: (url: string) => url,
    askForMediaAccess: async (_kind: string) => true,
    netFetch: async (..._args: any[]): Promise<any> => undefined,
    firewallCalls: [] as any[][],
    genCertificate: async (..._args: any[]): Promise<any> => {
        throw new Error('No certificate in this test');
    },
    powerSaveBlocker: { start: () => 1, stop: () => {} },
}));
vi.mock('ws', async (importOriginal) => {
    const actual = await importOriginal<typeof WsModule>();
    const Base = actual.default as any;
    class RedirectedWebSocket extends Base {
        constructor(address: any, ...rest: any[]) {
            super(
                typeof address === 'string'
                    ? fixture.redirect(address)
                    : address,
                ...rest,
            );
        }
    }
    return {
        ...actual,
        default: RedirectedWebSocket,
        WebSocket: RedirectedWebSocket,
    };
});
vi.mock('electron', () => {
    // The camera broker: a hidden window that records what it is sent.
    function BrowserWindow(this: any, options: any) {
        const listeners: [string, () => void][] = [];
        const broker = {
            options,
            destroyed: false,
            loadedUrls: [] as string[],
            isDestroyed: () => broker.destroyed,
            destroy: () => {
                broker.destroyed = true;
            },
            loadURL: (url: string) => broker.loadedUrls.push(url),
            webContents: {
                id: 9000 + fixture.brokers.length,
                loading: true,
                sent: [] as [string, any][],
                openHandler: null as null | (() => unknown),
                getURL: () => broker.loadedUrls.at(-1) ?? '',
                isDestroyed: () => broker.destroyed,
                isLoading: () => broker.webContents.loading,
                once: (name: string, callback: () => void) =>
                    listeners.push([name, callback]),
                finishLoad: () => {
                    broker.webContents.loading = false;
                    for (const [name, callback] of listeners.splice(0))
                        if (name === 'did-finish-load') callback();
                },
                send: (channel: string, data: any) =>
                    broker.webContents.sent.push([channel, data]),
                setWindowOpenHandler: (handler: () => unknown) => {
                    broker.webContents.openHandler = handler;
                },
            },
        };
        fixture.brokers.push(broker);
        return broker;
    }
    (BrowserWindow as any).getAllWindows = () => fixture.windows;
    return {
        app: {
            once: (name: string, callback: () => void) =>
                fixture.appOnce.set(name, callback),
            getAppPath: () => fixture.appPath,
            getPath: () => fixture.userData,
        },
        powerSaveBlocker: fixture.powerSaveBlocker,
        screen: {
            on: (name: string, handler: () => void) =>
                fixture.screenHandlers.set(name, [
                    ...(fixture.screenHandlers.get(name) ?? []),
                    handler,
                ]),
            getAllDisplays: () => fixture.displays,
            getPrimaryDisplay: () => ({ id: 15 }),
        },
        BrowserWindow,
        ipcMain: {
            on: (name: string, handler: (...args: any[]) => void) => {
                fixture.ipc.set(name, [
                    ...(fixture.ipc.get(name) ?? []),
                    handler,
                ]);
            },
        },
        net: { fetch: (...args: any[]) => fixture.netFetch(...args) },
        systemPreferences: {
            askForMediaAccess: (kind: string) =>
                fixture.askForMediaAccess(kind),
        },
    };
});
vi.mock('./screenMirrorRouter', async (importOriginal) => ({
    ...(await importOriginal<typeof RouterModule>()),
    findRouterGateway: vi.fn(),
    getRouterExternalAddress: vi.fn(),
    lookUpPublicAddress: vi.fn(),
    openRouterPort: vi.fn(),
    probeRouterPort: vi.fn(),
    renewRouterPort: vi.fn(),
    closeRouterPort: vi.fn(),
}));
vi.mock('./mirrorTls', async (importOriginal) => ({
    ...(await importOriginal<typeof TlsModule>()),
    genMirrorTlsCertificate: (...args: any[]) =>
        fixture.genCertificate(...args),
}));
vi.mock('./firewallHelpers', () => ({
    checkNetworkFirewall: async (options: unknown) => {
        fixture.firewallCalls.push(['check', options]);
        return { status: 'allowed' };
    },
    openFirewallSettings: async (target: unknown) => {
        fixture.firewallCalls.push(['open', target]);
        return true;
    },
}));
vi.mock('./ElectronSettingManager', () => ({
    default: {
        getInstance: () => ({
            getClientSetting: (key: string) => fixture.client.get(key),
            setClientSetting: (key: string, value: string) =>
                fixture.client.set(key, value),
            getSecureSetting: (key: string) => fixture.secure.get(key),
            setSecureSetting: (key: string, value: string) =>
                fixture.secure.set(key, value),
        }),
    },
}));
vi.mock('./ElectronScreenController', () => ({
    default: {
        getInstance: () => null,
        // A host's screen on a guest: a window that only records.
        createDetached: (screenId: number) => {
            const closed: (() => void)[] = [];
            const controller = {
                screenId,
                closedCount: 0,
                win: {
                    webContents: { id: 1000 + fixture.controllers.length },
                    once: (_: string, callback: () => void) =>
                        closed.push(callback),
                    isDestroyed: () => false,
                    setAlwaysOnTop: () => {},
                    moveTop: () => {},
                    focus: () => {},
                },
                displays: [] as any[],
                setDisplay: (value: any) => controller.displays.push(value),
                listenLoading: async () => {},
                sendData: () => {},
                sendMessage: () => {},
                close: () => {
                    controller.closedCount++;
                    closed.forEach((callback) => callback());
                },
            };
            fixture.controllers.push(controller);
            return controller;
        },
    },
}));
vi.mock('./protocolHelpers', () => ({ getRootUrl: () => 'owa://local' }));
vi.mock('./electronHelpers', () => ({
    get isDev() {
        return fixture.isDev;
    },
    messageChannels: { screenMessage: 'screen-message' },
}));

import {
    ScreenMirrorService,
    getScreenMirror,
    initScreenMirror,
} from './screenMirrorService';
import {
    closeRouterPort,
    findRouterGateway,
    getRouterExternalAddress,
    lookUpPublicAddress,
    openRouterPort,
    probeRouterPort,
    renewRouterPort,
} from './screenMirrorRouter';
import { screenMirrorRuntime } from './screenMirrorRuntime';
import { getCloudflaredBinPath } from './extraBinPaths';
import {
    MIRROR_MAX_MESSAGE,
    MIRROR_REMOTE_DISPLAY_FIRST,
} from './screenMirrorProtocol';
import appInfo from '../package.json';

// Real loopback sockets on a machine shared by many test runs: a slow one is
// slow, not broken. A real hang still fails.
vi.setConfig({ testTimeout: 15000 });

function ipc(name: string) {
    return (...args: any[]) => {
        for (const handler of fixture.ipc.get(name) ?? []) handler(...args);
    };
}

// One network card, so "is this sender on my network" has one answer on
// every machine: 192.168.1.0/24, plus a global IPv6 /64.
const NICS = {
    eth0: [
        {
            address: '192.168.1.2',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:01',
            internal: false,
            cidr: '192.168.1.2/24',
        },
        {
            address: '2001:db8:1:2::10',
            netmask: 'ffff:ffff:ffff:ffff::',
            family: 'IPv6',
            mac: '00:00:00:00:00:01',
            internal: false,
            cidr: '2001:db8:1:2::10/64',
            scopeid: 0,
        },
    ],
    lo: [
        {
            address: '127.0.0.1',
            netmask: '255.0.0.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: true,
            cidr: '127.0.0.1/8',
        },
    ],
} as any;

const display = {
    id: 15,
    label: 'HDMI',
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    scaleFactor: 1,
    isPrimary: true,
};

let directory: string;
const services: ScreenMirrorService[] = [];
const cleanups: (() => unknown)[] = [];

beforeEach(async () => {
    fixture.client.clear();
    fixture.secure.clear();
    fixture.ipc.clear();
    fixture.displays = [];
    fixture.controllers = [];
    fixture.windows = [];
    fixture.brokers = [];
    fixture.screenHandlers.clear();
    fixture.appOnce.clear();
    fixture.isDev = false;
    fixture.firewallCalls = [];
    fixture.redirect = (url) =>
        // Never the developer's own Vite server: a closed loopback port.
        url.replace(/^wss:\/\/localhost:3000/, 'ws://127.0.0.1:9');
    fixture.askForMediaAccess = async () => true;
    fixture.netFetch = async () => undefined;
    fixture.genCertificate = async () => {
        throw new Error('No certificate in this test');
    };
    vi.mocked(findRouterGateway).mockReset().mockResolvedValue(null);
    vi.mocked(getRouterExternalAddress).mockReset().mockResolvedValue('');
    vi.mocked(openRouterPort).mockReset();
    vi.mocked(probeRouterPort).mockReset().mockResolvedValue('unknown');
    vi.mocked(renewRouterPort).mockReset().mockResolvedValue(undefined);
    vi.mocked(lookUpPublicAddress).mockReset().mockResolvedValue('');
    vi.mocked(closeRouterPort).mockReset().mockResolvedValue(undefined);
    vi.spyOn(os, 'networkInterfaces').mockReturnValue(NICS);
    directory = await mkdtemp(path.join(os.tmpdir(), 'owa-mirror-coverage-'));
    fixture.appPath = directory;
    fixture.userData = path.join(directory, 'user-data');
});
afterEach(async () => {
    for (const cleanup of cleanups.splice(0)) await cleanup();
    for (const service of services.splice(0)) service.stop();
    vi.useRealTimers();
    await rm(directory, { recursive: true, force: true });
});

// A port nothing here holds, saved as the custom port so the service never
// tries the real app's own. Hosting also binds UDP on the same number, which
// a busy machine may already hold: `isUdpToo` checks that one as well.
async function useFreePort(isUdpToo = false): Promise<number> {
    const probe = net.createServer();
    await new Promise<void>((resolve) => probe.listen(0, resolve));
    const port = (probe.address() as net.AddressInfo).port;
    let isFree = true;
    if (isUdpToo) {
        const udp = dgram.createSocket('udp4');
        isFree = await new Promise<boolean>((resolve) => {
            udp.once('error', () => resolve(false));
            udp.bind(port, () => resolve(true));
        });
        await new Promise<void>((resolve) => {
            try {
                udp.close(() => resolve());
            } catch {
                resolve();
            }
        });
    }
    await new Promise<void>((resolve) => probe.close(() => resolve()));
    if (!isFree) return useFreePort(isUdpToo);
    fixture.client.set('screen-mirror-port', String(port));
    return port;
}
function setHosting(isHosting: boolean) {
    if (isHosting) fixture.client.set('screen-mirror-host', 'true');
    else fixture.client.delete('screen-mirror-host');
}
// A service that never listens: enough for what a socket or a message does.
function createService() {
    const service = new ScreenMirrorService();
    services.push(service);
    return service;
}
async function startService(isHosting = false) {
    setHosting(isHosting);
    await useFreePort();
    const service = createService();
    await service.start();
    return service;
}

// A window of this app (trusted) or anything else, recording what it is sent.
let windowId = 500;
function makeWindow(url: string, isDestroyed = false) {
    const sent: [string, any][] = [];
    const listeners = new Map<string, () => void>();
    const win = {
        sent,
        isDestroyed: () => isDestroyed,
        webContents: {
            id: windowId++,
            getURL: () => url,
            isDestroyed: () => isDestroyed,
            send: (channel: string, data?: any) => sent.push([channel, data]),
            once: (name: string, callback: () => void) =>
                listeners.set(name, callback),
            emit: (name: string) => listeners.get(name)?.(),
        },
    };
    return win;
}
function trustedWindow() {
    const win = makeWindow('owa://local/presenter.html');
    fixture.windows.push(win);
    return win;
}
// The presenter: what it is sent, and -- unless told otherwise -- an answer
// to every bootstrap request, as `answerBootstraps` does in the main suite.
function recordMain(service: ScreenMirrorService, isAnswering = true) {
    const main = new EventEmitter() as any;
    const sent: [string, any][] = [];
    main.sent = sent;
    main.isDestroyed = () => false;
    main.getURL = () => 'owa://local/presenter.html';
    main.send = (channel: string, data: any) => {
        sent.push([channel, data]);
        if (isAnswering && channel === 'mirror:bootstrap-request')
            ipc('mirror:bootstrap')(
                { sender: main },
                {
                    ...data,
                    stage: 0,
                    settings: {},
                    resources: {},
                    fontCss: '',
                    isWindows: process.platform === 'win32',
                    remote: false,
                    messages: [],
                },
            );
    };
    service.configure(main);
    return main as { sent: [string, any][] };
}

// A guest's WebSocket as the host holds it, without a network: what the host
// sends is parsed into `packets`, what the guest says goes in by `receive`.
function fakeSocket(localAddress = '192.168.1.2') {
    const socket = new EventEmitter() as any;
    socket.readyState = WebSocket.OPEN;
    socket.bufferedAmount = 0;
    socket.packets = [] as any[];
    socket.closes = [] as any[];
    socket.pings = 0;
    socket.terminated = false;
    socket._socket = { localAddress };
    socket.send = (text: string) => socket.packets.push(JSON.parse(text));
    socket.close = (code?: number, reason?: string) => {
        if (socket.readyState === WebSocket.CLOSED) return;
        socket.closes.push([code, reason]);
        socket.readyState = WebSocket.CLOSED;
        socket.emit('close', code, reason);
    };
    socket.terminate = () => {
        socket.terminated = true;
        socket.close(1006);
    };
    socket.ping = () => socket.pings++;
    socket.receive = (type: string, data: Record<string, any> = {}) =>
        socket.emit(
            'message',
            Buffer.from(JSON.stringify({ protocol: 1, type, ...data })),
            false,
        );
    return socket;
}
function accept(
    service: ScreenMirrorService,
    address = '192.168.1.7',
    origin: string | null = null,
) {
    const socket = fakeSocket();
    (service as any).acceptSocket(socket, address, origin);
    return socket;
}
function hello(socket: any, extra: Record<string, any> = {}) {
    const id = randomUUID();
    socket.receive('hello', {
        id,
        name: 'Guest',
        version: appInfo.version,
        ...extra,
    });
    return id;
}
// An approved guest, with its displays reported.
function approvedGuest(
    service: ScreenMirrorService,
    displays: any[] = [],
    address = '192.168.1.7',
) {
    const socket = accept(service, address);
    const id = hello(socket);
    service.approve(id);
    if (displays.length) socket.receive('inventory', { displays });
    return { socket, id };
}
function localOutput(
    service: ScreenMirrorService,
    screenId: number,
    extra: Record<string, any> = {},
) {
    const output = {
        displayId: 15,
        scope: service.content.createScope(),
        context: {
            screenId,
            stage: 0,
            settings: {},
            resources: {} as Record<string, string>,
            fontCss: '',
            isWindows: false,
            remote: false,
            isSoundOwner: false,
        },
        ...extra,
    };
    (service as any).outputs.set(screenId, output);
    return output;
}

function mockHttpResponse() {
    const response = new EventEmitter() as any;
    response.statusCode = 0;
    response.headers = {} as Record<string, string | number>;
    response.headersSent = false;
    response.body = Buffer.alloc(0);
    response.writableEnded = false;
    response.setHeader = (name: string, value: string | number) => {
        response.headers[name.toLowerCase()] = value;
        return response;
    };
    response.writeHead = (
        statusCode: number,
        headers: Record<string, string | number> = {},
    ) => {
        response.statusCode = statusCode;
        response.headersSent = true;
        Object.assign(response.headers, headers);
        return response;
    };
    response.write = (chunk: Buffer | string) => {
        response.body = Buffer.concat([
            response.body,
            Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
        ]);
        return true;
    };
    response.end = (chunk?: Buffer | string) => {
        if (chunk !== undefined) response.write(chunk);
        response.writableEnded = true;
        response.emit('finish');
        return response;
    };
    response.destroy = () => response.emit('close');
    return response;
}
async function handleHttp(
    service: ScreenMirrorService,
    pathname: string,
    remoteAddress = '192.168.1.7',
    headers: Record<string, string> = {},
) {
    const req = {
        method: 'GET',
        url: pathname,
        headers: { host: `127.0.0.1:${service.port}`, ...headers },
        socket: { remoteAddress },
    } as any;
    const res = mockHttpResponse();
    await (service as any).handleHttp(req, res);
    return res;
}
async function until(check: () => unknown, timeout = 2000) {
    const start = Date.now();
    while (!check()) {
        if (Date.now() - start > timeout) throw new Error('Timed out');
        await new Promise((resolve) => setImmediate(resolve));
    }
}

// --- the port -------------------------------------------------------------

// The port as `net.createServer` hands it out, failing as the test says.
function fakePortServer(
    listens: [number, string][],
    failure: (host: string) => string | null,
) {
    const server = new EventEmitter() as any;
    let bound: net.AddressInfo | null = null;
    server.listen = (port: number, host: string) => {
        listens.push([port, host]);
        const code = failure(host);
        process.nextTick(() => {
            if (code) {
                server.emit('error', Object.assign(new Error(code), { code }));
            } else {
                bound = { port, address: host, family: 'IPv4' };
                server.emit('listening');
            }
        });
        return server;
    };
    server.address = () => bound;
    server.close = (callback?: () => void) => {
        bound = null;
        callback?.();
        return server;
    };
    return server;
}

test('a computer without IPv6 listens on every IPv4 network instead', async () => {
    setHosting(true);
    const port = await useFreePort();
    const listens: [number, string][] = [];
    vi.spyOn(net, 'createServer').mockImplementation((() =>
        fakePortServer(listens, (host) =>
            host === '::' ? 'EAFNOSUPPORT' : null,
        )) as any);
    const service = createService();
    await service.start();

    expect(listens).toEqual([
        [port, '::'],
        [port, '0.0.0.0'],
    ]);
    expect(service.port).toBe(port);
    expect(service.error).toBeNull();
    expect(service.state()).toMatchObject({ port, hostEnabled: true });
});

test('a custom port that cannot be bound leaves the server down, and says so', async () => {
    const port = await useFreePort();
    const listens: [number, string][] = [];
    vi.spyOn(net, 'createServer').mockImplementation((() =>
        fakePortServer(listens, () => 'EACCES')) as any);
    const service = createService();
    await service.start();

    // One attempt: a refused custom port is not retried or replaced.
    expect(listens).toEqual([[port, '127.0.0.1']]);
    expect(service.error).toBe('Unable to start screen mirror server');
    expect(service.state().error).toBe('Unable to start screen mirror server');
    expect((service as any).wss).toBeUndefined();
    await expect(service.prepareOutput(0, 15)).rejects.toThrow(
        'Screen mirror server is unavailable',
    );
});

test('a server error after listening reaches only the app’s own live windows', async () => {
    const service = await startService();
    const trusted = trustedWindow();
    const stranger = makeWindow('https://example.com/page.html');
    const closed = makeWindow('owa://local/screen.html', true);
    const unreadable = makeWindow('::not a url::');
    fixture.windows.push(stranger, closed, unreadable);

    (service as any).server.emit('error', new Error('socket gone'));

    expect(service.error).toBe('Unable to start screen mirror server');
    expect(trusted.sent).toContainEqual([
        'mirror:state',
        expect.objectContaining({
            error: 'Unable to start screen mirror server',
        }),
    ]);
    expect(stranger.sent).toEqual([]);
    expect(closed.sent).toEqual([]);
    expect(unreadable.sent).toEqual([]);
    expect(service.trusted(unreadable.webContents as any)).toBe(false);
});

test('start wires the screen window seam, display changes and quitting', async () => {
    const service = await startService();
    expect(screenMirrorRuntime.screenUrl!(4)).toBe(
        `http://127.0.0.1:${service.port}/screen.html?screenId=4`,
    );
    localOutput(service, 4, { context: { screenId: 4, stage: 2 } });
    expect(screenMirrorRuntime.context!(4)).toEqual({ screenId: 4, stage: 2 });
    expect(screenMirrorRuntime.context!(5)).toBeUndefined();

    const main = recordMain(service);
    const before = service.state().displayRevision;
    for (const name of [
        'display-added',
        'display-removed',
        'display-metrics-changed',
    ])
        fixture.screenHandlers.get(name)!.at(-1)!();
    expect(service.state().displayRevision).toBe(before + 3);
    expect(
        main.sent.filter(([channel]) => channel === 'mirror:devices-changed'),
    ).toHaveLength(3);

    const server = (service as any).server as net.Server;
    expect(server.listening).toBe(true);
    fixture.appOnce.get('will-quit')!();
    expect(server.listening).toBe(false);
});

test('initScreenMirror starts the one service the rest of the app reads back', async () => {
    setHosting(false);
    const port = await useFreePort();
    await initScreenMirror();
    const service = getScreenMirror()!;
    services.push(service);
    expect(service).toBeInstanceOf(ScreenMirrorService);
    expect(service.port).toBe(port);
    expect(service.error).toBeNull();
});

// --- a guest's socket -----------------------------------------------------

test('a corrupt record of guests is dropped: the first guest approved is a1', () => {
    fixture.client.set('screen-mirror-guests', '{not json');
    const service = createService();
    const socket = accept(service);
    const id = hello(socket);
    expect(socket.packets).toEqual([{ protocol: 1, type: 'pending' }]);
    service.approve(id);
    expect(socket.packets).toContainEqual(
        expect.objectContaining({
            type: 'approved',
            id: service.id,
            prefix: 'a1',
        }),
    );
    expect(JSON.parse(fixture.client.get('screen-mirror-guests')!)).toEqual({
        [id]: { prefix: 'a1', displays: {} },
    });
});

test('the heartbeat pings every peer and ends one that stopped answering', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const service = await startService(true);
    const live = accept(service);
    const liveId = hello(live);
    const silent = accept(service);
    hello(silent);

    vi.advanceTimersByTime(5000);
    expect([live.pings, silent.pings]).toEqual([1, 1]);
    live.emit('pong');
    vi.advanceTimersByTime(5000);

    expect(live.pings).toBe(2);
    expect(live.terminated).toBe(false);
    expect(silent.terminated).toBe(true);
    expect(service.state().pending.map((peer) => peer.id)).toEqual([liveId]);
});

test('a socket that never says hello is closed after ten seconds', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const service = createService();
    const quiet = accept(service);
    const polite = accept(service);
    hello(polite);

    vi.advanceTimersByTime(9999);
    expect(quiet.closes).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(quiet.closes).toEqual([[1008, 'Hello required']]);
    expect(polite.closes).toEqual([]);
});

test('binary frames, garbage and a bad hello all close the socket', () => {
    const service = createService();
    const binary = accept(service);
    binary.emit('message', Buffer.from([1, 2, 3]), true);
    expect(binary.closes).toEqual([[1008, undefined]]);

    const garbage = accept(service);
    garbage.emit('message', Buffer.from('not json'), false);
    expect(garbage.closes).toEqual([[1008, undefined]]);

    const refused = { protocol: 1, type: 'error', error: expect.any(String) };
    for (const extra of [
        { id: 'not-a-uuid' },
        { id: service.id },
        { version: '0.0.0-other' },
        { name: 'x'.repeat(257) },
    ]) {
        const socket = accept(service);
        hello(socket, extra);
        expect(socket.packets).toEqual([refused]);
        expect(socket.packets[0].error).toBe(
            'Incompatible or duplicate connection',
        );
        expect(socket.closes).toEqual([[1008, undefined]]);
    }
    expect(service.state().pending).toEqual([]);
});

test('a guest waiting for approval is not heard until approved', () => {
    const service = createService();
    const socket = accept(service);
    const id = hello(socket);
    socket.receive('inventory', { displays: [display], cameras: [] });
    service.approve(id);
    // The inventory sent while waiting was dropped; the next one counts.
    expect(service.displays()).toEqual([]);
    socket.receive('inventory', { displays: [display], cameras: [] });
    expect(service.displays()).toHaveLength(1);
});

test('requests from the internet are capped per sender and in all; the room’s are not', () => {
    const service = createService();
    const tooMany = {
        protocol: 1,
        type: 'error',
        error: 'Too many connection requests. Try again later.',
    };
    for (let index = 0; index < 4; index++) {
        const socket = accept(service, '203.0.113.5');
        hello(socket);
        expect(socket.packets).toEqual([{ protocol: 1, type: 'pending' }]);
    }
    const fifth = accept(service, '203.0.113.5');
    hello(fifth);
    expect(fifth.packets).toEqual([tooMany]);
    expect(fifth.closes).toEqual([[1008, undefined]]);

    for (let index = 1; index <= 4; index++) {
        const socket = accept(service, `198.51.100.${index}`);
        hello(socket);
        expect(socket.packets).toEqual([{ protocol: 1, type: 'pending' }]);
    }
    const ninth = accept(service, '198.51.100.99');
    hello(ninth);
    expect(ninth.packets).toEqual([tooMany]);

    const inTheRoom = accept(service, '192.168.1.50');
    hello(inTheRoom);
    expect(inTheRoom.packets).toEqual([{ protocol: 1, type: 'pending' }]);
    expect(service.state().pending.map((peer) => peer.network)).toEqual([
        ...Array(8).fill('internet'),
        'local',
    ]);
});

test('a guest approved twice, or never seen, is answered once', () => {
    const service = createService();
    const socket = accept(service);
    const id = hello(socket);
    service.approve(id);
    service.approve(id);
    service.approve(randomUUID());
    expect(
        socket.packets.filter((packet: any) => packet.type === 'approved'),
    ).toHaveLength(1);
});

test('a display gone from the inventory takes its output down; a second display is numbered below the first', () => {
    const service = createService();
    const main = recordMain(service);
    const second = { ...display, id: 16, label: 'DP' };
    const { socket, id } = approvedGuest(service, [display, second]);
    const [first, next] = service.displays();
    expect([first.id, next.id]).toEqual([
        MIRROR_REMOTE_DISPLAY_FIRST,
        MIRROR_REMOTE_DISPLAY_FIRST - 1,
    ]);
    localOutput(service, 3, { displayId: next.id, guestId: id });
    localOutput(service, 4, { displayId: first.id, guestId: id });

    socket.receive('inventory', { displays: [display], cameras: [] });

    expect(service.showingIds()).toEqual([4]);
    expect(socket.packets).toContainEqual({
        protocol: 1,
        type: 'hide',
        screenId: 3,
    });
    expect(main.sent).toContainEqual([
        'screen-message',
        { screenId: 3, type: 'visible', data: { isShowing: false } },
    ]);
});

test('a message too big to send, or a socket too far behind, is resynchronized', () => {
    const service = createService();
    const { socket, id } = approvedGuest(service);
    localOutput(service, 2, {
        displayId: MIRROR_REMOTE_DISPLAY_FIRST,
        guestId: id,
    });
    socket.bufferedAmount = MIRROR_MAX_MESSAGE * 2 + 1;
    const before = socket.packets.length;

    expect(
        service.sendScreenMessage({
            screenId: 2,
            type: 'background',
            data: { type: 'color', src: '#000000' },
        } as any),
    ).toBe(true);
    expect(socket.packets).toHaveLength(before);
    expect(socket.closes).toEqual([[1013, 'Resynchronize']]);
});

// --- outputs --------------------------------------------------------------

test('an output without a presenter fails and leaves nothing showing', async () => {
    const service = await startService();
    await expect(service.prepareOutput(2, 15)).rejects.toThrow(
        'Presenter is unavailable',
    );
    expect(service.showingIds()).toEqual([]);
    expect(service.getOutputContext(2)).toBeNull();
});

test('a guest display that is gone is refused, and the screen’s old output goes first', async () => {
    const service = await startService();
    const main = recordMain(service);
    localOutput(service, 1);
    await expect(
        service.prepareOutput(1, MIRROR_REMOTE_DISPLAY_FIRST),
    ).rejects.toThrow('Guest display is disconnected');
    expect(service.showingIds()).toEqual([]);
    expect(main.sent).toContainEqual([
        'screen-message',
        { screenId: 1, type: 'visible', data: { isShowing: false } },
    ]);
});

test('a presenter that never answers times the output out; an answer to another request does not count', async () => {
    const service = await startService();
    const main = recordMain(service, false);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const showing = service.prepareOutput(0, 15);
    const failed = expect(showing).rejects.toThrow(
        'Screen initialization timed out',
    );
    const [, request] = main.sent.find(
        ([channel]) => channel === 'mirror:bootstrap-request',
    )!;
    expect(request).toEqual({ requestId: expect.any(String), screenId: 0 });
    ipc('mirror:bootstrap')(
        { sender: main },
        { requestId: randomUUID(), stage: 3, resources: {}, messages: [] },
    );
    await vi.advanceTimersByTimeAsync(10000);
    await failed;
    expect(service.showingIds()).toEqual([]);
});

test('hiding a screen that is not shown says nothing', () => {
    const service = createService();
    const main = recordMain(service);
    service.hide(42);
    expect(main.sent).toEqual([]);
});

test('screen messages go only to a guest output whose guest is still here', () => {
    const service = createService();
    localOutput(service, 1);
    const message = {
        screenId: 1,
        type: 'background',
        data: { type: 'color', src: '#000000' },
    } as any;
    expect(service.sendScreenMessage(message)).toBe(false);

    const gone = localOutput(service, 2, {
        displayId: MIRROR_REMOTE_DISPLAY_FIRST,
        guestId: randomUUID(),
    });
    expect(
        service.sendScreenMessage({ ...message, screenId: 2, stage: 6 }),
    ).toBe(true);
    expect(gone.context.stage).toBe(0);

    const { socket, id } = approvedGuest(service);
    const live = localOutput(service, 3, {
        displayId: MIRROR_REMOTE_DISPLAY_FIRST,
        guestId: id,
    });
    expect(
        service.sendScreenMessage({ ...message, screenId: 3, stage: 5 }),
    ).toBe(true);
    expect(live.context.stage).toBe(5);
    expect(socket.packets.at(-1)).toEqual({
        protocol: 1,
        type: 'screen',
        message: { ...message, screenId: 3, stage: 5 },
        resources: {},
        stage: 5,
    });
});

test('a refresh answered after its output was replaced changes nothing', async () => {
    const service = await startService();
    const main = recordMain(service, false);
    localOutput(service, 1);
    const refreshing = service.refreshContext(1);
    const [, request] = main.sent.find(
        ([channel]) => channel === 'mirror:bootstrap-request',
    )!;
    service.hide(1);
    const replacement = localOutput(service, 1);
    const context = replacement.context;
    ipc('mirror:bootstrap')(
        { sender: main },
        { ...request, stage: 9, settings: { x: 1 }, messages: [] },
    );
    await refreshing;
    expect(replacement.context).toBe(context);
    expect(replacement.context.stage).toBe(0);
});

test('a window that is not a host’s screen cannot step a Bible', () => {
    const service = createService();
    expect(service.stepBible({ screenId: 0, isNext: true })).toBe(false);
    expect(
        service.stepBible({ screenId: 0, isNext: true }, { id: 4 } as any),
    ).toBe(false);
});

// --- files a screen loads -------------------------------------------------

test('a host’s screen here resolves files beside its published pages, never outside them', () => {
    const service = createService();
    const sender = { id: 77 } as any;
    (service as any).incoming.set('link:0', {
        linkId: 'link',
        screenId: 0,
        contentsId: 77,
        controller: {},
        context: {
            isWindows: true,
            resources: {
                'C:\\deck\\index.html':
                    'http://10.0.0.5:39240/content/aa/bb/index.html',
                'C:\\deck\\logo.png':
                    'http://10.0.0.5:39240/content/aa/cc/logo.png',
            },
        },
    });
    expect(service.resource(0, 'C:\\deck\\logo.png', sender)).toBe(
        'http://10.0.0.5:39240/content/aa/cc/logo.png',
    );
    expect(service.resource(0, 'C:\\deck\\img\\a b.png', sender)).toBe(
        'http://10.0.0.5:39240/content/aa/bb/img/a%20b.png',
    );
    expect(service.resource(0, 'C:\\other\\x.png', sender)).toBe('');
    expect(service.resource(0, 'C:\\deck', sender)).toBe('');
    expect(service.resource(9, 'C:\\deck\\logo.png')).toBe('');
});

test('a relative path is never published, and a crowded output forgets what it no longer serves', () => {
    const service = createService();
    const output = localOutput(service, 1);
    expect(service.resource(1, 'relative/file.png')).toBe('');
    expect(output.context.resources).toEqual({});

    for (let index = 0; index < 4096; index++)
        output.context.resources[path.resolve(directory, `gone-${index}.png`)] =
            'stale';
    const kept = path.join(directory, 'kept.png');
    const url = service.resource(1, kept);
    expect(url).toMatch(
        new RegExp(`/content/${output.scope}/[a-f0-9]{24}/kept\\.png$`),
    );
    expect(output.context.resources).toEqual({ [kept]: url });
});

test('app, file and embedded addresses in a local screen’s state are published', () => {
    const service = createService();
    const output = localOutput(service, 1);
    const picture = path.join(directory, 'pic.png');
    const pictureUrl = pathToFileURL(picture).href;
    const translated = service.localMessage({
        screenId: 1,
        type: 'background',
        stage: 2,
        data: {
            src: 'owa://local/assets/logo.png',
            image: pictureUrl,
            broken: 'file:///C:/a%2Fb.png',
            css: `url("${pictureUrl}") no-repeat`,
        },
    } as any);
    const content = (name: string) =>
        new RegExp(
            `^http://127\\.0\\.0\\.1:0/content/${output.scope}/[a-f0-9]{24}/${name}$`,
        );
    const data = translated.data as any;
    expect(data.src).toMatch(content('logo\\.png'));
    expect(
        output.context.resources[
            path.join(directory, 'dist', '/assets/logo.png')
        ],
    ).toBe(data.src);
    expect(data.image).toMatch(content('pic\\.png'));
    expect(data.broken).toBe('');
    expect(data.css).toBe(`url("${data.image}") no-repeat`);
    expect(output.context.stage).toBe(2);
});

test('a development build publishes the app’s own files from where Vite serves them', () => {
    fixture.isDev = true;
    const service = createService();
    const output = localOutput(service, 1);
    const absolute = path.join(directory, 'fs', 'shot.png');
    const translated = service.localMessage({
        screenId: 1,
        type: 'background',
        data: {
            viaFs: `owa://local/@fs/${absolute.replace(/\\/g, '/')}`,
            source: 'owa://local/src/assets/a.png',
            public: 'owa://local/images/b.png',
        },
    } as any);
    const data = translated.data as any;
    expect(Object.keys(output.context.resources).sort()).toEqual(
        [
            absolute.replace(/\\/g, '/'),
            path.join(directory, '', '/src/assets/a.png'),
            path.join(directory, 'public', '/images/b.png'),
        ].sort(),
    );
    expect(data.viaFs).toMatch(/\/shot\.png$/);
    expect(data.source).toMatch(/\/a\.png$/);
    expect(data.public).toMatch(/\/b\.png$/);
});

test('a guest’s output names this host’s cameras as its own', () => {
    const service = createService();
    const { socket, id } = approvedGuest(service);
    localOutput(service, 4, {
        displayId: MIRROR_REMOTE_DISPLAY_FIRST,
        guestId: id,
    });
    service.sendScreenMessage({
        screenId: 4,
        type: 'foreground',
        data: {
            camera: { type: 'camera', src: 'cam-1', deviceId: 'cam-1' },
            cameraDataList: [{ id: 'cam-2' }, { id: 'mirror-camera:x:y' }],
        },
    } as any);
    const data = socket.packets.at(-1).message.data;
    expect(data.camera).toEqual({
        type: 'camera',
        src: `mirror-camera:${service.id}:cam-1`,
        deviceId: `mirror-camera:${service.id}:cam-1`,
    });
    expect(data.cameraDataList).toEqual([
        { id: `mirror-camera:${service.id}:cam-2` },
        { id: 'mirror-camera:x:y' },
    ]);
});

// --- the router -----------------------------------------------------------

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
}
const gateway = {
    controlUrl: 'http://192.168.1.1:5000/ctl',
    serviceType: 'urn:schemas-upnp-org:service:WANIPConnection:1',
} as any;
function mapping(externalPort: number, extra: Record<string, any> = {}) {
    return {
        ...gateway,
        externalAddress: '203.0.113.9',
        externalPort,
        internalPort: 39240,
        leaseSeconds: 60,
        ...extra,
    };
}
function routerService() {
    fixture.client.set('screen-mirror-host', 'true');
    fixture.client.set('screen-mirror-internet', 'true');
    return createService();
}

test('turning the internet off while the router answers leaves no mapping, at any step', async () => {
    const service = routerService();

    const askGateway = deferred<any>();
    vi.mocked(findRouterGateway).mockReturnValueOnce(askGateway.promise);
    let opening = service.openRouter();
    await service.setInternetEnabled(false);
    askGateway.resolve(gateway);
    await opening;
    expect(getRouterExternalAddress).not.toHaveBeenCalled();
    expect(service.routerState).toBe('off');

    fixture.client.set('screen-mirror-internet', 'true');
    vi.mocked(findRouterGateway).mockResolvedValueOnce(gateway);
    const askAddress = deferred<string>();
    vi.mocked(getRouterExternalAddress).mockReturnValueOnce(askAddress.promise);
    opening = service.openRouter();
    await until(() => vi.mocked(getRouterExternalAddress).mock.calls.length);
    await service.setInternetEnabled(false);
    askAddress.resolve('203.0.113.9');
    await opening;
    expect(openRouterPort).not.toHaveBeenCalled();

    fixture.client.set('screen-mirror-internet', 'true');
    vi.mocked(findRouterGateway).mockResolvedValueOnce(gateway);
    vi.mocked(getRouterExternalAddress).mockResolvedValueOnce('203.0.113.9');
    const askPort = deferred<any>();
    vi.mocked(openRouterPort).mockReturnValueOnce(askPort.promise);
    opening = service.openRouter();
    await until(() => vi.mocked(openRouterPort).mock.calls.length);
    await service.setInternetEnabled(false);
    const late = mapping(40000);
    askPort.resolve(late);
    await opening;
    expect(closeRouterPort).toHaveBeenCalledWith(late);
    expect(fixture.client.get('screen-mirror-router-mapping') ?? '').toBe('');

    fixture.client.set('screen-mirror-internet', 'true');
    const failing = deferred<any>();
    vi.mocked(findRouterGateway).mockReturnValueOnce(failing.promise);
    opening = service.openRouter();
    await service.setInternetEnabled(false);
    failing.reject(new Error('router gone'));
    await opening;
    expect(lookUpPublicAddress).not.toHaveBeenCalled();
    expect(service.routerState).toBe('off');
});

test('a mapping an earlier launch left on another port is removed once a new one opens', async () => {
    const previous = {
        ...gateway,
        externalPort: 40000,
        internalPort: 39240,
    };
    fixture.client.set(
        'screen-mirror-router-mapping',
        JSON.stringify(previous),
    );
    const service = routerService();
    vi.mocked(findRouterGateway).mockResolvedValue(gateway);
    vi.mocked(getRouterExternalAddress).mockResolvedValue('203.0.113.9');
    vi.mocked(openRouterPort).mockResolvedValue(mapping(40001));

    await service.openRouter();

    expect(vi.mocked(openRouterPort).mock.calls[0][3]).toMatchObject({
        preferredPort: 40000,
    });
    expect(closeRouterPort).toHaveBeenCalledWith(previous);
    expect(service.routerState).toBe('open');
    expect(
        JSON.parse(fixture.client.get('screen-mirror-router-mapping')!),
    ).toMatchObject({ externalPort: 40001 });
});

test('the mapping is renewed at half its lease, and asked again when it leads elsewhere or fails', async () => {
    const service = routerService();
    vi.mocked(findRouterGateway).mockResolvedValue(gateway);
    vi.mocked(getRouterExternalAddress).mockResolvedValue('203.0.113.9');
    vi.mocked(openRouterPort).mockResolvedValue(mapping(40001));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await service.openRouter();
    expect(openRouterPort).toHaveBeenCalledTimes(1);

    vi.mocked(probeRouterPort).mockResolvedValueOnce('this');
    await vi.advanceTimersByTimeAsync(30000);
    expect(renewRouterPort).toHaveBeenCalledTimes(1);
    expect(vi.mocked(probeRouterPort).mock.calls[0].slice(0, 2)).toEqual([
        '203.0.113.9',
        40001,
    ]);
    expect(openRouterPort).toHaveBeenCalledTimes(1);

    vi.mocked(probeRouterPort).mockResolvedValueOnce('other');
    await vi.advanceTimersByTimeAsync(30000);
    expect(renewRouterPort).toHaveBeenCalledTimes(2);
    await until(() => vi.mocked(openRouterPort).mock.calls.length === 2);

    vi.mocked(renewRouterPort).mockRejectedValueOnce(new Error('expired'));
    await vi.advanceTimersByTimeAsync(30000);
    await until(() => vi.mocked(openRouterPort).mock.calls.length === 3);
    expect(service.routerState).toBe('open');
});

test('closing the viewers’ share rebinds to loopback and releases the router', async () => {
    fixture.client.set('screen-mirror-internet', 'true');
    fixture.client.set('virtual-display-share', 'true');
    const service = await startService(false);
    const port = service.port;
    await until(() => service.routerState === 'unavailable');
    expect((service as any).server.address().address).toBe('::');
    // A connection that has not spoken yet is ended, not waited for.
    const idle = net.connect(port, '127.0.0.1');
    const idleClosed = new Promise((resolve) => idle.once('close', resolve));
    idle.on('error', () => {});
    await new Promise((resolve) => idle.once('connect', resolve));
    await until(
        () => (service as any).serverSockets.get((service as any).server)?.size,
    );

    await service.setVirtualDisplayShareEnabled(false);

    await idleClosed;
    expect(service.routerState).toBe('off');
    expect(service.port).toBe(port);
    expect((service as any).server.address().address).toBe('127.0.0.1');
});

// --- hosting, the internet, discovery ------------------------------------

test('closing the internet ends guests from outside this network; the room stays', async () => {
    fixture.client.set('screen-mirror-host', 'true');
    fixture.client.set('screen-mirror-internet', 'true');
    const service = createService();
    const room = approvedGuest(service, [], '192.168.1.7');
    const away = approvedGuest(service, [], '203.0.113.7');
    const resume = away.socket.packets.find(
        (packet: any) => packet.type === 'approved',
    ).resume;

    await service.setInternetEnabled(true);
    expect(findRouterGateway).not.toHaveBeenCalled();
    await service.setInternetEnabled(false);

    expect(away.socket.packets.at(-1)).toEqual({
        protocol: 1,
        type: 'error',
        error: 'Disconnected by host',
    });
    expect(away.socket.closes).toHaveLength(1);
    expect(room.socket.closes).toEqual([]);
    expect(service.state().guests.map((guest) => guest.id)).toEqual([room.id]);
    // Its resume token went with it: coming back means asking again.
    const again = accept(service, '203.0.113.7');
    again.receive('hello', {
        id: away.id,
        name: 'Guest',
        version: appInfo.version,
        resume,
    });
    expect(again.packets).toEqual([{ protocol: 1, type: 'pending' }]);
});

test('a scan’s datagram is answered with this host; a broken discovery socket is let go', async () => {
    setHosting(true);
    await useFreePort(true);
    const service = createService();
    await service.start();
    const udp = (service as any).udp as dgram.Socket;
    await new Promise<void>((resolve, reject) => {
        try {
            udp.address();
            resolve();
        } catch {
            udp.once('listening', () => resolve());
            udp.once('error', reject);
        }
    });
    (service as any).openDiscovery();
    expect((service as any).udp).toBe(udp);

    const asker = dgram.createSocket('udp4');
    cleanups.push(() => asker.close());
    const replies: any[] = [];
    asker.on('message', (data) => replies.push(JSON.parse(data.toString())));
    await new Promise<void>((resolve) =>
        asker.bind(0, '127.0.0.1', () => resolve()),
    );
    asker.send('not a scan', service.port, '127.0.0.1');
    asker.send('owa-screen-mirror-discover-v1', service.port, '127.0.0.1');
    await until(() => replies.length);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(replies).toEqual([service.discovery()]);

    udp.emit('error', new Error('network down'));
    expect((service as any).udp).toBeUndefined();
});

// --- the tunnel -----------------------------------------------------------

test('the tunnel finds cloudflared in the chosen data folder, else in this profile', async () => {
    const service = createService();
    const win = trustedWindow();
    const options = (service as any).tunnel.options;
    expect(options.binaryPath()).toBe(getCloudflaredBinPath(fixture.userData));
    fixture.client.set('selected-parent-dir', directory);
    expect(options.binaryPath()).toBe(getCloudflaredBinPath(directory));
    fixture.client.set('selected-parent-dir', path.join(directory, 'gone'));
    expect(options.binaryPath()).toBe(getCloudflaredBinPath(fixture.userData));

    const calls: any[] = [];
    fixture.netFetch = async (...args) => {
        calls.push(args);
        return 'answer';
    };
    await expect(
        options.fetch('https://a.trycloudflare.com/', { method: 'HEAD' }),
    ).resolves.toBe('answer');
    expect(calls).toEqual([
        ['https://a.trycloudflare.com/', { method: 'HEAD' }],
    ]);
    options.onChange();
    expect(win.sent.map(([channel]) => channel)).toContain('mirror:state');
});

test('a tunnel door that cannot open, or is switched off while opening, starts no cloudflared', async () => {
    fixture.client.set('screen-mirror-host', 'true');
    fixture.client.set('screen-mirror-internet', 'true');
    const service = createService();
    const start = vi
        .spyOn((service as any).tunnel, 'start')
        .mockImplementation(() => {});
    const failingServer = () => {
        const server = new EventEmitter() as any;
        server.listen = () =>
            process.nextTick(() => server.emit('error', new Error('EACCES')));
        server.close = () => {};
        return server;
    };
    const createServer = vi.spyOn(service as any, 'createServer');

    createServer.mockImplementationOnce(failingServer);
    service.setTunnelEnabled(true);
    expect((service as any).tunnelServer).toBeDefined();
    await until(() => (service as any).tunnelServer === undefined);
    expect(start).not.toHaveBeenCalled();

    service.setTunnelEnabled(false);
    createServer.mockImplementationOnce(failingServer);
    service.setTunnelEnabled(true);
    const opening = (service as any).tunnelServer;
    service.setTunnelEnabled(false);
    await expect(opening).resolves.toBeNull();
    await new Promise((resolve) => setImmediate(resolve));
    expect(start).not.toHaveBeenCalled();
    expect(service.tunnelState.status).toBe('off');
});

// --- HTTPS ----------------------------------------------------------------

test('HTTPS that cannot get a certificate turns itself back off', async () => {
    const service = createService();
    const win = trustedWindow();
    await service.setHttpsEnabled(false);
    expect(win.sent).toEqual([]);

    await expect(service.setHttpsEnabled(true)).rejects.toThrow(
        'Unable to turn on HTTPS',
    );
    expect(service.isHttpsEnabled).toBe(false);
    expect(fixture.client.get('virtual-display-https')).toBe('');
    expect(win.sent.map(([channel]) => channel)).toContain('mirror:state');
});

test('HTTPS opens once, routes its upgrades, and opens nothing if switched off mid-way', async () => {
    const service = createService();
    let made = 0;
    fixture.genCertificate = async () => {
        made++;
        return {};
    };
    await service.setHttpsEnabled(true);
    expect((service as any).secureServer).toBeDefined();
    expect(await (service as any).openHttps()).toBe(true);
    expect(made).toBe(1);

    // A viewer's socket over TLS goes the same way as over plain HTTP.
    const upgrade = vi.fn();
    service.setVirtualDisplayHooks({
        route: vi.fn(),
        upgrade,
        admits: () => true,
        onNetworkChanged: () => {},
    });
    const req = {
        url: '/vd/1/ws',
        headers: {},
        socket: { remoteAddress: '192.168.1.7' },
    };
    const socket = { destroy: vi.fn() };
    const head = Buffer.alloc(0);
    (service as any).secureServer.emit('upgrade', req, socket, head);
    expect(upgrade).toHaveBeenCalledWith(req, socket, head, 'local');

    await service.setHttpsEnabled(false);
    expect((service as any).secureServer).toBeUndefined();

    const certificate = deferred<any>();
    fixture.genCertificate = () => certificate.promise;
    fixture.secure.delete('virtual-display-tls');
    const turningOn = service.setHttpsEnabled(true);
    await service.setHttpsEnabled(false);
    certificate.resolve({});
    await turningOn;
    expect((service as any).secureServer).toBeUndefined();
    expect(fixture.secure.has('virtual-display-tls')).toBe(false);
});

// --- HTTP -----------------------------------------------------------------

function viewerHooks(admits: (network: string) => boolean = () => true) {
    return {
        route: vi.fn(),
        upgrade: vi.fn(),
        admits: vi.fn(admits),
        onNetworkChanged: () => {},
    };
}

test('a viewer loads published content while hosting is off, only if its display admits it', async () => {
    const service = createService();
    const hooks = viewerHooks();
    service.setVirtualDisplayHooks(hooks);
    const file = path.join(directory, 'slide.png');
    await writeFile(file, 'png-bytes');
    const published = service.content.publish(
        service.content.createScope(),
        file,
    )!;

    const shown = await handleHttp(service, published, '192.168.1.7');
    await until(() => shown.writableEnded);
    expect(shown.statusCode).toBe(200);
    expect(shown.body.toString()).toBe('png-bytes');
    expect(hooks.admits).toHaveBeenCalledWith('local');

    hooks.admits.mockReturnValue(false);
    const refused = await handleHttp(service, published, '192.168.1.7');
    expect(refused.statusCode).toBe(404);
});

test('a development viewer gets a Vite client that never dials back', async () => {
    fixture.isDev = true;
    const service = createService();
    service.setVirtualDisplayHooks(viewerHooks());
    const res = await handleHttp(service, '/@vite/client', '192.168.1.7');
    expect(res.statusCode).toBe(200);
    expect(res.headers).toMatchObject({
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
    });
    expect(res.body.toString()).toContain('export function createHotContext()');
    expect(res.body.toString()).not.toContain('WebSocket');
});

test('this computer’s windows load built files; a bad escape or a failing route is a 404', async () => {
    const service = createService();
    await mkdir(path.join(directory, 'dist'), { recursive: true });
    await writeFile(path.join(directory, 'dist', 'screen.html'), '<p>s</p>');
    const page = await handleHttp(service, '/screen.html', '127.0.0.1');
    await until(() => page.writableEnded);
    expect(page.statusCode).toBe(200);
    expect(page.body.toString()).toBe('<p>s</p>');

    const badEscape = await handleHttp(service, '/%E0%A4%A', '127.0.0.1');
    expect(badEscape.statusCode).toBe(404);
    expect(badEscape.writableEnded).toBe(true);

    service.setVirtualDisplayHooks({
        ...viewerHooks(),
        route: () => {
            throw new Error('route failed');
        },
    });
    const failed = await handleHttp(service, '/vd/1/', '127.0.0.1');
    expect(failed.statusCode).toBe(404);
    expect(failed.writableEnded).toBe(true);
});

test('a development build proxies this computer’s page requests to Vite, and fails cleanly when it is down', async () => {
    fixture.isDev = true;
    const service = createService();
    const requests: any[] = [];
    let isViteUp = true;
    vi.spyOn(https, 'request').mockImplementation(((
        url: string,
        options: any,
        callback: (response: any) => void,
    ) => {
        const request = new EventEmitter() as any;
        request.destroyed = false;
        request.destroy = () => {
            request.destroyed = true;
        };
        request.end = () => {
            if (!isViteUp) {
                request.emit('error', new Error('ECONNREFUSED'));
                return;
            }
            const response = Readable.from([
                Buffer.from('export default 1;'),
            ]) as any;
            response.statusCode = 200;
            response.headers = { 'content-type': 'text/javascript' };
            callback(response);
        };
        requests.push({ url, options, request });
        return request;
    }) as any);

    const page = await handleHttp(service, '/src/main.tsx?t=5', '127.0.0.1');
    await until(() => page.writableEnded);
    expect(requests.map(({ url, options }) => [url, options])).toEqual([
        [
            'https://localhost:3000/src/main.tsx?t=5',
            { method: 'GET', rejectUnauthorized: false },
        ],
    ]);
    expect(page.statusCode).toBe(200);
    expect(page.headers['content-type']).toBe('text/javascript');
    expect(page.body.toString()).toBe('export default 1;');
    page.emit('close');
    expect(requests[0].request.destroyed).toBe(true);

    isViteUp = false;
    const down = await handleHttp(service, '/src/other.ts', '127.0.0.1');
    expect(down.statusCode).toBe(502);
    expect(down.writableEnded).toBe(true);
});

// --- WebSocket upgrades ----------------------------------------------------

async function closedPort() {
    const probe = net.createServer();
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const port = (probe.address() as net.AddressInfo).port;
    await new Promise<void>((resolve) => probe.close(() => resolve()));
    return port;
}
function openScreenSocket(service: ScreenMirrorService) {
    const screen = new WebSocket(
        `ws://127.0.0.1:${service.port}/?token=abc`,
        'vite-hmr',
    );
    cleanups.push(() => screen.terminate());
    const received: string[] = [];
    screen.on('message', (data) => received.push(data.toString()));
    screen.on('error', () => {});
    const closed = new Promise<number>((resolve) =>
        screen.once('close', resolve),
    );
    return { screen, received, closed };
}

test('a development screen’s hot-reload socket is bridged to Vite, both ways', async () => {
    fixture.isDev = true;
    const service = await startService();
    // Vite, as the bridge dials it: held until the screen has spoken first.
    let admit: (() => void) | null = null;
    const vite = new WebSocketServer({
        host: '127.0.0.1',
        port: 0,
        verifyClient: (_info, callback) => {
            admit = () => callback(true);
        },
    });
    cleanups.push(() => new Promise((resolve) => vite.close(resolve)));
    await new Promise((resolve) => vite.once('listening', resolve));
    const vitePort = (vite.address() as net.AddressInfo).port;
    fixture.redirect = (url) =>
        url.replace('wss://localhost:3000', `ws://127.0.0.1:${vitePort}`);
    const viteSide = new Promise<any>((resolve) => {
        vite.on('connection', (socket, req) => {
            const messages: string[] = [];
            socket.on('message', (data) => messages.push(data.toString()));
            resolve({ socket, url: req.url, messages });
        });
    });

    const { screen, received } = openScreenSocket(service);
    await new Promise((resolve) => screen.once('open', resolve));
    screen.send('early');
    await until(() => admit);
    admit!();
    const side = await viteSide;
    await until(() => side.messages.length === 1);
    expect(side.messages).toEqual(['early']);
    expect(side.url).toBe('/?token=abc');
    expect(side.socket.protocol).toBe('vite-hmr');

    screen.send('late');
    await until(() => side.messages.length === 2);
    side.socket.send('update');
    await until(() => received.length === 1);
    expect(received).toEqual(['update']);

    const viteClosed = new Promise((resolve) =>
        side.socket.once('close', resolve),
    );
    screen.close();
    await viteClosed;
});

test('a development screen’s socket closes with Vite, and fails when Vite is not there', async () => {
    fixture.isDev = true;
    const service = await startService();
    const vite = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    cleanups.push(() => new Promise((resolve) => vite.close(resolve)));
    await new Promise((resolve) => vite.once('listening', resolve));
    const vitePort = (vite.address() as net.AddressInfo).port;
    fixture.redirect = (url) =>
        url.replace('wss://localhost:3000', `ws://127.0.0.1:${vitePort}`);
    const viteSocket = new Promise<WebSocket>((resolve) =>
        vite.once('connection', resolve),
    );
    const first = openScreenSocket(service);
    (await viteSocket).close();
    expect(await first.closed).toBe(1005);

    const unreachable = await closedPort();
    fixture.redirect = (url) =>
        url.replace('wss://localhost:3000', `ws://127.0.0.1:${unreachable}`);
    const second = openScreenSocket(service);
    expect(await second.closed).toBe(1011);
});

test('an upgrade the socket server cannot take is ended, and frees its place', async () => {
    const service = await startService(true);
    (service as any).wss.handleUpgrade = () => {
        throw new Error('bad upgrade');
    };
    const socket = new WebSocket(`ws://127.0.0.1:${service.port}/mirror`);
    socket.on('error', () => {});
    const code = await new Promise((resolve) => socket.once('close', resolve));
    expect(code).toBe(1006);
    await until(() => (service as any).peerSockets.size === 0);
    expect(service.state().pending).toEqual([]);
});

// --- who is on this network -----------------------------------------------

test('a global IPv6 card is listed for the internet, and its /64 counts as this network', async () => {
    fixture.client.set('screen-mirror-host', 'true');
    const service = createService();
    expect(service.addressList(false).map((address) => address.kind)).toEqual([
        'lan',
    ]);
    expect(service.addressList(true)).toContainEqual({
        host: '2001:db8:1:2::10',
        port: service.port,
        kind: 'internet',
    });

    const near = await handleHttp(service, '/discovery', '2001:db8:1:2::99');
    expect(near.statusCode).toBe(200);
    expect(JSON.parse(near.body.toString())).toEqual(service.discovery());
    const far = await handleHttp(service, '/discovery', '2001:db8:9:9::1');
    expect(far.statusCode).toBe(404);
});

test('the wrong-code table stays bounded: expired senders go first, else the oldest', () => {
    const service = createService();
    const table = (service as any).wrongCodes as Map<string, unknown>;
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    // One short of the lockout, and the oldest entry.
    for (let index = 0; index < 4; index++)
        service.checkSenderCode('203.0.113.1', 'right', 'wrong');
    for (let index = 0; index < 255; index++)
        service.checkSenderCode(`198.51.100.${index}`, 'right', 'wrong');
    expect(table.size).toBe(256);

    service.checkSenderCode('203.0.113.2', 'right', 'wrong');
    expect(table.size).toBe(256);
    // Pushed out, its count started over: not locked on the fifth.
    expect(service.checkSenderCode('203.0.113.1', 'right', 'wrong')).toBe(
        'wrong',
    );

    clock.mockReturnValue(now + 11 * 60 * 1000);
    service.checkSenderCode('203.0.113.3', 'right', 'wrong');
    expect([...table.keys()]).toEqual(['203.0.113.3']);
});

// --- this computer as a guest ---------------------------------------------

// Another computer's Screen Mirror, as far as a guest can tell: `/discovery`
// over HTTP and `/mirror` over a WebSocket, driven by the test.
async function fakeHost(options: { autoPong?: boolean } = {}) {
    const id = randomUUID();
    const connections: { socket: WebSocket; packets: any[]; pings: number }[] =
        [];
    const host = {
        id,
        port: 0,
        connections,
        answer: (_req: http.IncomingMessage, res: http.ServerResponse) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
                JSON.stringify({
                    service: 'owa-screen-mirror',
                    protocol: 1,
                    id,
                    name: 'Host',
                    version: appInfo.version,
                    port: host.port,
                }),
            );
        },
        send(index: number, type: string, data: Record<string, any> = {}) {
            connections[index].socket.send(
                JSON.stringify({ protocol: 1, type, ...data }),
            );
        },
    };
    const server = http.createServer((req, res) => host.answer(req, res));
    const wss = new WebSocketServer({
        server,
        autoPong: options.autoPong ?? true,
    });
    wss.on('connection', (socket) => {
        const connection = { socket, packets: [] as any[], pings: 0 };
        socket.on('message', (data) =>
            connection.packets.push(JSON.parse(data.toString())),
        );
        socket.on('ping', () => connection.pings++);
        connections.push(connection);
    });
    await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
    );
    host.port = (server.address() as net.AddressInfo).port;
    cleanups.push(async () => {
        for (const client of wss.clients) client.terminate();
        wss.close();
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
    });
    return host;
}
function fakeLink(id: string, socket: any, extra: Record<string, any> = {}) {
    return {
        connection: {
            id,
            hostId: randomUUID(),
            status: 'connected',
            host: '10.0.0.5',
            port: 39240,
            name: 'Host',
            prefix: 'a1',
            error: null,
        },
        options: { host: '10.0.0.5', port: 39240, code: '' },
        socket,
        attempt: 0,
        cameras: [] as any[],
        shareCameras: false,
        ...extra,
    };
}

test('connecting refuses a bad address, a ninth host, and a computer that has guests of its own', async () => {
    const service = createService();
    for (const options of [
        { host: 'bad host', port: 39240, code: '' },
        { host: '127.0.0.1', port: 70000, code: '' },
    ])
        await expect(service.connect(options)).rejects.toThrow(
            'Invalid host or port',
        );
    const links = (service as any).links as Map<string, any>;
    for (let index = 0; index < 8; index++)
        links.set(`link-${index}`, fakeLink(`link-${index}`, undefined));
    await expect(
        service.connect({ host: '127.0.0.1', port: 39240, code: '' }),
    ).rejects.toThrow('Too many hosts');
    links.clear();

    approvedGuest(service);
    await expect(
        service.connect({ host: '127.0.0.1', port: 39240, code: '' }),
    ).rejects.toThrow('Invalid host or port');
});

test('a host whose discovery answer runs on, is foreign or is unreadable is not linked', async () => {
    const service = createService();
    const host = await fakeHost();
    const connect = () =>
        service.connect({ host: '127.0.0.1', port: host.port, code: '' });

    // Cut off while it is still arriving (more than one socket read).
    host.answer = (_req, res) => {
        res.writeHead(200);
        res.end('x'.repeat(200000));
    };
    await expect(connect()).rejects.toThrow('Connection failed');
    host.answer = (_req, res) => {
        res.writeHead(200);
        res.end(JSON.stringify({ service: 'something-else', protocol: 1 }));
    };
    await expect(connect()).rejects.toThrow(
        'Incompatible or duplicate connection',
    );
    host.answer = (_req, res) => {
        res.writeHead(200);
        res.end('not json');
    };
    await expect(connect()).rejects.toThrow(
        'Incompatible or duplicate connection',
    );
    // One that never answers is given up on: its own five seconds, made
    // 20 ms here.
    const realGet = http.get;
    vi.spyOn(http, 'get').mockImplementation(((
        url: string,
        options: http.RequestOptions,
        callback: (response: http.IncomingMessage) => void,
    ) => {
        expect(options.timeout).toBe(5000);
        return realGet(url, { ...options, timeout: 20 }, callback);
    }) as any);
    host.answer = () => {};
    await expect(connect()).rejects.toThrow('Connection failed');
    expect(service.state().connections).toEqual([]);
    expect(host.connections).toEqual([]);
});

test('a guest that gained a guest, or filled its links, while a host answered is refused', async () => {
    const service = createService();
    const host = await fakeHost();
    const answer = host.answer;
    const held: (() => void)[] = [];
    host.answer = (req, res) => held.push(() => answer(req, res));

    let connecting = service.connect({
        host: '127.0.0.1',
        port: host.port,
        code: '',
    });
    await until(() => held.length === 1);
    const { socket } = approvedGuest(service);
    held[0]();
    await expect(connecting).rejects.toThrow('Invalid host or port');
    socket.close();

    connecting = service.connect({
        host: '127.0.0.1',
        port: host.port,
        code: '',
    });
    await until(() => held.length === 2);
    const links = (service as any).links as Map<string, any>;
    for (let index = 0; index < 8; index++)
        links.set(`link-${index}`, fakeLink(`link-${index}`, undefined));
    held[1]();
    await expect(connecting).rejects.toThrow('Too many hosts');
    links.clear();
    expect(host.connections).toEqual([]);
});

test('a link to a host: approval, screens it cannot show, cameras, the heartbeat and reconnection', async () => {
    fixture.displays = [display];
    const service = createService();
    const win = trustedWindow();
    const host = await fakeHost({ autoPong: false });
    vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
    await service.connect({ host: '127.0.0.1', port: host.port, code: 'c0de' });
    await until(() => host.connections[0]?.packets.length);
    expect(host.connections[0].packets[0]).toEqual({
        protocol: 1,
        type: 'hello',
        id: service.id,
        name: os.hostname(),
        version: appInfo.version,
        code: 'c0de',
    });
    const linkId = service.state().connections[0].id;
    const packetsOf = (index: number, type: string) =>
        host.connections[index].packets.filter(
            (packet) => packet.type === type,
        );

    host.send(0, 'approved', { id: host.id, prefix: 'a3', resume: 'r-0' });
    await until(() => packetsOf(0, 'inventory').length);
    expect(service.state().connections[0]).toMatchObject({
        status: 'connected',
        prefix: 'a3',
    });
    expect(packetsOf(0, 'inventory')).toEqual([
        { protocol: 1, type: 'inventory', displays: [display], cameras: [] },
    ]);
    expect(win.sent.map(([channel]) => channel)).toContain('mirror:state');

    // Screens this computer cannot show are handed straight back.
    host.send(0, 'show', { screenId: -1, displayId: 15, context: {} });
    host.send(0, 'show', {
        screenId: 2,
        displayId: 99,
        context: { screenId: 2 },
    });
    await until(() => packetsOf(0, 'screen-feedback').length === 2);
    expect(packetsOf(0, 'screen-feedback')).toEqual(
        [-1, 2].map((screenId) => ({
            protocol: 1,
            type: 'screen-feedback',
            message: { screenId, type: 'visible', data: { isShowing: false } },
        })),
    );
    host.send(0, 'show', {
        screenId: 3,
        displayId: 15,
        context: { screenId: 3, stage: 0, resources: {} },
    });
    await until(() => fixture.controllers.length === 1);
    const controller = fixture.controllers[0];
    expect(controller.displays).toEqual([display]);

    host.send(0, 'cameras', {
        cameras: [{ deviceId: 'mirror-camera:h:cam', label: 'Host cam' }],
    });
    await until(() => service.cameras().length === 1);
    expect(service.cameras()).toEqual([
        { deviceId: 'mirror-camera:h:cam', label: 'Host cam', groupId: '' },
    ]);
    // The host's answer reaches the window here watching that stream.
    (service as any).guestConsumers.set('r-1', {
        contentsId: win.webContents.id,
        linkId,
    });
    host.send(0, 'camera-signal', { requestId: 'r-1', signal: 'answer' });
    const cameraPackets = () =>
        win.sent.filter(([channel]) => channel === 'mirror:camera');
    await until(() => cameraPackets().length === 1);
    expect(cameraPackets()[0][1]).toEqual({
        protocol: 1,
        type: 'camera-signal',
        requestId: 'r-1',
        signal: 'answer',
    });

    // Pinged every five seconds; one ping left unanswered cuts the link.
    const linkSocket = (service as any).links.get(linkId).socket as WebSocket;
    vi.advanceTimersByTime(5000);
    await until(() => host.connections[0].pings === 1);
    const ponged = new Promise((resolve) => linkSocket.once('pong', resolve));
    host.connections[0].socket.pong();
    await ponged;
    vi.advanceTimersByTime(5000);
    await until(() => host.connections[0].pings === 2);
    const dropped = new Promise((resolve) =>
        host.connections[0].socket.once('close', resolve),
    );
    vi.advanceTimersByTime(5000);
    await dropped;
    await until(() => service.state().connections[0].status === 'reconnecting');
    expect(controller.closedCount).toBe(1);
    expect(cameraPackets().at(-1)![1]).toEqual({
        type: 'camera-close',
        requestId: 'r-1',
    });
    expect(service.cameras()).toEqual([]);

    vi.advanceTimersByTime(1000);
    await until(() => host.connections[1]?.packets.length);
    expect(host.connections[1].packets[0]).toMatchObject({
        type: 'hello',
        resume: 'r-0',
    });

    // Refused: no more dialling, until the operator connects again.
    host.send(1, 'error', { error: 'Connection code is incorrect' });
    await until(() => service.state().connections[0].status === 'error');
    expect(service.state().connections[0].error).toBe(
        'Connection code is incorrect',
    );
    host.connections[1].socket.close();
    await until(() => !(service as any).links.get(linkId).socket);
    vi.advanceTimersByTime(60000);
    await new Promise((resolve) => setImmediate(resolve));
    expect(host.connections).toHaveLength(2);

    await service.connect({ host: '127.0.0.1', port: host.port, code: 'ok' });
    expect(service.state().connections.map((item) => item.id)).not.toContain(
        linkId,
    );
    expect(service.state().connections).toHaveLength(1);
    await until(() => host.connections[2]?.packets.length);
    expect(host.connections[2].packets[0]).toMatchObject({
        type: 'hello',
        code: 'ok',
    });
    // Anything that is not a packet: the guest hangs up.
    const hungUp = new Promise<number>((resolve) =>
        host.connections[2].socket.once('close', resolve),
    );
    host.connections[2].socket.send('not a packet');
    expect(await hungUp).toBe(1008);
});

// --- looking for hosts ----------------------------------------------------

test('a scan asks every port on each network, keeps hosts that answer truthfully, and ends after 2.5 s', async () => {
    const service = await startService();
    const main = recordMain(service);
    const sends: [number, string][] = [];
    const udp = new EventEmitter() as any;
    udp.bind = (_port: number, callback: () => void) =>
        process.nextTick(callback);
    udp.setBroadcast = vi.fn();
    udp.send = (
        _text: string,
        port: number,
        address: string,
        callback: () => void,
    ) => {
        sends.push([port, address]);
        callback();
    };
    udp.close = vi.fn();
    vi.spyOn(dgram, 'createSocket').mockReturnValue(udp);
    const gets: any[] = [];
    vi.spyOn(http, 'get').mockImplementation(((
        url: string,
        _options: unknown,
        callback: (response: Readable) => void,
    ) => {
        const request = new EventEmitter() as any;
        request.destroy = vi.fn(() => request.emit('close'));
        gets.push({ url, request, callback });
        return request;
    }) as any);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    ipc('mirror:command')(
        { sender: main },
        { action: 'scan', replyEventName: 'scanned' },
    );
    await until(() => udp.setBroadcast.mock.calls.length);
    expect(udp.setBroadcast).toHaveBeenCalledWith(true);
    expect(sends).toHaveLength(40);
    expect(sends).toContainEqual([39240, '127.0.0.1']);
    expect(sends).toContainEqual([39259, '192.168.1.255']);

    const announce = (id: string, port: number, address: string) =>
        udp.emit(
            'message',
            Buffer.from(
                JSON.stringify({
                    service: 'owa-screen-mirror',
                    protocol: 1,
                    id,
                    name: 'Host',
                    version: appInfo.version,
                    port,
                }),
            ),
            { address, port: 5353 },
        );
    const truthful = randomUUID();
    const chatty = randomUUID();
    udp.emit('message', Buffer.alloc(3000), {
        address: '192.168.1.9',
        port: 1,
    });
    announce(truthful, 39241, '192.168.1.9');
    announce(truthful, 39241, '192.168.1.9');
    announce(chatty, 39242, '192.168.1.10');
    announce(service.id, 39243, '192.168.1.11');
    expect(gets.map(({ url }) => url)).toEqual([
        'http://192.168.1.9:39241/discovery',
        'http://192.168.1.10:39242/discovery',
    ]);
    gets[0].callback(
        Readable.from([
            JSON.stringify({
                service: 'owa-screen-mirror',
                protocol: 1,
                id: truthful,
                name: 'Host',
                version: appInfo.version,
                port: 39241,
            }),
        ]),
    );
    gets[1].callback(Readable.from(['x'.repeat(3000)]));
    await until(() => gets[1].request.destroy.mock.calls.length);
    gets[0].request.emit('timeout');
    expect(gets[0].request.destroy).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2500);
    await until(() => main.sent.some(([channel]) => channel === 'scanned'));
    const [, found] = main.sent.find(([channel]) => channel === 'scanned')!;
    expect(found).toEqual([
        expect.objectContaining({
            id: truthful,
            port: 39241,
            host: '192.168.1.9',
        }),
    ]);
    expect(udp.close).toHaveBeenCalled();
});

// --- cameras and the broker -----------------------------------------------

const cameraPacketsOf = (socket: any) =>
    socket.packets.filter((packet: any) => packet.type.startsWith('camera-'));

test('camera routes: an unapproved source or an unknown route is ignored; a window is answered through itself', async () => {
    const service = await startService(true);
    const viewer = trustedWindow();
    const source = approvedGuest(service);
    const waiting = accept(service);
    const waitingId = hello(waiting);
    const consumer = approvedGuest(service);

    consumer.socket.receive('camera-request', {
        requestId: randomUUID(),
        deviceId: `mirror-camera:${waitingId}:cam`,
    });
    consumer.socket.receive('camera-signal', { requestId: randomUUID() });
    expect(cameraPacketsOf(waiting)).toEqual([]);
    expect(cameraPacketsOf(source.socket)).toEqual([]);

    const requestId = randomUUID();
    ipc('mirror:camera-send')(
        { sender: viewer.webContents },
        {
            type: 'camera-request',
            requestId,
            deviceId: `mirror-camera:${source.id}:cam-9`,
        },
    );
    expect(cameraPacketsOf(source.socket)).toEqual([
        {
            protocol: 1,
            type: 'camera-request',
            requestId,
            deviceId: 'cam-9',
        },
    ]);
    source.socket.receive('camera-signal', { requestId, signal: 'offer' });
    expect(viewer.sent).toContainEqual([
        'mirror:camera',
        { protocol: 1, type: 'camera-signal', requestId, signal: 'offer' },
    ]);
});

test('this host’s camera is served by a hidden broker window, released five seconds after its last stream', async () => {
    const service = await startService(true);
    const consumer = approvedGuest(service);
    const requestId = randomUUID();
    consumer.socket.receive('camera-request', {
        requestId,
        deviceId: `mirror-camera:${service.id}:cam-1`,
    });

    expect(fixture.brokers).toHaveLength(1);
    const broker = fixture.brokers[0];
    expect(broker.options).toEqual({
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: expect.stringMatching(/client[\\/]preloadProvider\.js$/),
        },
    });
    expect(broker.loadedUrls).toEqual(['owa://local/camera-broker.html']);
    expect(broker.webContents.openHandler()).toEqual({ action: 'deny' });
    // Held until the broker page has loaded.
    expect(broker.webContents.sent).toEqual([]);
    broker.webContents.finishLoad();
    expect(broker.webContents.sent).toEqual([
        [
            'mirror:camera',
            {
                protocol: 1,
                type: 'camera-request',
                requestId,
                deviceId: 'cam-1',
            },
        ],
    ]);

    const fromBroker = (packet: Record<string, any>) =>
        ipc('mirror:camera-send')({ sender: broker.webContents }, packet);
    fromBroker({ type: 'camera-signal', requestId, signal: 'answer' });
    expect(consumer.socket.packets.at(-1)).toMatchObject({
        type: 'camera-signal',
        requestId,
        signal: 'answer',
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fromBroker({ type: 'camera-close', requestId });
    expect(consumer.socket.packets.at(-1)).toMatchObject({
        type: 'camera-close',
        requestId,
    });
    vi.advanceTimersByTime(4999);
    expect(broker.destroyed).toBe(false);
    vi.advanceTimersByTime(1);
    expect(broker.destroyed).toBe(true);
});

test('the intercom asks macOS for the microphone, and the broker’s voice reaches each pair whose mic is on', async () => {
    const service = await startService(true);
    const guest = approvedGuest(service);
    const key = `guest:${guest.id}`;
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
    const asked: string[] = [];
    fixture.askForMediaAccess = async (kind) => {
        asked.push(kind);
        return false;
    };
    Object.defineProperty(process, 'platform', {
        ...platform,
        value: 'darwin',
    });
    try {
        await expect(service.setIntercom(key, { mic: true })).rejects.toThrow(
            'Microphone access denied',
        );
    } finally {
        Object.defineProperty(process, 'platform', platform);
    }
    expect(asked).toEqual(['microphone']);
    expect(service.intercomStateOf(key).mic).toBe(false);

    await service.setIntercom(key, { mic: true });
    expect(guest.socket.packets.at(-1)).toEqual({
        protocol: 1,
        type: 'intercom-state',
        mic: true,
    });
    const broker = fixture.brokers[0];
    broker.webContents.finishLoad();
    expect(broker.webContents.sent).toEqual([
        ['mirror:intercom', { type: 'config', isMicOn: true, speakers: {} }],
    ]);
    // Loaded: a new configuration goes straight in.
    await service.setIntercom(key, { speaker: true, volume: 0.5 });
    expect(broker.webContents.sent.at(-1)).toEqual([
        'mirror:intercom',
        { type: 'config', isMicOn: true, speakers: { [key]: 0.5 } },
    ]);

    ipc('mirror:intercom-audio')(
        { sender: broker.webContents },
        new Uint8Array([1, 2, 3]),
    );
    expect(guest.socket.packets.at(-1)).toEqual({
        protocol: 1,
        type: 'audio',
        data: Buffer.from([1, 2, 3]).toString('base64'),
    });
    const count = guest.socket.packets.length;
    ipc('mirror:intercom-audio')(
        { sender: trustedWindow().webContents },
        new Uint8Array([4]),
    );
    expect(guest.socket.packets).toHaveLength(count);
});

test('unsharing this computer’s cameras, or dropping the link, ends that host’s streams of them at once', async () => {
    const service = await startService();
    const win = trustedWindow();
    const linkSocket = fakeSocket();
    const link = fakeLink('link-1', linkSocket, { shareCameras: true });
    (service as any).links.set('link-1', link);

    service.setShareCameras('missing', false);
    service.setShareCameras('link-1', true);
    expect(linkSocket.packets).toEqual([]);

    (service as any).deliverGuestCamera(link, {
        type: 'camera-request',
        requestId: 'r-1',
        deviceId: 'cam',
    });
    const first = fixture.brokers[0];
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    service.setShareCameras('link-1', false);
    expect(first.webContents.sent).toContainEqual([
        'mirror:camera',
        { type: 'camera-close', requestId: 'r-1' },
    ]);
    expect(linkSocket.packets).toContainEqual({
        protocol: 1,
        type: 'camera-close',
        requestId: 'r-1',
    });
    expect(linkSocket.packets.at(-1)).toEqual({
        protocol: 1,
        type: 'inventory',
        displays: [],
        cameras: [],
    });
    vi.advanceTimersByTime(5000);
    expect(first.destroyed).toBe(true);

    service.setShareCameras('link-1', true);
    (service as any).deliverGuestCamera(link, {
        type: 'camera-request',
        requestId: 'r-2',
        deviceId: 'cam',
    });
    const second = fixture.brokers[1];
    (service as any).guestConsumers.set('r-3', {
        contentsId: win.webContents.id,
        linkId: 'link-1',
    });
    service.disconnect('link-1');
    expect(linkSocket.closes).toHaveLength(1);
    expect(second.webContents.sent).toContainEqual([
        'mirror:camera',
        { type: 'camera-close', requestId: 'r-2' },
    ]);
    expect(win.sent).toContainEqual([
        'mirror:camera',
        { type: 'camera-close', requestId: 'r-3' },
    ]);
    vi.advanceTimersByTime(5000);
    expect(second.destroyed).toBe(true);
});

test('as a guest, a window’s camera stream goes to the host that has the camera and ends with the window', async () => {
    const service = await startService();
    const viewer = trustedWindow();
    const linkSocket = fakeSocket();
    const camera = {
        deviceId: 'mirror-camera:h:cam',
        label: 'Host cam',
        groupId: '',
    };
    const link = fakeLink('link-1', linkSocket, {
        cameras: [camera],
        shareCameras: true,
    });
    (service as any).links.set('link-1', link);
    const send = (sender: any, packet: Record<string, any>) =>
        ipc('mirror:camera-send')({ sender }, packet);
    const consumers = (service as any).guestConsumers as Map<string, any>;

    send(viewer.webContents, {
        type: 'camera-request',
        requestId: 7,
        deviceId: camera.deviceId,
    });
    expect(linkSocket.packets).toEqual([]);
    send(viewer.webContents, {
        type: 'camera-request',
        requestId: 'r-1',
        deviceId: camera.deviceId,
    });
    expect(linkSocket.packets).toEqual([
        {
            protocol: 1,
            type: 'camera-request',
            requestId: 'r-1',
            deviceId: camera.deviceId,
        },
    ]);
    send(viewer.webContents, {
        type: 'camera-signal',
        requestId: 'r-1',
        signal: 'offer',
    });
    expect(linkSocket.packets.at(-1)).toMatchObject({
        type: 'camera-signal',
        signal: 'offer',
    });
    // Another window cannot speak for that stream.
    send(trustedWindow().webContents, {
        type: 'camera-signal',
        requestId: 'r-1',
    });
    expect(linkSocket.packets).toHaveLength(2);
    send(viewer.webContents, { type: 'camera-close', requestId: 'r-1' });
    expect(linkSocket.packets.at(-1)).toMatchObject({
        type: 'camera-close',
        requestId: 'r-1',
    });
    expect(consumers.has('r-1')).toBe(false);

    // A stream still open when its window goes is closed at the host.
    send(viewer.webContents, {
        type: 'camera-request',
        requestId: 'r-2',
        deviceId: camera.deviceId,
    });
    viewer.webContents.emit('destroyed');
    expect(linkSocket.packets.at(-1)).toEqual({
        protocol: 1,
        type: 'camera-close',
        requestId: 'r-2',
    });
    expect(consumers.size).toBe(0);

    // The broker's answer to the host's own request goes back to that host.
    (service as any).deliverGuestCamera(link, {
        type: 'camera-request',
        requestId: 'b-1',
        deviceId: 'cam',
    });
    const broker = fixture.brokers[0];
    send(broker.webContents, {
        type: 'camera-signal',
        requestId: 'b-1',
        signal: 'answer',
    });
    expect(linkSocket.packets.at(-1)).toMatchObject({
        type: 'camera-signal',
        requestId: 'b-1',
    });
    send(broker.webContents, { type: 'camera-close', requestId: 'b-1' });
    expect(linkSocket.packets.at(-1)).toMatchObject({
        type: 'camera-close',
        requestId: 'b-1',
    });
    expect((service as any).brokerLinks.has('b-1')).toBe(false);

    // Nothing goes over a link that is not up, or past 128 streams.
    const sent = linkSocket.packets.length;
    const other = trustedWindow();
    link.connection.status = 'reconnecting';
    send(other.webContents, {
        type: 'camera-request',
        requestId: 'r-3',
        deviceId: camera.deviceId,
    });
    link.connection.status = 'connected';
    for (let index = 0; index < 128; index++)
        consumers.set(`busy-${index}`, { contentsId: 1, linkId: 'other' });
    send(other.webContents, {
        type: 'camera-request',
        requestId: 'r-4',
        deviceId: camera.deviceId,
    });
    expect(linkSocket.packets).toHaveLength(sent);
    expect(consumers.has('r-3') || consumers.has('r-4')).toBe(false);
});

// --- IPC --------------------------------------------------------------------

test('IPC answers only the app’s own windows: state, screen context, resources and this computer’s cameras', async () => {
    const service = await startService(true);
    const trusted = trustedWindow();
    const stranger = makeWindow('https://example.com/x.html');
    const ask = (channel: string, sender: any, ...args: any[]) => {
        const event: any = { sender };
        ipc(channel)(event, ...args);
        return event.returnValue;
    };
    expect(ask('mirror:state', trusted.webContents)).toEqual(service.state());
    expect(ask('mirror:state', stranger.webContents)).toBeNull();

    const hostScreen = { screenId: 0, stage: 1, resources: {} };
    (service as any).incoming.set('link:0', {
        linkId: 'link',
        screenId: 0,
        contentsId: trusted.webContents.id,
        controller: {},
        context: hostScreen,
    });
    const own = trustedWindow();
    localOutput(service, 6);
    expect(ask('mirror:screen-context', trusted.webContents, 0)).toBe(
        hostScreen,
    );
    expect(ask('mirror:screen-context', own.webContents, 6)).toMatchObject({
        screenId: 6,
    });
    expect(ask('mirror:screen-context', own.webContents, 7)).toBeNull();
    expect(ask('mirror:screen-context', stranger.webContents, 6)).toBeNull();

    const file = path.join(directory, 'a.png');
    expect(
        ask('mirror:resource', own.webContents, {
            screenId: 6,
            filePath: file,
        }),
    ).toMatch(/\/content\/[a-f0-9]{48}\/[a-f0-9]{24}\/a\.png$/);
    expect(
        ask('mirror:resource', own.webContents, { screenId: 6, filePath: 7 }),
    ).toBe('');
    expect(
        ask('mirror:resource', stranger.webContents, {
            screenId: 6,
            filePath: file,
        }),
    ).toBe('');

    const guest = approvedGuest(service);
    const inventory = [{ deviceId: 'cam-1', label: 'Front' }];
    const before = guest.socket.packets.length;
    ipc('mirror:physical-cameras')({ sender: stranger.webContents }, inventory);
    expect(guest.socket.packets).toHaveLength(before);
    ipc('mirror:physical-cameras')({ sender: trusted.webContents }, inventory);
    expect(guest.socket.packets.at(-1)).toEqual({
        protocol: 1,
        type: 'cameras',
        cameras: [
            {
                deviceId: `mirror-camera:${service.id}:cam-1`,
                label: 'Front',
                groupId: '',
            },
        ],
    });
    const after = guest.socket.packets.length;
    ipc('mirror:physical-cameras')({ sender: trusted.webContents }, inventory);
    expect(guest.socket.packets).toHaveLength(after);
});

test('presenter commands reach the firewall, guests, the internet, the router, the intercom, shared cameras and the tunnel', async () => {
    const service = await startService(true);
    const main = recordMain(service);
    const start = vi
        .spyOn((service as any).tunnel, 'start')
        .mockImplementation(() => {});
    const command = async (data: Record<string, any>) => {
        const replyEventName = `reply-${randomUUID()}`;
        ipc('mirror:command')({ sender: main }, { ...data, replyEventName });
        await until(() =>
            main.sent.some(([channel]) => channel === replyEventName),
        );
        return main.sent.find(([channel]) => channel === replyEventName)![1];
    };

    expect(await command({ action: 'firewall', isForced: true })).toEqual({
        status: 'allowed',
    });
    expect(
        await command({ action: 'open-firewall-settings', target: 'private' }),
    ).toBe(true);
    expect(fixture.firewallCalls).toEqual([
        ['check', { port: service.port, isForced: true }],
        ['open', 'private'],
    ]);

    const waiting = accept(service);
    const waitingId = hello(waiting);
    expect(
        (await command({ action: 'approve', id: waitingId })).guests,
    ).toEqual([expect.objectContaining({ id: waitingId, prefix: 'a1' })]);
    const leaving = approvedGuest(service);
    await command({ action: 'disconnect-guest', id: leaving.id });
    expect(leaving.socket.packets.at(-1)).toEqual({
        protocol: 1,
        type: 'error',
        error: 'Disconnected by host',
    });
    expect(leaving.socket.closes).toHaveLength(1);
    expect(
        (await command({ action: 'reject', id: randomUUID() })).guests,
    ).toHaveLength(1);

    const connectError = await command({
        action: 'connect',
        host: '127.0.0.1',
        port: 39240,
        code: 7,
    });
    expect(connectError).toBeInstanceOf(Error);
    expect(connectError.message).toBe('Invalid host or port');

    expect(findRouterGateway).not.toHaveBeenCalled();
    await command({ action: 'router' });
    expect(findRouterGateway).not.toHaveBeenCalled();
    expect((await command({ action: 'internet', enabled: true })).router).toBe(
        'working',
    );
    await until(() => service.routerState === 'unavailable');
    await command({ action: 'router' });
    expect(findRouterGateway).toHaveBeenCalledTimes(2);
    await until(() => service.routerState === 'unavailable');

    await command({
        action: 'intercom',
        key: `guest:${waitingId}`,
        mic: true,
    });
    expect(waiting.packets.at(-1)).toEqual({
        protocol: 1,
        type: 'intercom-state',
        mic: true,
    });

    const linkSocket = fakeSocket();
    (service as any).links.set('link-1', fakeLink('link-1', linkSocket));
    const shared = await command({
        action: 'share-cameras',
        id: 'link-1',
        enabled: true,
    });
    expect(shared.connections[0]).toMatchObject({
        id: 'link-1',
        shareCameras: true,
    });
    expect(linkSocket.packets.at(-1)).toMatchObject({ type: 'inventory' });
    await command({ action: 'disconnect', id: 'link-1' });
    expect(linkSocket.closes).toHaveLength(1);
    expect(service.state().connections).toEqual([]);

    const tunnel = await command({ action: 'tunnel', enabled: true });
    expect(tunnel.tunnelEnabled).toBe(true);
    await until(() => start.mock.calls.length);
    expect(start).toHaveBeenCalledWith(expect.any(Number));
    expect(
        (await command({ action: 'tunnel', enabled: false })).tunnelEnabled,
    ).toBe(false);
});
