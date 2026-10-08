import type http from 'node:http';
import type { Duplex } from 'node:stream';
import WebSocket, { WebSocketServer } from 'ws';

import { toMirrorPlainAddress } from './screenMirrorProtocol';
import {
    parseVirtualDisplayPath,
    readVirtualDisplayViewerFeedback,
    toVirtualDisplayCameraId,
    type VirtualDisplayClient,
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
// Camera setup messages a second (an answer and a burst of candidates).
const MAX_CAMERA_PACKETS_PER_SECOND = 100;
// Each browser's camera stream is an encode of its own on this computer.
const MAX_CAMERA_STREAMS = 8;
const REQUEST_ID_PATTERN = /^[a-f0-9-]{36}$/;
const CAMERA_CONSUMER_PATTERN = /^vd:([\w-]+):(\d+)$/;
// A scroll sends a message a frame; more than this in a second is dropped.
const MAX_FEEDBACK_PER_SECOND = 60;
// Clients the operator let interact, remembered across their page reloads.
const MAX_ALLOWED_CLIENTS = 256;

export type WebViewersHostType = {
    checkIsAdmitted: (network: VirtualDisplayNetwork) => boolean;
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
    // A camera stream's setup, to and from Screen Mirror's camera relay;
    // `consumer` is `vd:<viewer>:<screen>`.
    onCamera: (consumer: string, packet: Record<string, any>) => void;
    onCameraGone: (consumer: string) => void;
    hostId: () => string;
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
};

// Closes a viewer the operator disconnected, saying so in the app's
// language; its page shows the words and stops reconnecting.
export const DISCONNECTED_CLOSE_CODE = 4001;
function sendDisconnected(ws: WebSocket, labels: Record<string, string>) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(
            JSON.stringify({ type: 'refused', reason: 'disconnected', labels }),
        );
    }
    ws.close(DISCONNECTED_CLOSE_CODE, 'Disconnected');
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

export class VirtualDisplayWebViewers {
    private wss = new WebSocketServer({
        noServer: true,
        perMessageDeflate: false,
        maxPayload: MAX_INCOMING_BYTES,
    });
    private viewers = new Map<string, ViewerType>();
    // Camera streams browsers are watching, by request id.
    private cameraRequests = new Map<string, CameraRequestType>();
    // The operator's "Allow interaction" is per CLIENT: a browser tab keeps
    // its viewer id across reloads, so a phone that reloads (or a TV that
    // wakes up) is still allowed. Id -> display; kept until the switch goes
    // off, Disconnect, or the app restarts.
    private allowedClients = new Map<string, number>();

    constructor(private readonly host: WebViewersHostType) {}

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
                }) => ({
                    id,
                    kind,
                    address,
                    network,
                    userAgent,
                    since,
                    isPreview,
                    isInteractive,
                }),
            );
    }

    has(id: string) {
        return this.viewers.has(id);
    }

    private checkIsActive(viewer: ViewerType) {
        return (
            this.viewers.get(viewer.id) === viewer &&
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
        if (isCurrent) this.host.onChanged();
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
        // site open in the viewer's browser sends its own origin.
        const { origin, host } = req.headers;
        if (!origin || !host || origin !== `http://${host}`) {
            refuse(socket);
            return;
        }
        const viewerId = url.searchParams.get('viewer') ?? '';
        if (!/^[\w-]{8,64}$/.test(viewerId)) {
            refuse(socket);
            return;
        }
        const address = toMirrorPlainAddress(req.socket.remoteAddress ?? '');
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
        // Disconnected by the operator: let in only to be told so, which
        // also ends its page's retrying (`DISCONNECTED_CLOSE_CODE`).
        if (
            layout !== null &&
            !info.isPreview &&
            this.host.checkIsBlocked(info.number, info.id)
        ) {
            this.wss.handleUpgrade(req, socket, head, (ws) => {
                ws.on('error', () => ws.terminate());
                sendDisconnected(ws, layout.labels);
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
                        }).length >= MAX_WEB_VIEWERS_PER_ADDRESS)))
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
                isInteractive: this.allowedClients.get(info.id) === info.number,
                socket: ws,
                screenSockets: new Map(),
            };
            this.viewers.set(viewer.id, viewer);
            ws.on('error', () => {});
            ws.on('close', () => this.releaseViewer(viewer));
            ws.send(JSON.stringify({ type: 'layout', layout }));
            this.host.onChanged();
        });
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
        const onCamerasChanged = () => {
            this.closeCamerasNotShown(controller);
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
            if (isBinary || !checkIsCurrent()) {
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
        if (viewer === undefined || viewer.number !== number) {
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
            } else if (viewer.socket.readyState === WebSocket.OPEN) {
                viewer.socket.send(text);
            }
        }
    }

    disconnect(id: string) {
        this.allowedClients.delete(id);
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
