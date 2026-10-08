import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
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
    openRouterPort: vi.fn(),
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
    openRouterPort,
} from './screenMirrorRouter';
import appInfo from '../package.json';

function ipc(name: string) {
    return (...args: any[]) => {
        for (const handler of fixture.ipc.get(name) ?? []) handler(...args);
    };
}

let service: ScreenMirrorService;
let directory: string;
const sockets: WebSocket[] = [];
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
    vi.mocked(closeRouterPort).mockReset().mockResolvedValue(undefined);
    directory = await mkdtemp(path.join(os.tmpdir(), 'owa-mirror-service-'));
    // Hosting is off by default; these tests are about a host.
    fixture.client.set('screen-mirror-host', 'true');
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
const display = {
    id: 15,
    label: 'HDMI',
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    scaleFactor: 1,
    isPrimary: true,
};

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

test('a guest links to several hosts, and each host’s screen answers only its host', async () => {
    fixture.displays = [display];
    fixture.client.delete('screen-mirror-identity');
    const hostB = new ScreenMirrorService();
    await hostB.start();
    fixture.client.delete('screen-mirror-identity');
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
