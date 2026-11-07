import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { EventEmitter, once } from 'node:events';
import { randomUUID } from 'node:crypto';
import dgram from 'node:dgram';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import WebSocket, { WebSocketServer } from 'ws';
import type * as RouterModule from './screenMirrorRouter';
import type * as TlsModule from './mirrorTls';
import type * as WsModule from 'ws';

// The paths of Screen Mirror the main suite does not walk: a port that
// cannot be had, a guest that never speaks or speaks garbage, a link to a
// host that drops, the broker, the presenter's commands, a development
// build's proxies. Every socket here is on 127.0.0.1 -- the server's binds
// are pinned to loopback, UDP is a stand-in, Vite and every host are this
// file's own servers on free ports -- and no tunnel binary can start.

const { fixture, makeContents } = vi.hoisted(() => {
    const fixture = {
        client: new Map<string, string>(),
        secure: new Map<string, string>(),
        ipc: new Map<string, ((...args: any[]) => void)[]>(),
        screenHandlers: new Map<string, (() => void)[]>(),
        displays: [] as any[],
        windows: [] as any[],
        brokers: [] as any[],
        controllers: [] as any[],
        screenOutputs: new Map<number, any>(),
        isDev: false,
        appPath: '',
        userDataPath: '',
        binDirs: [] as string[],
        netFetches: [] as [string, unknown][],
        mediaAccess: true,
        viteUrl: '',
        firewall: [] as [string, unknown][],
        realGenCertificate: null as null | ((...args: any[]) => Promise<any>),
        genCertificate: null as null | ((...args: any[]) => Promise<any>),
    };
    // A webContents that records what it is sent and fires what it is told.
    function makeContents(id: number, url = '') {
        const handlers = new Map<string, (() => void)[]>();
        const contents = {
            id,
            url,
            sent: [] as [string, any][],
            windowOpenHandler: null as null | (() => unknown),
            getURL: () => contents.url,
            send: (channel: string, data?: any) => {
                contents.sent.push([channel, data]);
            },
            isLoading: () => false,
            isDestroyed: () => false,
            once: (name: string, handler: () => void) => {
                handlers.set(name, [...(handlers.get(name) ?? []), handler]);
            },
            fire: (name: string) => {
                const list = handlers.get(name) ?? [];
                handlers.delete(name);
                list.forEach((handler) => handler());
            },
            setWindowOpenHandler: (handler: () => unknown) => {
                contents.windowOpenHandler = handler;
            },
        };
        return contents;
    }
    return { fixture, makeContents };
});

vi.mock('electron', () => {
    // The camera broker: never a real window.
    class FakeBrowserWindow {
        static getAllWindows() {
            return fixture.windows;
        }
        options: unknown;
        destroyed = false;
        webContents: ReturnType<typeof makeContents>;
        constructor(options: unknown) {
            this.options = options;
            this.webContents = makeContents(9000 + fixture.brokers.length);
            fixture.brokers.push(this);
        }
        loadURL(url: string) {
            this.webContents.url = url;
        }
        isDestroyed() {
            return this.destroyed;
        }
        destroy() {
            this.destroyed = true;
        }
    }
    return {
        app: {
            once: () => {},
            getAppPath: () => fixture.appPath,
            getPath: () => fixture.userDataPath,
        },
        powerSaveBlocker: { start: () => 1, stop: () => {} },
        screen: {
            on: (name: string, handler: () => void) => {
                fixture.screenHandlers.set(name, [
                    ...(fixture.screenHandlers.get(name) ?? []),
                    handler,
                ]);
            },
            getAllDisplays: () => fixture.displays,
            getPrimaryDisplay: () => ({ id: 1 }),
        },
        BrowserWindow: FakeBrowserWindow,
        ipcMain: {
            on: (name: string, handler: (...args: any[]) => void) => {
                fixture.ipc.set(name, [
                    ...(fixture.ipc.get(name) ?? []),
                    handler,
                ]);
            },
        },
        net: {
            fetch: (url: string, init: unknown) => {
                fixture.netFetches.push([url, init]);
                return Promise.resolve('fetched');
            },
        },
        systemPreferences: {
            askForMediaAccess: async () => fixture.mediaAccess,
        },
    };
});
vi.mock('ws', async (importOriginal) => {
    const original = await importOriginal<typeof WsModule>();
    const Base = (original as unknown as { default: typeof WebSocket }).default;
    // A development screen's hot-reload socket dials Vite on localhost:3000;
    // here it reaches this file's stand-in on a free loopback port.
    class LoopbackWebSocket extends Base {
        constructor(address: any, protocols?: any, options?: any) {
            const vite = 'wss://localhost:3000';
            super(
                typeof address === 'string' && address.startsWith(vite)
                    ? (fixture.viteUrl || 'ws://127.0.0.1:1') +
                          address.slice(vite.length)
                    : address,
                protocols,
                options,
            );
        }
    }
    return {
        ...original,
        default: LoopbackWebSocket,
        WebSocket: LoopbackWebSocket,
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
vi.mock('./mirrorTls', async (importOriginal) => {
    const original = await importOriginal<typeof TlsModule>();
    fixture.realGenCertificate = original.genMirrorTlsCertificate;
    return {
        ...original,
        genMirrorTlsCertificate: (...args: [string[]]) =>
            (fixture.genCertificate ?? original.genMirrorTlsCertificate)(
                ...args,
            ),
    };
});
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
        getInstance: (screenId: number) =>
            fixture.screenOutputs.get(screenId) ?? null,
        // A host's screen on this computer: a window that only records.
        createDetached: (screenId: number) => {
            const closed: (() => void)[] = [];
            const controller = {
                screenId,
                win: {
                    webContents: { id: 1000 + fixture.controllers.length },
                    once: (_: string, callback: () => void) =>
                        closed.push(callback),
                    isDestroyed: () => false,
                    setAlwaysOnTop: () => {},
                    moveTop: () => {},
                    focus: () => {},
                },
                setDisplay: () => {},
                listenLoading: async () => {},
                sendData: () => {},
                sendMessage: () => {},
                close: () => closed.forEach((callback) => callback()),
            };
            fixture.controllers.push(controller);
            return controller;
        },
    },
}));
vi.mock('./protocolHelpers', () => ({
    getRootUrl: () =>
        fixture.isDev ? 'https://localhost:3000' : 'owa://local',
}));
vi.mock('./electronHelpers', () => ({
    get isDev() {
        return fixture.isDev;
    },
    messageChannels: { screenMessage: 'screen-message' },
}));
vi.mock('./firewallHelpers', () => ({
    checkNetworkFirewall: async (options: unknown) => {
        fixture.firewall.push(['check', options]);
        return { verdict: 'open' };
    },
    openFirewallSettings: async (target: unknown) => {
        fixture.firewall.push(['open', target]);
        return true;
    },
}));
vi.mock('./extraBinPaths', async () => {
    const { join } = await import('node:path');
    return {
        // Never a file: the tunnel finds no cloudflared and starts nothing.
        getCloudflaredBinPath: (directory: string) => {
            fixture.binDirs.push(directory);
            return join(directory, 'no-cloudflared-here');
        },
    };
});

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
    type RouterMapping,
} from './screenMirrorRouter';
import { MirrorTunnel } from './screenMirrorTunnel';
import { screenMirrorRuntime } from './screenMirrorRuntime';
import {
    MIRROR_MAX_MESSAGE,
    MIRROR_REMOTE_DISPLAY_FIRST,
} from './screenMirrorProtocol';
import {
    VIRTUAL_DISPLAY_HTTPS_KEY,
    VIRTUAL_DISPLAY_SHARE_KEY,
} from './virtualDisplayProtocol';
import appInfo from '../package.json';

const HOST = { 'screen-mirror-host': 'true' };
const INTERNET = { 'screen-mirror-internet': 'true' };
const display = {
    id: 15,
    label: 'HDMI',
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    scaleFactor: 1,
    isPrimary: true,
};
const display2 = { ...display, id: 16, label: 'Side', isPrimary: false };
const gateway = {
    controlUrl: 'http://192.168.1.1:5000/ctl',
    serviceType: 'urn:schemas-upnp-org:service:WANIPConnection:1',
    localAddress: '192.168.1.3',
};

class FakeUdpSocket extends EventEmitter {
    sent: [string, number, string][] = [];
    bound: number[] = [];
    closed = 0;
    isBroadcast = false;
    bind(port: number, callback?: () => void) {
        this.bound.push(port);
        if (callback) queueMicrotask(callback);
        return this;
    }
    send(message: unknown, port: number, address: string, done?: () => void) {
        this.sent.push([String(message), port, address]);
        done?.();
    }
    setBroadcast(isBroadcast: boolean) {
        this.isBroadcast = isBroadcast;
    }
    close() {
        this.closed++;
    }
}

let directory = '';
const services: ScreenMirrorService[] = [];
const clients: WebSocket[] = [];
const servers: net.Server[] = [];
const socketServers: WebSocketServer[] = [];
let udpSockets: FakeUdpSocket[] = [];
let listenCalls: { port: unknown; host: string }[] = [];
let listenFailures: { host?: string; code: string }[] = [];

function ipc(name: string) {
    return (...args: any[]) => {
        for (const handler of fixture.ipc.get(name) ?? []) handler(...args);
    };
}

async function until(check: () => unknown, milliseconds = 3000) {
    const start = performance.now();
    while (!check()) {
        if (performance.now() - start > milliseconds) {
            throw new Error('Timed out waiting');
        }
        await new Promise((resolve) => setImmediate(resolve));
    }
}

function listenOnLoopback(server: net.Server) {
    return new Promise<number>((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            resolve((server.address() as net.AddressInfo).port);
        });
    });
}

async function freePort() {
    const probe = net.createServer();
    const port = await listenOnLoopback(probe);
    await new Promise<void>((resolve) => probe.close(() => resolve()));
    return port;
}

beforeEach(async () => {
    fixture.client.clear();
    fixture.secure.clear();
    fixture.ipc.clear();
    fixture.screenHandlers.clear();
    fixture.screenOutputs.clear();
    fixture.displays = [];
    fixture.windows = [];
    fixture.brokers = [];
    fixture.controllers = [];
    fixture.binDirs = [];
    fixture.netFetches = [];
    fixture.firewall = [];
    fixture.isDev = false;
    fixture.mediaAccess = true;
    fixture.viteUrl = '';
    fixture.genCertificate = null;
    directory = await mkdtemp(path.join(os.tmpdir(), 'owa-'));
    fixture.appPath = path.join(directory, 'app');
    fixture.userDataPath = path.join(directory, 'profile');
    vi.mocked(findRouterGateway).mockResolvedValue(null);
    vi.mocked(getRouterExternalAddress).mockResolvedValue('');
    vi.mocked(lookUpPublicAddress).mockResolvedValue('');
    vi.mocked(probeRouterPort).mockResolvedValue('unknown');
    vi.mocked(renewRouterPort).mockResolvedValue(undefined as never);
    vi.mocked(closeRouterPort).mockResolvedValue(undefined);
    // A port of its own, so no test walks Screen Mirror's fixed range.
    fixture.client.set('screen-mirror-port', String(await freePort()));
    udpSockets = [];
    vi.spyOn(dgram, 'createSocket').mockImplementation((() => {
        const socket = new FakeUdpSocket();
        udpSockets.push(socket);
        return socket;
    }) as any);
    listenCalls = [];
    listenFailures = [];
    // Every bind of the server lands on loopback, whatever it asked for; a
    // failure set up by a test answers instead of the bind.
    const realListen = net.Server.prototype.listen;
    vi.spyOn(net.Server.prototype, 'listen').mockImplementation(function (
        this: net.Server,
        ...args: any[]
    ) {
        if (typeof args[1] === 'string') {
            listenCalls.push({ port: args[0], host: args[1] });
            const index = listenFailures.findIndex((failure) => {
                return failure.host === undefined || failure.host === args[1];
            });
            if (index >= 0) {
                const [failure] = listenFailures.splice(index, 1);
                process.nextTick(() => {
                    this.emit(
                        'error',
                        Object.assign(new Error(failure.code), {
                            code: failure.code,
                        }),
                    );
                });
                return this;
            }
            args[1] = '127.0.0.1';
        }
        return realListen.apply(this, args as any);
    } as any);
});

afterEach(async () => {
    vi.useRealTimers();
    for (const client of clients.splice(0)) client.terminate();
    for (const service of services.splice(0)) service.stop();
    for (const wss of socketServers.splice(0)) {
        for (const client of wss.clients) client.terminate();
        wss.close();
    }
    for (const server of servers.splice(0)) {
        (server as http.Server).closeAllConnections?.();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    vi.restoreAllMocks();
    await rm(directory, { recursive: true, force: true });
});

async function startService(settings: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(settings)) {
        fixture.client.set(key, value);
    }
    const service = new ScreenMirrorService();
    services.push(service);
    await service.start();
    return service;
}

async function openClient(url: string, options: WebSocket.ClientOptions = {}) {
    const socket = new WebSocket(url, options);
    clients.push(socket);
    const packets: any[] = [];
    socket.on('message', (data, isBinary) => {
        if (!isBinary) packets.push(JSON.parse(data.toString()));
    });
    socket.on('error', () => {});
    const closed = new Promise<{ code: number; reason: string }>((resolve) => {
        socket.once('close', (code, reason) => {
            resolve({ code, reason: reason.toString() });
        });
    });
    await once(socket, 'open');
    const send = (type: string, data: Record<string, any> = {}) => {
        socket.send(JSON.stringify({ protocol: 1, type, ...data }));
    };
    return { socket, packets, send, closed };
}

async function openGuest(
    url: string,
    hello: Record<string, any> = {},
    options: WebSocket.ClientOptions = {},
) {
    const client = await openClient(url, options);
    const id = typeof hello.id === 'string' ? hello.id : randomUUID();
    client.send('hello', {
        name: 'Test guest',
        version: appInfo.version,
        ...hello,
        id,
    });
    return { id, ...client };
}

function guest(
    service: ScreenMirrorService,
    hello: Record<string, any> = {},
    options: WebSocket.ClientOptions = {},
) {
    return openGuest(`ws://127.0.0.1:${service.port}/mirror`, hello, options);
}

async function approvedGuest(service: ScreenMirrorService, displays: any[]) {
    const client = await guest(service);
    await until(() => {
        return service.state().pending.some((item) => item.id === client.id);
    });
    service.approve(client.id);
    client.send('inventory', { displays, cameras: [] });
    await until(() => {
        return (
            service.displays().filter((item) => {
                return item.guestId === client.id;
            }).length === displays.length
        );
    });
    return client;
}

// The presenter: it answers every screen's bootstrap at once.
function answerBootstraps(service: ScreenMirrorService) {
    const main = new EventEmitter() as any;
    main.sent = [] as [string, any][];
    main.isDestroyed = () => false;
    main.getURL = () => 'owa://local/presenter.html';
    main.send = (channel: string, data: any) => {
        main.sent.push([channel, data]);
        if (channel === 'mirror:bootstrap-request') {
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
        }
    };
    service.configure(main);
    return main as { sent: [string, any][] };
}

function recordingMain() {
    const main = {
        sent: [] as [string, any][],
        isDestroyed: () => false,
        send: (channel: string, data?: any) => {
            main.sent.push([channel, data]);
        },
    };
    return main;
}

function mockHttpRequest(url: string, method: string, remoteAddress: string) {
    return {
        method,
        url,
        headers: { host: '127.0.0.1' },
        socket: { remoteAddress },
    } as any;
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
        for (const [name, value] of Object.entries(headers)) {
            response.headers[name.toLowerCase()] = value;
        }
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
        if (chunk !== undefined && chunk !== null) response.write(chunk);
        response.writableEnded = true;
        return response;
    };
    response.destroy = () => response.emit('close');
    return response;
}

async function handleHttp(
    service: ScreenMirrorService,
    pathname: string,
    remoteAddress: string,
) {
    const req = mockHttpRequest(pathname, 'GET', remoteAddress);
    const res = mockHttpResponse();
    await (service as any).handleHttp(req, res);
    await until(() => res.writableEnded);
    return res;
}

describe('the port', () => {
    test('a computer without IPv6 listens on IPv4 instead', async () => {
        listenFailures.push({ host: '::', code: 'EAFNOSUPPORT' });

        const service = await startService(HOST);

        expect(service.error).toBeNull();
        expect(listenCalls.map((call) => call.host)).toEqual(['::', '0.0.0.0']);
        const response = await fetch(`${service.baseUrl}/discovery`);
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ id: service.id });
    });

    test('a port this computer may not use is reported, never walked past', async () => {
        listenFailures.push({ code: 'EACCES' });

        const service = await startService();

        expect(service.error).toBe('Unable to start screen mirror server');
        expect(service.port).toBe(0);
        expect(listenCalls).toHaveLength(1);
        await expect(service.prepareOutput(0, 5)).rejects.toThrow(
            'Screen mirror server is unavailable',
        );
    });

    test('a port lost while listening is reported to the presenter', async () => {
        const service = await startService();
        const main = recordingMain();
        service.configure(main as any);

        (service as any).server.emit('error', new Error('EPIPE'));

        expect(service.error).toBe('Unable to start screen mirror server');
        expect(service.state().error).toBe(
            'Unable to start screen mirror server',
        );
        expect(main.sent).toContainEqual(['mirror:devices-changed', undefined]);
    });

    test('hosting turned on listens again on the same port, the old connections ended', async () => {
        const service = await startService();
        const port = service.port;
        expect(listenCalls).toEqual([{ port, host: '127.0.0.1' }]);
        expect(udpSockets).toEqual([]);
        const held = net.connect({ host: '127.0.0.1', port });
        await once(held, 'connect');
        const heldClosed = once(held, 'close');

        await service.setHostEnabled(true);

        await heldClosed;
        expect(service.port).toBe(port);
        expect(listenCalls.at(-1)).toEqual({ port, host: '::' });
        // Found by a scan once it is listening again.
        expect(udpSockets).toHaveLength(1);
        expect(udpSockets[0].bound).toEqual([port]);
        expect((await fetch(`${service.baseUrl}/discovery`)).status).toBe(200);
    });

    test('display sharing switched off for good releases the router mapping', async () => {
        const mapping = {
            ...gateway,
            externalAddress: '203.0.113.10',
            externalPort: 40001,
            internalPort: 0,
            leaseSeconds: 3600,
        };
        vi.mocked(findRouterGateway).mockResolvedValue(gateway);
        vi.mocked(getRouterExternalAddress).mockResolvedValue('203.0.113.10');
        vi.mocked(openRouterPort).mockResolvedValue(mapping);
        const service = await startService({
            ...INTERNET,
            [VIRTUAL_DISPLAY_SHARE_KEY]: 'true',
        });
        await until(() => service.routerState === 'open');

        await service.setVirtualDisplayShareEnabled(false);

        expect(service.routerState).toBe('off');
        expect(closeRouterPort).toHaveBeenCalledWith(mapping);
        expect(fixture.client.get('screen-mirror-router-mapping')).toBe('');
        expect(listenCalls.at(-1)?.host).toBe('127.0.0.1');
    });

    test('the presenter hears when this computer’s displays change', async () => {
        const service = await startService();
        const main = recordingMain();
        service.configure(main as any);
        expect(service.state().displayRevision).toBe(0);

        for (const name of [
            'display-added',
            'display-removed',
            'display-metrics-changed',
        ]) {
            for (const handler of fixture.screenHandlers.get(name) ?? []) {
                handler();
            }
        }

        expect(service.state().displayRevision).toBe(3);
        expect(
            main.sent.filter(([channel]) => {
                return channel === 'mirror:devices-changed';
            }),
        ).toHaveLength(3);
    });

    test('screen windows load from the server, with their output’s context', async () => {
        const service = await startService();

        expect(screenMirrorRuntime.screenUrl?.(2)).toBe(
            `${service.baseUrl}/screen.html?screenId=2`,
        );
        expect(screenMirrorRuntime.context?.(2)).toBeUndefined();
        answerBootstraps(service);
        await service.prepareOutput(2, 5);
        expect(screenMirrorRuntime.context?.(2)).toMatchObject({
            screenId: 2,
            remote: false,
        });
    });

    test('a saved guest list that cannot be read starts a fresh one', async () => {
        fixture.client.set('screen-mirror-guests', '{not json');
        const service = await startService(HOST);
        const client = await guest(service);
        await until(() => service.state().pending.length === 1);

        service.approve(client.id);

        await until(() => client.packets.some((p) => p.type === 'approved'));
        expect(client.packets.find((p) => p.type === 'approved').prefix).toBe(
            'a1',
        );
        expect(JSON.parse(fixture.client.get('screen-mirror-guests')!)).toEqual(
            { [client.id]: { prefix: 'a1', displays: {} } },
        );
    });

    test('the app’s own start makes the one service', async () => {
        await initScreenMirror();
        const started = getScreenMirror()!;
        services.push(started);

        expect(started).toBeInstanceOf(ScreenMirrorService);
        expect(started.port).toBeGreaterThan(0);
        expect(started.error).toBeNull();
    });
});

describe('who is trusted, and what they are told', () => {
    test('a window whose address cannot be read is not trusted', async () => {
        const service = await startService();

        expect(service.trusted({ getURL: () => 'not a url' } as any)).toBe(
            false,
        );
        expect(
            service.trusted({
                getURL: () => {
                    throw new Error('Object has been destroyed');
                },
            } as any),
        ).toBe(false);
    });

    test('a broadcast reaches the app’s own live windows only', async () => {
        const service = await startService();
        const presenter = {
            isDestroyed: () => false,
            webContents: makeContents(1, 'owa://local/presenter.html'),
        };
        const gone = {
            isDestroyed: () => true,
            webContents: makeContents(2, 'owa://local/setting.html'),
        };
        const stranger = {
            isDestroyed: () => false,
            webContents: makeContents(3, 'https://example.com/page.html'),
        };
        fixture.windows = [presenter, gone, stranger];

        service.broadcast('mirror:test', { isOk: true });

        expect(presenter.webContents.sent).toEqual([
            ['mirror:test', { isOk: true }],
        ]);
        expect(gone.webContents.sent).toEqual([]);
        expect(stranger.webContents.sent).toEqual([]);
    });

    test('the readers a window asks answer the app’s own windows only', async () => {
        const service = await startService();
        const own = makeContents(7, 'owa://local/presenter.html');
        const stranger = makeContents(8, 'https://example.com/x.html');
        const ask = (name: string, sender: unknown, data?: unknown) => {
            const event: any = { sender };
            ipc(name)(event, data);
            return event.returnValue;
        };
        answerBootstraps(service);
        await service.prepareOutput(1, 5);
        const file = path.join(directory, 'slide.png');
        await writeFile(file, 'png bytes');

        expect(ask('mirror:state', own)).toMatchObject({
            id: service.id,
            port: service.port,
        });
        expect(ask('mirror:state', stranger)).toBeNull();
        expect(ask('mirror:screen-context', own, 1)).toMatchObject({
            screenId: 1,
        });
        expect(ask('mirror:screen-context', own, 9)).toBeNull();
        expect(ask('mirror:screen-context', stranger, 1)).toBeNull();
        const url = ask('mirror:resource', own, {
            screenId: 1,
            filePath: file,
        });
        expect(url.startsWith(`${service.baseUrl}/content/`)).toBe(true);
        expect(await (await fetch(url)).text()).toBe('png bytes');
        expect(ask('mirror:resource', own, { screenId: 1, filePath: 7 })).toBe(
            '',
        );
        expect(
            ask('mirror:resource', stranger, { screenId: 1, filePath: file }),
        ).toBe('');
    });

    test('this computer’s cameras reach approved guests under its own id', async () => {
        const service = await startService(HOST);
        const own = makeContents(7, 'owa://local/presenter.html');
        const stranger = makeContents(8, 'https://example.com/x.html');
        const client = await guest(service);
        await until(() => service.state().pending.length === 1);
        service.approve(client.id);
        await until(() => client.packets.some((p) => p.type === 'cameras'));
        const front = { deviceId: 'cam-1', label: 'Front' };
        const side = { deviceId: 'cam-2', label: 'Side' };

        ipc('mirror:physical-cameras')({ sender: stranger }, [front]);
        ipc('mirror:physical-cameras')({ sender: own }, [front]);
        // The same list again sends nothing.
        ipc('mirror:physical-cameras')({ sender: own }, [front]);
        ipc('mirror:physical-cameras')({ sender: own }, [front, side]);

        const named = (camera: { deviceId: string; label: string }) => ({
            deviceId: `mirror-camera:${service.id}:${camera.deviceId}`,
            label: camera.label,
            groupId: '',
        });
        await until(() => {
            return (
                client.packets.filter((p) => p.type === 'cameras').length > 2
            );
        });
        expect(
            client.packets
                .filter((p) => p.type === 'cameras')
                .map((p) => p.cameras),
        ).toEqual([[], [named(front)], [named(front), named(side)]]);
    });
});

describe('a guest connection to this host', () => {
    const url = (service: ScreenMirrorService) => {
        return `ws://127.0.0.1:${service.port}/mirror`;
    };

    test('a guest that never says hello is let go after ten seconds', async () => {
        const service = await startService(HOST);
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const client = await openClient(url(service));

        await vi.advanceTimersByTimeAsync(9999);
        expect(client.socket.readyState).toBe(WebSocket.OPEN);
        await vi.advanceTimersByTimeAsync(1);

        expect(await client.closed).toEqual({
            code: 1008,
            reason: 'Hello required',
        });
    });

    test('a binary frame, or text that is no packet, closes the connection', async () => {
        const service = await startService(HOST);
        const binary = await openClient(url(service));
        const garbled = await openClient(url(service));
        const otherProtocol = await openClient(url(service));

        binary.socket.send(Buffer.from([1, 2, 3]), { binary: true });
        garbled.socket.send('not json');
        otherProtocol.socket.send(
            JSON.stringify({ protocol: 99, type: 'hello' }),
        );

        expect((await binary.closed).code).toBe(1008);
        expect((await garbled.closed).code).toBe(1008);
        expect((await otherProtocol.closed).code).toBe(1008);
        expect(service.state().pending).toEqual([]);
    });

    test('a hello from another version, or in this host’s own name, is refused', async () => {
        const service = await startService(HOST);
        const refusal = {
            protocol: 1,
            type: 'error',
            error: 'Incompatible or duplicate connection',
        };

        const older = await guest(service, { version: '0.0.1' });
        const itself = await guest(service, { id: service.id });

        expect((await older.closed).code).toBe(1008);
        expect(older.packets).toEqual([refusal]);
        expect((await itself.closed).code).toBe(1008);
        expect(itself.packets).toEqual([refusal]);
        expect(service.state().pending).toEqual([]);
    });

    test('a guest that stops answering pings is let go; one that answers stays', async () => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
        const service = await startService(HOST);
        const lively = await guest(service);
        const silent = await guest(service, {}, { autoPong: false });
        await until(() => service.state().pending.length === 2);
        const livelyPinged = once(lively.socket, 'ping');
        const silentPinged = once(silent.socket, 'ping');

        await vi.advanceTimersByTimeAsync(5000);
        await livelyPinged;
        await silentPinged;
        // Its pong went out before this ping's answer came back.
        await new Promise((resolve) => {
            lively.socket.once('pong', resolve);
            lively.socket.ping();
        });
        await vi.advanceTimersByTimeAsync(5000);

        expect((await silent.closed).code).toBe(1006);
        expect(lively.socket.readyState).toBe(WebSocket.OPEN);
        await until(() => service.state().pending.length === 1);
        expect(service.state().pending[0].id).toBe(lively.id);
    });

    test('a message too big for a guest is not sent; the guest is told to resynchronize', async () => {
        const service = await startService(HOST);
        const client = await approvedGuest(service, [display]);
        answerBootstraps(service);
        await service.prepareOutput(0, service.displays()[0].id);
        await until(() => client.packets.some((p) => p.type === 'show'));

        expect(
            service.sendScreenMessage({
                screenId: 0,
                type: 'slide',
                data: { html: 'x'.repeat(MIRROR_MAX_MESSAGE) },
            } as any),
        ).toBe(true);

        expect(await client.closed).toEqual({
            code: 1013,
            reason: 'Resynchronize',
        });
        expect(client.packets.some((p) => p.type === 'screen')).toBe(false);
    });

    test('a guest’s display that went away takes down the screen on it, not the others', async () => {
        const service = await startService(HOST);
        const client = await approvedGuest(service, [display, display2]);
        const main = answerBootstraps(service);
        const [first, second] = service.displays();
        await service.prepareOutput(0, first.id);
        await service.prepareOutput(1, second.id);
        await until(() => {
            return client.packets.filter((p) => p.type === 'show').length === 2;
        });

        // The same inventory again changes nothing.
        client.send('inventory', {
            displays: [display, display2],
            cameras: [],
        });
        client.send('inventory', { displays: [display2], cameras: [] });

        await until(() => client.packets.some((p) => p.type === 'hide'));
        expect(client.packets.filter((p) => p.type === 'hide')).toEqual([
            { protocol: 1, type: 'hide', screenId: 0 },
        ]);
        expect(service.showingIds()).toEqual([1]);
        expect(main.sent).toContainEqual([
            'screen-message',
            { screenId: 0, type: 'visible', data: { isShowing: false } },
        ]);
    });

    test('a guest’s screen names this host’s cameras under the host', async () => {
        const service = await startService(HOST);
        const client = await approvedGuest(service, [display]);
        answerBootstraps(service);
        await service.prepareOutput(0, service.displays()[0].id);

        service.sendScreenMessage({
            screenId: 0,
            type: 'background',
            stage: 3,
            data: { type: 'camera', src: 'cam-1', deviceId: 'cam-1' },
        } as any);
        service.sendScreenMessage({
            screenId: 0,
            type: 'foreground',
            data: {
                cameraDataList: [
                    { id: 'cam-2', label: 'Pulpit' },
                    { id: 'mirror-camera:other-host:cam-3', label: 'Far' },
                ],
            },
        } as any);

        await until(() => {
            return (
                client.packets.filter((p) => p.type === 'screen').length === 2
            );
        });
        const screens = client.packets.filter((p) => p.type === 'screen');
        // The stage it was given stays with the output.
        expect(screens.map((p) => p.stage)).toEqual([3, 3]);
        const [background, foreground] = screens.map((p) => p.message.data);
        expect(background).toEqual({
            type: 'camera',
            src: `mirror-camera:${service.id}:cam-1`,
            deviceId: `mirror-camera:${service.id}:cam-1`,
        });
        expect(foreground.cameraDataList).toEqual([
            { id: `mirror-camera:${service.id}:cam-2`, label: 'Pulpit' },
            { id: 'mirror-camera:other-host:cam-3', label: 'Far' },
        ]);
    });

    test('a WebSocket upgrade that fails part way is dropped, and its slot given back', async () => {
        const service = await startService(HOST);
        vi.spyOn((service as any).wss, 'handleUpgrade').mockImplementation(
            () => {
                throw new Error('bad upgrade');
            },
        );
        const socket = new WebSocket(url(service));
        clients.push(socket);

        const [error] = await once(socket, 'error');

        expect(error).toBeInstanceOf(Error);
        await until(() => (service as any).peerSockets.size === 0);
    });

    test('a scan from this computer’s own networks is answered, and a socket error closes it', async () => {
        const service = await startService(HOST);
        const udp = udpSockets[0];
        expect(udp.bound).toEqual([service.port]);
        const ask = Buffer.from('owa-screen-mirror-discover-v1');

        udp.emit('message', ask, { address: '192.168.1.9', port: 5555 });
        // From the internet while it is closed, something else, or too long.
        udp.emit('message', ask, { address: '8.8.8.8', port: 5556 });
        udp.emit('message', Buffer.from('hello'), {
            address: '192.168.1.9',
            port: 5557,
        });
        udp.emit('message', Buffer.alloc(200, 'a'), {
            address: '192.168.1.9',
            port: 5558,
        });

        expect(udp.sent).toEqual([
            [JSON.stringify(service.discovery()), 5555, '192.168.1.9'],
        ]);
        udp.close = () => {
            throw new Error('Not running');
        };
        udp.emit('error', new Error('EADDRINUSE'));
        expect((service as any).udp).toBeUndefined();
        await service.setHostEnabled(false);
        await service.setHostEnabled(true);
        expect(udpSockets).toHaveLength(2);
    });

    test('an IPv6 guest in this computer’s own /64 is local; its card is offered on the internet', async () => {
        vi.spyOn(os, 'networkInterfaces').mockReturnValue({
            Ethernet: [
                {
                    address: '192.168.1.20',
                    netmask: '255.255.255.0',
                    family: 'IPv4',
                    mac: '00:00:00:00:00:01',
                    internal: false,
                    cidr: '192.168.1.20/24',
                },
                {
                    address: '2a01:4f8:1c0c:8::20',
                    netmask: 'ffff:ffff:ffff:ffff::',
                    family: 'IPv6',
                    mac: '00:00:00:00:00:01',
                    internal: false,
                    cidr: '2a01:4f8:1c0c:8::20/64',
                    scopeid: 0,
                },
            ],
        } as any);
        const service = await startService(HOST);

        const sameBlock = await handleHttp(
            service,
            '/discovery',
            '2a01:4f8:1c0c:8::99',
        );
        const otherBlock = await handleHttp(
            service,
            '/discovery',
            '2a01:4f8:1c0c:9::99',
        );

        expect(sameBlock.statusCode).toBe(200);
        expect(otherBlock.statusCode).toBe(404);
        expect(service.state().addresses).toEqual([
            { host: '192.168.1.20', port: service.port, kind: 'lan' },
        ]);
        await service.setInternetEnabled(true);
        expect(service.state().addresses).toContainEqual({
            host: '2a01:4f8:1c0c:8::20',
            port: service.port,
            kind: 'internet',
        });
    });
});

describe('guests through the tunnel', () => {
    async function startTunnelHost() {
        const started: number[] = [];
        vi.spyOn(MirrorTunnel.prototype, 'start').mockImplementation(
            (port: number) => {
                started.push(port);
            },
        );
        const service = await startService({
            ...HOST,
            ...INTERNET,
            'screen-mirror-tunnel': 'true',
        });
        await until(() => started.length === 1);
        const fromInternet = (address: string) => {
            return openGuest(
                `ws://127.0.0.1:${started[0]}/mirror`,
                {},
                { headers: { 'cf-connecting-ip': address } },
            );
        };
        return { service, fromInternet };
    }

    test('requests waiting for approval are capped, per sender and in all', async () => {
        const { service, fromInternet } = await startTunnelHost();
        const tooMany = {
            protocol: 1,
            type: 'error',
            error: 'Too many connection requests. Try again later.',
        };
        for (let index = 0; index < 4; index++) {
            await fromInternet('198.51.100.8');
        }
        await until(() => service.state().pending.length === 4);

        const fifth = await fromInternet('198.51.100.8');
        expect((await fifth.closed).code).toBe(1008);
        expect(fifth.packets).toEqual([tooMany]);

        for (let index = 0; index < 4; index++) {
            await fromInternet('203.0.113.4');
        }
        await until(() => service.state().pending.length === 8);
        const ninth = await fromInternet('192.0.2.7');
        expect((await ninth.closed).code).toBe(1008);
        expect(ninth.packets).toEqual([tooMany]);
        await until(() => service.state().pending.length === 8);
        expect(
            service.state().pending.every((item) => {
                return item.network === 'internet';
            }),
        ).toBe(true);
    });

    test('closing the internet ends the guests that came from it; the room’s stay', async () => {
        const { service, fromInternet } = await startTunnelHost();
        const local = await guest(service);
        const remote = await fromInternet('198.51.100.9');
        await until(() => service.state().pending.length === 2);
        service.approve(remote.id);
        await until(() => remote.packets.some((p) => p.type === 'approved'));
        const { resume } = remote.packets.find((p) => p.type === 'approved');

        await service.setInternetEnabled(false);

        await remote.closed;
        expect(local.socket.readyState).toBe(WebSocket.OPEN);
        await until(() => {
            return !service.state().guests.some((g) => g.id === remote.id);
        });
        // Its resume went with it: back again, it waits to be let in.
        const again = await guest(service, { id: remote.id, resume });
        await until(() => {
            return service.state().pending.some((item) => item.id === again.id);
        });
        expect(again.packets.some((p) => p.type === 'approved')).toBe(false);
    });
});

describe('the tunnel and HTTPS', () => {
    test('cloudflared is looked for in the chosen data folder, else the profile', async () => {
        const chosen = path.join(directory, 'chosen');
        await mkdir(chosen);
        const service = await startService({
            ...HOST,
            ...INTERNET,
            'selected-parent-dir': chosen,
        });
        const main = recordingMain();
        service.configure(main as any);

        service.setTunnelEnabled(true);

        await until(() => service.tunnelState.status === 'error');
        expect(service.tunnelState).toMatchObject({ error: 'missing' });
        expect(fixture.binDirs).toEqual([chosen]);
        expect(main.sent).toContainEqual(['mirror:devices-changed', undefined]);
        // A chosen folder that is gone: the profile's own.
        fixture.client.set('selected-parent-dir', path.join(directory, 'gone'));
        service.retryTunnel();
        await until(() => fixture.binDirs.length === 2);
        expect(fixture.binDirs[1]).toBe(fixture.userDataPath);
        // Its own requests go through Electron's network stack.
        await expect(
            (service as any).tunnel.options.fetch('https://x.example/', {
                method: 'HEAD',
            }),
        ).resolves.toBe('fetched');
        expect(fixture.netFetches).toEqual([
            ['https://x.example/', { method: 'HEAD' }],
        ]);
    });

    test('a tunnel turned off while its door opens leaves no door', async () => {
        const started: number[] = [];
        vi.spyOn(MirrorTunnel.prototype, 'start').mockImplementation(
            (port: number) => {
                started.push(port);
            },
        );
        const service = await startService({ ...HOST, ...INTERNET });
        const created = vi.spyOn(http, 'createServer');

        service.setTunnelEnabled(true);
        service.setTunnelEnabled(false);

        expect(created).toHaveBeenCalledOnce();
        const door = created.mock.results[0].value as http.Server;
        await once(door, 'close');
        expect(door.listening).toBe(false);
        expect(started).toEqual([]);
        expect((service as any).tunnelServer).toBeUndefined();
    });

    test('a door that cannot be opened is not carried, and the next try opens one', async () => {
        const started: number[] = [];
        vi.spyOn(MirrorTunnel.prototype, 'start').mockImplementation(
            (port: number) => {
                started.push(port);
            },
        );
        const service = await startService({ ...HOST, ...INTERNET });
        listenFailures.push({ host: '127.0.0.1', code: 'EACCES' });

        service.setTunnelEnabled(true);

        await until(() => (service as any).tunnelServer === undefined);
        expect(started).toEqual([]);
        service.setTunnelEnabled(false);
        service.setTunnelEnabled(true);
        await until(() => started.length === 1);
        expect(started[0]).not.toBe(service.port);
    });

    test('HTTPS that cannot get a certificate is turned back off', async () => {
        fixture.genCertificate = async () => {
            throw new Error('no key');
        };
        const service = await startService();
        const main = recordingMain();
        service.configure(main as any);

        await expect(service.setHttpsEnabled(true)).rejects.toThrow(
            'Unable to turn on HTTPS',
        );

        expect(fixture.client.get(VIRTUAL_DISPLAY_HTTPS_KEY)).toBe('');
        expect(service.isHttpsEnabled).toBe(false);
        expect(main.sent).toContainEqual(['mirror:devices-changed', undefined]);
        expect((service as any).secureServer).toBeUndefined();
    });

    test('a guest connects over TLS on the same port', async () => {
        fixture.secure.set(
            'virtual-display-tls',
            JSON.stringify(await fixture.realGenCertificate!(['127.0.0.1'])),
        );
        const service = await startService(HOST);
        await service.setHttpsEnabled(true);

        const client = await openGuest(
            `wss://127.0.0.1:${service.port}/mirror`,
            {},
            { rejectUnauthorized: false },
        );

        await until(() => service.state().pending.length === 1);
        expect(service.state().pending[0].id).toBe(client.id);
    });
});

describe('putting a screen out', () => {
    test('without a presenter, or for a guest display that is gone, nothing is put up', async () => {
        const service = await startService();

        await expect(service.prepareOutput(0, 5)).rejects.toThrow(
            'Presenter is unavailable',
        );
        expect(service.showingIds()).toEqual([]);
        await expect(
            service.prepareOutput(0, MIRROR_REMOTE_DISPLAY_FIRST),
        ).rejects.toThrow('Guest display is disconnected');
        expect(service.showingIds()).toEqual([]);
    });

    test('a presenter that never answers times out after ten seconds, and the screen comes down', async () => {
        const service = await startService();
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const main = recordingMain();
        service.configure(main as any);

        const showing = service.prepareOutput(3, 5);
        const failed = expect(showing).rejects.toThrow(
            'Screen initialization timed out',
        );
        expect(service.showingIds()).toEqual([3]);
        await vi.advanceTimersByTimeAsync(10_000);
        await failed;

        expect(service.showingIds()).toEqual([]);
        expect(main.sent).toContainEqual([
            'screen-message',
            { screenId: 3, type: 'visible', data: { isShowing: false } },
        ]);
    });

    test('files an output was given are pruned to what its scope still serves', async () => {
        const service = await startService();
        answerBootstraps(service);
        await service.prepareOutput(0, 5);
        const kept = path.join(directory, 'kept.png');
        const keptUrl = service.resource(0, kept);
        // What a sweep of the scope leaves in the output's list: files the
        // scope no longer serves. (Published one by one, 4096 of them cost
        // seconds: every publish counts the whole list.)
        const resources = service.getOutputContext(0)!.resources;
        for (let index = 0; index < 4095; index++) {
            resources[path.join(directory, `swept-${index}.png`)] =
                `${service.baseUrl}/content/swept/${index}`;
        }
        const fresh = path.join(directory, 'fresh.png');

        const url = service.resource(0, fresh);

        expect(url).toMatch(/\/fresh\.png$/);
        expect(service.getOutputContext(0)!.resources).toEqual({
            [kept]: keptUrl,
            [fresh]: url,
        });
    });

    test('a screen’s app addresses, file links and links inside text become served files', async () => {
        const service = await startService();
        answerBootstraps(service);
        await service.prepareOutput(0, 5);
        const sendData = vi.fn();
        fixture.screenOutputs.set(0, { sendData });
        const picture = path.join(directory, 'pic.png');
        const pictureUrl = pathToFileURL(picture).href;

        const message = service.localMessage({
            screenId: 0,
            type: 'background',
            stage: 2,
            data: {
                src: 'owa://local/assets/logo.png',
                poster: pictureUrl,
                // An encoded slash is no file path.
                broken: 'file:///tmp/a%2Fb.png',
                html: `<img src="${pictureUrl}"> <img src="owa://local/assets/blank.png">`,
                camera: { type: 'camera', src: 'cam-1', deviceId: 'cam-1' },
            },
        } as any) as any;

        const resources = service.getOutputContext(0)!.resources;
        const logo = path.join(fixture.appPath, 'dist', '/assets/logo.png');
        const blank = path.join(fixture.appPath, 'dist', '/assets/blank.png');
        expect(Object.keys(resources).sort()).toEqual(
            [logo, blank, picture].sort(),
        );
        expect(message.data.src).toBe(resources[logo]);
        expect(message.data.src).toMatch(
            new RegExp(`^http://127\\.0\\.0\\.1:${service.port}/content/`),
        );
        expect(message.data.poster).toBe(resources[picture]);
        expect(message.data.broken).toBe('');
        expect(message.data.html).toBe(
            `<img src="${resources[picture]}"> <img src="${resources[blank]}">`,
        );
        // This computer's own camera keeps its own id.
        expect(message.data.camera).toEqual({
            type: 'camera',
            src: 'cam-1',
            deviceId: 'cam-1',
        });
        expect(service.getOutputContext(0)!.stage).toBe(2);
        expect(sendData).toHaveBeenCalledWith('mirror:context', {
            stage: 2,
            resources,
        });
    });

    test('a development screen’s own files come from the source tree', async () => {
        fixture.isDev = true;
        const service = await startService();
        answerBootstraps(service);
        await service.prepareOutput(0, 5);

        const message = service.localMessage({
            screenId: 0,
            type: 'background',
            data: {
                code: 'https://localhost:3000/src/main.ts',
                src: 'https://localhost:3000/assets/blank.png',
            },
        } as any) as any;

        const resources = service.getOutputContext(0)!.resources;
        const code = path.join(fixture.appPath, '/src/main.ts');
        const blank = path.join(fixture.appPath, 'public', '/assets/blank.png');
        expect(message.data.code).toBe(resources[code]);
        expect(message.data.src).toBe(resources[blank]);
    });

    // Vite's `/@fs/` address of a file outside the project: on Windows the
    // drive follows the prefix. (On macOS and Linux it does not -- see the
    // report: the leading slash is lost.)
    test.runIf(process.platform === 'win32')(
        'a development screen’s /@fs/ file is the path after the prefix',
        async () => {
            fixture.isDev = true;
            const service = await startService();
            answerBootstraps(service);
            await service.prepareOutput(0, 5);
            const file = path
                .join(directory, 'outside.png')
                .replace(/\\/g, '/');

            const message = service.localMessage({
                screenId: 0,
                type: 'background',
                data: { src: `https://localhost:3000/@fs/${file}` },
            } as any) as any;

            const resources = service.getOutputContext(0)!.resources;
            expect(Object.keys(resources)).toEqual([file]);
            expect(message.data.src).toBe(resources[file]);
        },
    );
});

describe('the HTTP door', () => {
    const hooks = (overrides: Record<string, unknown> = {}) => ({
        route: () => {},
        upgrade: () => {},
        admits: (network: string) => network === 'local',
        onNetworkChanged: () => {},
        ...overrides,
    });

    test('a viewer on an admitted network loads published files and the viewer’s code', async () => {
        await mkdir(path.join(fixture.appPath, 'dist', 'assets'), {
            recursive: true,
        });
        await writeFile(
            path.join(fixture.appPath, 'dist', 'assets', 'viewer.js'),
            'viewer();',
        );
        const service = await startService();
        service.setVirtualDisplayHooks(hooks() as any);
        const file = path.join(directory, 'slide.png');
        await writeFile(file, 'slide bytes');
        const published = service.content.publish(
            service.content.createScope(),
            file,
        )!;

        const content = await handleHttp(service, published, '192.168.1.7');
        const code = await handleHttp(
            service,
            '/assets/viewer.js',
            '192.168.1.7',
        );
        const fromInternet = await handleHttp(
            service,
            '/assets/viewer.js',
            '8.8.8.8',
        );

        expect(content.statusCode).toBe(200);
        expect(content.body.toString()).toBe('slide bytes');
        expect(code.statusCode).toBe(200);
        expect(code.body.toString()).toBe('viewer();');
        expect(fromInternet.statusCode).toBe(404);
    });

    test('a development viewer is given the quiet Vite client', async () => {
        fixture.isDev = true;
        const service = await startService();
        service.setVirtualDisplayHooks(hooks() as any);

        const client = await handleHttp(
            service,
            '/@vite/client',
            '192.168.1.7',
        );

        expect(client.statusCode).toBe(200);
        expect(client.headers['content-type']).toBe(
            'text/javascript; charset=utf-8',
        );
        expect(client.headers['cache-control']).toBe('no-store');
        expect(client.body.toString()).toContain(
            'export function createHotContext()',
        );
    });

    test('the app’s own pages are served to this computer alone', async () => {
        await mkdir(path.join(fixture.appPath, 'dist'), { recursive: true });
        await writeFile(
            path.join(fixture.appPath, 'dist', 'screen.html'),
            '<main>',
        );
        const service = await startService(HOST);

        const own = await handleHttp(service, '/screen.html', '127.0.0.1');
        const neighbour = await handleHttp(
            service,
            '/screen.html',
            '192.168.1.7',
        );
        const garbled = await handleHttp(service, '/%E0%A4%A', '127.0.0.1');

        expect(own.statusCode).toBe(200);
        expect(own.body.toString()).toBe('<main>');
        expect(neighbour.statusCode).toBe(404);
        expect(garbled.statusCode).toBe(404);
    });

    test('a stream that fails answers 404, or ends what it already began', async () => {
        const service = await startService();
        service.setVirtualDisplayHooks(
            hooks({
                route: () => {
                    throw new Error('broken');
                },
            }) as any,
        );
        const failed = await handleHttp(service, '/vd/1/video', '127.0.0.1');
        service.setVirtualDisplayHooks(
            hooks({
                route: (_req: unknown, res: any) => {
                    res.writeHead(206);
                    throw new Error('cut off');
                },
            }) as any,
        );
        const cut = await handleHttp(service, '/vd/1/video', '127.0.0.1');

        expect(failed.statusCode).toBe(404);
        expect(cut.statusCode).toBe(206);
        expect(cut.writableEnded).toBe(true);
    });

    test('a development build passes this computer’s page requests to Vite', async () => {
        fixture.isDev = true;
        const vite = http.createServer((req, res) => {
            res.writeHead(200, {
                'Content-Type': 'text/html',
                'X-Seen': `${req.method} ${req.url}`,
            });
            res.end('<p>dev</p>');
        });
        servers.push(vite);
        const vitePort = await listenOnLoopback(vite);
        const proxied = vi.spyOn(https, 'request').mockImplementation(((
            address: string,
            options: https.RequestOptions,
            callback: (response: http.IncomingMessage) => void,
        ) => {
            return http.request(
                address.replace(
                    'https://localhost:3000',
                    `http://127.0.0.1:${vitePort}`,
                ),
                { method: options.method },
                callback,
            );
        }) as any);
        const service = await startService();

        const page = await handleHttp(
            service,
            '/screen.html?screenId=1',
            '127.0.0.1',
        );

        expect(proxied.mock.calls[0].slice(0, 2)).toEqual([
            'https://localhost:3000/screen.html?screenId=1',
            { method: 'GET', rejectUnauthorized: false },
        ]);
        expect(page.statusCode).toBe(200);
        expect(page.headers['x-seen']).toBe('GET /screen.html?screenId=1');
        expect(page.body.toString()).toBe('<p>dev</p>');
        // Vite is not running: a bad gateway.
        vite.closeAllConnections();
        await new Promise<void>((resolve) => vite.close(() => resolve()));
        const down = await handleHttp(service, '/screen.html', '127.0.0.1');
        expect(down.statusCode).toBe(502);
    });
});

describe('a development screen’s hot reload socket', () => {
    async function startVite() {
        const handshakes: ((isAccepted: boolean, code?: number) => void)[] = [];
        const vite = new WebSocketServer({
            host: '127.0.0.1',
            port: 0,
            verifyClient: (_info, done) => {
                handshakes.push(done);
            },
        });
        socketServers.push(vite);
        await once(vite, 'listening');
        fixture.viteUrl = `ws://127.0.0.1:${(vite.address() as net.AddressInfo).port}`;
        const connections: { socket: WebSocket; req: http.IncomingMessage }[] =
            [];
        const received: string[] = [];
        vite.on('connection', (socket, req) => {
            connections.push({ socket, req });
            socket.on('message', (data) => received.push(data.toString()));
        });
        return { handshakes, connections, received };
    }

    async function openScreen(service: ScreenMirrorService) {
        const socket = new WebSocket(
            `ws://127.0.0.1:${service.port}/?token=abc`,
        );
        clients.push(socket);
        const received: string[] = [];
        socket.on('message', (data) => received.push(data.toString()));
        socket.on('error', () => {});
        const closed = once(socket, 'close');
        await once(socket, 'open');
        return { socket, received, closed };
    }

    test('is relayed to Vite both ways, holding the first few words until Vite answers', async () => {
        fixture.isDev = true;
        const vite = await startVite();
        const service = await startService();
        const screen = await openScreen(service);

        for (let index = 0; index < 10; index++) {
            screen.socket.send(`early-${index}`);
        }
        // Every word above was read before this ping's answer came back.
        await new Promise((resolve) => {
            screen.socket.once('pong', resolve);
            screen.socket.ping();
        });
        await until(() => vite.handshakes.length === 1);
        vite.handshakes[0](true);
        await until(() => vite.received.length === 8);
        screen.socket.send('late');
        await until(() => vite.received.length === 9);

        expect(vite.received).toEqual([
            ...Array.from({ length: 8 }, (_, index) => `early-${index}`),
            'late',
        ]);
        const [{ socket, req }] = vite.connections;
        expect(req.url).toBe('/?token=abc');
        expect(req.headers.origin).toBe('https://localhost:3000');
        expect(socket.protocol).toBe('vite-hmr');
        socket.send('update');
        await until(() => screen.received.includes('update'));
        screen.socket.close();
        await once(socket, 'close');
    });

    test('a Vite that refuses closes the screen’s socket; a broken screen socket ends Vite’s', async () => {
        fixture.isDev = true;
        const vite = await startVite();
        const service = await startService();

        const refused = await openScreen(service);
        await until(() => vite.handshakes.length === 1);
        vite.handshakes[0](false, 500);
        const [code] = await refused.closed;
        expect(code).toBe(1011);

        const broken = await openScreen(service);
        await until(() => vite.handshakes.length === 2);
        vite.handshakes[1](true);
        await until(() => vite.connections.length === 1);
        const viteClosed = once(vite.connections[0].socket, 'close');
        // Not UTF-8, sent as text.
        broken.socket.send(Buffer.from([0xc3, 0x28]), { binary: false });
        const [viteCode] = await viteClosed;
        expect(viteCode).toBe(1006);
    });
});

describe('the router', () => {
    test('a mapping that arrives after the internet was closed is removed at once', async () => {
        const mapping = {
            ...gateway,
            externalAddress: '203.0.113.10',
            externalPort: 40001,
            internalPort: 1,
            leaseSeconds: 3600,
        };
        vi.mocked(findRouterGateway).mockResolvedValue(gateway);
        vi.mocked(getRouterExternalAddress).mockResolvedValue('203.0.113.10');
        let answer!: (value: RouterMapping) => void;
        vi.mocked(openRouterPort).mockImplementation(() => {
            return new Promise((resolve) => {
                answer = resolve;
            });
        });
        const service = await startService(HOST);
        await service.setInternetEnabled(true);
        await until(() => vi.mocked(openRouterPort).mock.calls.length === 1);

        await service.setInternetEnabled(false);
        answer(mapping);

        await until(() => vi.mocked(closeRouterPort).mock.calls.length === 1);
        expect(closeRouterPort).toHaveBeenCalledWith(mapping);
        expect(service.routerState).toBe('off');
        // Never kept for the next launch to find.
        expect(fixture.client.get('screen-mirror-router-mapping') ?? '').toBe(
            '',
        );
        expect(service.state().addresses.some((a) => a.kind === 'router')).toBe(
            false,
        );
    });

    test('this app’s own earlier mapping on another port is removed; another app’s is not', async () => {
        vi.mocked(findRouterGateway).mockResolvedValue(gateway);
        vi.mocked(getRouterExternalAddress).mockResolvedValue('203.0.113.10');
        const service = await startService(HOST);
        const mapping = {
            ...gateway,
            externalAddress: '203.0.113.10',
            externalPort: 40001,
            internalPort: service.port,
            leaseSeconds: 3600,
        };
        vi.mocked(openRouterPort).mockResolvedValue(mapping);
        const ours = {
            controlUrl: gateway.controlUrl,
            serviceType: gateway.serviceType,
            externalPort: 40000,
            internalPort: 39999,
        };
        fixture.client.set(
            'screen-mirror-router-mapping',
            JSON.stringify(ours),
        );

        await service.setInternetEnabled(true);
        await until(() => service.routerState === 'open');

        expect(vi.mocked(openRouterPort).mock.calls[0][3]).toMatchObject({
            preferredPort: 40000,
        });
        expect(closeRouterPort).toHaveBeenCalledWith(ours);
        expect(closeRouterPort).toHaveBeenCalledOnce();
        // No internal port recorded: it could be another app's, and stays.
        fixture.client.set(
            'screen-mirror-router-mapping',
            JSON.stringify({ ...ours, internalPort: undefined }),
        );
        const sender = makeContents(7, 'owa://local/presenter.html');
        ipc('mirror:command')(
            { sender },
            { action: 'router', replyEventName: 'router-reply' },
        );
        await until(() => vi.mocked(openRouterPort).mock.calls.length === 2);
        await until(() => service.routerState === 'open');
        expect(closeRouterPort).toHaveBeenCalledOnce();
        expect(sender.sent.map(([channel]) => channel)).toContain(
            'router-reply',
        );
    });

    test('a mapping is renewed at half its lease, and asked for again when it leads elsewhere', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const mapping = {
            ...gateway,
            externalAddress: '203.0.113.10',
            externalPort: 40001,
            internalPort: 1,
            leaseSeconds: 120,
        };
        vi.mocked(findRouterGateway).mockResolvedValue(gateway);
        vi.mocked(getRouterExternalAddress).mockResolvedValue('203.0.113.10');
        vi.mocked(openRouterPort).mockResolvedValue(mapping);
        vi.mocked(probeRouterPort).mockResolvedValue('this');
        const service = await startService({ ...HOST, ...INTERNET });
        await until(() => service.routerState === 'open');

        await vi.advanceTimersByTimeAsync(59_999);
        expect(renewRouterPort).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        await until(() => vi.mocked(probeRouterPort).mock.calls.length === 1);
        expect(renewRouterPort).toHaveBeenCalledWith(mapping);
        expect(probeRouterPort).toHaveBeenCalledWith(
            '203.0.113.10',
            40001,
            expect.any(String),
        );
        expect(findRouterGateway).toHaveBeenCalledOnce();

        // Kept, and renewed again; now the port leads to something else.
        vi.mocked(probeRouterPort).mockResolvedValue('other');
        await vi.advanceTimersByTimeAsync(60_000);
        await until(() => vi.mocked(findRouterGateway).mock.calls.length === 2);
        await until(() => service.routerState === 'open');

        // A renewal the router refuses: asked for again.
        vi.mocked(renewRouterPort).mockRejectedValue(new Error('gone'));
        await vi.advanceTimersByTimeAsync(60_000);
        await until(() => vi.mocked(findRouterGateway).mock.calls.length === 3);
    });
});

describe('the presenter’s commands', () => {
    let replies = 0;
    async function command(
        sender: ReturnType<typeof makeContents>,
        data: Record<string, unknown>,
    ) {
        const replyEventName = `mirror:reply-${++replies}`;
        ipc('mirror:command')({ sender }, { ...data, replyEventName });
        await until(() => {
            return sender.sent.some(([channel]) => channel === replyEventName);
        });
        return sender.sent.find(([channel]) => channel === replyEventName)![1];
    }

    test('each is carried out and answered', async () => {
        const service = await startService(HOST);
        const sender = makeContents(7, 'owa://local/presenter.html');

        expect(
            await command(sender, { action: 'firewall', isForced: true }),
        ).toEqual({ verdict: 'open' });
        expect(
            await command(sender, {
                action: 'open-firewall-settings',
                target: 'windows',
            }),
        ).toBe(true);
        expect(fixture.firewall).toEqual([
            ['check', { port: service.port, isForced: true }],
            ['open', 'windows'],
        ]);
        const refused = await command(sender, {
            action: 'connect',
            host: 'bad host',
            port: 80,
        });
        expect(refused).toBeInstanceOf(Error);
        expect(refused.message).toBe('Invalid host or port');
        expect(
            await command(sender, { action: 'disconnect', id: 42 }),
        ).toMatchObject({ connections: [] });
        expect(
            await command(sender, { action: 'internet', enabled: true }),
        ).toMatchObject({ internetEnabled: true });
        const noPair = await command(sender, {
            action: 'intercom',
            key: 'nobody:1',
        });
        expect(noPair).toBeInstanceOf(Error);
        expect(noPair.message).toBe('Connection failed');
        expect(
            await command(sender, {
                action: 'share-cameras',
                id: 'no-such-link',
                enabled: true,
            }),
        ).toMatchObject({ connections: [] });
        expect(
            await command(sender, { action: 'tunnel', enabled: false }),
        ).toMatchObject({ tunnelEnabled: false });
    });

    test('a guest turned away hears why, and an unknown one changes nothing', async () => {
        const service = await startService(HOST);
        const sender = makeContents(7, 'owa://local/presenter.html');
        const waiting = await guest(service);
        const approved = await guest(service);
        await until(() => service.state().pending.length === 2);
        service.approve(approved.id);

        await command(sender, { action: 'reject', id: waiting.id });
        await command(sender, { action: 'disconnect-guest', id: approved.id });
        await command(sender, { action: 'reject', id: randomUUID() });

        for (const client of [waiting, approved]) {
            expect((await client.closed).code).toBe(1005);
            expect(client.packets.at(-1)).toEqual({
                protocol: 1,
                type: 'error',
                error: 'Disconnected by host',
            });
        }
    });

    test('a window that is not the app’s own is not answered', async () => {
        await startService();
        const stranger = makeContents(8, 'https://example.com/x.html');

        ipc('mirror:command')(
            { sender: stranger },
            { action: 'firewall', replyEventName: 'reply' },
        );
        await new Promise((resolve) => setImmediate(resolve));

        expect(stranger.sent).toEqual([]);
        expect(fixture.firewall).toEqual([]);
    });

    test('a macOS microphone needs the person’s yes; its sound goes out to the guest', async () => {
        const service = await startService(HOST);
        const client = await guest(service);
        await until(() => service.state().pending.length === 1);
        service.approve(client.id);
        const key = `guest:${client.id}`;
        const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
        Object.defineProperty(process, 'platform', { value: 'darwin' });
        try {
            fixture.mediaAccess = false;
            await expect(
                service.setIntercom(key, { mic: true }),
            ).rejects.toThrow('Microphone access denied');
            expect(service.intercomStateOf(key).mic).toBe(false);
            expect(fixture.brokers).toEqual([]);
            fixture.mediaAccess = true;
            await service.setIntercom(key, { mic: true });
        } finally {
            Object.defineProperty(process, 'platform', platform);
        }

        expect(service.intercomStateOf(key).mic).toBe(true);
        const [broker] = fixture.brokers;
        expect(broker.webContents.sent).toContainEqual([
            'mirror:intercom',
            { type: 'config', isMicOn: true, speakers: {} },
        ]);
        // Only the broker's own capture is sent on.
        ipc('mirror:intercom-audio')(
            { sender: makeContents(8, 'owa://local/presenter.html') },
            new Uint8Array([9, 9]),
        );
        ipc('mirror:intercom-audio')(
            { sender: broker.webContents },
            new Uint8Array([1, 2, 3]),
        );
        await until(() => client.packets.some((p) => p.type === 'audio'));
        expect(client.packets.filter((p) => p.type === 'audio')).toEqual([
            { protocol: 1, type: 'audio', data: 'AQID' },
        ]);
        expect(client.packets).toContainEqual({
            protocol: 1,
            type: 'intercom-state',
            mic: true,
        });
    });
});

describe('wrong connection codes', () => {
    test('past 256 senders the oldest count is forgotten', async () => {
        const service = await startService();
        for (let index = 0; index < 5; index++) {
            service.checkSenderCode('198.51.100.1', '1234', '0000');
        }
        for (let index = 0; index < 255; index++) {
            service.checkSenderCode(`10.1.0.${index}`, '1234', '0000');
        }
        expect(service.checkIsSenderLockedOut('198.51.100.1')).toBe(true);

        expect(service.checkSenderCode('203.0.113.200', '1234', '0000')).toBe(
            'wrong',
        );

        expect(service.checkIsSenderLockedOut('198.51.100.1')).toBe(false);
        expect((service as any).wrongCodes.size).toBe(256);
    });

    test('a full list first lets go of the counts that ran out', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-11-03T10:00:00.000Z'));
        const service = await startService();
        for (let index = 0; index < 255; index++) {
            service.checkSenderCode(`10.1.0.${index}`, '1234', '0000');
        }
        vi.setSystemTime(new Date('2026-11-03T10:11:00.000Z'));
        for (let index = 0; index < 5; index++) {
            service.checkSenderCode('198.51.100.1', '1234', '0000');
        }

        service.checkSenderCode('203.0.113.200', '1234', '0000');

        expect(service.checkIsSenderLockedOut('198.51.100.1')).toBe(true);
        expect((service as any).wrongCodes.size).toBe(2);
    });
});

describe('this computer as a guest of a host', () => {
    type FakeHostOptions = {
        discovery?: (
            req: http.IncomingMessage,
            res: http.ServerResponse,
        ) => void;
        onHello?: (socket: WebSocket, packet: any) => void;
        autoPong?: boolean;
    };
    async function startFakeHost(options: FakeHostOptions = {}) {
        const id = randomUUID();
        const sockets: WebSocket[] = [];
        const packets: any[] = [];
        const server = http.createServer((req, res) => {
            if (options.discovery) {
                options.discovery(req, res);
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
                JSON.stringify({
                    service: 'owa-screen-mirror',
                    protocol: 1,
                    id,
                    name: 'Fake host',
                    version: appInfo.version,
                    port,
                }),
            );
        });
        const wss = new WebSocketServer({
            noServer: true,
            autoPong: options.autoPong ?? true,
        });
        server.on('upgrade', (req, socket, head) => {
            wss.handleUpgrade(req, socket, head, (ws) => {
                sockets.push(ws);
                ws.on('message', (data) => {
                    const packet = JSON.parse(data.toString());
                    packets.push(packet);
                    if (packet.type !== 'hello') return;
                    if (options.onHello) options.onHello(ws, packet);
                    else
                        ws.send(
                            JSON.stringify({
                                protocol: 1,
                                type: 'approved',
                                id,
                                prefix: 'a2',
                                resume: 'resume-1',
                            }),
                        );
                });
            });
        });
        servers.push(server);
        socketServers.push(wss);
        const port = await listenOnLoopback(server);
        const send = (type: string, data: Record<string, any> = {}) => {
            sockets
                .at(-1)!
                .send(JSON.stringify({ protocol: 1, type, ...data }));
        };
        return { id, port, sockets, packets, send };
    }

    async function linkTo(
        service: ScreenMirrorService,
        host: { port: number },
    ) {
        await service.connect({ host: '127.0.0.1', port: host.port, code: '' });
        await until(() => {
            return service.state().connections.at(-1)?.status === 'connected';
        });
        return service.state().connections.at(-1)!.id;
    }

    test('an address that is no address, or a port that is none, is refused', async () => {
        const service = await startService();

        await expect(
            service.connect({ host: 'bad host', port: 80, code: '' }),
        ).rejects.toThrow('Invalid host or port');
        await expect(
            service.connect({ host: '127.0.0.1', port: 0, code: '' }),
        ).rejects.toThrow('Invalid host or port');
        expect(service.state().connections).toEqual([]);
    });

    test('a discovery answer that is another app’s, or no answer at all, links nothing', async () => {
        const service = await startService();
        const older = await startFakeHost({
            discovery: (_req, res) => {
                res.writeHead(200);
                res.end(
                    JSON.stringify({
                        service: 'owa-screen-mirror',
                        protocol: 1,
                        id: randomUUID(),
                        name: 'Old',
                        version: '0.0.1',
                    }),
                );
            },
        });
        const page = await startFakeHost({
            discovery: (_req, res) => {
                res.writeHead(200);
                res.end('<html>');
            },
        });
        const silent = await startFakeHost({ discovery: () => {} });
        const asked = vi.spyOn(http, 'get');

        await expect(
            service.connect({ host: '127.0.0.1', port: older.port, code: '' }),
        ).rejects.toThrow('Incompatible or duplicate connection');
        await expect(
            service.connect({ host: '127.0.0.1', port: page.port, code: '' }),
        ).rejects.toThrow('Incompatible or duplicate connection');
        const waiting = service.connect({
            host: '127.0.0.1',
            port: silent.port,
            code: '',
        });
        await until(() => asked.mock.results.length === 3);
        (asked.mock.results[2].value as http.ClientRequest).emit('timeout');
        await expect(waiting).rejects.toThrow('Connection failed');

        expect(service.state().connections).toEqual([]);
        expect(older.sockets).toEqual([]);
    });

    // Long enough to come in several reads, so it is cut off part way (one
    // that comes whole in a single read: the next test).
    test('a discovery answer too long to be one is cut off', async () => {
        const service = await startService();
        const chatty = await startFakeHost({
            discovery: (_req, res) => {
                res.writeHead(200);
                res.end('x'.repeat(100_000));
            },
        });

        await expect(
            service.connect({ host: '127.0.0.1', port: chatty.port, code: '' }),
        ).rejects.toThrow('Connection failed');

        expect(service.state().connections).toEqual([]);
        expect(chatty.sockets).toEqual([]);
    });

    // Found by UT-76 (2026-11-03): a whole answer over the limit in ONE read
    // was cut off after the response had already ended, on a socket already
    // handed back to the keep-alive pool -- so the error was thrown in the
    // main process with nothing listening, and connect() said the host was
    // incompatible instead.
    test('a discovery answer over the limit in one read is refused, and nothing is thrown', async () => {
        const thrownList: unknown[] = [];
        const handleUncaught = (error: unknown) => {
            thrownList.push(error);
        };
        process.on('uncaughtException', handleUncaught);
        try {
            const service = await startService();
            const chatty = await startFakeHost({
                discovery: (_req, res) => {
                    res.writeHead(200);
                    res.end('x'.repeat(4096));
                },
            });

            await expect(
                service.connect({
                    host: '127.0.0.1',
                    port: chatty.port,
                    code: '',
                }),
            ).rejects.toThrow('Connection failed');
            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(thrownList).toEqual([]);
            expect(service.state().connections).toEqual([]);
        } finally {
            process.off('uncaughtException', handleUncaught);
        }
    });

    test('a host that refuses leaves the link in error, not redialled; trying again replaces it', async () => {
        const host = await startFakeHost({
            onHello: (socket) => {
                socket.send(
                    JSON.stringify({
                        protocol: 1,
                        type: 'error',
                        error: 'Connection code is incorrect',
                    }),
                );
                socket.close(1008);
            },
        });
        const service = await startService();

        await service.connect({
            host: '127.0.0.1',
            port: host.port,
            code: '1234',
        });

        await until(() => service.state().connections[0]?.status === 'error');
        expect(service.state().connections[0]).toMatchObject({
            hostId: host.id,
            error: 'Connection code is incorrect',
        });
        expect(host.packets[0]).toMatchObject({
            type: 'hello',
            id: service.id,
            code: '1234',
            version: appInfo.version,
        });
        await until(() => host.sockets[0].readyState === WebSocket.CLOSED);
        await until(() => !(service as any).links.values().next().value.socket);
        expect(service.state().connections[0].status).toBe('error');
        const failedId = service.state().connections[0].id;

        await service.connect({
            host: '127.0.0.1',
            port: host.port,
            code: '5678',
        });

        expect(service.state().connections).toHaveLength(1);
        expect(service.state().connections[0].id).not.toBe(failedId);
        await until(() => host.packets.length === 2);
        expect(host.packets[1]).toMatchObject({ type: 'hello', code: '5678' });
    });

    test('a host’s packet that is no packet closes the link, which waits to redial', async () => {
        const garbling = await startFakeHost({
            onHello: (socket) => socket.send('not a packet'),
        });
        const binary = await startFakeHost({
            onHello: (socket) =>
                socket.send(Buffer.from([1, 2]), { binary: true }),
        });
        const service = await startService();

        for (const host of [garbling, binary]) {
            await service.connect({
                host: '127.0.0.1',
                port: host.port,
                code: '',
            });
            await until(() => host.sockets.length === 1);
            const [code] = await once(host.sockets[0], 'close');
            expect(code).toBe(1008);
        }

        await until(() => {
            return service.state().connections.every((connection) => {
                return connection.status === 'reconnecting';
            });
        });
        expect(service.state().connections).toHaveLength(2);
    });

    test('a host that stops answering pings is dropped, then dialled again with its resume', async () => {
        vi.useFakeTimers({
            toFake: [
                'setInterval',
                'clearInterval',
                'setTimeout',
                'clearTimeout',
            ],
        });
        const host = await startFakeHost({ autoPong: false });
        const service = await startService();
        await linkTo(service, host);
        const first = host.sockets[0];
        const pinged = once(first, 'ping');

        await vi.advanceTimersByTimeAsync(5000);
        await pinged;
        const dropped = once(first, 'close');
        await vi.advanceTimersByTimeAsync(5000);
        await dropped;

        await until(() => {
            return service.state().connections[0].status === 'reconnecting';
        });
        await vi.advanceTimersByTimeAsync(999);
        expect(host.sockets).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(1);
        await until(() => {
            return host.packets.filter((p) => p.type === 'hello').length === 2;
        });
        expect(host.packets.filter((p) => p.type === 'hello')[1]).toMatchObject(
            { id: service.id, resume: 'resume-1' },
        );
    });

    test('a host that answers its pings stays linked, and its cameras are this computer’s to show', async () => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
        const host = await startFakeHost();
        const service = await startService();
        await linkTo(service, host);
        const own = makeContents(7, 'owa://local/presenter.html');
        service.registerCameraSource(() => [
            { deviceId: 'vd-camera:phone', label: 'Phone', groupId: '' },
        ]);

        for (let beat = 1; beat <= 3; beat++) {
            const pinged = once(host.sockets[0], 'ping');
            await vi.advanceTimersByTimeAsync(5000);
            await pinged;
            host.send('cameras', {
                cameras: [
                    {
                        deviceId: `mirror-camera:${host.id}:cam-${beat}`,
                        label: `Cam ${beat}`,
                    },
                ],
            });
            await until(() => service.cameras()[0]?.label === `Cam ${beat}`);
        }

        expect(service.state().connections[0].status).toBe('connected');
        expect(host.sockets).toHaveLength(1);
        const event: any = { sender: own };
        ipc('mirror:cameras')(event);
        expect(event.returnValue).toEqual([
            {
                deviceId: `mirror-camera:${host.id}:cam-3`,
                label: 'Cam 3',
                groupId: '',
            },
            { deviceId: 'vd-camera:phone', label: 'Phone', groupId: '' },
        ]);
    });

    test('a show that cannot be put up here is answered with its screen down', async () => {
        fixture.displays = [display];
        const host = await startFakeHost();
        const service = await startService();
        await linkTo(service, host);
        const down = (screenId: number) => ({
            protocol: 1,
            type: 'screen-feedback',
            message: { screenId, type: 'visible', data: { isShowing: false } },
        });

        // A context for another screen, and a display this computer lacks.
        host.send('show', {
            screenId: 3,
            displayId: 15,
            context: { screenId: 4 },
        });
        host.send('show', {
            screenId: 5,
            displayId: 99,
            context: { screenId: 5 },
        });

        await until(() => {
            return (
                host.packets.filter((p) => p.type === 'screen-feedback')
                    .length === 2
            );
        });
        expect(
            host.packets.filter((p) => p.type === 'screen-feedback'),
        ).toEqual([down(3), down(5)]);
        expect(fixture.controllers).toEqual([]);
    });

    // A setting the host changes reaches its screen here in its own copy, so
    // the window it reloads into draws with it too.
    test('a host’s setting change goes into the copy its screen here opens with', async () => {
        fixture.displays = [display];
        const host = await startFakeHost();
        const service = await startService();
        await linkTo(service, host);
        host.send('show', {
            screenId: 0,
            displayId: 15,
            context: {
                screenId: 0,
                isWindows: false,
                resources: {},
                settings: { 'screen-bible--line-sync-0': 'false' },
            },
        });
        await until(() => fixture.controllers.length === 1);
        const incoming = () => {
            return [...(service as any).incoming.values()][0];
        };

        host.send('screen', {
            message: {
                screenId: 0,
                type: 'screen-setting',
                data: {
                    settings: {
                        'screen-bible--line-sync-0': 'true',
                        'ai-enabled': 'true',
                    },
                },
            },
            resources: {},
            stage: 0,
        });

        await until(() => {
            return (
                incoming()?.context.settings['screen-bible--line-sync-0'] ===
                'true'
            );
        });
        expect(incoming().context.settings).toEqual({
            'screen-bible--line-sync-0': 'true',
        });
    });

    test('a host’s screen here finds the files of its pages from what the host published', async () => {
        fixture.displays = [display, display2];
        const host = await startFakeHost();
        const service = await startService();
        await linkTo(service, host);
        const base = `http://127.0.0.1:${host.port}/content/scope/`;

        host.send('show', {
            screenId: 0,
            displayId: 15,
            context: {
                screenId: 0,
                isWindows: false,
                resources: {
                    '/srv/pics/photo.png': `${base}2/photo.png`,
                    '/srv/web/index.html': `${base}1/index.html`,
                },
            },
        });
        host.send('show', {
            screenId: 1,
            displayId: 16,
            context: {
                screenId: 1,
                isWindows: true,
                resources: { 'C:\\Show\\deck.html': `${base}3/deck.html` },
            },
        });
        await until(() => fixture.controllers.length === 2);
        const posix = fixture.controllers[0].win.webContents;
        const windows = fixture.controllers[1].win.webContents;

        expect(service.resource(0, '/srv/pics/photo.png', posix)).toBe(
            `${base}2/photo.png`,
        );
        expect(service.resource(0, '/srv/web/css/site.css', posix)).toBe(
            `${base}1/css/site.css`,
        );
        expect(service.resource(0, '/srv/web/a b.png', posix)).toBe(
            `${base}1/a%20b.png`,
        );
        expect(service.resource(0, '/srv/elsewhere.png', posix)).toBe('');
        expect(service.resource(0, '/srv/web', posix)).toBe('');
        expect(service.resource(1, 'C:\\Show\\img\\a.png', windows)).toBe(
            `${base}3/img/a.png`,
        );
        expect(service.resource(1, 'D:\\other.png', windows)).toBe('');
    });

    test('a host’s ask for this computer’s camera goes through the broker only while shared', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const host = await startFakeHost();
        const service = await startService();
        const linkId = await linkTo(service, host);
        const closesFor = (requestId: string) => {
            return host.packets.filter((p) => {
                return p.type === 'camera-close' && p.requestId === requestId;
            });
        };

        // Not shared: refused at once, and no broker is opened.
        const refused = randomUUID();
        host.send('camera-request', { requestId: refused, deviceId: 'cam-1' });
        await until(() => closesFor(refused).length === 1);
        expect(fixture.brokers).toEqual([]);

        service.setShareCameras(linkId, true);
        const shared = randomUUID();
        host.send('camera-request', { requestId: shared, deviceId: 'cam-1' });
        await until(() => fixture.brokers[0]?.webContents.sent.length > 0);
        const broker = fixture.brokers[0];
        expect(broker.options).toMatchObject({
            show: false,
            webPreferences: { nodeIntegration: true, contextIsolation: false },
        });
        expect(broker.webContents.url).toBe('owa://local/camera-broker.html');
        expect(broker.webContents.windowOpenHandler()).toEqual({
            action: 'deny',
        });
        expect(broker.webContents.sent).toEqual([
            [
                'mirror:camera',
                {
                    protocol: 1,
                    type: 'camera-request',
                    requestId: shared,
                    deviceId: 'cam-1',
                },
            ],
        ]);
        // The broker's offer reaches that host, and the host's answer the broker.
        ipc('mirror:camera-send')(
            { sender: broker.webContents },
            { type: 'camera-signal', requestId: shared, signal: 'offer' },
        );
        await until(() => host.packets.some((p) => p.type === 'camera-signal'));
        expect(host.packets.find((p) => p.type === 'camera-signal')).toEqual({
            protocol: 1,
            type: 'camera-signal',
            requestId: shared,
            signal: 'offer',
        });
        host.send('camera-signal', { requestId: shared, signal: 'answer' });
        await until(() => {
            return broker.webContents.sent.some(([, packet]: [string, any]) => {
                return packet.signal === 'answer';
            });
        });

        // Sharing off ends that stream on both sides.
        service.setShareCameras(linkId, false);
        expect(broker.webContents.sent.at(-1)).toEqual([
            'mirror:camera',
            { type: 'camera-close', requestId: shared },
        ]);
        await until(() => closesFor(shared).length === 1);

        // Shared again: a stream the broker itself ends.
        service.setShareCameras(linkId, true);
        const ended = randomUUID();
        host.send('camera-request', { requestId: ended, deviceId: 'cam-1' });
        await until(() => {
            return broker.webContents.sent.some(([, packet]: [string, any]) => {
                return packet.requestId === ended;
            });
        });
        ipc('mirror:camera-send')(
            { sender: broker.webContents },
            { type: 'camera-close', requestId: ended },
        );
        await until(() => closesFor(ended).length === 1);
        // Nothing open: the broker goes after five seconds.
        expect(broker.destroyed).toBe(false);
        await vi.advanceTimersByTimeAsync(5000);
        expect(broker.destroyed).toBe(true);
        expect(fixture.brokers).toHaveLength(1);
    });

    test('a host that goes away ends the streams of this computer’s camera it had', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const host = await startFakeHost();
        const service = await startService();
        const linkId = await linkTo(service, host);
        service.setShareCameras(linkId, true);
        const requestId = randomUUID();
        host.send('camera-request', { requestId, deviceId: 'cam-1' });
        await until(() => fixture.brokers[0]?.webContents.sent.length > 0);
        const broker = fixture.brokers[0];

        // Turned away for good: not redialled.
        host.send('error', { error: 'Disconnected by host' });
        host.sockets[0].close();

        await until(() => {
            return broker.webContents.sent.some(([, packet]: [string, any]) => {
                return packet.type === 'camera-close';
            });
        });
        expect(broker.webContents.sent.at(-1)).toEqual([
            'mirror:camera',
            { type: 'camera-close', requestId },
        ]);
        await vi.advanceTimersByTimeAsync(5000);
        expect(broker.destroyed).toBe(true);
        expect(service.state().connections[0].status).toBe('error');
    });

    test('a window here watching a host’s camera is paired with that host until it closes', async () => {
        const host = await startFakeHost();
        const service = await startService();
        await linkTo(service, host);
        const deviceId = `mirror-camera:${host.id}:cam-9`;
        host.send('cameras', { cameras: [{ deviceId, label: 'Stage' }] });
        await until(() => service.cameras().length === 1);
        const viewer = makeContents(31, 'owa://local/presenter.html');
        fixture.windows = [{ isDestroyed: () => false, webContents: viewer }];
        const fromHost = (type: string, requestId: string) => {
            return host.packets.filter((p) => {
                return p.type === type && p.requestId === requestId;
            });
        };
        const toViewer = (type: string, requestId: string) => {
            return viewer.sent.filter(([channel, packet]) => {
                return (
                    channel === 'mirror:camera' &&
                    packet.type === type &&
                    packet.requestId === requestId
                );
            });
        };
        const send = (packet: Record<string, unknown>) => {
            ipc('mirror:camera-send')({ sender: viewer }, packet);
        };

        // A signal for no stream of this window's goes nowhere.
        const stray = randomUUID();
        send({ type: 'camera-signal', requestId: stray, signal: 'x' });
        const closedByViewer = randomUUID();
        send({ type: 'camera-request', requestId: closedByViewer, deviceId });
        await until(() => fromHost('camera-request', closedByViewer).length);
        expect(host.packets.some((p) => p.requestId === stray)).toBe(false);
        host.send('camera-signal', { requestId: closedByViewer, signal: 'a' });
        await until(() => toViewer('camera-signal', closedByViewer).length);
        send({ type: 'camera-close', requestId: closedByViewer });
        await until(() => fromHost('camera-close', closedByViewer).length);

        const closedWithWindow = randomUUID();
        send({ type: 'camera-request', requestId: closedWithWindow, deviceId });
        await until(() => fromHost('camera-request', closedWithWindow).length);
        viewer.fire('destroyed');
        await until(() => fromHost('camera-close', closedWithWindow).length);

        const second = makeContents(32, 'owa://local/presenter.html');
        fixture.windows = [{ isDestroyed: () => false, webContents: second }];
        const closedWithHost = randomUUID();
        ipc('mirror:camera-send')(
            { sender: second },
            { type: 'camera-request', requestId: closedWithHost, deviceId },
        );
        await until(() => fromHost('camera-request', closedWithHost).length);
        host.sockets[0].close();
        await until(() => {
            return second.sent.some(([channel, packet]) => {
                return (
                    channel === 'mirror:camera' &&
                    packet.type === 'camera-close' &&
                    packet.requestId === closedWithHost
                );
            });
        });
        // The app's own window heard every change of the link.
        expect(
            second.sent.some(([channel]) => channel === 'mirror:state'),
        ).toBe(true);
    });
});

describe('camera routes on this host', () => {
    test('a window here watching this computer’s camera is served by the broker', async () => {
        const service = await startService();
        const viewer = makeContents(41, 'owa://local/presenter.html');
        fixture.windows = [{ isDestroyed: () => false, webContents: viewer }];
        const send = (sender: unknown, packet: Record<string, unknown>) => {
            ipc('mirror:camera-send')({ sender }, packet);
        };

        // A guest's camera, of a guest that is not here: nothing opens.
        send(viewer, {
            type: 'camera-request',
            requestId: randomUUID(),
            deviceId: `mirror-camera:${randomUUID()}:cam`,
        });
        expect(fixture.brokers).toEqual([]);

        const requestId = randomUUID();
        send(viewer, {
            type: 'camera-request',
            requestId,
            deviceId: `mirror-camera:${service.id}:cam-1`,
        });
        const [broker] = fixture.brokers;
        expect(broker.webContents.sent).toEqual([
            [
                'mirror:camera',
                { type: 'camera-request', requestId, deviceId: 'cam-1' },
            ],
        ]);
        send(broker.webContents, {
            type: 'camera-signal',
            requestId,
            signal: 'offer',
        });

        expect(viewer.sent).toContainEqual([
            'mirror:camera',
            { type: 'camera-signal', requestId, signal: 'offer' },
        ]);
    });
});

describe('scanning for hosts', () => {
    test('asks every network of this computer on every Screen Mirror port', async () => {
        vi.spyOn(os, 'networkInterfaces').mockReturnValue({
            Ethernet: [
                {
                    address: '192.168.1.20',
                    netmask: '255.255.255.0',
                    family: 'IPv4',
                    mac: '00:00:00:00:00:01',
                    internal: false,
                    cidr: '192.168.1.20/24',
                },
            ],
        } as any);
        const service = await startService();
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

        const scanning = service.rescan();
        const udp = udpSockets.at(-1)!;
        await until(() => udp.sent.length === 40);

        expect(udp.isBroadcast).toBe(true);
        const ports = Array.from({ length: 20 }, (_, index) => 39240 + index);
        expect(udp.sent).toEqual(
            ['127.0.0.1', '192.168.1.255'].flatMap((address) => {
                return ports.map((port) => [
                    'owa-screen-mirror-discover-v1',
                    port,
                    address,
                ]);
            }),
        );
        await vi.advanceTimersByTimeAsync(2500);
        expect(await scanning).toEqual([]);
        expect(udp.closed).toBe(1);
    });
});
