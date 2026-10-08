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
import { getScreenOutput } from './screenOutputRegistry';
import { checkNetworkFirewall, openFirewallSettings } from './firewallHelpers';
import {
    VIRTUAL_DISPLAY_SHARE_KEY,
    checkIsVirtualDisplayDevViewerFile,
    isVirtualDisplayId,
    type VirtualDisplayNetwork,
} from './virtualDisplayProtocol';
import {
    MirrorContentRegistry,
    isContainedPath,
    serveMirrorFile,
} from './screenMirrorContent';
import { screenMirrorRuntime } from './screenMirrorRuntime';
import { getRootUrl } from './protocolHelpers';
import { isDev, messageChannels } from './electronHelpers';
import { genKeepAwake } from './keepAwakeHelpers';
import {
    MIRROR_MAX_MESSAGE,
    MIRROR_PORT_FIRST,
    MIRROR_PORT_LAST,
    MIRROR_PROTOCOL,
    MIRROR_REMOTE_DISPLAY_FIRST,
    MIRROR_FEEDBACK_TYPES,
    isMirrorScreenMessage,
    readMirrorPacket,
    readMirrorDiscovery,
    readMirrorDisplays,
    readMirrorCameras,
    rankMirrorAddress,
    sortMirrorHosts,
    isMirrorLanAddress,
    isMirrorGlobalIpv6,
    readMirrorAddressText,
    readMirrorIpv4,
    readMirrorOrigin,
    toMirrorHostPort,
    toMirrorPlainAddress,
    toMirrorSenderKey,
    type MirrorAddress,
    type MirrorConnection,
    type MirrorDiscovery,
    type MirrorDisplay,
    type MirrorCamera,
    type MirrorGuest,
    type MirrorNetwork,
    type MirrorRouterStatus,
    type MirrorState,
    type MirrorScreenContext,
    type MirrorScreenMessage,
} from './screenMirrorProtocol';
import {
    closeRouterPort,
    findRouterGateway,
    getRouterExternalAddress,
    openRouterPort,
    readRouterMapping,
    renewRouterPort,
    type RouterMapping,
} from './screenMirrorRouter';

type Peer = {
    socket: WebSocket;
    guest: MirrorGuest;
    approved: boolean;
    alive: boolean;
    localAddress: string;
    // Where the guest reached this host (its `Host` header): the base its
    // files are published on, which on the internet is the router's side.
    origin: string | null;
};
type Output = {
    displayId: number;
    guestId?: string;
    scope: string;
    context: MirrorScreenContext;
};
// This computer as a guest: one link per host it is connected to.
type Link = {
    connection: MirrorConnection;
    options: {
        host: string;
        port: number;
        code: string;
        resume?: string;
    };
    socket?: WebSocket;
    heartbeat?: ReturnType<typeof setInterval>;
    reconnectTimer?: ReturnType<typeof setTimeout>;
    attempt: number;
    cameras: MirrorCamera[];
};
// A host's screen on one of this computer's monitors. It keeps the host's
// screen id -- its settings are keyed by it -- so two hosts can both show
// their screen 0 here; the window itself tells them apart.
type Incoming = {
    linkId: string;
    screenId: number;
    contentsId: number;
    controller: ElectronScreenController;
    context: MirrorScreenContext;
};
type Bootstrap = MirrorScreenContext & { messages: MirrorScreenMessage[] };
// What the Virtual Displays service plugs into this server: its stream route,
// and a word whenever who may reach the server changed.
export type VirtualDisplayHooks = {
    route: (
        req: http.IncomingMessage,
        res: http.ServerResponse,
        url: URL,
        network: VirtualDisplayNetwork,
    ) => Promise<void> | void;
    upgrade: (
        req: http.IncomingMessage,
        socket: Duplex,
        head: Buffer,
        network: VirtualDisplayNetwork,
    ) => void;
    // Whether a viewer on that network may load files at all: its published
    // pictures and fonts, and (packaged) the app's own page code.
    admits: (network: VirtualDisplayNetwork) => boolean;
    onNetworkChanged: () => void;
};
// The app's own files a browser viewer of a virtual display loads: its two
// pages and the built code they import. Nothing else of the app is served
// off this computer.
function checkIsVirtualDisplayAppFile(pathname: string) {
    return (
        pathname === '/virtual-display-viewer.html' ||
        pathname === '/vd-screen.html' ||
        /^\/(?:assets|js)\/[\w.\-]+\.(?:js|css|woff2?|ttf|svg|png|gif|jpe?g|webp|wasm)$/.test(
            pathname,
        )
    );
}
// Vite's client, as a development build's virtual-display viewer on another
// device is given it: the same exports (every module imports them), styles
// applied, and no hot reload. The real one dials the dev server's socket,
// which this server never opens to the network (it reads and transforms files
// on request), fails, falls back to `localhost:3000` on the viewer's own
// device, and keeps retrying -- a console full of errors and a ping a second.
const DEV_VIEWER_VITE_CLIENT = `import '/@vite/env';
const sheets = new Map();
export function updateStyle(id, content) {
    let style = sheets.get(id);
    if (!style) {
        style = document.createElement('style');
        style.setAttribute('type', 'text/css');
        style.setAttribute('data-vite-dev-id', id);
        document.head.appendChild(style);
        sheets.set(id, style);
    }
    style.textContent = content;
}
export function removeStyle(id) {
    sheets.get(id)?.remove();
    sheets.delete(id);
}
export function injectQuery(url, queryToInject) {
    if (url[0] !== '.' && url[0] !== '/') return url;
    const pathname = url.replace(/[?#].*$/, '');
    const { search, hash } = new URL(url, 'http://vite.dev');
    return pathname + '?' + queryToInject + (search ? '&' + search.slice(1) : '') + (hash || '');
}
const noop = () => {};
export function createHotContext() {
    return { data: {}, accept: noop, acceptExports: noop, dispose: noop, prune: noop, decline: noop, invalidate: noop, on: noop, off: noop, send: noop };
}
export class ErrorOverlay extends HTMLElement {}
`;
const LOOPBACK_ADDRESSES = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
const KEY = 'screen-mirror-';
const HOST_CAMERA = 'mirror-camera:';
const MAX_LINKS = 8;
// A stranger on the internet must not crowd out the room: requests from the
// internet waiting for approval are capped, in all and per sender (one public
// address can be a whole site behind its router). The room's own are not.
const MAX_PENDING = 8;
const MAX_PEER_CONNECTIONS = 32;
const MAX_PENDING_PER_SENDER = 4;
// Five wrong codes from one sender locks it out until ten minutes after the
// first.
const MAX_WRONG_CODES = 5;
const WRONG_CODE_WINDOW = 10 * 60 * 1000;

function localAddresses() {
    return Object.values(os.networkInterfaces())
        .flatMap((list) => list ?? [])
        .filter((nic) => !nic.internal && nic.family === 'IPv4');
}
function globalIpv6Addresses() {
    return [
        ...new Set(
            Object.values(os.networkInterfaces())
                .flatMap((list) => list ?? [])
                .filter((nic) => {
                    return (
                        !nic.internal &&
                        nic.family === 'IPv6' &&
                        isMirrorGlobalIpv6(nic.address)
                    );
                })
                .map((nic) => nic.address),
        ),
    ].slice(0, 4);
}
// On one of this computer's own networks: a private address, or one on the
// same subnet as a network card (a LAN handed public addresses), or in the
// same IPv6 /64 as one.
function checkIsLocalSender(address: string) {
    if (isMirrorLanAddress(address)) return true;
    const remote = readMirrorIpv4(address);
    const nics = Object.values(os.networkInterfaces()).flatMap((list) => {
        return list ?? [];
    });
    if (remote) {
        return nics.some((nic) => {
            if (nic.internal || nic.family !== 'IPv4') return false;
            const ip = nic.address.split('.').map(Number);
            const mask = nic.netmask.split('.').map(Number);
            return ip.every((octet, i) => {
                return (octet & mask[i]) === (remote[i] & mask[i]);
            });
        });
    }
    const key = toMirrorSenderKey(address);
    return nics.some((nic) => {
        return (
            !nic.internal &&
            nic.family === 'IPv6' &&
            toMirrorSenderKey(nic.address) === key
        );
    });
}
// An address as a QR code: the plain `host:port` a guest types, never a link,
// so a phone that scans it offers the text to copy instead of a page to open.
// The encoder loads the first time a code is asked for.
async function toQrCode(text: unknown) {
    if (typeof text !== 'string' || !text || text.length > 300)
        throw new Error('Invalid host or port');
    const { svgObject } = await import('qr-image');
    return svgObject(text, { ec_level: 'M', margin: 2 });
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
    private peers = new Map<string, Peer>();
    // Includes handshakes and closing sockets, before/after a peer has an id.
    private peerSockets = new Set<Duplex>();
    private outputs = new Map<number, Output>();
    // A screen presented through Screen Mirror is showing in the Presenter's
    // Mini Screen like any other, but a guest's display has no screen window
    // on this computer to keep it awake (`ElectronScreenController`), and the
    // operator's machine sleeping mid-service cuts the guest's output off.
    // Held while any output is up, synced wherever `outputs` changes.
    private setIsAwake = genKeepAwake();
    private links = new Map<string, Link>();
    private incoming = new Map<string, Incoming>();
    private main?: WebContents;
    private wrongCodes = new Map<string, { count: number; since: number }>();
    private routerStatus: MirrorRouterStatus = 'off';
    private routerMapping?: RouterMapping;
    private routerRun = 0;
    private routerRenewTimer?: ReturnType<typeof setTimeout>;
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
    private virtualDisplayHooks?: VirtualDisplayHooks;
    private serverSockets = new WeakMap<http.Server, Set<Duplex>>();
    // Whether the server is listening on every network (`::`) rather than
    // loopback alone, as it was last bound.
    private isBoundToAll = false;

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
    // Off until the operator turns it on, and only in effect while hosting
    // is: until then a guest from outside this computer's own networks is
    // refused, the router is not asked to open anything, and the server
    // answers IPv6 on the local networks only.
    get isInternetEnabled() {
        return this.settings.getClientSetting(`${KEY}internet`) === 'true';
    }
    get isInternetOpen() {
        return this.isHostEnabled && this.isInternetEnabled;
    }
    // Virtual Displays' own "Let other devices watch": it opens the server to
    // the network for its streams alone, never for Screen Mirror guests.
    get isVirtualDisplayShareEnabled() {
        return (
            this.settings.getClientSetting(VIRTUAL_DISPLAY_SHARE_KEY) === 'true'
        );
    }
    get shouldBindToAll() {
        return this.isHostEnabled || this.isVirtualDisplayShareEnabled;
    }
    // The router is asked to forward the port while the internet option is on
    // and something here is open to the network at all.
    get isRouterWanted() {
        return this.isInternetEnabled && this.shouldBindToAll;
    }
    get routerState() {
        return this.routerStatus;
    }
    setVirtualDisplayHooks(hooks: VirtualDisplayHooks) {
        this.virtualDisplayHooks = hooks;
    }
    get publicAddress() {
        return this.settings.getClientSetting(`${KEY}public-address`) ?? '';
    }
    get customPort() {
        const port = Number(this.settings.getClientSetting(`${KEY}port`));
        return Number.isInteger(port) && port > 0 && port <= 65535
            ? port
            : null;
    }
    private admits(address: string) {
        return this.isInternetOpen || checkIsLocalSender(address);
    }
    // What a guest can type to reach this host, best first: this computer's
    // network cards, then -- with the internet open -- the router's public
    // side, global IPv6 cards and the address the operator typed.
    addressList(isIncludingInternet: boolean): MirrorAddress[] {
        const port = this.port;
        const list: MirrorAddress[] = localAddresses()
            .map((nic) => ({ host: nic.address, port, kind: 'lan' as const }))
            .sort(
                (a, b) => rankMirrorAddress(a.host) - rankMirrorAddress(b.host),
            );
        if (!isIncludingInternet) return list;
        if (this.routerMapping)
            list.push({
                host: this.routerMapping.externalAddress,
                port: this.routerMapping.externalPort,
                kind: 'router',
            });
        for (const host of globalIpv6Addresses())
            list.push({ host, port, kind: 'internet' });
        const typed = readMirrorAddressText(this.publicAddress);
        if (typed)
            list.push({
                host: typed.host,
                port: typed.port ?? this.routerMapping?.externalPort ?? port,
                kind: 'typed',
            });
        return list;
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
            internetEnabled: this.isInternetEnabled,
            displayRevision: this.displayRevision,
            addresses: this.addressList(this.isInternetOpen),
            publicAddress: this.publicAddress,
            router: this.routerStatus,
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
                    network: guest.network,
                })),
            connections: [...this.links.values()].map((link) => ({
                ...link.connection,
            })),
        };
    }
    trusted(contents: WebContents) {
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
    broadcast(channel: string, payload: unknown) {
        for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed() && this.trusted(win.webContents))
                win.webContents.send(channel, payload);
        }
    }
    private notify() {
        this.broadcast('mirror:state', this.state());
        this.main?.send('mirror:devices-changed');
        if (!this.links.size) this.sendInventory();
        this.virtualDisplayHooks?.onNetworkChanged();
    }
    // Tells the main window its list of displays changed, without a whole
    // mirror state round.
    sendDevicesChanged() {
        this.main?.send('mirror:devices-changed');
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
            this.outputs.get(screenId)?.context;
        if (this.isRouterWanted) void this.openRouter();
        else this.releaseRouter();
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
        // Every socket, upgraded ones included: `closeAllConnections` ends
        // only HTTP requests, and `close` waits for the rest -- a virtual
        // display's viewers, a dev screen's HMR socket -- for ever.
        const sockets = new Set<Duplex>();
        server.on('connection', (socket) => {
            sockets.add(socket);
            socket.once('close', () => sockets.delete(socket));
        });
        this.serverSockets.set(server, sockets);
        server.on('upgrade', (req, socket, head) =>
            this.handleUpgrade(req, socket, head),
        );
        return server;
    }
    // Loopback while hosting is off, every network while it is on -- IPv4 and
    // IPv6 both, or IPv4 alone on a computer without IPv6. Who may come in is
    // `admits`'s call, not the bind's, so opening to the internet needs no
    // rebind and drops no guest. A rebind asks for the port it had first, so
    // windows already loaded from it keep their origin.
    private async listen(preferredPort?: number) {
        const server = this.createServer();
        this.isBoundToAll = this.shouldBindToAll;
        let host = this.isBoundToAll ? '::' : '127.0.0.1';
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
        for (let index = 0; index < ports.length;) {
            const port = ports[index];
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
                    host === '::' &&
                    ['EAFNOSUPPORT', 'EADDRNOTAVAIL', 'EINVAL'].includes(
                        error.code,
                    )
                ) {
                    host = '0.0.0.0';
                    continue;
                }
                if (
                    this.customPort ||
                    !['EADDRINUSE', 'EACCES'].includes(error.code)
                ) {
                    this.error = 'Unable to start screen mirror server';
                    return false;
                }
                index++;
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
        const address = req.socket.remoteAddress ?? '';
        if (req.url?.startsWith('/vd/') && this.virtualDisplayHooks) {
            this.virtualDisplayHooks.upgrade(
                req,
                socket,
                head,
                local
                    ? 'this-computer'
                    : checkIsLocalSender(address)
                      ? 'local'
                      : 'internet',
            );
            return;
        }
        // Browser pages must not initiate guest connections. Installed clients
        // connect from main, which sends no Origin header.
        if (
            !this.isHostEnabled ||
            req.url !== '/mirror' ||
            req.headers.origin ||
            this.peerSockets.size >= MAX_PEER_CONNECTIONS ||
            this.peers.size >= MAX_PEER_CONNECTIONS ||
            !this.admits(address)
        ) {
            socket.destroy();
            return;
        }
        this.peerSockets.add(socket);
        socket.once('close', () => this.peerSockets.delete(socket));
        try {
            this.wss!.handleUpgrade(req, socket, head, (ws) =>
                this.acceptSocket(
                    ws,
                    address,
                    readMirrorOrigin(req.headers.host),
                ),
            );
        } catch {
            socket.destroy();
        }
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
                this.admits(rinfo.address) &&
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
            this.releaseRouter();
            for (const [id, peer] of this.peers) {
                this.resumptions.delete(id);
                socketSend(peer.socket, 'error', {
                    error: 'Disconnected by host',
                });
                peer.socket.close();
            }
        }
        const isListening =
            this.shouldBindToAll === this.isBoundToAll
                ? !!this.server
                : await this.rebind();
        if (isListening && isEnabled) this.openDiscovery();
        this.syncRouter();
        this.notify();
    }
    // Listens again on the same port, on loopback or on every network.
    private async rebind() {
        const previous = this.server;
        if (previous) {
            await new Promise<void>((resolve) => {
                previous.close(() => resolve());
                previous.closeAllConnections();
                // A browser watching a virtual display reconnects by itself.
                for (const socket of this.serverSockets.get(previous) ?? []) {
                    socket.destroy();
                }
            });
            this.serverSockets.delete(previous);
        }
        return await this.listen(this.port);
    }
    private syncRouter() {
        if (this.isRouterWanted) {
            if (this.routerStatus === 'off') void this.openRouter();
        } else if (this.routerStatus !== 'off') {
            this.releaseRouter();
        }
    }
    // Virtual Displays' "Let other devices watch". Rebinds only when that
    // changes what the server listens on; Screen Mirror's guests stay.
    async setVirtualDisplayShareEnabled(isEnabled: boolean) {
        if (isEnabled === this.isVirtualDisplayShareEnabled) return;
        this.settings.setClientSetting(
            VIRTUAL_DISPLAY_SHARE_KEY,
            isEnabled ? 'true' : '',
        );
        if (this.shouldBindToAll !== this.isBoundToAll) await this.rebind();
        this.syncRouter();
        this.notify();
    }
    // Closing it ends every guest that came from outside this computer's own
    // networks; the ones in the room stay.
    async setInternetEnabled(isEnabled: boolean) {
        if (isEnabled === this.isInternetEnabled) return;
        this.settings.setClientSetting(
            `${KEY}internet`,
            isEnabled ? 'true' : '',
        );
        if (isEnabled) {
            if (this.isRouterWanted) void this.openRouter();
        } else {
            this.releaseRouter();
            for (const [id, peer] of this.peers) {
                if (peer.guest.network === 'local') continue;
                this.resumptions.delete(id);
                socketSend(peer.socket, 'error', {
                    error: 'Disconnected by host',
                });
                peer.socket.close();
            }
        }
        this.notify();
    }
    setPublicAddress(text: string) {
        const value = text.trim();
        if (value && !readMirrorAddressText(value))
            throw new Error('Invalid host or port');
        this.settings.setClientSetting(`${KEY}public-address`, value);
    }
    // Asks the router to forward this port. Every answer is checked against
    // `run`, so turning the option off -- or asking again -- while the router
    // is still answering leaves no mapping behind.
    async openRouter() {
        const run = ++this.routerRun;
        clearTimeout(this.routerRenewTimer);
        const stale = this.routerMapping;
        this.routerMapping = undefined;
        this.routerStatus = 'working';
        this.notify();
        const previous = readRouterMapping(
            this.settings.getClientSetting(`${KEY}router-mapping`),
        );
        let status: MirrorRouterStatus = 'unavailable';
        try {
            const gateway = await findRouterGateway();
            if (run !== this.routerRun) return;
            const external = gateway
                ? await getRouterExternalAddress(gateway)
                : '';
            if (run !== this.routerRun) return;
            if (gateway && external && isMirrorLanAddress(external)) {
                status = 'shared';
            } else if (gateway && external) {
                const mapping = await openRouterPort(
                    gateway,
                    this.port,
                    external,
                    stale?.externalPort ?? previous?.externalPort,
                );
                if (run !== this.routerRun) {
                    void closeRouterPort(mapping).catch(() => {});
                    return;
                }
                this.routerMapping = mapping;
                this.settings.setClientSetting(
                    `${KEY}router-mapping`,
                    JSON.stringify({
                        controlUrl: mapping.controlUrl,
                        serviceType: mapping.serviceType,
                        externalPort: mapping.externalPort,
                    }),
                );
                this.scheduleRouterRenew(run);
                status = 'open';
            }
        } catch {
            status = 'refused';
        }
        if (run !== this.routerRun) return;
        this.routerStatus = status;
        this.notify();
    }
    private scheduleRouterRenew(run: number) {
        const mapping = this.routerMapping;
        if (!mapping?.leaseSeconds) return;
        this.routerRenewTimer = setTimeout(() => {
            if (run !== this.routerRun) return;
            renewRouterPort(mapping).then(
                () => this.scheduleRouterRenew(run),
                () => void this.openRouter(),
            );
        }, mapping.leaseSeconds * 500);
    }
    // Removes this computer's port mapping, or the one an earlier run left
    // when it could not (a crash, or quitting before the router answered).
    private releaseRouter() {
        this.routerRun++;
        clearTimeout(this.routerRenewTimer);
        const mapping =
            this.routerMapping ??
            readRouterMapping(
                this.settings.getClientSetting(`${KEY}router-mapping`),
            );
        this.routerMapping = undefined;
        this.routerStatus = 'off';
        if (!mapping) return;
        this.settings.setClientSetting(`${KEY}router-mapping`, '');
        void closeRouterPort(mapping).catch(() => {});
    }
    stop() {
        clearInterval(this.heartbeat);
        clearTimeout(this.brokerIdleTimer);
        this.scan?.close();
        // Quitting does not wait for the router: an unanswered removal lapses
        // with the lease, and the next launch removes it.
        if (this.routerMapping) {
            this.routerRun++;
            clearTimeout(this.routerRenewTimer);
            void closeRouterPort(this.routerMapping).catch(() => {});
        }
        for (const link of this.links.values()) this.closeLink(link);
        for (const peer of this.peers.values()) peer.socket.terminate();
        for (const client of this.wss?.clients ?? []) client.terminate();
        for (const socket of this.peerSockets) socket.destroy();
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
            const remoteAddress = req.socket.remoteAddress ?? '';
            const isLoopback = LOOPBACK_ADDRESSES.includes(remoteAddress);
            const url = new URL(req.url ?? '/', this.baseUrl);
            // A virtual display's stream decides for itself who may watch:
            // its own switch, not Screen Mirror's hosting.
            const network: VirtualDisplayNetwork = isLoopback
                ? 'this-computer'
                : checkIsLocalSender(remoteAddress)
                  ? 'local'
                  : 'internet';
            if (url.pathname.startsWith('/vd/') && this.virtualDisplayHooks) {
                await this.virtualDisplayHooks.route(req, res, url, network);
                return;
            }
            // A browser watching a virtual display loads published files, a
            // tab icon and the viewer's own code -- under that display's
            // switches, not Screen Mirror's hosting. A packaged app serves its
            // built code; a development build passes through from Vite only
            // the modules the viewer's pages import.
            const isViewerIcon =
                url.pathname === '/favicon.ico' ||
                url.pathname === '/logo192.png';
            const isViewerAdmitted =
                !isLoopback &&
                !!this.virtualDisplayHooks?.admits(network) &&
                (url.pathname.startsWith('/content/') ||
                    isViewerIcon ||
                    (isDev
                        ? checkIsVirtualDisplayDevViewerFile(
                              url,
                              app.getAppPath(),
                          )
                        : checkIsVirtualDisplayAppFile(url.pathname)));
            if (isViewerAdmitted) {
                if (url.pathname.startsWith('/content/')) {
                    await this.content.serve(req, res, url.pathname);
                } else if (isViewerIcon) {
                    // The app's 6 KB logo, also for the `/favicon.ico` a
                    // browser asks for by itself: the real .ico is 370 KB,
                    // for every phone that opens the page.
                    await serveMirrorFile(
                        req,
                        res,
                        path.join(
                            app.getAppPath(),
                            isDev ? 'public' : 'dist',
                            'logo192.png',
                        ),
                    );
                } else if (isDev && url.pathname === '/@vite/client') {
                    res.writeHead(200, {
                        'Content-Type': 'text/javascript; charset=utf-8',
                        'Cache-Control': 'no-store',
                    });
                    res.end(DEV_VIEWER_VITE_CLIENT);
                } else {
                    await this.serveAppFile(req, res, url);
                }
                return;
            }
            // Listening on every network for the streams alone opens nothing
            // else of Screen Mirror to anyone.
            if (
                (!isLoopback && !this.isHostEnabled) ||
                !this.admits(remoteAddress)
            ) {
                res.writeHead(404).end();
                return;
            }
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
            if (!isLoopback) {
                res.writeHead(404).end();
                return;
            }
            await this.serveAppFile(req, res, url);
        } catch {
            if (!res.headersSent) res.writeHead(404);
            res.end();
        }
    }
    // One of the app's own built files (dev: through Vite -- for this
    // computer, and for a virtual display's viewers on this network only the
    // modules `checkIsVirtualDisplayDevViewerFile` lets through).
    async serveAppFile(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        url: URL,
    ) {
        try {
            if (isDev) {
                // Loopback, or a viewer's allowlisted module (see above).
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
    private checkIsLockedOut(sender: string) {
        const entry = this.wrongCodes.get(sender);
        if (!entry) return false;
        if (Date.now() - entry.since > WRONG_CODE_WINDOW) {
            this.wrongCodes.delete(sender);
            return false;
        }
        return entry.count >= MAX_WRONG_CODES;
    }
    private countWrongCode(sender: string) {
        const now = Date.now();
        let entry = this.wrongCodes.get(sender);
        if (!entry || now - entry.since > WRONG_CODE_WINDOW) {
            if (this.wrongCodes.size >= 256)
                for (const [key, value] of this.wrongCodes)
                    if (now - value.since > WRONG_CODE_WINDOW)
                        this.wrongCodes.delete(key);
            if (this.wrongCodes.size >= 256)
                this.wrongCodes.delete(this.wrongCodes.keys().next().value!);
            entry = { count: 0, since: now };
            this.wrongCodes.set(sender, entry);
        }
        entry.count++;
    }
    private acceptSocket(
        socket: WebSocket,
        remoteAddress: string,
        origin: string | null,
    ) {
        const address = toMirrorPlainAddress(remoteAddress);
        const sender = toMirrorSenderKey(address);
        const network: MirrorNetwork = checkIsLocalSender(address)
            ? 'local'
            : 'internet';
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
            if (socket.readyState !== WebSocket.OPEN) return;
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
                    this.links.size ||
                    this.peers.has(packet.id) ||
                    this.peers.size >= MAX_PEER_CONNECTIONS
                ) {
                    socketSend(socket, 'error', {
                        error: 'Incompatible or duplicate connection',
                    });
                    socket.close(1008);
                    return;
                }
                if (this.checkIsLockedOut(sender)) {
                    socketSend(socket, 'error', {
                        error: 'Too many wrong codes. Try again later.',
                    });
                    socket.close(1008);
                    return;
                }
                clearTimeout(helloTimeout);
                peer = {
                    socket,
                    approved: false,
                    alive: true,
                    localAddress: toMirrorPlainAddress(
                        (socket as any)._socket.localAddress ?? '',
                    ),
                    origin,
                    guest: {
                        id: packet.id,
                        name: packet.name,
                        prefix: '',
                        address,
                        network,
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
                    this.countWrongCode(sender);
                    socketSend(socket, 'error', {
                        error: 'Connection code is incorrect',
                    });
                    socket.close(1008);
                } else {
                    const waiting = [...this.peers.values()].filter((item) => {
                        return (
                            !item.approved &&
                            item !== peer &&
                            item.guest.network === 'internet'
                        );
                    });
                    if (
                        network === 'internet' &&
                        (waiting.length >= MAX_PENDING ||
                            waiting.filter((item) => {
                                return (
                                    toMirrorSenderKey(item.guest.address) ===
                                    sender
                                );
                            }).length >= MAX_PENDING_PER_SENDER)
                    ) {
                        socketSend(socket, 'error', {
                            error: 'Too many connection requests. Try again later.',
                        });
                        socket.close(1008);
                        return;
                    }
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
                    (display) => this.guestDisplay(peer!.guest.id, display),
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
    private guestDisplay(
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
        if (this.links.size)
            return [...this.links.values()].flatMap((link) => {
                return link.connection.status === 'connected'
                    ? link.cameras
                    : [];
            });
        return [...this.peers.values()]
            .filter((peer) => peer.approved)
            .flatMap((peer) => peer.guest.cameras);
    }
    showingIds() {
        return [...this.outputs.keys()];
    }
    isRemoteOutput(screenId: number) {
        return !!this.outputs.get(screenId)?.guestId;
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
            isSoundOwner: isVirtualDisplayId(displayId),
        };
        const output: Output = {
            displayId,
            guestId: display?.guestId,
            scope: this.content.createScope(),
            context,
        };
        this.outputs.set(screenId, output);
        this.setIsAwake(true);
        try {
            const data = await this.bootstrap(screenId);
            if (this.outputs.get(screenId) !== output)
                throw new Error('Screen initialization cancelled');
            output.context = {
                ...data,
                resources: {},
                remote: !!display,
                isSoundOwner: isVirtualDisplayId(displayId),
            };
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
        this.setIsAwake(this.outputs.size > 0);
        this.main?.send(messageChannels.screenMessage, {
            screenId,
            type: 'visible',
            data: { isShowing: false },
        });
    }
    // A local output shown elsewhere on this computer -- a monitor or a virtual
    // display -- keeps its context; only where its sound plays changes.
    retargetOutput(screenId: number, displayId: number) {
        const output = this.outputs.get(screenId);
        if (!output || output.guestId) return false;
        output.displayId = displayId;
        output.context = {
            ...output.context,
            isSoundOwner: isVirtualDisplayId(displayId),
        };
        return true;
    }
    // A local output's context as it stands, for a page about to load.
    getOutputContext(screenId: number) {
        return this.outputs.get(screenId)?.context ?? null;
    }
    // A fresh snapshot of a local output's settings and layers, for a page
    // that is about to load long after the screen was shown (a virtual
    // display's compositor starts only when somebody watches).
    async refreshContext(screenId: number) {
        const output = this.outputs.get(screenId);
        if (!output || output.guestId) return;
        const data = await this.bootstrap(screenId);
        if (this.outputs.get(screenId) !== output) return;
        output.context = this.translate(
            screenId,
            {
                ...data,
                resources: {},
                remote: false,
                isSoundOwner: output.context.isSoundOwner,
            },
            '',
        );
    }
    // A browser watching a virtual display, let interact by the operator,
    // picked a verse or scrolled: to the presenter, as a screen window's own
    // report goes. Already checked and rebuilt by
    // `readVirtualDisplayViewerFeedback`.
    forwardViewerFeedback(message: MirrorScreenMessage) {
        this.main?.send(messageChannels.screenMessage, message);
    }
    // The host's screen a window of this computer shows, by the window.
    private incomingOf(contents?: WebContents) {
        if (!contents) return undefined;
        for (const item of this.incoming.values())
            if (item.contentsId === contents.id) return item;
        return undefined;
    }
    resource(screenId: number, filePath: string, sender?: WebContents) {
        const incoming = this.incomingOf(sender)?.context;
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
        // The guest loads its files from where it reached this host: the
        // address it dialled (behind a router, the router's public side), or
        // failing that the network card it came in on -- never loopback.
        const peer = output.guestId && this.peers.get(output.guestId);
        const baseUrl = peer
            ? (peer.origin ??
              `http://${toMirrorHostPort(peer.localAddress, this.port)}`)
            : isVirtualDisplayId(output.displayId)
              ? ''
              : `http://127.0.0.1:${this.port}`;
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
            // A clock's `dateTime`: rebuilt from its own fields below, a Date
            // has none and became `{}`, so every countdown and stopwatch on a
            // guest or a virtual display stood at zero.
            if (value instanceof Date) return value;
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
        getScreenOutput(message.screenId)?.sendData('mirror:context', {
            stage: output.context.stage,
            resources: output.context.resources,
        });
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
    // A window of this computer showing a host's screen reports back to that
    // host alone: the window, not the screen id, says which host it is.
    sendFeedback(message: MirrorScreenMessage, sender?: WebContents) {
        const incoming = this.incomingOf(sender);
        if (!incoming) return false;
        const socket = this.links.get(incoming.linkId)?.socket;
        if (socket && MIRROR_FEEDBACK_TYPES.has(message.type))
            socketSend(socket, 'screen-feedback', {
                message: { ...message, screenId: incoming.screenId },
            });
        return true;
    }
    stepBible(
        data: { screenId: number; isNext: boolean },
        sender?: WebContents,
    ) {
        const incoming = this.incomingOf(sender);
        if (!incoming) return false;
        const socket = this.links.get(incoming.linkId)?.socket;
        if (socket)
            socketSend(socket, 'step-bible', {
                screenId: incoming.screenId,
                isNext: data.isNext,
            });
        return true;
    }
    private sendInventory() {
        const linked = [...this.links.values()].filter((link) => {
            return link.socket && link.connection.status === 'connected';
        });
        if (linked.length) {
            const primaryId = screen.getPrimaryDisplay().id;
            const inventory = {
                displays: screen.getAllDisplays().map((display) => ({
                    id: display.id,
                    label: display.label ?? '',
                    bounds: display.bounds,
                    scaleFactor: display.scaleFactor,
                    isPrimary: display.id === primaryId,
                })),
                cameras: this.physicalCameras,
            };
            for (const link of linked)
                socketSend(link.socket!, 'inventory', inventory);
        }
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
    // Adds a host beside the ones this computer is already linked to. A host
    // this computer already has a live link to is refused; one whose link
    // ended in an error (a wrong code, say) is replaced, so retrying works.
    async connect(options: { host: string; port: number; code: string }) {
        const typed = readMirrorAddressText(String(options.host ?? ''));
        if (
            this.peers.size ||
            !typed ||
            !Number.isInteger(options.port) ||
            options.port < 1 ||
            options.port > 65535 ||
            typed.host.length > 253 ||
            /[\s/\\?#@]/.test(typed.host)
        )
            throw new Error('Invalid host or port');
        if (this.links.size >= MAX_LINKS) throw new Error('Too many hosts');
        const host = typed.host;
        const target = toMirrorHostPort(host, options.port);
        const found = await new Promise<{ id: string; name: string }>(
            (resolve, reject) => {
                const request = http.get(
                    `http://${target}/discovery`,
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
                                const value = JSON.parse(data);
                                if (
                                    response.statusCode !== 200 ||
                                    value.service !== 'owa-screen-mirror' ||
                                    value.protocol !== MIRROR_PROTOCOL ||
                                    value.version !== appInfo.version ||
                                    typeof value.id !== 'string' ||
                                    value.id === this.id
                                )
                                    throw new Error(
                                        'Incompatible or duplicate connection',
                                    );
                                resolve({
                                    id: value.id,
                                    name:
                                        typeof value.name === 'string'
                                            ? value.name.slice(0, 256)
                                            : '',
                                });
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
                request.on('error', () =>
                    reject(new Error('Connection failed')),
                );
            },
        );
        if (this.peers.size) throw new Error('Invalid host or port');
        const existing = [...this.links.values()].find((link) => {
            return link.connection.hostId === found.id;
        });
        if (existing) {
            if (existing.connection.status !== 'error')
                throw new Error('Incompatible or duplicate connection');
            this.closeLink(existing);
        }
        if (this.links.size >= MAX_LINKS) throw new Error('Too many hosts');
        const link: Link = {
            connection: {
                id: randomUUID(),
                hostId: found.id,
                status: 'connecting',
                host,
                port: options.port,
                name: found.name,
                prefix: '',
                error: null,
            },
            options: { host, port: options.port, code: options.code },
            attempt: 0,
            cameras: [],
        };
        this.links.set(link.connection.id, link);
        this.openLink(link);
    }
    private openLink(link: Link) {
        const { options, connection } = link;
        connection.status = link.attempt ? 'reconnecting' : 'connecting';
        connection.error = null;
        const socket = new WebSocket(
            `ws://${toMirrorHostPort(options.host, options.port)}/mirror`,
            {
                perMessageDeflate: false,
                maxPayload: MIRROR_MAX_MESSAGE,
                handshakeTimeout: 5000,
            },
        );
        link.socket = socket;
        let alive = true;
        clearInterval(link.heartbeat);
        link.heartbeat = setInterval(() => {
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
            if (link.socket !== socket) return;
            const packet = !binary && readMirrorPacket(bytes.toString());
            if (!packet) {
                socket.close(1008);
                return;
            }
            if (packet.type === 'pending') connection.status = 'pending';
            else if (packet.type === 'error') {
                denied = true;
                connection.status = 'error';
                connection.error = String(packet.error).slice(0, 256);
            } else if (
                packet.type === 'approved' &&
                typeof packet.id === 'string' &&
                packet.id !== this.id &&
                typeof packet.prefix === 'string'
            ) {
                options.resume = packet.resume;
                link.attempt = 0;
                connection.status = 'connected';
                connection.prefix = packet.prefix;
                this.sendInventory();
            } else if (connection.status === 'connected') {
                if (packet.type === 'show')
                    void this.showIncoming(link, packet).catch(() =>
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
                    this.hideIncoming(`${connection.id}:${packet.screenId}`);
                else if (
                    packet.type === 'screen' &&
                    isMirrorScreenMessage(packet.message)
                ) {
                    const incoming = this.incoming.get(
                        `${connection.id}:${packet.message.screenId}`,
                    );
                    if (incoming) {
                        const { context, controller } = incoming;
                        context.resources = packet.resources ?? {};
                        if (Number.isInteger(packet.stage) && packet.stage >= 0)
                            context.stage = packet.stage;
                        controller.sendData('mirror:context', {
                            stage: context.stage,
                            resources: context.resources,
                        });
                        controller.sendMessage(
                            packet.message.type,
                            packet.message.data,
                        );
                    }
                } else if (packet.type === 'cameras') {
                    // Up to 32 guests plus the host, each with 32 native cameras.
                    const cameras = readMirrorCameras(packet.cameras, 33 * 32);
                    if (
                        JSON.stringify(cameras) !== JSON.stringify(link.cameras)
                    ) {
                        link.cameras = cameras;
                        this.notify();
                    }
                } else if (
                    [
                        'camera-request',
                        'camera-signal',
                        'camera-close',
                    ].includes(packet.type)
                )
                    this.deliverGuestCamera(link, packet);
            }
            this.notifyStateOnly();
        });
        socket.on('close', () => {
            if (link.socket !== socket) return;
            clearInterval(link.heartbeat);
            link.socket = undefined;
            link.cameras = [];
            this.closeLinkScreens(link);
            this.closeLinkCameras(connection.id);
            if (!denied && this.links.get(connection.id) === link) {
                connection.status = 'reconnecting';
                link.reconnectTimer = setTimeout(
                    () => this.openLink(link),
                    Math.min(1000 * 2 ** link.attempt++, 30000),
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
    private closeLink(link: Link) {
        this.links.delete(link.connection.id);
        clearTimeout(link.reconnectTimer);
        clearInterval(link.heartbeat);
        const socket = link.socket;
        link.socket = undefined;
        socket?.close();
        link.cameras = [];
        this.closeLinkScreens(link);
        this.closeLinkCameras(link.connection.id);
    }
    // One host's link, or -- without an id -- every one.
    disconnect(id?: string) {
        for (const link of [...this.links.values()])
            if (id === undefined || link.connection.id === id)
                this.closeLink(link);
        this.notify();
    }
    private closeLinkScreens(link: Link) {
        for (const [key, incoming] of this.incoming)
            if (incoming.linkId === link.connection.id) this.hideIncoming(key);
    }
    private async showIncoming(link: Link, packet: Record<string, any>) {
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
        const key = `${link.connection.id}:${packet.screenId}`;
        this.hideIncoming(key);
        // Its own window, outside the cache this computer's own screens are
        // kept in: a host's screen 0 must not take over this computer's.
        const controller = ElectronScreenController.createDetached(
            packet.screenId,
        );
        const incoming: Incoming = {
            linkId: link.connection.id,
            screenId: packet.screenId,
            contentsId: controller.win.webContents.id,
            controller,
            context: { ...packet.context, remote: true },
        };
        this.incoming.set(key, incoming);
        controller.win.once('closed', () => {
            if (this.incoming.get(key) !== incoming) return;
            this.incoming.delete(key);
            if (link.socket)
                socketSend(link.socket, 'screen-feedback', {
                    message: {
                        screenId: packet.screenId,
                        type: 'visible',
                        data: { isShowing: false },
                    },
                });
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
    private hideIncoming(key: string) {
        const incoming = this.incoming.get(key);
        if (!incoming) return;
        this.incoming.delete(key);
        incoming.controller.close();
    }
    // The ✕ (or a key) on a host's screen here asks to hide it by its screen
    // id, which names this computer's OWN screen of that id, or none -- so it
    // is answered by the window that asked. Left in the map, the window's own
    // `closed` handler tells the host it went down, as for any other close.
    closeIncomingOf(contents: WebContents) {
        const incoming = this.incomingOf(contents);
        if (!incoming) return false;
        incoming.controller.close();
        return true;
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
                    const value = readMirrorDiscovery(
                        JSON.parse(bytes.toString()),
                    );
                    if (
                        value === null ||
                        value.id === this.id ||
                        value.version !== appInfo.version
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
                                    const verified = readMirrorDiscovery(
                                        JSON.parse(text),
                                    );
                                    const known = found.get(value.id);
                                    // Every network it answered on was tried;
                                    // keep the best address, not the last.
                                    if (
                                        !done &&
                                        verified !== null &&
                                        verified.id === value.id &&
                                        verified.version === appInfo.version &&
                                        verified.port === value.port &&
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
    // Browsers watching a virtual display (`vd:<viewer>:<screen>`), reached
    // through their own sockets.
    private viewerCameraSink:
        ((consumer: string, packet: Record<string, any>) => void) | null = null;
    setViewerCameraSink(
        sink: (consumer: string, packet: Record<string, any>) => void,
    ) {
        this.viewerCameraSink = sink;
    }
    // Already checked by the virtual display: a camera that screen shows.
    routeViewerCamera(consumer: string, packet: Record<string, any>) {
        this.routeCamera(consumer, packet);
    }
    closeViewerCameras(consumer: string) {
        this.closeCameraRoutes(consumer);
    }
    private deliverCamera(to: string, packet: Record<string, any>) {
        if (to === 'broker') this.sendBroker(packet);
        else if (to.startsWith('vd:')) this.viewerCameraSink?.(to, packet);
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
    // This computer as a guest. Each camera stream belongs to one host's
    // link: a window here watching one (`guestConsumers`), or this computer's
    // own camera a host asked the broker for (`brokerLinks`). A host's
    // signal reaches only a stream of its own link.
    private guestConsumers = new Map<
        string,
        { contentsId: number; linkId: string }
    >();
    private brokerLinks = new Map<string, string>();
    private deliverGuestCamera(link: Link, packet: Record<string, any>) {
        const linkId = link.connection.id;
        if (typeof packet.requestId !== 'string') return;
        if (packet.type === 'camera-request') {
            if (this.brokerLinks.size >= 128) return;
            this.brokerLinks.set(packet.requestId, linkId);
            this.sendBroker(packet);
            return;
        }
        const consumer = this.guestConsumers.get(packet.requestId);
        if (consumer?.linkId === linkId) {
            BrowserWindow.getAllWindows()
                .find((win) => win.webContents.id === consumer.contentsId)
                ?.webContents.send('mirror:camera', packet);
            if (packet.type === 'camera-close')
                this.guestConsumers.delete(packet.requestId);
        } else if (this.brokerLinks.get(packet.requestId) === linkId) {
            this.broker?.webContents.send('mirror:camera', packet);
            if (packet.type === 'camera-close')
                this.brokerLinks.delete(packet.requestId);
        }
    }
    private closeLinkCameras(linkId: string) {
        for (const [requestId, consumer] of this.guestConsumers) {
            if (consumer.linkId !== linkId) continue;
            this.guestConsumers.delete(requestId);
            BrowserWindow.getAllWindows()
                .find((win) => win.webContents.id === consumer.contentsId)
                ?.webContents.send('mirror:camera', {
                    type: 'camera-close',
                    requestId,
                });
        }
        let isReleased = false;
        for (const [requestId, owner] of this.brokerLinks) {
            if (owner !== linkId) continue;
            this.brokerLinks.delete(requestId);
            this.brokerRequests.delete(requestId);
            this.broker?.webContents.send('mirror:camera', {
                type: 'camera-close',
                requestId,
            });
            isReleased = true;
        }
        if (isReleased && !this.brokerRequests.size)
            this.scheduleBrokerRelease();
    }
    // The link a camera request from a window here goes to: the host whose
    // camera list has it, else the host whose screen the window shows.
    private cameraLinkFor(sender: WebContents, deviceId: unknown) {
        for (const link of this.links.values())
            if (
                link.connection.status === 'connected' &&
                link.cameras.some((camera) => camera.deviceId === deviceId)
            )
                return link.connection.id;
        return this.incomingOf(sender)?.linkId;
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
                ? (this.incomingOf(event.sender)?.context ??
                  screenMirrorRuntime.context?.(id) ??
                  null)
                : null;
        });
        ipcMain.on('mirror:resource', (event, data) => {
            event.returnValue =
                this.trusted(event.sender) && typeof data?.filePath === 'string'
                    ? this.resource(data.screenId, data.filePath, event.sender)
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
                if (data.action === 'qr') return await toQrCode(data.text);
                if (data.action === 'firewall')
                    return await checkNetworkFirewall({
                        port: this.port,
                        isForced: data.isForced === true,
                    });
                if (data.action === 'open-firewall-settings')
                    return await openFirewallSettings(data.target);
                if (data.action === 'connect')
                    await this.connect({
                        host: data.host,
                        port: data.port,
                        code: typeof data.code === 'string' ? data.code : '',
                    });
                else if (data.action === 'disconnect')
                    this.disconnect(
                        typeof data.id === 'string' ? data.id : undefined,
                    );
                else if (data.action === 'host')
                    await this.setHostEnabled(data.enabled === true);
                else if (data.action === 'internet')
                    await this.setInternetEnabled(data.enabled === true);
                else if (data.action === 'router') {
                    if (this.isRouterWanted) void this.openRouter();
                } else if (data.action === 'approve') this.approve(data.id);
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
                    if (typeof data.publicAddress === 'string')
                        this.setPublicAddress(data.publicAddress);
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
                    for (const [requestId, consumer] of this.guestConsumers)
                        if (consumer.contentsId === id) {
                            const socket = this.links.get(
                                consumer.linkId,
                            )?.socket;
                            if (socket)
                                socketSend(socket, 'camera-close', {
                                    requestId,
                                });
                            this.guestConsumers.delete(requestId);
                        }
                });
            }
            const isBroker = event.sender === this.broker?.webContents;
            if (isBroker && packet.type === 'camera-close') {
                this.brokerRequests.delete(packet.requestId);
                if (!this.brokerRequests.size) this.scheduleBrokerRelease();
            }
            // A stream this computer's broker sends to one of its own
            // consumers (a browser watching a virtual display) goes by the
            // local route even while this computer is a guest elsewhere.
            if (
                this.links.size &&
                !(isBroker && this.cameraRoutes.has(packet.requestId))
            ) {
                if (typeof packet.requestId !== 'string') return;
                const consumer = this.guestConsumers.get(packet.requestId);
                const linkId = isBroker
                    ? this.brokerLinks.get(packet.requestId)
                    : packet.type === 'camera-request'
                      ? this.cameraLinkFor(event.sender, packet.deviceId)
                      : consumer?.contentsId === event.sender.id
                        ? consumer.linkId
                        : undefined;
                const link = linkId ? this.links.get(linkId) : undefined;
                if (!link?.socket || link.connection.status !== 'connected')
                    return;
                if (!isBroker && packet.type === 'camera-request') {
                    if (this.guestConsumers.size >= 128) return;
                    this.guestConsumers.set(packet.requestId, {
                        contentsId: event.sender.id,
                        linkId: link.connection.id,
                    });
                }
                socketSend(link.socket, packet.type, packet);
                if (packet.type === 'camera-close') {
                    if (isBroker) this.brokerLinks.delete(packet.requestId);
                    else this.guestConsumers.delete(packet.requestId);
                }
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
