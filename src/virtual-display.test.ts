// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type {
    VirtualDisplayCompositorConfig,
    VirtualDisplayEncodeOptions,
} from '../electron/virtualDisplayProtocol';

const h = vi.hoisted(() => {
    class FakeTrack extends EventTarget {
        stop = vi.fn();
    }
    class FakeStream {
        constructor(private readonly tracks: FakeTrack[]) {}
        getTracks() {
            return this.tracks;
        }
        getVideoTracks() {
            return this.tracks.slice(0, 1);
        }
        getAudioTracks() {
            return this.tracks.slice(1);
        }
    }
    class FakeEncoder {
        stop = vi.fn();
        start = vi.fn(async () => {});
        requestKeyFrame = vi.fn();
        constructor(public options: any) {
            encoders.push(this);
        }
    }
    const encoders: FakeEncoder[] = [];
    const audioSources: Array<{
        connect: ReturnType<typeof vi.fn>;
        disconnect: ReturnType<typeof vi.fn>;
    }> = [];
    const send = vi.fn();
    const sendSync = vi.fn();
    const getDisplayMedia = vi.fn();
    const getUserMedia = vi.fn();
    let listener: ((_event: unknown, message: any) => void) | null = null;
    return {
        FakeTrack,
        FakeStream,
        FakeEncoder,
        encoders,
        audioSources,
        send,
        sendSync,
        getDisplayMedia,
        getUserMedia,
        setListener: (value: typeof listener) => {
            listener = value;
        },
        emit: (message: any) => {
            listener?.(null, message);
        },
    };
});

vi.mock('./server/appProvider', () => ({
    default: {
        messageUtils: {
            listenForData: (
                _channel: string,
                callback: (event: unknown, message: unknown) => void,
            ) => h.setListener(callback),
            sendData: h.send,
            sendDataSync: h.sendSync,
        },
        browserUtils: { pathToFileURL: (path: string) => `file://${path}` },
    },
}));
vi.mock('../electron/virtualDisplayProtocol', () => ({
    listVirtualDisplayVideoCodecs: () => ['avc1.42E01E'],
    toVirtualDisplayBitrate: () => 1_000_000,
}));
vi.mock('./virtual-display/liveMp4Encoder', () => ({
    LiveMp4Encoder: h.FakeEncoder,
}));

function config(
    wallpaper: VirtualDisplayCompositorConfig['wallpaper'] = {
        kind: 'color',
        color: '#123456',
    },
    screens: VirtualDisplayCompositorConfig['screens'] = [],
): VirtualDisplayCompositorConfig {
    return { number: 1, width: 1280, height: 720, wallpaper, screens };
}
function videoStream() {
    const videoTrack = new h.FakeTrack();
    return { stream: new h.FakeStream([videoTrack]), videoTrack };
}
function audioStream() {
    const videoTrack = new h.FakeTrack();
    const audioTrack = new h.FakeTrack();
    return {
        stream: new h.FakeStream([videoTrack, audioTrack]),
        videoTrack,
        audioTrack,
    };
}
async function flush() {
    for (let i = 0; i < 12; i++) await Promise.resolve();
}
function emit(message: any) {
    h.emit(message);
}
function encode(options: VirtualDisplayEncodeOptions) {
    emit({ type: 'encode', options });
}

beforeEach(async () => {
    vi.resetModules();
    h.setListener(null);
    h.send.mockClear();
    h.sendSync
        .mockReset()
        .mockImplementation(
            (channel: string) =>
                channel === 'vd:guest' || channel === 'vd:audio-target',
        );
    h.encoders.length = 0;
    h.audioSources.length = 0;
    h.getDisplayMedia
        .mockReset()
        .mockImplementation(async () => videoStream().stream);
    h.getUserMedia
        .mockReset()
        .mockImplementation(async () => audioStream().stream);
    Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
            getDisplayMedia: h.getDisplayMedia,
            getUserMedia: h.getUserMedia,
        },
    });
    vi.stubGlobal('MediaStream', h.FakeStream);
    vi.stubGlobal(
        'AudioContext',
        class {
            createMediaStreamDestination() {
                return {
                    stream: new h.FakeStream([
                        new h.FakeTrack(),
                        new h.FakeTrack(),
                    ]),
                };
            }
            createConstantSource() {
                return {
                    offset: { value: 1 },
                    connect: vi.fn(),
                    start: vi.fn(),
                };
            }
            createMediaStreamSource() {
                const source = { connect: vi.fn(), disconnect: vi.fn() };
                h.audioSources.push(source);
                return source;
            }
        },
    );
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    document.body.innerHTML =
        '<div id="wallpaper"></div><div id="screens"></div>';
    await import('./virtual-display');
});
afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('virtual display compositor', () => {
    test('announces readiness and applies wallpaper changes without rebuilding unchanged layers', () => {
        expect(h.send).toHaveBeenCalledWith('vd:compositor-ready');
        const wallpaper = document.getElementById('wallpaper')!;
        const screens = document.getElementById('screens')!;
        emit({
            type: 'config',
            config: config({ kind: 'image', filePath: '/image.jpg' }, [
                { screenId: 2, src: 'screen-2' },
                { screenId: 1, src: 'screen-1' },
            ]),
        });
        expect(wallpaper.querySelector('img')?.getAttribute('src')).toBe(
            'file:///image.jpg',
        );
        expect(screens.children).toHaveLength(2);
        expect((screens.children[0] as HTMLElement).style.zIndex).toBe('1');
        expect((screens.children[1] as HTMLElement).style.zIndex).toBe('2');
        const first = screens.children[0];
        emit({
            type: 'config',
            config: config({ kind: 'image', filePath: '/image.jpg' }, [
                { screenId: 1, src: 'screen-1' },
                { screenId: 2, src: 'screen-2' },
            ]),
        });
        expect(screens.children[0]).toBe(first);
        expect((screens.children[0] as HTMLElement).style.zIndex).toBe('2');
        expect((screens.children[1] as HTMLElement).style.zIndex).toBe('1');
        emit({
            type: 'config',
            config: config({ kind: 'video', filePath: '/loop.mp4' }, [
                { screenId: 1, src: 'new-screen-1' },
            ]),
        });
        expect(wallpaper.querySelector('video')?.getAttribute('src')).toBe(
            'file:///loop.mp4',
        );
        expect(screens.children).toHaveLength(1);
        expect(screens.firstElementChild?.getAttribute('src')).toBe(
            'new-screen-1',
        );
        emit({
            type: 'config',
            config: config({ kind: 'color', color: '#abcdef' }),
        });
        expect(wallpaper.querySelector('video')).toBeNull();
        expect(HTMLMediaElement.prototype.pause as any).toHaveBeenCalled();
        expect(wallpaper.style.backgroundColor).toBe('rgb(171, 205, 239)');
        expect(screens.children).toHaveLength(0);
    });

    test('reports a ready webview, captures its audio, and releases tracks when removed', async () => {
        const captured = audioStream();
        h.getDisplayMedia.mockResolvedValueOnce(captured.stream);
        emit({
            type: 'config',
            config: config(undefined, [{ screenId: 4, src: 'screen-4' }]),
        });
        const webview = document.querySelector<HTMLElement>('webview')!;
        (webview as any).getWebContentsId = () => 44;
        webview.dispatchEvent(new Event('dom-ready'));
        await flush();
        expect(h.sendSync).toHaveBeenCalledWith('vd:guest', {
            screenId: 4,
            webContentsId: 44,
        });
        expect(h.sendSync).toHaveBeenCalledWith('vd:audio-target', 4);
        expect(h.getDisplayMedia).toHaveBeenCalledWith(
            expect.objectContaining({ audio: true }),
        );
        expect(captured.videoTrack.stop).toHaveBeenCalledTimes(1);
        expect(h.audioSources[0].connect).toHaveBeenCalled();
        webview.dispatchEvent(new Event('dom-ready'));
        expect(
            h.sendSync.mock.calls.filter(([channel]) => channel === 'vd:guest'),
        ).toHaveLength(1);
        emit({ type: 'config', config: config() });
        expect(captured.audioTrack.stop).toHaveBeenCalledTimes(1);
        expect(h.audioSources[0].disconnect).toHaveBeenCalledTimes(1);
    });

    test('starts an encoder, sends chunks and live status, then stops on request', async () => {
        const captured = videoStream();
        h.getDisplayMedia.mockResolvedValueOnce(captured.stream);
        encode({ generation: 7, width: 1280, height: 720, frameRate: 30 });
        await flush();
        expect(h.encoders).toHaveLength(1);
        const encoder = h.encoders[0];
        expect(encoder.start).toHaveBeenCalledWith(
            captured.videoTrack,
            expect.any(h.FakeTrack),
        );
        expect(encoder.options).toMatchObject({
            width: 1280,
            height: 720,
            bitrate: 1_000_000,
        });
        encoder.options.onData('bytes');
        encoder.options.onLive('video/mp4');
        expect(h.send).toHaveBeenCalledWith('vd:chunk', {
            generation: 7,
            data: 'bytes',
        });
        expect(h.send).toHaveBeenCalledWith('vd:encoder', {
            generation: 7,
            state: 'live',
            mimeType: 'video/mp4',
        });
        emit({ type: 'keyframe' });
        expect(encoder.requestKeyFrame).toHaveBeenCalledTimes(1);
        emit({ type: 'stop' });
        expect(encoder.stop).toHaveBeenCalledTimes(1);
        expect(captured.videoTrack.stop).toHaveBeenCalledTimes(1);
    });

    test('reports encoder failure when the capture ends or capture itself rejects', async () => {
        const captured = videoStream();
        h.getDisplayMedia.mockResolvedValueOnce(captured.stream);
        encode({ generation: 8, width: 640, height: 360, frameRate: 24 });
        await flush();
        captured.videoTrack.dispatchEvent(new Event('ended'));
        expect(h.encoders[0].stop).toHaveBeenCalledTimes(1);
        expect(h.send).toHaveBeenCalledWith('vd:encoder', {
            generation: 8,
            state: 'error',
            error: 'The virtual display stopped recording',
        });
        h.getDisplayMedia.mockRejectedValueOnce(new Error('capture denied'));
        encode({ generation: 9, width: 640, height: 360, frameRate: 24 });
        await flush();
        expect(h.send).toHaveBeenCalledWith('vd:encoder', {
            generation: 9,
            state: 'error',
            error: 'capture denied',
        });
    });

    test('an old encoder callback cannot stop a newer capture', async () => {
        h.getDisplayMedia
            .mockResolvedValueOnce(videoStream().stream)
            .mockResolvedValueOnce(videoStream().stream);
        encode({ generation: 10, width: 640, height: 360, frameRate: 24 });
        await flush();
        encode({ generation: 11, width: 640, height: 360, frameRate: 24 });
        await flush();
        expect(h.encoders[0].stop).toHaveBeenCalledTimes(1);
        h.encoders[0].options.onError('old codec error');
        expect(h.encoders[1].stop).not.toHaveBeenCalled();
        h.encoders[1].options.onError('current codec error');
        expect(h.encoders[1].stop).toHaveBeenCalledTimes(1);
        expect(h.send).toHaveBeenCalledWith('vd:encoder', {
            generation: 11,
            state: 'error',
            error: 'current codec error',
        });
    });

    test('skips untargeted screen audio and releases a capture with no audio track', async () => {
        h.sendSync.mockImplementation(
            (channel: string) => channel === 'vd:guest',
        );
        emit({
            type: 'config',
            config: config(undefined, [{ screenId: 5, src: 'screen-5' }]),
        });
        document
            .querySelector('webview')!
            .dispatchEvent(new Event('dom-ready'));
        await flush();
        expect(h.getDisplayMedia).not.toHaveBeenCalled();
        h.sendSync.mockReturnValue(true);
        const captured = videoStream();
        h.getDisplayMedia.mockResolvedValueOnce(captured.stream);
        emit({
            type: 'config',
            config: config(undefined, [{ screenId: 5, src: 'new-screen-5' }]),
        });
        document
            .querySelector('webview')!
            .dispatchEvent(new Event('dom-ready'));
        await flush();
        expect(captured.videoTrack.stop).toHaveBeenCalled();
        expect(h.audioSources).toHaveLength(0);
    });

    test('stops a microphone request that arrives after it was turned off', async () => {
        let resolve!: (value: InstanceType<typeof h.FakeStream>) => void;
        h.getUserMedia.mockReturnValueOnce(
            new Promise((yes) => {
                resolve = yes;
            }),
        );
        emit({ type: 'mic', isOn: true });
        emit({ type: 'mic', isOn: false });
        const stream = audioStream();
        resolve(stream.stream);
        await flush();
        expect(stream.videoTrack.stop).toHaveBeenCalledTimes(1);
        expect(stream.audioTrack.stop).toHaveBeenCalledTimes(1);
        expect(h.audioSources).toHaveLength(0);
        h.getUserMedia.mockResolvedValueOnce(audioStream().stream);
        emit({ type: 'mic', isOn: true });
        await flush();
        expect(h.audioSources).toHaveLength(1);
        emit({ type: 'mic', isOn: false });
        expect(h.audioSources[0].disconnect).toHaveBeenCalledTimes(1);
    });
});
