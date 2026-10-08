// A browser watching a virtual display (`/vd/<n>/`): the display's wallpaper
// with its screens stacked on it, each one the app's own screen page in an
// <iframe>, drawn at the display's size and scaled to this window. Nothing is
// drawn by the computer running the app; it only sends the screens' messages.
//
// A plain page: no app provider, no React. It can make the device stay awake
// and go full screen, and asks for a tap before it plays sound (browsers
// refuse sound until somebody has touched the page).
import type { VirtualDisplayLayout } from '../electron/virtualDisplayProtocol';
import { KEEP_AWAKE_VIDEO_DATA_URL } from './virtual-display/keepAwakeVideo';

const IDLE_MILLISECOND = 3000;
// The operator disconnected this browser (`virtualDisplayWebViewers.ts`).
const DISCONNECTED_CLOSE_CODE = 4001;
const RECONNECT_MIN_MILLISECOND = 2000;
const RECONNECT_MAX_MILLISECOND = 10000;

const number = Number(globalThis.location.pathname.split('/')[2]);
const isPreview =
    new URLSearchParams(globalThis.location.search).get('preview') === '1';
// Groups this page's sockets on the server, and is who the operator lets
// interact -- kept for this tab, so a reload is still the same client.
const VIEWER_ID_KEY = 'owa-virtual-display-viewer-id';
function genViewerId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => {
        return b.toString(16).padStart(2, '0');
    }).join('');
}
function loadViewerId() {
    try {
        const stored = sessionStorage.getItem(VIEWER_ID_KEY);
        if (stored !== null && /^[0-9a-f]{24}$/.test(stored)) {
            return stored;
        }
        const created = genViewerId();
        sessionStorage.setItem(VIEWER_ID_KEY, created);
        return created;
    } catch {
        // No storage (a private window, a blocked site): one per load.
        return genViewerId();
    }
}
const viewerId = loadViewerId();

const stage = document.getElementById('stage') as HTMLDivElement;
const wallpaperLayer = document.getElementById('wallpaper') as HTMLDivElement;
const statusLine = document.getElementById('status') as HTMLDivElement;
const toolbar = document.getElementById('toolbar') as HTMLDivElement;
const soundButton = document.getElementById(
    'sound-button',
) as HTMLButtonElement;
const fullscreenButton = document.getElementById(
    'fullscreen-button',
) as HTMLButtonElement;

const frames = new Map<number, HTMLIFrameElement>();
let layout: VirtualDisplayLayout | null = null;
let wallpaperKey = '';
let isSoundOn = false;
let reconnectDelay = RECONNECT_MIN_MILLISECOND;

function label(key: string, fallback: string) {
    return layout?.labels?.[key] || fallback;
}

// The stage keeps the display's own size; only a transform fits it here, so
// a window resized never resizes (and so never reloads) a screen page.
function fit() {
    if (layout === null) {
        return;
    }
    const scale = Math.min(
        globalThis.innerWidth / layout.width,
        globalThis.innerHeight / layout.height,
    );
    const left = (globalThis.innerWidth - layout.width * scale) / 2;
    const top = (globalThis.innerHeight - layout.height * scale) / 2;
    stage.style.width = `${layout.width}px`;
    stage.style.height = `${layout.height}px`;
    stage.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
}

function toScreenSrc(screenId: number) {
    return (
        '/vd-screen.html?' +
        new URLSearchParams({
            vd: String(number),
            screenId: String(screenId),
            viewer: viewerId,
            ...(isPreview ? { preview: '1' } : {}),
            ...(isSoundOn ? { sound: '1' } : {}),
        }).toString()
    );
}

function applyWallpaper(wallpaper: VirtualDisplayLayout['wallpaper']) {
    const key = JSON.stringify(wallpaper);
    if (key === wallpaperKey) {
        return;
    }
    wallpaperKey = key;
    for (const child of [...wallpaperLayer.children]) {
        if (child instanceof HTMLVideoElement) {
            child.pause();
            child.removeAttribute('src');
            child.load();
        }
        child.remove();
    }
    wallpaperLayer.style.backgroundColor =
        wallpaper.kind === 'color' ? wallpaper.color : '#000000';
    if (wallpaper.kind === 'image') {
        const image = document.createElement('img');
        image.alt = '';
        image.src = wallpaper.url;
        wallpaperLayer.append(image);
    } else if (wallpaper.kind === 'video') {
        const video = document.createElement('video');
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        video.src = wallpaper.url;
        wallpaperLayer.append(video);
    }
}

// Same origin, so the page can be told to load again.
function reloadFrame(frame: HTMLIFrameElement) {
    frame.contentWindow?.location.reload();
}

function removeFrame(screenId: number) {
    frames.get(screenId)?.remove();
    frames.delete(screenId);
}

function addFrame(screenId: number) {
    const frame = document.createElement('iframe');
    frame.setAttribute('allow', 'autoplay; fullscreen');
    frame.src = toScreenSrc(screenId);
    frames.set(screenId, frame);
    stage.append(frame);
}

function applyLayout(next: VirtualDisplayLayout) {
    const isResized =
        layout !== null &&
        (layout.width !== next.width || layout.height !== next.height);
    layout = next;
    document.title = next.name;
    soundButton.title = label('sound', 'Turn on sound');
    soundButton.setAttribute('aria-label', soundButton.title);
    updateFullscreenButton();
    applyWallpaper(next.wallpaper);
    for (const screenId of [...frames.keys()]) {
        if (!next.screenIds.includes(screenId)) {
            removeFrame(screenId);
        }
    }
    next.screenIds.forEach((screenId, index) => {
        if (!frames.has(screenId)) {
            addFrame(screenId);
        }
        frames.get(screenId)!.style.zIndex = String(index + 1);
    });
    if (isResized) {
        // A screen page lays itself out once, at its size.
        for (const frame of frames.values()) {
            reloadFrame(frame);
        }
    }
    statusLine.hidden = true;
    fit();
}

function connect() {
    const protocol = globalThis.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(
        `${protocol}://${globalThis.location.host}/vd/${number}/ws?` +
            new URLSearchParams({
                viewer: viewerId,
                ...(isPreview ? { preview: '1' } : {}),
            }).toString(),
    );
    socket.addEventListener('open', () => {
        reconnectDelay = RECONNECT_MIN_MILLISECOND;
    });
    let refusedText: string | null = null;
    socket.addEventListener('message', (event) => {
        try {
            const packet = JSON.parse(String(event.data));
            if (packet?.type === 'layout' && packet.layout) {
                applyLayout(packet.layout);
            } else if (packet?.type === 'refused') {
                const text = packet.labels?.disconnected;
                refusedText =
                    typeof text === 'string' && text
                        ? text
                        : label(
                              'disconnected',
                              'This device was disconnected. Ask whoever runs the display to let it back in.',
                          );
            }
        } catch {
            // Not a packet of ours.
        }
    });
    socket.addEventListener('close', (event) => {
        // Its screens' sockets close with it; nothing is drawn until the
        // display answers again.
        for (const screenId of [...frames.keys()]) {
            removeFrame(screenId);
        }
        // Disconnected by the operator: say so and stop asking. A reload
        // tries again (after Allow again, it is let back in).
        if (event.code === DISCONNECTED_CLOSE_CODE) {
            statusLine.textContent =
                refusedText ??
                label(
                    'disconnected',
                    'This device was disconnected. Ask whoever runs the display to let it back in.',
                );
            statusLine.hidden = false;
            return;
        }
        statusLine.textContent = label('waiting', 'Waiting for the display');
        statusLine.hidden = false;
        setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(
            reconnectDelay * 2,
            RECONNECT_MAX_MILLISECOND,
        );
    });
}

// -- Full screen ---------------------------------------------------------------

function updateFullscreenButton() {
    const isFull = document.fullscreenElement !== null;
    fullscreenButton.hidden = !document.fullscreenEnabled;
    fullscreenButton.title = isFull
        ? label('exitFullScreen', 'Exit full screen')
        : label('fullScreen', 'Full screen');
    fullscreenButton.setAttribute('aria-label', fullscreenButton.title);
    fullscreenButton.setAttribute('aria-pressed', String(isFull));
}

function toggleFullscreen() {
    if (document.fullscreenElement !== null) {
        void document.exitFullscreen();
    } else {
        void document.documentElement.requestFullscreen().catch(() => {});
    }
}

// -- Staying awake -----------------------------------------------------------------

type WakeLockSentinelType = { release: () => Promise<void> };
let wakeLock: WakeLockSentinelType | null = null;
let keepAwakeVideo: HTMLVideoElement | null = null;

function playKeepAwakeVideo() {
    if (keepAwakeVideo === null) {
        keepAwakeVideo = document.createElement('video');
        keepAwakeVideo.id = 'keep-awake';
        keepAwakeVideo.muted = true;
        keepAwakeVideo.loop = true;
        keepAwakeVideo.playsInline = true;
        keepAwakeVideo.setAttribute('aria-hidden', 'true');
        keepAwakeVideo.src = KEEP_AWAKE_VIDEO_DATA_URL;
        document.body.append(keepAwakeVideo);
    }
    void keepAwakeVideo.play().catch(() => {});
}

async function keepAwake() {
    const wakeLockApi = (navigator as any).wakeLock;
    if (wakeLockApi && globalThis.isSecureContext) {
        try {
            wakeLock = await wakeLockApi.request('screen');
            return;
        } catch {
            // Refused (battery saver, a policy): the video does the job.
        }
    }
    playKeepAwakeVideo();
}

// -- Controls ----------------------------------------------------------------------

let idleTimer: ReturnType<typeof setTimeout> | undefined;
function wake() {
    document.body.classList.remove('is-idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        document.body.classList.add('is-idle');
    }, IDLE_MILLISECOND);
}

function main() {
    if (!Number.isInteger(number) || number < 1) {
        return;
    }
    globalThis.addEventListener('resize', fit);
    connect();
    if (isPreview) {
        // Inside the app: no controls, no sound, nothing to keep awake.
        toolbar.hidden = true;
        return;
    }
    void keepAwake();
    document.addEventListener('visibilitychange', () => {
        // A wake lock is let go whenever the page is hidden.
        if (document.visibilityState === 'visible' && wakeLock !== null) {
            void keepAwake();
        }
    });
    soundButton.hidden = false;
    soundButton.addEventListener('click', () => {
        // The tap is what lets the screens play sound: they load again now
        // that this page has been touched.
        isSoundOn = true;
        soundButton.hidden = true;
        playKeepAwakeVideoIfNeeded();
        // Loaded again as the screen's sound player (`sound=1`).
        for (const [screenId, frame] of frames) {
            frame.src = toScreenSrc(screenId);
        }
    });
    fullscreenButton.addEventListener('click', toggleFullscreen);
    stage.addEventListener('dblclick', toggleFullscreen);
    document.addEventListener('fullscreenchange', updateFullscreenButton);
    for (const name of ['pointermove', 'pointerdown', 'keydown']) {
        document.addEventListener(name, wake, { passive: true });
    }
    updateFullscreenButton();
    wake();
}

// A browser that would not start the muted video on its own (iOS until a
// touch) gets it on the first tap.
function playKeepAwakeVideoIfNeeded() {
    if (isSoundOn && wakeLock === null) {
        playKeepAwakeVideo();
    }
}

main();
