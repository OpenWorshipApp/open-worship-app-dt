import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import { X509Certificate } from 'node:crypto';
import dgram from 'node:dgram';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import type * as RouterModule from './screenMirrorRouter';

const fixture = vi.hoisted(() => ({
    client: new Map<string, string>(),
    secure: new Map<string, string>(),
    // Every service registers its own handlers; a call reaches them all and
    // each answers only what is its own, as in the real main process.
    ipc: new Map<string, ((...args: any[]) => void)[]>(),
    displays: [] as any[],
    controllers: [] as any[],
    powerSaveBlocker: { start: vi.fn(() => 1), stop: vi.fn() },
}));
vi.mock('electron', () => ({
    app: { once: vi.fn(), getAppPath: () => process.cwd() },
    powerSaveBlocker: fixture.powerSaveBlocker,
    screen: {
        on: vi.fn(),
        getAllDisplays: () => fixture.displays,
        getPrimaryDisplay: () => ({ id: 1 }),
    },
    BrowserWindow: { getAllWindows: () => [] },
    ipcMain: {
        on: (name: string, handler: (...args: any[]) => void) => {
            fixture.ipc.set(name, [...(fixture.ipc.get(name) ?? []), handler]);
        },
    },
}));
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
                win: {
                    webContents: { id: 1000 + fixture.controllers.length },
                    once: (_: string, callback: () => void) =>
                        closed.push(callback),
                    isDestroyed: () => false,
                    setAlwaysOnTop: vi.fn(),
                    moveTop: vi.fn(),
                    focus: vi.fn(),
                },
                setDisplay: vi.fn(),
                listenLoading: async () => {},
                sendData: vi.fn(),
                sendMessage: vi.fn(),
                close: vi.fn(() => closed.forEach((callback) => callback())),
            };
            fixture.controllers.push(controller);
            return controller;
        },
    },
}));
vi.mock('./protocolHelpers', () => ({ getRootUrl: () => 'owa://local' }));
vi.mock('./electronHelpers', () => ({
    isDev: false,
    messageChannels: { screenMessage: 'screen-message' },
}));

import { ScreenMirrorService } from './screenMirrorService';
import {
    closeRouterPort,
    findRouterGateway,
    getRouterExternalAddress,
    lookUpPublicAddress,
    openRouterPort,
    probeRouterPort,
} from './screenMirrorRouter';
import { MirrorTunnel } from './screenMirrorTunnel';
import { readRequestSender } from './mirrorRequestSender';
import {
    VIRTUAL_DISPLAY_HTTPS_KEY,
    VIRTUAL_DISPLAY_SHARE_KEY,
    toVirtualDisplayId,
} from './virtualDisplayProtocol';
import appInfo from '../package.json';

function ipc(name: string) {
    return (...args: any[]) => {
        for (const handler of fixture.ipc.get(name) ?? []) handler(...args);
    };
}

let service: ScreenMirrorService;
let directory: string;
const sockets: WebSocket[] = [];
async function useFreePort() {
    // Avoid the real app's port, including Windows' separate IPv4/IPv6 binds.
    const probe = net.createServer();
    await new Promise<void>((resolve) => probe.listen(0, resolve));
    const port = (probe.address() as net.AddressInfo).port;
    await new Promise<void>((resolve) => probe.close(() => resolve()));
    fixture.client.set('screen-mirror-port', String(port));
}
beforeEach(async () => {
    fixture.client.clear();
    fixture.secure.clear();
    fixture.ipc.clear();
    fixture.powerSaveBlocker.start.mockClear();
    fixture.powerSaveBlocker.stop.mockClear();
    fixture.displays = [];
    fixture.controllers = [];
    vi.mocked(findRouterGateway).mockReset().mockResolvedValue(null);
    vi.mocked(getRouterExternalAddress).mockReset().mockResolvedValue('');
    vi.mocked(openRouterPort).mockReset();
    vi.mocked(probeRouterPort).mockReset().mockResolvedValue('unknown');
    vi.mocked(lookUpPublicAddress).mockReset().mockResolvedValue('');
    vi.mocked(closeRouterPort).mockReset().mockResolvedValue(undefined);
    directory = await mkdtemp(path.join(os.tmpdir(), 'owa-mirror-service-'));
    // Hosting is off by default; these tests are about a host.
    fixture.client.set('screen-mirror-host', 'true');
    await useFreePort();
    service = new ScreenMirrorService();
    await service.start();
});
afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.terminate();
    service.stop();
    await rm(directory, { recursive: true, force: true });
});
async function guest(
    id = randomUUID(),
    extra: Record<string, any> = {},
    options: WebSocket.ClientOptions = {},
) {
    const socket = new WebSocket(
        `${service.baseUrl.replace('http:', 'ws:')}/mirror`,
        options,
    );
    sockets.push(socket);
    const packets: any[] = [];
    socket.on('message', (data) => packets.push(JSON.parse(data.toString())));
    socket.on('error', () => {});
    await new Promise<void>((resolve) => socket.once('open', resolve));
    const send = (type: string, data: Record<string, any> = {}) =>
        socket.send(JSON.stringify({ protocol: 1, type, ...data }));
    send('hello', {
        id,
        name: 'Test guest',
        version: appInfo.version,
        ...extra,
    });
    return { id, socket, packets, send };
}

function mockHttpRequest(
    url: string,
    method = 'GET',
    remoteAddress = '192.168.1.7',
) {
    return {
        method,
        url,
        headers: { host: `127.0.0.1:${service.port}` },
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
        return response;
    };
    response.destroy = vi.fn(() => response.emit('close'));
    return response;
}

async function handleHttp(
    pathname: string,
    method = 'GET',
    remoteAddress = '192.168.1.7',
) {
    const req = mockHttpRequest(pathname, method, remoteAddress);
    const res = mockHttpResponse();
    await (service as any).handleHttp(req, res);
    return { req, res };
}

const display = {
    id: 15,
    label: 'HDMI',
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    scaleFactor: 1,
    isPrimary: true,
};

test('reports small service changes and toggles virtual display sharing in place', async () => {
    expect(service.routerState).toBe('off');
    const retryMissing = vi.spyOn((service as any).tunnel, 'retryMissing');
    service.retryTunnel();
    expect(retryMissing).toHaveBeenCalledOnce();

    const main = { send: vi.fn() } as any;
    service.configure(main);
    service.sendDevicesChanged();
    expect(main.send).toHaveBeenCalledWith('mirror:devices-changed');

    const rebind = vi.spyOn(service as any, 'rebind');
    const onNetworkChanged = vi.fn();
    service.setVirtualDisplayHooks({
        route: vi.fn(),
        upgrade: vi.fn(),
        admits: vi.fn(() => true),
        onNetworkChanged,
    });
    await service.setVirtualDisplayShareEnabled(true);
    expect(service.isVirtualDisplayShareEnabled).toBe(true);
    expect(rebind).not.toHaveBeenCalled();
    expect(onNetworkChanged).toHaveBeenCalledOnce();

    await service.setVirtualDisplayShareEnabled(true);
    expect(onNetworkChanged).toHaveBeenCalledOnce();
});

test('locks a sender after five wrong codes and keeps correct codes locked until expiry', () => {
    const address = '203.0.113.40';
    expect(service.checkSenderCode(address, 'right-code', 'right-code')).toBe(
        'ok',
    );
    expect(service.checkSenderCode(address, null, 'guess')).toBe('wrong');
    expect(service.checkSenderCode(address, 'short', 'different-length')).toBe(
        'wrong',
    );
    expect(service.checkSenderCode(address, 'wrong', 'guess')).toBe('wrong');
    expect(service.checkSenderCode(address, 'wrong', 'guess')).toBe('wrong');
    expect(service.checkSenderCode(address, 'wrong', 'guess')).toBe('locked');
    expect(service.checkIsSenderLockedOut(address)).toBe(true);
    expect(service.checkSenderCode(address, 'right-code', 'right-code')).toBe(
        'locked',
    );

    const senderKey = (service as any).wrongCodes.keys().next().value;
    (service as any).wrongCodes.get(senderKey).since = 0;
    expect(service.checkIsSenderLockedOut(address)).toBe(false);
});

test('routes local screen messages through output context and identifies remote outputs', () => {
    const untouched = {
        screenId: 501,
        type: 'background',
        data: { type: 'color', src: '#ffffff' },
    } as any;
    expect(service.localMessage(untouched)).toBe(untouched);
    expect(service.isRemoteOutput(501)).toBe(false);

    const context = {
        screenId: 502,
        stage: 0,
        settings: {},
        resources: {},
        fontCss: '',
        isWindows: false,
        remote: false,
        isSoundOwner: false,
    };
    (service as any).outputs.set(502, {
        displayId: 15,
        scope: 'output:502',
        context,
    });
    const message = {
        screenId: 502,
        type: 'background',
        stage: 4,
        data: { type: 'color', src: '#ffffff' },
    } as any;
    expect(service.localMessage(message)).toMatchObject({ stage: 4 });
    expect(context.stage).toBe(4);

    (service as any).outputs.set(503, {
        displayId: -1_000_000,
        guestId: 'remote-guest',
        scope: 'output:503',
        context: { ...context, screenId: 503 },
    });
    expect(service.isRemoteOutput(503)).toBe(true);
});

test('rejects invalid QR input through the trusted command reply channel', async () => {
    const main = {
        getURL: () => 'owa://local/presenter.html',
        isDestroyed: () => false,
        send: vi.fn(),
    } as any;
    service.configure(main);

    ipc('mirror:command')(
        { sender: main },
        {
            action: 'qr',
            text: ' '.repeat(301),
            replyEventName: 'mirror:reply',
        },
    );

    await vi.waitFor(() => expect(main.send).toHaveBeenCalledOnce());
    expect(main.send).toHaveBeenCalledWith(
        'mirror:reply',
        expect.objectContaining({ message: 'Invalid host or port' }),
    );
});

test('returns a QR image for a plain host and port', async () => {
    const main = {
        getURL: () => 'owa://local/presenter.html',
        isDestroyed: () => false,
        send: vi.fn(),
    } as any;
    service.configure(main);

    ipc('mirror:command')(
        { sender: main },
        {
            action: 'qr',
            text: '192.168.1.8:39240',
            replyEventName: 'mirror:reply',
        },
    );

    await vi.waitFor(() => expect(main.send).toHaveBeenCalledOnce());
    expect(main.send).toHaveBeenCalledWith('mirror:reply', expect.any(Object));
});

test('keeps camera requests scoped to their host link and closes denied requests', () => {
    const socket = {
        readyState: WebSocket.OPEN,
        bufferedAmount: 0,
        send: vi.fn(),
        close: vi.fn(),
    } as any;
    const link = {
        connection: { id: 'link-a', status: 'connected' },
        shareCameras: false,
        socket,
    } as any;
    const sendBroker = vi
        .spyOn(service as any, 'sendBroker')
        .mockImplementation(() => {});
    const deliver = (packet: Record<string, unknown>) =>
        (service as any).deliverGuestCamera(link, packet);

    deliver({ type: 'camera-request' });
    expect(socket.send).not.toHaveBeenCalled();

    deliver({ type: 'camera-request', requestId: 'denied' });
    expect(JSON.parse(socket.send.mock.calls[0][0])).toMatchObject({
        type: 'camera-close',
        requestId: 'denied',
    });
    expect(sendBroker).not.toHaveBeenCalled();

    link.shareCameras = true;
    deliver({ type: 'camera-request', requestId: 'broker-request' });
    expect(sendBroker).toHaveBeenCalledWith({
        type: 'camera-request',
        requestId: 'broker-request',
    });
    expect((service as any).brokerLinks.get('broker-request')).toBe('link-a');

    for (let index = 0; index < 128; index++) {
        (service as any).brokerLinks.set(`occupied-${index}`, 'other-link');
    }
    deliver({ type: 'camera-request', requestId: 'over-capacity' });
    expect(sendBroker).toHaveBeenCalledTimes(1);
    for (let index = 0; index < 128; index++) {
        (service as any).brokerLinks.delete(`occupied-${index}`);
    }

    const consumers = (service as any).guestConsumers as Map<string, any>;
    consumers.set('consumer-request', {
        contentsId: 8,
        linkId: 'link-a',
    });
    link.connection.id = 'link-b';
    deliver({ type: 'camera-close', requestId: 'consumer-request' });
    expect(consumers.has('consumer-request')).toBe(true);
    link.connection.id = 'link-a';
    deliver({ type: 'camera-close', requestId: 'consumer-request' });
    expect(consumers.has('consumer-request')).toBe(false);
    deliver({ type: 'camera-close', requestId: 'broker-request' });
    expect((service as any).brokerLinks.has('broker-request')).toBe(false);

    const links = (service as any).links as Map<string, any>;
    links.set('camera-link', {
        connection: { id: 'camera-link', status: 'connected' },
        cameras: [{ deviceId: 'camera-1' }],
    });
    expect((service as any).cameraLinkFor({ id: 99 }, 'camera-1')).toBe(
        'camera-link',
    );
    links.clear();
    (service as any).incoming.set('host-screen', {
        contentsId: 99,
        linkId: 'incoming-link',
    });
    expect((service as any).cameraLinkFor({ id: 99 }, 'unknown-camera')).toBe(
        'incoming-link',
    );
});

test('sends camera and intercom packets through the broker and queues while it loads', () => {
    const broker = {
        isDestroyed: vi.fn(() => false),
        destroy: vi.fn(),
        webContents: {
            isLoading: vi.fn(() => false),
            once: vi.fn(),
            send: vi.fn(),
        },
    };
    (service as any).broker = broker;
    const ensureBroker = vi
        .spyOn(service as any, 'ensureBroker')
        .mockReturnValue(broker);
    const scheduleRelease = vi
        .spyOn(service as any, 'scheduleBrokerRelease')
        .mockImplementation(() => {});
    const sendBroker = (service as any).sendBroker.bind(service);
    const sendIntercom = (service as any).sendBrokerIntercom.bind(service);

    const request = { type: 'camera-request', requestId: 'request-1' };
    sendBroker(request);
    expect(ensureBroker).toHaveBeenCalledOnce();
    expect((service as any).brokerRequests.has('request-1')).toBe(true);
    expect(broker.webContents.send).toHaveBeenCalledWith(
        'mirror:camera',
        request,
    );

    let finishLoad: (() => void) | undefined;
    broker.webContents.isLoading.mockReturnValue(true);
    broker.webContents.once.mockImplementation((_event, callback) => {
        finishLoad = callback;
    });
    const signal = { type: 'camera-signal', requestId: 'request-1' };
    sendBroker(signal);
    expect(broker.webContents.once).toHaveBeenCalledWith(
        'did-finish-load',
        expect.any(Function),
    );
    finishLoad?.();
    expect(broker.webContents.send).toHaveBeenLastCalledWith(
        'mirror:camera',
        signal,
    );

    broker.webContents.isLoading.mockReturnValue(false);
    const config = { type: 'config', speakers: {} };
    sendIntercom(config);
    expect(broker.webContents.send).toHaveBeenLastCalledWith(
        'mirror:intercom',
        config,
    );
    const audio = { type: 'audio', key: 'guest:g', data: new Uint8Array([1]) };
    sendIntercom(audio);
    expect(broker.webContents.send).toHaveBeenLastCalledWith(
        'mirror:intercom',
        audio,
    );

    broker.webContents.isLoading.mockReturnValue(true);
    (service as any).brokerRequests.add('intercom');
    const activeConfig = { type: 'config', isMicOn: true, speakers: {} };
    sendIntercom(activeConfig);
    finishLoad?.();
    expect(broker.webContents.send).toHaveBeenLastCalledWith(
        'mirror:intercom',
        activeConfig,
    );

    sendBroker({ type: 'camera-close', requestId: 'request-1' });
    expect((service as any).brokerRequests.has('request-1')).toBe(false);
    expect(scheduleRelease).not.toHaveBeenCalled();

    (service as any).brokerRequests.delete('intercom');
    (service as any).brokerRequests.add('request-2');
    sendBroker({ type: 'camera-close', requestId: 'request-2' });
    expect(scheduleRelease).toHaveBeenCalled();
});

test('releases camera routes owned by a closing host link', () => {
    const broker = {
        isDestroyed: vi.fn(() => false),
        destroy: vi.fn(),
        webContents: { send: vi.fn() },
    };
    (service as any).broker = broker;
    const scheduleRelease = vi
        .spyOn(service as any, 'scheduleBrokerRelease')
        .mockImplementation(() => {});
    const consumers = (service as any).guestConsumers as Map<string, any>;
    const brokerLinks = (service as any).brokerLinks as Map<string, string>;
    const brokerRequests = (service as any).brokerRequests as Set<string>;
    consumers.set('consumer-1', { contentsId: 88, linkId: 'link-a' });
    consumers.set('consumer-2', { contentsId: 89, linkId: 'link-b' });
    brokerLinks.set('broker-1', 'link-a');
    brokerLinks.set('broker-2', 'link-b');
    brokerRequests.add('broker-1');
    brokerRequests.add('intercom');

    (service as any).closeLinkCameras('link-a');

    expect(consumers.has('consumer-1')).toBe(false);
    expect(consumers.has('consumer-2')).toBe(true);
    expect(brokerLinks.has('broker-1')).toBe(false);
    expect(brokerLinks.has('broker-2')).toBe(true);
    expect(brokerRequests.has('broker-1')).toBe(false);
    expect(brokerRequests.has('intercom')).toBe(true);
    expect(broker.webContents.send).toHaveBeenCalledWith('mirror:camera', {
        type: 'camera-close',
        requestId: 'broker-1',
    });
    expect(scheduleRelease).not.toHaveBeenCalled();
});

test('counts connections before hello and releases capacity on transport close', async () => {
    const open = () =>
        new Promise<WebSocket | null>((resolve) => {
            const socket = new WebSocket(
                `${service.baseUrl.replace('http:', 'ws:')}/mirror`,
            );
            sockets.push(socket);
            socket.once('open', () => resolve(socket));
            socket.on('error', () => resolve(null));
        });
    const waiting = await Promise.all(Array.from({ length: 32 }, open));
    expect(waiting.every(Boolean)).toBe(true);
    expect(service.state().pending).toHaveLength(0);
    expect(await open()).toBeNull();
    waiting[0]!.terminate();
    await vi.waitFor(() =>
        expect(waiting[0]!.readyState).toBe(WebSocket.CLOSED),
    );
    // Let the server process the opposite end's close as well.
    await new Promise((resolve) => setTimeout(resolve, 30));
    const replacement = await open();
    expect(replacement).not.toBeNull();
    for (const socket of [...waiting.slice(1), replacement]) {
        socket!.send(
            JSON.stringify({
                protocol: 1,
                type: 'hello',
                id: randomUUID(),
                name: 'Local guest',
                version: appInfo.version,
            }),
        );
    }
    // LAN peers retain the documented allowance: no internet-only cap of 8.
    await vi.waitFor(() => expect(service.state().pending).toHaveLength(32));
    expect(await open()).toBeNull();
});

test('discovery validates both replies and never lets a remote field replace the verified address', async () => {
    const scanSocket = new EventEmitter() as any;
    scanSocket.bind = vi.fn();
    scanSocket.close = vi.fn();
    const responses: { req: any; reply: (value: any) => void }[] = [];
    const udp = vi.spyOn(dgram, 'createSocket').mockReturnValue(scanSocket);
    const get = vi.spyOn(http, 'get').mockImplementation((...args: any[]) => {
        const req = new EventEmitter() as any;
        req.destroy = vi.fn();
        responses.push({
            req,
            reply: (value) => {
                const res = new EventEmitter();
                args[2](res);
                res.emit('data', JSON.stringify(value));
                res.emit('end');
            },
        });
        return req;
    });
    const valid = {
        service: 'owa-screen-mirror',
        protocol: 1,
        id: randomUUID(),
        name: 'Valid host',
        version: appInfo.version,
        port: 42000,
    };
    const scan = service.rescan();
    try {
        const announce = (value: any) =>
            scanSocket.emit('message', Buffer.from(JSON.stringify(value)), {
                address: '192.168.1.20',
            });
        announce({ ...valid, name: {} });
        expect(responses).toHaveLength(0);
        announce(valid);
        responses
            .at(-1)!
            .reply({ ...valid, host: 'untrusted.example', extra: true });
        for (const change of [
            { name: null },
            { name: {} },
            { version: 'incompatible' },
            { protocol: 2 },
            { port: 0 },
            { port: 42001 },
        ]) {
            const candidate = {
                ...valid,
                id: randomUUID(),
                port: 43000 + responses.length,
            };
            announce(candidate);
            responses.at(-1)!.reply({ ...candidate, ...change });
        }
        // Completes the same scan path as its timer, without network broadcasts.
        expect(() =>
            scanSocket.emit('error', new Error('End scan')),
        ).not.toThrow();
        expect(await scan).toEqual([{ ...valid, host: '192.168.1.20' }]);
    } finally {
        try {
            scanSocket.emit('error', new Error('End scan'));
        } catch {}
        udp.mockRestore();
        get.mockRestore();
    }
});

test('approval gates displays; HTTP output grants are revoked and resumed guests stay hidden', async () => {
    const client = await guest();
    await vi.waitFor(() => expect(service.state().pending).toHaveLength(1));
    client.send('inventory', { displays: [display], cameras: [] });
    expect(service.displays()).toEqual([]);
    service.approve(client.id);
    await vi.waitFor(() =>
        expect(
            client.packets.some((packet) => packet.type === 'approved'),
        ).toBe(true),
    );
    const approved = client.packets.find(
        (packet) => packet.type === 'approved',
    );
    client.send('inventory', { displays: [display], cameras: [] });
    await vi.waitFor(() => expect(service.displays()).toHaveLength(1));
    const remote = service.displays()[0];
    expect(remote).toMatchObject({ id: -1000000, label: 'a1', localId: 15 });
    const file = path.join(directory, 'រូប #1.png');
    await writeFile(file, 'host picture');
    const main = new EventEmitter() as any;
    main.isDestroyed = () => false;
    main.getURL = () => 'owa://local/presenter.html';
    main.send = (channel: string, data: any) => {
        if (channel === 'mirror:bootstrap-request')
            ipc('mirror:bootstrap')(
                { sender: main },
                {
                    ...data,
                    stage: 2,
                    isWindows: process.platform === 'win32',
                    remote: false,
                    settings: {},
                    resources: {},
                    fontCss: '',
                    messages: [
                        {
                            screenId: 0,
                            type: 'background',
                            data: { type: 'image', src: file },
                        },
                    ],
                },
            );
    };
    service.configure(main);
    await service.prepareOutput(0, remote.id);
    expect(service.retargetOutput(0, 1)).toBe(false);
    // Shown on the guest, with no screen window here: the presenting
    // computer is kept awake for it.
    expect(fixture.powerSaveBlocker.start).toHaveBeenCalledWith(
        'prevent-display-sleep',
    );
    expect(fixture.powerSaveBlocker.stop).not.toHaveBeenCalled();
    await vi.waitFor(() =>
        expect(client.packets.some((packet) => packet.type === 'show')).toBe(
            true,
        ),
    );
    const output = client.packets.find((packet) => packet.type === 'show');
    const url = output.context.messages[0].data.src;
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/content\//);
    expect(await (await fetch(url)).text()).toBe('host picture');
    const response = await fetch(url, { method: 'HEAD' });
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(
        (await fetch(service.baseUrl + '/screen.html', { method: 'POST' }))
            .status,
    ).toBe(405);
    client.socket.terminate();
    await vi.waitFor(() => expect(service.state().guests).toHaveLength(0));
    expect(service.showingIds()).toEqual([]);
    expect(fixture.powerSaveBlocker.stop).toHaveBeenCalledTimes(1);
    expect((await fetch(url)).status).toBe(404);
    const resumed = await guest(client.id, { resume: approved.resume });
    await vi.waitFor(() => expect(service.state().guests).toHaveLength(1));
    resumed.send('inventory', { displays: [display], cameras: [] });
    await vi.waitFor(() => expect(service.displays()).toHaveLength(1));
    expect(service.displays()[0]).toMatchObject({ id: remote.id, label: 'a1' });
    expect(service.showingIds()).toEqual([]);
    expect(resumed.packets.some((packet) => packet.type === 'show')).toBe(
        false,
    );
});

test('code access rejects a wrong code and browser-origin WebSockets', async () => {
    fixture.client.set('screen-mirror-mode', 'code');
    fixture.secure.set('screen-mirror-code', 'test-code');
    const wrong = await guest(undefined, { code: 'wrong' });
    await vi.waitFor(() =>
        expect(wrong.packets.some((packet) => packet.type === 'error')).toBe(
            true,
        ),
    );
    expect(service.state().guests).toHaveLength(0);
    const right = await guest(undefined, { code: 'test-code' });
    await vi.waitFor(() => expect(service.state().guests).toHaveLength(1));
    await vi.waitFor(() =>
        expect(
            right.packets.find((packet) => packet.type === 'approved'),
        ).toMatchObject({ prefix: 'a1' }),
    );
    const browser = new WebSocket(
        `${service.baseUrl.replace('http:', 'ws:')}/mirror`,
        { origin: 'http://untrusted.example' },
    );
    sockets.push(browser);
    const opened = vi.fn();
    browser.on('open', opened);
    await new Promise<void>((resolve) =>
        browser.once('error', () => resolve()),
    );
    expect(opened).not.toHaveBeenCalled();
});

test('camera signaling is scoped to its approved source and consumer', async () => {
    const source = await guest();
    const consumer = await guest();
    const unrelated = await guest();
    await vi.waitFor(() => expect(service.state().pending).toHaveLength(3));
    for (const client of [source, consumer, unrelated])
        service.approve(client.id);
    source.send('inventory', {
        displays: [display],
        cameras: [{ deviceId: 'native-camera', label: 'Front camera' }],
    });
    await vi.waitFor(() => expect(service.cameras()).toHaveLength(1));
    const requestId = randomUUID();
    consumer.send('camera-request', {
        requestId,
        deviceId: service.cameras()[0].deviceId,
    });
    await vi.waitFor(() =>
        expect(
            source.packets.find((packet) => packet.type === 'camera-request'),
        ).toMatchObject({ requestId, deviceId: 'native-camera' }),
    );
    unrelated.send('camera-signal', {
        requestId,
        description: { type: 'offer', sdp: 'not authorized' },
    });
    source.send('camera-signal', {
        requestId,
        description: { type: 'offer', sdp: 'authorized' },
    });
    await vi.waitFor(() =>
        expect(
            consumer.packets.find((packet) => packet.type === 'camera-signal'),
        ).toMatchObject({ description: { sdp: 'authorized' } }),
    );
    expect(
        consumer.packets.some(
            (packet) => packet.description?.sdp === 'not authorized',
        ),
    ).toBe(false);
    source.socket.terminate();
    await vi.waitFor(() =>
        expect(
            consumer.packets.some(
                (packet) =>
                    packet.type === 'camera-close' &&
                    packet.requestId === requestId,
            ),
        ).toBe(true),
    );
});

test('renderer camera IPC validates senders and closes routes when a window goes away', () => {
    const sendBroker = vi
        .spyOn(service as any, 'sendBroker')
        .mockImplementation(function () {});
    const renderer = {
        id: 77,
        getURL: () => 'owa://local/presenter.html',
        once: vi.fn(),
        send: vi.fn(),
    };
    const untrusted = {
        ...renderer,
        id: 78,
        getURL: () => 'https://outside.example/presenter.html',
    };
    const requestId = randomUUID();
    const request = {
        type: 'camera-request',
        requestId,
        deviceId: `mirror-camera:${service.id}:front-camera`,
    };

    ipc('mirror:camera-send')({ sender: untrusted }, request);
    ipc('mirror:camera-send')({ sender: renderer }, { type: 'audio' });
    expect(sendBroker).not.toHaveBeenCalled();

    ipc('mirror:camera-send')({ sender: renderer }, request);
    expect(sendBroker).toHaveBeenLastCalledWith({
        ...request,
        deviceId: 'front-camera',
    });
    expect((service as any).cameraRoutes.has(requestId)).toBe(true);

    const signal = {
        type: 'camera-signal',
        requestId,
        candidate: { candidate: 'candidate:1' },
    };
    ipc('mirror:camera-send')({ sender: { ...renderer, id: 88 } }, signal);
    expect(sendBroker).toHaveBeenCalledTimes(1);
    ipc('mirror:camera-send')({ sender: renderer }, signal);
    expect(sendBroker).toHaveBeenLastCalledWith(signal);

    ipc('mirror:camera-send')(
        { sender: renderer },
        {
            type: 'camera-close',
            requestId,
        },
    );
    expect((service as any).cameraRoutes.has(requestId)).toBe(false);

    const lingeringId = randomUUID();
    ipc('mirror:camera-send')(
        { sender: renderer },
        {
            ...request,
            requestId: lingeringId,
        },
    );
    const destroyed = renderer.once.mock.calls.find(
        ([eventName]) => eventName === 'destroyed',
    )?.[1] as (() => void) | undefined;
    expect(destroyed).toBeDefined();
    destroyed!();
    expect((service as any).cameraRoutes.has(lingeringId)).toBe(false);
    expect(sendBroker).toHaveBeenLastCalledWith({
        type: 'camera-close',
        requestId: lingeringId,
    });
});

test('viewer camera routes stay paired with their approved source and close on either side', () => {
    const sendBroker = vi
        .spyOn(service as any, 'sendBroker')
        .mockImplementation(function () {});
    const viewerSink = vi.fn();
    service.setViewerCameraSink(viewerSink);
    const viewer = 'vd:viewer-1:15';
    const requestId = randomUUID();
    const request = {
        type: 'camera-request',
        requestId,
        deviceId: `mirror-camera:${service.id}:front-camera`,
    };

    service.routeViewerCamera(viewer, { ...request, requestId: 'invalid' });
    service.routeViewerCamera(viewer, {
        ...request,
        deviceId: 'not-a-mirror-camera-id',
    });
    expect(sendBroker).not.toHaveBeenCalled();

    service.routeViewerCamera(viewer, request);
    expect(sendBroker).toHaveBeenCalledWith({
        ...request,
        deviceId: 'front-camera',
    });
    // A duplicate request cannot replace the route's original source.
    service.routeViewerCamera(viewer, {
        ...request,
        deviceId: `mirror-camera:${randomUUID()}:other-camera`,
    });
    expect(sendBroker).toHaveBeenCalledTimes(1);

    const signal = { type: 'camera-signal', requestId, candidate: 'local' };
    service.routeViewerCamera('broker', signal);
    expect(viewerSink).toHaveBeenLastCalledWith(viewer, signal);
    service.routeViewerCamera('unrelated-peer', {
        ...signal,
        candidate: 'crossed',
    });
    expect(viewerSink).toHaveBeenCalledTimes(1);

    service.closeViewerCameras(viewer);
    expect(viewerSink).toHaveBeenLastCalledWith(viewer, {
        type: 'camera-close',
        requestId,
    });
    expect(sendBroker).toHaveBeenLastCalledWith({
        type: 'camera-close',
        requestId,
    });
    expect((service as any).cameraRoutes.has(requestId)).toBe(false);
});

test('registered viewer intercom peers receive state and audio until forgotten', async () => {
    const sent: { id: string; type: string; data: Record<string, unknown> }[] =
        [];
    const changed = vi.fn();
    const sendBrokerIntercom = vi
        .spyOn(service as any, 'sendBrokerIntercom')
        .mockImplementation(function () {});
    service.registerIntercomPeers('viewer', {
        has: (id) => id === 'browser-1',
        send: (id, type, data) => sent.push({ id, type, data }),
        onChanged: changed,
    });

    await service.setIntercom('viewer:browser-1', {
        mic: true,
        speaker: true,
        volume: 0.25,
    });
    expect(sent).toEqual([
        {
            id: 'browser-1',
            type: 'intercom-state',
            data: { mic: true },
        },
    ]);
    expect(service.intercomStateOf('viewer:browser-1')).toEqual({
        mic: true,
        speaker: true,
        volume: 0.25,
        remoteMic: false,
    });
    expect(changed).toHaveBeenCalledTimes(1);

    service.receiveIntercom('viewer:browser-1', {
        type: 'intercom-state',
        mic: true,
    });
    service.receiveIntercom('viewer:browser-1', {
        type: 'audio',
        data: 'AQID',
    });
    expect(service.intercomStateOf('viewer:browser-1').remoteMic).toBe(true);
    expect(sendBrokerIntercom).toHaveBeenCalledWith({
        type: 'audio',
        key: 'viewer:browser-1',
        data: new Uint8Array([1, 2, 3]),
    });
    await expect(
        service.setIntercom('viewer:missing', { mic: true }),
    ).rejects.toThrow('Connection failed');
    await expect(
        service.setIntercom('unknown:peer', { mic: true }),
    ).rejects.toThrow('Connection failed');

    service.forgetIntercom('viewer:browser-1');
    expect(service.intercomStateOf('viewer:browser-1')).toEqual({
        mic: false,
        speaker: false,
        volume: 1,
        remoteMic: false,
    });
});

test('camera inventory adds registered browser sources only for trusted windows', () => {
    const source = vi.fn(() => [
        { deviceId: 'viewer:browser-1:camera', label: 'Browser camera' },
    ]);
    service.registerCameraSource(source);
    service.registerCameraSource(source);
    const trusted = {
        getURL: () => 'owa://local/virtual-display-viewer.html',
    };
    const untrusted = {
        getURL: () => 'https://outside.example/virtual-display-viewer.html',
    };
    const readCameras = (sender: unknown) => {
        const event: any = { sender };
        ipc('mirror:cameras')(event);
        return event.returnValue;
    };

    expect(readCameras(trusted)).toEqual([
        { deviceId: 'viewer:browser-1:camera', label: 'Browser camera' },
    ]);
    expect(source).toHaveBeenCalledTimes(1);
    expect(readCameras(untrusted)).toEqual([]);
    expect(source).toHaveBeenCalledTimes(1);
});

test('a superseded initialization cannot revoke the replacement output', async () => {
    const client = await guest();
    await vi.waitFor(() => expect(service.state().pending).toHaveLength(1));
    service.approve(client.id);
    client.send('inventory', { displays: [display], cameras: [] });
    await vi.waitFor(() => expect(service.displays()).toHaveLength(1));
    const requests: any[] = [];
    const main = new EventEmitter() as any;
    main.isDestroyed = () => false;
    main.getURL = () => 'owa://local/presenter.html';
    main.send = (channel: string, data: any) => {
        if (channel === 'mirror:bootstrap-request') requests.push(data);
    };
    service.configure(main);
    const first = service
        .prepareOutput(0, service.displays()[0].id)
        .catch((error) => error);
    const second = service.prepareOutput(0, service.displays()[0].id);
    expect(requests).toHaveLength(2);
    const respond = (index: number) =>
        ipc('mirror:bootstrap')(
            { sender: main },
            {
                ...requests[index],
                stage: 0,
                settings: {},
                resources: {},
                fontCss: '',
                messages: [],
                isWindows: process.platform === 'win32',
                remote: false,
            },
        );
    respond(1);
    expect(await second).toBe(true);
    respond(0);
    expect(await first).toBeInstanceOf(Error);
    expect(service.showingIds()).toEqual([0]);
});

test('hosting is off until switched on, and switching it off ends guests', async () => {
    service.stop();
    fixture.client.delete('screen-mirror-host');
    // A port of its own: keeping the port across the switch is only possible
    // when no other app on this machine has taken it in between.
    const probe = net.createServer();
    await new Promise<void>((resolve) => probe.listen(0, '0.0.0.0', resolve));
    const freePort = (probe.address() as net.AddressInfo).port;
    await new Promise<void>((resolve) => probe.close(() => resolve()));
    fixture.client.set('screen-mirror-port', String(freePort));
    service = new ScreenMirrorService();
    await service.start();
    expect(service.state().hostEnabled).toBe(false);
    const discoveryUrl = () => `${service.baseUrl}/discovery`;
    // Off: the server is loopback-only, answers no discovery and takes no guest.
    expect((await fetch(discoveryUrl())).status).toBe(404);
    const refused = new WebSocket(
        `${service.baseUrl.replace('http:', 'ws:')}/mirror`,
    );
    sockets.push(refused);
    await new Promise<void>((resolve) =>
        refused.once('error', () => resolve()),
    );
    const port = service.port;
    ipc('mirror:command')(
        {
            sender: {
                getURL: () => 'owa://local/presenter.html',
                isDestroyed: () => false,
                send: vi.fn(),
            },
        },
        { action: 'host', enabled: true },
    );
    await vi.waitFor(() => expect(service.state().hostEnabled).toBe(true));
    await vi.waitFor(async () =>
        expect((await fetch(discoveryUrl())).status).toBe(200),
    );
    expect(service.port).toBe(port);
    const client = await guest();
    await vi.waitFor(() => expect(service.state().pending).toHaveLength(1));
    await service.setHostEnabled(false);
    expect(service.state().hostEnabled).toBe(false);
    await vi.waitFor(() =>
        expect(
            client.packets.find((packet) => packet.type === 'error'),
        ).toMatchObject({ error: 'Disconnected by host' }),
    );
    await vi.waitFor(() => expect(service.state().pending).toHaveLength(0));
    expect((await fetch(discoveryUrl())).status).toBe(404);
});

test('presenter commands save connection settings and reject an invalid port', async () => {
    const sender = {
        getURL: () => 'owa://local/presenter.html',
        isDestroyed: () => false,
        send: vi.fn(),
    };
    const command = (data: Record<string, unknown>) =>
        new Promise<any>((resolve) => {
            sender.send.mockImplementationOnce((_channel, result) =>
                resolve(result),
            );
            ipc('mirror:command')(
                { sender },
                { ...data, replyEventName: 'reply' },
            );
        });

    const configured = await command({
        action: 'settings',
        mode: 'code',
        code: ' 4321 ',
        port: service.port,
        publicAddress: 'church.example',
    });
    expect(configured.approvalMode).toBe('code');
    expect(fixture.client.get('screen-mirror-mode')).toBe('code');
    expect(fixture.secure.get('screen-mirror-code')).toBe('4321');
    expect(fixture.client.get('screen-mirror-public-address')).toBe(
        'church.example',
    );

    await command({ action: 'public-port', port: 40500 });
    expect(service.publicPort).toBe(40500);
    const invalid = await command({ action: 'public-port', port: 70000 });
    expect(invalid).toBeInstanceOf(Error);
    expect(service.publicPort).toBe(40500);
    await command({ action: 'custom-port', port: null });
    expect(fixture.client.get('screen-mirror-port')).toBe('');
    await command({ action: 'public-address', text: 'display.example' });
    expect(fixture.client.get('screen-mirror-public-address')).toBe(
        'display.example',
    );

    const untrusted = {
        ...sender,
        getURL: () => 'https://untrusted.example',
        send: vi.fn(),
    };
    ipc('mirror:command')(
        { sender: untrusted },
        { action: 'settings', mode: 'approve', replyEventName: 'reply' },
    );
    await Promise.resolve();
    expect(untrusted.send).not.toHaveBeenCalled();
    expect(fixture.client.get('screen-mirror-mode')).toBe('code');
});

// Plays the presenter: answers each output's bootstrap with `messages`, and
// keeps everything else the host sends it in `sent`.
function answerBootstraps(host: ScreenMirrorService, messages: any[] = []) {
    const main = new EventEmitter() as any;
    const sent: [string, any][] = [];
    main.sent = sent;
    main.isDestroyed = () => false;
    main.getURL = () => 'owa://local/presenter.html';
    main.send = (channel: string, data: any) => {
        sent.push([channel, data]);
        if (channel === 'mirror:bootstrap-request')
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
                    messages: messages.map((message) => ({
                        ...message,
                        screenId: data.screenId,
                    })),
                },
            );
    };
    host.configure(main);
    return main as { sent: [string, any][] };
}

test('a guest’s files load from the address it dialled, not the card it came in on', async () => {
    // Behind a router, the guest dials the router's public side; the
    // connection arrives on this computer's LAN card.
    const client = await guest(
        undefined,
        {},
        { headers: { host: 'church.example:40001' } },
    );
    await vi.waitFor(() => expect(service.state().pending).toHaveLength(1));
    expect(service.state().pending[0]).toMatchObject({
        address: '127.0.0.1',
        network: 'local',
    });
    service.approve(client.id);
    client.send('inventory', { displays: [display], cameras: [] });
    await vi.waitFor(() => expect(service.displays()).toHaveLength(1));
    const file = path.join(directory, 'slide.png');
    await writeFile(file, 'host picture');
    answerBootstraps(service, [
        { type: 'background', data: { type: 'image', src: file } },
    ]);
    await service.prepareOutput(0, service.displays()[0].id);
    await vi.waitFor(() =>
        expect(client.packets.some((packet) => packet.type === 'show')).toBe(
            true,
        ),
    );
    const url = client.packets.find((packet) => packet.type === 'show').context
        .messages[0].data.src;
    expect(url).toMatch(/^http:\/\/church\.example:40001\/content\//);
    const response = await fetch(`${service.baseUrl}${new URL(url).pathname}`);
    expect(await response.text()).toBe('host picture');
});

async function holdFreePort() {
    const holder = net.createServer();
    await new Promise<void>((resolve) => holder.listen(0, resolve));
    const port = (holder.address() as net.AddressInfo).port;
    const release = () =>
        new Promise<void>((resolve) => holder.close(() => resolve()));
    return { port, release };
}

// Every TV, bookmark and printed QR code holds the address the last launch
// had. A restart found it still held by the closing copy and moved on at once:
// seen 39240, 39241, 39240 on three restarts, every viewer on a dead address.
test('a restart waits for its port instead of moving to the next one', async () => {
    const { port, release } = await holdFreePort();
    fixture.client.set('screen-mirror-port', '');
    fixture.client.set('screen-mirror-last-port', String(port));
    const restarted = new ScreenMirrorService();
    setTimeout(() => void release(), 600);
    try {
        await restarted.start();
        expect(restarted.port).toBe(port);
    } finally {
        restarted.stop();
    }
});

// Windows lets a loopback bind share a port another process holds on every
// network: a second copy of the app took the first one's port, and loopback
// -- its screen windows, this computer's viewers -- went to the wrong app.
test('a port another app answers on is not shared, even bound to loopback', async () => {
    const holder = net.createServer();
    await new Promise<void>((resolve) => holder.listen(0, '0.0.0.0', resolve));
    const { port } = holder.address() as net.AddressInfo;
    try {
        // Hosting off: this copy binds 127.0.0.1 only.
        fixture.client.set('screen-mirror-host', '');
        fixture.client.set('screen-mirror-port', '');
        fixture.client.set('screen-mirror-last-port', String(port));
        const second = new ScreenMirrorService();
        try {
            await second.start();
            expect(second.port).not.toBe(port);
            expect(second.port).toBeGreaterThan(0);
        } finally {
            second.stop();
        }
    } finally {
        await new Promise<void>((resolve) => holder.close(() => resolve()));
    }
}, 15000);

test('a held custom port is waited for, then reported', async () => {
    const { port, release } = await holdFreePort();
    fixture.client.set('screen-mirror-port', String(port));
    const waited = new ScreenMirrorService();
    setTimeout(() => void release(), 600);
    try {
        await waited.start();
        expect(waited.port).toBe(port);
        expect(waited.state().error ?? null).toBeNull();
    } finally {
        waited.stop();
    }
});

// A document's blank first slide is `/assets/blank.png`, an address of the
// app's page. Taken for a disk path (`C:\assets\blank.png`), it was published
// as a file that is not there: a 404 and a broken picture on every guest and
// virtual display.
test('the app’s own page-relative files are published from the app', async () => {
    const client = await guest();
    await vi.waitFor(() => expect(service.state().pending).toHaveLength(1));
    service.approve(client.id);
    client.send('inventory', { displays: [display], cameras: [] });
    await vi.waitFor(() => expect(service.displays()).toHaveLength(1));
    answerBootstraps(service, [
        {
            type: 'slide',
            data: { imagePreviewSrc: '/assets/blank.png' },
        },
    ]);
    await service.prepareOutput(0, service.displays()[0].id);
    await vi.waitFor(() =>
        expect(client.packets.some((packet) => packet.type === 'show')).toBe(
            true,
        ),
    );
    const src = client.packets.find((packet) => packet.type === 'show').context
        .messages[0].data.imagePreviewSrc;
    expect(src).toMatch(/\/content\/[a-f0-9]{48}\/[a-f0-9]{24}\/blank\.png$/);
    const published = Object.keys(service.getOutputContext(0)!.resources);
    expect(published).toContain(
        path.join(process.cwd(), 'dist', 'assets', 'blank.png'),
    );
    expect(published).not.toContain(path.resolve('/assets/blank.png'));
});

// The address rewriting rebuilt every object from its own fields, and a Date
// has none: a running stopwatch reached the guest as `dateTime: {}` and drew
// 00:00:00 for good.
test('a running clock reaches a guest with its start time', async () => {
    const client = await guest();
    await vi.waitFor(() => expect(service.state().pending).toHaveLength(1));
    service.approve(client.id);
    client.send('inventory', { displays: [display], cameras: [] });
    await vi.waitFor(() => expect(service.displays()).toHaveLength(1));
    const startedAt = new Date('2026-10-07T20:00:00.000Z');
    answerBootstraps(service, [
        {
            type: 'foreground',
            data: { stopwatchData: { dateTime: startedAt } },
        },
    ]);
    await service.prepareOutput(0, service.displays()[0].id);
    await vi.waitFor(() =>
        expect(client.packets.some((packet) => packet.type === 'show')).toBe(
            true,
        ),
    );
    const { dateTime } = client.packets.find((packet) => packet.type === 'show')
        .context.messages[0].data.stopwatchData;
    expect(new Date(dateTime).getTime()).toBe(startedAt.getTime());
});

test('five wrong codes lock the sender out, even with the right code', async () => {
    fixture.client.set('screen-mirror-mode', 'code');
    fixture.secure.set('screen-mirror-code', 'right');
    const errorOf = async (code: string) => {
        const client = await guest(undefined, { code });
        await vi.waitFor(() =>
            expect(
                client.packets.some((packet) => packet.type === 'error'),
            ).toBe(true),
        );
        return client.packets.find((packet) => packet.type === 'error').error;
    };
    for (let i = 0; i < 5; i++)
        expect(await errorOf('wrong')).toBe('Connection code is incorrect');
    expect(await errorOf('right')).toBe(
        'Too many wrong codes. Try again later.',
    );
    expect(service.state().guests).toHaveLength(0);
});

test('opening to the internet asks the router, and closing it removes the mapping', async () => {
    const gateway = {
        controlUrl: 'http://192.168.1.1:5000/ctl',
        serviceType: 'urn:schemas-upnp-org:service:WANIPConnection:1',
        localAddress: '192.168.1.3',
    };
    const mapping = {
        ...gateway,
        externalAddress: '203.0.113.10',
        externalPort: 40001,
        internalPort: service.port,
        leaseSeconds: 3600,
    };
    vi.mocked(findRouterGateway).mockResolvedValue(gateway);
    vi.mocked(getRouterExternalAddress).mockResolvedValue('203.0.113.10');
    vi.mocked(openRouterPort).mockResolvedValue(mapping);
    expect(service.state()).toMatchObject({
        internetEnabled: false,
        router: 'off',
    });
    await service.setInternetEnabled(true);
    await vi.waitFor(() => expect(service.state().router).toBe('open'));
    expect(service.state().addresses).toContainEqual({
        host: '203.0.113.10',
        port: 40001,
        kind: 'router',
    });
    expect(
        JSON.parse(fixture.client.get('screen-mirror-router-mapping')!),
    ).toMatchObject({ externalPort: 40001 });
    service.setPublicAddress('church.example');
    expect(service.state().addresses).toContainEqual({
        host: 'church.example',
        port: 40001,
        kind: 'typed',
    });
    expect(() => service.setPublicAddress('not an address')).toThrow(
        'Invalid host or port',
    );
    await service.setInternetEnabled(false);
    expect(closeRouterPort).toHaveBeenCalledWith(mapping);
    expect(service.state().router).toBe('off');
    expect(
        service.state().addresses.every((address) => address.kind === 'lan'),
    ).toBe(true);
    expect(fixture.client.get('screen-mirror-router-mapping')).toBe('');
    // A router whose own public side is carrier NAT cannot be reached.
    vi.mocked(getRouterExternalAddress).mockResolvedValue('100.70.1.2');
    await service.setInternetEnabled(true);
    await vi.waitFor(() => expect(service.state().router).toBe('shared'));
    expect(openRouterPort).toHaveBeenCalledTimes(1);
});

test('without an opened port the public address is still listed, on the chosen public port', async () => {
    const gateway = {
        controlUrl: 'http://192.168.1.1:5000/ctl',
        serviceType: 'urn:schemas-upnp-org:service:WANIPConnection:1',
        localAddress: '192.168.1.3',
    };
    // No router answers: a lookup site is asked.
    vi.mocked(lookUpPublicAddress).mockResolvedValue('198.51.100.20');
    await service.setInternetEnabled(true);
    await vi.waitFor(() => {
        expect(service.state().router).toBe('unavailable');
    });
    expect(service.state().addresses).toContainEqual({
        host: '198.51.100.20',
        port: service.port,
        kind: 'public',
    });
    // A router that tells its address but opens no port is believed over
    // the lookup site, and the chosen public port is what is listed.
    vi.mocked(findRouterGateway).mockResolvedValue(gateway);
    vi.mocked(getRouterExternalAddress).mockResolvedValue('203.0.113.10');
    vi.mocked(openRouterPort).mockRejectedValue(new Error('refused'));
    expect(() => service.setPublicPort(70000)).toThrow('Invalid port');
    service.setPublicPort(40500);
    await vi.waitFor(() => expect(service.state().router).toBe('refused'));
    expect(service.state()).toMatchObject({ publicPort: 40500 });
    expect(service.state().addresses).toContainEqual({
        host: '203.0.113.10',
        port: 40500,
        kind: 'public',
    });
    expect(vi.mocked(openRouterPort).mock.lastCall?.[3]).toMatchObject({
        preferredPort: 40500,
    });
    expect(lookUpPublicAddress).toHaveBeenCalledTimes(1);
    // Off forgets it.
    await service.setInternetEnabled(false);
    expect(
        service.state().addresses.some((address) => {
            return address.kind === 'public';
        }),
    ).toBe(false);
});

// A file a window of this computer asks for on demand joins the screen's
// state. A virtual display's state is also what browsers elsewhere draw from,
// so it keeps the path alone: an absolute 127.0.0.1 address sent a slide's
// picture to every viewer's own device (seen through the tunnel).
test('a virtual display keeps on-demand files relative; a screen window gets its address', () => {
    const output = (displayId: number) => ({
        displayId,
        scope: service.content.createScope(),
        context: { screenId: 0, resources: {} as Record<string, string> },
    });
    const outputs = (service as any).outputs as Map<number, any>;
    outputs.set(7, output(toVirtualDisplayId(1)));
    outputs.set(8, output(1));
    const picture = path.join(directory, 'slide', 'media', 'image1.jpg');
    const forWindow = service.resource(7, picture);
    expect(
        forWindow.startsWith(`http://127.0.0.1:${service.port}/content/`),
    ).toBe(true);
    const stored = service.getOutputContext(7)!.resources[picture];
    expect(stored).toBe(forWindow.slice(service.baseUrl.length));
    expect(stored).toMatch(
        /^\/content\/[a-f0-9]{48}\/[a-f0-9]{24}\/image1\.jpg$/,
    );
    // A screen on this computer's own monitors is drawn only here.
    service.resource(8, picture);
    expect(service.getOutputContext(8)!.resources[picture]).toMatch(
        /^http:\/\/127\.0\.0\.1:/,
    );
    outputs.delete(7);
    outputs.delete(8);
});

test('a local output can change sound ownership and refresh its presenter snapshot', async () => {
    const first = answerBootstraps(service);
    expect(await service.prepareOutput(12, 1)).toBe(false);
    expect(service.retargetOutput(12, toVirtualDisplayId(1))).toBe(true);
    expect(service.getOutputContext(12)?.isSoundOwner).toBe(true);
    expect(service.retargetOutput(12, 1)).toBe(true);
    expect(service.getOutputContext(12)?.isSoundOwner).toBe(false);
    expect(service.retargetOutput(99, 1)).toBe(false);
    expect(
        first.sent.some(([channel]) => channel === 'mirror:bootstrap-request'),
    ).toBe(true);

    const refreshed = answerBootstraps(service, [
        { type: 'background', data: { type: 'color', color: '#123456' } },
    ]);
    await service.refreshContext(12);
    expect(service.getOutputContext(12)?.messages).toMatchObject([
        { type: 'background', data: { color: '#123456' } },
    ]);
    const feedback = {
        screenId: 12,
        type: 'sync-scroll-percentage',
        data: { domSelector: '#text', scroll: { x: 0, y: 0.25 } },
    };
    service.forwardViewerFeedback(feedback as any);
    expect(refreshed.sent).toContainEqual(['screen-message', feedback]);

    await service.refreshContext(99);
    service.hide(12);
    expect(service.showingIds()).toEqual([]);
});

// Cloudflare's quick tunnel reaches this server through a loopback door of
// its own: whatever its socket's peer says, every request on it is the
// internet, from the address Cloudflare names, and only a virtual display's
// viewer is served there.
test('through the tunnel everything is the internet: viewers, and guests while hosting', async () => {
    const started: number[] = [];
    const startSpy = vi
        .spyOn(MirrorTunnel.prototype, 'start')
        .mockImplementation((port: number) => {
            started.push(port);
        });
    const stopSpy = vi
        .spyOn(MirrorTunnel.prototype, 'stop')
        .mockImplementation(() => {});
    const seen: string[] = [];
    service.setVirtualDisplayHooks({
        route: (req, res, _url, network) => {
            seen.push(`${network} ${readRequestSender(req).address}`);
            res.writeHead(200).end();
        },
        upgrade: (req, socket, _head, network) => {
            seen.push(`ws ${network} ${readRequestSender(req).address}`);
            socket.destroy();
        },
        admits: () => true,
        onNetworkChanged: () => {},
    });
    const get = (port: number, pathname: string, ip?: string) => {
        return new Promise<number>((resolve) => {
            http.get(
                {
                    host: '127.0.0.1',
                    port,
                    path: pathname,
                    headers: ip ? { 'cf-connecting-ip': ip } : {},
                },
                (res) => {
                    res.resume();
                    resolve(res.statusCode ?? 0);
                },
            ).on('error', () => resolve(0));
        });
    };
    try {
        // Wanted only while the displays are shared to the internet.
        service.setTunnelEnabled(true);
        expect(started).toEqual([]);
        fixture.client.set(VIRTUAL_DISPLAY_SHARE_KEY, 'true');
        await service.setInternetEnabled(true);
        await vi.waitFor(() => expect(started).toHaveLength(1));
        const door = started[0];
        expect(door).not.toBe(service.port);
        expect(await get(door, '/vd/1/video', '198.51.100.7')).toBe(200);
        expect(await get(door, '/vd/1/video', 'not an address')).toBe(200);
        expect(await get(service.port, '/vd/1/video')).toBe(200);
        expect(seen.slice(0, 2)).toEqual([
            'internet 198.51.100.7',
            'internet 0.0.0.0',
        ]);
        expect(seen[2]).toMatch(/^this-computer (::ffff:)?127\.0\.0\.1$/);
        // Screen Mirror's guests come in through it too while hosting is
        // on -- from the internet, under the guest access, their files
        // published under the https origin they dialled.
        expect(await get(door, '/discovery', '198.51.100.8')).toBe(200);
        const tunnelGuest = new WebSocket(`ws://127.0.0.1:${door}/mirror`, {
            headers: {
                'cf-connecting-ip': '198.51.100.8',
                host: 'quiet-river.trycloudflare.com',
            },
        });
        sockets.push(tunnelGuest);
        tunnelGuest.on('error', () => {});
        await new Promise((resolve) => tunnelGuest.once('open', resolve));
        tunnelGuest.send(
            JSON.stringify({
                protocol: 1,
                type: 'hello',
                id: randomUUID(),
                name: 'Tunnel guest',
                version: appInfo.version,
            }),
        );
        await vi.waitFor(() => {
            expect(service.state().pending).toMatchObject([
                { address: '198.51.100.8', network: 'internet' },
            ]);
        });
        const peer = [...(service as any).peers.values()][0];
        expect(peer.origin).toBe('https://quiet-river.trycloudflare.com');
        const viewer = new WebSocket(`ws://127.0.0.1:${door}/vd/1/ws`, {
            headers: { 'cf-connecting-ip': '2001:db8::5' },
        });
        viewer.on('error', () => {});
        await vi.waitFor(() => {
            expect(seen).toContain('ws internet 2001:db8::5');
        });
        expect(service.tunnelState.status).toBe('off');
        // Hosting off: the viewers' door alone, nothing of Screen Mirror.
        tunnelGuest.terminate();
        await service.setHostEnabled(false);
        expect(await get(door, '/discovery')).toBe(404);
        expect(await get(door, '/vd/1/video', '198.51.100.7')).toBe(200);
        // Off closes the door.
        service.setTunnelEnabled(false);
        expect(stopSpy).toHaveBeenCalled();
        await vi.waitFor(async () => {
            expect(await get(door, '/vd/1/video')).toBe(0);
        });
    } finally {
        startSpy.mockRestore();
        stopSpy.mockRestore();
    }
});

// One server, one set of connection settings for both tabs: the tunnel's

// address joins the shared address list once it is up, and the port and the

// public address have commands of their own (not the guest-access one).

test('the tunnel joins the shared address list; the port has its own command', async () => {
    const startSpy = vi

        .spyOn(MirrorTunnel.prototype, 'start')

        .mockImplementation(() => {});

    const stateSpy = vi

        .spyOn(MirrorTunnel.prototype, 'state', 'get')

        .mockReturnValue({
            status: 'up',

            url: 'https://quiet-river.trycloudflare.com',

            progress: 100,

            error: '',
        });

    try {
        await service.setInternetEnabled(true);

        const isListed = () => {
            return service.state().addresses.some((address) => {
                return address.kind === 'tunnel';
            });
        };

        expect(isListed()).toBe(false);

        service.setTunnelEnabled(true);

        expect(service.state()).toMatchObject({
            tunnelEnabled: true,

            tunnel: { status: 'up' },
        });

        expect(service.state().addresses).toContainEqual({
            host: 'quiet-river.trycloudflare.com',

            port: 443,

            kind: 'tunnel',
        });

        await service.setInternetEnabled(false);

        expect(isListed()).toBe(false);

        service.setCustomPort(40500);

        expect(service.state()).toMatchObject({
            customPort: 40500,

            approvalMode: 'approve',
        });

        expect(() => service.setCustomPort(70000)).toThrow('Invalid port');

        service.setCustomPort(null);

        expect(service.state().customPort).toBeNull();
    } finally {
        startSpy.mockRestore();

        stateSpy.mockRestore();
    }
});

// A tunnel's address has no port to show: a guest given one dials 443, with

// TLS -- https for the host's discovery, wss for its socket.

test('a guest dials port 443 -- a tunnel -- with TLS', async () => {
    const get = vi.spyOn(https, 'get').mockImplementation(((_url: string) => {
        const request = new EventEmitter() as any;

        request.destroy = () => {};

        setImmediate(() => request.emit('error', new Error('offline')));

        return request;
    }) as any);

    try {
        await expect(
            service.connect({
                host: 'https://quiet-river.trycloudflare.com',

                port: 443,

                code: '',
            }),
        ).rejects.toThrow('Connection failed');

        expect(get.mock.calls[0][0]).toBe(
            'https://quiet-river.trycloudflare.com:443/discovery',
        );
    } finally {
        get.mockRestore();
    }
});

test('the router port is checked against this server, with a token only it answers', async () => {
    const real = await vi.importActual<typeof RouterModule>(
        './screenMirrorRouter',
    );
    // The router's loopback, played by this computer's own loopback.
    vi.mocked(probeRouterPort).mockImplementation((_host, _port, token) => {
        return real.probeRouterPort('127.0.0.1', service.port, token);
    });
    const gateway = {
        controlUrl: 'http://192.168.1.1:5000/ctl',
        serviceType: 'urn:schemas-upnp-org:service:WANIPConnection:1',
        localAddress: '192.168.1.3',
    };
    const reached: string[] = [];
    vi.mocked(findRouterGateway).mockResolvedValue(gateway);
    vi.mocked(getRouterExternalAddress).mockResolvedValue('203.0.113.10');
    vi.mocked(openRouterPort).mockImplementation(
        async (_gateway, internalPort, externalAddress, options) => {
            reached.push(await options!.reach!(40001));
            return {
                ...gateway,
                externalAddress,
                externalPort: 40001,
                internalPort,
                leaseSeconds: 3600,
            };
        },
    );
    await service.setInternetEnabled(true);
    await vi.waitFor(() => expect(service.state().router).toBe('open'));
    expect(reached).toEqual(['this']);
    expect(probeRouterPort).toHaveBeenCalledWith(
        '203.0.113.10',
        40001,
        expect.any(String),
    );
    // The token is good for its own probe only.
    const [, , token] = vi.mocked(probeRouterPort).mock.calls[0];
    expect(await real.probeRouterPort('127.0.0.1', service.port, token)).toBe(
        'other',
    );
    expect(
        JSON.parse(fixture.client.get('screen-mirror-router-mapping')!),
    ).toMatchObject({ externalPort: 40001, internalPort: service.port });
});

test('the HTTP server routes virtual display viewers and admits only their public assets', async () => {
    const servedPaths: string[] = [];
    service.setVirtualDisplayHooks({
        route: (_req, res, url, network) => {
            res.writeHead(200).end(`${network}:${url.pathname}`);
        },
        upgrade: () => {},
        admits: (network) => network === 'local',
        onNetworkChanged: () => {},
    });
    vi.spyOn(service, 'serveAppFile').mockImplementation(
        async (_req, res, url) => {
            servedPaths.push(url.pathname);
            res.writeHead(200).end(url.pathname);
        },
    );

    const virtual = await handleHttp('/vd/1/video');
    expect(virtual.res.statusCode).toBe(200);
    expect(virtual.res.body.toString()).toBe('local:/vd/1/video');

    const viewerPage = await handleHttp('/virtual-display-viewer.html');
    expect(viewerPage.res.statusCode).toBe(200);
    expect(servedPaths).toEqual(['/virtual-display-viewer.html']);

    const logo = await handleHttp('/favicon.ico', 'HEAD');
    expect(logo.res.statusCode).toBe(200);
    expect(logo.res.headers['content-type']).toBe('image/png');
    expect(logo.res.writableEnded).toBe(true);

    const discovery = await handleHttp('/discovery', 'HEAD');
    expect(discovery.res.statusCode).toBe(200);
    expect(discovery.res.body).toHaveLength(0);

    const unlisted = await handleHttp('/electron-secrets.js');
    expect(unlisted.res.statusCode).toBe(404);
    const internetPage = await handleHttp(
        '/virtual-display-viewer.html',
        'GET',
        '198.51.100.9',
    );
    expect(internetPage.res.statusCode).toBe(404);
    expect(servedPaths).toEqual(['/virtual-display-viewer.html']);
});

test('built app files are contained under dist and answer HEAD requests', async () => {
    const req = mockHttpRequest('/assets/blank.png', 'HEAD');
    const safe = mockHttpResponse();
    await service.serveAppFile(
        req,
        safe,
        new URL('/assets/blank.png', service.baseUrl),
    );
    expect(safe.statusCode).toBe(200);
    expect(safe.headers['content-type']).toBe('image/png');
    expect(safe.writableEnded).toBe(true);

    const escaped = mockHttpResponse();
    await service.serveAppFile(req, escaped, {
        pathname: '/../../outside.txt',
    } as URL);
    expect(escaped.statusCode).toBe(404);
    expect(escaped.writableEnded).toBe(true);
});

test('a guest links to several hosts, and each host’s screen answers only its host', async () => {
    fixture.displays = [display];
    fixture.client.delete('screen-mirror-identity');
    await useFreePort();
    const hostB = new ScreenMirrorService();
    await hostB.start();
    fixture.client.delete('screen-mirror-identity');
    await useFreePort();
    const guestC = new ScreenMirrorService();
    await guestC.start();
    try {
        for (const host of [service, hostB]) {
            await guestC.connect({
                host: '127.0.0.1',
                port: host.port,
                code: '',
            });
            await vi.waitFor(() =>
                expect(host.state().pending).toHaveLength(1),
            );
            host.approve(host.state().pending[0].id);
            await vi.waitFor(() => expect(host.displays()).toHaveLength(1));
        }
        expect(
            guestC.state().connections.map((connection) => connection.status),
        ).toEqual(['connected', 'connected']);
        await expect(
            guestC.connect({ host: '127.0.0.1', port: hostB.port, code: '' }),
        ).rejects.toThrow('Incompatible or duplicate connection');
        const mainA = answerBootstraps(service);
        const mainB = answerBootstraps(hostB);
        await service.prepareOutput(0, service.displays()[0].id);
        await vi.waitFor(() => expect(fixture.controllers).toHaveLength(1));
        await hostB.prepareOutput(0, hostB.displays()[0].id);
        await vi.waitFor(() => expect(fixture.controllers).toHaveLength(2));
        // Both hosts' screen 0, each in a window of its own.
        expect(fixture.controllers.map((item) => item.screenId)).toEqual([
            0, 0,
        ]);
        const [fromA, fromB] = fixture.controllers;
        // What a person does ON a host's screen here -- scroll it, pick a
        // verse, play its video, step the verse with Ctrl+arrow -- reaches that
        // host's presenter and no other; what the screen has no business
        // reporting (a draw) reaches neither.
        const scroll = {
            domSelector: '#bible',
            scroll: { x: 0, y: 0.5 },
        };
        for (const [type, data] of [
            ['sync-scroll-percentage', scroll],
            ['bible-screen-view-selected-index', { selectedKJVVerseKey: 'k' }],
            ['background-video-time', { time: 3 }],
            ['draw', { action: 'clear' }],
        ] as const)
            expect(
                guestC.sendFeedback(
                    { screenId: 0, type, data },
                    fromB.win.webContents,
                ),
            ).toBe(true);
        expect(
            guestC.stepBible(
                { screenId: 7, isNext: true },
                fromB.win.webContents,
            ),
        ).toBe(true);
        const screenTypes = (sent: [string, any][]) =>
            sent
                .filter(([channel]) => channel === 'screen-message')
                .map(([, message]) => message.type);
        await vi.waitFor(() =>
            expect(mainB.sent).toContainEqual([
                'app:main:change-bible',
                { screenId: 0, isNext: true },
            ]),
        );
        expect(screenTypes(mainB.sent)).toEqual([
            'sync-scroll-percentage',
            'bible-screen-view-selected-index',
            'background-video-time',
        ]);
        expect(screenTypes(mainA.sent)).toEqual([]);
        expect(
            mainA.sent.some(([channel]) => channel === 'app:main:change-bible'),
        ).toBe(false);
        // And the other way: the host scrolling its preview moves its screen
        // here, not the other host's.
        expect(
            hostB.sendScreenMessage({
                screenId: 0,
                type: 'sync-scroll-percentage',
                data: scroll,
            }),
        ).toBe(true);
        await vi.waitFor(() =>
            expect(fromB.sendMessage).toHaveBeenCalledWith(
                'sync-scroll-percentage',
                scroll,
            ),
        );
        expect(fromA.sendMessage).not.toHaveBeenCalled();
        expect(
            guestC.sendFeedback(
                { screenId: 0, type: 'visible', data: { isShowing: false } },
                fromA.win.webContents,
            ),
        ).toBe(true);
        await vi.waitFor(() => expect(service.showingIds()).toEqual([]));
        expect(hostB.showingIds()).toEqual([0]);
        // A window that shows no host's screen is this computer's own.
        expect(
            guestC.sendFeedback({ screenId: 0, type: 'visible', data: {} }, {
                id: 1,
            } as any),
        ).toBe(false);
        const linkA = guestC.state().connections.find((connection) => {
            return connection.port === service.port;
        })!;
        guestC.disconnect(linkA.id);
        expect(
            guestC.state().connections.map((connection) => connection.port),
        ).toEqual([hostB.port]);
        expect(fromB.close).not.toHaveBeenCalled();
        // The ✕ on a host's screen here: by the window, not by its screen id
        // (which names no window of this computer's own), and the host hears.
        expect(guestC.closeIncomingOf({ id: 1 } as any)).toBe(false);
        expect(guestC.closeIncomingOf(fromB.win.webContents)).toBe(true);
        expect(fromB.close).toHaveBeenCalled();
        await vi.waitFor(() => expect(hostB.showingIds()).toEqual([]));
    } finally {
        guestC.stop();
        hostB.stop();
    }
});

// Talk-back on a connection, end to end between a host and a guest: each turns
// on only its own microphone and speaker, the other side sees a microphone go
// on, and sound reaches a speaker only while it is on. A guest can stop
// offering its cameras to a host.
test('the intercom and camera sharing between a host and a guest', async () => {
    fixture.client.delete('screen-mirror-identity');
    await useFreePort();
    const guest = new ScreenMirrorService();
    await guest.start();
    // The broker window is the sound's; here it is where packets land.
    const hostBroker = vi
        .spyOn(service as any, 'sendBrokerIntercom')
        .mockImplementation(() => {});
    const guestBroker = vi
        .spyOn(guest as any, 'sendBrokerIntercom')
        .mockImplementation(() => {});
    try {
        (guest as any).physicalCameras = [
            { deviceId: 'cam-1', label: 'HD Camera', groupId: '' },
        ];
        await guest.connect({
            host: '127.0.0.1',
            port: service.port,
            code: '',
        });
        await vi.waitFor(() => expect(service.state().pending).toHaveLength(1));
        service.approve(service.state().pending[0].id);
        await vi.waitFor(() => {
            expect(service.state().guests).toHaveLength(1);
        });
        // Everything starts off: no microphone, no speaker, no cameras.
        const [connection] = guest.state().connections;
        expect(connection).toMatchObject({
            shareCameras: false,
            intercom: { mic: false, speaker: false, remoteMic: false },
        });
        expect(service.state().guests[0].cameras).toEqual([]);
        guest.setShareCameras(connection.id, true);
        await vi.waitFor(() => {
            expect(service.state().guests[0].cameras).toHaveLength(1);
        });
        const guestId = service.state().guests[0].id;
        const hostKey = `guest:${guestId}`;
        const guestKey = `link:${connection.id}`;

        await guest.setIntercom(guestKey, { mic: true });
        await vi.waitFor(() => {
            expect(service.state().guests[0].intercom.remoteMic).toBe(true);
        });
        // The host's speaker is off: the guest's sound is dropped.
        (guest as any).intercom.sendLocal(new Uint8Array([1, 2, 3]));
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(
            hostBroker.mock.calls.some(([message]: any) => {
                return message.type === 'audio';
            }),
        ).toBe(false);
        await service.setIntercom(hostKey, { speaker: true, volume: 0.5 });
        expect(hostBroker).toHaveBeenLastCalledWith({
            type: 'config',
            isMicOn: false,
            speakers: { [hostKey]: 0.5 },
        });
        (guest as any).intercom.sendLocal(new Uint8Array([1, 2, 3]));
        await vi.waitFor(() => {
            expect(hostBroker).toHaveBeenLastCalledWith({
                type: 'audio',
                key: hostKey,
                data: new Uint8Array([1, 2, 3]),
            });
        });
        expect(service.state().guests[0].intercom).toMatchObject({
            speaker: true,
            volume: 0.5,
        });
        // The guest's own speaker: the host's microphone plays there.
        await guest.setIntercom(guestKey, { speaker: true });
        await service.setIntercom(hostKey, { mic: true });
        await vi.waitFor(() => {
            expect(guest.state().connections[0].intercom.remoteMic).toBe(true);
        });
        (service as any).intercom.sendLocal(new Uint8Array([9]));
        await vi.waitFor(() => {
            expect(guestBroker).toHaveBeenLastCalledWith({
                type: 'audio',
                key: guestKey,
                data: new Uint8Array([9]),
            });
        });
        // Only a connection that is there.
        await expect(
            service.setIntercom('guest:nobody', { mic: true }),
        ).rejects.toThrow('Connection failed');

        guest.setShareCameras(connection.id, false);
        await vi.waitFor(() => {
            expect(service.state().guests[0].cameras).toEqual([]);
        });
        expect(guest.state().connections[0].shareCameras).toBe(false);

        // The guest leaves: nothing of the intercom stays on.
        guest.disconnect(connection.id);
        await vi.waitFor(() => expect(service.state().guests).toEqual([]));
        expect(hostBroker).toHaveBeenLastCalledWith({
            type: 'config',
            isMicOn: false,
            speakers: {},
        });
    } finally {
        hostBroker.mockRestore();
        guestBroker.mockRestore();
        guest.stop();
    }
});

// "Use HTTPS" (Virtual Displays): the same port answers TLS with this
// computer's own certificate, kept for the next launch; plain HTTP never
// stops, and a TLS connection open when it goes off is ended.
test('HTTPS on the same port, with a certificate kept for the next launch', async () => {
    const port = service.port;
    const status = (url: string) => {
        return new Promise<number>((resolve, reject) => {
            (url.startsWith('https:') ? https : http)
                .get(
                    url,
                    { rejectUnauthorized: false, agent: false },
                    (res) => {
                        res.resume();
                        resolve(res.statusCode ?? 0);
                    },
                )
                .on('error', reject);
        });
    };
    const fingerprint = (onPort: number) => {
        return new Promise<string>((resolve, reject) => {
            const socket = tls.connect({
                host: '127.0.0.1',
                port: onPort,
                rejectUnauthorized: false,
            });
            socket.once('secureConnect', () => {
                resolve(socket.getPeerCertificate().fingerprint256);
                socket.destroy();
            });
            socket.once('error', reject);
        });
    };
    const httpsUrl = `https://127.0.0.1:${port}/discovery`;
    const httpUrl = `http://127.0.0.1:${port}/discovery`;
    await expect(status(httpsUrl)).rejects.toThrow();
    expect(fixture.secure.has('virtual-display-tls')).toBe(false);

    await service.setHttpsEnabled(true);
    expect(service.isHttpsEnabled).toBe(true);
    expect(await status(httpsUrl)).toBe(200);
    expect(await status(httpUrl)).toBe(200);
    const stored = JSON.parse(fixture.secure.get('virtual-display-tls')!);
    const storedFingerprint = new X509Certificate(stored.cert).fingerprint256;
    expect(await fingerprint(port)).toBe(storedFingerprint);

    const open = tls.connect({
        host: '127.0.0.1',
        port,
        rejectUnauthorized: false,
    });
    open.on('error', () => {});
    await new Promise((resolve) => open.once('secureConnect', resolve));
    const closed = new Promise((resolve) => open.once('close', resolve));
    await service.setHttpsEnabled(false);
    await closed;
    await expect(status(httpsUrl)).rejects.toThrow();
    expect(await status(httpUrl)).toBe(200);

    // The next launch answers with the same certificate.
    fixture.client.set(VIRTUAL_DISPLAY_HTTPS_KEY, 'true');
    service.stop();
    service = new ScreenMirrorService();
    await service.start();
    const nextPort = service.port;
    await vi.waitFor(async () => {
        expect(await status(`https://127.0.0.1:${nextPort}/discovery`)).toBe(
            200,
        );
    });
    expect(await fingerprint(nextPort)).toBe(storedFingerprint);
}, 30_000);
