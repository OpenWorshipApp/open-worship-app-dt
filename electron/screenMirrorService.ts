import http from 'node:http';
import https from 'node:https';
import dgram from 'node:dgram';
import os from 'node:os';
import path from 'node:path';
import type { Duplex } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import {
    app,
    BrowserWindow,
    ipcMain,
    screen,
    type WebContents,
} from 'electron';
import WebSocket, { WebSocketServer } from 'ws';

import appInfo from '../package.json';
import ElectronSettingManager from './ElectronSettingManager';
import ElectronScreenController from './ElectronScreenController';
import {
    MirrorContentRegistry,
    isContainedPath,
    serveMirrorFile,
} from './screenMirrorContent';
import { screenMirrorRuntime } from './screenMirrorRuntime';
import { getRootUrl } from './protocolHelpers';
import { isDev, messageChannels } from './electronHelpers';
import {
    MIRROR_MAX_MESSAGE,
    MIRROR_PORT_FIRST,
    MIRROR_PORT_LAST,
    MIRROR_PROTOCOL,
    MIRROR_REMOTE_DISPLAY_FIRST,
    MIRROR_FEEDBACK_TYPES,
    isMirrorScreenMessage,
    readMirrorPacket,
    readMirrorDisplays,
    readMirrorCameras,
    rankMirrorAddress,
    sortMirrorHosts,
    type MirrorDiscovery,
    type MirrorDisplay,
    type MirrorCamera,
    type MirrorGuest,
    type MirrorState,
    type MirrorScreenContext,
    type MirrorScreenMessage,
} from './screenMirrorProtocol';

type Peer = {
    socket: WebSocket;
    guest: MirrorGuest;
    approved: boolean;
    alive: boolean;
    localAddress: string;
};
type Output = {
    displayId: number;
    guestId?: string;
    scope: string;
    context: MirrorScreenContext;
};
type Bootstrap = MirrorScreenContext & { messages: MirrorScreenMessage[] };
const KEY = 'screen-mirror-';
const HOST_CAMERA = 'mirror-camera:';
const emptyConnection = (): MirrorState['connection'] => ({
    status: 'disconnected',
    host: '',
    port: 0,
    name: '',
    prefix: '',
    error: null,
});

function localAddresses() {
    return Object.values(os.networkInterfaces())
        .flatMap((list) => list ?? [])
        .filter((nic) => !nic.internal && nic.family === 'IPv4');
}
function socketSend(
    socket: WebSocket,
    type: string,
    data: Record<string, any> = {},
) {
    if (socket.readyState !== WebSocket.OPEN) return false;
    const text = JSON.stringify({ protocol: MIRROR_PROTOCOL, type, ...data });
    if (
        Buffer.byteLength(text) > MIRROR_MAX_MESSAGE ||
        socket.bufferedAmount > MIRROR_MAX_MESSAGE * 2
    ) {
        socket.close(1013, 'Resynchronize');
        return false;
    }
    socket.send(text);
    return true;
}

export class ScreenMirrorService {
    private settings = ElectronSettingManager.getInstance();
    readonly id: string;
    readonly content = new MirrorContentRegistry();
    port = 0;
    error: string | null = null;
    private server?: http.Server;
    private wss?: WebSocketServer;
    private udp?: dgram.Socket;
    private heartbeat?: ReturnType<typeof setInterval>;
    private upstreamHeartbeat?: ReturnType<typeof setInterval>;
    private peers = new Map<string, Peer>();
    private outputs = new Map<number, Output>();
    private incoming = new Map<number, MirrorScreenContext>();
    private main?: WebContents;
    private upstream?: WebSocket;
    private upstreamId = '';
    private reconnectTimer?: ReturnType<typeof setTimeout>;
    private connectOptions?: {
        host: string;
        port: number;
        name?: string;
        code: string;
        resume?: string;
    };
    private reconnectAttempt = 0;
    private connection = emptyConnection();
    private physicalCameras: MirrorCamera[] = [];
    private broker?: BrowserWindow;
    private brokerRequests = new Set<string>();
    private brokerIdleTimer?: ReturnType<typeof setTimeout>;
    private cameraRenderers = new Set<number>();
    private cameraRoutes = new Map<
        string,
        { consumer: string; source: string }
    >();
    private bootstraps = new Map<
        string,
        {
            resolve: (data: Bootstrap) => void;
            reject: (error: Error) => void;
            timer: ReturnType<typeof setTimeout>;
        }
    >();
    private identities: Record<
        string,
        { prefix: string; displays: Record<string, number> }
    >;
    private scan?: { close: () => void };
    private displayRevision = 0;

    constructor() {
        let id = this.settings.getClientSetting(`${KEY}identity`);
        if (!id) {
            id = randomUUID();
            this.settings.setClientSetting(`${KEY}identity`, id);
        }
        this.id = id;
        try {
            this.identities = JSON.parse(
                this.settings.getClientSetting(`${KEY}guests`) ?? '{}',
            );
        } catch {
            this.identities = {};
        }
    }
    get baseUrl() {
        return `http://127.0.0.1:${this.port}`;
    }
    get approvalMode(): 'approve' | 'code' {
        return this.settings.getClientSetting(`${KEY}mode`) === 'code'
            ? 'code'
            : 'approve';
    }
    // Hosting is OFF until the operator turns it on in the Screen Mirror
    // Connection panel. Until then the server is this computer's own -- its
    // guest output windows load through it -- bound to loopback, silent to a
    // scan and closed to guests, so a computer that never hosts never shows
    // up as a host and never raises the firewall's incoming-connection prompt.
    get isHostEnabled() {
        return this.settings.getClientSetting(`${KEY}host`) === 'true';
    }
    get customPort() {
        const port = Number(this.settings.getClientSetting(`${KEY}port`));
        return Number.isInteger(port) && port > 0 && port <= 65535
            ? port
            : null;
    }
    discovery(): MirrorDiscovery {
        return {
            service: 'owa-screen-mirror',
            protocol: MIRROR_PROTOCOL,
            id: this.id,
            name: os.hostname(),
            version: appInfo.version,
            port: this.port,
        };
    }
    state(): MirrorState {
        return {
            id: this.id,
            port: this.port,
            hostEnabled: this.isHostEnabled,
            displayRevision: this.displayRevision,
            addresses: localAddresses().map(
                (nic) => `http://${nic.address}:${this.port}`,
            ),
            error: this.error,
            approvalMode: this.approvalMode,
            hasCode: !!this.settings.getSecureSetting(`${KEY}code`),
            customPort: this.customPort,
            guests: [...this.peers.values()]
                .filter((peer) => peer.approved)
                .map((peer) => peer.guest),
            pending: [...this.peers.values()]
                .filter((peer) => !peer.approved)
                .map(({ guest }) => ({
                    id: guest.id,
                    name: guest.name,
                    address: guest.address,
                })),
            connection: { ...this.connection },
        };
    }
    private trusted(contents: WebContents) {
        try {
            const url = new URL(contents.getURL());
            return (
                (contents.getURL().startsWith(`${getRootUrl()}/`) ||
                    url.origin === this.baseUrl) &&
                /\.html$/.test(url.pathname)
            );
        } catch {
            return false;
        }
    }
    private notify() {
        const state = this.state();
        for (const win of BrowserWindow.getAllWindows()) {
            if (this.trusted(win.webContents))
                win.webContents.send('mirror:state', state);
        }
        this.main?.send('mirror:devices-changed');
        if (!this.upstream) this.sendInventory();
    }
    configure(main: WebContents) {
        this.main = main;
    }
    async start() {
        this.initIpc();
        if (!(await this.listen())) return;
        this.wss = new WebSocketServer({
            noServer: true,
            perMessageDeflate: false,
            maxPayload: MIRROR_MAX_MESSAGE,
        });
        if (this.isHostEnabled) this.openDiscovery();
        this.heartbeat = setInterval(() => {
            for (const peer of this.peers.values()) {
                if (!peer.alive) peer.socket.terminate();
                else {
                    peer.alive = false;
                    peer.socket.ping();
                }
            }
        }, 5000);
        screenMirrorRuntime.screenUrl = (screenId) =>
            `${this.baseUrl}/screen.html?screenId=${screenId}`;
        screenMirrorRuntime.context = (screenId) =>
            this.incoming.get(screenId) ?? this.outputs.get(screenId)?.context;
        const displayChanged = () => {
            this.displayRevision++;
            this.sendInventory();
            this.notify();
        };
        screen.on('display-added', displayChanged);
        screen.on('display-removed', displayChanged);
        screen.on('display-metrics-changed', displayChanged);
        app.once('will-quit', () => this.stop());
    }
    private createServer() {
        const server = http.createServer((req, res) => {
            void this.handleHttp(req, res);
        });
        server.on('upgrade', (req, socket, head) =>
            this.handleUpgrade(req, socket, head),
        );
        return server;
    }
    // Loopback while hosting is off, every network while it is on. A rebind
    // asks for the port it had first, so windows already loaded from it keep
    // their origin.
    private async listen(preferredPort?: number) {
        const server = this.createServer();
        const host = this.isHostEnabled ? '0.0.0.0' : '127.0.0.1';
        const ports = this.customPort
            ? [this.customPort]
            : [
                  ...new Set([
                      ...(preferredPort ? [preferredPort] : []),
                      ...Array.from(
                          { length: MIRROR_PORT_LAST - MIRROR_PORT_FIRST + 1 },
                          (_, i) => MIRROR_PORT_FIRST + i,
                      ),
                      0,
                  ]),
              ];
        for (const port of ports) {
            try {
                await new Promise<void>((resolve, reject) => {
                    const fail = (error: Error) => {
                        server.off('listening', done);
                        reject(error);
                    };
                    const done = () => {
                        server.off('error', fail);
                        resolve();
                    };
                    server.once('error', fail);
                    server.once('listening', done);
                    server.listen(port, host);
                });
                const address = server.address();
                this.port =
                    typeof address === 'object' && address ? address.port : 0;
                break;
            } catch (error: any) {
                if (
                    this.customPort ||
                    !['EADDRINUSE', 'EACCES'].includes(error.code)
                ) {
                    this.error = 'Unable to start screen mirror server';
                    return false;
                }
            }
        }
        server.on('error', () => {
            this.error = 'Unable to start screen mirror server';
            this.notify();
        });
        this.server = server;
        this.error = null;
        return true;
    }
    private handleUpgrade(
        req: http.IncomingMessage,
        socket: Duplex,
        head: Buffer,
    ) {
        const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(
            req.socket.remoteAddress ?? '',
        );
        if (isDev && local && req.url?.startsWith('/?token=')) {
            // Keep HTTP-loaded development screens on the existing Vite HMR server.
            this.wss!.handleUpgrade(req, socket, head, (client) => {
                const vite = new WebSocket(
                    `wss://localhost:3000${req.url}`,
                    'vite-hmr',
                    {
                        rejectUnauthorized: false,
                        origin: 'https://localhost:3000',
                    },
                );
                const pending: Array<{ bytes: Buffer; binary: boolean }> = [];
                client.on('message', (bytes, binary) => {
                    if (vite.readyState === WebSocket.OPEN)
                        vite.send(bytes, { binary });
                    else if (pending.length < 8)
                        pending.push({ bytes: bytes as Buffer, binary });
                });
                vite.on('open', () => {
                    for (const item of pending.splice(0))
                        vite.send(item.bytes, { binary: item.binary });
                });
                vite.on('message', (bytes, binary) => {
                    if (client.readyState === WebSocket.OPEN)
                        client.send(bytes, { binary });
                });
                client.on('close', () => vite.close());
                client.on('error', () => vite.terminate());
                vite.on('close', () => client.close());
                vite.on('error', () => client.close(1011));
            });
            return;
        }
        // Browser pages must not initiate guest connections. Installed clients
        // connect from main, which sends no Origin header.
        if (
            !this.isHostEnabled ||
            req.url !== '/mirror' ||
            req.headers.origin ||
            this.peers.size >= 32
        ) {
            socket.destroy();
            return;
        }
        this.wss!.handleUpgrade(req, socket, head, (ws) =>
            this.acceptSocket(ws, req.socket.remoteAddress ?? ''),
        );
    }
    private openDiscovery() {
        if (this.udp) return;
        const udp = dgram.createSocket('udp4');
        this.udp = udp;
        udp.on('error', () => {
            try {
                udp.close();
            } catch {}
            if (this.udp === udp) this.udp = undefined;
        });
        udp.on('message', (message, rinfo) => {
            if (
                message.length < 128 &&
                message.toString() === 'owa-screen-mirror-discover-v1'
            ) {
                udp.send(
                    JSON.stringify(this.discovery()),
                    rinfo.port,
                    rinfo.address,
                );
            }
        });
        udp.bind(this.port);
    }
    private closeDiscovery() {
        try {
            this.udp?.close();
        } catch {}
        this.udp = undefined;
    }
    // Turning hosting off ends every guest's connection the way the panel's
    // own Disconnect does; either way the server rebinds on the same port.
    async setHostEnabled(isEnabled: boolean) {
        if (isEnabled === this.isHostEnabled) return;
        this.settings.setClientSetting(`${KEY}host`, isEnabled ? 'true' : '');
        this.closeDiscovery();
        if (!isEnabled) {
            for (const [id, peer] of this.peers) {
                this.resumptions.delete(id);
                socketSend(peer.socket, 'error', {
                    error: 'Disconnected by host',
                });
                peer.socket.close();
            }
        }
        const previous = this.server;
        if (previous) {
            await new Promise<void>((resolve) => {
                previous.close(() => resolve());
                previous.closeAllConnections();
            });
        }
        if ((await this.listen(this.port)) && isEnabled) this.openDiscovery();
        this.notify();
    }
    stop() {
        clearInterval(this.heartbeat);
        clearInterval(this.upstreamHeartbeat);
        clearTimeout(this.reconnectTimer);
        clearTimeout(this.brokerIdleTimer);
        this.scan?.close();
        this.upstream?.terminate();
        for (const peer of this.peers.values()) peer.socket.terminate();
        for (const client of this.wss?.clients ?? []) client.terminate();
        this.wss?.close();
        try {
            this.udp?.close();
        } catch {}
        this.server?.close();
        this.content.clear();
        this.broker?.destroy();
    }
    private async handleHttp(
        req: http.IncomingMessage,
        res: http.ServerResponse,
    ) {
        try {
            if (!['GET', 'HEAD'].includes(req.method ?? '')) {
                res.writeHead(405).end();
                return;
            }
            const url = new URL(req.url ?? '/', this.baseUrl);
            if (url.pathname === '/discovery' && !this.isHostEnabled) {
                res.writeHead(404).end();
                return;
            }
            if (url.pathname === '/discovery') {
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store',
                });
                res.end(
                    req.method === 'HEAD'
                        ? undefined
                        : JSON.stringify(this.discovery()),
                );
                return;
            }
            if (url.pathname.startsWith('/content/')) {
                await this.content.serve(req, res, url.pathname);
                return;
            }
            const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(
                req.socket.remoteAddress ?? '',
            );
            if (!local) {
                res.writeHead(404).end();
                return;
            }
            if (isDev) {
                // Only loopback can reach Vite's development source endpoint.
                const proxy = https.request(
                    `https://localhost:3000${url.pathname}${url.search}`,
                    { method: req.method, rejectUnauthorized: false },
                    (response) => {
                        res.writeHead(
                            response.statusCode ?? 502,
                            response.headers,
                        );
                        response.pipe(res);
                    },
                );
                proxy.on('error', () => {
                    if (!res.headersSent) res.writeHead(502);
                    res.end();
                });
                res.on('close', () => proxy.destroy());
                proxy.end();
                return;
            }
            const root = path.resolve(app.getAppPath(), 'dist');
            const file = path.resolve(
                root,
                `.${decodeURIComponent(url.pathname)}`,
            );
            if (!isContainedPath(root, file)) {
                res.writeHead(404).end();
                return;
            }
            await serveMirrorFile(req, res, file);
        } catch {
            if (!res.headersSent) res.writeHead(404);
            res.end();
        }
    }
    private acceptSocket(socket: WebSocket, address: string) {
        let peer: Peer | undefined;
        const helloTimeout = setTimeout(
            () => socket.close(1008, 'Hello required'),
            10000,
        );
        socket.on('error', () => {});
        socket.on('pong', () => {
            if (peer) peer.alive = true;
        });
        socket.on('message', (bytes, binary) => {
            if (binary) {
                socket.close(1008);
                return;
            }
            const packet = readMirrorPacket(bytes.toString());
            if (!packet) {
                socket.close(1008);
                return;
            }
            if (!peer) {
                if (
                    packet.type !== 'hello' ||
                    typeof packet.id !== 'string' ||
                    !/^[a-f0-9-]{36}$/.test(packet.id) ||
                    packet.id === this.id ||
                    typeof packet.name !== 'string' ||
                    packet.name.length > 256 ||
                    packet.version !== appInfo.version ||
                    this.upstream ||
                    this.peers.has(packet.id)
                ) {
                    socketSend(socket, 'error', {
                        error: 'Incompatible or duplicate connection',
                    });
                    socket.close(1008);
                    return;
                }
                clearTimeout(helloTimeout);
                peer = {
                    socket,
                    approved: false,
                    alive: true,
                    localAddress: (socket as any)._socket.localAddress.replace(
                        /^::ffff:/,
                        '',
                    ),
                    guest: {
                        id: packet.id,
                        name: packet.name,
                        prefix: '',
                        address,
                        displays: [],
                        cameras: [],
                    },
                };
                this.peers.set(packet.id, peer);
                const code = this.settings.getSecureSetting(`${KEY}code`);
                const supplied =
                    typeof packet.code === 'string' ? packet.code : '';
                const codeMatches =
                    !!code &&
                    Buffer.byteLength(code) === Buffer.byteLength(supplied) &&
                    timingSafeEqual(Buffer.from(code), Buffer.from(supplied));
                // Resume is a per-session capability; it is never persisted or logged.
                const resume = this.resumptions.get(packet.id);
                if (
                    (resume && packet.resume === resume) ||
                    (this.approvalMode === 'code' && codeMatches)
                )
                    this.approve(packet.id);
                else if (this.approvalMode === 'code') {
                    socketSend(socket, 'error', {
                        error: 'Connection code is incorrect',
                    });
                    socket.close(1008);
                } else {
                    socketSend(socket, 'pending');
                    this.notify();
                }
                return;
            }
            if (!peer.approved) return;
            if (packet.type === 'inventory') {
                const previousInventory = JSON.stringify({
                    displays: peer.guest.displays,
                    cameras: peer.guest.cameras,
                });
                const old = new Set(
                    peer.guest.displays.map((display) => display.id),
                );
                peer.guest.displays = readMirrorDisplays(packet.displays).map(
                    (display) => this.virtualDisplay(peer!.guest.id, display),
                );
                peer.guest.cameras = readMirrorCameras(packet.cameras).map(
                    (camera) => ({
                        ...camera,
                        deviceId: `${HOST_CAMERA}${peer!.guest.id}:${camera.deviceId}`,
                        label: `${peer!.guest.prefix}: ${camera.label}`,
                    }),
                );
                if (
                    previousInventory ===
                    JSON.stringify({
                        displays: peer.guest.displays,
                        cameras: peer.guest.cameras,
                    })
                )
                    return;
                for (const [screenId, output] of this.outputs) {
                    if (
                        output.guestId === peer.guest.id &&
                        old.has(output.displayId) &&
                        !peer.guest.displays.some(
                            (display) => display.id === output.displayId,
                        )
                    )
                        this.hide(screenId);
                }
                this.notify();
            } else if (
                packet.type === 'screen-feedback' &&
                isMirrorScreenMessage(packet.message) &&
                MIRROR_FEEDBACK_TYPES.has(packet.message.type) &&
                this.outputs.get(packet.message.screenId)?.guestId ===
                    peer.guest.id
            ) {
                if (
                    packet.message.type === 'visible' &&
                    packet.message.data?.isShowing === false
                )
                    this.hide(packet.message.screenId);
                else
                    this.main?.send(
                        messageChannels.screenMessage,
                        packet.message,
                    );
            } else if (
                packet.type === 'step-bible' &&
                this.outputs.get(packet.screenId)?.guestId === peer.guest.id &&
                typeof packet.isNext === 'boolean'
            ) {
                this.main?.send('app:main:change-bible', {
                    screenId: packet.screenId,
                    isNext: packet.isNext,
                });
            } else if (
                packet.type === 'camera-request' ||
                packet.type === 'camera-signal' ||
                packet.type === 'camera-close'
            ) {
                this.routeCamera(peer.guest.id, packet);
            }
        });
        socket.on('close', () => {
            clearTimeout(helloTimeout);
            if (!peer || this.peers.get(peer.guest.id) !== peer) return;
            this.peers.delete(peer.guest.id);
            for (const [id, output] of this.outputs)
                if (output.guestId === peer.guest.id) this.hide(id);
            this.closeCameraRoutes(peer.guest.id);
            this.notify();
        });
    }
    private resumptions = new Map<string, string>();
    approve(id: string) {
        const peer = this.peers.get(id);
        if (!peer || peer.approved) return;
        let identity = this.identities[id];
        if (!identity) {
            const prefixes = new Set(
                Object.values(this.identities).map((entry) => entry.prefix),
            );
            let n = 1;
            while (prefixes.has(`a${n}`)) n++;
            identity = { prefix: `a${n}`, displays: {} };
            this.identities[id] = identity;
            this.saveIdentities();
        }
        peer.guest.prefix = identity.prefix;
        peer.approved = true;
        const resume = randomUUID();
        this.resumptions.set(id, resume);
        socketSend(peer.socket, 'approved', {
            id: this.id,
            prefix: identity.prefix,
            resume,
        });
        this.notify();
    }
    private saveIdentities() {
        this.settings.setClientSetting(
            `${KEY}guests`,
            JSON.stringify(this.identities),
        );
    }
    private virtualDisplay(
        guestId: string,
        display: MirrorDisplay,
    ): MirrorDisplay {
        const identity = this.identities[guestId];
        let id = identity.displays[String(display.id)];
        if (id === undefined) {
            const used = new Set(
                Object.values(this.identities).flatMap((entry) =>
                    Object.values(entry.displays),
                ),
            );
            id = MIRROR_REMOTE_DISPLAY_FIRST;
            while (used.has(id)) id--;
            identity.displays[String(display.id)] = id;
            this.saveIdentities();
        }
        return {
            ...display,
            id,
            localId: display.id,
            guestId,
            label: identity.prefix,
        };
    }
    displays() {
        return [...this.peers.values()]
            .filter((peer) => peer.approved)
            .flatMap((peer) => peer.guest.displays);
    }
    cameras() {
        if (this.upstream && this.connection.status === 'connected')
            return this.upstreamCameras;
        return [...this.peers.values()]
            .filter((peer) => peer.approved)
            .flatMap((peer) => peer.guest.cameras);
    }
    private upstreamCameras: MirrorCamera[] = [];
    showingIds() {
        return [...this.outputs.keys()];
    }
    isRemoteDisplay(id: number) {
        return id <= MIRROR_REMOTE_DISPLAY_FIRST;
    }
    private async bootstrap(screenId: number) {
        if (!this.main || this.main.isDestroyed())
            throw new Error('Presenter is unavailable');
        const requestId = randomUUID();
        const promise = new Promise<Bootstrap>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.bootstraps.delete(requestId);
                reject(new Error('Screen initialization timed out'));
            }, 10000);
            this.bootstraps.set(requestId, { resolve, reject, timer });
        });
        this.main.send('mirror:bootstrap-request', { requestId, screenId });
        return promise;
    }
    async prepareOutput(screenId: number, displayId: number) {
        if (!this.port || this.error)
            throw new Error('Screen mirror server is unavailable');
        const old = this.outputs.get(screenId);
        if (old) this.hide(screenId);
        const display = this.displays().find((item) => item.id === displayId);
        if (this.isRemoteDisplay(displayId) && !display)
            throw new Error('Guest display is disconnected');
        const context: MirrorScreenContext = {
            screenId,
            stage: 0,
            settings: {},
            resources: {},
            fontCss: '',
            isWindows: process.platform === 'win32',
            remote: !!display,
        };
        const output: Output = {
            displayId,
            guestId: display?.guestId,
            scope: this.content.createScope(),
            context,
        };
        this.outputs.set(screenId, output);
        try {
            const data = await this.bootstrap(screenId);
            if (this.outputs.get(screenId) !== output)
                throw new Error('Screen initialization cancelled');
            output.context = { ...data, resources: {}, remote: !!display };
            output.context = this.translate(
                screenId,
                output.context,
                display?.guestId
                    ? (this.peers.get(display.guestId)?.guest.address ?? '')
                    : '',
            );
            if (display) {
                const peer = this.peers.get(display.guestId!)!;
                socketSend(peer.socket, 'show', {
                    screenId,
                    displayId: display.localId,
                    context: output.context,
                });
            }
            return !!display;
        } catch (error) {
            if (this.outputs.get(screenId) === output) this.hide(screenId);
            throw error;
        }
    }
    hide(screenId: number) {
        const output = this.outputs.get(screenId);
        if (!output) return;
        if (output.guestId) {
            const peer = this.peers.get(output.guestId);
            if (peer) socketSend(peer.socket, 'hide', { screenId });
        }
        this.content.revoke(output.scope);
        this.outputs.delete(screenId);
        this.main?.send(messageChannels.screenMessage, {
            screenId,
            type: 'visible',
            data: { isShowing: false },
        });
    }
    resource(screenId: number, filePath: string) {
        const incoming = this.incoming.get(screenId);
        if (incoming) {
            if (incoming.resources[filePath])
                return incoming.resources[filePath];
            const pathApi = incoming.isWindows ? path.win32 : path.posix;
            for (const [publishedPath, url] of Object.entries(
                incoming.resources,
            )) {
                if (!/\.(html?|css)$/i.test(publishedPath)) continue;
                const root = pathApi.dirname(publishedPath);
                const relative = pathApi.relative(root, filePath);
                if (
                    relative &&
                    !pathApi.isAbsolute(relative) &&
                    relative !== '..' &&
                    !relative.startsWith(`..${pathApi.sep}`)
                ) {
                    return new URL(
                        relative
                            .split(pathApi.sep)
                            .map(encodeURIComponent)
                            .join('/'),
                        url,
                    ).href;
                }
            }
            return '';
        }
        const output = this.outputs.get(screenId);
        if (!output) return '';
        return this.publish(output, filePath, this.baseUrl) ?? '';
    }
    private publish(output: Output, filePath: string, baseUrl: string) {
        const published = this.content.publish(output.scope, filePath);
        if (!published) return null;
        if (Object.keys(output.context.resources).length >= 4096) {
            const files = this.content.publishedFiles(output.scope);
            for (const key of Object.keys(output.context.resources))
                if (!files.has(path.resolve(key)))
                    delete output.context.resources[key];
        }
        const url = `${baseUrl}${published}`;
        output.context.resources[filePath] = url;
        return url;
    }
    private translate(screenId: number, data: any, _peerAddress: string) {
        const output = this.outputs.get(screenId)!;
        // The guest reaches the same NIC on which it connected, never loopback.
        const peer = output.guestId && this.peers.get(output.guestId);
        const localAddress = peer ? peer.localAddress : '127.0.0.1';
        const baseUrl = `http://${localAddress}:${this.port}`;
        const visit = (value: any, key = ''): any => {
            if (typeof value === 'string') {
                if (value.startsWith(`${getRootUrl()}/`)) {
                    const url = new URL(value);
                    const pathname = decodeURIComponent(url.pathname);
                    const file = isDev
                        ? pathname.startsWith('/@fs/')
                            ? pathname.slice(5)
                            : path.join(
                                  app.getAppPath(),
                                  pathname.startsWith('/src/') ? '' : 'public',
                                  pathname,
                              )
                        : path.join(app.getAppPath(), 'dist', pathname);
                    return this.publish(output, file, baseUrl) ?? '';
                }
                if (value.startsWith('file:')) {
                    try {
                        return (
                            this.publish(
                                output,
                                fileURLToPath(value),
                                baseUrl,
                            ) ?? ''
                        );
                    } catch {
                        return '';
                    }
                }
                if (path.isAbsolute(value) && /(?:src|path|url)$/i.test(key)) {
                    this.publish(output, value, baseUrl);
                    // Keep paths used as document identity; the preload maps them.
                    return /path$/i.test(key)
                        ? value
                        : (this.publish(output, value, baseUrl) ?? '');
                }
                if (value.includes('file:') || value.includes(getRootUrl()))
                    return value.replace(
                        /(?:file:\/\/|owa:\/\/local\/|https:\/\/localhost:3000\/)[^\s"'<>\)]+/g,
                        (url) => visit(url),
                    );
                return value;
            }
            if (Array.isArray(value))
                return value.map((item) => visit(item, key));
            if (value && typeof value === 'object') {
                const camera = (id: string) =>
                    output.guestId && !id.startsWith(HOST_CAMERA)
                        ? `${HOST_CAMERA}${this.id}:${id}`
                        : id;
                const source =
                    value.type === 'camera'
                        ? {
                              ...value,
                              ...(typeof value.src === 'string'
                                  ? { src: camera(value.src) }
                                  : {}),
                              ...(typeof value.deviceId === 'string'
                                  ? { deviceId: camera(value.deviceId) }
                                  : {}),
                          }
                        : key === 'cameraDataList' &&
                            typeof value.id === 'string'
                          ? { ...value, id: camera(value.id) }
                          : value;
                return Object.fromEntries(
                    Object.entries(source).map(([name, item]) => [
                        name,
                        visit(item, name),
                    ]),
                );
            }
            return value;
        };
        const result = visit(data);
        if (result && 'resources' in result)
            result.resources = { ...output.context.resources };
        return result;
    }
    localMessage(message: MirrorScreenMessage) {
        const output = this.outputs.get(message.screenId);
        if (!output) return message;
        if (Number.isInteger(message.stage) && message.stage! >= 0)
            output.context.stage = message.stage!;
        const translated = this.translate(message.screenId, message, '');
        ElectronScreenController.getInstance(message.screenId)?.sendData(
            'mirror:context',
            {
                stage: output.context.stage,
                resources: output.context.resources,
            },
        );
        return translated;
    }
    sendScreenMessage(message: MirrorScreenMessage) {
        const output = this.outputs.get(message.screenId);
        if (!output?.guestId) return false;
        const peer = this.peers.get(output.guestId);
        if (!peer) return true;
        if (Number.isInteger(message.stage) && message.stage! >= 0)
            output.context.stage = message.stage!;
        const translated = this.translate(
            message.screenId,
            message,
            peer.guest.address,
        );
        socketSend(peer.socket, 'screen', {
            message: translated,
            resources: output.context.resources,
            stage: output.context.stage,
        });
        return true;
    }
    sendFeedback(message: MirrorScreenMessage) {
        if (!this.incoming.has(message.screenId) || !this.upstream)
            return false;
        if (MIRROR_FEEDBACK_TYPES.has(message.type))
            socketSend(this.upstream, 'screen-feedback', { message });
        return true;
    }
    stepBible(data: { screenId: number; isNext: boolean }) {
        if (!this.upstream || !this.incoming.has(data.screenId)) return false;
        socketSend(this.upstream, 'step-bible', data);
        return true;
    }
    private sendInventory() {
        if (this.upstream && this.connection.status === 'connected')
            socketSend(this.upstream, 'inventory', {
                displays: screen.getAllDisplays().map((display) => ({
                    id: display.id,
                    label: display.label ?? '',
                    bounds: display.bounds,
                    scaleFactor: display.scaleFactor,
                    isPrimary: display.id === screen.getPrimaryDisplay().id,
                })),
                cameras: this.physicalCameras,
            });
        for (const peer of this.peers.values())
            if (peer.approved)
                socketSend(peer.socket, 'cameras', {
                    cameras: [
                        ...this.physicalCameras.map((camera) => ({
                            ...camera,
                            deviceId: `${HOST_CAMERA}${this.id}:${camera.deviceId}`,
                        })),
                        ...this.cameras(),
                    ],
                });
    }
    async connect(options: { host: string; port: number; code: string }) {
        if (
            this.peers.size ||
            !options.host ||
            !Number.isInteger(options.port) ||
            options.port < 1 ||
            options.port > 65535 ||
            options.host.length > 253 ||
            /[\s/\\?#@]/.test(options.host)
        )
            throw new Error('Invalid host or port');
        const name = await new Promise<string>((resolve, reject) => {
            const request = http.get(
                `http://${options.host}:${options.port}/discovery`,
                { timeout: 5000 },
                (response) => {
                    let data = '';
                    response.on('data', (chunk) => {
                        data += chunk;
                        if (data.length > 2048)
                            request.destroy(new Error('Connection failed'));
                    });
                    response.on('error', reject);
                    response.on('end', () => {
                        try {
                            const host = JSON.parse(data);
                            if (
                                response.statusCode !== 200 ||
                                host.service !== 'owa-screen-mirror' ||
                                host.protocol !== MIRROR_PROTOCOL ||
                                host.version !== appInfo.version ||
                                typeof host.id !== 'string' ||
                                host.id === this.id
                            )
                                throw new Error(
                                    'Incompatible or duplicate connection',
                                );
                            resolve(
                                typeof host.name === 'string'
                                    ? host.name.slice(0, 256)
                                    : '',
                            );
                        } catch {
                            reject(
                                new Error(
                                    'Incompatible or duplicate connection',
                                ),
                            );
                        }
                    });
                },
            );
            request.on('timeout', () =>
                request.destroy(new Error('Connection failed')),
            );
            request.on('error', () => reject(new Error('Connection failed')));
        });
        this.disconnect();
        this.connectOptions = { ...options, name };
        this.openUpstream();
    }
    private openUpstream() {
        const options = this.connectOptions;
        if (!options) return;
        this.connection = {
            status: this.reconnectAttempt ? 'reconnecting' : 'connecting',
            host: options.host,
            port: options.port,
            name: options.name ?? '',
            prefix: this.connection.prefix,
            error: null,
        };
        const socket = new WebSocket(
            `ws://${options.host}:${options.port}/mirror`,
            {
                perMessageDeflate: false,
                maxPayload: MIRROR_MAX_MESSAGE,
                handshakeTimeout: 5000,
            },
        );
        let alive = true;
        clearInterval(this.upstreamHeartbeat);
        this.upstreamHeartbeat = setInterval(() => {
            if (socket.readyState !== WebSocket.OPEN) return;
            if (!alive) socket.terminate();
            else {
                alive = false;
                socket.ping();
            }
        }, 5000);
        socket.on('pong', () => {
            alive = true;
        });
        this.upstream = socket;
        let denied = false;
        socket.on('open', () =>
            socketSend(socket, 'hello', {
                id: this.id,
                name: os.hostname(),
                version: appInfo.version,
                code: options.code,
                resume: options.resume,
            }),
        );
        socket.on('error', () => {});
        socket.on('message', (bytes, binary) => {
            const packet = !binary && readMirrorPacket(bytes.toString());
            if (!packet) {
                socket.close(1008);
                return;
            }
            if (packet.type === 'pending') this.connection.status = 'pending';
            else if (packet.type === 'error') {
                denied = true;
                this.connection.status = 'error';
                this.connection.error = String(packet.error).slice(0, 256);
            } else if (
                packet.type === 'approved' &&
                typeof packet.id === 'string' &&
                packet.id !== this.id &&
                typeof packet.prefix === 'string'
            ) {
                this.upstreamId = packet.id;
                options.resume = packet.resume;
                this.reconnectAttempt = 0;
                this.connection.status = 'connected';
                this.connection.prefix = packet.prefix;
                this.sendInventory();
            } else if (this.connection.status === 'connected') {
                if (packet.type === 'show')
                    void this.showIncoming(packet).catch(() =>
                        socketSend(socket, 'screen-feedback', {
                            message: {
                                screenId: packet.screenId,
                                type: 'visible',
                                data: { isShowing: false },
                            },
                        }),
                    );
                else if (
                    packet.type === 'hide' &&
                    Number.isSafeInteger(packet.screenId)
                )
                    this.hideIncoming(packet.screenId);
                else if (
                    packet.type === 'screen' &&
                    isMirrorScreenMessage(packet.message)
                ) {
                    const context = this.incoming.get(packet.message.screenId);
                    if (context) {
                        context.resources = packet.resources ?? {};
                        if (Number.isInteger(packet.stage) && packet.stage >= 0)
                            context.stage = packet.stage;
                        const controller = ElectronScreenController.getInstance(
                            packet.message.screenId,
                        );
                        controller?.sendData('mirror:context', {
                            stage: context.stage,
                            resources: context.resources,
                        });
                        controller?.sendMessage(
                            packet.message.type,
                            packet.message.data,
                        );
                    }
                } else if (packet.type === 'cameras') {
                    // Up to 32 guests plus the host, each with 32 native cameras.
                    const cameras = readMirrorCameras(packet.cameras, 33 * 32);
                    if (
                        JSON.stringify(cameras) !==
                        JSON.stringify(this.upstreamCameras)
                    ) {
                        this.upstreamCameras = cameras;
                        this.notify();
                    }
                } else if (
                    [
                        'camera-request',
                        'camera-signal',
                        'camera-close',
                    ].includes(packet.type)
                )
                    this.deliverGuestCamera(packet);
            }
            this.notifyStateOnly();
        });
        socket.on('close', () => {
            if (this.upstream !== socket) return;
            clearInterval(this.upstreamHeartbeat);
            this.upstream = undefined;
            this.upstreamCameras = [];
            for (const id of this.incoming.keys()) this.hideIncoming(id);
            this.closeCameraRoutes('upstream');
            if (!denied && this.connectOptions) {
                this.connection.status = 'reconnecting';
                this.reconnectTimer = setTimeout(
                    () => this.openUpstream(),
                    Math.min(1000 * 2 ** this.reconnectAttempt++, 30000),
                );
            }
            this.notify();
        });
        this.notifyStateOnly();
    }
    private notifyStateOnly() {
        const state = this.state();
        for (const win of BrowserWindow.getAllWindows())
            if (this.trusted(win.webContents))
                win.webContents.send('mirror:state', state);
    }
    disconnect() {
        this.connectOptions = undefined;
        clearTimeout(this.reconnectTimer);
        clearInterval(this.upstreamHeartbeat);
        this.reconnectAttempt = 0;
        const socket = this.upstream;
        this.upstream = undefined;
        socket?.close();
        for (const id of this.incoming.keys()) this.hideIncoming(id);
        this.upstreamCameras = [];
        this.connection = emptyConnection();
        this.closeCameraRoutes('upstream');
        this.notify();
    }
    private async showIncoming(packet: Record<string, any>) {
        if (
            !Number.isSafeInteger(packet.screenId) ||
            packet.screenId < 0 ||
            !packet.context ||
            packet.context.screenId !== packet.screenId
        )
            throw new Error('Invalid output');
        const display = screen
            .getAllDisplays()
            .find((item) => item.id === packet.displayId);
        if (!display) throw new Error('Display unavailable');
        this.hideIncoming(packet.screenId);
        const context: MirrorScreenContext = {
            ...packet.context,
            remote: true,
        };
        this.incoming.set(packet.screenId, context);
        const controller = ElectronScreenController.createInstance(
            packet.screenId,
        );
        controller.win.once('closed', () => {
            if (this.incoming.get(packet.screenId) !== context) return;
            this.incoming.delete(packet.screenId);
            this.sendIncomingInvisible(packet.screenId);
        });
        controller.setDisplay(display);
        await controller.listenLoading();
        // It opens from a network message, not a click, so Windows leaves it
        // under the focused main window -- on a one-monitor guest, out of
        // sight. The output is what this computer is for while it is up.
        if (!controller.win.isDestroyed()) {
            // Through the always-on-top band and straight back out: `moveTop`
            // alone loses to another app's focused window (Windows' foreground
            // lock), which left an output moved onto the primary monitor behind
            // a main window. It ends in front, but not pinned there -- a click
            // on the main window still brings that forward.
            controller.win.setAlwaysOnTop(true);
            controller.win.moveTop();
            controller.win.setAlwaysOnTop(false);
            controller.win.focus();
        }
    }
    private sendIncomingInvisible(screenId: number) {
        if (this.upstream)
            socketSend(this.upstream, 'screen-feedback', {
                message: {
                    screenId,
                    type: 'visible',
                    data: { isShowing: false },
                },
            });
    }
    private hideIncoming(screenId: number) {
        const controller = ElectronScreenController.getInstance(screenId);
        controller?.close();
        this.incoming.delete(screenId);
    }
    async rescan(): Promise<MirrorDiscovery[]> {
        this.scan?.close();
        const found = new Map<string, MirrorDiscovery>();
        const checked = new Set<string>();
        const requests = new Set<http.ClientRequest>();
        const socket = dgram.createSocket('udp4');
        return new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                for (const request of requests) request.destroy();
                try {
                    socket.close();
                } catch {}
                resolve(sortMirrorHosts([...found.values()]));
            };
            const timer = setTimeout(finish, 2500);
            this.scan = { close: finish };
            socket.on('error', finish);
            socket.on('message', (bytes, rinfo) => {
                if (bytes.length > 2048) return;
                try {
                    const value = JSON.parse(bytes.toString());
                    if (
                        value.service !== 'owa-screen-mirror' ||
                        value.protocol !== MIRROR_PROTOCOL ||
                        value.id === this.id ||
                        typeof value.id !== 'string' ||
                        value.version !== appInfo.version ||
                        !Number.isInteger(value.port) ||
                        value.port < 1 ||
                        value.port > 65535
                    )
                        return;
                    const candidate = `${rinfo.address}:${value.port}`;
                    if (checked.has(candidate) || checked.size >= 64) return;
                    checked.add(candidate);
                    const request = http.get(
                        `http://${rinfo.address}:${value.port}/discovery`,
                        { timeout: 1000 },
                        (response) => {
                            let text = '';
                            response.on('data', (chunk) => {
                                text += chunk;
                                if (text.length > 2048) request.destroy();
                            });
                            response.on('end', () => {
                                try {
                                    const verified = JSON.parse(text);
                                    const known = found.get(value.id);
                                    // Every network it answered on was tried;
                                    // keep the best address, not the last.
                                    if (
                                        !done &&
                                        verified.id === value.id &&
                                        verified.service === value.service &&
                                        (!known ||
                                            rankMirrorAddress(rinfo.address) <
                                                rankMirrorAddress(
                                                    known.host ?? '',
                                                ))
                                    )
                                        found.set(value.id, {
                                            ...verified,
                                            host: rinfo.address,
                                        });
                                } catch {}
                            });
                        },
                    );
                    request.on('timeout', () => request.destroy());
                    request.on('error', () => {});
                    requests.add(request);
                    request.on('close', () => requests.delete(request));
                } catch {}
            });
            socket.bind(0, () => {
                socket.setBroadcast(true);
                const broadcasts = new Set([
                    '127.0.0.1',
                    ...localAddresses().map((nic) => {
                        const ip = nic.address.split('.').map(Number);
                        const mask = nic.netmask.split('.').map(Number);
                        return ip
                            .map((octet, i) => octet | (255 ^ mask[i]))
                            .join('.');
                    }),
                ]);
                for (const address of broadcasts)
                    for (
                        let port = MIRROR_PORT_FIRST;
                        port <= MIRROR_PORT_LAST;
                        port++
                    )
                        socket.send(
                            'owa-screen-mirror-discover-v1',
                            port,
                            address,
                            () => {},
                        );
            });
        });
    }
    // Camera routing is centralized at the host. Only an approved participant
    // can create a route, and subsequent signaling is confined to that pair.
    private routeCamera(from: string, packet: Record<string, any>) {
        const requestId = packet.requestId;
        if (typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(requestId))
            return;
        if (packet.type === 'camera-request') {
            if (
                this.cameraRoutes.size >= 128 ||
                this.cameraRoutes.has(requestId)
            )
                return;
            const match = /^mirror-camera:([a-f0-9-]{36}):(.+)$/.exec(
                packet.deviceId ?? '',
            );
            if (!match) return;
            const source = match[1] === this.id ? 'broker' : match[1];
            if (source !== 'broker' && !this.peers.get(source)?.approved)
                return;
            this.cameraRoutes.set(requestId, { consumer: from, source });
            this.deliverCamera(source, { ...packet, deviceId: match[2] });
        } else {
            const route = this.cameraRoutes.get(requestId);
            if (!route) return;
            if (from !== route.consumer && from !== route.source) return;
            this.deliverCamera(
                from === route.consumer ? route.source : route.consumer,
                packet,
            );
            if (packet.type === 'camera-close')
                this.cameraRoutes.delete(requestId);
        }
    }
    private deliverCamera(to: string, packet: Record<string, any>) {
        if (to === 'broker') this.sendBroker(packet);
        else if (to.startsWith('renderer:')) {
            const contents = BrowserWindow.getAllWindows().find(
                (win) => win.webContents.id === Number(to.slice(9)),
            )?.webContents;
            contents?.send('mirror:camera', packet);
        } else {
            const peer = this.peers.get(to);
            if (peer?.approved) socketSend(peer.socket, packet.type, packet);
        }
    }
    private guestConsumers = new Map<string, number>();
    private deliverGuestCamera(packet: Record<string, any>) {
        if (packet.type === 'camera-request') this.sendBroker(packet);
        else {
            const id = this.guestConsumers.get(packet.requestId);
            if (id !== undefined)
                BrowserWindow.getAllWindows()
                    .find((win) => win.webContents.id === id)
                    ?.webContents.send('mirror:camera', packet);
            else this.broker?.webContents.send('mirror:camera', packet);
            if (packet.type === 'camera-close')
                this.guestConsumers.delete(packet.requestId);
        }
    }
    private closeCameraRoutes(participant: string) {
        for (const [requestId, route] of this.cameraRoutes) {
            if (
                route.consumer === participant ||
                route.source === participant
            ) {
                this.deliverCamera(route.consumer, {
                    type: 'camera-close',
                    requestId,
                });
                this.deliverCamera(route.source, {
                    type: 'camera-close',
                    requestId,
                });
                this.cameraRoutes.delete(requestId);
            }
        }
        if (participant === 'upstream') {
            for (const [requestId, contentsId] of this.guestConsumers)
                BrowserWindow.getAllWindows()
                    .find((win) => win.webContents.id === contentsId)
                    ?.webContents.send('mirror:camera', {
                        type: 'camera-close',
                        requestId,
                    });
            this.guestConsumers.clear();
            this.broker?.webContents.send('mirror:camera-reset');
            this.brokerRequests.clear();
            this.scheduleBrokerRelease();
        }
    }
    private ensureBroker() {
        if (!this.broker || this.broker.isDestroyed()) {
            this.broker = new BrowserWindow({
                show: false,
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false,
                    preload: path.join(
                        __dirname,
                        'client',
                        'preloadProvider.js',
                    ),
                },
            });
            this.broker.webContents.setWindowOpenHandler(() => ({
                action: 'deny',
            }));
            this.broker.loadURL(`${getRootUrl()}/camera-broker.html`);
        }
        return this.broker;
    }
    private sendBroker(packet: Record<string, any>) {
        if (packet.type === 'camera-close') {
            this.brokerRequests.delete(packet.requestId);
            if (!this.brokerRequests.size) this.scheduleBrokerRelease();
            this.broker?.webContents.send('mirror:camera', packet);
            return;
        }
        if (packet.type === 'camera-request') {
            clearTimeout(this.brokerIdleTimer);
            this.brokerRequests.add(packet.requestId);
        }
        const broker = this.ensureBroker();
        if (broker.webContents.isLoading())
            broker.webContents.once('did-finish-load', () =>
                broker.webContents.send('mirror:camera', packet),
            );
        else broker.webContents.send('mirror:camera', packet);
    }
    private scheduleBrokerRelease() {
        clearTimeout(this.brokerIdleTimer);
        this.brokerIdleTimer = setTimeout(() => {
            if (!this.brokerRequests.size) {
                this.broker?.destroy();
                this.broker = undefined;
            }
        }, 5000);
    }
    private initIpc() {
        ipcMain.on('mirror:state', (event) => {
            if (this.trusted(event.sender)) event.returnValue = this.state();
            else event.returnValue = null;
        });
        ipcMain.on('mirror:screen-context', (event, id: number) => {
            event.returnValue = this.trusted(event.sender)
                ? (screenMirrorRuntime.context?.(id) ?? null)
                : null;
        });
        ipcMain.on('mirror:resource', (event, data) => {
            event.returnValue =
                this.trusted(event.sender) && typeof data?.filePath === 'string'
                    ? this.resource(data.screenId, data.filePath)
                    : '';
        });
        ipcMain.on('mirror:cameras', (event) => {
            event.returnValue = this.trusted(event.sender)
                ? this.cameras()
                : [];
        });
        ipcMain.on('mirror:physical-cameras', (event, cameras) => {
            if (this.trusted(event.sender)) {
                const inventory = readMirrorCameras(cameras);
                if (
                    JSON.stringify(inventory) !==
                    JSON.stringify(this.physicalCameras)
                ) {
                    this.physicalCameras = inventory;
                    this.sendInventory();
                }
            }
        });
        ipcMain.on(
            'mirror:bootstrap',
            (event, data: Bootstrap & { requestId: string }) => {
                if (event.sender !== this.main) return;
                const pending = this.bootstraps.get(data.requestId);
                if (!pending) return;
                clearTimeout(pending.timer);
                this.bootstraps.delete(data.requestId);
                pending.resolve(data);
            },
        );
        ipcMain.on('mirror:command', (event, data) => {
            if (!this.trusted(event.sender)) return;
            const reply = (value: any) => {
                if (
                    typeof data.replyEventName === 'string' &&
                    !event.sender.isDestroyed()
                )
                    event.sender.send(data.replyEventName, value);
            };
            void (async () => {
                if (data.action === 'scan') return await this.rescan();
                if (data.action === 'connect')
                    await this.connect({
                        host: data.host,
                        port: data.port,
                        code: typeof data.code === 'string' ? data.code : '',
                    });
                else if (data.action === 'disconnect') this.disconnect();
                else if (data.action === 'host')
                    await this.setHostEnabled(data.enabled === true);
                else if (data.action === 'approve') this.approve(data.id);
                else if (
                    data.action === 'reject' ||
                    data.action === 'disconnect-guest'
                ) {
                    this.resumptions.delete(data.id);
                    const peer = this.peers.get(data.id);
                    if (peer) {
                        socketSend(peer.socket, 'error', {
                            error: 'Disconnected by host',
                        });
                        peer.socket.close();
                    }
                } else if (data.action === 'settings') {
                    this.settings.setClientSetting(
                        `${KEY}mode`,
                        data.mode === 'code' ? 'code' : 'approve',
                    );
                    if (typeof data.code === 'string' && data.code.trim())
                        this.settings.setSecureSetting(
                            `${KEY}code`,
                            data.code.trim(),
                        );
                    if (
                        data.port === null ||
                        (Number.isInteger(data.port) &&
                            data.port > 0 &&
                            data.port <= 65535)
                    )
                        this.settings.setClientSetting(
                            `${KEY}port`,
                            data.port === null ? '' : String(data.port),
                        );
                    this.notify();
                }
                return this.state();
            })().then(reply, (error) => reply(error));
        });
        ipcMain.on('mirror:camera-send', (event, packet) => {
            if (
                !this.trusted(event.sender) ||
                !packet ||
                !['camera-request', 'camera-signal', 'camera-close'].includes(
                    packet.type,
                )
            )
                return;
            if (
                packet.type === 'camera-request' &&
                event.sender !== this.broker?.webContents &&
                !this.cameraRenderers.has(event.sender.id)
            ) {
                const id = event.sender.id;
                this.cameraRenderers.add(id);
                event.sender.once('destroyed', () => {
                    this.cameraRenderers.delete(id);
                    this.closeCameraRoutes(`renderer:${id}`);
                    for (const [requestId, contentsId] of this.guestConsumers)
                        if (contentsId === id) {
                            if (this.upstream)
                                socketSend(this.upstream, 'camera-close', {
                                    requestId,
                                });
                            this.guestConsumers.delete(requestId);
                        }
                });
            }
            if (
                event.sender === this.broker?.webContents &&
                packet.type === 'camera-close'
            ) {
                this.brokerRequests.delete(packet.requestId);
                if (!this.brokerRequests.size) this.scheduleBrokerRelease();
            }
            if (this.upstream && this.connection.status === 'connected') {
                if (packet.type === 'camera-request')
                    this.guestConsumers.set(packet.requestId, event.sender.id);
                socketSend(this.upstream, packet.type, packet);
                if (packet.type === 'camera-close')
                    this.guestConsumers.delete(packet.requestId);
            } else
                this.routeCamera(
                    event.sender === this.broker?.webContents
                        ? 'broker'
                        : `renderer:${event.sender.id}`,
                    packet,
                );
        });
    }
}

let service: ScreenMirrorService | undefined;
export function getScreenMirror() {
    return service;
}
export async function initScreenMirror() {
    service = new ScreenMirrorService();
    await service.start();
}
