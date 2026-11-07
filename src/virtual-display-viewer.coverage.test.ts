// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://192.168.1.5:39240/vd/2/"}

import fs from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';

// The viewer page as a phone or a laptop on the church network opens it:
// https on the LAN, a mouse, Safari's AirPlay picker instead of the Remote
// Playback API, cameras and a wake lock offered. The sibling suite runs it on
// this computer (127.0.0.1) as a phone with Chrome's picker; what only this
// device sees is here. Plain functions in the mocks: nothing for
// `mockReset` to wipe between tests.
const intercom = vi.hoisted(() => ({
    onAudio: null as null | ((data: Uint8Array) => void),
    calls: [] as unknown[][],
}));
vi.mock('./screen-mirror/intercomAudio', () => ({
    checkIsIntercomSupported: () => true,
    createIntercomAudio: (onAudio: (data: Uint8Array) => void) => {
        intercom.onAudio = onAudio;
        return {
            setMic: async (isOn: boolean) => {
                intercom.calls.push(['setMic', isOn]);
            },
            setSpeaker: (who: string, volume: number | null) => {
                intercom.calls.push(['setSpeaker', who, volume]);
            },
            receive: (who: string, data: Uint8Array) => {
                intercom.calls.push(['receive', who, data]);
            },
            close: () => {
                intercom.calls.push(['close']);
            },
        };
    },
}));

class FakeSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    static instances: FakeSocket[] = [];
    readyState = FakeSocket.CONNECTING;
    bufferedAmount = 0;
    sent: string[] = [];
    private listeners = new Map<string, ((event: any) => void)[]>();
    constructor(readonly url: string) {
        FakeSocket.instances.push(this);
    }
    addEventListener(name: string, listener: (event: any) => void) {
        this.listeners.set(name, [
            ...(this.listeners.get(name) ?? []),
            listener,
        ]);
    }
    send(text: string) {
        this.sent.push(text);
    }
    close(code = 1000, reason = '') {
        this.readyState = FakeSocket.CLOSED;
        this.emit('close', { code, reason });
    }
    private emit(name: string, event: any) {
        for (const listener of this.listeners.get(name) ?? []) {
            listener(event);
        }
    }
    open() {
        this.readyState = FakeSocket.OPEN;
        this.emit('open', {});
    }
    receive(packet: unknown) {
        this.emit('message', { data: JSON.stringify(packet) });
    }
    drop(code = 1006) {
        this.readyState = FakeSocket.CLOSED;
        this.emit('close', { code });
    }
}

// The camera encoder and its frames, as far as the page uses them.
class FakeEncoder {
    static instances: FakeEncoder[] = [];
    state = 'unconfigured';
    encodeQueueSize = 0;
    configurations: any[] = [];
    frames: Array<{ keyFrame: boolean }> = [];
    constructor(
        readonly callbacks: {
            output: (chunk: unknown) => void;
            error: (error: Error) => void;
        },
    ) {
        FakeEncoder.instances.push(this);
    }
    configure(config: unknown) {
        this.state = 'configured';
        this.configurations.push(config);
    }
    encode(_frame: unknown, options: { keyFrame: boolean }) {
        this.frames.push(options);
        this.callbacks.output({
            byteLength: 2,
            type: options.keyFrame ? 'key' : 'delta',
            timestamp: 99,
            copyTo: (bytes: Uint8Array) => bytes.set([4, 2]),
        });
    }
    close() {
        this.state = 'closed';
    }
}
class FakeFrame {
    close() {}
}

type TrackType = { label: string; stopped: number; stop: () => void };
function genTrack(label: string, deviceId: string) {
    const track = {
        label,
        stopped: 0,
        stop: () => {
            track.stopped++;
        },
        getSettings: () => ({ deviceId }),
    };
    return track;
}
function genStream(track: TrackType) {
    return { getVideoTracks: () => [track], getTracks: () => [track] };
}
function defer<T>() {
    let resolve: (value: T) => void = () => {};
    let reject: (error: unknown) => void = () => {};
    const promise = new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
}

// The browser's cameras: whatever the test says it has.
const media = {
    devices: [] as Array<{ kind: string; deviceId: string; label: string }>,
    enumerateCount: 0,
    enumerate: null as null | (() => Promise<unknown>),
    userMediaCalls: [] as any[],
    getUserMedia: async (_constraints: unknown): Promise<unknown> => {
        throw new Error('No camera');
    },
};
const mediaDevices = Object.assign(new EventTarget(), {
    getUserMedia: (constraints: unknown) => {
        media.userMediaCalls.push(constraints);
        return media.getUserMedia(constraints);
    },
    enumerateDevices: () => {
        media.enumerateCount++;
        return media.enumerate?.() ?? Promise.resolve(media.devices);
    },
});
const wakeLockCalls: string[] = [];
const mediaCalls: Array<[string, HTMLMediaElement]> = [];
const airPlayPicks: HTMLMediaElement[] = [];

const STORED_ID = 'abcdef0123456789abcdef01';
const LAYOUT = {
    number: 2,
    name: 'Lobby TV',
    width: 1920,
    height: 1080,
    wallpaper: { kind: 'none' },
    screenIds: [] as number[],
};
let pageBody = '';

function element<T extends HTMLElement>(id: string) {
    return document.getElementById(id) as T;
}
const latest = () => FakeSocket.instances.at(-1)!;
function sentOf(type: string, socket = latest()) {
    return socket.sent
        .map((text) => JSON.parse(text))
        .filter((packet) => packet.type === type);
}
async function flush() {
    for (let index = 0; index < 5; index++) {
        await vi.advanceTimersByTimeAsync(0);
    }
}
// A clean page: the display lost and found again (by Retry, at once: the
// automatic try's timer does not outlive a test), with this layout.
async function fresh(patch: Record<string, unknown> = {}) {
    if (latest().readyState !== FakeSocket.CLOSED) {
        latest().drop();
    }
    const before = FakeSocket.instances.length;
    element<HTMLButtonElement>('retry-button').click();
    expect(FakeSocket.instances).toHaveLength(before + 1);
    latest().open();
    latest().receive({ type: 'layout', layout: { ...LAYOUT, ...patch } });
    await flush();
}
function cameraRows() {
    return [...element('camera-list').querySelectorAll('li')];
}
function cameraRow(name: string) {
    return cameraRows().find((row) => row.textContent?.startsWith(name))!;
}
async function openCameraList() {
    element<HTMLButtonElement>('share-camera-button').click();
    await flush();
    expect(element('camera-panel').hidden).toBe(false);
}
function stageFrame(screenId: number) {
    return [...element('stage').querySelectorAll('iframe')].find((frame) =>
        frame.src.includes(`screenId=${screenId}`),
    )!;
}
function pointer(target: EventTarget, pointerType: string, type: string) {
    const event = new Event(type, { bubbles: true });
    Object.defineProperty(event, 'pointerType', { value: pointerType });
    target.dispatchEvent(event);
}
const isControlsShown = () => !document.body.classList.contains('is-idle');

beforeAll(async () => {
    vi.useFakeTimers();
    sessionStorage.setItem('owa-virtual-display-viewer-id', STORED_ID);
    const html = fs.readFileSync(
        path.join(process.cwd(), 'html', 'virtual-display-viewer.html'),
        'utf8',
    );
    pageBody = new DOMParser()
        .parseFromString(html, 'text/html')
        .body.innerHTML.replace(/<script[\s\S]*?<\/script>/g, '');
    document.body.innerHTML = pageBody;
    (globalThis as any).WebSocket = FakeSocket;
    // A mouse: no phone sides to offer before the cameras are named.
    (globalThis as any).matchMedia = () => ({ matches: false });
    Object.defineProperty(globalThis, 'isSecureContext', {
        configurable: true,
        value: true,
    });
    vi.stubGlobal('VideoEncoder', FakeEncoder);
    vi.stubGlobal('VideoFrame', FakeFrame);
    Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: mediaDevices,
    });
    Object.defineProperty(navigator, 'wakeLock', {
        configurable: true,
        value: {
            request: async (type: string) => {
                wakeLockCalls.push(type);
                return { release: async () => {} };
            },
        },
    });
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
        mediaCalls.push(['play', this]);
        return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function (this: HTMLMediaElement) {
        mediaCalls.push(['pause', this]);
    };
    HTMLMediaElement.prototype.load = function (this: HTMLMediaElement) {
        mediaCalls.push(['load', this]);
    };
    // Safari: AirPlay, no Remote Playback API.
    (HTMLMediaElement.prototype as any).webkitShowPlaybackTargetPicker =
        function (this: HTMLMediaElement) {
            airPlayPicks.push(this);
        };
    await import('./virtual-display-viewer');
    await flush();
});

afterEach(() => {
    vi.clearAllTimers();
});

afterAll(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete (globalThis as any).isSecureContext;
    delete (navigator as any).mediaDevices;
    delete (navigator as any).wakeLock;
    delete (HTMLMediaElement.prototype as any).webkitShowPlaybackTargetPicker;
    delete (HTMLMediaElement.prototype as any).remote;
    sessionStorage.clear();
    globalThis.history.replaceState(null, '', '/');
    document.body.innerHTML = '';
});

test('it keeps this tab’s viewer id, holds a wake lock, and draws nothing before a layout', () => {
    expect(FakeSocket.instances).toHaveLength(1);
    expect(latest().url).toBe(
        `wss://192.168.1.5:39240/vd/2/ws?viewer=${STORED_ID}`,
    );
    // The wake lock held: no looping video is needed to stay awake.
    expect(wakeLockCalls).toEqual(['screen']);
    expect(document.getElementById('keep-awake')).toBeNull();

    globalThis.dispatchEvent(new Event('resize'));
    expect(element('stage').style.transform).toBe('');

    latest().open();
    latest().receive({ type: 'layout', layout: LAYOUT });
    expect(element('stage').style.transform).toContain('scale(');
    // A laptop may share its camera and send its microphone.
    expect(element('share-camera-button').hidden).toBe(false);
    expect(element('mic-button').hidden).toBe(false);
    expect(element('cast-button').hidden).toBe(false);
});

test('the app’s TVs: each says how it goes, and with sharing off the page says how to cast', async () => {
    const castButton = element<HTMLButtonElement>('cast-button');
    castButton.click();
    expect(element('cast-panel').hidden).toBe(false);
    expect(sentOf('cast-open')).toHaveLength(1);
    // No Remote Playback API: no stream is asked for.
    expect(sentOf('cast-stream')).toHaveLength(0);
    // AirPlay picks its TV itself, stream or not.
    expect(element<HTMLButtonElement>('cast-picker').disabled).toBe(false);
    expect(element('cast-picker-note').textContent).toBe(
        'For a TV on the same network as this device.',
    );
    expect(element('cast-note').textContent).toBe('Looking for TVs…');

    // Not a state: ignored.
    for (const state of [null, 'none', { targets: 'none' }]) {
        latest().receive({ type: 'cast', state });
    }
    expect(element('cast-note').textContent).toBe('Looking for TVs…');

    latest().receive({
        type: 'cast',
        state: {
            isAllowed: true,
            isSharing: false,
            isSearching: false,
            targets: [],
        },
    });
    expect(element('cast-picker-note').textContent).toBe(
        'Turn on “Let other devices watch” to cast to a TV.',
    );
    expect(element('cast-app').hidden).toBe(true);
    expect(element('cast-note').textContent).toBe(
        'No TV was found that can play this display. It must be on and on the same network.',
    );

    latest().receive({
        type: 'cast',
        state: {
            isAllowed: true,
            isSharing: true,
            isSearching: false,
            targets: [
                {
                    id: 'tv-a',
                    name: 'Hall',
                    kind: 'dlna',
                    status: 'connecting',
                    behind: null,
                },
                {
                    id: 'tv-b',
                    name: 'Den',
                    kind: 'mystery-tv',
                    status: 'failed',
                    behind: null,
                },
                {
                    id: 'tv-c',
                    name: 'Porch',
                    kind: 'roku',
                    status: 'casting',
                    behind: null,
                },
            ],
        },
    });
    expect(element('cast-app').hidden).toBe(false);
    expect(element('cast-note').textContent).toBe('');
    const rows = [...element('cast-list').querySelectorAll('li')];
    expect(
        rows.map((row) => [
            row.querySelector('.panel-item-detail')!.textContent,
            row.querySelector('button')!.textContent,
        ]),
    ).toEqual([
        ['DLNA · Connecting', 'Stop'],
        ['mystery-tv · The TV could not play this display.', 'Cast'],
        ['Roku · Casting', 'Stop'],
    ]);
    expect(castButton.getAttribute('aria-pressed')).toBe('true');
    rows[0].querySelector('button')!.click();
    rows[1].querySelector('button')!.click();
    expect(sentOf('cast-stop')).toEqual([
        { type: 'cast-stop', targetId: 'tv-a' },
    ]);
    expect(sentOf('cast-start')).toEqual([
        { type: 'cast-start', targetId: 'tv-b' },
    ]);

    element<HTMLButtonElement>('cast-search').click();
    expect(sentOf('cast-search')).toEqual([{ type: 'cast-search' }]);

    // The button closes what it opened.
    castButton.click();
    expect(element('cast-panel').hidden).toBe(true);
    expect(sentOf('cast-close')).toHaveLength(1);
    await flush();
});

test('a TV is handed this page’s own address, and AirPlay picks one from it', () => {
    const castVideo = () => {
        return [
            ...document.querySelectorAll<HTMLVideoElement>('body > video'),
        ].find((video) => video.id !== 'keep-awake');
    };
    // Arrived with the list closed: kept for later, nothing loaded.
    latest().receive({ type: 'cast-stream', path: '/vd/2/video?cast=abc' });
    expect(castVideo()).toBeUndefined();
    // Another display's stream, or no address at all: ignored.
    latest().receive({ type: 'cast-stream', path: '/vd/9/video?cast=zzz' });
    latest().receive({ type: 'cast-stream', path: 42 });

    element<HTMLButtonElement>('cast-button').click();
    element<HTMLButtonElement>('cast-picker').click();
    const video = castVideo()!;
    expect(video.src).toBe('https://192.168.1.5:39240/vd/2/video?cast=abc');
    expect(airPlayPicks).toEqual([video]);

    // Pressed again: the same element, its address already set.
    element<HTMLButtonElement>('cast-picker').click();
    expect(airPlayPicks).toEqual([video, video]);
    expect(
        document.querySelectorAll('body > video:not(#keep-awake)'),
    ).toHaveLength(1);
});

test('AirPlay casting lights the button, and the stream is let go once it ends', () => {
    const video = document.querySelector<HTMLVideoElement>(
        'body > video:not(#keep-awake)',
    )! as HTMLVideoElement & {
        webkitCurrentPlaybackTargetIsWireless?: boolean;
    };
    const castButton = element<HTMLButtonElement>('cast-button');
    expect(element('cast-panel').hidden).toBe(false);
    mediaCalls.length = 0;

    video.webkitCurrentPlaybackTargetIsWireless = true;
    video.dispatchEvent(
        new Event('webkitcurrentplaybacktargetiswirelesschanged'),
    );
    expect(castButton.getAttribute('aria-pressed')).toBe('true');
    expect(mediaCalls).toEqual([['play', video]]);
    latest().receive({
        type: 'cast',
        state: {
            isAllowed: false,
            isSharing: true,
            isSearching: false,
            targets: [],
        },
    });
    expect(element('cast-picker-note').textContent).toBe('Casting');

    // Closing the list while a TV plays keeps the stream it plays.
    element<HTMLButtonElement>('cast-close').click();
    expect(element('cast-panel').hidden).toBe(true);
    expect(video.getAttribute('src')).toBe(
        'https://192.168.1.5:39240/vd/2/video?cast=abc',
    );

    video.webkitCurrentPlaybackTargetIsWireless = false;
    video.dispatchEvent(
        new Event('webkitcurrentplaybacktargetiswirelesschanged'),
    );
    expect(castButton.getAttribute('aria-pressed')).toBe('false');
    expect(video.hasAttribute('src')).toBe(false);
    expect(video.preload).toBe('none');
    expect(mediaCalls.slice(1)).toEqual([
        ['pause', video],
        ['load', video],
    ]);
});

test('the camera list: the browser’s own choice, then each camera by name', async () => {
    await fresh();
    // Asked to send before anything is shared: nothing to encode.
    latest().receive({ type: 'camera-start' });
    await vi.advanceTimersByTimeAsync(200);
    expect(FakeEncoder.instances).toHaveLength(0);

    media.devices = [{ kind: 'videoinput', deviceId: '', label: '' }];
    await openCameraList();
    expect(cameraRows().map((row) => row.textContent)).toEqual(['CameraShare']);

    // Plugged in while the list is open: listed by name.
    media.devices = [
        { kind: 'videoinput', deviceId: 'desk', label: 'Desk camera' },
        { kind: 'videoinput', deviceId: 'doc', label: 'Document camera' },
    ];
    mediaDevices.dispatchEvent(new Event('devicechange'));
    await flush();
    expect(cameraRows().map((row) => row.textContent)).toEqual([
        'Desk cameraShare',
        'Document cameraShare',
    ]);

    // The button closes the list, and a closed list is not looked up again.
    element<HTMLButtonElement>('share-camera-button').click();
    expect(element('camera-panel').hidden).toBe(true);
    const count = media.enumerateCount;
    mediaDevices.dispatchEvent(new Event('devicechange'));
    await flush();
    expect(media.enumerateCount).toBe(count);

    // Escape closes whichever list is open.
    await openCameraList();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(element('camera-panel').hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(element('camera-panel').hidden).toBe(true);
    element<HTMLButtonElement>('cast-button').click();
    expect(element('cast-panel').hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(element('cast-panel').hidden).toBe(true);
    expect(sentOf('cast-close')).toHaveLength(1);
});

test('a camera that opens after the display was lost is closed, not shared', async () => {
    await fresh();
    await openCameraList();
    const opening = defer<unknown>();
    media.getUserMedia = () => opening.promise;
    const lost = latest();
    cameraRow('Desk camera').querySelector('button')!.click();
    expect(media.userMediaCalls.at(-1)).toEqual({
        audio: false,
        video: {
            width: { ideal: 640 },
            height: { ideal: 360 },
            frameRate: { ideal: 15 },
            deviceId: { exact: 'desk' },
        },
    });
    lost.drop();
    const track = genTrack('Desk camera', 'desk');
    opening.resolve(genStream(track));
    await flush();
    expect(track.stopped).toBe(1);
    expect(element('share-camera-button').getAttribute('aria-pressed')).toBe(
        'false',
    );
    expect(sentOf('camera-state', lost)).toEqual([]);

    // Refused after it was let go: nothing to say.
    await fresh();
    await vi.advanceTimersByTimeAsync(5000);
    expect(element('toast').hidden).toBe(true);
    await openCameraList();
    const refusing = defer<unknown>();
    media.getUserMedia = () => refusing.promise;
    const lostAgain = latest();
    cameraRow('Desk camera').querySelector('button')!.click();
    lostAgain.drop();
    refusing.reject(new Error('NotAllowedError'));
    await flush();
    expect(element('toast').hidden).toBe(true);
    expect(sentOf('camera-state', lostAgain)).toEqual([]);
});

test('a camera let go while it is being named is not announced', async () => {
    await fresh();
    await openCameraList();
    const track = genTrack('Desk camera', 'desk');
    media.getUserMedia = async () => genStream(track);
    const naming = defer<unknown>();
    media.enumerate = () => naming.promise;
    const lost = latest();
    try {
        cameraRow('Desk camera').querySelector('button')!.click();
        await flush();
        expect(
            element('share-camera-button').getAttribute('aria-pressed'),
        ).toBe('true');
        lost.drop();
        expect(track.stopped).toBe(1);
        naming.resolve(media.devices);
        await flush();
        expect(sentOf('camera-state', lost)).toEqual([]);
        expect(
            element('share-camera-button').getAttribute('aria-pressed'),
        ).toBe('false');
    } finally {
        media.enumerate = null;
    }
});

test('another camera that fails to open stops the one shared, and a second press waits', async () => {
    await fresh();
    await openCameraList();
    const desk = genTrack('Desk camera', 'desk');
    media.getUserMedia = async () => genStream(desk);
    cameraRow('Desk camera').querySelector('button')!.click();
    await flush();
    expect(sentOf('camera-state')).toEqual([
        { type: 'camera-state', shared: true, label: 'Desk camera' },
    ]);

    const opening = defer<unknown>();
    media.getUserMedia = () => opening.promise;
    const documentButton =
        cameraRow('Document camera').querySelector('button')!;
    const calls = media.userMediaCalls.length;
    documentButton.click();
    // A phone opens one camera at a time: the shared one is let go first.
    expect(desk.stopped).toBe(1);
    // Every button waits while one opens; even one pressed again.
    expect(
        cameraRows().every((row) => row.querySelector('button')!.disabled),
    ).toBe(true);
    documentButton.click();
    expect(media.userMediaCalls).toHaveLength(calls + 1);

    opening.reject(new Error('NotReadableError'));
    await flush();
    expect(sentOf('camera-state').at(-1)).toEqual({
        type: 'camera-state',
        shared: false,
    });
    expect(element('share-camera-button').getAttribute('aria-pressed')).toBe(
        'false',
    );
    expect(element('toast').hidden).toBe(false);
    expect(element('toast').textContent).toContain(
        'The camera could not be opened.',
    );
    expect(
        cameraRows().every((row) => row.textContent?.endsWith('Share')),
    ).toBe(true);
});

test('encoding starts once, skips a frame with no 2D context, and stops on an encoder error', async () => {
    await fresh();
    await openCameraList();
    const track = genTrack('Desk camera', 'desk');
    media.getUserMedia = async () => genStream(track);
    cameraRow('Desk camera').querySelector('button')!.click();
    await flush();
    const video = element('camera-preview').querySelector('video')!;
    Object.defineProperty(video, 'videoWidth', { value: 640 });
    Object.defineProperty(video, 'videoHeight', { value: 480 });
    const encodersBefore = FakeEncoder.instances.length;
    const getContext = vi
        .spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockReturnValue(null);
    const videos = () => sentOf('video');

    latest().receive({ type: 'camera-start' });
    latest().receive({ type: 'camera-start' });
    await vi.advanceTimersByTimeAsync(70);
    // One encoder, one timer: the second start changed nothing.
    expect(FakeEncoder.instances).toHaveLength(encodersBefore + 1);
    const encoder = FakeEncoder.instances.at(-1)!;
    expect(encoder.configurations).toEqual([
        expect.objectContaining({ codec: 'vp8', width: 640, height: 480 }),
    ]);
    // No 2D context: nothing is drawn, nothing sent.
    expect(encoder.frames).toEqual([]);
    expect(videos()).toEqual([]);

    const drawImage = vi.fn();
    getContext.mockReturnValue({ drawImage } as any);
    await vi.advanceTimersByTimeAsync(70);
    expect(encoder.frames).toEqual([{ keyFrame: true }]);
    expect(videos()).toEqual([
        { type: 'video', key: true, timestamp: 99, data: 'BAI=' },
    ]);
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 640, 480);

    encoder.callbacks.error(new Error('Encoder lost'));
    expect(encoder.state).toBe('closed');
    await vi.advanceTimersByTimeAsync(500);
    expect(encoder.frames).toHaveLength(1);
    expect(FakeEncoder.instances).toHaveLength(encodersBefore + 1);

    // Asked again, it starts over on a new encoder from a keyframe.
    latest().receive({ type: 'camera-start' });
    await vi.advanceTimersByTimeAsync(70);
    expect(FakeEncoder.instances).toHaveLength(encodersBefore + 2);
    expect(FakeEncoder.instances.at(-1)!.frames).toEqual([{ keyFrame: true }]);
    latest().receive({ type: 'camera-stop' });
});

test('the microphone’s sound goes out as audio packets while the display is there', async () => {
    await fresh();
    const mic = element<HTMLButtonElement>('mic-button');
    mic.click();
    await flush();
    expect(mic.getAttribute('aria-pressed')).toBe('true');
    expect(intercom.onAudio).not.toBeNull();
    intercom.onAudio!(new Uint8Array([1, 2, 3]));
    expect(sentOf('audio')).toEqual([{ type: 'audio', data: 'AQID' }]);

    const lost = latest();
    lost.drop();
    expect(intercom.calls.at(-1)).toEqual(['close']);
    intercom.onAudio!(new Uint8Array([9]));
    expect(sentOf('audio', lost)).toHaveLength(1);
});

test('a screen page that loads is listened to: taps, keys and leaving it move the controls', async () => {
    await fresh({ screenIds: [4] });
    const frame = stageFrame(4);
    // jsdom fetches nothing: the screen page's document is built here, with
    // the app root that tells it from an error page.
    const frameDocument = frame.contentDocument!;
    const frameRoot = frameDocument.createElement('html');
    const body = frameDocument.createElement('body');
    const appRoot = frameDocument.createElement('div');
    appRoot.id = 'root';
    body.append(appRoot);
    frameRoot.append(body);
    frameDocument.append(frameRoot);
    frame.dispatchEvent(new Event('load'));

    pointer(document, 'mouse', 'pointermove');
    expect(frameRoot.getAttribute('data-vd-controls')).toBe('1');
    // Moving on: marked once, not again.
    frameRoot.removeAttribute('data-vd-controls');
    pointer(document, 'mouse', 'pointermove');
    expect(frameRoot.hasAttribute('data-vd-controls')).toBe(false);
    document.documentElement.dispatchEvent(new Event('mouseleave'));
    expect(isControlsShown()).toBe(false);
    pointer(document, 'mouse', 'pointermove');
    expect(frameRoot.getAttribute('data-vd-controls')).toBe('1');
    document.documentElement.dispatchEvent(new Event('mouseleave'));
    expect(frameRoot.hasAttribute('data-vd-controls')).toBe(false);

    // A tap on the screen itself shows them for a while.
    pointer(frameDocument, 'touch', 'pointerdown');
    expect(isControlsShown()).toBe(true);
    expect(frameRoot.getAttribute('data-vd-controls')).toBe('1');
    vi.advanceTimersByTime(3000);
    expect(isControlsShown()).toBe(false);
    frameDocument.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(isControlsShown()).toBe(true);

    // A mouse leaving the screen hides them once it is not on the toolbar.
    pointer(frameDocument, 'mouse', 'pointermove');
    frameRoot.dispatchEvent(new Event('mouseleave'));
    vi.advanceTimersByTime(149);
    expect(isControlsShown()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isControlsShown()).toBe(false);
});

test('a screen page that cannot be read, or has no document, is left alone', async () => {
    await fresh({ screenIds: [5, 6] });
    const unreadable = stageFrame(5);
    Object.defineProperty(unreadable, 'contentDocument', {
        configurable: true,
        get: () => {
            throw new Error('SecurityError');
        },
    });
    const empty = stageFrame(6);
    Object.defineProperty(empty, 'contentDocument', {
        configurable: true,
        get: () => null,
    });
    const setSrc = vi.fn();
    for (const frame of [unreadable, empty]) {
        const src = frame.src;
        Object.defineProperty(frame, 'src', {
            configurable: true,
            get: () => src,
            set: setSrc,
        });
        frame.dispatchEvent(new Event('load'));
    }
    // Neither is judged an error page: no retry is asked for.
    vi.advanceTimersByTime(10000);
    expect(setSrc).not.toHaveBeenCalled();
    // Marking them as the controls come and go is quietly skipped.
    pointer(document, 'mouse', 'pointermove');
    document.documentElement.dispatchEvent(new Event('mouseleave'));
    pointer(document, 'mouse', 'pointermove');
    expect(isControlsShown()).toBe(true);
});

test('full screen turns a phone the display’s way, and the button follows it', async () => {
    await fresh();
    let fullscreenElement: Element | null = null;
    const requestFullscreen = vi.fn(async () => {});
    const exitFullscreen = vi.fn(async () => {});
    const lock = vi.fn(async (_orientation: string) => {});
    Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => fullscreenElement,
    });
    Object.defineProperty(document, 'fullscreenEnabled', {
        configurable: true,
        value: true,
    });
    (document as any).exitFullscreen = exitFullscreen;
    (document.documentElement as any).requestFullscreen = requestFullscreen;
    Object.defineProperty(screen, 'orientation', {
        configurable: true,
        value: { lock },
    });
    const button = element<HTMLButtonElement>('fullscreen-button');
    try {
        document.dispatchEvent(new Event('fullscreenchange'));
        expect(button.hidden).toBe(false);
        expect(button.title).toBe('Full screen');
        expect(button.getAttribute('aria-pressed')).toBe('false');

        element('stage').dispatchEvent(new Event('dblclick'));
        await flush();
        expect(requestFullscreen).toHaveBeenCalledTimes(1);
        expect(lock).toHaveBeenCalledWith('landscape');

        fullscreenElement = document.documentElement;
        document.dispatchEvent(new Event('fullscreenchange'));
        expect(button.title).toBe('Exit full screen');
        expect(button.getAttribute('aria-pressed')).toBe('true');
        button.click();
        expect(exitFullscreen).toHaveBeenCalledTimes(1);
        expect(requestFullscreen).toHaveBeenCalledTimes(1);

        // An upright display turns the phone upright.
        fullscreenElement = null;
        latest().receive({
            type: 'layout',
            layout: { ...LAYOUT, width: 1080, height: 1920 },
        });
        button.click();
        await flush();
        expect(lock).toHaveBeenLastCalledWith('portrait');

        // No orientation lock, or full screen refused: nothing else happens.
        Object.defineProperty(screen, 'orientation', {
            configurable: true,
            value: {},
        });
        button.click();
        await flush();
        expect(requestFullscreen).toHaveBeenCalledTimes(3);
        expect(lock).toHaveBeenCalledTimes(2);
        requestFullscreen.mockRejectedValueOnce(new Error('Not allowed'));
        button.click();
        await flush();
        expect(requestFullscreen).toHaveBeenCalledTimes(4);
        expect(lock).toHaveBeenCalledTimes(2);
    } finally {
        // Back to the usual size with no screens: nothing left to reload.
        latest().receive({ type: 'layout', layout: LAYOUT });
        delete (document as any).fullscreenElement;
        delete (document as any).fullscreenEnabled;
        delete (document as any).exitFullscreen;
        delete (document.documentElement as any).requestFullscreen;
        delete (screen as any).orientation;
    }
});

test('a display resized reloads every screen page at its new size', async () => {
    await fresh({ screenIds: [8, 9] });
    const implementationSymbol = Object.getOwnPropertySymbols(location).find(
        (symbol) => String(symbol) === 'Symbol(impl)',
    )!;
    const locationImplementation = (location as any)[implementationSymbol];
    const reloaded: unknown[] = [];
    vi.spyOn(
        Object.getPrototypeOf(locationImplementation),
        'reload',
    ).mockImplementation(function (this: unknown) {
        reloaded.push(this);
    });
    latest().receive({
        type: 'layout',
        layout: { ...LAYOUT, screenIds: [8, 9] },
    });
    expect(reloaded).toHaveLength(0);
    latest().receive({
        type: 'layout',
        layout: { ...LAYOUT, width: 1280, height: 720, screenIds: [8, 9] },
    });
    expect(reloaded).toHaveLength(2);
    expect(reloaded[0]).not.toBe(reloaded[1]);
    expect(reloaded).not.toContain(locationImplementation);
});

test('Retry while the automatic try is still connecting does nothing', async () => {
    await fresh();
    latest().drop();
    const retry = element<HTMLButtonElement>('retry-button');
    expect(retry.hidden).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    const before = FakeSocket.instances.length;
    expect(latest().readyState).toBe(FakeSocket.CONNECTING);
    retry.click();
    expect(FakeSocket.instances).toHaveLength(before);
    expect(retry.disabled).toBe(false);
    expect(element('status-text').textContent).toBe('Waiting for the display');
    latest().open();
    latest().receive({ type: 'layout', layout: LAYOUT });
    expect(element('status').hidden).toBe(true);
});

test('a screen state from another origin is not believed', async () => {
    await fresh({ screenIds: [5] });
    const frame = stageFrame(5);
    const post = (origin: string) => {
        globalThis.dispatchEvent(
            new MessageEvent('message', {
                data: {
                    type: 'owa-vd-screen-state',
                    screenId: 5,
                    isEmpty: true,
                },
                origin,
                source: frame.contentWindow,
            }),
        );
    };
    post('https://evil.example');
    expect(element('empty-notice').hidden).toBe(true);
    post(globalThis.location.origin);
    expect(element('empty-notice').hidden).toBe(false);
});

test('leaving for another page without the back/forward cache keeps the socket', () => {
    const current = latest();
    expect(current.readyState).toBe(FakeSocket.OPEN);
    const pagehide = new Event('pagehide');
    Object.defineProperty(pagehide, 'persisted', { value: false });
    globalThis.dispatchEvent(pagehide);
    expect(current.readyState).toBe(FakeSocket.OPEN);
    const pageshow = new Event('pageshow');
    Object.defineProperty(pageshow, 'persisted', { value: false });
    globalThis.dispatchEvent(pageshow);
    expect(FakeSocket.instances.at(-1)).toBe(current);
});

test('the wake lock is asked for again when the page is shown again', async () => {
    let visibility = 'hidden';
    Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => visibility,
    });
    try {
        const count = wakeLockCalls.length;
        document.dispatchEvent(new Event('visibilitychange'));
        await flush();
        expect(wakeLockCalls).toHaveLength(count);
        visibility = 'visible';
        document.dispatchEvent(new Event('visibilitychange'));
        await flush();
        expect(wakeLockCalls).toHaveLength(count + 1);
        // Held: the sound tap does not start the looping video either.
        element<HTMLButtonElement>('sound-button').click();
        expect(element('sound-button').getAttribute('aria-pressed')).toBe(
            'true',
        );
        expect(document.getElementById('keep-awake')).toBeNull();
        element<HTMLButtonElement>('sound-button').click();
    } finally {
        delete (document as any).visibilityState;
    }
});

// The page loaded again under other conditions, on fresh elements: a new
// module, a new socket.
async function loadPageAgain(location: string) {
    globalThis.history.replaceState(null, '', location);
    document.body.innerHTML = pageBody;
    vi.resetModules();
    const before = FakeSocket.instances.length;
    await import('./virtual-display-viewer');
    await flush();
    return FakeSocket.instances.slice(before);
}

test('inside the app’s own preview there are no controls and no wake lock', async () => {
    const count = wakeLockCalls.length;
    const sockets = await loadPageAgain('/vd/2/?preview=1');
    expect(sockets).toHaveLength(1);
    expect(sockets[0].url).toBe(
        `wss://192.168.1.5:39240/vd/2/ws?viewer=${STORED_ID}&preview=1`,
    );
    expect(element('toolbar').hidden).toBe(true);
    expect(wakeLockCalls).toHaveLength(count);
    sockets[0].open();
    sockets[0].receive({
        type: 'layout',
        layout: { ...LAYOUT, screenIds: [3] },
    });
    expect(element('cast-button').hidden).toBe(true);
    expect(element('mic-button').hidden).toBe(true);
    expect(element('share-camera-button').hidden).toBe(true);
    expect(stageFrame(3).src).toContain('preview=1');
});

test('with its storage refused, a tab makes a viewer id for this load only', async () => {
    const getItem = vi
        .spyOn(Storage.prototype, 'getItem')
        .mockImplementation(() => {
            throw new Error('SecurityError');
        });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const sockets = await loadPageAgain('/vd/2/');
    expect(getItem).toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    const id = new URL(sockets[0].url).searchParams.get('viewer');
    expect(id).toMatch(/^[0-9a-f]{24}$/);
    expect(id).not.toBe(STORED_ID);
});

test('a browser that can cast nothing says so', async () => {
    const picker = (HTMLMediaElement.prototype as any)
        .webkitShowPlaybackTargetPicker;
    delete (HTMLMediaElement.prototype as any).webkitShowPlaybackTargetPicker;
    try {
        const [socket] = await loadPageAgain('/vd/2/');
        socket.open();
        socket.receive({ type: 'layout', layout: LAYOUT });
        element<HTMLButtonElement>('cast-button').click();
        expect(element('cast-picker-note').textContent).toBe(
            'This browser cannot cast. Try Chrome, Edge or Safari.',
        );
        expect(element<HTMLButtonElement>('cast-picker').disabled).toBe(true);
    } finally {
        (HTMLMediaElement.prototype as any).webkitShowPlaybackTargetPicker =
            picker;
    }
});

test('with both pickers, the picker waits for the stream before it asks', async () => {
    const remote = Object.assign(new EventTarget(), {
        prompt: vi.fn(async () => {}),
        watchAvailability: vi.fn(async () => 1),
        cancelWatchAvailability: vi.fn(async () => {}),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'remote', {
        configurable: true,
        get: () => remote,
    });
    const picks = airPlayPicks.length;
    const [socket] = await loadPageAgain('/vd/2/');
    socket.open();
    socket.receive({ type: 'layout', layout: LAYOUT });
    element<HTMLButtonElement>('cast-button').click();
    expect(sentOf('cast-stream', socket)).toHaveLength(1);
    const picker = element<HTMLButtonElement>('cast-picker');
    expect(picker.disabled).toBe(false);
    picker.click();
    await flush();
    expect(remote.prompt).not.toHaveBeenCalled();
    expect(airPlayPicks).toHaveLength(picks);
});

test('a page not under /vd/<number>/ connects to nothing', async () => {
    expect(await loadPageAgain('/vd/none/')).toEqual([]);
    expect(await loadPageAgain('/vd/0/')).toEqual([]);
});
