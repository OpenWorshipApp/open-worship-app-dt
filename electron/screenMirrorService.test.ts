import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';

const fixture = vi.hoisted(() => ({
    client: new Map<string, string>(),
    secure: new Map<string, string>(),
    ipc: new Map<string, (...args: any[]) => void>(),
}));
vi.mock('electron', () => ({
    app: { once: vi.fn(), getAppPath: () => process.cwd() },
    screen: {
        on: vi.fn(),
        getAllDisplays: () => [],
        getPrimaryDisplay: () => ({ id: 1 }),
    },
    BrowserWindow: { getAllWindows: () => [] },
    ipcMain: {
        on: (name: string, handler: (...args: any[]) => void) =>
            fixture.ipc.set(name, handler),
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
    default: { getInstance: () => null },
}));
vi.mock('./protocolHelpers', () => ({ getRootUrl: () => 'owa://local' }));
vi.mock('./electronHelpers', () => ({
    isDev: false,
    messageChannels: { screenMessage: 'screen-message' },
}));

import { ScreenMirrorService } from './screenMirrorService';
import appInfo from '../package.json';

let service: ScreenMirrorService;
let directory: string;
const sockets: WebSocket[] = [];
beforeEach(async () => {
    fixture.client.clear();
    fixture.secure.clear();
    fixture.ipc.clear();
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
async function guest(id = randomUUID(), extra: Record<string, any> = {}) {
    const socket = new WebSocket(
        `${service.baseUrl.replace('http:', 'ws:')}/mirror`,
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
            fixture.ipc.get('mirror:bootstrap')!(
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
        fixture.ipc.get('mirror:bootstrap')!(
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
    fixture.ipc.get('mirror:command')!(
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
