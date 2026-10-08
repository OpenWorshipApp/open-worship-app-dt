import type http from 'node:http';
import type { Duplex } from 'node:stream';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import {
    BrowserWindow,
    ipcMain,
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
import { Fmp4Fanout } from './fmp4Fanout';
import { VirtualDisplayWebViewers } from './virtualDisplayWebViewers';
import VirtualScreenController from './VirtualScreenController';
import {
    checkIsVirtualDisplayHost,
    markVirtualDisplayHost,
    setVirtualDisplayAudioTarget,
} from './virtualDisplayHostRegistry';
import { readVirtualDisplayWallpaper } from './displayWallpaperHelpers';
import {
    MAX_VIRTUAL_DISPLAYS,
    VIRTUAL_DISPLAY_SETTING_KEY,
    clampResolution,
    parseVirtualDisplayPath,
    readVirtualDisplaySetting,
    sanitizeVirtualDisplayName,
    sanitizeWallpaper,
    toVirtualDisplayId,
    toVirtualDisplayNumber,
    type VirtualDisplayBlockedClient,
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
};

type SessionType = {
    number: number;
    window: BrowserWindow | null;
    isReady: boolean;
    fanout: Fmp4Fanout;
    viewers: Map<string, VirtualDisplayClient>;
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
    // A display's wallpaper is published to browser viewers under its own
    // scope, revoked when the wallpaper or the display goes.
    private wallpaperScopes = new Map<number, string>();
    private contextLoads = new Map<
        number,
        { promise: Promise<VirtualDisplayWebContext | null>; at: number }
    >();
    private viewerLabels: Record<string, string>;
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
            // A browser's camera stream rides Screen Mirror's camera relay,
            // with this computer's camera broker as the source.
            onCamera: (consumer, packet) => {
                this.mirror.routeViewerCamera(consumer, packet);
            },
            onCameraGone: (consumer) => {
                this.mirror.closeViewerCameras(consumer);
            },
            hostId: () => this.mirror.id,
        });
        this.mirror.setViewerCameraSink((consumer, packet) => {
            this.webViewers.sendCamera(consumer, packet);
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

    delete(number: number) {
        const record = this.getRecord(number);
        if (record === null) {
            return;
        }
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
                viewers: new Map(),
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
        this.stopCompositor(session);
    }

    // Ends every viewer of a display and its compositor (a new size, a
    // deletion).
    private endSession(number: number) {
        const session = this.sessions.get(number);
        if (session === undefined) {
            return;
        }
        session.fanout.reset();
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
        const address = toMirrorPlainAddress(req.socket.remoteAddress ?? '');
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
        if (req.method === 'HEAD') {
            res.writeHead(200, {
                'Content-Type': 'video/mp4',
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
        });
        clearTimeout(session.releaseTimer);
        session.fanout.addClient(id, res);
        this.scheduleState();
        await this.startCompositor(session);
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
        session.fanout.removeClient(clientId);
    }

    // Who may reach the server changed: a viewer no longer let in is ended.
    onNetworkChanged() {
        this.webViewers.closeNotAdmitted();
        for (const session of this.sessions.values()) {
            for (const viewer of [...session.viewers.values()]) {
                if (!this.checkIsAdmitted(viewer.network)) {
                    session.fanout.removeClient(viewer.id);
                }
            }
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
                    clients: [
                        ...this.webViewers.listOf(record.number),
                        ...(session?.viewers.values() ?? []),
                    ],
                    blocked: this.listBlocked(record.number),
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
        } else if (data.action === 'labels') {
            this.setViewerLabels(data.labels);
        }
        return this.state();
    }

    initIpc() {
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
        this.webViewers.closeAll();
        for (const session of this.sessions.values()) {
            session.fanout.reset();
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
