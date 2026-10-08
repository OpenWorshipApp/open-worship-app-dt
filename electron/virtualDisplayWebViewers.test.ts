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

const VIEWER_ID = 'viewer-0001';
const MAX_WEB_VIEWERS = 32;
const MAX_WEB_VIEWERS_PER_ADDRESS = 4;

type ControllerType = {
    screenId: number;
    sockets: Set<WebSocket>;
    camerasChangedListeners: Set<() => void>;
    shownCameras: Set<string>;
    checkIsCameraShown: (id: string) => boolean;
};
type OpenedType = { ws: WebSocket; messages: any[] };
const HOST_ID = '00000000-0000-4000-8000-000000000001';

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
let blocked: boolean;
let displays: Set<number>;
let controller: ControllerType;
let context: any;
const opened: WebSocket[] = [];

function settle(millisecond = 30) {
    return new Promise((resolve) => setTimeout(resolve, millisecond));
}

// Opens `/vd/...` the way a viewer page does; null when it is refused.
function connect(
    path: string,
    { origin = `http://127.0.0.1:${port}` as string | null } = {},
) {
    return new Promise<OpenedType | null>((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`, {
            ...(origin === null ? {} : { origin }),
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

function waitClosed(ws: WebSocket) {
    return new Promise<{ code: number; reason: string }>((resolve) => {
        if (ws.readyState === WebSocket.CLOSED) {
            resolve({ code: -1, reason: '' });
            return;
        }
        ws.once('close', (code, reason) => {
            resolve({ code, reason: String(reason) });
        });
    });
}

// An upgrade that never reaches a socket: what is refused is decided on
// the request alone, so a stand-in socket shows whether it was destroyed.
function fakeUpgrade({
    url,
    remoteAddress = '127.0.0.1',
    origin = 'http://192.168.1.2:40000',
    hostHeader = '192.168.1.2:40000',
}: {
    url: string;
    remoteAddress?: string;
    origin?: string;
    hostHeader?: string;
}) {
    const socket = { destroy: vi.fn() };
    viewers.upgrade(
        {
            url,
            headers: { origin, host: hostHeader },
            socket: { remoteAddress },
        } as unknown as http.IncomingMessage,
        socket as any,
        Buffer.alloc(0),
        network,
    );
    return socket;
}

beforeEach(async () => {
    network = 'local';
    admitted = new Set(['this-computer', 'local']);
    blocked = false;
    displays = new Set([1, 2]);
    const shownCameras = new Set<string>();
    controller = {
        screenId: 5,
        sockets: new Set(),
        camerasChangedListeners: new Set(),
        shownCameras,
        checkIsCameraShown: (id: string) => shownCameras.has(id),
    };
    context = { screenId: 5, display: { id: -500001 } };
    host = {
        checkIsAdmitted: vi.fn((value: VirtualDisplayNetwork) => {
            return admitted.has(value);
        }),
        checkIsBlocked: vi.fn(() => blocked),
        getLayout: vi.fn((number: number) => {
            return displays.has(number) ? toLayout(number) : null;
        }),
        getScreen: vi.fn((number: number, screenId: number) => {
            return number === 1 && screenId === 5 ? controller : null;
        }),
        loadContext: vi.fn(async () => context),
        onChanged: vi.fn(),
        onFeedback: vi.fn(),
        onCamera: vi.fn(),
        onCameraGone: vi.fn(),
        hostId: () => HOST_ID,
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
    // Port 0: never one of the Screen Mirror ports a live app holds.
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

describe('a viewer page socket', () => {
    test('is admitted from its own page and handed the layout', async () => {
        const viewer = await openViewer();
        expect(viewer.messages[0]).toEqual({
            type: 'layout',
            layout: toLayout(1),
        });
        expect(viewers.has(VIEWER_ID)).toBe(true);
        expect(viewers.listOf(1)).toEqual([
            {
                id: VIEWER_ID,
                kind: 'web',
                address: '127.0.0.1',
                network: 'local',
                userAgent: 'TestBrowser/1.0',
                since: expect.any(Number),
                isPreview: false,
                isInteractive: false,
            },
        ]);
        expect(viewers.listOf(2)).toEqual([]);
        expect(host.onChanged).toHaveBeenCalledTimes(1);
        viewer.ws.close();
        await vi.waitFor(() => expect(viewers.has(VIEWER_ID)).toBe(false));
        expect(host.onChanged).toHaveBeenCalledTimes(2);
    });

    test('is refused when Origin is not http://<host>', async () => {
        for (const origin of [
            null,
            'http://evil.example',
            `https://127.0.0.1:${port}`,
            `http://127.0.0.1:${port + 1}`,
            'null',
        ]) {
            expect(
                await connect(`/vd/1/ws?viewer=${VIEWER_ID}`, { origin }),
            ).toBeNull();
        }
        expect(viewers.listOf(1)).toEqual([]);
    });

    test('is refused off the /vd/<n>/ws path or when not admitted', async () => {
        for (const path of [
            `/vd/1/?viewer=${VIEWER_ID}`,
            `/vd/1/video?viewer=${VIEWER_ID}`,
            `/vd/x/ws?viewer=${VIEWER_ID}`,
            `/screen?viewer=${VIEWER_ID}`,
        ]) {
            expect(await connect(path)).toBeNull();
        }
        admitted.delete('local');
        expect(await connect(`/vd/1/ws?viewer=${VIEWER_ID}`)).toBeNull();
        expect(host.checkIsAdmitted).toHaveBeenCalledWith('local');
    });

    test('needs a viewer id of 8 to 64 word characters', async () => {
        for (const id of [
            '',
            'short12',
            'a'.repeat(65),
            'has%20space',
            'semi%3Bcolon',
        ]) {
            expect(await connect(`/vd/1/ws?viewer=${id}`)).toBeNull();
        }
        expect(await connect('/vd/1/ws')).toBeNull();
        await openViewer('abc-DEF_');
        await openViewer('x'.repeat(64));
        expect(viewers.listOf(1)).toHaveLength(2);
    });

    test('is refused for a display that does not exist, or an id taken on another', async () => {
        expect(await connect(`/vd/3/ws?viewer=${VIEWER_ID}`)).toBeNull();
        await openViewer();
        expect(await connect(`/vd/2/ws?viewer=${VIEWER_ID}`)).toBeNull();
    });

    // A tab keeps its id across reloads, and the reload can arrive before
    // the old socket is seen closing: it takes that place, permission and all.
    test('the same tab loading again replaces its old connection', async () => {
        const first = await openViewer();
        viewers.setInteractive(VIEWER_ID, 1, true);
        const closed = waitClosed(first.ws);
        const second = await openViewer();
        expect((await closed).reason).toBe('Reloaded');
        expect(viewers.listOf(1)).toHaveLength(1);
        expect(viewers.listOf(1)[0].isInteractive).toBe(true);
        // Disconnect forgets the permission: the next load starts off.
        viewers.disconnect(VIEWER_ID);
        await waitClosed(second.ws);
        await vi.waitFor(() => expect(viewers.listOf(1)).toHaveLength(0));
        await openViewer();
        expect(viewers.listOf(1)[0].isInteractive).toBe(false);
    });

    // A disconnected browser is let in only to be told so, in the app's
    // words, and closed with 4001 -- its page stops retrying. It is known by
    // its own id, so others behind the same address are not touched.
    test('a disconnected browser is told so, a preview on this computer is not', async () => {
        blocked = true;
        const refused = await connect(`/vd/1/ws?viewer=${VIEWER_ID}`);
        expect(refused).not.toBeNull();
        expect(await waitClosed(refused!.ws)).toEqual({
            code: 4001,
            reason: 'Disconnected',
        });
        expect(refused!.messages).toEqual([
            {
                type: 'refused',
                reason: 'disconnected',
                labels: toLayout(1).labels,
            },
        ]);
        expect(host.checkIsBlocked).toHaveBeenCalledWith(1, VIEWER_ID);
        expect(viewers.listOf(1)).toEqual([]);
        network = 'this-computer';
        await openViewer('preview-01', '&preview=1');
        expect(viewers.listOf(1)[0].isPreview).toBe(true);
    });

    test('at most four per address from the network, per display', async () => {
        for (let index = 0; index < MAX_WEB_VIEWERS_PER_ADDRESS; index++) {
            await openViewer(`viewer-${index}-local`);
        }
        expect(await connect('/vd/1/ws?viewer=viewer-extra-1')).toBeNull();
        // "preview" is only for this computer: from the network it counts.
        expect(
            await connect('/vd/1/ws?viewer=viewer-extra-2&preview=1'),
        ).toBeNull();
        expect(viewers.listOf(1)).toHaveLength(MAX_WEB_VIEWERS_PER_ADDRESS);
        // This computer has no per-address cap.
        network = 'this-computer';
        await openViewer('viewer-here-01');
        expect(viewers.listOf(1)).toHaveLength(MAX_WEB_VIEWERS_PER_ADDRESS + 1);
    });

    test('at most 32 on a display; a preview still gets in', async () => {
        network = 'this-computer';
        for (let index = 0; index < MAX_WEB_VIEWERS; index++) {
            await openViewer(`viewer-${String(index).padStart(4, '0')}`);
        }
        expect(await connect('/vd/1/ws?viewer=viewer-one-more')).toBeNull();
        await openViewer('preview-viewer', '&preview=1');
        expect(viewers.listOf(1)).toHaveLength(MAX_WEB_VIEWERS + 1);
    });
});

describe('a screen socket', () => {
    const screenPath = (id = VIEWER_ID, screenId: string | number = 5) => {
        return `/vd/1/ws?viewer=${id}&screenId=${screenId}`;
    };

    test('of a registered viewer gets the screen context and live messages', async () => {
        await openViewer();
        const screen = await connect(screenPath());
        expect(screen).not.toBeNull();
        // Its state, then whether it may interact (not until allowed).
        await vi.waitFor(() => expect(screen!.messages).toHaveLength(2));
        expect(screen!.messages[0]).toEqual({ type: 'context', context });
        expect(screen!.messages[1]).toEqual({
            type: 'interactive',
            isInteractive: false,
        });
        expect(host.loadContext).toHaveBeenCalledWith(1, 5);
        expect(controller.sockets.size).toBe(1);
        screen!.ws.close();
        await vi.waitFor(() => expect(controller.sockets.size).toBe(0));
    });

    test('is refused for an unregistered viewer', async () => {
        expect(await connect(screenPath())).toBeNull();
        expect(host.getScreen).not.toHaveBeenCalled();
    });

    test("is refused for another display's viewer or a screen not on it", async () => {
        await openViewer('viewer-of-two', '', 2);
        expect(
            await connect('/vd/1/ws?viewer=viewer-of-two&screenId=5'),
        ).toBeNull();
        await openViewer();
        for (const screenId of [6, '5.5', 'abc', '']) {
            expect(await connect(screenPath(VIEWER_ID, screenId))).toBeNull();
        }
        expect(controller.sockets.size).toBe(0);
    });

    test('is refused from another address than its viewer', async () => {
        await openViewer();
        const socket = fakeUpgrade({
            url: screenPath(),
            remoteAddress: '192.168.1.9',
        });
        expect(socket.destroy).toHaveBeenCalledTimes(1);
        expect(host.getScreen).not.toHaveBeenCalled();
        // The same address written as IPv4-mapped IPv6 is the same viewer:
        // it gets as far as asking for the screen.
        host.getScreen.mockReturnValueOnce(null);
        const mapped = fakeUpgrade({
            url: screenPath(),
            remoteAddress: '::ffff:127.0.0.1',
        });
        expect(mapped.destroy).toHaveBeenCalledTimes(1);
        expect(host.getScreen).toHaveBeenCalledWith(1, 5);
    });

    test('is closed with 1011 when the screen has no context', async () => {
        context = null;
        await openViewer();
        const screen = await connect(screenPath());
        expect(screen).not.toBeNull();
        expect(await waitClosed(screen!.ws)).toEqual({
            code: 1011,
            reason: 'No screen',
        });
        await vi.waitFor(() => expect(controller.sockets.size).toBe(0));
    });

    // A hand on the browser page reaches the app only once the operator lets
    // that one connection interact, and then only a verse or a scroll.
    test('sends nothing on until the operator allows it', async () => {
        await openViewer();
        const screen = await connect(screenPath());
        await vi.waitFor(() => expect(screen!.messages).toHaveLength(2));
        const verse = {
            type: 'feedback',
            message: {
                type: 'bible-screen-view-selected-index',
                data: { selectedKJVVerseKey: 'EXO 14:18' },
            },
        };
        screen!.ws.send(JSON.stringify(verse));
        await settle();
        expect(host.onFeedback).not.toHaveBeenCalled();

        expect(viewers.setInteractive(VIEWER_ID, 2, true)).toBe(false);
        expect(viewers.setInteractive(VIEWER_ID, 1, true)).toBe(true);
        await vi.waitFor(() => expect(screen!.messages).toHaveLength(3));
        expect(screen!.messages[2]).toEqual({
            type: 'interactive',
            isInteractive: true,
        });
        expect(viewers.listOf(1)[0].isInteractive).toBe(true);

        screen!.ws.send(JSON.stringify(verse));
        // Rebuilt from checked fields: the extra one is not passed on.
        screen!.ws.send(
            JSON.stringify({
                type: 'feedback',
                message: {
                    type: 'sync-scroll-percentage',
                    data: {
                        domSelector: '.screen-bible-container-scroll',
                        scroll: { x: 0, y: 0.5 },
                        extra: 'dropped',
                    },
                },
            }),
        );
        // Never these: one hides the screen, one makes the app resend all.
        for (const type of ['visible', 'init', 'background-video-time']) {
            screen!.ws.send(
                JSON.stringify({
                    type: 'feedback',
                    message: { type, data: { isShowing: false } },
                }),
            );
        }
        // A selector of its own choosing, or a scroll off the page.
        screen!.ws.send(
            JSON.stringify({
                type: 'feedback',
                message: {
                    type: 'sync-scroll-percentage',
                    data: { domSelector: 'body', scroll: { x: 0, y: 0.5 } },
                },
            }),
        );
        screen!.ws.send(
            JSON.stringify({
                type: 'feedback',
                message: {
                    type: 'sync-scroll-percentage',
                    data: {
                        domSelector: '.half-scale-container',
                        scroll: { x: 0, y: 9 },
                    },
                },
            }),
        );
        await vi.waitFor(() =>
            expect(host.onFeedback).toHaveBeenCalledTimes(2),
        );
        await settle();
        expect(host.onFeedback).toHaveBeenCalledTimes(2);
        expect(host.onFeedback).toHaveBeenNthCalledWith(1, {
            screenId: 5,
            type: 'bible-screen-view-selected-index',
            data: { selectedKJVVerseKey: 'EXO 14:18' },
        });
        expect(host.onFeedback).toHaveBeenNthCalledWith(2, {
            screenId: 5,
            type: 'sync-scroll-percentage',
            data: {
                domSelector: '.screen-bible-container-scroll',
                scroll: { x: 0, y: 0.5 },
            },
        });

        // Turned off again: nothing more.
        viewers.setInteractive(VIEWER_ID, 1, false);
        await vi.waitFor(() => expect(screen!.messages).toHaveLength(4));
        screen!.ws.send(JSON.stringify(verse));
        await settle();
        expect(host.onFeedback).toHaveBeenCalledTimes(2);
    });

    // Watching, so no "Allow interaction" needed -- but only a camera this
    // screen shows, every field rebuilt, and gone the moment it is taken off.
    test('a camera stream only for a camera on the screen', async () => {
        await openViewer();
        const screen = await connect(screenPath());
        await vi.waitFor(() => expect(screen!.messages).toHaveLength(2));
        const consumer = `vd:${VIEWER_ID}:5`;
        const requestId = '11111111-1111-4111-8111-111111111111';
        const ask = (cameraId: string, id = requestId) => {
            screen!.ws.send(
                JSON.stringify({
                    type: 'camera',
                    packet: {
                        type: 'camera-request',
                        requestId: id,
                        deviceId: `mirror-camera:${HOST_ID}:${cameraId}`,
                        label: 'Front',
                        extra: 'dropped',
                    },
                }),
            );
        };
        // Not on the screen: refused, and the relay never hears of it.
        ask('cam-1');
        await vi.waitFor(() =>
            expect(screen!.messages.at(-1)).toEqual({
                type: 'camera',
                packet: { type: 'camera-close', requestId },
            }),
        );
        expect(host.onCamera).not.toHaveBeenCalled();

        controller.shownCameras.add('cam-1');
        ask('cam-1');
        await vi.waitFor(() =>
            expect(host.onCamera).toHaveBeenCalledWith(consumer, {
                type: 'camera-request',
                requestId,
                deviceId: `mirror-camera:${HOST_ID}:cam-1`,
                label: 'Front',
            }),
        );
        screen!.ws.send(
            JSON.stringify({
                type: 'camera',
                packet: {
                    type: 'camera-signal',
                    requestId,
                    description: { type: 'answer', sdp: 'v=0', extra: 1 },
                },
            }),
        );
        await vi.waitFor(() =>
            expect(host.onCamera).toHaveBeenLastCalledWith(consumer, {
                type: 'camera-signal',
                requestId,
                description: { type: 'answer', sdp: 'v=0' },
            }),
        );

        // The relay's reply reaches this page.
        viewers.sendCamera(consumer, {
            type: 'camera-signal',
            requestId,
            candidate: { candidate: 'c' },
        });
        await vi.waitFor(() =>
            expect(screen!.messages.at(-1)).toEqual({
                type: 'camera',
                packet: {
                    type: 'camera-signal',
                    requestId,
                    candidate: { candidate: 'c' },
                },
            }),
        );

        // Taken off the screen: the stream ends on both sides.
        controller.shownCameras.delete('cam-1');
        for (const listener of controller.camerasChangedListeners) {
            listener();
        }
        await vi.waitFor(() =>
            expect(host.onCamera).toHaveBeenLastCalledWith(consumer, {
                type: 'camera-close',
                requestId,
            }),
        );
        await vi.waitFor(() =>
            expect(screen!.messages.at(-1)).toEqual({
                type: 'camera',
                packet: { type: 'camera-close', requestId },
            }),
        );

        // Leaving tells the relay to end whatever this page still had.
        screen!.ws.close();
        await vi.waitFor(() =>
            expect(host.onCameraGone).toHaveBeenCalledWith(consumer),
        );
    });

    test('drops what passes sixty messages a second', async () => {
        await openViewer();
        const screen = await connect(screenPath());
        await vi.waitFor(() => expect(screen!.messages).toHaveLength(2));
        viewers.setInteractive(VIEWER_ID, 1, true);
        await vi.waitFor(() => expect(screen!.messages).toHaveLength(3));
        const text = JSON.stringify({
            type: 'feedback',
            message: {
                type: 'sync-scroll-percentage',
                data: {
                    domSelector: '.half-scale-container',
                    scroll: { x: 0, y: 0.25 },
                },
            },
        });
        for (let index = 0; index < 80; index++) {
            screen!.ws.send(text);
        }
        await vi.waitFor(() =>
            expect(host.onFeedback).toHaveBeenCalledTimes(60),
        );
        await settle(60);
        expect(host.onFeedback).toHaveBeenCalledTimes(60);
    });

    test('closes when its viewer page closes', async () => {
        const viewer = await openViewer();
        const screen = await connect(screenPath());
        await vi.waitFor(() => expect(screen!.messages).toHaveLength(2));
        const closed = waitClosed(screen!.ws);
        viewer.ws.close();
        expect((await closed).code).toBe(1000);
        await vi.waitFor(() => expect(controller.sockets.size).toBe(0));
    });

    // The per-address cap counts page sockets only, so without this one
    // admitted viewer could open the same `screenId` again and again, each
    // sent the whole screen context and then every live message. A newer
    // socket for a screen replaces the viewer's older one.
    test('a viewer holds at most one socket per screen', async () => {
        await openViewer();
        for (let index = 0; index < 3; index++) {
            const screen = await connect(screenPath());
            if (screen !== null) {
                await vi.waitFor(() => {
                    expect(
                        screen.messages.length > 0 ||
                            screen.ws.readyState !== WebSocket.OPEN,
                    ).toBe(true);
                });
            }
        }
        await settle();
        expect(controller.sockets.size).toBe(1);
    });
});

describe('the host side', () => {
    test('sendLayout sends a new layout, or ends viewers of a removed display', async () => {
        const one = await openViewer('viewer-one-01');
        const two = await openViewer('viewer-two-01', '', 2);
        viewers.sendLayout(1);
        await vi.waitFor(() => expect(one.messages).toHaveLength(2));
        expect(one.messages[1]).toEqual({
            type: 'layout',
            layout: toLayout(1),
        });
        displays.delete(2);
        const closed = waitClosed(two.ws);
        viewers.sendLayout(2);
        expect(await closed).toEqual({
            code: 1000,
            reason: 'Display removed',
        });
        expect(one.ws.readyState).toBe(WebSocket.OPEN);
    });

    test('disconnect ends one viewer and reports it', async () => {
        const viewer = await openViewer();
        expect(viewers.disconnect('nobody-here')).toBeNull();
        const closed = waitClosed(viewer.ws);
        expect(viewers.disconnect(VIEWER_ID)).toMatchObject({
            id: VIEWER_ID,
            address: '127.0.0.1',
            isPreview: false,
        });
        expect(await closed).toEqual({ code: 4001, reason: 'Disconnected' });
        expect(viewer.messages.at(-1)).toMatchObject({
            type: 'refused',
            reason: 'disconnected',
        });
        await vi.waitFor(() => expect(viewers.has(VIEWER_ID)).toBe(false));
    });

    test('closeAll(number) ends only that display', async () => {
        const one = await openViewer('viewer-one-01');
        const two = await openViewer('viewer-two-01', '', 2);
        const closed = waitClosed(one.ws);
        viewers.closeAll(1);
        expect(await closed).toEqual({
            code: 1000,
            reason: 'Display changed',
        });
        await settle();
        expect(two.ws.readyState).toBe(WebSocket.OPEN);
    });

    test('closeNotAdmitted ends viewers from a network no longer let in', async () => {
        const local = await openViewer('viewer-local-1');
        network = 'this-computer';
        const here = await openViewer('viewer-here-01');
        admitted.delete('local');
        const closed = waitClosed(local.ws);
        viewers.closeNotAdmitted();
        expect(await closed).toEqual({ code: 1000, reason: 'Not allowed' });
        await settle();
        expect(here.ws.readyState).toBe(WebSocket.OPEN);
    });
});
