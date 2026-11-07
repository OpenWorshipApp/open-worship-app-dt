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

// What a viewer page and its screen pages may say on their sockets beyond
// the main suite's paths -- talk-back, cameras, the cast list's limits -- and
// the caps on the browsers remembered. Real WebSockets, on a server bound to
// 127.0.0.1 port 0 and closed after each test.

const VIEWER_ID = 'viewer-0001';
const HOST_ID = '00000000-0000-4000-8000-000000000001';

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
        castUrl: null,
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
let shownCameras: Set<string>;
let camerasChangedListeners: Set<() => void>;
let controller: any;
const opened: WebSocket[] = [];

function settle(millisecond = 30) {
    return new Promise((resolve) => setTimeout(resolve, millisecond));
}

// Opens `/vd/...` the way a viewer page does; null when it is refused.
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

// A viewer and one of its screen pages, the screen's state received.
async function openScreen() {
    const viewer = await openViewer();
    const screen = await connect(`/vd/1/ws?viewer=${VIEWER_ID}&screenId=5`);
    expect(screen).not.toBeNull();
    await vi.waitFor(() => expect(screen!.messages).toHaveLength(2));
    return { viewer, screen: screen! };
}

function sendJson(ws: WebSocket, data: unknown) {
    ws.send(JSON.stringify(data));
}

beforeEach(async () => {
    network = 'local';
    admitted = new Set(['this-computer', 'local']);
    access = 'approve';
    displays = new Set([1, 2]);
    shownCameras = new Set();
    camerasChangedListeners = new Set();
    controller = {
        screenId: 5,
        sockets: new Set(),
        camerasChangedListeners,
        checkIsCameraShown: (id: string) => shownCameras.has(id),
        cameraLabelOf: (id: string) => {
            return shownCameras.has(id) ? `Name of ${id}` : '';
        },
    };
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
        loadContext: vi.fn(async () => ({ screenId: 5 })),
        onChanged: vi.fn(),
        onFeedback: vi.fn(),
        onHideScreen: vi.fn(),
        getCastState: vi.fn(() => ({
            isSharing: false,
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
    vi.useRealTimers();
    viewers.closeAll();
    for (const ws of opened.splice(0)) {
        ws.terminate();
    }
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
});

describe('a viewer page’s own socket', () => {
    test('a page let in is talked to, and its talk-back and camera reach the host', async () => {
        const viewer = await openViewer();

        viewers.sendIntercom(VIEWER_ID, 'audio', { seq: 1, type: 'other' });
        await vi.waitFor(() => expect(viewer.messages).toHaveLength(2));
        expect(viewer.messages[1]).toEqual({ seq: 1, type: 'audio' });

        const packets = [
            { type: 'audio', data: 'AAAA' },
            { type: 'intercom-state', mic: true },
            { type: 'video', frame: 'BBBB' },
            { type: 'camera-state', isOn: true },
        ];
        for (const packet of packets) {
            sendJson(viewer.ws, packet);
        }
        await vi.waitFor(() => {
            expect(host.onViewerCamera).toHaveBeenCalledTimes(2);
        });
        expect(host.onIntercom.mock.calls).toEqual([
            [VIEWER_ID, packets[0]],
            [VIEWER_ID, packets[1]],
        ]);
        expect(host.onViewerCamera.mock.calls).toEqual([
            [VIEWER_ID, '127.0.0.1', packets[2]],
            [VIEWER_ID, '127.0.0.1', packets[3]],
        ]);
    });

    test('a preview, a page still waiting, a binary or a garbled frame says nothing', async () => {
        network = 'this-computer';
        const preview = await openViewer('preview-0001', '&preview=1');
        network = 'internet';
        admitted.add('internet');
        const waiting = await openViewer('waiting-0001');
        expect(waiting.messages[0]).toMatchObject({ waiting: 'approval' });
        network = 'local';
        const viewer = await openViewer();

        viewers.sendIntercom('preview-0001', 'audio', {});
        viewers.sendIntercom('waiting-0001', 'audio', {});
        sendJson(preview.ws, { type: 'audio', data: 'AAAA' });
        sendJson(waiting.ws, { type: 'audio', data: 'AAAA' });
        viewer.ws.send('{"type": "audio"');
        viewer.ws.send(Buffer.from(JSON.stringify({ type: 'audio' })));
        sendJson(viewer.ws, { type: 'intercom-state', mic: false });

        await vi.waitFor(() => expect(host.onIntercom).toHaveBeenCalledOnce());
        await settle();
        expect(host.onIntercom).toHaveBeenCalledWith(VIEWER_ID, {
            type: 'intercom-state',
            mic: false,
        });
        expect(preview.messages).toHaveLength(1);
        expect(waiting.messages).toHaveLength(1);
    });

    test('a large frame that is no camera frame is dropped', async () => {
        const viewer = await openViewer();

        sendJson(viewer.ws, {
            type: 'cast-search',
            pad: 'x'.repeat(17 * 1024),
        });
        sendJson(viewer.ws, { type: 'cast-search' });

        await vi.waitFor(() =>
            expect(host.onCastSearch).toHaveBeenCalledOnce(),
        );
        await settle();
        expect(host.onCastSearch).toHaveBeenCalledOnce();
        expect(viewer.ws.readyState).toBe(WebSocket.OPEN);
    });
});

describe('the cast list on a page', () => {
    test('more than four of its packets a second are dropped', async () => {
        const viewer = await openViewer();

        for (let index = 0; index < 6; index++) {
            sendJson(viewer.ws, { type: 'cast-search' });
        }

        await vi.waitFor(() => {
            expect(host.onCastSearch).toHaveBeenCalledTimes(4);
        });
        await settle();
        expect(host.onCastSearch).toHaveBeenCalledTimes(4);
        expect(host.onCastSearch).toHaveBeenCalledWith(1);
    });

    test('a target that is no id starts nothing; a start that fails tells the page again', async () => {
        // The cast packets' one-second window, moved on without waiting.
        vi.useFakeTimers({ toFake: ['Date'] });
        const viewer = await openViewer();
        sendJson(viewer.ws, { type: 'cast-open' });
        await vi.waitFor(() => expect(viewer.messages).toHaveLength(2));
        for (const targetId of ['', 7, 'x'.repeat(257)]) {
            sendJson(viewer.ws, { type: 'cast-start', targetId });
        }
        await settle();
        expect(host.onCastStart).not.toHaveBeenCalled();

        vi.setSystemTime(Date.now() + 1000);
        host.onCastStart.mockRejectedValueOnce(new Error('The TV said no'));
        sendJson(viewer.ws, { type: 'cast-start', targetId: 'tv-1' });

        await vi.waitFor(() => expect(viewer.messages).toHaveLength(3));
        expect(host.onCastStart).toHaveBeenCalledOnce();
        expect(host.onCastStart).toHaveBeenCalledWith(1, 'tv-1');
        expect(viewer.messages[2]).toEqual({
            type: 'cast',
            state: {
                isSharing: false,
                isSearching: false,
                targets: [],
                isAllowed: true,
            },
        });
    });

    test('a start that fails after its page left tells no one', async () => {
        const viewer = await openViewer();
        let reject!: (error: Error) => void;
        host.onCastStart.mockImplementationOnce(() => {
            return new Promise<void>((_resolve, rejectStart) => {
                reject = rejectStart;
            });
        });
        sendJson(viewer.ws, { type: 'cast-start', targetId: 'tv-1' });
        await vi.waitFor(() => expect(host.onCastStart).toHaveBeenCalled());
        viewer.ws.close();
        await vi.waitFor(() => expect(viewers.has(VIEWER_ID)).toBe(false));
        const asked = host.getCastState.mock.calls.length;

        reject(new Error('The TV said no'));
        await settle();

        expect(host.getCastState).toHaveBeenCalledTimes(asked);
    });
});

describe('a browser from the internet', () => {
    beforeEach(() => {
        network = 'internet';
        admitted.add('internet');
    });

    test('the right code for a display gone meanwhile lets nothing in', async () => {
        access = 'code';
        const viewer = await openViewer();
        displays.delete(1);

        sendJson(viewer.ws, { type: 'code', code: 'church-1234' });

        await vi.waitFor(() => expect(host.checkCode).toHaveBeenCalledOnce());
        await settle();
        expect(viewer.messages).toHaveLength(1);
        expect(viewers.listOf(1)[0].waiting).toBe('code');
    });

    test('at most 256 are remembered as let in, or as allowed to interact', async () => {
        // Four browsers from one address may watch a display: 65 displays
        // hold the 257 at once.
        for (let number = 1; number <= 65; number++) {
            displays.add(number);
        }
        const idOf = (index: number) => {
            return `browser-${String(index).padStart(4, '0')}`;
        };
        for (let index = 0; index <= 256; index++) {
            const number = (index >> 2) + 1;
            const viewer = await connect(
                `/vd/${number}/ws?viewer=${idOf(index)}`,
            );
            expect(viewer).not.toBeNull();
            expect(viewers.allow(idOf(index), number)).toBe(true);
            expect(viewers.setInteractive(idOf(index), number, true)).toBe(
                true,
            );
        }

        // The same tabs loading again: the oldest is asked again, and may
        // not interact; the next is let straight in, still interacting.
        const oldest = await openViewer(idOf(0));
        const next = await openViewer(idOf(1));
        expect(oldest.messages[0]).toMatchObject({ waiting: 'approval' });
        expect(next.messages[0]).toMatchObject({ type: 'layout' });
        const clientOf = (id: string) => {
            return viewers.listOf(1).find((client) => client.id === id);
        };
        expect(clientOf(idOf(0))).toMatchObject({
            waiting: 'approval',
            isInteractive: false,
        });
        expect(clientOf(idOf(1))).toMatchObject({
            waiting: null,
            isInteractive: true,
        });
    }, 20_000);
});

describe('a screen page’s cameras', () => {
    test('one the screen stops showing is let go, one unwatched is forgotten', async () => {
        const { screen } = await openScreen();
        const watcher = `screen:${VIEWER_ID}:5`;
        shownCameras.add('vd-camera:a');
        shownCameras.add('vd-camera:b');
        const watch = (cameraId: string, isWatching: boolean) => {
            sendJson(screen.ws, { type: 'camera-watch', cameraId, isWatching });
        };

        watch('vd-camera:a', true);
        watch('vd-camera:b', true);
        watch('vd-camera:a', false);
        await vi.waitFor(() => {
            expect(host.onScreenCamera).toHaveBeenCalledTimes(3);
        });
        expect(host.onScreenCamera.mock.calls).toEqual([
            [watcher, 'vd-camera:a', true, 'Name of vd-camera:a'],
            [watcher, 'vd-camera:b', true, 'Name of vd-camera:b'],
            [watcher, 'vd-camera:a', false, 'Name of vd-camera:a'],
        ]);

        shownCameras.clear();
        for (const listener of camerasChangedListeners) {
            listener();
        }
        expect(host.onScreenCamera).toHaveBeenCalledTimes(4);
        expect(host.onScreenCamera).toHaveBeenLastCalledWith(
            watcher,
            'vd-camera:b',
            false,
        );

        // Leaving with none watched says nothing more.
        screen.ws.close();
        await vi.waitFor(() => expect(controller.sockets.size).toBe(0));
        expect(host.onScreenCamera).toHaveBeenCalledTimes(4);
    });

    test('a stream’s ids are checked, its candidates rebuilt, its close forwarded once', async () => {
        const { screen } = await openScreen();
        const consumer = `vd:${VIEWER_ID}:5`;
        const requestId = '22222222-2222-4222-8222-222222222222';
        const deviceId = `mirror-camera:${HOST_ID}:cam-1`;
        const send = (packet: Record<string, unknown>) => {
            sendJson(screen.ws, { type: 'camera', packet });
        };
        shownCameras.add('cam-1');

        send({ type: 'camera-request', requestId: 'not-an-id', deviceId });
        send({ type: 'camera-request', requestId, deviceId, label: 7 });
        await vi.waitFor(() => expect(host.onCamera).toHaveBeenCalledOnce());
        expect(host.onCamera).toHaveBeenCalledWith(consumer, {
            type: 'camera-request',
            requestId,
            deviceId,
            label: '',
        });

        const candidate = 'candidate:1 1 udp 2122260223 127.0.0.1 9 typ host';
        send({
            type: 'camera-signal',
            requestId,
            candidate: { candidate, sdpMid: '0', sdpMLineIndex: 0 },
        });
        send({
            type: 'camera-signal',
            requestId,
            candidate: {
                candidate: 'candidate:2',
                sdpMid: 5,
                sdpMLineIndex: 0.5,
            },
        });
        send({
            type: 'camera-signal',
            requestId,
            candidate: { candidate: 'c'.repeat(1001) },
        });
        send({
            type: 'camera-signal',
            requestId,
            description: { type: 'offer', sdp: 'v=0' },
        });
        send({ type: 'camera-mystery', requestId });
        send({ type: 'camera-close', requestId });
        // Closed already: no longer this page's to close.
        send({ type: 'camera-close', requestId });
        await vi.waitFor(() => expect(host.onCamera).toHaveBeenCalledTimes(4));
        await settle();

        expect(host.onCamera.mock.calls.slice(1)).toEqual([
            [
                consumer,
                {
                    type: 'camera-signal',
                    requestId,
                    candidate: { candidate, sdpMid: '0', sdpMLineIndex: 0 },
                },
            ],
            [
                consumer,
                {
                    type: 'camera-signal',
                    requestId,
                    candidate: {
                        candidate: 'candidate:2',
                        sdpMid: null,
                        sdpMLineIndex: null,
                    },
                },
            ],
            [consumer, { type: 'camera-close', requestId }],
        ]);
        // The id that was no id was not even answered.
        expect(screen.messages).toHaveLength(2);
    });

    test('a garbled message from a screen page is dropped', async () => {
        const { screen } = await openScreen();
        viewers.setInteractive(VIEWER_ID, 1, true);
        await vi.waitFor(() => expect(screen.messages).toHaveLength(3));

        screen.ws.send('{"type": "hide"');
        sendJson(screen.ws, { type: 'hide' });

        await vi.waitFor(() =>
            expect(host.onHideScreen).toHaveBeenCalledOnce(),
        );
        await settle();
        expect(host.onHideScreen).toHaveBeenCalledWith(1, 5);
        expect(host.onHideScreen).toHaveBeenCalledOnce();
    });

    test('a camera frame reaches a viewer’s open screen page, and nothing else', async () => {
        const { screen } = await openScreen();

        viewers.sendScreenCamera(VIEWER_ID, 5, 'vd-camera-frame', {
            cameraId: 'vd-camera:a',
            frameType: 'key',
            data: 'AAAA',
            type: 'overridden',
        });
        await vi.waitFor(() => expect(screen.messages).toHaveLength(3));
        expect(screen.messages[2]).toEqual({
            cameraId: 'vd-camera:a',
            frameType: 'key',
            data: 'AAAA',
            type: 'vd-camera-frame',
        });

        viewers.sendScreenCamera('viewer-gone-01', 5, 'vd-camera-end', {});
        viewers.sendScreenCamera(VIEWER_ID, 6, 'vd-camera-end', {});
        await settle();
        expect(screen.messages).toHaveLength(3);
    });
});
