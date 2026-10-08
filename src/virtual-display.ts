// A virtual display's compositor: a hidden window that draws the display's
// wallpaper and, on top of it, one screen page per screen shown there -- the
// same transparent `screen.html` a real monitor shows, in a `<webview>` -- and
// records itself as live MP4 for whoever is watching (`LiveMp4Encoder`). The
// main process creates it for the first MP4 viewer and destroys it after the
// last.
import appProvider from './server/appProvider';
import {
    listVirtualDisplayVideoCodecs,
    toVirtualDisplayBitrate,
    type VirtualDisplayCompositorConfig,
    type VirtualDisplayEncodeOptions,
} from '../electron/virtualDisplayProtocol';
import {
    diffCompositorScreens,
    toWallpaperKey,
} from './virtual-display/compositorHelpers';
import { LiveMp4Encoder } from './virtual-display/liveMp4Encoder';

type ScreenLayerType = {
    element: HTMLElement & { getWebContentsId?: () => number };
    src: string;
    audio?: { stream: MediaStream; source: MediaStreamAudioSourceNode };
    isReported: boolean;
};
type EncoderType = {
    generation: number;
    encoder: LiveMp4Encoder;
    video: MediaStream;
};

const { messageUtils } = appProvider;
const wallpaperLayer = document.getElementById('wallpaper') as HTMLElement;
const screensLayer = document.getElementById('screens') as HTMLElement;
const screenLayers = new Map<number, ScreenLayerType>();
let wallpaperKey = '';
let encoder: EncoderType | null = null;
let mix: {
    context: AudioContext;
    destination: MediaStreamAudioDestinationNode;
} | null = null;
// `getDisplayMedia` calls go one at a time: the main process hands the next
// audio request the screen it was told about just before.
let captureQueue: Promise<unknown> = Promise.resolve();

function queueCapture<T>(work: () => Promise<T>) {
    const result = captureQueue.then(work, work);
    captureQueue = result.catch(() => {});
    return result;
}

function getDisplayMedia(options: Record<string, unknown>) {
    return navigator.mediaDevices.getDisplayMedia(
        options as DisplayMediaStreamOptions,
    );
}

// Every screen's sound and a constant silence, so the AAC track has samples
// from the first byte: with no audio the recorder holds the video back.
function ensureMix() {
    if (mix === null) {
        const context = new AudioContext({ sampleRate: 48000 });
        const destination = context.createMediaStreamDestination();
        const silence = context.createConstantSource();
        silence.offset.value = 0;
        silence.connect(destination);
        silence.start();
        mix = { context, destination };
    }
    return mix;
}

function applyWallpaper(
    wallpaper: VirtualDisplayCompositorConfig['wallpaper'],
) {
    const key = toWallpaperKey(wallpaper);
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
        image.src = appProvider.browserUtils.pathToFileURL(wallpaper.filePath);
        wallpaperLayer.append(image);
    } else if (wallpaper.kind === 'video') {
        // The wallpaper is a picture: its own sound is never streamed.
        const video = document.createElement('video');
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        video.src = appProvider.browserUtils.pathToFileURL(wallpaper.filePath);
        wallpaperLayer.append(video);
    }
}

async function captureScreenAudio(screenId: number, layer: ScreenLayerType) {
    await queueCapture(async () => {
        if (screenLayers.get(screenId) !== layer) {
            return;
        }
        const isTargeted = messageUtils.sendDataSync(
            'vd:audio-target',
            screenId,
        );
        if (!isTargeted) {
            return;
        }
        const stream = await getDisplayMedia({
            video: true,
            audio: true,
            preferCurrentTab: true,
            selfBrowserSurface: 'include',
            systemAudio: 'exclude',
        });
        // Asked for only because a request must ask for a picture.
        for (const track of stream.getVideoTracks()) {
            track.stop();
        }
        const track = stream.getAudioTracks()[0];
        if (track === undefined || screenLayers.get(screenId) !== layer) {
            for (const each of stream.getTracks()) {
                each.stop();
            }
            return;
        }
        const { context, destination } = ensureMix();
        const source = context.createMediaStreamSource(
            new MediaStream([track]),
        );
        source.connect(destination);
        layer.audio = { stream, source };
    }).catch((error) => {
        console.error('Virtual display: screen audio', error);
    });
}

function removeScreen(screenId: number) {
    const layer = screenLayers.get(screenId);
    if (layer === undefined) {
        return;
    }
    screenLayers.delete(screenId);
    if (layer.audio) {
        layer.audio.source.disconnect();
        for (const track of layer.audio.stream.getTracks()) {
            track.stop();
        }
    }
    // Removed, never hidden: a `<webview>` set to `display: none` reloads.
    layer.element.remove();
}

function addScreen(screenId: number, src: string) {
    const element = document.createElement(
        'webview',
    ) as ScreenLayerType['element'];
    element.setAttribute('src', src);
    const layer: ScreenLayerType = { element, src, isReported: false };
    element.addEventListener('dom-ready', () => {
        if (layer.isReported || screenLayers.get(screenId) !== layer) {
            return;
        }
        layer.isReported = true;
        // Answered before the audio is asked for: main must know the page.
        const isKnown = messageUtils.sendDataSync('vd:guest', {
            screenId,
            webContentsId: element.getWebContentsId?.(),
        });
        if (isKnown) {
            void captureScreenAudio(screenId, layer);
        }
    });
    screenLayers.set(screenId, layer);
    screensLayer.append(element);
}

function applyConfig(config: VirtualDisplayCompositorConfig) {
    applyWallpaper(config.wallpaper);
    const current = new Map(
        [...screenLayers].map(([screenId, layer]) => [screenId, layer.src]),
    );
    const { removed, added, order } = diffCompositorScreens(
        current,
        config.screens,
    );
    for (const screenId of removed) {
        removeScreen(screenId);
    }
    for (const screenId of added) {
        const screen = config.screens.find((item) => {
            return item.screenId === screenId;
        });
        if (screen !== undefined) {
            addScreen(screenId, screen.src);
        }
    }
    order.forEach((screenId, index) => {
        const layer = screenLayers.get(screenId);
        if (layer !== undefined) {
            layer.element.style.zIndex = String(index + 1);
        }
    });
}

function stopEncoder() {
    const current = encoder;
    encoder = null;
    if (current === null) {
        return;
    }
    current.encoder.stop();
    for (const track of current.video.getTracks()) {
        track.stop();
    }
}

function reportEncoder(generation: number, data: Record<string, unknown>) {
    messageUtils.sendData('vd:encoder', { generation, ...data });
}

async function startEncoder(options: VirtualDisplayEncodeOptions) {
    stopEncoder();
    const { generation, width, height, frameRate } = options;
    try {
        const video = await queueCapture(() => {
            return getDisplayMedia({
                video: {
                    frameRate,
                    width: { max: width },
                    height: { max: height },
                },
                audio: false,
                preferCurrentTab: true,
                selfBrowserSurface: 'include',
                surfaceSwitching: 'exclude',
            });
        });
        const videoTrack = video.getVideoTracks()[0];
        const { destination } = ensureMix();
        const liveEncoder = new LiveMp4Encoder({
            width,
            height,
            frameRate,
            bitrate: toVirtualDisplayBitrate(width, height, frameRate),
            videoCodecs: listVirtualDisplayVideoCodecs(width, height),
            onData: (data) => {
                messageUtils.sendData('vd:chunk', { generation, data });
            },
            onLive: (mimeType) => {
                reportEncoder(generation, { state: 'live', mimeType });
            },
            onError: (message) => {
                if (encoder?.generation === generation) {
                    stopEncoder();
                }
                reportEncoder(generation, { state: 'error', error: message });
            },
        });
        encoder = { generation, encoder: liveEncoder, video };
        videoTrack.addEventListener('ended', () => {
            if (encoder?.generation === generation) {
                stopEncoder();
                reportEncoder(generation, {
                    state: 'error',
                    error: 'The virtual display stopped recording',
                });
            }
        });
        await liveEncoder.start(
            videoTrack,
            destination.stream.getAudioTracks()[0] ?? null,
        );
    } catch (error) {
        if (encoder?.generation === generation) {
            stopEncoder();
        }
        reportEncoder(generation, {
            state: 'error',
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

messageUtils.listenForData('vd:compositor', (_event, message) => {
    if (message?.type === 'config') {
        applyConfig(message.config);
    } else if (message?.type === 'encode') {
        void startEncoder(message.options);
    } else if (message?.type === 'keyframe') {
        // A viewer just joined: it starts on a picture made for it.
        encoder?.encoder.requestKeyFrame();
    } else if (message?.type === 'stop') {
        stopEncoder();
    }
});
messageUtils.sendData('vd:compositor-ready');
