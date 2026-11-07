import { EventEmitter } from 'node:events';
import type http from 'node:http';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The corners of `virtualDisplayService.ts` its main suite leaves out: what
// the browser viewers are handed, a compositor that crashes or closes, a
// player that leaves while it starts, the internet's waiting players and
// cast tokens, the caps on what is remembered, the HLS waits, the operator's
// rarer commands and the hooks Screen Mirror is given. The browser viewers
// and the viewers' cameras are stand-ins built here, so what the service
// tells them is read directly; the fan-out and HLS segmenter are the real
// ones, fed real fMP4 boxes.

const { fixture } = vi.hoisted(() => ({
    fixture: {
        client: new Map<string, string>(),
        secure: new Map<string, string>(),
        // Every client setting written, by key, in order.
        writes: [] as string[],
        webViewers: null as any,
        webViewerOptions: null as any,
        webClients: [] as any[],
        viewerCameras: null as any,
        cameraLabels: {} as Record<string, string>,
        wallpaperReads: [] as unknown[][],
        wallpaperAnswer: null as string | null,
        castTargets: [] as any[],
        castSearches: 0,
        loadedUrls: [] as string[],
    },
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
                fixture.writes.push(key);
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
    genWebPreferences: () => ({}),
    messageChannels: { screenMessage: 'screen-message' },
}));
vi.mock('./protocolHelpers', () => ({
    genRouteUrl: (name: string, query: string) => `owa://${name}.html${query}`,
    genRoutProps: () => ({
        preloadFilePath: '/preload.js',
        loadURL: (_win: unknown, query: string) => {
            fixture.loadedUrls.push(query);
        },
    }),
}));
vi.mock('./fsServe', () => ({
    htmlFiles: { virtualDisplay: 'virtual-display', screen: 'screen' },
}));
vi.mock('./displayWallpaperHelpers', () => ({
    readVirtualDisplayWallpaper: async (wallpaper: unknown, width: unknown) => {
        fixture.wallpaperReads.push([wallpaper, width]);
        return fixture.wallpaperAnswer;
    },
}));
// A screen on a virtual display, with no page: what the service reads and
// sets on one.
vi.mock('./VirtualScreenController', () => ({
    default: class {
        guest: any = null;
        sockets = new Set<{ close: (code: number, reason: string) => void }>();
        order = 0;
        isLive = false;
        notedCameras: unknown[] = [];
        constructor(
            readonly screenId: number,
            public displayNumber: number,
            private readonly onDetach: (controller: any) => void,
        ) {}
        noteCameras(messages: unknown) {
            this.notedCameras.push(messages);
        }
        capture() {
            return null;
        }
        close() {
            this.onDetach(this);
        }
    },
}));
vi.mock('./virtualDisplayWebViewers', () => ({
    VirtualDisplayWebViewers: class {
        allow = vi.fn();
        checkIsLetIn = vi.fn(() => false);
        checkIsWaitingForApproval = vi.fn(() => false);
        closeAll = vi.fn();
        closeNotAdmitted = vi.fn();
        disconnect = vi.fn((_clientId: string): any => null);
        listOf = vi.fn(() => fixture.webClients);
        revokeGrants = vi.fn();
        sendCamera = vi.fn();
        sendCastStates = vi.fn();
        sendIntercom = vi.fn();
        sendLayout = vi.fn();
        sendScreenCamera = vi.fn();
        setInteractive = vi.fn();
        upgrade = vi.fn();
        constructor(options: unknown) {
            fixture.webViewerOptions = options;
            fixture.webViewers = this;
        }
    },
}));
vi.mock('./virtualDisplayViewerCameras', () => ({
    ViewerCameras: class {
        watch = vi.fn();
        forgetWatcher = vi.fn();
        drop = vi.fn();
        receive = vi.fn();
        list = vi.fn(() => []);
        labelOf = vi.fn((viewerId: string) => {
            return fixture.cameraLabels[viewerId] ?? null;
        });
        constructor() {
            fixture.viewerCameras = this;
        }
    },
}));
// No network: the TVs a search finds are whatever the test says.
vi.mock('./castTargets', () => ({
    discoverCastTargets: async () => {
        fixture.castSearches += 1;
        return fixture.castTargets;
    },
    startCastSession: () => {
        throw new Error('No TV is cast to in this suite');
    },
}));

import {
    VIDEO_TIMESCALE,
    VIDEO_TRACK_ID,
    buildFragment,
    buildInitSegment,
    toAudioSpecificConfig,
} from '../src/virtual-display/fmp4Muxer';
import { electronMockState } from './testElectronModule';
import type { ScreenMirrorService } from './screenMirrorService';
import { markVirtualDisplayHost } from './virtualDisplayHostRegistry';
import type { VirtualDisplayNetwork } from './virtualDisplayProtocol';
import {
    VirtualDisplayService,
    getVirtualDisplays,
    initVirtualDisplays,
} from './virtualDisplayService';

const DISPLAY_ID = -500001;
const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) ' +
    'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 ' +
    'Mobile/15E148 Safari/604.1';
const PHONE = {
    network: 'local' as const,
    address: '192.168.1.5',
    headers: { 'user-agent': IPHONE },
};
const FROM_INTERNET = { network: 'internet' as const, address: '203.0.113.5' };

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

// A page's WebContents: ids unique for the whole file, since the host
// registry remembers them.
let nextContentsId = 1000;
function makeContents() {
    const listeners = new Map<string, (...args: any[]) => void>();
    const onceCalls: [string, (...args: any[]) => void][] = [];
    const contents = {
        id: nextContentsId++,
        sent: [] as unknown[][],
        isDestroyedFlag: false,
        isMuted: false,
        hostWebContents: undefined as unknown,
        mainFrame: {},
        windowOpenHandler: null as null | (() => unknown),
        listeners,
        onceCalls,
        on(eventName: string, listener: (...args: any[]) => void) {
            listeners.set(eventName, listener);
            return contents;
        },
        once(eventName: string, listener: (...args: any[]) => void) {
            onceCalls.push([eventName, listener]);
            return contents;
        },
        send(...args: unknown[]) {
            contents.sent.push(args);
        },
        setWindowOpenHandler(handler: () => unknown) {
            contents.windowOpenHandler = handler;
        },
        setAudioMuted(isMuted: boolean) {
            contents.isMuted = isMuted;
        },
        isDestroyed() {
            return contents.isDestroyedFlag;
        },
    };
    return contents;
}
type FakeContents = ReturnType<typeof makeContents>;

// A compositor window, as `new BrowserWindow` hands the service one.
function makeWindow() {
    const listeners = new Map<string, () => void>();
    const win = {
        webContents: makeContents(),
        listeners,
        destroyCount: 0,
        isDestroyedFlag: false,
        on(eventName: string, listener: () => void) {
            listeners.set(eventName, listener);
            return win;
        },
        setContentSize() {},
        isDestroyed() {
            return win.isDestroyedFlag;
        },
        destroy() {
            win.destroyCount += 1;
            win.isDestroyedFlag = true;
        },
    };
    return win;
}
type FakeWindow = ReturnType<typeof makeWindow>;

function windows() {
    return electronMockState.browserWindows as FakeWindow[];
}

// A stand-in Screen Mirror: the service only reads these. Its port is a
// number, nothing is bound.
function createMirror() {
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
        trusted: vi.fn(() => true),
        setVirtualDisplayShareEnabled: vi.fn(async () => {}),
        setHttpsEnabled: vi.fn(async () => {}),
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
        tunnelState: { status: 'off', url: '', error: '' },
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
        checkSenderCode: vi.fn(() => 'wrong'),
        checkIsSenderLockedOut: vi.fn(() => false),
    };
}

class FakeResponse extends EventEmitter {
    headersSent = false;
    statusCode = 0;
    headers: Record<string, string> = {};
    writableLength = 0;
    writableEnded = false;
    destroyed = false;
    isEnded = false;
    body: unknown = undefined;
    setHeader() {
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
        if (!this.destroyed) {
            this.destroyed = true;
            this.emit('close');
        }
        return this;
    }
}

let mirror: ReturnType<typeof createMirror>;
let services: VirtualDisplayService[];
let consoleError: ReturnType<typeof vi.spyOn>;

function createService() {
    const service = new VirtualDisplayService(
        mirror as unknown as ScreenMirrorService,
    );
    services.push(service);
    return service;
}

function ipcListener(channel: string) {
    return electronMockState.ipcMain.on.mock.calls
        .filter(([name]) => name === channel)
        .at(-1)?.[1] as (...args: any[]) => void;
}

// A request the service answers through `route`, not waited for.
function startRequest(
    service: VirtualDisplayService,
    path: string,
    {
        network = 'this-computer' as VirtualDisplayNetwork,
        address = '127.0.0.1',
        method = 'GET',
        headers = {} as Record<string, string>,
    } = {},
) {
    const res = new FakeResponse();
    const done = service.route(
        {
            method,
            headers: { 'user-agent': 'Player/1.0', ...headers },
            socket: { remoteAddress: address },
        } as unknown as http.IncomingMessage,
        res as unknown as http.ServerResponse,
        new URL(path, 'http://127.0.0.1:40000'),
        network,
    );
    return { res, done };
}

async function request(
    service: VirtualDisplayService,
    path: string,
    options: Parameters<typeof startRequest>[2] = {},
) {
    const { res, done } = startRequest(service, path, options);
    await done;
    return res;
}

function clientsOf(service: VirtualDisplayService) {
    return service.state().displays[0].clients;
}

function clientAt(service: VirtualDisplayService, address: string) {
    return clientsOf(service).find((client) => client.address === address);
}

function blockedKeys(service: VirtualDisplayService) {
    return service.state().displays[0].blocked.map((entry) => entry.key);
}

// What the compositor page sends back, from the window the service made.
function feed(win: FakeWindow, data: unknown, generation = 1) {
    ipcListener('vd:chunk')({ sender: win.webContents }, { generation, data });
}

function generationOf(win: FakeWindow) {
    const encode = win.webContents.sent.find(([channel, message]) => {
        return (
            channel === 'vd:compositor' && (message as any).type === 'encode'
        );
    });
    return (encode?.[1] as any).options.generation as number;
}

function tokenOf(master: FakeResponse) {
    return /^hls\/([a-f0-9]{32})\/index\.m3u8$/m.exec(String(master.body))![1];
}

async function settle() {
    for (let index = 0; index < 20; index++) {
        await Promise.resolve();
    }
}

function command(sender: FakeContents, data: Record<string, unknown>) {
    ipcListener('vd:command')(
        { sender },
        { replyEventName: 'vd:reply', ...data },
    );
}

function openToInternet() {
    mirror.isVirtualDisplayShareEnabled = true;
    mirror.isInternetEnabled = true;
}

beforeEach(() => {
    vi.useFakeTimers();
    fixture.client.clear();
    fixture.secure.clear();
    fixture.writes = [];
    fixture.webViewers = null;
    fixture.webViewerOptions = null;
    fixture.webClients = [];
    fixture.viewerCameras = null;
    fixture.cameraLabels = {};
    fixture.wallpaperReads = [];
    fixture.wallpaperAnswer = null;
    fixture.castTargets = [];
    fixture.castSearches = 0;
    fixture.loadedUrls = [];
    electronMockState.reset();
    electronMockState.setBrowserWindowFactory(makeWindow);
    mirror = createMirror();
    services = [];
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    for (const service of services) {
        service.stop();
    }
    vi.clearAllTimers();
    vi.useRealTimers();
    consoleError.mockRestore();
});

describe('a compositor’s page and the screen pages in it', () => {
    test('its errors go to the log, and only its errors', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        await request(service, '/vd/1/video');
        const log = windows()[0].webContents.listeners.get('console-message')!;

        // Older Electron passes the level and the text; newer, the event.
        log({}, 3, 'x'.repeat(600));
        log({ level: 'error', message: 'Boom' });
        log({ level: 3, message: 7 });
        log({}, 1, 'just saying');
        log({ level: 'warning', message: 'careful' });

        expect(consoleError.mock.calls).toEqual([
            ['[virtual display 1]', 'x'.repeat(500)],
            ['[virtual display 1]', 'Boom'],
            ['[virtual display 1]', '7'],
        ]);
    });

    test('a screen page is muted, kept to its own address, logged, and let go when it goes', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        const controller = service.attachScreen(7, DISPLAY_ID) as any;
        service.initIpc();
        await request(service, '/vd/1/video');
        const [win] = windows();
        const guest = makeContents();
        guest.hostWebContents = win.webContents;
        electronMockState.webContentsModule.fromId.mockReturnValue(guest);
        const event = { sender: win.webContents, returnValue: undefined };

        ipcListener('vd:guest')(event, {
            screenId: 7,
            webContentsId: guest.id,
        });

        expect(event.returnValue).toBe(true);
        expect(guest.isMuted).toBe(true);
        expect(guest.windowOpenHandler?.()).toEqual({ action: 'deny' });
        expect(controller.guest).toBe(guest);
        const navigate = guest.listeners.get('will-navigate')!;
        const away = { preventDefault: vi.fn() };
        navigate(away, 'https://outside.example/');
        expect(away.preventDefault).toHaveBeenCalledOnce();
        const own = { preventDefault: vi.fn() };
        navigate(own, 'owa://screen.html?screenId=7#again');
        expect(own.preventDefault).not.toHaveBeenCalled();
        guest.listeners.get('console-message')!({}, 3, 'screen failed');
        expect(consoleError).toHaveBeenLastCalledWith(
            '[virtual display screen 7]',
            'screen failed',
        );
        const [eventName, destroyed] = guest.onceCalls[0];
        expect(eventName).toBe('destroyed');
        destroyed();
        expect(controller.guest).toBeNull();
    });
});

describe('what the browser viewers are handed', () => {
    test('a change a viewer made is told to the app once, after the burst', () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        vi.advanceTimersByTime(300);
        mirror.broadcast.mockClear();
        fixture.webViewers.sendCastStates.mockClear();

        fixture.webViewerOptions.onChanged();
        fixture.webViewerOptions.onChanged();
        expect(mirror.broadcast).not.toHaveBeenCalled();
        vi.advanceTimersByTime(50);

        expect(mirror.broadcast).toHaveBeenCalledOnce();
        expect(mirror.broadcast).toHaveBeenCalledWith(
            'vd:state',
            service.state(),
        );
        expect(fixture.webViewers.sendCastStates).toHaveBeenCalledOnce();
    });

    test('a page’s look for TVs waits five seconds after the last one', async () => {
        createService();
        fixture.castTargets = [{ id: 'tv-1', name: 'Hall TV', kind: 'dlna' }];

        fixture.webViewerOptions.onCastSearch();
        await settle();
        expect(fixture.castSearches).toBe(1);
        expect(fixture.webViewerOptions.getCastState(1).targets).toEqual([
            {
                id: 'tv-1',
                name: 'Hall TV',
                kind: 'dlna',
                status: null,
                behind: null,
            },
        ]);
        // Too soon: the page is told what is already known.
        vi.advanceTimersByTime(4999);
        fixture.webViewers.sendCastStates.mockClear();
        fixture.webViewerOptions.onCastSearch();
        await settle();
        expect(fixture.castSearches).toBe(1);
        expect(fixture.webViewers.sendCastStates).toHaveBeenCalledOnce();

        vi.advanceTimersByTime(1);
        fixture.webViewerOptions.onCastSearch();
        await settle();
        expect(fixture.castSearches).toBe(2);
    });

    test('pages opening together share one load of a screen’s state', async () => {
        const service = createService();
        service.create({ name: 'Lobby', width: 1280, height: 720 });
        const controller = service.attachScreen(7, DISPLAY_ID) as any;
        const messages = [{ type: 'camera', data: { cameraId: 'cam-1' } }];
        mirror.getOutputContext.mockReturnValue({
            screenId: 7,
            messages,
            resources: {},
        });

        const first = fixture.webViewerOptions.loadContext(1, 7);
        const second = fixture.webViewerOptions.loadContext(1, 7);

        expect(second).toBe(first);
        expect(await first).toEqual({
            screenId: 7,
            messages,
            resources: {},
            hostId: mirror.id,
            display: {
                id: DISPLAY_ID,
                label: 'Lobby 1',
                width: 1280,
                height: 720,
            },
        });
        expect(mirror.refreshContext).toHaveBeenCalledOnce();
        // What it shows before any live message says so.
        expect(controller.notedCameras).toEqual([messages]);

        // Two seconds on, a page opening asks afresh.
        vi.advanceTimersByTime(2000);
        mirror.getOutputContext.mockReturnValue({ screenId: 7 });
        await fixture.webViewerOptions.loadContext(1, 7);
        expect(mirror.refreshContext).toHaveBeenCalledTimes(2);
        expect(controller.notedCameras).toEqual([messages, []]);
    });

    test('a state that cannot be refreshed is still read; no state or no display is nothing', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        service.create({ name: 'Hall' });
        const controller = service.attachScreen(7, DISPLAY_ID) as any;
        const failure = new Error('screen 7 is busy');
        mirror.refreshContext.mockRejectedValueOnce(failure);
        mirror.getOutputContext.mockReturnValue({ screenId: 7, messages: [] });

        expect(await fixture.webViewerOptions.loadContext(1, 7)).toMatchObject({
            screenId: 7,
            display: { label: 'Lobby 1' },
        });
        expect(consoleError).toHaveBeenCalledWith('Virtual display:', failure);

        // Asked from another display: its own size, and not its cameras.
        controller.notedCameras.length = 0;
        expect(await fixture.webViewerOptions.loadContext(2, 8)).toMatchObject({
            display: { label: 'Hall 2' },
        });
        expect(controller.notedCameras).toEqual([]);

        mirror.getOutputContext.mockReturnValue(null);
        expect(await fixture.webViewerOptions.loadContext(1, 9)).toBeNull();
        mirror.getOutputContext.mockReturnValue({ screenId: 10 });
        expect(await fixture.webViewerOptions.loadContext(5, 10)).toBeNull();
    });

    test('their sockets go to the viewers, and who is let in is the service’s', () => {
        const service = createService();
        const req = {} as http.IncomingMessage;
        const socket = {} as any;
        const head = Buffer.alloc(0);

        service.upgrade(req, socket, head, 'local');

        expect(fixture.webViewers.upgrade).toHaveBeenCalledWith(
            req,
            socket,
            head,
            'local',
        );
        expect(service.checkIsViewerAdmitted('this-computer')).toBe(true);
        expect(service.checkIsViewerAdmitted('local')).toBe(false);
        mirror.isVirtualDisplayShareEnabled = true;
        expect(service.checkIsViewerAdmitted('local')).toBe(true);
        expect(service.checkIsViewerAdmitted('internet')).toBe(false);
        mirror.isInternetEnabled = true;
        expect(service.checkIsViewerAdmitted('internet')).toBe(true);
    });
});

describe('displays, their wallpapers and their microphone', () => {
    test('a cast to a display that is not there fails', async () => {
        const service = createService();

        await expect(service.startCast(9, 'tv-1')).rejects.toThrow(
            'Virtual display not found',
        );
    });

    test('macOS is asked before the microphone goes into the MP4, and a no keeps it off', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        const ask = electronMockState.systemPreferences.askForMediaAccess;
        const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
        Object.defineProperty(process, 'platform', { value: 'darwin' });
        try {
            ask.mockResolvedValueOnce(false);
            await expect(service.setMp4Mic(1, true)).rejects.toThrow(
                'Microphone access denied',
            );
            expect(service.state().displays[0].isMp4MicOn).toBe(false);

            ask.mockResolvedValueOnce(true);
            await service.setMp4Mic(1, true);
            expect(service.state().displays[0].isMp4MicOn).toBe(true);
            expect(ask).toHaveBeenLastCalledWith('microphone');

            // Turning it off, or a display that is not there, asks nothing.
            await service.setMp4Mic(1, false);
            await service.setMp4Mic(9, true);
            expect(ask).toHaveBeenCalledTimes(2);
            expect(service.state().displays[0].isMp4MicOn).toBe(false);
        } finally {
            Object.defineProperty(process, 'platform', platform);
        }
    });

    test('deleting a display closes the screens on it, not the others', () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        service.create({ name: 'Hall' });
        service.attachScreen(7, DISPLAY_ID);
        service.attachScreen(8, DISPLAY_ID);
        service.attachScreen(9, DISPLAY_ID - 1);

        service.delete(1);

        expect(service.showingScreenIds()).toEqual([9]);
        expect(service.state().displays.map((item) => item.number)).toEqual([
            2,
        ]);
    });

    test('a display’s wallpaper is read from its record; any other id reads nothing', async () => {
        const service = createService();
        service.create({
            name: 'Lobby',
            wallpaper: { kind: 'color', color: '#112233' },
        });
        fixture.wallpaperAnswer = 'data:image/png;base64,AAAA';

        expect(await service.readWallpaper(DISPLAY_ID, 320)).toBe(
            'data:image/png;base64,AAAA',
        );
        expect(fixture.wallpaperReads).toEqual([
            [{ kind: 'color', color: '#112233' }, 320],
        ]);
        expect(await service.readWallpaper(DISPLAY_ID - 8)).toBeNull();
        // A monitor's id is no virtual display.
        expect(await service.readWallpaper(2)).toBeNull();
        expect(fixture.wallpaperReads).toHaveLength(1);
    });

    test('the viewer page’s words are stored only when they change', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        service.initIpc();
        const sender = makeContents();

        command(sender, {
            action: 'labels',
            labels: { fullScreen: ' ✝ Full screen ' },
        });
        await settle();
        expect(service.getLayout(1)?.labels.fullScreen).toBe('✝ Full screen');
        const writes = fixture.writes.length;
        command(sender, {
            action: 'labels',
            labels: { fullScreen: '✝ Full screen' },
        });
        await settle();

        expect(fixture.writes).toHaveLength(writes);
        expect(sender.sent).toHaveLength(2);
    });

    test('a connection code is set only when one is given', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        service.initIpc();
        const sender = makeContents();

        command(sender, { action: 'code', code: '   ' });
        command(sender, { action: 'code', code: 2468 });
        await settle();
        expect(fixture.secure.has('virtual-display-code')).toBe(false);
        expect(fixture.webViewers.revokeGrants).not.toHaveBeenCalled();

        command(sender, { action: 'code', code: ' 2468 ' });
        await settle();
        expect(fixture.secure.get('virtual-display-code')).toBe('2468');
        // Everyone let in from the internet is asked again.
        expect(fixture.webViewers.revokeGrants).toHaveBeenCalledOnce();
        expect(service.state().hasCode).toBe(true);
    });
});

describe('the compositor', () => {
    test('only its own page is listened to, and only for its own stream', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        service.initIpc();
        mirror.isVirtualDisplayShareEnabled = true;
        // An iPhone's playlist waits for the stream's codecs: whether the
        // init segment was taken is read off it.
        const master = await request(service, '/vd/1/video', PHONE);
        const [win] = windows();
        const stranger = makeContents();
        const otherHost = makeContents();
        markVirtualDisplayHost(otherHost as any);

        for (const sender of [stranger, otherHost]) {
            ipcListener('vd:compositor-ready')({ sender });
            ipcListener('vd:chunk')({ sender }, { generation: 1, data: INIT });
            ipcListener('vd:encoder')(
                { sender },
                { generation: 1, state: 'live' },
            );
        }
        expect(stranger.sent).toEqual([]);
        expect(otherHost.sent).toEqual([]);
        expect(win.webContents.sent).toEqual([]);
        expect(master.statusCode).toBe(0);
        expect(service.state().displays[0].stream).toBe('starting');

        // Its own page, but an old stream or no bytes.
        feed(win, INIT, 0);
        feed(win, [0, 0, 0, 8]);
        ipcListener('vd:encoder')(
            { sender: win.webContents },
            { generation: 0, state: 'live' },
        );
        expect(master.statusCode).toBe(0);
        expect(service.state().displays[0].stream).toBe('starting');

        feed(win, INIT);
        ipcListener('vd:encoder')(
            { sender: win.webContents },
            { generation: 1, state: 'live' },
        );
        expect(master.statusCode).toBe(200);
        expect(service.state().displays[0].stream).toBe('live');
    });

    test('a player joining a running compositor asks it for a key frame', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        service.initIpc();
        await request(service, '/vd/1/video');
        const [win] = windows();
        // Not ready yet: nothing to ask.
        expect(win.webContents.sent).toEqual([]);
        ipcListener('vd:compositor-ready')({ sender: win.webContents });
        win.webContents.sent.length = 0;

        await request(service, '/vd/1/video');
        expect(win.webContents.sent).toEqual([
            ['vd:compositor', { type: 'keyframe' }],
        ]);

        // A window already gone is not asked.
        win.isDestroyedFlag = true;
        await request(service, '/vd/1/video');
        expect(win.webContents.sent).toHaveLength(1);
    });

    test('its page crashing fails the stream; its window closing lets the next player start another', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        service.initIpc();
        await request(service, '/vd/1/video');
        const [first] = windows();

        first.webContents.listeners.get('render-process-gone')!();
        expect(service.state().displays[0]).toMatchObject({
            stream: 'error',
            error: 'The virtual display stopped',
        });
        expect(first.destroyCount).toBe(1);

        await request(service, '/vd/1/video');
        const second = windows()[1];
        ipcListener('vd:compositor-ready')({ sender: second.webContents });
        ipcListener('vd:encoder')(
            { sender: second.webContents },
            { generation: generationOf(second), state: 'live' },
        );
        // The first window's own close is old news.
        first.listeners.get('closed')!();
        await request(service, '/vd/1/video');
        expect(windows()).toHaveLength(2);

        second.listeners.get('closed')!();
        await request(service, '/vd/1/video');
        expect(windows()).toHaveLength(3);
        expect(fixture.loadedUrls).toEqual(['?vd=1', '?vd=1', '?vd=1']);
    });

    test('a screen whose state cannot be refreshed does not keep the compositor down', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        service.attachScreen(7, DISPLAY_ID);
        const failure = new Error('screen 7 is gone');
        mirror.refreshContext.mockRejectedValueOnce(failure);

        await request(service, '/vd/1/video');

        expect(mirror.refreshContext).toHaveBeenCalledWith(7);
        expect(consoleError).toHaveBeenCalledWith('Virtual display:', failure);
        expect(windows()).toHaveLength(1);
    });

    test('a player that leaves while the screens refresh leaves nothing running', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        service.attachScreen(7, DISPLAY_ID);
        let release!: () => void;
        mirror.refreshContext.mockImplementationOnce(() => {
            return new Promise<void>((resolve) => {
                release = resolve;
            });
        });

        const { res, done } = startRequest(service, '/vd/1/video');
        expect(service.state().displays[0].stream).toBe('starting');
        res.destroy();
        release();
        await done;

        expect(windows()).toHaveLength(0);
        expect(service.state().displays[0]).toMatchObject({
            stream: 'idle',
            clients: [],
        });
    });
});

describe('players from the internet', () => {
    // Found by UT-76 (2026-11-03): a new size or a deletion ended every viewer
    // but left an internet player WAITING for Allow behind -- gone from the
    // list, so Allow could no longer reach it, held five minutes and then
    // refused.
    test.each([
        [
            'given a new size',
            (service: VirtualDisplayService) => {
                service.update({ number: 1, width: 1280, height: 720 });
            },
        ],
        [
            'deleted',
            (service: VirtualDisplayService) => {
                service.delete(1);
            },
        ],
    ])(
        'a player still waiting when its display is %s is told at once',
        async (_label, change) => {
            const service = createService();
            service.create({ name: 'Lobby' });
            openToInternet();
            const res = await request(service, '/vd/1/video', FROM_INTERNET);
            expect(clientsOf(service)).toMatchObject([
                { address: '203.0.113.5', waiting: 'approval' },
            ]);

            change(service);

            expect(res.statusCode).toBe(503);
            expect(res.isEnded).toBe(true);
            vi.advanceTimersByTime(5 * 60 * 1000);
            expect(res.statusCode).toBe(503);
        },
    );

    test('a waiting player that goes away is forgotten, and its wait with it', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        openToInternet();

        const res = await request(service, '/vd/1/video', FROM_INTERNET);
        expect(clientsOf(service)).toMatchObject([
            { address: '203.0.113.5', waiting: 'approval' },
        ]);
        res.destroy();

        expect(clientsOf(service)).toEqual([]);
        vi.advanceTimersByTime(5 * 60 * 1000);
        expect(res.statusCode).toBe(0);
        expect(res.isEnded).toBe(false);
    });

    test('Allow for a player already gone starts nothing, and its address is let in next time', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        openToInternet();
        const res = await request(service, '/vd/1/video', FROM_INTERNET);
        const [client] = clientsOf(service);
        // Ended without a close event reaching anyone.
        res.writableEnded = true;

        await service.allow(1, client.id);

        expect(clientsOf(service)).toEqual([]);
        expect(windows()).toHaveLength(0);
        await request(service, '/vd/1/video', FROM_INTERNET);
        expect(clientsOf(service)).toMatchObject([
            { address: '203.0.113.5', waiting: null },
        ]);
        expect(windows()).toHaveLength(1);
    });

    test('Allow lets a waiting iPhone in, and its playlist follows the stream', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        service.initIpc();
        openToInternet();
        const master = await request(service, '/vd/1/video', {
            ...FROM_INTERNET,
            headers: { 'user-agent': IPHONE },
        });
        const [client] = clientsOf(service);
        expect(client.waiting).toBe('approval');
        expect(windows()).toHaveLength(0);

        await service.allow(1, client.id);

        expect(clientsOf(service)).toMatchObject([{ waiting: null }]);
        const [win] = windows();
        expect(master.statusCode).toBe(0);
        feed(win, INIT);
        expect(master.statusCode).toBe(200);
        expect(String(master.body)).toContain('#EXT-X-STREAM-INF:');
    });

    test('at most 256 addresses are remembered as let in, the oldest let go first', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        openToInternet();
        const addressOf = (index: number) =>
            `10.0.${index >> 8}.${index & 255}`;

        for (let index = 0; index <= 256; index++) {
            const address = addressOf(index);
            const res = await request(service, '/vd/1/video', {
                network: 'internet',
                address,
            });
            await service.allow(1, clientAt(service, address)!.id);
            res.destroy();
        }

        const oldest = await request(service, '/vd/1/video', {
            network: 'internet',
            address: addressOf(0),
        });
        expect(clientAt(service, addressOf(0))?.waiting).toBe('approval');
        oldest.destroy();
        await request(service, '/vd/1/video', {
            network: 'internet',
            address: addressOf(1),
        });
        expect(clientAt(service, addressOf(1))?.waiting).toBeNull();
    });
});

describe('the token a browser’s cast hands its TV', () => {
    // A TV from the internet with `token`: let straight in, or held for
    // Allow like any other player.
    async function isLetIn(
        service: VirtualDisplayService,
        token: string,
        address: string,
    ) {
        const res = await request(service, `/vd/1/video?cast=${token}`, {
            network: 'internet',
            address,
        });
        const isIn = clientAt(service, address)?.waiting === null;
        res.destroy();
        return isIn;
    }

    test('is the same while it lasts, and a new one after a day', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        openToInternet();
        const issue = fixture.webViewerOptions.issueCastToken;

        const token = issue(1, 'viewer-a');
        expect(token).toMatch(/^[a-f0-9]{36}$/);
        expect(issue(1, 'viewer-a')).toBe(token);
        expect(issue(1, 'viewer-b')).not.toBe(token);
        expect(await isLetIn(service, token, '203.0.113.7')).toBe(true);

        vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);
        const next = issue(1, 'viewer-a');

        expect(next).not.toBe(token);
        expect(await isLetIn(service, token, '203.0.113.8')).toBe(false);
        expect(await isLetIn(service, next, '203.0.113.9')).toBe(true);
    });

    test('at most 256 are kept, the oldest let go first', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        openToInternet();
        const issue = fixture.webViewerOptions.issueCastToken;
        const tokens = Array.from({ length: 257 }, (_, index) => {
            return issue(1, `viewer-${index}`) as string;
        });

        expect(await isLetIn(service, tokens[0], '203.0.113.7')).toBe(false);
        expect(await isLetIn(service, tokens[1], '203.0.113.8')).toBe(true);
        expect(await isLetIn(service, tokens[256], '203.0.113.9')).toBe(true);
    });

    test('ends when its browser is disconnected, which is kept out unless it was a preview', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        openToInternet();
        fixture.webViewers.disconnect.mockImplementation((id: string) => {
            return {
                id,
                isPreview: id === 'viewer-p',
                address: id === 'viewer-p' ? '127.0.0.1' : '198.51.100.7',
            };
        });
        const issue = fixture.webViewerOptions.issueCastToken;
        const tokenA = issue(1, 'viewer-a');
        const tokenB = issue(1, 'viewer-b');
        const tokenP = issue(1, 'viewer-p');

        service.disconnect(1, 'viewer-a');
        service.disconnect(1, 'viewer-p');

        expect(await isLetIn(service, tokenA, '203.0.113.7')).toBe(false);
        expect(await isLetIn(service, tokenP, '203.0.113.8')).toBe(false);
        expect(await isLetIn(service, tokenB, '203.0.113.9')).toBe(true);
        expect(service.state().displays[0].blocked).toMatchObject([
            { key: '1|web:viewer-a', kind: 'web', address: '198.51.100.7' },
        ]);
        expect(fixture.webViewerOptions.checkIsBlocked(1, 'viewer-a')).toBe(
            true,
        );
        expect(fixture.webViewerOptions.checkIsBlocked(1, 'viewer-p')).toBe(
            false,
        );
    });
});

describe('viewers kept out', () => {
    test('an expired block takes no place a live one needs, and at most 256 are kept', () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        fixture.webViewers.disconnect.mockImplementation((id: string) => {
            return { id, isPreview: false, address: '198.51.100.7' };
        });
        const isBlocked = (id: string) => {
            return fixture.webViewerOptions.checkIsBlocked(1, id);
        };
        service.disconnect(1, 'kept');
        service.disconnect(1, 'stale');
        vi.advanceTimersByTime(6 * 60 * 1000);
        // Disconnected again: ten minutes from now, in its old place.
        service.disconnect(1, 'kept');
        vi.advanceTimersByTime(4 * 60 * 1000 + 1);

        for (let index = 1; index <= 255; index++) {
            service.disconnect(1, `viewer-${index}`);
        }
        expect(isBlocked('kept')).toBe(true);
        expect(blockedKeys(service)).toHaveLength(256);

        service.disconnect(1, 'one-more');
        expect(isBlocked('kept')).toBe(false);
        expect(isBlocked('viewer-1')).toBe(true);
        expect(isBlocked('one-more')).toBe(true);
        expect(blockedKeys(service)).toHaveLength(256);
    });

    test('Allow for a browser asking to come back lifts its block first', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        fixture.webViewers.disconnect.mockImplementation((id: string) => {
            return { id, isPreview: false, address: '198.51.100.7' };
        });
        service.disconnect(1, 'viewer-a');
        expect(blockedKeys(service)).toEqual(['1|web:viewer-a']);
        fixture.webViewers.checkIsWaitingForApproval.mockReturnValue(true);

        await service.allow(1, 'viewer-a');

        expect(
            fixture.webViewers.checkIsWaitingForApproval,
        ).toHaveBeenCalledWith('viewer-a', 1);
        expect(fixture.webViewers.allow).toHaveBeenCalledWith('viewer-a', 1);
        expect(blockedKeys(service)).toEqual([]);
        expect(fixture.webViewerOptions.checkIsBlocked(1, 'viewer-a')).toBe(
            false,
        );
    });

    test('disconnecting someone who is not watching changes nothing', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });

        service.disconnect(1, 'nobody');
        await request(service, '/vd/1/video');
        service.disconnect(1, 'nobody');

        expect(blockedKeys(service)).toEqual([]);
        expect(clientsOf(service)).toHaveLength(1);
    });
});

describe('iPhones and iPads on HLS', () => {
    test('a second iPhone is answered at once, and the segmenter asks the compositor for a key frame', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        service.initIpc();
        mirror.isVirtualDisplayShareEnabled = true;
        const first = await request(service, '/vd/1/video', PHONE);
        const [win] = windows();
        ipcListener('vd:compositor-ready')({ sender: win.webContents });
        feed(win, INIT);
        expect(first.statusCode).toBe(200);

        const second = await request(service, '/vd/1/video', {
            ...PHONE,
            address: '192.168.1.6',
        });

        expect(second.statusCode).toBe(200);
        expect(tokenOf(second)).not.toBe(tokenOf(first));
        win.webContents.sent.length = 0;
        // Nothing can start before a key frame: one is asked for.
        feed(win, videoAt(0, false));
        expect(win.webContents.sent).toEqual([
            ['vd:compositor', { type: 'keyframe' }],
        ]);
    });

    test('a playlist still waiting is answered 404 when its player is disconnected', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        mirror.isVirtualDisplayShareEnabled = true;
        const master = await request(service, '/vd/1/video', PHONE);
        const [client] = clientsOf(service);
        expect(master.statusCode).toBe(0);

        service.disconnect(1, client.id);

        expect(master.statusCode).toBe(404);
        expect(master.isEnded).toBe(true);
        expect(clientsOf(service)).toEqual([]);
    });

    test('disconnecting an MP4 player beside an iPhone ends only the player', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        mirror.isVirtualDisplayShareEnabled = true;
        const phone = await request(service, '/vd/1/video', PHONE);
        const player = await request(service, '/vd/1/video', {
            network: 'local',
            address: '192.168.1.8',
        });

        service.disconnect(1, clientAt(service, '192.168.1.8')!.id);

        expect(player.statusCode).toBe(503);
        expect(player.isEnded).toBe(true);
        expect(clientsOf(service)).toMatchObject([{ address: '192.168.1.5' }]);
        expect(phone.isEnded).toBe(false);
    });
});

describe('who may watch', () => {
    test('a player no longer let in is ended when the network closes', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        mirror.isVirtualDisplayShareEnabled = true;
        const neighbour = await request(service, '/vd/1/video', {
            network: 'local',
            address: '192.168.1.8',
        });
        const here = await request(service, '/vd/1/video');

        mirror.isVirtualDisplayShareEnabled = false;
        service.onNetworkChanged();

        expect(neighbour.isEnded).toBe(true);
        expect(here.isEnded).toBe(false);
        expect(clientsOf(service)).toMatchObject([
            { network: 'this-computer' },
        ]);
        expect(fixture.webViewers.closeNotAdmitted).toHaveBeenCalledOnce();
        expect(fixture.webViewers.revokeGrants).toHaveBeenCalledOnce();
        expect(fixture.webViewers.sendLayout).toHaveBeenLastCalledWith(1);
    });

    test('a browser viewer let in is listed with its talk-back and its camera', () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        const intercom = { mic: true, speaker: false, volume: 0.5 };
        mirror.intercomStateOf.mockReturnValue(intercom as any);
        fixture.cameraLabels = { 'web-in': 'Front camera' };
        const base = { kind: 'web', address: '192.168.1.9', since: 0 };
        fixture.webClients = [
            { ...base, id: 'web-preview', isPreview: true, waiting: null },
            { ...base, id: 'web-waiting', isPreview: false, waiting: 'code' },
            { ...base, id: 'web-in', isPreview: false, waiting: null },
            { ...base, id: 'web-quiet', isPreview: false, waiting: null },
        ];

        const clients = clientsOf(service) as any[];

        expect(clients[0]).toBe(fixture.webClients[0]);
        expect(clients[1]).toBe(fixture.webClients[1]);
        expect(clients[2]).toEqual({
            ...fixture.webClients[2],
            intercom,
            camera: 'Front camera',
        });
        expect(clients[3]).toEqual({ ...fixture.webClients[3], intercom });
        expect(clients[3]).toHaveProperty('camera', undefined);
        expect(mirror.intercomStateOf.mock.calls).toEqual([
            ['viewer:web-in'],
            ['viewer:web-quiet'],
        ]);
        expect(fixture.webViewers.listOf).toHaveBeenCalledWith(1);
    });
});

describe('the operator’s commands', () => {
    test('HTTPS, disconnect, unblock, interactive and allow reach their places', async () => {
        const service = createService();
        service.create({ name: 'Lobby' });
        service.initIpc();
        const sender = makeContents();
        fixture.webViewers.disconnect.mockImplementation((id: string) => {
            return { id, isPreview: false, address: '198.51.100.7' };
        });

        command(sender, { action: 'https', enabled: true });
        await settle();
        expect(mirror.setHttpsEnabled).toHaveBeenCalledWith(true);
        expect(sender.sent).toHaveLength(1);
        expect(sender.sent[0][0]).toBe('vd:reply');
        expect((sender.sent[0][1] as any).displays).toHaveLength(1);

        command(sender, { action: 'disconnect', number: 1, clientId: 'web-a' });
        command(sender, { action: 'disconnect', number: 1, clientId: 'web-b' });
        await settle();
        expect(fixture.webViewers.disconnect.mock.calls).toEqual([
            ['web-a'],
            ['web-b'],
        ]);
        expect(blockedKeys(service)).toEqual(['1|web:web-a', '1|web:web-b']);

        // Another display's key is not this one's to lift.
        command(sender, { action: 'unblock', number: 1, key: '1|web:web-a' });
        command(sender, { action: 'unblock', number: 2, key: '1|web:web-b' });
        await settle();
        expect(blockedKeys(service)).toEqual(['1|web:web-b']);

        command(sender, {
            action: 'interactive',
            number: 1,
            clientId: 'web-c',
            enabled: true,
        });
        await settle();
        expect(fixture.webViewers.setInteractive).toHaveBeenCalledWith(
            'web-c',
            1,
            true,
        );

        fixture.webViewers.checkIsWaitingForApproval.mockReturnValue(true);
        command(sender, { action: 'allow', number: 1, clientId: 'web-b' });
        await settle();
        expect(fixture.webViewers.allow).toHaveBeenCalledWith('web-b', 1);
        expect(blockedKeys(service)).toEqual([]);
        expect(sender.sent).toHaveLength(7);
    });

    test('a command that fails is answered with its error; a closed window is not answered', async () => {
        createService();
        createService().initIpc();
        const sender = makeContents();

        command(sender, { action: 'update', number: 9 });
        await settle();

        expect(sender.sent).toHaveLength(1);
        const [channel, answer] = sender.sent[0] as [string, Error];
        expect(channel).toBe('vd:reply');
        expect(answer).toBeInstanceOf(Error);
        expect(answer.message).toBe('Virtual display not found');
        sender.isDestroyedFlag = true;
        command(sender, { action: 'update', number: 9 });
        await settle();
        expect(sender.sent).toHaveLength(1);
    });

    test('a window watches a viewer’s camera until it goes', () => {
        const service = createService();
        service.initIpc();
        const contents = makeContents();
        const watcher = `window:${contents.id}`;
        const watch = ipcListener('vd:camera-watch');

        watch({ sender: contents }, { cameraId: 'cam-1', isWatching: true });
        watch({ sender: contents }, { cameraId: 'cam-2', isWatching: true });
        watch({ sender: contents }, { cameraId: 42, isWatching: true });
        watch({ sender: contents }, { cameraId: 'cam-1' });

        expect(fixture.viewerCameras.watch.mock.calls).toEqual([
            [watcher, 'cam-1', true],
            [watcher, 'cam-2', true],
            [watcher, 'cam-1', false],
        ]);
        // One goodbye per window, however many cameras it watches.
        expect(contents.onceCalls.map(([eventName]) => eventName)).toEqual([
            'destroyed',
        ]);
        contents.onceCalls[0][1]();
        expect(fixture.viewerCameras.forgetWatcher).toHaveBeenCalledWith(
            watcher,
        );
        watch({ sender: contents }, { cameraId: 'cam-3', isWatching: true });
        expect(contents.onceCalls).toHaveLength(2);

        mirror.trusted.mockReturnValue(false);
        watch({ sender: contents }, { cameraId: 'cam-4', isWatching: true });
        expect(fixture.viewerCameras.watch).toHaveBeenCalledTimes(4);
    });
});

describe('initVirtualDisplays', () => {
    test('no Screen Mirror means no virtual displays; with one, its hooks reach the service', async () => {
        const before = getVirtualDisplays();
        initVirtualDisplays(undefined);
        expect(getVirtualDisplays()).toBe(before);
        expect(electronMockState.ipcMain.on).not.toHaveBeenCalled();

        initVirtualDisplays(mirror as unknown as ScreenMirrorService);
        const instance = getVirtualDisplays()!;
        services.push(instance);
        expect(instance).toBeInstanceOf(VirtualDisplayService);
        expect(instance).not.toBe(before);
        expect(ipcListener('vd:state')).toBeTypeOf('function');
        const hooks = mirror.setVirtualDisplayHooks.mock.calls[0][0] as any;

        instance.create({ name: 'Lobby' });
        const res = new FakeResponse();
        await hooks.route(
            { method: 'GET', headers: {}, socket: {} },
            res,
            new URL('/vd/1', 'http://127.0.0.1:40000'),
            'this-computer',
        );
        expect(res.statusCode).toBe(301);
        expect(res.headers).toEqual({ Location: '/vd/1/' });

        const req = {};
        const socket = {};
        const head = Buffer.alloc(0);
        hooks.upgrade(req, socket, head, 'local');
        expect(fixture.webViewers.upgrade).toHaveBeenCalledWith(
            req,
            socket,
            head,
            'local',
        );
        expect(hooks.admits('local')).toBe(false);
        mirror.isVirtualDisplayShareEnabled = true;
        expect(hooks.admits('local')).toBe(true);
        hooks.onNetworkChanged();
        expect(fixture.webViewers.closeNotAdmitted).toHaveBeenCalledOnce();
    });
});
