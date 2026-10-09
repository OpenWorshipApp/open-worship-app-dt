// A browser watching a virtual display (`/vd/<n>/`): the display's wallpaper
// with its screens stacked on it, each one the app's own screen page in an
// <iframe>, drawn at the display's size and scaled to this window. Nothing is
// drawn by the computer running the app; it only sends the screens' messages.
//
// A plain page: no app provider, no React. It can make the device stay awake
// and go full screen, and asks for a tap before it plays sound (browsers
// refuse sound until somebody has touched the page).
import type {
    VirtualDisplayLayout,
    VirtualDisplayViewerCastState,
} from '../electron/virtualDisplayProtocol';
import { KEEP_AWAKE_VIDEO_DATA_URL } from './virtual-display/keepAwakeVideo';
import { VD_SCREEN_STATE_MESSAGE } from './virtual-display/viewerMessages';
import {
    checkIsIntercomSupported,
    createIntercomAudio,
    type IntercomAudioType,
} from './screen-mirror/intercomAudio';

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
const statusText = document.getElementById('status-text') as HTMLSpanElement;
const retryButton = document.getElementById(
    'retry-button',
) as HTMLButtonElement;
const toolbar = document.getElementById('toolbar') as HTMLDivElement;
const fullscreenButton = document.getElementById(
    'fullscreen-button',
) as HTMLButtonElement;
const codeForm = document.getElementById('code-form') as HTMLFormElement;
const micButton = document.getElementById('mic-button') as HTMLButtonElement;
const castButton = document.getElementById('cast-button') as HTMLButtonElement;
// The page's one sound button: the display's sound and their voice.
const soundGroup = document.getElementById('sound-group') as HTMLSpanElement;
const soundButton = document.getElementById(
    'sound-button',
) as HTMLButtonElement;
const soundVolume = document.getElementById('sound-volume') as HTMLInputElement;
const shareCameraButton = document.getElementById(
    'share-camera-button',
) as HTMLButtonElement;
const toast = document.getElementById('toast') as HTMLDivElement;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

// Said for a few seconds: what could not be done, and the likely why.
function showToast(text: string) {
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.hidden = true;
    }, 5000);
}
const emptyNotice = document.getElementById('empty-notice') as HTMLDivElement;
const codeInput = document.getElementById('code-input') as HTMLInputElement;
const codeError = document.getElementById('code-error') as HTMLDivElement;

const frames = new Map<number, HTMLIFrameElement>();
// What each screen page said: true when it shows nothing at all.
const emptyScreens = new Map<number, boolean>();
let layout: VirtualDisplayLayout | null = null;
// The words sent with "waiting to be let in", before any layout came.
let accessLabels: Record<string, string> = {};
let socket: WebSocket | null = null;
let wallpaperKey = '';
let isSoundOn = false;
// Let in, on a page that may play their voice.
let isVoiceAllowed = false;
let reconnectDelay = RECONNECT_MIN_MILLISECOND;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

function label(key: string, fallback: string) {
    return layout?.labels?.[key] || accessLabels[key] || fallback;
}

// -- Talk-back -----------------------------------------------------------------
//
// This device's microphone to the person running the display, and theirs on
// this device's speaker -- each off until pressed, all off again when the
// display is lost. Only on a page that may use a microphone (https, or that
// computer itself), never in the app's own preview.

const isIntercomOffered = !isPreview && checkIsIntercomSupported();
let intercom: IntercomAudioType | null = null;

function toBase64(data: Uint8Array) {
    let text = '';
    for (const byte of data) {
        text += String.fromCharCode(byte);
    }
    return btoa(text);
}

function fromBase64(text: string) {
    return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}

function sendPacket(packet: Record<string, unknown>) {
    if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(packet));
    }
}

function getIntercom() {
    intercom ??= createIntercomAudio((data) => {
        sendPacket({ type: 'audio', data: toBase64(data) });
    });
    return intercom;
}

function setPressed(button: HTMLButtonElement, isPressed: boolean) {
    button.setAttribute('aria-pressed', String(isPressed));
}

function checkIsPressed(button: HTMLButtonElement) {
    return button.getAttribute('aria-pressed') === 'true';
}

function showIntercom(isShown: boolean) {
    castButton.hidden = !(isShown && isCastOffered);
    if (!isShown) {
        closeCastPanel();
        castState = null;
        updateCastButton();
    }
    if (isShown) {
        castButton.title = label('cast', 'Cast to a TV');
        castButton.setAttribute('aria-label', castButton.title);
    }
    micButton.hidden = !(isShown && isIntercomOffered);
    shareCameraButton.hidden = !(isShown && isCameraOffered);
    isVoiceAllowed = isShown && isIntercomOffered;
    applyVoice();
    if (isShown) {
        shareCameraButton.title = label('camera', 'Share my camera');
        shareCameraButton.setAttribute('aria-label', shareCameraButton.title);
    }
    if (isShown) {
        micButton.title = label('mic', 'Send my microphone');
        micButton.setAttribute('aria-label', micButton.title);
        soundVolume.setAttribute(
            'aria-label',
            label('voiceVolume', 'Voice volume'),
        );
    }
}

// The sound stays as it was set: it is the viewer's choice, and comes back
// with the display.
function resetIntercom() {
    stopCamera();
    intercom?.close();
    intercom = null;
    setPressed(micButton, false);
    soundButton.classList.remove('is-remote-mic');
}

async function toggleMic() {
    if (checkIsPressed(micButton)) {
        setPressed(micButton, false);
        await intercom?.setMic(false);
        sendPacket({ type: 'intercom-state', mic: false });
        return;
    }
    micButton.disabled = true;
    try {
        await getIntercom().setMic(true);
        setPressed(micButton, true);
        sendPacket({ type: 'intercom-state', mic: true });
    } catch {
        // Refused, or no microphone: it stays off, and says so.
        showToast(
            label(
                'micFailed',
                'The microphone could not be opened. Allow it for this page, or close another app using it.',
            ),
        );
    } finally {
        micButton.disabled = false;
    }
}

// -- Camera ------------------------------------------------------------------------
//
// This device's camera shared with the computer running the display, as in a
// video call: pressed, it is opened and offered; it is encoded (VP8, small,
// 15 a second) only while a window there shows it (`camera-start` until
// `camera-stop`), and frames are skipped rather than queued on a slow link.

const isCameraOffered =
    !isPreview &&
    globalThis.isSecureContext === true &&
    typeof globalThis.VideoEncoder === 'function' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function';
const CAMERA_FRAME_MILLISECOND = 1000 / 15;
const CAMERA_KEY_EVERY = 30;
const CAMERA_MAX_BUFFERED = 1024 * 1024;
type CameraType = {
    stream: MediaStream;
    video: HTMLVideoElement;
    canvas: HTMLCanvasElement | null;
    encoder: VideoEncoder | null;
    timer: ReturnType<typeof setInterval> | undefined;
    frameCount: number;
    isKeyWanted: boolean;
};
let camera: CameraType | null = null;

function stopEncoding() {
    if (camera === null) {
        return;
    }
    clearInterval(camera.timer);
    camera.timer = undefined;
    if (camera.encoder !== null && camera.encoder.state !== 'closed') {
        camera.encoder.close();
    }
    camera.encoder = null;
}

function stopCamera() {
    stopEncoding();
    if (camera !== null) {
        camera.stream.getTracks().forEach((track) => track.stop());
        camera.video.srcObject = null;
    }
    camera = null;
    setPressed(shareCameraButton, false);
}

function startEncoding() {
    const current = camera;
    if (current === null || current.timer !== undefined) {
        return;
    }
    current.isKeyWanted = true;
    current.timer = setInterval(() => {
        const { video } = current;
        if (
            camera !== current ||
            video.videoWidth === 0 ||
            (socket?.bufferedAmount ?? 0) > CAMERA_MAX_BUFFERED
        ) {
            return;
        }
        // Even sides, at most 640 wide: what the encoder takes.
        const scale = Math.min(1, 640 / video.videoWidth);
        const width = Math.max(
            2,
            Math.round((video.videoWidth * scale) / 2) * 2,
        );
        const height = Math.max(
            2,
            Math.round((video.videoHeight * scale) / 2) * 2,
        );
        if (
            current.encoder === null ||
            current.canvas === null ||
            current.canvas.width !== width ||
            current.canvas.height !== height
        ) {
            if (
                current.encoder !== null &&
                current.encoder.state !== 'closed'
            ) {
                current.encoder.close();
            }
            current.canvas ??= document.createElement('canvas');
            current.canvas.width = width;
            current.canvas.height = height;
            current.encoder = new VideoEncoder({
                output: (chunk) => {
                    const data = new Uint8Array(chunk.byteLength);
                    chunk.copyTo(data);
                    sendPacket({
                        type: 'video',
                        key: chunk.type === 'key',
                        timestamp: chunk.timestamp,
                        data: toBase64(data),
                    });
                },
                error: () => {
                    if (camera === current) {
                        stopEncoding();
                    }
                },
            });
            current.encoder.configure({
                codec: 'vp8',
                width,
                height,
                bitrate: 600000,
                framerate: 15,
                latencyMode: 'realtime',
            });
            current.isKeyWanted = true;
        }
        if (current.encoder.encodeQueueSize > 2) {
            return;
        }
        const context = current.canvas.getContext('2d');
        if (context === null) {
            return;
        }
        context.drawImage(video, 0, 0, width, height);
        const frame = new VideoFrame(current.canvas, {
            timestamp: Math.round(performance.now() * 1000),
        });
        const isKey =
            current.isKeyWanted || current.frameCount % CAMERA_KEY_EVERY === 0;
        current.isKeyWanted = false;
        current.frameCount++;
        try {
            current.encoder.encode(frame, { keyFrame: isKey });
        } finally {
            frame.close();
        }
    }, CAMERA_FRAME_MILLISECOND);
}

async function toggleCamera() {
    if (camera !== null) {
        stopCamera();
        sendPacket({ type: 'camera-state', shared: false });
        return;
    }
    shareCameraButton.disabled = true;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                width: { ideal: 640 },
                height: { ideal: 360 },
                frameRate: { ideal: 15 },
            },
        });
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        void video.play().catch(() => {});
        camera = {
            stream,
            video,
            canvas: null,
            encoder: null,
            timer: undefined,
            frameCount: 0,
            isKeyWanted: true,
        };
        setPressed(shareCameraButton, true);
        sendPacket({
            type: 'camera-state',
            shared: true,
            label: stream.getVideoTracks()[0]?.label ?? '',
        });
    } catch {
        // Refused, in use (Windows lets one app hold a camera), or none: it
        // stays off, and says so.
        showToast(
            label(
                'cameraFailed',
                'The camera could not be opened. Allow it for this page, or close another app using it.',
            ),
        );
    } finally {
        shareCameraButton.disabled = false;
    }
}

// -- Cast to a TV ---------------------------------------------------------------
//
// First, a TV on THIS DEVICE's network, through the browser's own picker
// (Google Cast in Chrome and Edge -- the Remote Playback API -- AirPlay in
// Safari): asked for by the user, _"this is for casting to a tv with same
// network of the browser not app"_. The app streams the display's MP4 to this
// page for it: the browser judges a stream it has loaded, and refused one it
// had never seen -- Chrome closed its picker at once ("The prompt was
// dismissed"), which the page took for a person closing it, so the button did
// nothing at all. Only the stream's start is read here (nothing plays on this
// device), and only while the list is open or a TV plays it. The address the
// TV is handed carries a token the app gave this browser, so a TV reached
// from the internet is not held for the operator's Allow nor asked a code;
// a page on the display's own computer hands the address on the network
// instead -- a TV cannot reach 127.0.0.1.
//
// Second, for a browser on the app's own network, the TVs the app found
// there, cast by the app itself (Google Cast, DLNA, Roku).

const castPanel = document.getElementById('cast-panel') as HTMLDivElement;
const castTitle = document.getElementById('cast-title') as HTMLElement;
const castNote = document.getElementById('cast-note') as HTMLDivElement;
const castList = document.getElementById('cast-list') as HTMLUListElement;
const castAppSection = document.getElementById('cast-app') as HTMLDivElement;
const castAppTitle = document.getElementById('cast-app-title') as HTMLElement;
const castSearchButton = document.getElementById(
    'cast-search',
) as HTMLButtonElement;
const castCloseButton = document.getElementById(
    'cast-close',
) as HTMLButtonElement;
const castPickerButton = document.getElementById(
    'cast-picker',
) as HTMLButtonElement;
const castPickerNote = document.getElementById(
    'cast-picker-note',
) as HTMLDivElement;
const CAST_KIND_NAMES: Record<string, string> = {
    'google-cast': 'Google Cast',
    dlna: 'DLNA',
    roku: 'Roku',
};
// A picker closed this fast was not closed by a hand: the browser found no
// device to offer.
const CAST_PROMPT_REFUSED_MILLISECOND = 400;

type AirPlayVideoType = HTMLVideoElement & {
    webkitShowPlaybackTargetPicker?: () => void;
    webkitCurrentPlaybackTargetIsWireless?: boolean;
};
const castVideo = document.createElement('video') as AirPlayVideoType;
castVideo.preload = 'none';
castVideo.muted = true;
castVideo.hidden = true;
const castRemote = (castVideo as { remote?: RemotePlayback }).remote;
const isAirPlayOffered =
    typeof castVideo.webkitShowPlaybackTargetPicker === 'function';
const isBrowserCastOffered = castRemote !== undefined || isAirPlayOffered;
const isCastOffered = !isPreview;
// The MP4 address for a TV, once the app gave this browser its token.
let castStreamUrl: string | null = null;
// Whether this browser says it found a device that can play the stream.
let isBrowserCastAvailable: boolean | null = null;
let browserCastWatchId: number | null = null;
let isBrowserCasting = false;
let browserCastProblem = '';
let castState: VirtualDisplayViewerCastState | null = null;

// The MP4 a TV can reach: this page's own address, or on the display's own
// computer the app's address on its network (null while nobody else may
// watch).
function toCastStreamUrl(path: string) {
    const host = globalThis.location.hostname;
    const isLoopback =
        host === '127.0.0.1' || host === 'localhost' || host === '[::1]';
    if (!isLoopback) {
        return new URL(path, globalThis.location.href).toString();
    }
    if (!layout?.castUrl) {
        return null;
    }
    const url = new URL(layout.castUrl);
    url.search = new URL(path, url).search;
    return url.toString();
}

function setCasting(isCasting: boolean) {
    isBrowserCasting = isCasting;
    updateCastButton();
    if (isCasting) {
        void castVideo.play().catch(() => {});
    } else {
        castVideo.pause();
        if (castPanel.hidden) {
            releaseCastStream();
        }
    }
}

function updateCastButton() {
    const isAppCasting =
        castState?.targets.some((target) => {
            return target.status === 'casting';
        }) ?? false;
    setPressed(castButton, isBrowserCasting || isAppCasting);
}

function toCastDetail(target: VirtualDisplayViewerCastState['targets'][0]) {
    const kind = CAST_KIND_NAMES[target.kind] ?? target.kind;
    if (target.status === 'connecting') {
        return `${kind} · ${label('castConnecting', 'Connecting')}`;
    }
    if (target.status === 'casting') {
        const behind =
            target.behind === null ? '' : ` · ${target.behind.toFixed(1)} s`;
        return `${kind} · ${label('casting', 'Casting')}${behind}`;
    }
    if (target.status === 'failed') {
        return `${kind} · ${label('castCouldNot', 'The TV could not play this display.')}`;
    }
    return kind;
}

function toBrowserCastNote() {
    if (!isBrowserCastOffered) {
        return label(
            'castNoBrowser',
            'This browser cannot cast. Try Chrome, Edge or Safari.',
        );
    }
    if (browserCastProblem) {
        return browserCastProblem;
    }
    // The browser said, having read the stream, that it knows no device to
    // play it on (its picker would close at once). Pressing still asks.
    if (isBrowserCastAvailable === false && !isBrowserCasting) {
        return label(
            'castNoBrowserTv',
            'This browser found no TV. It must be on and on the same network as this device.',
        );
    }
    if (castStreamUrl === null && castState?.isSharing === false) {
        return label(
            'castNeedsSharing',
            'Turn on “Let other devices watch” to cast to a TV.',
        );
    }
    if (isBrowserCasting) {
        return label('casting', 'Casting');
    }
    return label(
        'castBrowserHint',
        'For a TV on the same network as this device.',
    );
}

function renderCastPanel() {
    castTitle.textContent = label('cast', 'Cast to a TV');
    castCloseButton.setAttribute('aria-label', label('close', 'Close'));
    castPickerButton.textContent = label(
        'castFromBrowser',
        'Cast from this browser',
    );
    castPickerButton.disabled =
        !isBrowserCastOffered || (castStreamUrl === null && !isAirPlayOffered);
    castPickerNote.textContent = toBrowserCastNote();
    castAppTitle.textContent = label('castAppTvs', 'TVs on the app’s network');
    castSearchButton.textContent = label('castSearchAgain', 'Search again');
    const state = castState;
    // The app's own list: for a browser on the app's network, where its TVs
    // are this device's too.
    castAppSection.hidden = !(state?.isAllowed === true && state.isSharing);
    castSearchButton.disabled = state?.isSearching === true;
    castNote.textContent =
        state === null || state.isSearching
            ? label('castSearching', 'Looking for TVs…')
            : state.targets.length === 0
              ? label(
                    'castFailed',
                    'No TV was found that can play this display. It must be on and on the same network.',
                )
              : '';
    castList.replaceChildren(
        ...(castAppSection.hidden ? [] : state!.targets).map((target) => {
            const item = document.createElement('li');
            const name = document.createElement('span');
            name.className = 'cast-name';
            const title = document.createElement('span');
            title.textContent = target.name;
            title.title = target.name;
            const detail = document.createElement('span');
            detail.className = 'cast-detail';
            detail.textContent = toCastDetail(target);
            name.append(title, detail);
            const isOn =
                target.status === 'casting' || target.status === 'connecting';
            const button = document.createElement('button');
            button.type = 'button';
            button.className = isOn ? 'is-stop' : '';
            button.textContent = isOn
                ? label('castStop', 'Stop')
                : label('castStart', 'Cast');
            button.addEventListener('click', () => {
                sendPacket({
                    type: isOn ? 'cast-stop' : 'cast-start',
                    targetId: target.id,
                });
            });
            item.append(name, button);
            return item;
        }),
    );
    updateCastButton();
}

// The app's stream arrived for this browser: its start is read (preload
// `metadata`, muted, never played here), so the browser can tell whether it
// knows a device that would play it.
function loadCastStream(path: unknown) {
    if (typeof path !== 'string' || !path.startsWith(`/vd/${number}/video?`)) {
        return;
    }
    castStreamUrl = toCastStreamUrl(path);
    if (castStreamUrl === null || castPanel.hidden) {
        renderCastPanel();
        return;
    }
    if (castVideo.src !== castStreamUrl) {
        castVideo.src = castStreamUrl;
    }
    castVideo.preload = 'metadata';
    if (!castVideo.isConnected) {
        document.body.append(castVideo);
    }
    castVideo.load();
    if (castRemote !== undefined && browserCastWatchId === null) {
        castRemote
            .watchAvailability((isAvailable) => {
                isBrowserCastAvailable = isAvailable;
                if (isAvailable) {
                    browserCastProblem = '';
                }
                renderCastPanel();
            })
            .then((id) => {
                browserCastWatchId = id;
            })
            .catch(() => {
                // This browser cannot tell: its picker answers when pressed.
            });
    }
    renderCastPanel();
}

// Nothing of the stream is kept once no TV of this browser plays it: the app
// encodes the MP4 only while somebody pulls it.
function releaseCastStream() {
    if (castRemote !== undefined && browserCastWatchId !== null) {
        void castRemote
            .cancelWatchAvailability(browserCastWatchId)
            .catch(() => {});
    }
    browserCastWatchId = null;
    isBrowserCastAvailable = null;
    if (isBrowserCasting || !castVideo.hasAttribute('src')) {
        return;
    }
    castVideo.removeAttribute('src');
    castVideo.preload = 'none';
    castVideo.load();
}

function openCastPanel() {
    castState = null;
    browserCastProblem = '';
    castPanel.hidden = false;
    renderCastPanel();
    sendPacket({ type: 'cast-open' });
    if (castRemote !== undefined) {
        sendPacket({ type: 'cast-stream' });
    }
}

function closeCastPanel() {
    if (castPanel.hidden) {
        return;
    }
    castPanel.hidden = true;
    sendPacket({ type: 'cast-close' });
    releaseCastStream();
}

function receiveCastState(state: unknown) {
    if (
        state === null ||
        typeof state !== 'object' ||
        !Array.isArray((state as VirtualDisplayViewerCastState).targets)
    ) {
        return;
    }
    castState = state as VirtualDisplayViewerCastState;
    if (!castPanel.hidden) {
        renderCastPanel();
    }
    updateCastButton();
}

async function castToTv() {
    // Safari's AirPlay picker reads the element's address, loaded or not.
    if (castRemote === undefined) {
        if (castStreamUrl !== null && castVideo.src !== castStreamUrl) {
            castVideo.src = castStreamUrl;
        }
        if (!castVideo.isConnected) {
            document.body.append(castVideo);
        }
        castVideo.webkitShowPlaybackTargetPicker?.();
        return;
    }
    if (castStreamUrl === null) {
        return;
    }
    // Each press is asked afresh: the last one's "found no TV" is old news.
    browserCastProblem = '';
    const startedAt = Date.now();
    try {
        await castRemote.prompt();
    } catch (error) {
        // Closed by a hand: nothing to say. Closed before anyone could, or
        // any other refusal: the browser found no TV for this stream.
        const isClosedByHand =
            error instanceof DOMException &&
            error.name === 'NotAllowedError' &&
            Date.now() - startedAt >= CAST_PROMPT_REFUSED_MILLISECOND;
        if (!isClosedByHand) {
            browserCastProblem = label(
                'castNoBrowserTv',
                'This browser found no TV. It must be on and on the same network as this device.',
            );
        }
    }
    renderCastPanel();
}

// Their voice plays while the sound is on and this page was let in.
function applyVoice() {
    const isOn = isSoundOn && isVoiceAllowed;
    soundVolume.hidden = !isOn;
    if (isOn) {
        getIntercom().setSpeaker('host', Number(soundVolume.value) / 100);
    } else {
        intercom?.setSpeaker('host', null);
    }
}

function updateSoundButton() {
    setPressed(soundButton, isSoundOn);
    soundButton.title = isSoundOn
        ? label('soundOff', 'Turn off sound')
        : label('sound', 'Turn on sound');
    soundButton.setAttribute('aria-label', soundButton.title);
}

// The one sound button. The tap is also what lets the screens play sound:
// they load again as the display's sound player (`sound=1`), or no longer.
function toggleSound() {
    isSoundOn = !isSoundOn;
    updateSoundButton();
    playKeepAwakeVideoIfNeeded();
    for (const [screenId, frame] of frames) {
        frame.src = toScreenSrc(screenId);
    }
    applyVoice();
}

// Nothing on the display: no screen on it, or every screen on it said it
// shows nothing. A screen not heard from yet counts as showing something, so
// the notice does not flash while the pages load.
function updateEmptyNotice() {
    const isEmpty =
        !isPreview &&
        layout !== null &&
        statusLine.hidden &&
        codeForm.hidden &&
        layout.screenIds.every((screenId) => {
            return emptyScreens.get(screenId) === true;
        });
    emptyNotice.firstElementChild!.textContent = label(
        'empty',
        'Nothing is showing on this display yet.',
    );
    emptyNotice.hidden = !isEmpty;
}

// What the page says over the stage, with Retry while it has lost the
// display.
function showStatus(text: string, isRetryShown: boolean) {
    emptyNotice.hidden = true;
    statusText.textContent = text;
    retryButton.textContent = label('retry', 'Retry');
    retryButton.hidden = !isRetryShown;
    retryButton.disabled = false;
    statusLine.hidden = false;
}

// Tries at once rather than at the next automatic try -- and, after a
// disconnect or too many wrong codes, is the way back without reloading.
function retryNow() {
    if (socket !== null && socket.readyState <= WebSocket.OPEN) {
        return;
    }
    clearTimeout(reconnectTimer);
    reconnectDelay = RECONNECT_MIN_MILLISECOND;
    statusText.textContent = label('waiting', 'Waiting for the display');
    retryButton.disabled = true;
    connect();
}

// From the internet the display is sent only once the person running it
// lets this device in, or once the connection code is given.
function showWaiting(packet: {
    waiting?: unknown;
    isWrong?: unknown;
    labels?: unknown;
}) {
    if (packet.labels && typeof packet.labels === 'object') {
        accessLabels = packet.labels as Record<string, string>;
    }
    if (packet.waiting === 'code') {
        statusLine.hidden = true;
        emptyNotice.hidden = true;
        (
            document.getElementById('code-label') as HTMLLabelElement
        ).textContent = label('code', 'Connection code');
        (
            document.getElementById('code-button') as HTMLButtonElement
        ).textContent = label('connect', 'Connect');
        codeError.textContent = packet.isWrong
            ? label('wrongCode', 'Connection code is incorrect')
            : '';
        codeForm.hidden = false;
        codeInput.focus();
        return;
    }
    codeForm.hidden = true;
    showStatus(label('waitingApproval', 'Waiting for host approval'), false);
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
    emptyScreens.delete(screenId);
}

// A screen page that came back as an error (a 404, the server restarting)
// has no app root: it is asked for again a few times, more slowly each time,
// instead of leaving that screen blank for good. A screen that loads asks
// nothing more; one that goes away takes its timer with it.
const FRAME_RETRIES = 3;
const FRAME_RETRY_MILLISECOND = 2000;

function addFrame(screenId: number) {
    const frame = document.createElement('iframe');
    frame.setAttribute('allow', 'autoplay; fullscreen');
    let retries = 0;
    frame.addEventListener('load', () => {
        let isScreenPage = true;
        try {
            isScreenPage =
                frame.contentDocument?.getElementById('root') !== null;
        } catch {
            // Not readable: not ours to judge.
        }
        if (isScreenPage && !isPreview) {
            listenToFrame(frame);
        }
        if (isScreenPage || retries >= FRAME_RETRIES) {
            return;
        }
        retries++;
        setTimeout(() => {
            if (frames.get(screenId) === frame) {
                frame.src = toScreenSrc(screenId);
            }
        }, FRAME_RETRY_MILLISECOND * retries);
    });
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
    updateSoundButton();
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
    updateEmptyNotice();
}

function connect() {
    const protocol = globalThis.location.protocol === 'https:' ? 'wss' : 'ws';
    const current = new WebSocket(
        `${protocol}://${globalThis.location.host}/vd/${number}/ws?` +
            new URLSearchParams({
                viewer: viewerId,
                ...(isPreview ? { preview: '1' } : {}),
            }).toString(),
    );
    socket = current;
    current.addEventListener('open', () => {
        reconnectDelay = RECONNECT_MIN_MILLISECOND;
    });
    let refusedText: string | null = null;
    current.addEventListener('message', (event) => {
        try {
            const packet = JSON.parse(String(event.data));
            if (packet?.type === 'audio' && typeof packet.data === 'string') {
                intercom?.receive('host', fromBase64(packet.data));
            } else if (packet?.type === 'camera-start') {
                startEncoding();
            } else if (packet?.type === 'camera-keyframe') {
                if (camera !== null) {
                    camera.isKeyWanted = true;
                }
            } else if (packet?.type === 'camera-stop') {
                stopEncoding();
            } else if (packet?.type === 'cast') {
                receiveCastState(packet.state);
            } else if (packet?.type === 'cast-stream') {
                loadCastStream(packet.path);
            } else if (packet?.type === 'intercom-state') {
                soundButton.classList.toggle(
                    'is-remote-mic',
                    packet.mic === true,
                );
            } else if (packet?.type === 'layout' && packet.layout) {
                codeForm.hidden = true;
                applyLayout(packet.layout);
                showIntercom(true);
            } else if (packet?.type === 'access') {
                showIntercom(false);
                showWaiting(packet);
            } else if (packet?.type === 'refused') {
                const isLocked = packet.reason === 'locked';
                const text = isLocked
                    ? packet.labels?.locked
                    : packet.labels?.disconnected;
                refusedText =
                    typeof text === 'string' && text
                        ? text
                        : isLocked
                          ? label(
                                'locked',
                                'Too many wrong codes. Try again later.',
                            )
                          : label(
                                'disconnected',
                                'This device was disconnected. Ask whoever runs the display to let it back in.',
                            );
            }
        } catch {
            // Not a packet of ours.
        }
    });
    current.addEventListener('close', (event) => {
        // A socket Retry already replaced says nothing.
        if (socket !== current) {
            return;
        }
        // Its screens' sockets close with it; nothing is drawn until the
        // display answers again. The talk-back ends with it.
        codeForm.hidden = true;
        resetIntercom();
        showIntercom(false);
        for (const screenId of [...frames.keys()]) {
            removeFrame(screenId);
        }
        // Disconnected by the operator, or locked out: say so and stop
        // asking. Retry tries again (after Allow again, it is let back in).
        if (event.code === DISCONNECTED_CLOSE_CODE) {
            showStatus(
                refusedText ??
                    label(
                        'disconnected',
                        'This device was disconnected. Ask whoever runs the display to let it back in.',
                    ),
                true,
            );
            return;
        }
        showStatus(label('waiting', 'Waiting for the display'), true);
        reconnectTimer = setTimeout(connect, reconnectDelay);
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

type OrientationLockType = ScreenOrientation & {
    lock?: (orientation: string) => Promise<void>;
};

// A phone held upright gave a wide display a quarter of its screen: full
// screen also turns it the display's way where the browser allows that (an
// Android phone in full screen; elsewhere the lock is refused, and nothing
// changes).
function lockOrientation() {
    const orientation = globalThis.screen?.orientation as
        OrientationLockType | undefined;
    if (layout === null || orientation?.lock === undefined) {
        return;
    }
    orientation
        .lock(layout.width >= layout.height ? 'landscape' : 'portrait')
        .catch(() => {});
}

function toggleFullscreen() {
    if (document.fullscreenElement !== null) {
        void document.exitFullscreen();
    } else {
        void document.documentElement
            .requestFullscreen()
            .then(lockOrientation)
            .catch(() => {});
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

// The controls show while a mouse is over the page and hide the moment it
// leaves (asked for 2026-10-08); a touch or a key, with no hover to go by,
// shows them for a while. A microphone that is on always shows (CSS).
let idleTimer: ReturnType<typeof setTimeout> | undefined;
// The screen pages hide the pointer, as a projector does; while the controls
// are up it shows over them too. Marked on a change only: `showControls`
// runs on every pointer move.
let isFramesMarked = false;
function markFrameControls(frame: HTMLIFrameElement) {
    try {
        const root = frame.contentDocument?.documentElement;
        if (isFramesMarked) {
            root?.setAttribute('data-vd-controls', '1');
        } else {
            root?.removeAttribute('data-vd-controls');
        }
    } catch {
        // Not readable: it is marked again when it loads.
    }
}
function markFramesControls(isShown: boolean) {
    if (isShown === isFramesMarked) {
        return;
    }
    isFramesMarked = isShown;
    for (const frame of frames.values()) {
        markFrameControls(frame);
    }
}
function hideControls() {
    clearTimeout(idleTimer);
    document.body.classList.add('is-idle');
    markFramesControls(false);
}
function showControls(isForAWhile: boolean) {
    document.body.classList.remove('is-idle');
    markFramesControls(true);
    clearTimeout(idleTimer);
    if (isForAWhile) {
        idleTimer = setTimeout(hideControls, IDLE_MILLISECOND);
    }
}
function wake(event: Event) {
    showControls((event as PointerEvent).pointerType !== 'mouse');
}

// Leaving a screen frame is often moving onto the toolbar drawn over it, whose
// own pointermove shows the controls again: the hide waits that long first.
const FRAME_LEAVE_MILLISECOND = 150;

// The screens cover the whole picture, so a tap, a click, a mouse move, a key
// or a double-click made on it lands in a screen frame and never reaches this
// page: the controls could only be brought back from the black bars, and a
// double-click selected a word on the screen instead of going full screen.
// Same origin, so each frame is listened to once it has loaded (a frame that
// loads again is a new document and is listened to again).
function listenToFrame(frame: HTMLIFrameElement) {
    let frameDocument: Document | null;
    try {
        frameDocument = frame.contentDocument;
    } catch {
        return;
    }
    if (frameDocument === null) {
        return;
    }
    for (const name of ['pointermove', 'pointerdown', 'keydown']) {
        frameDocument.addEventListener(name, wake, { passive: true });
    }
    frameDocument.addEventListener('dblclick', toggleFullscreen);
    markFrameControls(frame);
    frameDocument.documentElement.addEventListener('mouseleave', () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(hideControls, FRAME_LEAVE_MILLISECOND);
    });
}

function main() {
    if (!Number.isInteger(number) || number < 1) {
        return;
    }
    globalThis.addEventListener('resize', fit);
    // A screen page saying whether it shows anything; only this page's own
    // frames are listened to.
    globalThis.addEventListener('message', (event) => {
        const data = event.data;
        if (
            event.origin !== globalThis.location.origin ||
            data?.type !== VD_SCREEN_STATE_MESSAGE
        ) {
            return;
        }
        const screenId = Number(data.screenId);
        const frame = frames.get(screenId);
        if (frame === undefined || frame.contentWindow !== event.source) {
            return;
        }
        emptyScreens.set(screenId, data.isEmpty === true);
        updateEmptyNotice();
    });
    retryButton.addEventListener('click', retryNow);
    micButton.addEventListener('click', () => {
        void toggleMic();
    });
    soundButton.addEventListener('click', toggleSound);
    castButton.addEventListener('click', () => {
        if (castPanel.hidden) {
            openCastPanel();
        } else {
            closeCastPanel();
        }
    });
    castCloseButton.addEventListener('click', closeCastPanel);
    castSearchButton.addEventListener('click', () => {
        sendPacket({ type: 'cast-search' });
    });
    castPickerButton.addEventListener('click', () => {
        void castToTv();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeCastPanel();
        }
    });
    castRemote?.addEventListener('connect', () => setCasting(true));
    castRemote?.addEventListener('disconnect', () => setCasting(false));
    castVideo.addEventListener(
        'webkitcurrentplaybacktargetiswirelesschanged',
        () => {
            setCasting(
                castVideo.webkitCurrentPlaybackTargetIsWireless === true,
            );
        },
    );
    soundVolume.addEventListener('input', applyVoice);
    shareCameraButton.addEventListener('click', () => {
        void toggleCamera();
    });
    codeForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (socket?.readyState === WebSocket.OPEN && codeInput.value) {
            socket.send(
                JSON.stringify({ type: 'code', code: codeInput.value }),
            );
            codeInput.value = '';
        }
    });
    connect();
    // A page left for another one is kept alive in the browser's
    // back/forward cache, socket and all: it stayed listed under Watching
    // now -- and counted toward what one address may open -- for as long as
    // the browser kept it. Leaving closes the socket (replaced first, so its
    // close asks nothing again); coming back starts the page afresh.
    globalThis.addEventListener('pagehide', (event) => {
        if (!event.persisted) {
            return;
        }
        const current = socket;
        socket = null;
        clearTimeout(reconnectTimer);
        current?.close(1000, 'Left the page');
    });
    globalThis.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            globalThis.location.reload();
        }
    });
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
    soundGroup.hidden = false;
    updateSoundButton();
    fullscreenButton.addEventListener('click', toggleFullscreen);
    stage.addEventListener('dblclick', toggleFullscreen);
    document.addEventListener('fullscreenchange', updateFullscreenButton);
    for (const name of ['pointermove', 'pointerdown', 'keydown']) {
        document.addEventListener(name, wake, { passive: true });
    }
    document.documentElement.addEventListener('mouseleave', hideControls);
    updateFullscreenButton();
    // Shown at first, so whoever opens the page sees there are controls.
    showControls(true);
}

// A browser that would not start the muted video on its own (iOS until a
// touch) gets it on the first tap.
function playKeepAwakeVideoIfNeeded() {
    if (isSoundOn && wakeLock === null) {
        playKeepAwakeVideo();
    }
}

main();
