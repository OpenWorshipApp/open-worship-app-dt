import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import WebSocket from 'ws';

import type {
    VirtualDisplayLayout,
    VirtualDisplayNetwork,
} from './virtualDisplayProtocol';
import {
    VirtualDisplayWebViewers,
    type WebViewersHostType,
} from './virtualDisplayWebViewers';

// The branches `virtualDisplayWebViewers.test.ts` leaves: what a page sends
// on its own socket once let in (intercom, camera, junk), the cast packets'
// rate and checks, the screen socket's camera watch and stream signalling,
// and the caps on what is remembered. Same real sockets, on port 0.
const VIEWER_ID = 'viewer-0001';
const HOST_ID = '00000000-0000-4000-8000-000000000001';
const REQUEST_ID = '22222222-2222-4222-8222-222222222222';

type ControllerType = {
    screenId: number;
    sockets: Set<WebSocket>;
    camerasChangedListeners: Set<() => void>;
    shownCameras: Set<string>;
    checkIsCameraShown: (id: string) => boolean;
    cameraLabelOf: (id: string) => string;
};
type OpenedType = { ws: WebSocket; messages: any[] };

function toLayout(number: number): VirtualDisplayLayout {
    return {
        number,
        name: `Display ${number}`,
        width: 1920,
        height: 1080,
        wallpaper: { kind: 'none' },
        screenIds: [5],
        labels: {},
    };
}

let server: http.Server;
let port = 0;
let network: VirtualDisplayNetwork = 'local';
let viewers: VirtualDisplayWebViewers;
let host: { [K in keyof WebViewersHostType]: ReturnType<typeof vi.fn> };
let admitted: Set<VirtualDisplayNetwork>;
let access: 'approve' | 'code';
let displays: Set<number>;
let controller: ControllerType;
let context: any;
const opened: WebSocket[] = [];

function settle(millisecond = 30) {
    return new Promise((resolve) => setTimeout(resolve, millisecond));
}

function connect(path: string) {
    return new Promise<OpenedType | null>((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`, {
            origin: `http://127.0.0.1:${port}`,
            headers: { 'User-Agent': 'TestBrowser/1.0' },
        });
        opened.push(ws);
        const messages: any[] = [];
        ws.on('message', (data) => {
            messages.push(JSON.parse(String(data)));
        });
        ws.once('open', () => resolve({ ws, messages }));
        ws.once('error', () => resolve(null));
    });
}

async function openViewer(id = VIEWER_ID, query = '', number = 1) {
    const viewer = await connect(`/vd/${number}/ws?viewer=${id}${query}`);
    expect(viewer).not.toBeNull();
    await vi.waitFor(() => expect(viewer!.messages).toHaveLength(1));
    return viewer!;
}

// A viewer let in, and its page's socket for screen 5 with the screen's
// state and its interactive flag received.
async function openScreen(id = VIEWER_ID) {
    const viewer = await openViewer(id);
    const screen = await connect(`/vd/1/ws?viewer=${id}&screenId=5`);
    expect(screen).not.toBeNull();
    await vi.waitFor(() => expect(screen!.messages).toHaveLength(2));
    return { viewer, screen: screen! };
}

function send(ws: WebSocket, packet: unknown) {
    ws.send(typeof packet === 'string' ? packet : JSON.stringify(packet));
}

beforeEach(async () => {
    network = 'local';
    admitted = new Set(['this-computer', 'local']);
    access = 'approve';
    displays = new Set([1, 2]);
    const shownCameras = new Set<string>();
    controller = {
        screenId: 5,
        sockets: new Set(),
        camerasChangedListeners: new Set(),
        shownCameras,
        checkIsCameraShown: (id: string) => shownCameras.has(id),
        cameraLabelOf: (id: string) => {
            return shownCameras.has(id) ? `Name of ${id}` : '';
        },
    };
    context = { screenId: 5, display: { id: -500001 } };
    host = {
        checkIsAdmitted: vi.fn((value: VirtualDisplayNetwork) => {
            return admitted.has(value);
        }),
        checkIsBlocked: vi.fn(() => false),
        getAccess: vi.fn((value: VirtualDisplayNetwork) => {
            return value === 'internet' ? access : 'open';
        }),
        checkCode: vi.fn((_address: string, code: string) => {
            return code === 'church-1234' ? 'ok' : 'wrong';
        }),
        checkIsLockedOut: vi.fn(() => false),
        getLayout: vi.fn((number: number) => {
            return displays.has(number) ? toLayout(number) : null;
        }),
        getScreen: vi.fn((number: number, screenId: number) => {
            return number === 1 && screenId === 5 ? controller : null;
        }),
        loadContext: vi.fn(async () => context),
        onChanged: vi.fn(),
        onFeedback: vi.fn(),
        onHideScreen: vi.fn(),
        getCastState: vi.fn(() => ({
            isSharing: true,
            isSearching: false,
            targets: [],
        })),
        onCastSearch: vi.fn(),
        issueCastToken: vi.fn(() => 'feedface'),
        onCastStart: vi.fn(async () => {}),
        onCastStop: vi.fn(),
        onCamera: vi.fn(),
        onCameraGone: vi.fn(),
        hostId: vi.fn(() => HOST_ID),
        onIntercom: vi.fn(),
        onViewerGone: vi.fn(),
        onViewerCamera: vi.fn(),
        onScreenCamera: vi.fn(),
    };
    viewers = new VirtualDisplayWebViewers(
        host as unknown as WebViewersHostType,
    );
    server = http.createServer((_req, res) => {
        res.writeHead(404).end();
    });
    server.on('upgrade', (req, socket, head) => {
        viewers.upgrade(req, socket, head, network);
    });
    await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
    });
    port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
    viewers.closeAll();
    for (const ws of opened.splice(0)) {
        ws.terminate();
    }
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
});

describe("a viewer page's own socket", () => {
    test('once let in, its intercom and its camera reach the host; junk does not', async () => {
        const viewer = await openViewer();
        viewer.ws.send(Buffer.from([1, 2, 3]));
        send(viewer.ws, 'not json');
        send(viewer.ws, { type: 'audio', data: 'AAAA' });
        send(viewer.ws, { type: 'intercom-state', mic: true });
        send(viewer.ws, { type: 'camera-state', shared: true, label: 'Phone' });
        send(viewer.ws, { type: 'video', data: 'AQID', timestamp: 1 });
        await vi.waitFor(() => {
            expect(host.onViewerCamera).toHaveBeenCalledTimes(2);
        });
        expect(host.onIntercom.mock.calls).toEqual([
            [VIEWER_ID, { type: 'audio', data: 'AAAA' }],
            [VIEWER_ID, { type: 'intercom-state', mic: true }],
        ]);
        expect(host.onViewerCamera.mock.calls).toEqual([
            [
                VIEWER_ID,
                '127.0.0.1',
                { type: 'camera-state', shared: true, label: 'Phone' },
            ],
            [
                VIEWER_ID,
                '127.0.0.1',
                { type: 'video', data: 'AQID', timestamp: 1 },
            ],
        ]);
        // Nothing for the page in all that.
        expect(viewer.messages).toHaveLength(1);
    });

    test('anything else larger than 16 KB is dropped unread', async () => {
        const viewer = await openViewer();
        send(viewer.ws, { type: 'cast-open', pad: 'x'.repeat(17 * 1024) });
        await settle(60);
        expect(viewer.messages).toHaveLength(1);
        expect(host.onCastSearch).not.toHaveBeenCalled();
        send(viewer.ws, { type: 'cast-open' });
        await vi.waitFor(() => expect(viewer.messages).toHaveLength(2));
        expect(viewer.messages[1].type).toBe('cast');
    });

    test('a preview and a viewer still waiting send nothing on', async () => {
        network = 'this-computer';
        const preview = await openViewer('preview-0001', '&preview=1');
        send(preview.ws, { type: 'audio', data: 'AAAA' });
        network = 'internet';
        admitted.add('internet');
        const waiting = await openViewer('waiting-0001');
        expect(waiting.messages[0]).toMatchObject({ waiting: 'approval' });
        send(waiting.ws, { type: 'audio', data: 'AAAA' });
        send(waiting.ws, { type: 'camera-state', shared: true });
        send(waiting.ws, { type: 'cast-search' });
        await settle(60);
        expect(host.onIntercom).not.toHaveBeenCalled();
        expect(host.onViewerCamera).not.toHaveBeenCalled();
        expect(host.onCastSearch).not.toHaveBeenCalled();
    });

    test("the host's intercom reaches a page let in, and nobody else", async () => {
        const viewer = await openViewer();
        viewers.sendIntercom(VIEWER_ID, 'speaker', { volume: 0.5 });
        await vi.waitFor(() => expect(viewer.messages).toHaveLength(2));
        expect(viewer.messages[1]).toEqual({ volume: 0.5, type: 'speaker' });
        expect(() => {
            viewers.sendIntercom('nobody-here', 'speaker', {});
        }).not.toThrow();
    });
});

describe('cast packets from a page', () => {
    test('at most four a second are read', async () => {
        const viewer = await openViewer();
        for (let index = 0; index < 6; index++) {
            send(viewer.ws, { type: 'cast-search' });
        }
        await vi.waitFor(() => {
            expect(host.onCastSearch).toHaveBeenCalledTimes(4);
        });
        await settle(60);
        expect(host.onCastSearch).toHaveBeenCalledTimes(4);
        expect(host.onCastSearch).toHaveBeenCalledWith(1);
    });

    test('a target id that is not one is dropped; a cast that fails sends the list again', async () => {
        const viewer = await openViewer();
        host.onCastStart.mockRejectedValueOnce(new Error('TV busy'));
        send(viewer.ws, { type: 'cast-start', targetId: '' });
        send(viewer.ws, { type: 'cast-start', targetId: 'x'.repeat(257) });
        send(viewer.ws, { type: 'cast-start', targetId: 42 });
        send(viewer.ws, { type: 'cast-start', targetId: 'tv-1' });
        await vi.waitFor(() => expect(viewer.messages).toHaveLength(2));
        expect(host.onCastStart.mock.calls).toEqual([[1, 'tv-1']]);
        expect(viewer.messages[1]).toEqual({
            type: 'cast',
            state: {
                isSharing: true,
                isSearching: false,
                targets: [],
                isAllowed: true,
            },
        });
    });

    test('a failed cast to a page already gone sends it nothing', async () => {
        const viewer = await openViewer();
        let failCast!: (error: Error) => void;
        host.onCastStart.mockReturnValueOnce(
            new Promise<void>((_resolve, reject) => {
                failCast = reject;
            }),
        );
        send(viewer.ws, { type: 'cast-start', targetId: 'tv-1' });
        await vi.waitFor(() => expect(host.onCastStart).toHaveBeenCalled());
        viewer.ws.close();
        await vi.waitFor(() => expect(viewers.has(VIEWER_ID)).toBe(false));
        host.getCastState.mockClear();
        failCast(new Error('TV busy'));
        await settle();
        expect(host.getCastState).not.toHaveBeenCalled();
        expect(viewer.messages).toHaveLength(1);
    });
});

describe('letting a browser in', () => {
    beforeEach(() => {
        network = 'internet';
        admitted.add('internet');
    });

    test('a display removed while it waits lets nobody in', async () => {
        const viewer = await openViewer();
        displays.delete(1);
        expect(viewers.allow(VIEWER_ID, 1)).toBe(true);
        await settle();
        expect(viewers.listOf(1)[0].waiting).toBe('approval');
        expect(viewer.messages).toHaveLength(1);
        expect(host.onChanged).toHaveBeenCalledTimes(1);
    });

    test('at most 256 browsers are remembered as let in, the oldest going first', async () => {
        access = 'code';
        const granted: Map<string, number> = (viewers as any).grantedClients;
        for (let index = 0; index < 256; index++) {
            granted.set(`old-${index}`, 1);
        }
        const viewer = await openViewer();
        send(viewer.ws, { type: 'code', code: 'church-1234' });
        await vi.waitFor(() => expect(viewer.messages).toHaveLength(2));
        expect(viewer.messages[1].type).toBe('layout');
        expect(granted.size).toBe(256);
        expect(granted.has('old-0')).toBe(false);
        expect(granted.get(VIEWER_ID)).toBe(1);
    });

    test('at most 256 browsers are remembered as interactive, the oldest going first', async () => {
        network = 'local';
        const allowed: Map<string, number> = (viewers as any).allowedClients;
        for (let index = 0; index < 256; index++) {
            allowed.set(`old-${index}`, 1);
        }
        await openViewer();
        expect(viewers.setInteractive(VIEWER_ID, 1, true)).toBe(true);
        expect(allowed.size).toBe(256);
        expect(allowed.has('old-0')).toBe(false);
        expect(allowed.get(VIEWER_ID)).toBe(1);
        // Turned off: forgotten, and nothing else made to go.
        expect(viewers.setInteractive(VIEWER_ID, 1, false)).toBe(true);
        expect(allowed.size).toBe(255);
        expect(allowed.has('old-1')).toBe(true);
    });
});

describe('a screen socket', () => {
    test("a viewer camera's frames reach the page of that viewer's screen", async () => {
        const { screen } = await openScreen();
        viewers.sendScreenCamera(VIEWER_ID, 5, 'vd-camera-frame', {
            cameraId: 'vd-camera:phone',
            frameType: 'key',
            data: 'AQID',
        });
        await vi.waitFor(() => expect(screen.messages).toHaveLength(3));
        expect(screen.messages[2]).toEqual({
            cameraId: 'vd-camera:phone',
            frameType: 'key',
            data: 'AQID',
            type: 'vd-camera-frame',
        });
        // Another screen, or a viewer not here: nowhere to go.
        viewers.sendScreenCamera(VIEWER_ID, 6, 'vd-camera-end', {});
        viewers.sendScreenCamera('nobody-here', 5, 'vd-camera-end', {});
        await settle();
        expect(screen.messages).toHaveLength(3);
    });

    test('a camera the screen stops showing is unwatched; one the page lets go is too', async () => {
        const { screen } = await openScreen();
        const watcher = `screen:${VIEWER_ID}:5`;
        controller.shownCameras.add('vd-camera:phone');
        controller.shownCameras.add('vd-camera:tablet');
        screen.ws.send(Buffer.from([1, 2, 3]));
        send(screen.ws, 'not json');
        send(screen.ws, {
            type: 'camera-watch',
            cameraId: 'vd-camera:phone',
            isWatching: true,
        });
        send(screen.ws, {
            type: 'camera-watch',
            cameraId: 'vd-camera:tablet',
            isWatching: true,
        });
        send(screen.ws, {
            type: 'camera-watch',
            cameraId: 'vd-camera:tablet',
            isWatching: false,
        });
        await vi.waitFor(() => {
            expect(host.onScreenCamera).toHaveBeenCalledTimes(3);
        });
        expect(host.onScreenCamera.mock.calls).toEqual([
            [watcher, 'vd-camera:phone', true, 'Name of vd-camera:phone'],
            [watcher, 'vd-camera:tablet', true, 'Name of vd-camera:tablet'],
            [watcher, 'vd-camera:tablet', false, 'Name of vd-camera:tablet'],
        ]);

        // Taken off the screen by the operator: unwatched here at once.
        controller.shownCameras.delete('vd-camera:phone');
        for (const listener of controller.camerasChangedListeners) {
            listener();
        }
        expect(host.onScreenCamera).toHaveBeenLastCalledWith(
            watcher,
            'vd-camera:phone',
            false,
        );
        // Leaving with nothing watched: nothing more to say.
        screen.ws.close();
        await vi.waitFor(() => expect(controller.sockets.size).toBe(0));
        expect(host.onScreenCamera).toHaveBeenCalledTimes(4);
        expect(host.onScreenCamera).not.toHaveBeenCalledWith(
            watcher,
            null,
            false,
        );
    });

    test('camera stream signalling: ids, owners, candidates and the close are checked', async () => {
        const { screen } = await openScreen();
        const consumer = `vd:${VIEWER_ID}:5`;
        const deviceId = `mirror-camera:${HOST_ID}:cam-1`;
        controller.shownCameras.add('cam-1');
        const camera = (packet: Record<string, unknown>) => {
            send(screen.ws, { type: 'camera', packet });
        };
        // Not a request id, and a signal for a request never made.
        camera({ type: 'camera-request', requestId: 'not-an-id', deviceId });
        camera({
            type: 'camera-signal',
            requestId: REQUEST_ID,
            description: { type: 'answer', sdp: 'v=0' },
        });
        camera({
            type: 'camera-request',
            requestId: REQUEST_ID,
            deviceId,
            label: 7,
        });
        // A kind of packet that is none of these.
        camera({ type: 'camera-other', requestId: REQUEST_ID });
        camera({
            type: 'camera-signal',
            requestId: REQUEST_ID,
            candidate: {
                candidate: 'candidate:1',
                sdpMid: 'm'.repeat(80),
                sdpMLineIndex: 0,
            },
        });
        camera({
            type: 'camera-signal',
            requestId: REQUEST_ID,
            candidate: {
                candidate: 'candidate:2',
                sdpMid: 5,
                sdpMLineIndex: 1.5,
            },
        });
        // Too long a candidate, and an offer where an answer belongs.
        camera({
            type: 'camera-signal',
            requestId: REQUEST_ID,
            candidate: { candidate: 'c'.repeat(1001) },
        });
        camera({
            type: 'camera-signal',
            requestId: REQUEST_ID,
            description: { type: 'offer', sdp: 'v=0' },
        });
        camera({ type: 'camera-close', requestId: REQUEST_ID });
        // Closed: a later signal for it is dropped.
        camera({
            type: 'camera-signal',
            requestId: REQUEST_ID,
            candidate: { candidate: 'candidate:3' },
        });
        await vi.waitFor(() => {
            expect(host.onCamera).toHaveBeenCalledWith(consumer, {
                type: 'camera-close',
                requestId: REQUEST_ID,
            });
        });
        await settle();
        expect(host.onCamera.mock.calls).toEqual([
            [
                consumer,
                {
                    type: 'camera-request',
                    requestId: REQUEST_ID,
                    deviceId,
                    label: '',
                },
            ],
            [
                consumer,
                {
                    type: 'camera-signal',
                    requestId: REQUEST_ID,
                    candidate: {
                        candidate: 'candidate:1',
                        sdpMid: 'm'.repeat(64),
                        sdpMLineIndex: 0,
                    },
                },
            ],
            [
                consumer,
                {
                    type: 'camera-signal',
                    requestId: REQUEST_ID,
                    candidate: {
                        candidate: 'candidate:2',
                        sdpMid: null,
                        sdpMLineIndex: null,
                    },
                },
            ],
            [consumer, { type: 'camera-close', requestId: REQUEST_ID }],
        ]);
    });
});
