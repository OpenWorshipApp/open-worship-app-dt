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
let access: 'approve' | 'code';
let lockedOut: boolean;
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
    {
        origin = `http://127.0.0.1:${port}` as string | null,
        // false: a browser that is gone and answers no ping.
        autoPong = true,
    } = {},
) {
    return new Promise<OpenedType | null>((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`, {
            ...(origin === null ? {} : { origin }),
            headers: { 'User-Agent': 'TestBrowser/1.0' },
            autoPong,
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
    encrypted = false,
}: {
    url: string;
    remoteAddress?: string;
    origin?: string;
    hostHeader?: string;
    // Over the port's own TLS ("Use HTTPS").
    encrypted?: boolean;
}) {
    const socket = { destroy: vi.fn() };
    viewers.upgrade(
        {
            url,
            headers: { origin, host: hostHeader },
            socket: { remoteAddress, ...(encrypted ? { encrypted } : {}) },
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
    access = 'approve';
    lockedOut = false;
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
        getAccess: vi.fn((value: VirtualDisplayNetwork) => {
            return value === 'internet' ? access : 'open';
        }),
        checkCode: vi.fn((_address: string, code: string) => {
            if (lockedOut) {
                return 'locked';
            }
            if (code === 'church-1234') {
                return 'ok';
            }
            lockedOut = code === 'last-try';
            return lockedOut ? 'locked' : 'wrong';
        }),
        checkIsLockedOut: vi.fn(() => lockedOut),
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
            targets: [
                {
                    id: 'tv-1',
                    name: 'Hall TV',
                    kind: 'google-cast',
                    status: null,
                    behind: null,
                },
            ],
        })),
        onCastSearch: vi.fn(),
        issueCastToken: vi.fn(() => 'feedface'),
        onCastStart: vi.fn(async () => {}),
        onCastStop: vi.fn(),
        onCamera: vi.fn(),
        onCameraGone: vi.fn(),
        hostId: () => HOST_ID,
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
    test('handles errors on the locked-out refusal socket', async () => {
        network = 'internet';
        admitted.add('internet');
        access = 'code';
        lockedOut = true;
        const wss = (viewers as any).wss;
        const upgrade = wss.handleUpgrade.bind(wss);
        let refused: WebSocket | undefined;
        const spy = vi
            .spyOn(wss, 'handleUpgrade')
            .mockImplementation(
                (req: any, socket: any, head: any, accept: any) => {
                    upgrade(req, socket, head, (ws: WebSocket) => {
                        refused = ws;
                        accept(ws);
                    });
                },
            );
        try {
            await connect(`/vd/1/ws?viewer=${VIEWER_ID}`);
            expect(refused).toBeDefined();
            expect(() =>
                refused!.emit('error', new RangeError('Invalid frame')),
            ).not.toThrow();
        } finally {
            spy.mockRestore();
        }
    });

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
                waiting: null,
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

    // A browser the operator disconnected comes back only by asking: it is
    // let in to wait for Allow -- from any network, and the code does not get
    // it past -- and is sent nothing of the display meanwhile. It is known by
    // its own id, so others behind the same address are not touched.
    test('a disconnected browser comes back only by asking; a preview is not asked', async () => {
        blocked = true;
        access = 'code';
        const asking = await openViewer();
        expect(asking.messages[0]).toEqual({
            type: 'access',
            waiting: 'approval',
            isWrong: false,
            labels: toLayout(1).labels,
        });
        expect(host.checkIsBlocked).toHaveBeenCalledWith(1, VIEWER_ID);
        expect(viewers.listOf(1)[0]).toMatchObject({ waiting: 'approval' });
        expect(viewers.checkIsWaitingForApproval(VIEWER_ID, 1)).toBe(true);
        expect(
            await connect(`/vd/1/ws?viewer=${VIEWER_ID}&screenId=5`),
        ).toBeNull();
        // The service lifts the block as it allows.
        blocked = false;
        expect(viewers.allow(VIEWER_ID, 1)).toBe(true);
        await vi.waitFor(() => expect(asking.messages).toHaveLength(2));
        expect(asking.messages[1]).toEqual({
            type: 'layout',
            layout: toLayout(1),
        });
        expect(
            await connect(`/vd/1/ws?viewer=${VIEWER_ID}&screenId=5`),
        ).not.toBeNull();
        blocked = true;
        network = 'this-computer';
        const preview = await openViewer('preview-01', '&preview=1');
        expect(preview.messages[0].type).toBe('layout');
    });

    // A phone that slept or lost the Wi-Fi never says goodbye: it stayed
    // under Watching now for good, counting toward its address's four.
    test('one that stops answering is ended; one that answers stays', async () => {
        viewers = new VirtualDisplayWebViewers(
            host as unknown as WebViewersHostType,
            40,
        );
        const live = await openViewer('viewer-live01');
        const silent = await connect('/vd/1/ws?viewer=viewer-gone01', {
            autoPong: false,
        });
        expect(silent).not.toBeNull();
        await vi.waitFor(() => expect(silent!.messages).toHaveLength(1));

        await waitClosed(silent!.ws);

        await vi.waitFor(() => {
            expect(host.onViewerGone).toHaveBeenCalledWith('viewer-gone01');
        });
        expect(host.onViewerGone).not.toHaveBeenCalledWith('viewer-live01');
        await settle(120);
        expect(live.ws.readyState).toBe(WebSocket.OPEN);
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

// "Cast to a TV" on a page did nothing in Chrome: the browser's picker
// judged the stream unplayable and closed at once. The page now casts
// through this computer.
describe('casting from a viewer page', () => {
    test('a page on this network lists TVs, casts and stops', async () => {
        const viewer = await openViewer();
        viewer.ws.send(JSON.stringify({ type: 'cast-open' }));
        await vi.waitFor(() => expect(viewer.messages).toHaveLength(2));
        expect(viewer.messages[1]).toEqual({
            type: 'cast',
            state: expect.objectContaining({
                isAllowed: true,
                targets: [expect.objectContaining({ id: 'tv-1' })],
            }),
        });
        expect(host.onCastSearch).toHaveBeenCalledWith(1);

        viewer.ws.send(
            JSON.stringify({ type: 'cast-start', targetId: 'tv-1' }),
        );
        await vi.waitFor(() => {
            expect(host.onCastStart).toHaveBeenCalledWith(1, 'tv-1');
        });
        await settle(300);
        viewer.ws.send(JSON.stringify({ type: 'cast-stop', targetId: 'tv-1' }));
        await vi.waitFor(() => {
            expect(host.onCastStop).toHaveBeenCalledWith(1, 'tv-1');
        });

        // Every change reaches a page with its list open, and none after.
        viewers.sendCastStates();
        await vi.waitFor(() => expect(viewer.messages).toHaveLength(3));
        viewer.ws.send(JSON.stringify({ type: 'cast-close' }));
        await settle(300);
        viewers.sendCastStates();
        await settle();
        expect(viewer.messages).toHaveLength(3);
    });

    // Asked for by the user: _"this is for casting to a tv with same network
    // of the browser not app"_. Any browser let in -- the internet too -- is
    // handed the display's MP4 with its token, for its own picker.
    test('any page let in gets the stream for its own picker', async () => {
        network = 'internet';
        admitted.add('internet');
        access = 'code';
        const viewer = await connect(`/vd/1/ws?viewer=${VIEWER_ID}`);
        await vi.waitFor(() => expect(viewer!.messages).toHaveLength(1));
        // Not let in yet: nothing.
        viewer!.ws.send(JSON.stringify({ type: 'cast-stream' }));
        await settle(300);
        expect(host.issueCastToken).not.toHaveBeenCalled();
        viewer!.ws.send(JSON.stringify({ type: 'code', code: 'church-1234' }));
        await vi.waitFor(() => expect(viewer!.messages).toHaveLength(2));
        viewer!.ws.send(JSON.stringify({ type: 'cast-stream' }));
        await vi.waitFor(() => expect(viewer!.messages).toHaveLength(3));
        expect(host.issueCastToken).toHaveBeenCalledWith(1, VIEWER_ID);
        expect(viewer!.messages[2]).toEqual({
            type: 'cast-stream',
            path: '/vd/1/video?cast=feedface',
        });
    });

    test('a page from the internet sees the list but casts nothing', async () => {
        network = 'internet';
        admitted.add('internet');
        access = 'code';
        const viewer = await connect(`/vd/1/ws?viewer=${VIEWER_ID}`);
        await vi.waitFor(() => expect(viewer!.messages).toHaveLength(1));
        viewer!.ws.send(JSON.stringify({ type: 'code', code: 'church-1234' }));
        await vi.waitFor(() => expect(viewer!.messages).toHaveLength(2));
        viewer!.ws.send(JSON.stringify({ type: 'cast-open' }));
        await vi.waitFor(() => expect(viewer!.messages).toHaveLength(3));
        expect(viewer!.messages[2].state.isAllowed).toBe(false);
        await settle(300);
        viewer!.ws.send(
            JSON.stringify({ type: 'cast-start', targetId: 'tv-1' }),
        );
        await settle();
        expect(host.onCastSearch).not.toHaveBeenCalled();
        expect(host.onCastStart).not.toHaveBeenCalled();
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

    test('over TLS ("Use HTTPS") its page is https', async () => {
        await openViewer();
        const plainOrigin = fakeUpgrade({
            url: screenPath(),
            encrypted: true,
        });
        expect(plainOrigin.destroy).toHaveBeenCalledTimes(1);
        expect(host.getScreen).not.toHaveBeenCalled();
        // The https page of the same address gets as far as its screen.
        host.getScreen.mockReturnValueOnce(null);
        fakeUpgrade({
            url: screenPath(),
            origin: 'https://192.168.1.2:40000',
            encrypted: true,
        });
        expect(host.getScreen).toHaveBeenCalledWith(1, 5);
        // And an https page is not let in over plain http.
        host.getScreen.mockClear();
        const secureOrigin = fakeUpgrade({
            url: screenPath(),
            origin: 'https://192.168.1.2:40000',
        });
        expect(secureOrigin.destroy).toHaveBeenCalledTimes(1);
        expect(host.getScreen).not.toHaveBeenCalled();
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

    // The screen's own ✕ on a browser page: asked for by the user, for a
    // viewer let to interact only. It hides the socket's own screen; nothing
    // the packet says picks another one.
    test('its ✕ hides the screen only once the viewer may interact', async () => {
        await openViewer();
        const screen = await connect(screenPath());
        await vi.waitFor(() => expect(screen!.messages).toHaveLength(2));
        screen!.ws.send(JSON.stringify({ type: 'hide', screenId: 9 }));
        await settle();
        expect(host.onHideScreen).not.toHaveBeenCalled();

        viewers.setInteractive(VIEWER_ID, 1, true);
        await vi.waitFor(() => expect(screen!.messages).toHaveLength(3));
        screen!.ws.send(JSON.stringify({ type: 'hide', screenId: 9 }));
        await vi.waitFor(() => expect(host.onHideScreen).toHaveBeenCalled());
        expect(host.onHideScreen).toHaveBeenCalledWith(1, 5);
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

    test.each(['disconnect', 'sharing-off', 'close-all', 'removed', 'reload'])(
        '%s immediately detaches screen and camera access before transport close',
        async (action) => {
            await openViewer();
            const screen = await connect(
                `/vd/1/ws?viewer=${VIEWER_ID}&screenId=5`,
            );
            await vi.waitFor(() => expect(screen!.messages).toHaveLength(2));
            viewers.setInteractive(VIEWER_ID, 1, true);
            controller.shownCameras.add('cam-1');
            const serverScreen = [...controller.sockets][0];
            const feedback = Buffer.from(
                JSON.stringify({
                    type: 'feedback',
                    message: {
                        type: 'bible-screen-view-selected-index',
                        data: { selectedKJVVerseKey: 'EXO 14:18' },
                    },
                }),
            );
            const camera = Buffer.from(
                JSON.stringify({
                    type: 'camera',
                    packet: {
                        type: 'camera-request',
                        requestId: '00000000-0000-4000-8000-000000000010',
                        deviceId: `mirror-camera:${HOST_ID}:cam-1`,
                    },
                }),
            );
            serverScreen.emit('message', feedback, false);
            serverScreen.emit('message', camera, false);
            expect(host.onFeedback).toHaveBeenCalledTimes(1);
            expect(host.onCamera).toHaveBeenCalledTimes(1);
            const parent = (viewers as any).viewers.get(VIEWER_ID)
                .socket as WebSocket;
            // Hold the transport open deterministically: authorization must not
            // depend on a remote peer acknowledging a WebSocket close.
            const parentClose = vi
                .spyOn(parent, 'close')
                .mockImplementation(() => {});
            try {
                if (action === 'disconnect') viewers.disconnect(VIEWER_ID);
                else if (action === 'sharing-off') {
                    admitted.delete('local');
                    viewers.closeNotAdmitted();
                } else if (action === 'close-all') viewers.closeAll(1);
                else if (action === 'removed') {
                    displays.delete(1);
                    viewers.sendLayout(1);
                } else await openViewer();
                serverScreen.emit('message', feedback, false);
                serverScreen.emit('message', camera, false);
                expect(host.onFeedback).toHaveBeenCalledTimes(1);
                expect(host.onCamera).toHaveBeenCalledTimes(1);
                expect(controller.sockets.size).toBe(0);
                expect(controller.camerasChangedListeners.size).toBe(0);
                expect(host.onCameraGone).toHaveBeenCalledWith(
                    `vd:${VIEWER_ID}:5`,
                );
                expect(viewers.has(VIEWER_ID)).toBe(action === 'reload');
                if (action !== 'reload') {
                    expect(
                        await connect(
                            `/vd/1/ws?viewer=${VIEWER_ID}&screenId=5`,
                        ),
                    ).toBeNull();
                }
            } finally {
                parentClose.mockRestore();
                parent.terminate();
            }
        },
    );

    test('a context completing after disconnect cannot send screen state', async () => {
        await openViewer();
        let resolveContext!: (value: any) => void;
        host.loadContext.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveContext = resolve;
                }),
        );
        const screen = await connect(`/vd/1/ws?viewer=${VIEWER_ID}&screenId=5`);
        await vi.waitFor(() => expect(controller.sockets.size).toBe(1));
        viewers.disconnect(VIEWER_ID);
        resolveContext(context);
        await settle();
        expect(screen!.messages).toEqual([]);
        expect(controller.sockets.size).toBe(0);
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

// From the internet a browser is sent nothing of the display -- no layout,
// so no screen, no published file -- until the operator allows it or it
// gives the connection code. This computer and its own networks are not
// asked.
describe('a viewer from the internet', () => {
    const screenPath = (id = VIEWER_ID) => `/vd/1/ws?viewer=${id}&screenId=5`;

    beforeEach(() => {
        network = 'internet';
        admitted.add('internet');
    });

    test('waits for the operator, and once allowed is not asked again', async () => {
        const viewer = await openViewer();
        expect(viewer.messages[0]).toEqual({
            type: 'access',
            waiting: 'approval',
            isWrong: false,
            labels: {},
        });
        expect(viewers.listOf(1)[0]).toMatchObject({
            network: 'internet',
            waiting: 'approval',
        });
        expect(await connect(screenPath())).toBeNull();
        // Asking for a code does nothing while approval is what it waits for.
        viewer.ws.send(JSON.stringify({ type: 'code', code: 'church-1234' }));
        await settle();
        expect(viewers.setInteractive(VIEWER_ID, 1, true)).toBe(false);
        expect(viewers.allow(VIEWER_ID, 2)).toBe(false);
        expect(viewers.allow(VIEWER_ID, 1)).toBe(true);
        await vi.waitFor(() => expect(viewer.messages).toHaveLength(2));
        expect(viewer.messages[1]).toEqual({
            type: 'layout',
            layout: toLayout(1),
        });
        expect(viewers.listOf(1)[0].waiting).toBeNull();
        expect(await connect(screenPath())).not.toBeNull();
        // The same tab loading again goes straight in.
        const reloaded = await openViewer();
        expect(reloaded.messages[0].type).toBe('layout');
        // The access option changing asks everyone from the internet again.
        const closed = waitClosed(reloaded.ws);
        viewers.revokeGrants();
        expect((await closed).reason).toBe('Access changed');
        const again = await openViewer();
        expect(again.messages[0]).toMatchObject({ waiting: 'approval' });
    });

    test('with a code: wrong ones are told so, the right one lets it in', async () => {
        access = 'code';
        const viewer = await openViewer();
        expect(viewer.messages[0]).toMatchObject({
            type: 'access',
            waiting: 'code',
            isWrong: false,
        });
        expect(viewers.allow(VIEWER_ID, 1)).toBe(false);
        viewer.ws.send(JSON.stringify({ type: 'code', code: 'nope' }));
        await vi.waitFor(() => expect(viewer.messages).toHaveLength(2));
        expect(viewer.messages[1]).toMatchObject({
            waiting: 'code',
            isWrong: true,
        });
        // Too long to be a code: not even counted.
        viewer.ws.send(JSON.stringify({ type: 'code', code: 'x'.repeat(65) }));
        await settle();
        expect(host.checkCode).toHaveBeenCalledTimes(1);
        viewer.ws.send(JSON.stringify({ type: 'code', code: 'church-1234' }));
        await vi.waitFor(() => expect(viewer.messages).toHaveLength(3));
        expect(viewer.messages[2]).toEqual({
            type: 'layout',
            layout: toLayout(1),
        });
        expect(await connect(screenPath())).not.toBeNull();
    });

    test('too many wrong codes end it, and keep its address out', async () => {
        access = 'code';
        const viewer = await openViewer();
        const closed = waitClosed(viewer.ws);
        viewer.ws.send(JSON.stringify({ type: 'code', code: 'last-try' }));
        expect(await closed).toEqual({ code: 4001, reason: 'Disconnected' });
        expect(viewer.messages.at(-1)).toMatchObject({
            type: 'refused',
            reason: 'locked',
        });
        await vi.waitFor(() => expect(viewers.has(VIEWER_ID)).toBe(false));
        // Back again, from the same address: told at once, and closed.
        const refused = await connect(`/vd/1/ws?viewer=viewer-0002`);
        expect(await waitClosed(refused!.ws)).toMatchObject({ code: 4001 });
        expect(refused!.messages[0]).toMatchObject({ reason: 'locked' });
    });

    test('at most eight wait at once, across every display', async () => {
        // Every test socket comes from one address, capped at four per
        // display: two displays hold the eight.
        displays.add(3);
        for (const number of [1, 2]) {
            for (let index = 0; index < 4; index++) {
                await openViewer(`waiting-${number}-${index}`, '', number);
            }
        }
        expect(await connect('/vd/3/ws?viewer=waiting-one-more')).toBeNull();
        // Its own network is not asked, and not capped by them.
        network = 'local';
        const local = await openViewer('local-viewer-01', '', 3);
        expect(local.messages[0].type).toBe('layout');
    });
});
