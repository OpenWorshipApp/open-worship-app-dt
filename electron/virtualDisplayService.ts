import type http from 'node:http';
import type { Duplex } from 'node:stream';
import fs from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import {
    BrowserWindow,
    ipcMain,
    systemPreferences,
    webContents,
    type WebContents,
    type WebPreferences,
} from 'electron';

import ElectronSettingManager from './ElectronSettingManager';
import { genWebPreferences } from './electronHelpers';
import { genKeepAwake } from './keepAwakeHelpers';
import { genRouteUrl, genRoutProps } from './protocolHelpers';
import { htmlFiles } from './fsServe';
import { screenMirrorRuntime } from './screenMirrorRuntime';
import type { ScreenMirrorService } from './screenMirrorService';
import { toMirrorPlainAddress } from './screenMirrorProtocol';
import { readRequestSender } from './mirrorRequestSender';
import { Fmp4Fanout } from './fmp4Fanout';
import {
    HLS_READY_SEGMENTS,
    HlsSegmenter,
    checkIsHlsOnlyUserAgent,
    toHlsMasterPlaylist,
} from './hlsSegmenter';
import { VirtualDisplayWebViewers } from './virtualDisplayWebViewers';
import { ViewerCameras } from './virtualDisplayViewerCameras';
import VirtualScreenController from './VirtualScreenController';
import {
    checkIsVirtualDisplayHost,
    markVirtualDisplayHost,
    setVirtualDisplayAudioTarget,
} from './virtualDisplayHostRegistry';
import { readVirtualDisplayWallpaper } from './displayWallpaperHelpers';
import { DLNA_CONTENT_FEATURES, type CastTarget } from './castProtocol';
import {
    discoverCastTargets,
    startCastSession,
    type CastFailureType,
    type CastSessionType,
} from './castTargets';
import {
    MAX_VIRTUAL_DISPLAYS,
    VIRTUAL_DISPLAY_ACCESS_KEY,
    VIRTUAL_DISPLAY_CODE_KEY,
    VIRTUAL_DISPLAY_SETTING_KEY,
    clampResolution,
    parseVirtualDisplayPath,
    readBasicAuthPassword,
    readVirtualDisplayAccessMode,
    readVirtualDisplaySetting,
    sanitizeVirtualDisplayName,
    sanitizeWallpaper,
    toVirtualDisplayBitrate,
    toVirtualDisplayId,
    toVirtualDisplayNumber,
    toVirtualDisplayStreamUrl,
    type VirtualDisplayBlockedClient,
    type VirtualDisplayCast,
    type VirtualDisplayClient,
    type VirtualDisplayCompositorConfig,
    type VirtualDisplayLayout,
    type VirtualDisplayNetwork,
    type VirtualDisplayWebContext,
    type VirtualDisplayRecord,
    type VirtualDisplayState,
    type VirtualDisplayStreamStatus,
} from './virtualDisplayProtocol';

// Virtual Displays: monitors that exist only inside this app. The presenter
// lists them, assigns screens to them and shows screens on them exactly as on
// a real monitor. They are watched two ways, on the Screen Mirror server:
//  - `/vd/<number>/` in a browser, which draws the display itself from the
//    screens' messages (`VirtualDisplayWebViewers`): nothing is rendered or
//    encoded here, and what is shown changes as fast as the network;
//  - `/vd/<number>/video`, a live MP4 for media players.
//
// Nothing runs for a display nobody is watching. Its screens are
// `VirtualScreenController`s with no page; the first MP4 viewer starts a
// hidden compositor window that draws the wallpaper and one `<webview>` per
// screen, records itself, and hands the bytes to the fan-out. Five seconds
// after the last MP4 viewer leaves it is destroyed whole.
const RELEASE_DELAY_MILLISECOND = 5000;

// A hidden page's failures reach no one else: its errors go to the log.
function logErrors(contents: WebContents, name: string) {
    contents.on('console-message', (event: any, ...rest: any[]) => {
        const level = typeof rest[0] === 'number' ? rest[0] : event.level;
        const message = typeof rest[1] === 'string' ? rest[1] : event.message;
        if (level === 3 || level === 'error') {
            console.error(`[${name}]`, String(message).slice(0, 500));
        }
    });
}
const DEVICES_CHANGED_DELAY_MILLISECOND = 300;
const STATE_DELAY_MILLISECOND = 50;
// A browser page asks for a look for TVs at most this often (see
// `onCastSearch`); the card's own look is not held back.
const VIEWER_CAST_SEARCH_GAP_MILLISECOND = 5000;
const MAX_VIEWERS = 8;
const MAX_VIEWERS_PER_ADDRESS = 3;
const BLOCK_MILLISECOND = 10 * 60 * 1000;
const MAX_BLOCKED = 256;
const FRAME_RATE = 30;
const CONTEXT_REUSE_MILLISECOND = 2000;
const VIEWER_LABELS_SETTING_KEY = 'virtual-display-viewer-labels';
// The viewer page's few words, in English until the app's own window has
// handed them over in its language (`labels` command).
const DEFAULT_VIEWER_LABELS: Record<string, string> = {
    fullScreen: 'Full screen',
    exitFullScreen: 'Exit full screen',
    sound: 'Turn on sound',
    waiting: 'Waiting for the display',
    disconnected:
        'This device was disconnected. Ask whoever runs the display to let it back in.',
    waitingApproval: 'Waiting for host approval',
    code: 'Connection code',
    connect: 'Connect',
    wrongCode: 'Connection code is incorrect',
    locked: 'Too many wrong codes. Try again later.',
    retry: 'Retry',
    empty: 'Nothing is showing on this display yet.',
    mic: 'Send my microphone',
    soundOff: 'Turn off sound',
    voiceVolume: 'Voice volume',
    cast: 'Cast to a TV',
    castFailed:
        'No TV was found that can play this display. It must be on and on the same network.',
    castSearching: 'Looking for TVs…',
    castSearchAgain: 'Search again',
    castStart: 'Cast',
    castStop: 'Stop',
    castConnecting: 'Connecting',
    casting: 'Casting',
    castCouldNot: 'The TV could not play this display.',
    castNeedsSharing: 'Turn on “Let other devices watch” to cast to a TV.',
    castFromBrowser: 'Cast from this browser',
    castBrowserHint: 'For a TV on the same network as this device.',
    castNoBrowserTv:
        'This browser found no TV. It must be on and on the same network as this device.',
    castNoBrowser: 'This browser cannot cast. Try Chrome, Edge or Safari.',
    castAppTvs: 'TVs on the app’s network',
    close: 'Close',
    camera: 'Share my cameras',
    cameraShare: 'Share',
    cameraStop: 'Stop',
    cameraName: 'Camera',
    cameraFront: 'Front camera',
    cameraBack: 'Back camera',
    micFailed:
        'The microphone could not be opened. Allow it for this page, or close another app using it.',
    cameraFailed:
        'The camera could not be opened. Allow it for this page, or close another app using it.',
};
// A media player from the internet waiting for the operator's Allow is
// answered 403 after this long.
const PLAYER_WAIT_MILLISECOND = 5 * 60 * 1000;
// An HLS player asks for its playlist every couple of seconds; one silent
// this long has gone (a phone locked, a tab closed).
const HLS_IDLE_MILLISECOND = 30000;
const HLS_SWEEP_MILLISECOND = 5000;
// The most a first playlist waits for the stream to have started.
const HLS_WAIT_MILLISECOND = 20000;
const HLS_PLAYLIST_TYPE = 'application/vnd.apple.mpegurl';

function writeHlsResponse(
    res: http.ServerResponse,
    contentType: string,
    body: string | Buffer,
    isHead = false,
) {
    const data = typeof body === 'string' ? Buffer.from(body) : body;
    res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': data.length,
        // A playlist changes with every segment; a segment never changes.
        'Cache-Control':
            contentType === HLS_PLAYLIST_TYPE ? 'no-store' : 'max-age=60',
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': '*',
    });
    res.end(isHead ? undefined : data);
}
// Media players let in from the internet, by display and address.
const MAX_PLAYER_GRANTS = 256;
const MAX_CAST_TOKENS = 256;
const CAST_TOKEN_MILLISECOND = 24 * 60 * 60 * 1000;

// A display cast to one TV.
type CastEntryType = {
    number: number;
    target: CastTarget;
    status: VirtualDisplayCast['status'];
    failure: CastFailureType | null;
    session: CastSessionType | null;
    behind: number | null;
    playbackRate: number;
};

// The display's MP4 as HLS, for an iPhone, an iPad or Safari (see
// `HlsSegmenter`): there only while such a player watches. Each player is a
// token in its file addresses, standing for the viewer it was let in as,
// from the address it was let in from.
type HlsStateType = {
    segmenter: HlsSegmenter;
    players: Map<string, { id: string; address: string; lastSeen: number }>;
    // Answers waiting for the stream to start (`whenHls`).
    waiters: Set<() => void>;
    sweepTimer: ReturnType<typeof setInterval>;
};

type SessionType = {
    number: number;
    window: BrowserWindow | null;
    isReady: boolean;
    fanout: Fmp4Fanout;
    hls: HlsStateType | null;
    viewers: Map<string, VirtualDisplayClient>;
    // Players from the internet held until the operator's Allow: listed in
    // `viewers` as waiting, answered once allowed, rejected or timed out.
    waitingPlayers: Map<
        string,
        {
            res: http.ServerResponse;
            timer: ReturnType<typeof setTimeout>;
            isHls: boolean;
        }
    >;
    stream: VirtualDisplayStreamStatus;
    error: string | null;
    mimeType: string | null;
    generation: number;
    releaseTimer?: ReturnType<typeof setTimeout>;
};

export class VirtualDisplayService {
    private settings = ElectronSettingManager.getInstance();
    private records: VirtualDisplayRecord[];
    private nextNumber: number;
    private screens = new Map<number, VirtualScreenController>();
    private sessions = new Map<number, SessionType>();
    // A viewer the operator disconnected stays out of that display for a
    // while (a player would otherwise reconnect at once), or until Allow
    // again: a browser by its id, a media player by its address.
    private blocked = new Map<string, VirtualDisplayBlockedClient>();
    private setIsAwake = genKeepAwake();
    private devicesChangedTimer?: ReturnType<typeof setTimeout>;
    private stateTimer?: ReturnType<typeof setTimeout>;
    private orderCounter = 0;
    private readonly webViewers: VirtualDisplayWebViewers;
    // Browser viewers' cameras shared with this computer.
    private readonly viewerCameras = new ViewerCameras({
        toViewer: (viewerId, packet) => {
            this.webViewers.sendIntercom(viewerId, String(packet.type), {});
        },
        toWatcher: (watcher, channel, data) => {
            const { text, ...frame } = data;
            const [kind, first, second] = watcher.split(':');
            if (kind === 'window') {
                const contents = webContents.fromId(Number(first));
                if (contents && !contents.isDestroyed()) {
                    contents.send(channel, frame);
                }
            } else if (kind === 'screen') {
                // A browser's screen page: the frame as it came, base64. Its
                // key/delta goes as `frameType` -- the packet's own `type`
                // names the packet, and a frame that lost it was never a
                // key frame, so the page decoded none of them.
                const isFrame = channel === 'vd:camera-frame';
                this.webViewers.sendScreenCamera(
                    first,
                    Number(second),
                    isFrame ? 'vd-camera-frame' : 'vd-camera-end',
                    isFrame
                        ? {
                              cameraId: frame.cameraId,
                              frameType: frame.type,
                              timestamp: frame.timestamp,
                              data: text,
                          }
                        : { cameraId: frame.cameraId },
                );
            }
        },
        onListChanged: () => {
            this.mirror.sendDevicesChanged();
            this.scheduleState();
        },
    });
    // A display's wallpaper is published to browser viewers under its own
    // scope, revoked when the wallpaper or the display goes.
    private wallpaperScopes = new Map<number, string>();
    private contextLoads = new Map<
        number,
        { promise: Promise<VirtualDisplayWebContext | null>; at: number }
    >();
    private viewerLabels: Record<string, string>;
    // `<number>|<address>` of media players let in from the internet.
    private playerGrants = new Set<string>();
    // A browser that was let in may cast its display to a TV on ITS OWN
    // network, through the browser's picker (asked for by the user: _"this is
    // for casting to a tv with same network of the browser not app"_). The TV
    // is handed the MP4 with one of these, so it is not held for the
    // operator's Allow nor asked a code it cannot type. One per browser and
    // display; it ends with that browser's access (Disconnect, the access
    // option or code changing, the display deleted) or after a day.
    private castTokens = new Map<
        string,
        { number: number; viewerId: string; until: number }
    >();
    private readonly preloadFilePath = genRoutProps(htmlFiles.virtualDisplay)
        .preloadFilePath;

    constructor(private readonly mirror: ScreenMirrorService) {
        const setting = readVirtualDisplaySetting(
            this.settings.getClientSetting(VIRTUAL_DISPLAY_SETTING_KEY),
        );
        this.records = setting.list;
        this.nextNumber = setting.nextNumber;
        this.viewerLabels = this.readViewerLabels();
        this.webViewers = new VirtualDisplayWebViewers({
            checkIsAdmitted: (network) => this.checkIsAdmitted(network),
            getAccess: (network) => this.getAccess(network),
            checkCode: (address, code) => {
                return this.mirror.checkSenderCode(
                    address,
                    this.settings.getSecureSetting(VIRTUAL_DISPLAY_CODE_KEY),
                    code,
                );
            },
            checkIsLockedOut: (address) => {
                return this.mirror.checkIsSenderLockedOut(address);
            },
            checkIsBlocked: (number, viewerId) => {
                return this.checkIsBlocked(number, 'web', viewerId);
            },
            getLayout: (number) => this.getLayout(number),
            getScreen: (number, screenId) => {
                const controller = this.screens.get(screenId);
                return controller?.displayNumber === number ? controller : null;
            },
            loadContext: (number, screenId) => {
                return this.loadWebContext(number, screenId);
            },
            onChanged: () => this.scheduleState(),
            // A viewer the operator let interact picked a verse or scrolled:
            // to the presenter, as a screen window's own report would go.
            onFeedback: (message) => this.mirror.forwardViewerFeedback(message),
            // The same as a screen window's own ✕ (`app:hide-screen`).
            onHideScreen: (number, screenId) => {
                const controller = this.screens.get(screenId);
                if (controller?.displayNumber !== number) {
                    return;
                }
                this.mirror.hide(screenId);
                controller.close();
            },
            getCastState: (number) => {
                const casts = this.listCasts(number);
                return {
                    isSharing: this.mirror.isVirtualDisplayShareEnabled,
                    isSearching: this.isCastSearching,
                    targets: this.castTargets.map(({ id, name, kind }) => {
                        const cast = casts.find((item) => item.id === id);
                        return {
                            id,
                            name,
                            kind,
                            status: cast?.status ?? null,
                            behind: cast?.behind ?? null,
                        };
                    }),
                };
            },
            // A page's look waits a few seconds after the last one: each is
            // a burst of mDNS and SSDP on this network.
            onCastSearch: () => {
                if (
                    Date.now() - this.castSearchedAt <
                    VIEWER_CAST_SEARCH_GAP_MILLISECOND
                ) {
                    this.webViewers.sendCastStates();
                    return;
                }
                this.searchCastTargets().catch(() => {});
            },
            onCastStart: (number, targetId) => {
                return this.startCast(number, targetId);
            },
            issueCastToken: (number, viewerId) => {
                return this.issueCastToken(number, viewerId);
            },
            onCastStop: (number, targetId) => {
                this.stopCast(number, targetId);
            },
            // A browser's camera stream rides Screen Mirror's camera relay,
            // with this computer's camera broker as the source.
            onCamera: (consumer, packet) => {
                this.mirror.routeViewerCamera(consumer, packet);
            },
            onCameraGone: (consumer) => {
                this.mirror.closeViewerCameras(consumer);
            },
            hostId: () => this.mirror.id,
            onIntercom: (viewerId, packet) => {
                this.mirror.receiveIntercom(`viewer:${viewerId}`, packet);
            },
            onViewerGone: (viewerId) => {
                this.mirror.forgetIntercom(`viewer:${viewerId}`);
                this.viewerCameras.drop(viewerId);
            },
            onViewerCamera: (viewerId, address, packet) => {
                this.viewerCameras.receive(viewerId, address, packet);
            },
            onScreenCamera: (watcher, cameraId, isWatching, label) => {
                if (cameraId === null) {
                    this.viewerCameras.forgetWatcher(watcher);
                } else {
                    this.viewerCameras.watch(
                        watcher,
                        cameraId,
                        isWatching,
                        label,
                    );
                }
            },
        });
        this.mirror.setViewerCameraSink((consumer, packet) => {
            this.webViewers.sendCamera(consumer, packet);
        });
        // A browser viewer's shared camera, among this computer's own.
        this.mirror.registerCameraSource(() => this.viewerCameras.list());
        // A browser viewer's talk-back rides its page's own socket.
        this.mirror.registerIntercomPeers('viewer', {
            has: (id) => this.webViewers.checkIsLetIn(id),
            send: (id, type, data) => {
                this.webViewers.sendIntercom(id, type, data);
            },
            onChanged: () => this.scheduleState(),
        });
    }

    private readViewerLabels() {
        try {
            const stored = JSON.parse(
                this.settings.getClientSetting(VIEWER_LABELS_SETTING_KEY) ??
                    '{}',
            );
            const labels = { ...DEFAULT_VIEWER_LABELS };
            for (const key of Object.keys(labels)) {
                if (typeof stored?.[key] === 'string' && stored[key]) {
                    labels[key] = stored[key].slice(0, 80);
                }
            }
            return labels;
        } catch {
            return { ...DEFAULT_VIEWER_LABELS };
        }
    }

    private setViewerLabels(value: unknown) {
        const labels = { ...DEFAULT_VIEWER_LABELS };
        for (const key of Object.keys(labels)) {
            const text = (value as Record<string, unknown> | null)?.[key];
            if (typeof text === 'string' && text.trim()) {
                labels[key] = text.trim().slice(0, 200);
            }
        }
        if (JSON.stringify(labels) === JSON.stringify(this.viewerLabels)) {
            return;
        }
        this.viewerLabels = labels;
        this.settings.setClientSetting(
            VIEWER_LABELS_SETTING_KEY,
            JSON.stringify(labels),
        );
    }

    // -- What a browser viewer draws ----------------------------------------------

    private toWallpaperUrl(number: number, filePath: string) {
        let scope = this.wallpaperScopes.get(number);
        if (scope === undefined) {
            scope = this.mirror.content.createScope();
            this.wallpaperScopes.set(number, scope);
        }
        return this.mirror.content.publish(scope, filePath) ?? '';
    }

    private revokeWallpaper(number: number) {
        const scope = this.wallpaperScopes.get(number);
        if (scope !== undefined) {
            this.mirror.content.revoke(scope);
            this.wallpaperScopes.delete(number);
        }
    }

    getLayout(number: number): VirtualDisplayLayout | null {
        const record = this.getRecord(number);
        if (record === null) {
            return null;
        }
        const { wallpaper } = record;
        return {
            number,
            name: record.name,
            width: record.width,
            height: record.height,
            wallpaper:
                wallpaper.kind === 'image' || wallpaper.kind === 'video'
                    ? {
                          kind: wallpaper.kind,
                          url: this.toWallpaperUrl(number, wallpaper.filePath),
                      }
                    : wallpaper.kind === 'color'
                      ? { kind: 'color', color: wallpaper.color }
                      : { kind: 'none' },
            screenIds: this.screensOn(number)
                .sort((a, b) => a.order - b.order)
                .map((controller) => controller.screenId),
            labels: this.viewerLabels,
            castUrl: this.toCastUrl(number),
        };
    }

    // A screen's state for a page about to draw it. Pages loading together
    // (several browsers opening at once) share one snapshot.
    private loadWebContext(number: number, screenId: number) {
        const cached = this.contextLoads.get(screenId);
        if (
            cached !== undefined &&
            Date.now() - cached.at < CONTEXT_REUSE_MILLISECOND
        ) {
            return cached.promise;
        }
        const promise = (async () => {
            await this.mirror.refreshContext(screenId).catch((error) => {
                console.error('Virtual display:', error);
            });
            const context = this.mirror.getOutputContext(screenId);
            const record = this.getRecord(number);
            if (context === null || record === null) {
                return null;
            }
            // What is on the screen before any live message says so.
            const controller = this.screens.get(screenId);
            if (controller?.displayNumber === number) {
                controller.noteCameras(context.messages ?? []);
            }
            return {
                ...context,
                hostId: this.mirror.id,
                display: {
                    id: toVirtualDisplayId(number),
                    label: record.name,
                    width: record.width,
                    height: record.height,
                },
            };
        })();
        this.contextLoads.set(screenId, { promise, at: Date.now() });
        return promise;
    }

    // The display's screens, size or wallpaper changed: tell whoever draws it.
    private onDisplayChanged(number: number) {
        this.sendConfig(number);
        this.webViewers.sendLayout(number);
    }

    upgrade(
        req: http.IncomingMessage,
        socket: Duplex,
        head: Buffer,
        network: VirtualDisplayNetwork,
    ) {
        this.webViewers.upgrade(req, socket, head, network);
    }

    checkIsViewerAdmitted(network: VirtualDisplayNetwork) {
        return this.checkIsAdmitted(network);
    }

    // -- Records --------------------------------------------------------------

    private save() {
        this.settings.setClientSetting(
            VIRTUAL_DISPLAY_SETTING_KEY,
            JSON.stringify({ nextNumber: this.nextNumber, list: this.records }),
        );
    }

    getRecord(number: number) {
        return this.records.find((record) => record.number === number) ?? null;
    }

    create(data: Record<string, unknown>) {
        if (this.records.length >= MAX_VIRTUAL_DISPLAYS) {
            throw new Error('Too many virtual displays');
        }
        const number = this.nextNumber;
        this.nextNumber += 1;
        const { width, height } = clampResolution(data.width, data.height);
        this.records.push({
            number,
            // The page sends the base name in its own language; the number
            // makes it this display's.
            name: sanitizeVirtualDisplayName(
                typeof data.name === 'string' ? `${data.name} ${number}` : '',
                number,
            ),
            width,
            height,
            wallpaper: sanitizeWallpaper(data.wallpaper),
        });
        this.save();
        this.scheduleDevicesChanged();
        this.scheduleState();
        return number;
    }

    update(data: Record<string, unknown>) {
        const record = this.getRecord(Number(data.number));
        if (record === null) {
            throw new Error('Virtual display not found');
        }
        let isListChanged = false;
        if (data.name !== undefined) {
            const name = sanitizeVirtualDisplayName(data.name, record.number);
            if (name !== record.name) {
                record.name = name;
                isListChanged = true;
                this.webViewers.sendLayout(record.number);
            }
        }
        if (data.width !== undefined || data.height !== undefined) {
            const size = clampResolution(
                data.width ?? record.width,
                data.height ?? record.height,
            );
            if (size.width !== record.width || size.height !== record.height) {
                record.width = size.width;
                record.height = size.height;
                isListChanged = true;
                // A new size is a new stream: MP4 players reconnect to it;
                // browsers redraw, and their screen pages reload at it.
                this.endSession(record.number);
                this.webViewers.sendLayout(record.number);
            }
        }
        if (data.wallpaper !== undefined) {
            const wallpaper = sanitizeWallpaper(data.wallpaper);
            if (
                JSON.stringify(wallpaper) !== JSON.stringify(record.wallpaper)
            ) {
                record.wallpaper = wallpaper;
                isListChanged = true;
                this.revokeWallpaper(record.number);
                this.onDisplayChanged(record.number);
            }
        }
        this.save();
        if (isListChanged) {
            this.scheduleDevicesChanged();
        }
        this.scheduleState();
    }

    // -- Casting to a TV ---------------------------------------------------------
    //
    // The TV pulls the display's MP4 itself, over this network -- one more
    // player in Watching now -- so it plays while nothing here draws it.
    // TVs are looked for only when the operator asks (the cast list opens),
    // and the few found are kept until the next look.
    private castTargets: CastTarget[] = [];
    private isCastSearching = false;
    private castSearchedAt = 0;
    private casts = new Map<string, CastEntryType>();

    private toCastKey(number: number, targetId: string) {
        return `${number}\n${targetId}`;
    }

    async searchCastTargets() {
        if (this.isCastSearching) {
            return;
        }
        this.isCastSearching = true;
        this.scheduleState();
        try {
            this.castTargets = await discoverCastTargets();
        } finally {
            this.isCastSearching = false;
            this.castSearchedAt = Date.now();
            this.scheduleState();
        }
    }

    async startCast(number: number, targetId: string) {
        const record = this.getRecord(number);
        if (record === null) {
            throw new Error('Virtual display not found');
        }
        const target = this.castTargets.find((item) => item.id === targetId);
        if (target === undefined) {
            throw new Error('TV not found');
        }
        // Over this network only, so only while devices on it may watch.
        if (!this.mirror.isVirtualDisplayShareEnabled) {
            throw new Error('Let other devices watch is off');
        }
        const key = this.toCastKey(number, targetId);
        const previous = this.casts.get(key);
        if (previous !== undefined && previous.status !== 'failed') {
            return;
        }
        const entry: CastEntryType = {
            number,
            target,
            status: 'connecting',
            failure: null,
            session: null,
            behind: null,
            playbackRate: 1,
        };
        this.casts.set(key, entry);
        this.scheduleState();
        const isCurrent = () => this.casts.get(key) === entry;
        const session = await startCastSession(
            target,
            (localAddress) => {
                return toVirtualDisplayStreamUrl(
                    { host: localAddress, port: this.mirror.port, kind: 'lan' },
                    number,
                );
            },
            record.name,
            {
                onCasting: () => {
                    if (isCurrent()) {
                        entry.status = 'casting';
                        this.scheduleState();
                    }
                },
                getLiveTime: () => {
                    return this.sessions.get(number)?.fanout.liveTime ?? null;
                },
                onBehind: (seconds, playbackRate) => {
                    if (!isCurrent()) {
                        return;
                    }
                    // Shown to a tenth of a second: a change smaller than
                    // that is not worth a state broadcast.
                    const behind = Math.round(seconds * 10) / 10;
                    if (
                        behind !== entry.behind ||
                        playbackRate !== entry.playbackRate
                    ) {
                        entry.behind = behind;
                        entry.playbackRate = playbackRate;
                        this.scheduleState();
                    }
                },
                onEnded: (failure) => {
                    if (!isCurrent()) {
                        return;
                    }
                    if (failure === null) {
                        this.casts.delete(key);
                    } else {
                        entry.status = 'failed';
                        entry.failure = failure;
                    }
                    this.scheduleState();
                },
            },
        );
        if (isCurrent()) {
            entry.session = session;
        } else {
            session.stop();
        }
    }

    stopCast(number: number, targetId: string) {
        const key = this.toCastKey(number, targetId);
        const entry = this.casts.get(key);
        if (entry === undefined) {
            return;
        }
        this.casts.delete(key);
        entry.session?.stop();
        this.scheduleState();
    }

    private stopCasts(number?: number) {
        for (const [key, entry] of [...this.casts]) {
            if (number === undefined || entry.number === number) {
                this.casts.delete(key);
                entry.session?.stop();
            }
        }
    }

    private listCasts(number: number): VirtualDisplayCast[] {
        return [...this.casts.values()]
            .filter((entry) => entry.number === number)
            .map(({ target, status, failure, behind, playbackRate }) => {
                return {
                    id: target.id,
                    name: target.name,
                    kind: target.kind,
                    status,
                    failure,
                    behind,
                    playbackRate,
                };
            });
    }

    // The MP4 on this network, for a browser on this computer to cast: a TV
    // cannot reach 127.0.0.1.
    private toCastUrl(number: number) {
        if (!this.mirror.isVirtualDisplayShareEnabled) {
            return null;
        }
        const [lan] = this.mirror.addressList(false);
        return lan === undefined
            ? null
            : toVirtualDisplayStreamUrl(lan, number);
    }

    // This computer's microphone in a display's MP4 sound (off until turned
    // on, and again each launch). Media players cannot answer, so there is
    // no speaker for them. macOS asks once before a microphone may be heard.
    private mp4Mics = new Set<number>();
    async setMp4Mic(number: number, isOn: boolean) {
        if (this.getRecord(number) === null) {
            return;
        }
        if (
            isOn &&
            process.platform === 'darwin' &&
            !(await systemPreferences.askForMediaAccess('microphone'))
        ) {
            throw new Error('Microphone access denied');
        }
        if (isOn) {
            this.mp4Mics.add(number);
        } else {
            this.mp4Mics.delete(number);
        }
        const session = this.sessions.get(number);
        if (
            session?.isReady &&
            session.window &&
            !session.window.isDestroyed()
        ) {
            session.window.webContents.send('vd:compositor', {
                type: 'mic',
                isOn,
            });
        }
        this.scheduleState();
    }

    delete(number: number) {
        const record = this.getRecord(number);
        if (record === null) {
            return;
        }
        this.mp4Mics.delete(number);
        this.stopCasts(number);
        this.revokeCastTokens(number);
        for (const controller of this.screensOn(number)) {
            controller.close();
        }
        this.endSession(number);
        this.sessions.delete(number);
        this.records = this.records.filter((item) => item !== record);
        this.webViewers.sendLayout(number);
        this.revokeWallpaper(number);
        this.save();
        this.scheduleDevicesChanged();
        this.scheduleState();
    }

    // Shaped like an Electron `Display`, appended after the real monitors and
    // Screen Mirror's guests in `main:app:get-displays`.
    displays() {
        return this.records.map((record) => {
            const bounds = {
                x: 0,
                y: 0,
                width: record.width,
                height: record.height,
            };
            const size = { width: record.width, height: record.height };
            return {
                id: toVirtualDisplayId(record.number),
                label: record.name,
                bounds,
                workArea: bounds,
                size,
                workAreaSize: size,
                scaleFactor: 1,
                rotation: 0,
                internal: false,
                isPrimary: false,
                virtualNumber: record.number,
            };
        });
    }

    async readWallpaper(displayId: number, width?: number) {
        const record = this.getRecord(toVirtualDisplayNumber(displayId) ?? 0);
        return record === null
            ? null
            : await readVirtualDisplayWallpaper(record.wallpaper, width);
    }

    private scheduleDevicesChanged() {
        clearTimeout(this.devicesChangedTimer);
        this.devicesChangedTimer = setTimeout(() => {
            this.mirror.sendDevicesChanged();
        }, DEVICES_CHANGED_DELAY_MILLISECOND);
    }

    // -- Screens --------------------------------------------------------------

    private screensOn(number: number) {
        return [...this.screens.values()].filter((controller) => {
            return controller.displayNumber === number;
        });
    }

    showingScreenIds() {
        return [...this.screens.keys()];
    }

    attachScreen(screenId: number, displayId: number) {
        const number = toVirtualDisplayNumber(displayId);
        if (number === null || this.getRecord(number) === null) {
            throw new Error('Virtual display not found');
        }
        this.screens.get(screenId)?.close();
        const controller = new VirtualScreenController(
            screenId,
            number,
            (detached) => this.onScreenDetached(detached),
        );
        controller.order = ++this.orderCounter;
        this.screens.set(screenId, controller);
        this.onDisplayChanged(number);
        this.scheduleState();
        return controller;
    }

    // From one virtual display to another: the page leaves one compositor and
    // loads in the other; the presenter never sees the screen hide.
    moveScreen(screenId: number, displayId: number) {
        const number = toVirtualDisplayNumber(displayId);
        const controller = this.screens.get(screenId);
        if (
            controller === undefined ||
            number === null ||
            this.getRecord(number) === null
        ) {
            return false;
        }
        const previous = controller.displayNumber;
        controller.displayNumber = number;
        controller.order = ++this.orderCounter;
        controller.guest = null;
        for (const socket of controller.sockets) {
            socket.close(1000, 'Screen moved');
        }
        controller.sockets.clear();
        this.onDisplayChanged(previous);
        this.onDisplayChanged(number);
        this.scheduleState();
        return true;
    }

    // undefined: not a screen on a virtual display; null: no page right now.
    captureScreen(screenId: number) {
        const controller = this.screens.get(screenId);
        return controller === undefined
            ? undefined
            : Promise.resolve(controller.capture());
    }

    closeAllScreens() {
        for (const controller of [...this.screens.values()]) {
            controller.close();
        }
    }

    private onScreenDetached(controller: VirtualScreenController) {
        if (this.screens.get(controller.screenId) === controller) {
            this.screens.delete(controller.screenId);
        }
        this.onDisplayChanged(controller.displayNumber);
        this.scheduleState();
    }

    private toScreenSrc(screenId: number) {
        return (
            screenMirrorRuntime.screenUrl?.(screenId) ??
            genRouteUrl(htmlFiles.screen, `?screenId=${screenId}`)
        );
    }

    // -- Compositor -----------------------------------------------------------

    private ensureSession(number: number) {
        let session = this.sessions.get(number);
        if (session === undefined) {
            const created: SessionType = {
                number,
                window: null,
                isReady: false,
                fanout: new Fmp4Fanout(
                    (id) => this.onViewerGone(created, id),
                    () => this.requestKeyframe(created),
                ),
                hls: null,
                viewers: new Map(),
                waitingPlayers: new Map(),
                stream: 'idle',
                error: null,
                mimeType: null,
                generation: 0,
            };
            session = created;
            this.sessions.set(number, session);
        }
        return session;
    }

    private sessionOfHost(contents: WebContents) {
        if (!checkIsVirtualDisplayHost(contents)) {
            return null;
        }
        for (const session of this.sessions.values()) {
            if (session.window?.webContents === contents) {
                return session;
            }
        }
        return null;
    }

    private async startCompositor(session: SessionType) {
        if (session.window !== null || session.stream === 'starting') {
            return;
        }
        const record = this.getRecord(session.number);
        if (record === null) {
            return;
        }
        session.stream = 'starting';
        session.error = null;
        this.scheduleState();
        // The screens were shown long ago; their pages are about to load now.
        await Promise.all(
            this.screensOn(session.number).map((controller) => {
                return this.mirror
                    .refreshContext(controller.screenId)
                    .catch((error) => {
                        console.error('Virtual display:', error);
                    });
            }),
        );
        if (
            session.viewers.size === 0 ||
            this.getRecord(session.number) === null
        ) {
            session.stream = 'idle';
            this.scheduleState();
            return;
        }
        const webPreferences: WebPreferences = {
            ...genWebPreferences(this.preloadFilePath),
            webviewTag: true,
            backgroundThrottling: false,
            autoplayPolicy: 'no-user-gesture-required',
        };
        const win = new BrowserWindow({
            show: false,
            frame: false,
            skipTaskbar: true,
            focusable: false,
            useContentSize: true,
            width: record.width,
            height: record.height,
            backgroundColor: '#000000',
            webPreferences,
        });
        // Registered before anything loads: it is what lets this page, and
        // only this page, hold screen pages in `<webview>`s.
        markVirtualDisplayHost(win.webContents);
        // The constructor clamps a window to the screen it would open on; a
        // size set afterwards is kept, and it is the page's own size.
        win.setContentSize(record.width, record.height);
        win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        logErrors(win.webContents, `virtual display ${session.number}`);
        win.webContents.on('will-navigate', (event) => {
            event.preventDefault();
        });
        win.webContents.on(
            'will-attach-webview',
            (event, preferences, params) => {
                this.onWillAttachWebview(session, event, preferences, params);
            },
        );
        win.webContents.on('render-process-gone', () => {
            this.failSession(session, 'The virtual display stopped');
        });
        win.on('closed', () => {
            if (session.window === win) {
                session.window = null;
                session.isReady = false;
            }
        });
        session.window = win;
        session.isReady = false;
        session.generation += 1;
        session.fanout.resetStream();
        this.syncKeepAwake();
        genRoutProps(htmlFiles.virtualDisplay).loadURL(
            win,
            `?vd=${session.number}`,
        );
    }

    // Only a screen page this display is showing, and with a screen window's
    // own preferences, whatever the page asked for.
    private onWillAttachWebview(
        session: SessionType,
        event: Electron.Event,
        preferences: WebPreferences,
        params: Record<string, string>,
    ) {
        const isAllowed = this.screensOn(session.number).some((controller) => {
            return params.src === this.toScreenSrc(controller.screenId);
        });
        if (!isAllowed) {
            event.preventDefault();
            return;
        }
        delete (preferences as { preloadURL?: string }).preloadURL;
        Object.assign(preferences, genWebPreferences(this.preloadFilePath), {
            webviewTag: false,
            nodeIntegrationInSubFrames: false,
            backgroundThrottling: false,
            autoplayPolicy: 'no-user-gesture-required',
        });
        delete params.partition;
    }

    // A player joined: the next frame out is one it can start on.
    private requestKeyframe(session: SessionType) {
        const win = session.window;
        if (win !== null && session.isReady && !win.isDestroyed()) {
            win.webContents.send('vd:compositor', { type: 'keyframe' });
        }
    }

    private stopCompositor(session: SessionType) {
        clearTimeout(session.releaseTimer);
        for (const controller of this.screensOn(session.number)) {
            controller.guest = null;
        }
        const win = session.window;
        session.window = null;
        session.isReady = false;
        if (win !== null && !win.isDestroyed()) {
            // Muted already, and gone in the same tick: no moment where a
            // screen's sound could reach the speakers.
            win.destroy();
        }
        session.generation += 1;
        session.fanout.resetStream();
        if (session.stream !== 'error') {
            session.stream = 'idle';
            session.mimeType = null;
        }
        this.syncKeepAwake();
        this.scheduleState();
    }

    private failSession(session: SessionType, error: string) {
        session.stream = 'error';
        session.error = error;
        session.fanout.reset();
        this.endHlsPlayers(session);
        this.stopCompositor(session);
    }

    // Every HLS player ended, as `fanout.reset` ends every MP4 one.
    private endHlsPlayers(session: SessionType) {
        const ids = [...(session.hls?.players.values() ?? [])].map(
            (player) => player.id,
        );
        this.dropHls(session);
        for (const id of ids) {
            this.onViewerGone(session, id);
        }
    }

    // Ends every viewer of a display and its compositor (a new size, a
    // deletion).
    private endSession(number: number) {
        const session = this.sessions.get(number);
        if (session === undefined) {
            return;
        }
        session.fanout.reset();
        this.endHlsPlayers(session);
        session.viewers.clear();
        this.stopCompositor(session);
        session.stream = 'idle';
        session.error = null;
    }

    private syncKeepAwake() {
        this.setIsAwake(
            [...this.sessions.values()].some((session) => {
                return session.window !== null;
            }),
        );
    }

    private toConfig(number: number): VirtualDisplayCompositorConfig | null {
        const record = this.getRecord(number);
        if (record === null) {
            return null;
        }
        return {
            number,
            width: record.width,
            height: record.height,
            wallpaper: record.wallpaper,
            screens: this.screensOn(number)
                .sort((a, b) => a.order - b.order)
                .map((controller) => ({
                    screenId: controller.screenId,
                    src: this.toScreenSrc(controller.screenId),
                })),
        };
    }

    private sendConfig(number: number) {
        const session = this.sessions.get(number);
        const config = this.toConfig(number);
        if (
            !session?.window ||
            !session.isReady ||
            session.window.isDestroyed() ||
            config === null
        ) {
            return;
        }
        session.window.webContents.send('vd:compositor', {
            type: 'config',
            config,
        });
    }

    // -- Viewers --------------------------------------------------------------

    private toBlockKey(number: number, kind: 'web' | 'video', value: string) {
        return `${number}|${kind}:${value}`;
    }

    private checkIsBlocked(
        number: number,
        kind: 'web' | 'video',
        value: string,
    ) {
        const key = this.toBlockKey(number, kind, value);
        const entry = this.blocked.get(key);
        if (entry === undefined) {
            return false;
        }
        if (entry.until < Date.now()) {
            this.blocked.delete(key);
            return false;
        }
        return true;
    }

    private block(
        number: number,
        kind: 'web' | 'video',
        value: string,
        address: string,
    ) {
        const now = Date.now();
        for (const [key, entry] of this.blocked) {
            if (entry.until < now) {
                this.blocked.delete(key);
            }
        }
        if (this.blocked.size >= MAX_BLOCKED) {
            this.blocked.delete(this.blocked.keys().next().value!);
        }
        const key = this.toBlockKey(number, kind, value);
        this.blocked.set(key, {
            key,
            kind,
            address,
            until: now + BLOCK_MILLISECOND,
        });
    }

    private listBlocked(number: number) {
        const now = Date.now();
        return [...this.blocked.values()].filter((entry) => {
            return entry.key.startsWith(`${number}|`) && entry.until >= now;
        });
    }

    // "Allow again" on a disconnected viewer.
    unblock(number: number, key: string) {
        if (key.startsWith(`${number}|`)) {
            this.blocked.delete(key);
        }
    }

    private checkIsAdmitted(network: VirtualDisplayNetwork) {
        if (network === 'this-computer') {
            return true;
        }
        if (!this.mirror.isVirtualDisplayShareEnabled) {
            return false;
        }
        return network === 'local' || this.mirror.isInternetEnabled;
    }

    get accessMode() {
        return readVirtualDisplayAccessMode(
            this.settings.getClientSetting(VIRTUAL_DISPLAY_ACCESS_KEY),
        );
    }

    // This computer and its own networks come in at once; the internet waits
    // for the operator's Allow or gives the connection code.
    private getAccess(network: VirtualDisplayNetwork) {
        return network === 'internet' ? this.accessMode : 'open';
    }

    // The access option or the code changed, or the internet closed: everyone
    // let in from the internet is asked again.
    private revokeInternetGrants() {
        this.webViewers.revokeGrants();
        this.playerGrants.clear();
        this.castTokens.clear();
        for (const session of this.sessions.values()) {
            for (const viewer of [...session.viewers.values()]) {
                if (viewer.network === 'internet' && !viewer.isPreview) {
                    this.endPlayer(session, viewer.id, 403);
                }
            }
        }
    }

    private setAccessMode(value: unknown) {
        const mode = readVirtualDisplayAccessMode(value);
        if (mode === this.accessMode) {
            return;
        }
        this.settings.setClientSetting(VIRTUAL_DISPLAY_ACCESS_KEY, mode);
        this.revokeInternetGrants();
    }

    private setCode(value: unknown) {
        if (typeof value !== 'string' || !value.trim()) {
            return;
        }
        this.settings.setSecureSetting(VIRTUAL_DISPLAY_CODE_KEY, value.trim());
        this.revokeInternetGrants();
    }

    // A player waiting or watching: ended, or -- waiting -- answered with
    // `status`.
    private endPlayer(session: SessionType, id: string, status: number) {
        const waiting = session.waitingPlayers.get(id);
        if (waiting === undefined) {
            if (!this.endHlsPlayer(session, id)) {
                session.fanout.removeClient(id);
            }
            return;
        }
        clearTimeout(waiting.timer);
        session.waitingPlayers.delete(id);
        if (!waiting.res.headersSent) {
            waiting.res.writeHead(status, { 'Cache-Control': 'no-store' });
        }
        waiting.res.end();
        this.onViewerGone(session, id);
    }

    private startPlayer(
        session: SessionType,
        id: string,
        res: http.ServerResponse,
    ) {
        clearTimeout(session.releaseTimer);
        session.fanout.addClient(id, res);
        this.scheduleState();
        return this.startCompositor(session);
    }

    // The token a browser's cast hands its TV (see `castTokens`), the same
    // one each time it asks while it lasts.
    issueCastToken(number: number, viewerId: string) {
        const now = Date.now();
        for (const [token, entry] of this.castTokens) {
            if (entry.until < now) {
                this.castTokens.delete(token);
            } else if (entry.number === number && entry.viewerId === viewerId) {
                return token;
            }
        }
        if (this.castTokens.size >= MAX_CAST_TOKENS) {
            this.castTokens.delete(this.castTokens.keys().next().value!);
        }
        const token = randomBytes(18).toString('hex');
        this.castTokens.set(token, {
            number,
            viewerId,
            until: now + CAST_TOKEN_MILLISECOND,
        });
        return token;
    }

    private checkCastToken(number: number, token: string | null) {
        const entry = token === null ? undefined : this.castTokens.get(token);
        return (
            entry !== undefined &&
            entry.number === number &&
            entry.until >= Date.now()
        );
    }

    private revokeCastTokens(number: number, viewerId?: string) {
        for (const [token, entry] of this.castTokens) {
            if (
                entry.number === number &&
                (viewerId === undefined || entry.viewerId === viewerId)
            ) {
                this.castTokens.delete(token);
            }
        }
    }

    // The operator's Allow for a browser or a media player from the internet.
    async allow(number: number, clientId: string) {
        // A browser the operator disconnected that asked to come back: its
        // block goes first, or its screens would be refused once let in.
        if (this.webViewers.checkIsWaitingForApproval(clientId, number)) {
            this.blocked.delete(this.toBlockKey(number, 'web', clientId));
            this.webViewers.allow(clientId, number);
            return;
        }
        const session = this.sessions.get(number);
        const waiting = session?.waitingPlayers.get(clientId);
        const viewer = session?.viewers.get(clientId);
        if (
            session === undefined ||
            waiting === undefined ||
            viewer === undefined
        ) {
            return;
        }
        clearTimeout(waiting.timer);
        session.waitingPlayers.delete(clientId);
        if (this.playerGrants.size >= MAX_PLAYER_GRANTS) {
            this.playerGrants.delete(this.playerGrants.values().next().value!);
        }
        this.playerGrants.add(`${number}|${viewer.address}`);
        viewer.waiting = null;
        if (waiting.res.writableEnded || waiting.res.destroyed) {
            this.onViewerGone(session, clientId);
            return;
        }
        if (waiting.isHls) {
            await this.startHlsPlayer(session, clientId, waiting.res);
        } else {
            await this.startPlayer(session, clientId, waiting.res);
        }
    }

    // `/vd/<number>/video`: who may watch, then a seat in the fan-out.
    async route(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        url: URL,
        network: VirtualDisplayNetwork,
    ) {
        const target = parseVirtualDisplayPath(url.pathname);
        const record = target === null ? null : this.getRecord(target.number);
        if (
            target === null ||
            record === null ||
            target.kind === 'ws' ||
            !this.checkIsAdmitted(network)
        ) {
            res.writeHead(404).end();
            return;
        }
        if (target.kind === 'page') {
            if (!url.pathname.endsWith('/')) {
                res.writeHead(301, { Location: `${url.pathname}/` }).end();
                return;
            }
            await this.mirror.serveAppFile(
                req,
                res,
                new URL('/virtual-display-viewer.html', url),
            );
            return;
        }
        const address = toMirrorPlainAddress(readRequestSender(req).address);
        if (target.kind === 'hls-file') {
            this.serveHlsFile(req, res, record.number, target, address);
            return;
        }
        // An iPhone, an iPad or Safari cannot play an endless MP4: the same
        // address answers it with HLS, so every link and QR code works there.
        const isHls =
            target.kind === 'hls' ||
            checkIsHlsOnlyUserAgent(String(req.headers['user-agent'] ?? ''));
        const isPreview =
            network === 'this-computer' &&
            url.searchParams.get('preview') === '1';
        if (
            !isPreview &&
            this.checkIsBlocked(record.number, 'video', address)
        ) {
            res.writeHead(403).end();
            return;
        }
        // From the internet a media player is let in after the operator's
        // Allow, or with the connection code as its password: players ask
        // for one when answered 401, and take `http://name:code@host/...`.
        // A TV a let-in browser cast to carries that browser's token.
        const access =
            isPreview ||
            this.checkCastToken(record.number, url.searchParams.get('cast'))
                ? 'open'
                : this.getAccess(network);
        let isWaiting =
            access !== 'open' &&
            !this.playerGrants.has(`${record.number}|${address}`);
        if (isWaiting && access === 'code') {
            const supplied = readBasicAuthPassword(req.headers.authorization);
            const result =
                supplied === null
                    ? this.mirror.checkIsSenderLockedOut(address)
                        ? 'locked'
                        : 'missing'
                    : this.mirror.checkSenderCode(
                          address,
                          this.settings.getSecureSetting(
                              VIRTUAL_DISPLAY_CODE_KEY,
                          ),
                          supplied,
                      );
            if (result === 'locked') {
                res.writeHead(429, {
                    'Retry-After': '600',
                    'Cache-Control': 'no-store',
                }).end();
                return;
            }
            if (result !== 'ok') {
                res.writeHead(401, {
                    'WWW-Authenticate':
                        'Basic realm="Open Worship", charset="UTF-8"',
                    'Cache-Control': 'no-store',
                }).end();
                return;
            }
            isWaiting = false;
        }
        const session = this.ensureSession(record.number);
        const others = [...session.viewers.values()].filter((viewer) => {
            return !viewer.isPreview;
        });
        if (
            !isPreview &&
            (others.length >= MAX_VIEWERS ||
                (network !== 'this-computer' &&
                    others.filter((viewer) => viewer.address === address)
                        .length >= MAX_VIEWERS_PER_ADDRESS))
        ) {
            res.writeHead(503, { 'Cache-Control': 'no-store' }).end();
            return;
        }
        // A DLNA TV asks how the stream may be played, and for it as a stream.
        if (!isHls && req.headers['getcontentfeatures.dlna.org'] === '1') {
            res.setHeader('contentFeatures.dlna.org', DLNA_CONTENT_FEATURES);
        }
        if (!isHls && req.headers['transfermode.dlna.org'] !== undefined) {
            res.setHeader('transferMode.dlna.org', 'Streaming');
        }
        if (req.method === 'HEAD') {
            res.writeHead(200, {
                'Content-Type': isHls ? HLS_PLAYLIST_TYPE : 'video/mp4',
                'Cache-Control': 'no-store',
            }).end();
            return;
        }
        const id = randomUUID();
        session.viewers.set(id, {
            id,
            kind: 'video',
            address,
            network,
            userAgent: String(req.headers['user-agent'] ?? '').slice(0, 120),
            since: Date.now(),
            isPreview,
            isInteractive: false,
            waiting: isWaiting ? 'approval' : null,
        });
        if (isWaiting) {
            // Held, sent nothing, until the operator's Allow (`allow`).
            const timer = setTimeout(() => {
                this.endPlayer(session, id, 403);
            }, PLAYER_WAIT_MILLISECOND);
            session.waitingPlayers.set(id, { res, timer, isHls });
            res.on('close', () => {
                if (session.waitingPlayers.get(id)?.res === res) {
                    clearTimeout(timer);
                    session.waitingPlayers.delete(id);
                    this.onViewerGone(session, id);
                }
            });
            this.scheduleState();
            return;
        }
        if (isHls) {
            await this.startHlsPlayer(session, id, res);
        } else {
            await this.startPlayer(session, id, res);
        }
    }

    // -- HLS ------------------------------------------------------------------

    // The display's segmenter, fed by its fan-out, while an HLS player
    // watches; the sweep lets go of players gone silent.
    private ensureHls(session: SessionType) {
        if (session.hls !== null) {
            return session.hls;
        }
        const segmenter = new HlsSegmenter(() => {
            this.requestKeyframe(session);
        });
        const hls: HlsStateType = {
            segmenter,
            players: new Map(),
            waiters: new Set(),
            sweepTimer: setInterval(() => {
                this.sweepHls(session);
            }, HLS_SWEEP_MILLISECOND),
        };
        segmenter.onChange = () => {
            for (const waiter of [...hls.waiters]) {
                waiter();
            }
        };
        session.hls = hls;
        session.fanout.setSink({
            onInit: (init) => segmenter.setInit(init),
            onFragment: (fragment, isKey, videoTime) => {
                segmenter.addFragment(fragment, isKey, videoTime);
            },
            onReset: () => segmenter.reset(),
        });
        return hls;
    }

    // No HLS player left: the segments go with the segmenter.
    private dropHls(session: SessionType) {
        const hls = session.hls;
        if (hls === null) {
            return;
        }
        session.hls = null;
        clearInterval(hls.sweepTimer);
        session.fanout.setSink(null);
        hls.players.clear();
        for (const waiter of [...hls.waiters]) {
            waiter();
        }
    }

    private sweepHls(session: SessionType) {
        const hls = session.hls;
        if (hls === null) {
            return;
        }
        const now = Date.now();
        for (const [token, player] of [...hls.players]) {
            if (now - player.lastSeen > HLS_IDLE_MILLISECOND) {
                hls.players.delete(token);
                this.onViewerGone(session, player.id);
            }
        }
        if (hls.players.size === 0) {
            this.dropHls(session);
        }
    }

    // A viewer that is an HLS player, ended: false when it is not one.
    private endHlsPlayer(session: SessionType, id: string) {
        const hls = session.hls;
        if (hls === null) {
            return false;
        }
        for (const [token, player] of hls.players) {
            if (player.id === id) {
                hls.players.delete(token);
                if (hls.players.size === 0) {
                    this.dropHls(session);
                }
                this.onViewerGone(session, id);
                return true;
            }
        }
        return false;
    }

    // Answers once `isReady` holds (checked again on every new init and
    // segment), or 503 after a while; nothing if the player went away.
    private whenHls(
        session: SessionType,
        res: http.ServerResponse,
        isReady: (hls: HlsStateType) => boolean,
        answer: (hls: HlsStateType) => void,
    ) {
        const hls = session.hls;
        if (hls === null) {
            res.writeHead(404, { 'Cache-Control': 'no-store' }).end();
            return;
        }
        if (isReady(hls)) {
            answer(hls);
            return;
        }
        const finish = () => {
            clearTimeout(timer);
            hls.waiters.delete(check);
            res.off('close', finish);
        };
        const check = () => {
            if (session.hls !== hls) {
                finish();
                if (!res.headersSent) {
                    res.writeHead(404, { 'Cache-Control': 'no-store' }).end();
                }
            } else if (isReady(hls)) {
                finish();
                answer(hls);
            }
        };
        const timer = setTimeout(() => {
            finish();
            if (!res.headersSent) {
                res.writeHead(503, { 'Cache-Control': 'no-store' }).end();
            }
        }, HLS_WAIT_MILLISECOND);
        hls.waiters.add(check);
        res.on('close', finish);
    }

    // A player let in: a token of its own, the compositor up, and -- once the
    // stream has started and its codecs are known -- the master playlist.
    private async startHlsPlayer(
        session: SessionType,
        id: string,
        res: http.ServerResponse,
    ) {
        const record = this.getRecord(session.number);
        const viewer = session.viewers.get(id);
        if (record === null || viewer === undefined) {
            res.writeHead(404, { 'Cache-Control': 'no-store' }).end();
            return;
        }
        clearTimeout(session.releaseTimer);
        const hls = this.ensureHls(session);
        const token = randomBytes(16).toString('hex');
        hls.players.set(token, {
            id,
            address: viewer.address,
            lastSeen: Date.now(),
        });
        this.scheduleState();
        this.whenHls(
            session,
            res,
            (current) => current.segmenter.codecs !== null,
            (current) => {
                writeHlsResponse(
                    res,
                    HLS_PLAYLIST_TYPE,
                    toHlsMasterPlaylist({
                        codecs: current.segmenter.codecs!,
                        width: record.width,
                        height: record.height,
                        bandwidth:
                            toVirtualDisplayBitrate(
                                record.width,
                                record.height,
                                FRAME_RATE,
                            ) * 1.5,
                        variant: `hls/${token}/index.m3u8`,
                    }),
                );
            },
        );
        await this.startCompositor(session);
    }

    // A file of one HLS player's: only under its token, from the address it
    // was let in from, while it is not blocked.
    private serveHlsFile(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        number: number,
        { token, file }: { token: string; file: string },
        address: string,
    ) {
        const session = this.sessions.get(number);
        const player = session?.hls?.players.get(token);
        if (
            session === undefined ||
            player === undefined ||
            player.address !== address ||
            this.checkIsBlocked(number, 'video', address)
        ) {
            res.writeHead(404, { 'Cache-Control': 'no-store' }).end();
            return;
        }
        player.lastSeen = Date.now();
        const isHead = req.method === 'HEAD';
        if (file === 'index.m3u8') {
            this.whenHls(
                session,
                res,
                (hls) => hls.segmenter.segmentCount >= HLS_READY_SEGMENTS,
                (hls) => {
                    writeHlsResponse(
                        res,
                        HLS_PLAYLIST_TYPE,
                        hls.segmenter.toPlaylist(),
                        isHead,
                    );
                },
            );
            return;
        }
        const segmenter = session.hls!.segmenter;
        const index = Number(/\d+/.exec(file)![0]);
        const data = file.startsWith('init-')
            ? segmenter.getInit(index)
            : segmenter.getSegment(index);
        if (data === null) {
            res.writeHead(404, { 'Cache-Control': 'no-store' }).end();
            return;
        }
        writeHlsResponse(res, 'video/mp4', data, isHead);
    }

    private onViewerGone(session: SessionType, id: string) {
        session.viewers.delete(id);
        this.scheduleState();
        if (session.viewers.size === 0) {
            clearTimeout(session.releaseTimer);
            session.releaseTimer = setTimeout(() => {
                if (session.viewers.size === 0) {
                    this.stopCompositor(session);
                }
            }, RELEASE_DELAY_MILLISECOND);
        }
    }

    disconnect(number: number, clientId: string) {
        const webViewer = this.webViewers.disconnect(clientId);
        if (webViewer !== null) {
            this.revokeCastTokens(number, webViewer.id);
            if (!webViewer.isPreview) {
                this.block(number, 'web', webViewer.id, webViewer.address);
            }
            return;
        }
        const session = this.sessions.get(number);
        const viewer = session?.viewers.get(clientId);
        if (session === undefined || viewer === undefined) {
            return;
        }
        if (!viewer.isPreview) {
            this.block(number, 'video', viewer.address, viewer.address);
        }
        this.endPlayer(session, clientId, 403);
    }

    // Who may reach the server changed: a viewer no longer let in is ended.
    onNetworkChanged() {
        this.webViewers.closeNotAdmitted();
        for (const session of this.sessions.values()) {
            for (const viewer of [...session.viewers.values()]) {
                if (!this.checkIsAdmitted(viewer.network)) {
                    this.endPlayer(session, viewer.id, 403);
                }
            }
        }
        // Closed to the internet: whoever was let in from it is asked again
        // the next time it opens.
        if (!this.checkIsAdmitted('internet')) {
            this.revokeInternetGrants();
        }
        // A TV pulls the stream over this network: it cannot any more.
        if (!this.mirror.isVirtualDisplayShareEnabled) {
            this.stopCasts();
        }
        // A browser here casts the address on this network, or none now.
        for (const record of this.records) {
            this.webViewers.sendLayout(record.number);
        }
        this.scheduleState();
    }

    // -- State ------------------------------------------------------------------

    state(): VirtualDisplayState {
        const port = this.mirror.port;
        const shareEnabled = this.mirror.isVirtualDisplayShareEnabled;
        const internetEnabled = this.mirror.isInternetEnabled;
        return {
            available: port > 0 && this.mirror.error === null,
            error: this.mirror.error,
            port,
            shareEnabled,
            internetEnabled,
            router: this.mirror.routerState,
            publicPort: this.mirror.publicPort,
            access: this.accessMode,
            hasCode: !!this.settings.getSecureSetting(VIRTUAL_DISPLAY_CODE_KEY),
            tunnelEnabled: this.mirror.isTunnelEnabled,
            tunnel: this.mirror.tunnelState,
            httpsEnabled: this.mirror.isHttpsEnabled,
            publicAddress: this.mirror.publicAddress,
            customPort: this.mirror.customPort,
            castTargets: this.castTargets.map(({ id, name, kind }) => {
                return { id, name, kind };
            }),
            isCastSearching: this.isCastSearching,
            addresses: [
                { host: '127.0.0.1', port, kind: 'this-computer' },
                ...(shareEnabled
                    ? this.mirror.addressList(internetEnabled)
                    : []),
            ],
            displays: this.records.map((record) => {
                const session = this.sessions.get(record.number);
                const { wallpaper } = record;
                return {
                    ...record,
                    displayId: toVirtualDisplayId(record.number),
                    screenIds: this.screensOn(record.number).map(
                        (controller) => controller.screenId,
                    ),
                    stream: session?.stream ?? 'idle',
                    error: session?.error ?? null,
                    mimeType: session?.mimeType ?? null,
                    isWallpaperMissing:
                        (wallpaper.kind === 'image' ||
                            wallpaper.kind === 'video') &&
                        !fs.existsSync(wallpaper.filePath),
                    isMp4MicOn: this.mp4Mics.has(record.number),
                    clients: [
                        ...this.webViewers
                            .listOf(record.number)
                            .map((client) => {
                                return client.isPreview ||
                                    client.waiting !== null
                                    ? client
                                    : {
                                          ...client,
                                          intercom: this.mirror.intercomStateOf(
                                              `viewer:${client.id}`,
                                          ),
                                          camera:
                                              this.viewerCameras.labelOf(
                                                  client.id,
                                              ) ?? undefined,
                                      };
                            }),
                        ...(session?.viewers.values() ?? []),
                    ],
                    blocked: this.listBlocked(record.number),
                    casts: this.listCasts(record.number),
                };
            }),
        };
    }

    private scheduleState() {
        if (this.stateTimer !== undefined) {
            return;
        }
        this.stateTimer = setTimeout(() => {
            this.stateTimer = undefined;
            this.mirror.broadcast('vd:state', this.state());
            // A page with its cast list open sees the same change.
            this.webViewers.sendCastStates();
        }, STATE_DELAY_MILLISECOND);
    }

    // -- IPC ------------------------------------------------------------------

    private async runCommand(data: Record<string, unknown>) {
        if (data.action === 'create') {
            this.create(data);
        } else if (data.action === 'update') {
            this.update(data);
        } else if (data.action === 'delete') {
            this.delete(Number(data.number));
        } else if (data.action === 'share') {
            await this.mirror.setVirtualDisplayShareEnabled(
                data.enabled === true,
            );
            this.onNetworkChanged();
        } else if (data.action === 'https') {
            await this.mirror.setHttpsEnabled(data.enabled === true);
        } else if (data.action === 'disconnect') {
            this.disconnect(Number(data.number), String(data.clientId));
        } else if (data.action === 'unblock') {
            this.unblock(Number(data.number), String(data.key));
        } else if (data.action === 'interactive') {
            this.webViewers.setInteractive(
                String(data.clientId),
                Number(data.number),
                data.enabled === true,
            );
        } else if (data.action === 'mp4-mic') {
            await this.setMp4Mic(Number(data.number), data.enabled === true);
        } else if (data.action === 'allow') {
            await this.allow(Number(data.number), String(data.clientId));
        } else if (data.action === 'access') {
            this.setAccessMode(data.mode);
        } else if (data.action === 'code') {
            this.setCode(data.code);
        } else if (data.action === 'labels') {
            this.setViewerLabels(data.labels);
        } else if (data.action === 'cast-search') {
            await this.searchCastTargets();
        } else if (data.action === 'cast-start') {
            await this.startCast(Number(data.number), String(data.targetId));
        } else if (data.action === 'cast-stop') {
            this.stopCast(Number(data.number), String(data.targetId));
        }
        return this.state();
    }

    // A window here showing a viewer's camera, or done with it.
    private watchedWindows = new Set<number>();
    private watchViewerCamera(
        contents: WebContents,
        cameraId: unknown,
        isWatching: boolean,
    ) {
        if (typeof cameraId !== 'string') {
            return;
        }
        if (isWatching && !this.watchedWindows.has(contents.id)) {
            const id = contents.id;
            this.watchedWindows.add(id);
            contents.once('destroyed', () => {
                this.watchedWindows.delete(id);
                this.viewerCameras.forgetWatcher(`window:${id}`);
            });
        }
        this.viewerCameras.watch(`window:${contents.id}`, cameraId, isWatching);
    }

    initIpc() {
        ipcMain.on('vd:camera-watch', (event, data) => {
            if (this.mirror.trusted(event.sender)) {
                this.watchViewerCamera(
                    event.sender,
                    data?.cameraId,
                    data?.isWatching === true,
                );
            }
        });
        ipcMain.on('vd:state', (event) => {
            event.returnValue = this.mirror.trusted(event.sender)
                ? this.state()
                : null;
        });
        ipcMain.on('vd:command', (event, data) => {
            if (!this.mirror.trusted(event.sender) || !data) {
                return;
            }
            const reply = (value: unknown) => {
                if (
                    typeof data.replyEventName === 'string' &&
                    !event.sender.isDestroyed()
                ) {
                    event.sender.send(data.replyEventName, value);
                }
            };
            this.runCommand(data).then(reply, (error) => {
                reply(
                    error instanceof Error ? error : new Error(String(error)),
                );
            });
        });
        ipcMain.on('vd:compositor-ready', (event) => {
            const session = this.sessionOfHost(event.sender);
            if (session === null) {
                return;
            }
            session.isReady = true;
            this.sendConfig(session.number);
            // A compositor started again takes the microphone back up.
            if (this.mp4Mics.has(session.number)) {
                event.sender.send('vd:compositor', { type: 'mic', isOn: true });
            }
            const record = this.getRecord(session.number);
            if (record !== null) {
                event.sender.send('vd:compositor', {
                    type: 'encode',
                    options: {
                        generation: session.generation,
                        width: record.width,
                        height: record.height,
                        frameRate: FRAME_RATE,
                    },
                });
            }
        });
        ipcMain.on('vd:guest', (event, data) => {
            const session = this.sessionOfHost(event.sender);
            const controller = this.screens.get(Number(data?.screenId));
            const guest = webContents.fromId(Number(data?.webContentsId));
            if (
                session === null ||
                controller === undefined ||
                controller.displayNumber !== session.number ||
                guest === undefined ||
                guest.hostWebContents !== event.sender
            ) {
                event.returnValue = false;
                return;
            }
            // Its sound belongs to the stream: muting the page silences the
            // speakers and still lets its audio be captured.
            guest.setAudioMuted(true);
            guest.setWindowOpenHandler(() => ({ action: 'deny' }));
            logErrors(guest, `virtual display screen ${controller.screenId}`);
            const src = this.toScreenSrc(controller.screenId);
            guest.on('will-navigate', (navigateEvent, url) => {
                if (!url.startsWith(src)) {
                    navigateEvent.preventDefault();
                }
            });
            controller.guest = guest;
            guest.once('destroyed', () => {
                if (controller.guest === guest) {
                    controller.guest = null;
                }
            });
            event.returnValue = true;
        });
        ipcMain.on('vd:audio-target', (event, screenId) => {
            const session = this.sessionOfHost(event.sender);
            const controller = this.screens.get(Number(screenId));
            if (
                session === null ||
                controller === undefined ||
                controller.displayNumber !== session.number ||
                !controller.isLive
            ) {
                event.returnValue = false;
                return;
            }
            setVirtualDisplayAudioTarget(
                event.sender,
                controller.guest!.mainFrame,
            );
            event.returnValue = true;
        });
        ipcMain.on('vd:chunk', (event, data) => {
            const session = this.sessionOfHost(event.sender);
            if (
                session === null ||
                data?.generation !== session.generation ||
                !(data.data instanceof Uint8Array)
            ) {
                return;
            }
            // A box that cannot be read ends this stream, not the process.
            try {
                session.fanout.push(data.data);
            } catch (error) {
                console.error('Virtual display: unreadable video', error);
                this.failSession(session, 'The virtual display stopped');
            }
        });
        ipcMain.on('vd:encoder', (event, data) => {
            const session = this.sessionOfHost(event.sender);
            if (session === null || data?.generation !== session.generation) {
                return;
            }
            if (data.state === 'live') {
                session.stream = 'live';
                session.error = null;
                session.mimeType =
                    typeof data.mimeType === 'string'
                        ? data.mimeType.slice(0, 120)
                        : null;
                this.scheduleState();
            } else if (data.state === 'error') {
                this.failSession(
                    session,
                    typeof data.error === 'string'
                        ? data.error.slice(0, 300)
                        : 'The virtual display stopped',
                );
            }
        });
    }

    stop() {
        this.stopCasts();
        this.webViewers.closeAll();
        for (const session of this.sessions.values()) {
            session.fanout.reset();
            this.endHlsPlayers(session);
            this.stopCompositor(session);
        }
    }
}

let service: VirtualDisplayService | undefined;
export function getVirtualDisplays() {
    return service;
}
export function initVirtualDisplays(mirror: ScreenMirrorService | undefined) {
    if (mirror === undefined) {
        return;
    }
    service = new VirtualDisplayService(mirror);
    service.initIpc();
    const instance = service;
    mirror.setVirtualDisplayHooks({
        route: (req, res, url, network) => {
            return instance.route(req, res, url, network);
        },
        upgrade: (req, socket, head, network) => {
            instance.upgrade(req, socket, head, network);
        },
        admits: (network) => instance.checkIsViewerAdmitted(network),
        onNetworkChanged: () => {
            instance.onNetworkChanged();
        },
    });
}
