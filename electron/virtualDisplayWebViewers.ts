import type http from 'node:http';
import type { Duplex } from 'node:stream';
import WebSocket, { WebSocketServer } from 'ws';

import { readRequestSender } from './mirrorRequestSender';
import { MAX_VIEWER_FRAME_TEXT } from './virtualDisplayViewerCameras';
import { toMirrorPlainAddress } from './screenMirrorProtocol';
import {
    parseVirtualDisplayPath,
    readVirtualDisplayViewerFeedback,
    toVirtualDisplayCameraId,
    type VirtualDisplayAccessMode,
    type VirtualDisplayClient,
    type VirtualDisplayViewerCastState,
    type VirtualDisplayViewerFeedback,
    type VirtualDisplayLayout,
    type VirtualDisplayNetwork,
    type VirtualDisplayWebContext,
} from './virtualDisplayProtocol';
import type VirtualScreenController from './VirtualScreenController';

// Browsers watching a virtual display draw it themselves: this computer sends
// each one the display's layout and, per screen, the screen's state and then
// the same messages the presenter already sends -- no picture is made here.
//
// A viewer is its page's socket (`/vd/<n>/ws?viewer=<id>`); each screen it
// stacks opens one more (`&screenId=<id>`). What a screen socket sends is
// read only once the operator lets that viewer interact, and then only a
// verse picked or a page scrolled (`readVirtualDisplayViewerFeedback`).
const MAX_WEB_VIEWERS = 32;
const MAX_WEB_VIEWERS_PER_ADDRESS = 4;
// A camera's WebRTC answer is a few kilobytes; nothing else comes near.
const MAX_INCOMING_BYTES = 16 * 1024;
// A viewer page's camera frame is the one larger message (a VP8 key frame,
// base64); everything else stays under the limit above.
const MAX_PAGE_FRAME_BYTES = MAX_VIEWER_FRAME_TEXT + 1024;
// Camera setup messages a second (an answer and a burst of candidates).
const MAX_CAMERA_PACKETS_PER_SECOND = 100;
// Each browser's camera stream is an encode of its own on this computer.
const MAX_CAMERA_STREAMS = 8;
const REQUEST_ID_PATTERN = /^[a-f0-9-]{36}$/;
const CAMERA_CONSUMER_PATTERN = /^vd:([\w-]+):(\d+)$/;
// A scroll sends a message a frame; more than this in a second is dropped.
const MAX_FEEDBACK_PER_SECOND = 60;
// "Cast to a TV" from a page: a look takes seconds and a cast a TV, so a few
// presses a second is all a hand makes.
const MAX_CAST_PACKETS_PER_SECOND = 4;
const MAX_CAST_TARGET_ID_LENGTH = 256;
// Clients the operator let interact, remembered across their page reloads.
const MAX_ALLOWED_CLIENTS = 256;
// Browsers from the internet waiting to be let in, across every display: a
// stranger must not crowd out the room's own.
const MAX_WAITING_VIEWERS = 8;
const MAX_CODE_LENGTH = 64;

export type WebViewersHostType = {
    checkIsAdmitted: (network: VirtualDisplayNetwork) => boolean;
    // How a viewer from `network` is let in: at once (`open`), or -- from
    // the internet -- after the operator's Allow or with the connection code.
    getAccess: (
        network: VirtualDisplayNetwork,
    ) => 'open' | VirtualDisplayAccessMode;
    checkCode: (address: string, code: string) => 'ok' | 'wrong' | 'locked';
    checkIsLockedOut: (address: string) => boolean;
    // A browser the operator disconnected, by its own id.
    checkIsBlocked: (number: number, viewerId: string) => boolean;
    getLayout: (number: number) => VirtualDisplayLayout | null;
    getScreen: (
        number: number,
        screenId: number,
    ) => VirtualScreenController | null;
    loadContext: (
        number: number,
        screenId: number,
    ) => Promise<VirtualDisplayWebContext | null>;
    onChanged: () => void;
    onFeedback: (
        message: VirtualDisplayViewerFeedback & { screenId: number },
    ) => void;
    // The screen's own ✕ on a browser let to interact: hidden as if a hand
    // closed it on the projector. Never a show.
    onHideScreen: (number: number, screenId: number) => void;
    // "Cast to a TV" on a browser page, through this computer's own casting.
    getCastState: (
        number: number,
    ) => Omit<VirtualDisplayViewerCastState, 'isAllowed'>;
    onCastSearch: (number: number) => void;
    // The token a browser's own cast picker hands its TV with the MP4.
    issueCastToken: (number: number, viewerId: string) => string;
    onCastStart: (number: number, targetId: string) => Promise<void>;
    onCastStop: (number: number, targetId: string) => void;
    // A camera stream's setup, to and from Screen Mirror's camera relay;
    // `consumer` is `vd:<viewer>:<screen>`.
    onCamera: (consumer: string, packet: Record<string, any>) => void;
    onCameraGone: (consumer: string) => void;
    hostId: () => string;
    // The intercom of a viewer that was let in: its microphone packets and
    // whether its microphone is on (`audio`, `intercom-state`).
    onIntercom: (viewerId: string, packet: Record<string, unknown>) => void;
    // A viewer gone: nothing of its intercom stays on.
    onViewerGone: (viewerId: string) => void;
    // A browser's screen page shows a viewer's camera (`vd-camera:`), or
    // stops; null for every camera it watched (the page left).
    onScreenCamera: (
        watcher: string,
        cameraId: string | null,
        isWatching: boolean,
    ) => void;
    // A viewer that was let in shares its camera, or sends a frame of it.
    onViewerCamera: (
        viewerId: string,
        address: string,
        packet: Record<string, unknown>,
    ) => void;
};

type CameraRequestType = {
    consumer: string;
    cameraId: string;
    controller: VirtualScreenController;
};

type ViewerType = VirtualDisplayClient & {
    number: number;
    socket: WebSocket;
    // One per screen: a page loading again replaces its own socket, and a
    // viewer cannot multiply the work by asking for one screen many times.
    screenSockets: Map<number, { socket: WebSocket; close: () => void }>;
    // Its "Cast to a TV" list is open: it is sent each change of it.
    isCastOpen?: boolean;
    castRate?: () => boolean;
};

// Closes a viewer the operator disconnected -- or one locked out for wrong
// codes -- saying so in the app's language; its page shows the words and
// stops reconnecting.
export const DISCONNECTED_CLOSE_CODE = 4001;
function sendDisconnected(
    ws: WebSocket,
    labels: Record<string, string>,
    reason: 'disconnected' | 'locked' = 'disconnected',
) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'refused', reason, labels }));
    }
    ws.close(DISCONNECTED_CLOSE_CODE, 'Disconnected');
}

// What a viewer not let in yet is told: nothing of the display, only what it
// waits for, and whether the code it gave was wrong.
function sendWaiting(
    ws: WebSocket,
    waiting: 'approval' | 'code',
    labels: Record<string, string>,
    isWrong = false,
) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'access', waiting, isWrong, labels }));
    }
}

// True while fewer than `limit` calls came in the last second.
function genRateLimit(limit: number) {
    let windowStart = 0;
    let count = 0;
    return () => {
        const now = Date.now();
        if (now - windowStart >= 1000) {
            windowStart = now;
            count = 0;
        }
        return ++count <= limit;
    };
}

function sendInteractive(ws: WebSocket, isInteractive: boolean) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'interactive', isInteractive }));
    }
}

function refuse(socket: Duplex) {
    socket.destroy();
}

// How often a viewer page is asked whether it is still there; one silent for
// a whole round is ended (gone within two rounds).
const HEARTBEAT_MILLISECOND = 20e3;

export class VirtualDisplayWebViewers {
    private wss = new WebSocketServer({
        noServer: true,
        perMessageDeflate: false,
        maxPayload: MAX_PAGE_FRAME_BYTES,
    });
    private viewers = new Map<string, ViewerType>();
    // Camera streams browsers are watching, by request id.
    private cameraRequests = new Map<string, CameraRequestType>();
    // The operator's "Allow interaction" is per CLIENT: a browser tab keeps
    // its viewer id across reloads, so a phone that reloads (or a TV that
    // wakes up) is still allowed. Id -> display; kept until the switch goes
    // off, Disconnect, or the app restarts.
    private allowedClients = new Map<string, number>();
    // Browsers from the internet the operator allowed or that gave the code,
    // id -> display, so a reload is not asked again. Forgotten on Disconnect,
    // when the access option or the code changes, and when the internet is
    // closed.
    private grantedClients = new Map<string, number>();
    // A browser that went away without closing -- a phone asleep or off the
    // Wi-Fi -- sends nothing ever again: it stayed under Watching now for
    // good, and counted toward what one address may open. While any page is
    // here each is pinged; one that has not answered by the next ping is
    // ended. Nothing runs while nobody watches.
    private heartbeat: ReturnType<typeof setInterval> | null = null;
    private unanswered = new WeakSet<WebSocket>();

    constructor(
        private readonly host: WebViewersHostType,
        private readonly heartbeatMillisecond = HEARTBEAT_MILLISECOND,
    ) {}

    private watchHeartbeat(ws: WebSocket) {
        ws.on('pong', () => this.unanswered.delete(ws));
        if (this.heartbeat === null) {
            this.heartbeat = setInterval(() => {
                this.beat();
            }, this.heartbeatMillisecond);
            this.heartbeat.unref?.();
        }
    }

    private beat() {
        if (this.viewers.size === 0) {
            clearInterval(this.heartbeat ?? undefined);
            this.heartbeat = null;
            return;
        }
        for (const viewer of [...this.viewers.values()]) {
            const ws = viewer.socket;
            if (this.unanswered.has(ws)) {
                // Its close releases it, as any close does.
                ws.terminate();
            } else if (ws.readyState === WebSocket.OPEN) {
                this.unanswered.add(ws);
                ws.ping();
            }
        }
    }

    listOf(number: number): VirtualDisplayClient[] {
        return [...this.viewers.values()]
            .filter((viewer) => viewer.number === number)
            .map(
                ({
                    id,
                    kind,
                    address,
                    network,
                    userAgent,
                    since,
                    isPreview,
                    isInteractive,
                    waiting,
                }) => ({
                    id,
                    kind,
                    address,
                    network,
                    userAgent,
                    since,
                    isPreview,
                    isInteractive,
                    waiting,
                }),
            );
    }

    has(id: string) {
        return this.viewers.has(id);
    }

    private checkIsActive(viewer: ViewerType) {
        return (
            this.viewers.get(viewer.id) === viewer &&
            viewer.waiting === null &&
            viewer.socket.readyState === WebSocket.OPEN &&
            this.host.checkIsAdmitted(viewer.network) &&
            (viewer.isPreview ||
                !this.host.checkIsBlocked(viewer.number, viewer.id))
        );
    }

    // Authorization ends now, not when the remote end answers a close frame.
    private releaseViewer(viewer: ViewerType) {
        viewer.isInteractive = false;
        const isCurrent = this.viewers.get(viewer.id) === viewer;
        if (isCurrent) this.viewers.delete(viewer.id);
        for (const screen of [...viewer.screenSockets.values()]) screen.close();
        if (isCurrent) {
            this.host.onViewerGone(viewer.id);
            this.host.onChanged();
        }
    }

    // A viewer that was let in and is still here: its intercom can reach it.
    checkIsLetIn(id: string) {
        const viewer = this.viewers.get(id);
        return (
            viewer !== undefined &&
            viewer.waiting === null &&
            !viewer.isPreview &&
            viewer.socket.readyState === WebSocket.OPEN
        );
    }

    // A viewer camera's frame (or end) to one browser's screen page.
    sendScreenCamera(
        viewerId: string,
        screenId: number,
        type: string,
        data: Record<string, unknown>,
    ) {
        const screen = this.viewers.get(viewerId)?.screenSockets.get(screenId);
        if (screen?.socket.readyState === WebSocket.OPEN) {
            screen.socket.send(JSON.stringify({ ...data, type }));
        }
    }

    // An intercom packet to a viewer's page.
    sendIntercom(id: string, type: string, data: Record<string, unknown>) {
        const viewer = this.viewers.get(id);
        if (viewer !== undefined && this.checkIsLetIn(id)) {
            viewer.socket.send(JSON.stringify({ ...data, type }));
        }
    }

    upgrade(
        req: http.IncomingMessage,
        socket: Duplex,
        head: Buffer,
        network: VirtualDisplayNetwork,
    ) {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const target = parseVirtualDisplayPath(url.pathname);
        if (
            target === null ||
            target.kind !== 'ws' ||
            !this.host.checkIsAdmitted(network)
        ) {
            refuse(socket);
            return;
        }
        // Only the display's own page may open these: a page from any other
        // site open in the viewer's browser sends its own origin. Through
        // Cloudflare's tunnel that page is https.
        const sender = readRequestSender(req);
        const { origin, host } = req.headers;
        if (
            !origin ||
            !host ||
            origin !== `${sender.isTunnel ? 'https' : 'http'}://${host}`
        ) {
            refuse(socket);
            return;
        }
        const viewerId = url.searchParams.get('viewer') ?? '';
        if (!/^[\w-]{8,64}$/.test(viewerId)) {
            refuse(socket);
            return;
        }
        const address = toMirrorPlainAddress(sender.address);
        const screenIdText = url.searchParams.get('screenId');
        if (screenIdText === null) {
            this.upgradeViewer(req, socket, head, {
                id: viewerId,
                number: target.number,
                network,
                address,
                isPreview:
                    network === 'this-computer' &&
                    url.searchParams.get('preview') === '1',
            });
            return;
        }
        const viewer = this.viewers.get(viewerId);
        const screenId = Number(screenIdText);
        const controller =
            viewer !== undefined &&
            this.checkIsActive(viewer) &&
            viewer.number === target.number &&
            viewer.address === address &&
            Number.isInteger(screenId)
                ? this.host.getScreen(target.number, screenId)
                : null;
        if (viewer === undefined || controller === null) {
            refuse(socket);
            return;
        }
        this.wss.handleUpgrade(req, socket, head, (ws) => {
            void this.acceptScreen(ws, viewer, controller);
        });
    }

    private upgradeViewer(
        req: http.IncomingMessage,
        socket: Duplex,
        head: Buffer,
        info: {
            id: string;
            number: number;
            network: VirtualDisplayNetwork;
            address: string;
            isPreview: boolean;
        },
    ) {
        const layout = this.host.getLayout(info.number);
        // The same tab loading again (its id is kept for the tab) may arrive
        // before its old socket is seen closing: it takes that place. The
        // same id from anywhere else is refused.
        const previous = this.viewers.get(info.id);
        const isReload =
            previous !== undefined &&
            previous.address === info.address &&
            previous.number === info.number;
        const others = this.listOf(info.number).filter((viewer) => {
            return !viewer.isPreview && !(isReload && viewer.id === info.id);
        });
        // From the internet, a browser not let in before waits for the
        // operator's Allow or gives the code; it gets nothing of the display
        // -- no layout, no screen, no published file -- until then. One the
        // operator disconnected, from any network, comes back only by asking:
        // it waits for Allow, and the code does not get it past the operator
        // (asked for 2026-10-08: its Retry met the block and nothing else).
        const isBlocked =
            layout !== null &&
            !info.isPreview &&
            this.host.checkIsBlocked(info.number, info.id);
        const access = info.isPreview
            ? 'open'
            : this.host.getAccess(info.network);
        const waiting = isBlocked
            ? 'approval'
            : access === 'open' ||
                this.grantedClients.get(info.id) === info.number
              ? null
              : access === 'code'
                ? 'code'
                : 'approval';
        if (
            layout !== null &&
            waiting === 'code' &&
            this.host.checkIsLockedOut(info.address)
        ) {
            this.wss.handleUpgrade(req, socket, head, (ws) => {
                ws.on('error', () => ws.terminate());
                sendDisconnected(ws, layout.labels, 'locked');
            });
            return;
        }
        if (
            layout === null ||
            (previous !== undefined && !isReload) ||
            (!info.isPreview &&
                (others.length >= MAX_WEB_VIEWERS ||
                    (info.network !== 'this-computer' &&
                        others.filter((viewer) => {
                            return viewer.address === info.address;
                        }).length >= MAX_WEB_VIEWERS_PER_ADDRESS))) ||
            (waiting !== null &&
                [...this.viewers.values()].filter((viewer) => {
                    return viewer.waiting !== null && viewer.id !== info.id;
                }).length >= MAX_WAITING_VIEWERS)
        ) {
            refuse(socket);
            return;
        }
        this.wss.handleUpgrade(req, socket, head, (ws) => {
            if (isReload && this.viewers.get(info.id) === previous) {
                this.releaseViewer(previous);
                previous.socket.close(1000, 'Reloaded');
            }
            const viewer: ViewerType = {
                ...info,
                kind: 'web',
                userAgent: String(req.headers['user-agent'] ?? '').slice(
                    0,
                    120,
                ),
                since: Date.now(),
                isInteractive:
                    waiting === null &&
                    this.allowedClients.get(info.id) === info.number,
                waiting,
                socket: ws,
                screenSockets: new Map(),
            };
            this.viewers.set(viewer.id, viewer);
            ws.on('error', () => {});
            ws.on('close', () => this.releaseViewer(viewer));
            this.watchHeartbeat(ws);
            ws.on('message', (raw, isBinary) => {
                this.receivePage(viewer, raw, isBinary);
            });
            if (waiting === null) {
                ws.send(JSON.stringify({ type: 'layout', layout }));
            } else {
                sendWaiting(ws, waiting, layout.labels);
            }
            this.host.onChanged();
        });
    }

    // The only thing a page sends on its own socket: the connection code,
    // while it is asked for. Wrong ones count toward the sender's lockout.
    // What a page sends on its own socket: the connection code while it is
    // asked for; once let in, its intercom (checked in size and rate by the
    // intercom itself).
    private receivePage(
        viewer: ViewerType,
        raw: WebSocket.RawData,
        isBinary: boolean,
    ) {
        if (
            isBinary ||
            viewer.isPreview ||
            this.viewers.get(viewer.id) !== viewer
        ) {
            return;
        }
        let packet: any;
        try {
            packet = JSON.parse(String(raw));
        } catch {
            return;
        }
        if (
            viewer.waiting === null &&
            (packet?.type === 'audio' || packet?.type === 'intercom-state')
        ) {
            this.host.onIntercom(viewer.id, packet);
            return;
        }
        if (
            viewer.waiting === null &&
            (packet?.type === 'video' || packet?.type === 'camera-state')
        ) {
            this.host.onViewerCamera(viewer.id, viewer.address, packet);
            return;
        }
        // Only a camera frame may be large.
        if ((raw as Buffer).length > MAX_INCOMING_BYTES) {
            return;
        }
        if (
            viewer.waiting === null &&
            typeof packet?.type === 'string' &&
            packet.type.startsWith('cast-')
        ) {
            this.receiveCast(viewer, packet);
            return;
        }
        if (viewer.waiting !== 'code') {
            return;
        }
        if (
            packet?.type !== 'code' ||
            typeof packet.code !== 'string' ||
            packet.code.length > MAX_CODE_LENGTH
        ) {
            return;
        }
        const labels = this.host.getLayout(viewer.number)?.labels ?? {};
        const result = this.host.checkCode(viewer.address, packet.code);
        if (result === 'ok') {
            this.grant(viewer);
        } else if (result === 'locked') {
            this.releaseViewer(viewer);
            sendDisconnected(viewer.socket, labels, 'locked');
        } else {
            sendWaiting(viewer.socket, 'code', labels, true);
        }
    }

    // "Cast to a TV" on a page: looked for and cast by this computer, so it
    // works in any browser. Only from this computer and its own networks --
    // the TV is on this network, and a stranger on the internet does not get
    // to put something on it. Every field is checked; the target is one of
    // the TVs this computer found, by id.
    private receiveCast(viewer: ViewerType, packet: any) {
        viewer.castRate ??= genRateLimit(MAX_CAST_PACKETS_PER_SECOND);
        if (!viewer.castRate()) {
            return;
        }
        const { type } = packet;
        if (type === 'cast-close') {
            viewer.isCastOpen = false;
            return;
        }
        // The page's own picker: the display's MP4 for a TV on the
        // BROWSER's network, so from any browser let in -- the internet
        // too. Its token lets that TV in without the Allow or the code.
        if (type === 'cast-stream') {
            const token = this.host.issueCastToken(viewer.number, viewer.id);
            if (viewer.socket.readyState === WebSocket.OPEN) {
                viewer.socket.send(
                    JSON.stringify({
                        type: 'cast-stream',
                        path: `/vd/${viewer.number}/video?cast=${token}`,
                    }),
                );
            }
            return;
        }
        const isAllowed = viewer.network !== 'internet';
        if (type === 'cast-open') {
            viewer.isCastOpen = true;
            this.sendCastState(viewer);
            if (isAllowed && this.host.getCastState(viewer.number).isSharing) {
                this.host.onCastSearch(viewer.number);
            }
            return;
        }
        if (!isAllowed) {
            return;
        }
        if (type === 'cast-search') {
            this.host.onCastSearch(viewer.number);
            return;
        }
        const { targetId } = packet;
        if (
            typeof targetId !== 'string' ||
            !targetId ||
            targetId.length > MAX_CAST_TARGET_ID_LENGTH
        ) {
            return;
        }
        if (type === 'cast-start') {
            this.host.onCastStart(viewer.number, targetId).catch(() => {
                // Said by the list: the TV stays without a cast.
                this.sendCastState(viewer);
            });
        } else if (type === 'cast-stop') {
            this.host.onCastStop(viewer.number, targetId);
        }
    }

    private sendCastState(viewer: ViewerType) {
        if (viewer.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        const state: VirtualDisplayViewerCastState = {
            ...this.host.getCastState(viewer.number),
            isAllowed: viewer.network !== 'internet',
        };
        viewer.socket.send(JSON.stringify({ type: 'cast', state }));
    }

    // A change of the TVs or of a cast: to every page with its list open.
    sendCastStates() {
        for (const viewer of this.viewers.values()) {
            if (viewer.isCastOpen && this.checkIsActive(viewer)) {
                this.sendCastState(viewer);
            }
        }
    }

    // Lets a waiting browser in: it is sent the display now, and is not
    // asked again when its page loads again.
    private grant(viewer: ViewerType) {
        const layout = this.host.getLayout(viewer.number);
        if (layout === null) {
            return;
        }
        viewer.waiting = null;
        if (this.grantedClients.size >= MAX_ALLOWED_CLIENTS) {
            this.grantedClients.delete(
                this.grantedClients.keys().next().value!,
            );
        }
        this.grantedClients.set(viewer.id, viewer.number);
        if (viewer.socket.readyState === WebSocket.OPEN) {
            viewer.socket.send(JSON.stringify({ type: 'layout', layout }));
        }
        this.host.onChanged();
    }

    checkIsWaitingForApproval(id: string, number: number) {
        const viewer = this.viewers.get(id);
        return viewer?.waiting === 'approval' && viewer.number === number;
    }

    // The operator's Allow for a browser waiting for it.
    allow(id: string, number: number) {
        const viewer = this.viewers.get(id);
        if (viewer?.waiting !== 'approval' || viewer.number !== number) {
            return false;
        }
        this.grant(viewer);
        return true;
    }

    // The access option or the code changed, or the internet was closed:
    // every browser let in from the internet is asked again.
    revokeGrants() {
        this.grantedClients.clear();
        for (const viewer of [...this.viewers.values()]) {
            if (viewer.network === 'internet' && !viewer.isPreview) {
                this.releaseViewer(viewer);
                viewer.socket.close(1000, 'Access changed');
            }
        }
    }

    private async acceptScreen(
        ws: WebSocket,
        viewer: ViewerType,
        controller: VirtualScreenController,
    ) {
        const { screenId } = controller;
        const consumer = `vd:${viewer.id}:${screenId}`;
        viewer.screenSockets.get(screenId)?.close();
        // A camera taken off the screen ends every stream of it here, so a
        // browser cannot keep watching what the operator put away.
        // Viewer cameras (`vd-camera:`) this page shows: their frames come
        // from this computer as they arrived from that viewer.
        const watcher = `screen:${viewer.id}:${screenId}`;
        const watched = new Set<string>();
        const onCamerasChanged = () => {
            this.closeCamerasNotShown(controller);
            for (const cameraId of [...watched]) {
                if (!controller.checkIsCameraShown(cameraId)) {
                    watched.delete(cameraId);
                    this.host.onScreenCamera(watcher, cameraId, false);
                }
            }
        };
        controller.camerasChangedListeners.add(onCamerasChanged);
        ws.on('error', () => {});
        const connection = {
            socket: ws,
            close: () => {
                if (viewer.screenSockets.get(screenId) === connection) {
                    viewer.screenSockets.delete(screenId);
                    this.forgetCameras(consumer);
                }
                controller.sockets.delete(ws);
                controller.camerasChangedListeners.delete(onCamerasChanged);
                if (watched.size > 0) {
                    watched.clear();
                    this.host.onScreenCamera(watcher, null, false);
                }
                // ws bounds the close handshake; it no longer grants access while closing.
                ws.close(1000);
            },
        };
        viewer.screenSockets.set(screenId, connection);
        ws.once('close', connection.close);
        const checkIsCurrent = () =>
            this.checkIsActive(viewer) &&
            viewer.screenSockets.get(screenId) === connection &&
            ws.readyState === WebSocket.OPEN;
        const feedbackRate = genRateLimit(MAX_FEEDBACK_PER_SECOND);
        const cameraRate = genRateLimit(MAX_CAMERA_PACKETS_PER_SECOND);
        ws.on('message', (raw, isBinary) => {
            if (
                isBinary ||
                !checkIsCurrent() ||
                (raw as Buffer).length > MAX_INCOMING_BYTES
            ) {
                return;
            }
            let packet: any;
            try {
                packet = JSON.parse(String(raw));
            } catch {
                return;
            }
            if (packet?.type === 'camera') {
                // Watching, not interacting: allowed to every viewer, for
                // the cameras this screen shows.
                if (cameraRate()) {
                    this.receiveCamera(consumer, controller, packet.packet);
                }
                return;
            }
            if (packet?.type === 'camera-watch') {
                const { cameraId } = packet;
                const isWatching = packet.isWatching === true;
                if (
                    typeof cameraId === 'string' &&
                    cameraId.startsWith('vd-camera:') &&
                    cameraId.length <= 100 &&
                    cameraRate() &&
                    (!isWatching || controller.checkIsCameraShown(cameraId))
                ) {
                    if (isWatching) {
                        watched.add(cameraId);
                    } else {
                        watched.delete(cameraId);
                    }
                    this.host.onScreenCamera(watcher, cameraId, isWatching);
                }
                return;
            }
            // The screen's own ✕, on a browser the operator lets interact:
            // this screen hides, as a hand on the projector's window would
            // hide it. Nothing in the packet is read -- the screen is the
            // socket's own, and a viewer can never show one.
            if (packet?.type === 'hide') {
                if (viewer.isInteractive && feedbackRate()) {
                    this.host.onHideScreen(viewer.number, screenId);
                }
                return;
            }
            if (
                packet?.type !== 'feedback' ||
                !viewer.isInteractive ||
                !feedbackRate()
            ) {
                return;
            }
            const message = readVirtualDisplayViewerFeedback(packet.message);
            if (message !== null) {
                this.host.onFeedback({ ...message, screenId });
            }
        });
        // Live messages from now on; the page holds them until its state
        // below has been applied, so nothing between the two is lost.
        controller.sockets.add(ws);
        const context = await this.host.loadContext(
            viewer.number,
            controller.screenId,
        );
        if (!checkIsCurrent()) {
            return;
        }
        if (context === null) {
            ws.close(1011, 'No screen');
            return;
        }
        ws.send(JSON.stringify({ type: 'context', context }));
        sendInteractive(ws, viewer.isInteractive);
    }

    // A browser asking for, answering or ending a camera stream. Only a
    // camera its screen shows may be asked for; every field is rebuilt.
    private receiveCamera(
        consumer: string,
        controller: VirtualScreenController,
        raw: any,
    ) {
        const type = raw?.type;
        const requestId = raw?.requestId;
        if (
            typeof requestId !== 'string' ||
            !REQUEST_ID_PATTERN.test(requestId)
        ) {
            return;
        }
        if (type === 'camera-request') {
            const prefix = toVirtualDisplayCameraId(this.host.hostId(), '');
            const deviceId = raw.deviceId;
            const cameraId =
                typeof deviceId === 'string' && deviceId.startsWith(prefix)
                    ? deviceId.slice(prefix.length)
                    : '';
            if (
                this.cameraRequests.has(requestId) ||
                !controller.checkIsCameraShown(cameraId) ||
                this.cameraRequests.size >= MAX_CAMERA_STREAMS
            ) {
                this.sendCamera(consumer, { type: 'camera-close', requestId });
                return;
            }
            this.cameraRequests.set(requestId, {
                consumer,
                cameraId,
                controller,
            });
            this.host.onCamera(consumer, {
                type,
                requestId,
                deviceId,
                label:
                    typeof raw.label === 'string'
                        ? raw.label.slice(0, 200)
                        : '',
            });
            return;
        }
        if (this.cameraRequests.get(requestId)?.consumer !== consumer) {
            return;
        }
        if (type === 'camera-close') {
            this.cameraRequests.delete(requestId);
            this.host.onCamera(consumer, { type, requestId });
            return;
        }
        if (type !== 'camera-signal') {
            return;
        }
        const { description, candidate } = raw;
        if (
            description?.type === 'answer' &&
            typeof description.sdp === 'string' &&
            description.sdp.length <= 12000
        ) {
            this.host.onCamera(consumer, {
                type,
                requestId,
                description: { type: 'answer', sdp: description.sdp },
            });
        } else if (
            typeof candidate?.candidate === 'string' &&
            candidate.candidate.length <= 1000
        ) {
            this.host.onCamera(consumer, {
                type,
                requestId,
                candidate: {
                    candidate: candidate.candidate,
                    sdpMid:
                        typeof candidate.sdpMid === 'string'
                            ? candidate.sdpMid.slice(0, 64)
                            : null,
                    sdpMLineIndex: Number.isInteger(candidate.sdpMLineIndex)
                        ? candidate.sdpMLineIndex
                        : null,
                },
            });
        }
    }

    // From the camera relay to the browser asking (`vd:<viewer>:<screen>`).
    sendCamera(consumer: string, packet: Record<string, any>) {
        const match = CAMERA_CONSUMER_PATTERN.exec(consumer);
        const socket = match
            ? this.viewers.get(match[1])?.screenSockets.get(Number(match[2]))
                  ?.socket
            : undefined;
        if (packet.type === 'camera-close') {
            this.cameraRequests.delete(packet.requestId);
        }
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'camera', packet }));
        }
    }

    private forgetCameras(consumer: string) {
        for (const [requestId, request] of this.cameraRequests) {
            if (request.consumer === consumer) {
                this.cameraRequests.delete(requestId);
            }
        }
        this.host.onCameraGone(consumer);
    }

    private closeCamerasNotShown(controller: VirtualScreenController) {
        for (const [requestId, request] of this.cameraRequests) {
            if (
                request.controller === controller &&
                !controller.checkIsCameraShown(request.cameraId)
            ) {
                this.cameraRequests.delete(requestId);
                this.host.onCamera(request.consumer, {
                    type: 'camera-close',
                    requestId,
                });
                this.sendCamera(request.consumer, {
                    type: 'camera-close',
                    requestId,
                });
            }
        }
    }

    // Lets one browser scroll and pick verses in the app, or stops it. Its
    // pages are told, so a page that may not does not send at all.
    setInteractive(id: string, number: number, isInteractive: boolean) {
        const viewer = this.viewers.get(id);
        if (
            viewer === undefined ||
            viewer.number !== number ||
            viewer.waiting !== null
        ) {
            return false;
        }
        viewer.isInteractive = isInteractive;
        this.allowedClients.delete(id);
        if (isInteractive) {
            if (this.allowedClients.size >= MAX_ALLOWED_CLIENTS) {
                this.allowedClients.delete(
                    this.allowedClients.keys().next().value!,
                );
            }
            this.allowedClients.set(id, number);
        }
        for (const screenSocket of viewer.screenSockets.values()) {
            sendInteractive(screenSocket.socket, isInteractive);
        }
        this.host.onChanged();
        return true;
    }

    // The display's size, wallpaper or screens changed.
    sendLayout(number: number) {
        const layout = this.host.getLayout(number);
        const text = JSON.stringify({ type: 'layout', layout });
        for (const viewer of this.viewers.values()) {
            if (viewer.number !== number) {
                continue;
            }
            if (layout === null) {
                this.releaseViewer(viewer);
                viewer.socket.close(1000, 'Display removed');
            } else if (
                viewer.waiting === null &&
                viewer.socket.readyState === WebSocket.OPEN
            ) {
                viewer.socket.send(text);
            }
        }
    }

    disconnect(id: string) {
        this.allowedClients.delete(id);
        this.grantedClients.delete(id);
        const viewer = this.viewers.get(id);
        if (viewer !== undefined) {
            this.releaseViewer(viewer);
            sendDisconnected(
                viewer.socket,
                this.host.getLayout(viewer.number)?.labels ?? {},
            );
        }
        return viewer ?? null;
    }

    closeAll(number?: number) {
        for (const viewer of [...this.viewers.values()]) {
            if (number === undefined || viewer.number === number) {
                this.releaseViewer(viewer);
                viewer.socket.close(1000, 'Display changed');
            }
        }
    }

    // Who may reach the server changed: a viewer no longer let in is ended.
    closeNotAdmitted() {
        for (const viewer of [...this.viewers.values()]) {
            if (!this.host.checkIsAdmitted(viewer.network)) {
                this.releaseViewer(viewer);
                viewer.socket.close(1000, 'Not allowed');
            }
        }
    }
}
