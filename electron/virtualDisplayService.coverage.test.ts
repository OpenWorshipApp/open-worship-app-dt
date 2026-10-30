import { EventEmitter } from 'node:events';
import type http from 'node:http';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The branches `virtualDisplayService.test.ts` leaves: the compositor's own
// window (its log, a crash, a close from outside), races while screens
// refresh, the caps that keep the service's maps bounded, the operator's
// Allow on edge cases, HLS players beside MP4 ones, the IPC a page sends,
// and the hooks the Screen Mirror server is given. Same stand-ins as there.
const fixture = vi.hoisted(() => ({
    client: new Map<string, string>(),
    secure: new Map<string, string>(),
    readWallpaper: vi.fn(),
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
    readVirtualDisplayWallpaper: fixture.readWallpaper,
}));
vi.mock('./VirtualScreenController', () => ({
    default: class {
        guest: any = null;
        sockets = new Set<{ close: (code: number, reason: string) => void }>();
        order = 0;
        isLive = false;
        noteCameras = vi.fn();
        capture = vi.fn(() => 'screen image');
        constructor(
            readonly screenId: number,
            public displayNumber: number,
            private readonly onDetach: (controller: any) => void,
        ) {}
        close() {
            this.onDetach(this);
        }
    },
}));
const castMocks = vi.hoisted(() => ({
    discover: vi.fn(),
    start: vi.fn(),
}));
vi.mock('./castTargets', () => ({
    discoverCastTargets: castMocks.discover,
    startCastSession: castMocks.start,
}));

import {
    VIDEO_TIMESCALE,
    VIDEO_TRACK_ID,
    buildFragment,
    buildInitSegment,
    toAudioSpecificConfig,
} from '../src/virtual-display/fmp4Muxer';
import { createMockBrowserWindow, createMockWebContents } from './testUtils';
import { electronMockState } from './testElectronModule';
import type { ScreenMirrorService } from './screenMirrorService';
import { markVirtualDisplayHost } from './virtualDisplayHostRegistry';
import {
    VIRTUAL_DISPLAY_ACCESS_KEY,
    VIRTUAL_DISPLAY_CODE_KEY,
    type VirtualDisplayNetwork,
} from './virtualDisplayProtocol';
import {
    VirtualDisplayService,
    getVirtualDisplays,
    initVirtualDisplays,
} from './virtualDisplayService';

const BASE_URL = 'http://127.0.0.1:40000';
const LABELS_KEY = 'virtual-display-viewer-labels';
const BLOCK_MILLISECOND = 10 * 60 * 1000;
const CAST_TOKEN_MILLISECOND = 24 * 60 * 60 * 1000;
const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) ' +
    'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 ' +
    'Mobile/15E148 Safari/604.1';
const TV = {
    id: 'dlna:1',
    kind: 'dlna',
    name: 'Samsung',
    host: '192.168.1.50',
    port: 7676,
};

function createMirror() {
    const lockedOut = new Set<string>();
    return {
        port: 40000,
        error: null as string | null,
        isVirtualDisplayShareEnabled: false,
        isInternetEnabled: false,
        isHttpsEnabled: false,
        routerState: { state: 'off' },
        addressList: vi.fn(() => []),
        content: {
            createScope: vi.fn(() => 'scope-1'),
            publish: vi.fn(() => '/content/scope-1/wallpaper.png'),
            revoke: vi.fn(),
        },
        refreshContext: vi.fn(async (_screenId: number) => {}),
        getOutputContext: vi.fn((_screenId: number): any => null),
        sendDevicesChanged: vi.fn(),
        broadcast: vi.fn(),
        serveAppFile: vi.fn(async () => {}),
        trusted: vi.fn((_sender: unknown) => true),
        setVirtualDisplayShareEnabled: vi.fn(async () => {}),
        setHttpsEnabled: vi.fn(async (_isEnabled: boolean) => {}),
        setVirtualDisplayHooks: vi.fn(),
        id: '00000000-0000-4000-8000-000000000000',
        setViewerCameraSink: vi.fn(),
        routeViewerCamera: vi.fn(),
        closeViewerCameras: vi.fn(),
        hide: vi.fn(),
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
        intercomStateOf: vi.fn((_key: string) => ({
            mic: false,
            speaker: false,
            volume: 1,
            remoteMic: false,
        })),
        receiveIntercom: vi.fn(),
        forgetIntercom: vi.fn(),
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
    writableLength = 0;
    writableEnded = false;
    destroyed = false;
    isEnded = false;
    body: unknown = undefined;
    setHeader(name: string, value: string) {
        this.setHeaders[name] = value;
        return this;
    }
    writeHead(statusCode: number, headers: Record<string, string> = {}) {
        this.statusCode = statusCode;
        this.headers = headers;
        this.headersSent = true;
        return this;
    }
    write() {
        return true;
    }
    end(body?: unknown) {
        this.body = body;
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

function ipcListener(channel: string) {
    return electronMockState.ipcMain.on.mock.calls.find(
        ([name]) => name === channel,
    )?.[1] as (...args: any[]) => void;
}

function eventListener(listeners: ReturnType<typeof vi.fn>, eventName: string) {
    return listeners.mock.calls.find(([name]) => name === eventName)?.[1] as
        ((...args: any[]) => any) | undefined;
}

type RequestOptions = {
    network?: VirtualDisplayNetwork;
    address?: string;
    method?: string;
    headers?: Record<string, string>;
};

function toRequest({
    address = '127.0.0.1',
    method = 'GET',
    headers = {},
}: RequestOptions = {}) {
    return {
        method,
        headers: { 'user-agent': 'Player/1.0', ...headers },
        socket: { remoteAddress: address },
    } as unknown as http.IncomingMessage;
}

// The route started and not awaited: what a viewer does while the service
// still waits for something.
function startRequest(
    service: VirtualDisplayService,
    path: string,
    options: RequestOptions = {},
) {
    const res = new FakeResponse();
    const done = service.route(
        toRequest(options),
        res as unknown as http.ServerResponse,
        new URL(path, BASE_URL),
        options.network ?? 'this-computer',
    );
    return { res, done };
}

async function request(
    service: VirtualDisplayService,
    path: string,
    options: RequestOptions = {},
) {
    const { res, done } = startRequest(service, path, options);
    await done;
    return res;
}

function clientsOf(service: VirtualDisplayService, index = 0) {
    return service.state().displays[index].clients;
}

function webViewersOf(service: VirtualDisplayService) {
    return (service as any).webViewers;
}

function sessionOf(service: VirtualDisplayService, number = 1) {
    return (service as any).sessions.get(number);
}

function toBuffer(data: Uint8Array) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}
const INIT = toBuffer(
    buildInitSegment(
        {
            width: 1920,
            height: 1080,
            avcC: Uint8Array.of(1, 0x64, 0, 0x28, 0xff, 0xe1, 0, 0),
        },
        {
            sampleRate: 48000,
            channelCount: 2,
            audioSpecificConfig: toAudioSpecificConfig(48000, 2),
        },
    ),
);
let sequence = 0;
function videoAt(second: number, isKey: boolean) {
    sequence += 1;
    return toBuffer(
        buildFragment({
            sequence,
            trackId: VIDEO_TRACK_ID,
            baseDecodeTime: Math.round(second * VIDEO_TIMESCALE),
            samples: [
                {
                    data: new Uint8Array(16).fill(sequence & 0xff),
                    duration: 3000,
                    isKey,
                },
            ],
        }),
    );
}

function tokenOf(master: FakeResponse) {
    return /^hls\/([a-f0-9]{32})\/index\.m3u8$/m.exec(String(master.body))![1];
}

beforeEach(() => {
    vi.useFakeTimers();
    fixture.client.clear();
    fixture.secure.clear();
    electronMockState.reset();
    electronMockState.setBrowserWindowFactory(() => ({
        ...createMockBrowserWindow(),
        setContentSize: vi.fn(),
        destroy: vi.fn(),
    }));
    castMocks.discover.mockResolvedValue([]);
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

describe('the compositor window', () => {
    test('logs its page errors, denies popups, and a crash fails only its display', async () => {
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const service = createService();
        service.create({ name: 'Lobby' });
        const player = await request(service, '/vd/1/video');
        const [window] = electronMockState.browserWindows;
        const contents = window.webContents;

        const [openHandler] = contents.setWindowOpenHandler.mock.calls[0];
        expect(openHandler()).toEqual({ action: 'deny' });

        const consoleMessage = eventListener(contents.on, 'console-message')!;
        const long = 'boom '.repeat(150);
        // Electron's older (level, message) arguments and its newer event.
        consoleMessage({}, 3, long);
        consoleMessage({ level: 'error', message: 'from the event' });
        consoleMessage({}, 1, 'only information');
        consoleMessage({ level: 'warning', message: 'only a warning' });
        expect(consoleError.mock.calls).toEqual([
            ['[virtual display 1]', long.slice(0, 500)],
            ['[virtual display 1]', 'from the event'],
        ]);

        eventListener(contents.on, 'render-process-gone')!();
        expect(service.state().displays[0]).toMatchObject({
            stream: 'error',
            error: 'The virtual display stopped',
            clients: [],
        });
        expect(window.destroy).toHaveBeenCalledOnce();
        expect(player.isEnded).toBe(true);
        expect(player.statusCode).toBe(503);
    });

    test('closed from outside, it is started again for the next player', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        service.initIpc();
        await request(service, '/vd/1/video');
        const [first] = electronMockState.browserWindows;
        const session = sessionOf(service);
        ipcListener('vd:compositor-ready')({ sender: first.webContents });
        ipcListener('vd:encoder')(
            { sender: first.webContents },
            { generation: session.generation, state: 'live' },
        );
        expect(electronMockState.BrowserWindowMock).toHaveBeenCalledTimes(1);

        eventListener(first.on, 'closed')!();
        await request(service, '/vd/1/video');
        expect(electronMockState.BrowserWindowMock).toHaveBeenCalledTimes(2);

        // The closed page is still a compositor's (it was never destroyed)
        // but no display's any more: what it says is not heard.
        first.webContents.send.mockClear();
        ipcListener('vd:compositor-ready')({ sender: first.webContents });
        expect(first.webContents.send).not.toHaveBeenCalled();
        const [second] = electronMockState.browserWindows.slice(1);
        ipcListener('vd:compositor-ready')({ sender: second.webContents });
        expect(second.webContents.send).toHaveBeenCalledWith(
            'vd:compositor',
            expect.objectContaining({ type: 'encode' }),
        );
    });

    test('a player joining a ready compositor asks it for a key frame', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        service.initIpc();
        await request(service, '/vd/1/video');
        const [window] = electronMockState.browserWindows;
        // The first player came before the page: nobody to ask.
        expect(window.webContents.send).not.toHaveBeenCalledWith(
            'vd:compositor',
            { type: 'keyframe' },
        );
        ipcListener('vd:compositor-ready')({ sender: window.webContents });
        window.webContents.send.mockClear();
        await request(service, '/vd/1/video');
        expect(window.webContents.send.mock.calls).toEqual([
            ['vd:compositor', { type: 'keyframe' }],
        ]);
    });

    test('an iPhone stream with no segment open asks the compositor for a key frame', async () => {
        mirror.isVirtualDisplayShareEnabled = true;
        const service = createService();
        service.create({ name: 'Lobby' });
        service.initIpc();
        await request(service, '/vd/1/video', {
            network: 'local',
            address: '192.168.1.5',
            headers: { 'user-agent': IPHONE },
        });
        const [window] = electronMockState.browserWindows;
        ipcListener('vd:compositor-ready')({ sender: window.webContents });
        const session = sessionOf(service);
        session.fanout.push(INIT);
        window.webContents.send.mockClear();
        // A delta frame: a segment cannot start on it.
        session.fanout.push(videoAt(0, false));
        expect(window.webContents.send.mock.calls).toEqual([
            ['vd:compositor', { type: 'keyframe' }],
        ]);
    });

    test('a player gone while the screens refresh leaves no compositor behind', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        service.attachScreen(7, -500001);
        let finishRefresh!: () => void;
        mirror.refreshContext.mockReturnValueOnce(
            new Promise<void>((resolve) => {
                finishRefresh = resolve;
            }),
        );
        const { res, done } = startRequest(service, '/vd/1/video');
        expect(service.state().displays[0].stream).toBe('starting');
        res.destroy();
        finishRefresh();
        await done;
        expect(electronMockState.BrowserWindowMock).not.toHaveBeenCalled();
        expect(service.state().displays[0]).toMatchObject({
            stream: 'idle',
            clients: [],
        });
    });

    test('a screen that cannot refresh is logged, and the compositor still starts', async () => {
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const service = createService();
        service.create({ name: 'Lobby' });
        service.attachScreen(7, -500001);
        const failure = new Error('screen gone');
        mirror.refreshContext.mockRejectedValueOnce(failure);
        await request(service, '/vd/1/video');
        expect(mirror.refreshContext).toHaveBeenCalledWith(7);
        expect(consoleError).toHaveBeenCalledWith('Virtual display:', failure);
        expect(electronMockState.BrowserWindowMock).toHaveBeenCalledTimes(1);
    });
});

describe('what a browser viewer is given', () => {
    test("a screen's state is shared by pages loading together, then loaded again", async () => {
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const service = createService();
        service.create({ name: 'Lobby', width: 1280, height: 720 });
        service.create({ name: 'Side' });
        const controller: any = service.attachScreen(7, -500001);
        const host = webViewersOf(service).host;
        const messages = [
            { type: 'background', data: { type: 'camera', src: 'cam-1' } },
        ];
        mirror.getOutputContext.mockReturnValue({
            screenId: 7,
            stage: 2,
            messages,
        });

        const first = host.loadContext(1, 7);
        expect(host.loadContext(1, 7)).toBe(first);
        expect(await first).toEqual({
            screenId: 7,
            stage: 2,
            messages,
            hostId: mirror.id,
            display: {
                id: -500001,
                label: 'Lobby 1',
                width: 1280,
                height: 720,
            },
        });
        expect(mirror.refreshContext).toHaveBeenCalledTimes(1);
        // What is on the screen before any live message says so.
        expect(controller.noteCameras).toHaveBeenCalledWith(messages);

        // Two seconds on, a page loads its own; a refresh failing is logged
        // and the page still gets what there is.
        vi.advanceTimersByTime(2000);
        const failure = new Error('refresh failed');
        mirror.refreshContext.mockRejectedValueOnce(failure);
        const later = host.loadContext(1, 7);
        expect(later).not.toBe(first);
        await expect(later).resolves.toMatchObject({ hostId: mirror.id });
        expect(consoleError).toHaveBeenCalledWith('Virtual display:', failure);
        expect(mirror.refreshContext).toHaveBeenCalledTimes(2);

        // Asked for under another display, the screen's cameras are not
        // noted for it.
        controller.noteCameras.mockClear();
        vi.advanceTimersByTime(2000);
        await expect(host.loadContext(2, 7)).resolves.toMatchObject({
            display: { id: -500002, label: 'Side 2' },
        });
        expect(controller.noteCameras).not.toHaveBeenCalled();
    });

    test('a page asking for TVs again within five seconds is sent the list it has', async () => {
        castMocks.discover.mockResolvedValue([TV]);
        const service = createService();
        service.create({ name: 'Lobby' });
        const webViewers = webViewersOf(service);
        const sendCastStates = vi.spyOn(webViewers, 'sendCastStates');
        await service.searchCastTargets();
        expect(castMocks.discover).toHaveBeenCalledTimes(1);

        webViewers.host.onCastSearch(1);
        expect(sendCastStates).toHaveBeenCalledTimes(1);
        expect(castMocks.discover).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(5000);
        webViewers.host.onCastSearch(1);
        await vi.waitFor(() =>
            expect(castMocks.discover).toHaveBeenCalledTimes(2),
        );
    });

    test("the viewer page's words are stored only when they change", async () => {
        const service = createService();
        await service['runCommand']({
            action: 'labels',
            labels: { waiting: 'Ready' },
        });
        expect(JSON.parse(fixture.client.get(LABELS_KEY)!).waiting).toBe(
            'Ready',
        );
        fixture.client.delete(LABELS_KEY);
        await service['runCommand']({
            action: 'labels',
            labels: { waiting: '  Ready ' },
        });
        expect(fixture.client.has(LABELS_KEY)).toBe(false);
        await service['runCommand']({
            action: 'labels',
            labels: { waiting: 'Prêt' },
        });
        expect(JSON.parse(fixture.client.get(LABELS_KEY)!).waiting).toBe(
            'Prêt',
        );
    });

    test('the web viewers changing is broadcast once per burst', () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        vi.advanceTimersByTime(50);
        mirror.broadcast.mockClear();
        const host = webViewersOf(service).host;
        host.onChanged();
        host.onChanged();
        vi.advanceTimersByTime(49);
        expect(mirror.broadcast).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(mirror.broadcast).toHaveBeenCalledTimes(1);
        expect(mirror.broadcast).toHaveBeenCalledWith(
            'vd:state',
            expect.objectContaining({ displays: expect.any(Array) }),
        );
    });

    test('a browser let in is listed with its intercom and its shared camera', () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        const base = {
            kind: 'web' as const,
            network: 'local' as const,
            userAgent: 'Phone',
            since: 1,
            isInteractive: false,
        };
        vi.spyOn(webViewersOf(service), 'listOf').mockImplementation(
            (number: any) => {
                return number !== 1
                    ? []
                    : [
                          {
                              ...base,
                              id: 'preview-1',
                              address: '127.0.0.1',
                              isPreview: true,
                              waiting: null,
                          },
                          {
                              ...base,
                              id: 'waiting-1',
                              address: '198.51.100.2',
                              isPreview: false,
                              waiting: 'approval',
                          },
                          {
                              ...base,
                              id: 'viewer-1',
                              address: '192.168.1.20',
                              isPreview: false,
                              waiting: null,
                          },
                          {
                              ...base,
                              id: 'viewer-2',
                              address: '192.168.1.21',
                              isPreview: false,
                              waiting: null,
                          },
                      ];
            },
        );
        mirror.intercomStateOf.mockImplementation((key: string) => ({
            mic: key === 'viewer:viewer-1',
            speaker: false,
            volume: 1,
            remoteMic: false,
        }));
        (service as any).viewerCameras.receive('viewer-1', '192.168.1.20', {
            type: 'camera-state',
            shared: true,
            label: 'Phone',
        });

        const [preview, waiting, sharing, plain] = clientsOf(service) as any[];
        expect(preview).not.toHaveProperty('intercom');
        expect(waiting).not.toHaveProperty('intercom');
        expect(sharing).toMatchObject({
            id: 'viewer-1',
            intercom: { mic: true },
            camera: 'Browser 192.168.1.20: Phone',
        });
        expect(plain).toMatchObject({
            id: 'viewer-2',
            intercom: { mic: false },
        });
        expect(plain.camera).toBeUndefined();
        expect(mirror.intercomStateOf.mock.calls).toEqual([
            ['viewer:viewer-1'],
            ['viewer:viewer-2'],
        ]);
    });
});

describe('records', () => {
    test('casting needs a display that exists', async () => {
        mirror.isVirtualDisplayShareEnabled = true;
        const service = createService();
        await expect(service.startCast(9, TV.id)).rejects.toThrow(
            'Virtual display not found',
        );
        expect(castMocks.start).not.toHaveBeenCalled();
    });

    test('on macOS the microphone goes into the MP4 only once access is given', async () => {
        const descriptor = Object.getOwnPropertyDescriptor(
            process,
            'platform',
        )!;
        Object.defineProperty(process, 'platform', {
            value: 'darwin',
            configurable: true,
        });
        try {
            const service = createService();
            service.create({ name: 'A' });
            const ask = electronMockState.systemPreferences.askForMediaAccess;
            ask.mockResolvedValueOnce(false);
            await expect(service.setMp4Mic(1, true)).rejects.toThrow(
                'Microphone access denied',
            );
            expect(service.state().displays[0].isMp4MicOn).toBe(false);
            ask.mockResolvedValueOnce(true);
            await service.setMp4Mic(1, true);
            expect(service.state().displays[0].isMp4MicOn).toBe(true);
            expect(ask).toHaveBeenCalledWith('microphone');
            // Turning it off asks nothing.
            await service.setMp4Mic(1, false);
            expect(ask).toHaveBeenCalledTimes(2);
            expect(service.state().displays[0].isMp4MicOn).toBe(false);
        } finally {
            Object.defineProperty(process, 'platform', descriptor);
        }
    });

    test('deleting a display closes the screens on it, not the others', () => {
        const service = createService();
        service.create({ name: 'A' });
        service.create({ name: 'B' });
        service.attachScreen(7, -500001);
        service.attachScreen(8, -500001);
        service.attachScreen(9, -500002);
        service.delete(1);
        expect(service.showingScreenIds()).toEqual([9]);
        expect(service.getLayout(2)?.screenIds).toEqual([9]);
    });

    test("a display's wallpaper is read by its display id", async () => {
        fixture.readWallpaper.mockResolvedValue('wallpaper image');
        const service = createService();
        service.create({
            name: 'A',
            wallpaper: { kind: 'color', color: '#112233' },
        });
        expect(await service.readWallpaper(-500001, 640)).toBe(
            'wallpaper image',
        );
        expect(fixture.readWallpaper).toHaveBeenCalledWith(
            { kind: 'color', color: '#112233' },
            640,
        );
        // A display not there, and a real monitor's id: nothing read.
        expect(await service.readWallpaper(-500009)).toBeNull();
        expect(await service.readWallpaper(2528732444)).toBeNull();
        expect(fixture.readWallpaper).toHaveBeenCalledTimes(1);
    });
});

describe('who is kept out', () => {
    test('expired blocks are dropped as new ones come, and at most 256 are kept', () => {
        const service = createService();
        service.create({ name: 'A' });
        const webViewers = webViewersOf(service);
        vi.spyOn(webViewers, 'disconnect').mockImplementation(
            (id: any) =>
                ({ id, isPreview: false, address: '192.0.2.1' }) as any,
        );
        const blocked: Map<string, unknown> = (service as any).blocked;
        service.disconnect(1, 'viewer-old');
        expect(webViewers.host.checkIsBlocked(1, 'viewer-old')).toBe(true);
        vi.advanceTimersByTime(BLOCK_MILLISECOND + 1);
        service.disconnect(1, 'viewer-new');
        // The expired one did not wait to be asked about to go.
        expect([...blocked.keys()]).toEqual(['1|web:viewer-new']);

        for (let index = 0; index < 256; index++) {
            service.disconnect(1, `viewer-${index}`);
        }
        expect(blocked.size).toBe(256);
        expect(service.state().displays[0].blocked).toHaveLength(256);
        // The oldest made room.
        expect(webViewers.host.checkIsBlocked(1, 'viewer-new')).toBe(false);
        expect(webViewers.host.checkIsBlocked(1, 'viewer-0')).toBe(true);
        expect(webViewers.host.checkIsBlocked(1, 'viewer-255')).toBe(true);
    });

    test('a browser disconnected loses its cast token; a preview is not kept out', async () => {
        mirror.isVirtualDisplayShareEnabled = true;
        mirror.isInternetEnabled = true;
        fixture.client.set(VIRTUAL_DISPLAY_ACCESS_KEY, 'code');
        fixture.secure.set(VIRTUAL_DISPLAY_CODE_KEY, 'church-1234');
        const service = createService();
        service.create({ name: 'A' });
        service.create({ name: 'B' });
        const tokenA = service.issueCastToken(1, 'browser-a');
        const tokenB = service.issueCastToken(1, 'browser-b');
        const tokenOther = service.issueCastToken(2, 'browser-a');
        vi.spyOn(webViewersOf(service), 'disconnect').mockImplementation(
            (id: any) => ({ id, isPreview: true, address: '127.0.0.1' }) as any,
        );
        service.disconnect(1, 'browser-a');
        expect(service.state().displays[0].blocked).toEqual([]);

        const tv = (path: string) => {
            return request(service, path, {
                network: 'internet',
                address: '203.0.113.7',
            });
        };
        expect((await tv(`/vd/1/video?cast=${tokenA}`)).statusCode).toBe(401);
        expect((await tv(`/vd/1/video?cast=${tokenB}`)).statusCode).toBe(0);
        expect((await tv(`/vd/2/video?cast=${tokenOther}`)).statusCode).toBe(0);

        // Deleting the display ends every token of it, not another's.
        service.delete(1);
        expect(service.issueCastToken(1, 'browser-b')).not.toBe(tokenB);
        expect(service.issueCastToken(2, 'browser-a')).toBe(tokenOther);
    });

    test('a cast token expires after a day, and at most 256 are kept', () => {
        const service = createService();
        service.create({ name: 'A' });
        const first = service.issueCastToken(1, 'browser-1');
        vi.advanceTimersByTime(CAST_TOKEN_MILLISECOND + 1);
        const renewed = service.issueCastToken(1, 'browser-1');
        expect(renewed).not.toBe(first);

        const tokens = Array.from({ length: 256 }, (_, index) => {
            return service.issueCastToken(1, `browser-x-${index}`);
        });
        expect((service as any).castTokens.size).toBe(256);
        // The oldest made room; the newest is still the same one.
        expect(service.issueCastToken(1, 'browser-1')).not.toBe(renewed);
        expect(service.issueCastToken(1, 'browser-x-255')).toBe(tokens[255]);
        expect((service as any).castTokens.size).toBe(256);
    });

    test('a blank connection code is not stored and asks nobody again', async () => {
        const service = createService();
        const revokeGrants = vi.spyOn(webViewersOf(service), 'revokeGrants');
        await service['runCommand']({ action: 'code', code: '   ' });
        await service['runCommand']({ action: 'code', code: 1234 });
        expect(fixture.secure.size).toBe(0);
        expect(service.state().hasCode).toBe(false);
        expect(revokeGrants).not.toHaveBeenCalled();
        await service['runCommand']({ action: 'code', code: ' 4321 ' });
        expect(fixture.secure.get(VIRTUAL_DISPLAY_CODE_KEY)).toBe('4321');
        expect(revokeGrants).toHaveBeenCalledOnce();
    });

    test('disconnecting a client nobody knows changes nothing; a preview player is not kept out', async () => {
        const service = createService();
        service.create({ name: 'A' });
        service.disconnect(1, 'nobody');
        service.disconnect(7, 'nobody');
        const preview = await request(service, '/vd/1/video?preview=1');
        service.disconnect(1, 'nobody');
        expect(clientsOf(service)).toHaveLength(1);
        const [client] = clientsOf(service);
        service.disconnect(1, client.id);
        expect(preview.isEnded).toBe(true);
        expect(clientsOf(service)).toEqual([]);
        expect(service.state().displays[0].blocked).toEqual([]);
    });

    test('sharing turned off ends players from the network, not those on this computer', async () => {
        mirror.isVirtualDisplayShareEnabled = true;
        const service = createService();
        service.create({ name: 'A' });
        const local = await request(service, '/vd/1/video', {
            network: 'local',
            address: '192.168.1.5',
        });
        const here = await request(service, '/vd/1/video');
        mirror.isVirtualDisplayShareEnabled = false;
        service.onNetworkChanged();
        expect(local.isEnded).toBe(true);
        expect(here.isEnded).toBe(false);
        expect(clientsOf(service)).toEqual([
            expect.objectContaining({ network: 'this-computer' }),
        ]);
    });
});

describe("the operator's Allow", () => {
    test('a disconnected browser asking to come back has its block lifted first', async () => {
        const service = createService();
        service.create({ name: 'A' });
        const webViewers = webViewersOf(service);
        vi.spyOn(webViewers, 'disconnect').mockImplementation(
            (id: any) =>
                ({ id, isPreview: false, address: '198.51.100.4' }) as any,
        );
        service.disconnect(1, 'browser-1');
        expect(webViewers.host.checkIsBlocked(1, 'browser-1')).toBe(true);
        vi.spyOn(webViewers, 'checkIsWaitingForApproval').mockImplementation(
            (id: any, number: any) => id === 'browser-1' && number === 1,
        );
        const allow = vi.spyOn(webViewers, 'allow');
        await service['runCommand']({
            action: 'allow',
            number: '1',
            clientId: 'browser-1',
        });
        expect(allow).toHaveBeenCalledWith('browser-1', 1);
        expect(webViewers.host.checkIsBlocked(1, 'browser-1')).toBe(false);
        expect(service.state().displays[0].blocked).toEqual([]);
    });

    test('a waiting player that hangs up is forgotten, and its timer with it', async () => {
        mirror.isVirtualDisplayShareEnabled = true;
        mirror.isInternetEnabled = true;
        const service = createService();
        service.create({ name: 'A' });
        const res = await request(service, '/vd/1/video', {
            network: 'internet',
            address: '198.51.100.9',
        });
        const [client] = clientsOf(service);
        expect(client.waiting).toBe('approval');
        res.emit('close');
        expect(clientsOf(service)).toEqual([]);
        await service.allow(1, client.id);
        expect(electronMockState.BrowserWindowMock).not.toHaveBeenCalled();
        vi.advanceTimersByTime(5 * 60 * 1000 + 1);
        expect(res.statusCode).toBe(0);
    });

    test('Allow for a player that already hung up starts nothing, but lets its address in', async () => {
        mirror.isVirtualDisplayShareEnabled = true;
        mirror.isInternetEnabled = true;
        const service = createService();
        service.create({ name: 'A' });
        const res = await request(service, '/vd/1/video', {
            network: 'internet',
            address: '198.51.100.9',
        });
        const [client] = clientsOf(service);
        res.writableEnded = true;
        await service.allow(1, client.id);
        expect(electronMockState.BrowserWindowMock).not.toHaveBeenCalled();
        expect(clientsOf(service)).toEqual([]);
        // Its address was let in: the next connection from it is not held.
        await request(service, '/vd/1/video', {
            network: 'internet',
            address: '198.51.100.9',
        });
        expect(clientsOf(service)).toEqual([
            expect.objectContaining({ waiting: null }),
        ]);
        expect(electronMockState.BrowserWindowMock).toHaveBeenCalledTimes(1);
    });

    test('an iPhone from the internet waits, and Allow answers it with HLS', async () => {
        mirror.isVirtualDisplayShareEnabled = true;
        mirror.isInternetEnabled = true;
        const service = createService();
        service.create({ name: 'A' });
        const master = await request(service, '/vd/1/video', {
            network: 'internet',
            address: '198.51.100.9',
            headers: { 'user-agent': IPHONE },
        });
        const [client] = clientsOf(service);
        expect(client.waiting).toBe('approval');
        expect(sessionOf(service).hls).toBeNull();
        await service.allow(1, client.id);
        expect(master.statusCode).toBe(0);
        sessionOf(service).fanout.push(INIT);
        expect(master.statusCode).toBe(200);
        expect(String(master.body)).toContain('#EXT-X-STREAM-INF:');
        expect(clientsOf(service)[0].waiting).toBeNull();
    });

    test('the addresses let in are capped at 256, the oldest going first', async () => {
        mirror.isVirtualDisplayShareEnabled = true;
        mirror.isInternetEnabled = true;
        const service = createService();
        service.create({ name: 'A' });
        const grants: Set<string> = (service as any).playerGrants;
        for (let index = 0; index < 256; index++) {
            grants.add(`1|203.0.113.${index}`);
        }
        await request(service, '/vd/1/video', {
            network: 'internet',
            address: '198.51.100.9',
        });
        const [client] = clientsOf(service);
        await service.allow(1, client.id);
        expect(grants.size).toBe(256);
        expect(grants.has('1|198.51.100.9')).toBe(true);
        expect(grants.has('1|203.0.113.0')).toBe(false);
        // The address that made room is asked again; the next one is not.
        await request(service, '/vd/1/video', {
            network: 'internet',
            address: '203.0.113.0',
        });
        await request(service, '/vd/1/video', {
            network: 'internet',
            address: '203.0.113.1',
        });
        const byAddress = (address: string) => {
            return clientsOf(service).find((item) => item.address === address);
        };
        expect(byAddress('203.0.113.0')?.waiting).toBe('approval');
        expect(byAddress('203.0.113.1')?.waiting).toBeNull();
    });
});

describe('HLS beside MP4', () => {
    async function startPhone(service: VirtualDisplayService, address: string) {
        mirror.isVirtualDisplayShareEnabled = true;
        return request(service, '/vd/1/video', {
            network: 'local',
            address,
            headers: { 'user-agent': IPHONE },
        });
    }

    test('a second iPhone is answered at once once the codecs are known', async () => {
        const service = createService();
        service.create({ name: 'A' });
        const first = await startPhone(service, '192.168.1.5');
        const session = sessionOf(service);
        const hls = session.hls;
        session.fanout.push(INIT);
        expect(first.statusCode).toBe(200);
        const second = await startPhone(service, '192.168.1.6');
        expect(second.statusCode).toBe(200);
        expect(session.hls).toBe(hls);
        expect(tokenOf(second)).not.toBe(tokenOf(first));
        expect(electronMockState.BrowserWindowMock).toHaveBeenCalledTimes(1);
    });

    test('an iPhone disconnected before the stream started is answered 404', async () => {
        const service = createService();
        service.create({ name: 'A' });
        const master = await startPhone(service, '192.168.1.5');
        const session = sessionOf(service);
        expect(master.statusCode).toBe(0);
        const [client] = clientsOf(service);
        service.disconnect(1, client.id);
        expect(master.statusCode).toBe(404);
        expect(master.isEnded).toBe(true);
        expect(session.hls).toBeNull();
        // Its 20-second wait went with it.
        vi.advanceTimersByTime(20001);
        expect(master.statusCode).toBe(404);
    });

    test('an MP4 player disconnected beside an iPhone ends only itself', async () => {
        const service = createService();
        service.create({ name: 'A' });
        const phone = await startPhone(service, '192.168.1.5');
        const session = sessionOf(service);
        session.fanout.push(INIT);
        const mp4 = await request(service, '/vd/1/video', {
            network: 'local',
            address: '192.168.1.7',
        });
        const player = clientsOf(service).find(
            (item) => item.address === '192.168.1.7',
        )!;
        service.disconnect(1, player.id);
        expect(mp4.isEnded).toBe(true);
        expect(session.hls).not.toBeNull();
        expect(phone.statusCode).toBe(200);
        expect(clientsOf(service)).toEqual([
            expect.objectContaining({ address: '192.168.1.5' }),
        ]);
    });
});

describe('commands and IPC', () => {
    test('HTTPS, disconnect, unblock and interaction run from commands', async () => {
        mirror.isVirtualDisplayShareEnabled = true;
        const service = createService();
        service.create({ name: 'A' });
        await service['runCommand']({ action: 'https', enabled: true });
        await service['runCommand']({ action: 'https', enabled: 'yes' });
        expect(mirror.setHttpsEnabled.mock.calls).toEqual([[true], [false]]);

        const res = await request(service, '/vd/1/video', {
            network: 'local',
            address: '192.168.1.5',
        });
        const [client] = clientsOf(service);
        await service['runCommand']({
            action: 'disconnect',
            number: 1,
            clientId: client.id,
        });
        expect(res.isEnded).toBe(true);
        const [entry] = service.state().displays[0].blocked;
        expect(entry).toMatchObject({ kind: 'video', address: '192.168.1.5' });
        const unblocked = await service['runCommand']({
            action: 'unblock',
            number: '1',
            key: entry.key,
        });
        expect(unblocked.displays[0].blocked).toEqual([]);

        const setInteractive = vi.spyOn(
            webViewersOf(service),
            'setInteractive',
        );
        await service['runCommand']({
            action: 'interactive',
            number: '1',
            clientId: 'browser-1',
            enabled: true,
        });
        await service['runCommand']({
            action: 'interactive',
            number: 1,
            clientId: 'browser-1',
        });
        expect(setInteractive.mock.calls).toEqual([
            ['browser-1', 1, true],
            ['browser-1', 1, false],
        ]);
    });

    test("a window watches a browser's camera until it is destroyed", () => {
        const service = createService();
        service.initIpc();
        const cameras = (service as any).viewerCameras;
        const watch = vi.spyOn(cameras, 'watch');
        const forgetWatcher = vi.spyOn(cameras, 'forgetWatcher');
        const sender = { id: 31, once: vi.fn() };
        const cameraWatch = ipcListener('vd:camera-watch');

        mirror.trusted.mockReturnValue(false);
        cameraWatch({ sender }, { cameraId: 'vd-camera:viewer-1' });
        mirror.trusted.mockReturnValue(true);
        cameraWatch({ sender }, { cameraId: 42, isWatching: true });
        cameraWatch({ sender }, null);
        expect(watch).not.toHaveBeenCalled();

        cameraWatch(
            { sender },
            { cameraId: 'vd-camera:viewer-1', isWatching: true },
        );
        cameraWatch(
            { sender },
            { cameraId: 'vd-camera:viewer-2', isWatching: true },
        );
        cameraWatch(
            { sender },
            { cameraId: 'vd-camera:viewer-2', isWatching: 'yes' },
        );
        expect(watch.mock.calls).toEqual([
            ['window:31', 'vd-camera:viewer-1', true],
            ['window:31', 'vd-camera:viewer-2', true],
            ['window:31', 'vd-camera:viewer-2', false],
        ]);
        // One goodbye per window, however many cameras it watches.
        expect(sender.once).toHaveBeenCalledTimes(1);
        const [eventName, destroyed] = sender.once.mock.calls[0];
        expect(eventName).toBe('destroyed');
        destroyed();
        expect(forgetWatcher).toHaveBeenCalledWith('window:31');
        cameraWatch(
            { sender },
            { cameraId: 'vd-camera:viewer-1', isWatching: true },
        );
        expect(sender.once).toHaveBeenCalledTimes(2);
    });

    test('a command that fails replies with its error', async () => {
        const service = createService();
        service.initIpc();
        const command = ipcListener('vd:command');
        const sender = { isDestroyed: () => false, send: vi.fn() };
        command(
            { sender },
            {
                action: 'cast-start',
                number: 9,
                targetId: TV.id,
                replyEventName: 'reply',
            },
        );
        await vi.waitFor(() => expect(sender.send).toHaveBeenCalledTimes(1));
        const [channel, error] = sender.send.mock.calls[0];
        expect(channel).toBe('reply');
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Virtual display not found');

        // Not an Error: made one.
        mirror.setHttpsEnabled.mockRejectedValueOnce('port busy');
        command(
            { sender },
            { action: 'https', enabled: true, replyEventName: 'reply' },
        );
        await vi.waitFor(() => expect(sender.send).toHaveBeenCalledTimes(2));
        expect(sender.send.mock.calls[1][1]).toBeInstanceOf(Error);
        expect(sender.send.mock.calls[1][1].message).toBe('port busy');

        // No reply name, or a window gone: nothing is sent.
        command({ sender }, { action: 'create', name: 'Quiet' });
        const gone = { isDestroyed: () => true, send: vi.fn() };
        command(
            { sender: gone },
            { action: 'create', name: 'Gone', replyEventName: 'reply' },
        );
        command({ sender }, null);
        await vi.waitFor(() =>
            expect(service.state().displays).toHaveLength(2),
        );
        expect(sender.send).toHaveBeenCalledTimes(2);
        expect(gone.send).not.toHaveBeenCalled();
    });

    test('what a page that is not a compositor sends is ignored, as is a stale or odd report', async () => {
        const service = createService();
        service.create({ name: 'A' });
        service.initIpc();
        await request(service, '/vd/1/video');
        const [window] = electronMockState.browserWindows;
        const contents = window.webContents;
        const session = sessionOf(service);
        const push = vi.spyOn(session.fanout, 'push');
        const stranger = createMockWebContents();

        ipcListener('vd:compositor-ready')({ sender: stranger });
        expect(stranger.send).not.toHaveBeenCalled();
        expect(session.isReady).toBe(false);

        const chunk = ipcListener('vd:chunk');
        const generation = session.generation;
        chunk({ sender: stranger }, { generation, data: Uint8Array.of(1) });
        chunk(
            { sender: contents },
            { generation: generation + 1, data: Uint8Array.of(1) },
        );
        chunk({ sender: contents }, { generation, data: [1, 2, 3] });
        chunk({ sender: contents }, null);
        expect(push).not.toHaveBeenCalled();

        const encoder = ipcListener('vd:encoder');
        encoder({ sender: stranger }, { generation, state: 'live' });
        encoder(
            { sender: contents },
            { generation: generation + 1, state: 'live' },
        );
        encoder({ sender: contents }, { generation, state: 'paused' });
        expect(service.state().displays[0].stream).toBe('starting');

        encoder(
            { sender: contents },
            { generation, state: 'live', mimeType: 42 },
        );
        expect(service.state().displays[0]).toMatchObject({
            stream: 'live',
            mimeType: null,
        });
        encoder({ sender: contents }, { generation, state: 'error' });
        expect(service.state().displays[0]).toMatchObject({
            stream: 'error',
            error: 'The virtual display stopped',
        });
    });

    test('a registered page with no display of its own is not heard', () => {
        const service = createService();
        service.create({ name: 'A' });
        service.initIpc();
        const orphan = { ...createMockWebContents(), id: 777001 };
        markVirtualDisplayHost(orphan as any);
        const event = { sender: orphan, returnValue: undefined as unknown };
        ipcListener('vd:compositor-ready')(event);
        ipcListener('vd:audio-target')(event, 7);
        expect(event.returnValue).toBe(false);
        expect(orphan.send).not.toHaveBeenCalled();
    });

    test('a screen page in the compositor: popups denied, kept on its page, freed when destroyed', async () => {
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const service = createService();
        service.create({ name: 'A' });
        const controller: any = service.attachScreen(7, -500001);
        service.initIpc();
        await request(service, '/vd/1/video');
        const [window] = electronMockState.browserWindows;
        const guest = {
            hostWebContents: window.webContents,
            mainFrame: {},
            setAudioMuted: vi.fn(),
            setWindowOpenHandler: vi.fn(),
            on: vi.fn(),
            once: vi.fn(),
        };
        electronMockState.webContentsModule.fromId.mockReturnValue(guest);
        const event = { sender: window.webContents, returnValue: undefined };
        ipcListener('vd:guest')(event, { screenId: 7, webContentsId: 44 });
        expect(event.returnValue).toBe(true);
        expect(controller.guest).toBe(guest);

        const [openHandler] = guest.setWindowOpenHandler.mock.calls[0];
        expect(openHandler()).toEqual({ action: 'deny' });

        const navigate = eventListener(guest.on, 'will-navigate')!;
        const away = { preventDefault: vi.fn() };
        navigate(away, 'https://outside.example/');
        expect(away.preventDefault).toHaveBeenCalledOnce();
        const own = { preventDefault: vi.fn() };
        navigate(own, 'owa://screen.html?screenId=7&reloaded=1');
        expect(own.preventDefault).not.toHaveBeenCalled();

        eventListener(guest.on, 'console-message')!({}, 3, 'guest failed');
        expect(consoleError).toHaveBeenCalledWith(
            '[virtual display screen 7]',
            'guest failed',
        );

        eventListener(guest.once, 'destroyed')!();
        expect(controller.guest).toBeNull();
    });
});

describe('the hooks given to the Screen Mirror server', () => {
    test('route, upgrade, admission and network changes reach the service', async () => {
        initVirtualDisplays(undefined);
        expect(getVirtualDisplays()).toBeUndefined();
        expect(mirror.setVirtualDisplayHooks).not.toHaveBeenCalled();

        initVirtualDisplays(mirror as unknown as ScreenMirrorService);
        const service = getVirtualDisplays()!;
        services.push(service);
        expect(service).toBeInstanceOf(VirtualDisplayService);
        expect(ipcListener('vd:state')).toBeTypeOf('function');
        const [hooks] = mirror.setVirtualDisplayHooks.mock.calls[0] as any[];
        service.create({ name: 'Lobby' });

        const res = new FakeResponse();
        await hooks.route(
            toRequest(),
            res,
            new URL('/vd/1', BASE_URL),
            'this-computer',
        );
        expect(res.statusCode).toBe(301);
        expect(res.headers.Location).toBe('/vd/1/');

        // Not a viewer socket's address: the connection is dropped.
        const socket = { destroy: vi.fn() };
        hooks.upgrade(
            { ...toRequest(), url: '/vd/1/video' },
            socket,
            Buffer.alloc(0),
            'local',
        );
        expect(socket.destroy).toHaveBeenCalledOnce();

        expect(hooks.admits('this-computer')).toBe(true);
        expect(hooks.admits('local')).toBe(false);
        mirror.isVirtualDisplayShareEnabled = true;
        expect(hooks.admits('local')).toBe(true);
        expect(hooks.admits('internet')).toBe(false);
        mirror.isInternetEnabled = true;
        expect(hooks.admits('internet')).toBe(true);

        const closeNotAdmitted = vi.spyOn(
            webViewersOf(service),
            'closeNotAdmitted',
        );
        hooks.onNetworkChanged();
        expect(closeNotAdmitted).toHaveBeenCalledOnce();
    });
});
