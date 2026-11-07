import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type Listener = (event: unknown, data: any) => void;

const { listeners, sendDataMock } = vi.hoisted(() => ({
    listeners: new Map<string, Set<Listener>>(),
    sendDataMock: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        messageUtils: {
            sendData: sendDataMock,
            listenForData: (channel: string, listener: Listener) => {
                const set = listeners.get(channel) ?? new Set();
                set.add(listener);
                listeners.set(channel, set);
            },
            removeListener: (channel: string, listener: Listener) => {
                listeners.get(channel)?.delete(listener);
            },
        },
    },
}));

import {
    checkIsViewerCameraId,
    createViewerCameraView,
    getViewerCameraStream,
    listenViewerCameraLive,
    releaseViewerCameraStream,
} from './viewerCameraTransport';

function emit(channel: string, data: unknown) {
    for (const listener of [...(listeners.get(channel) ?? [])]) {
        listener(null, data);
    }
}

// A decoder that outputs one 640x360 frame per chunk, at once -- and, as
// WebCodecs does, is closed for good once it reports an error, and throws
// when closed a second time.
const decoders: FakeVideoDecoder[] = [];
class FakeVideoDecoder {
    state = 'unconfigured';
    decodeQueueSize = 0;
    chunks: any[] = [];
    frames: any[] = [];
    constructor(
        private readonly init: {
            output: (frame: any) => void;
            error: (error: DOMException) => void;
        },
    ) {
        decoders.push(this);
    }
    configure() {
        this.state = 'configured';
    }
    decode(chunk: any) {
        this.chunks.push(chunk);
        const frame = {
            close: vi.fn(),
            chunk,
            displayWidth: 640,
            displayHeight: 360,
        };
        this.frames.push(frame);
        this.init.output(frame);
    }
    fail() {
        this.state = 'closed';
        this.init.error(new DOMException('Decoding failed', 'EncodingError'));
    }
    close() {
        if (this.state === 'closed') {
            throw new DOMException('Codec is closed', 'InvalidStateError');
        }
        this.state = 'closed';
    }
}

const generators: FakeGenerator[] = [];
class FakeGenerator {
    written: any[] = [];
    isStopped = false;
    writable = {
        getWriter: () => ({
            write: async (frame: any) => {
                this.written.push(frame);
            },
            close: async () => {},
        }),
    };
    constructor() {
        generators.push(this);
    }
    stop() {
        this.isStopped = true;
    }
}

const CAMERA = 'vd-camera:viewer-1';

function frame(type: 'key' | 'delta', cameraId = CAMERA) {
    return { cameraId, type, timestamp: 40, data: new Uint8Array([1]) };
}

beforeEach(() => {
    listeners.clear();
    sendDataMock.mockClear();
    decoders.length = 0;
    generators.length = 0;
    vi.stubGlobal('VideoDecoder', FakeVideoDecoder);
    vi.stubGlobal('MediaStreamTrackGenerator', FakeGenerator);
    vi.stubGlobal(
        'EncodedVideoChunk',
        class {
            constructor(init: any) {
                Object.assign(this, init);
            }
        },
    );
    vi.stubGlobal(
        'MediaStream',
        class {
            constructor(readonly tracks: unknown[]) {}
        },
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('viewerCameraTransport', () => {
    test('names a browser viewer camera by its prefix', () => {
        expect(checkIsViewerCameraId(CAMERA)).toBe(true);
        expect(checkIsViewerCameraId('mirror-camera:x:y')).toBe(false);
    });

    test('watches the camera, decodes from its first key frame, and says when pictures come', async () => {
        const stream = await getViewerCameraStream(CAMERA);
        expect(sendDataMock).toHaveBeenCalledWith('vd:camera-watch', {
            cameraId: CAMERA,
            isWatching: true,
        });
        expect((stream as any).tracks).toEqual([generators[0]]);
        const live: boolean[] = [];
        const stopListening = listenViewerCameraLive(stream, (isLive) => {
            live.push(isLive);
        });
        // A delta before any key frame, or another camera's, is skipped.
        emit('vd:camera-frame', frame('delta'));
        emit('vd:camera-frame', frame('key', 'vd-camera:other'));
        expect(decoders[0].chunks).toHaveLength(0);
        expect(live).toEqual([false]);

        emit('vd:camera-frame', frame('key'));
        emit('vd:camera-frame', frame('delta'));
        expect(decoders[0].chunks.map((chunk) => chunk.type)).toEqual([
            'key',
            'delta',
        ]);
        expect(generators[0].written).toHaveLength(2);
        expect(live).toEqual([false, true]);

        // Not shared now: paused, not let go -- and back from a key frame.
        emit('vd:camera-end', { cameraId: 'vd-camera:other' });
        emit('vd:camera-end', { cameraId: CAMERA });
        expect(live).toEqual([false, true, false]);
        expect(sendDataMock).toHaveBeenCalledTimes(1);
        expect(generators[0].isStopped).toBe(false);
        emit('vd:camera-frame', frame('delta'));
        expect(decoders[0].chunks).toHaveLength(2);
        emit('vd:camera-frame', frame('key'));
        expect(live).toEqual([false, true, false, true]);

        stopListening();
        emit('vd:camera-end', { cameraId: CAMERA });
        expect(live).toHaveLength(4);

        // Let go: the browser is told nothing here shows it any more.
        releaseViewerCameraStream(stream);
        expect(sendDataMock).toHaveBeenLastCalledWith('vd:camera-watch', {
            cameraId: CAMERA,
            isWatching: false,
        });
        expect(decoders[0].state).toBe('closed');
        expect(generators[0].isStopped).toBe(true);
        expect(listeners.get('vd:camera-frame')?.size).toBe(0);
        expect(listeners.get('vd:camera-end')?.size).toBe(0);
        // A stream it does not know is told nothing.
        expect(listenViewerCameraLive(stream, () => {})).toBeTypeOf('function');
    });

    test('Chromium plays the stream in a video: no canvas view', async () => {
        const stream = await getViewerCameraStream(CAMERA);
        expect(createViewerCameraView(stream)).toBeNull();
        releaseViewerCameraStream(stream);
    });

    test('Safari and Firefox draw every frame into each canvas view, never a captured stream', async () => {
        vi.stubGlobal('MediaStreamTrackGenerator', undefined);
        // Each view's canvas and what was drawn into it.
        const canvases: { width: number; height: number; drawn: any[] }[] = [];
        vi.stubGlobal('document', {
            createElement: (tag: string) => {
                expect(tag).toBe('canvas');
                const canvas = {
                    width: 300,
                    height: 150,
                    drawn: [] as any[],
                    captureStream: () => {
                        throw new Error('an iPhone never paints this');
                    },
                    getContext: () => ({
                        drawImage: (frame: any) => canvas.drawn.push(frame),
                    }),
                };
                canvases.push(canvas);
                return canvas;
            },
        });
        const stream = await getViewerCameraStream(CAMERA);
        // Nothing plays it: it only names the camera.
        expect((stream as any).tracks).toBeUndefined();
        const first = createViewerCameraView(stream)!;
        const second = createViewerCameraView(stream)!;
        expect(first.element).toBe(canvases[0]);
        expect(second.element).toBe(canvases[1]);

        // Each decoded frame (640x360) is drawn, then closed.
        emit('vd:camera-frame', frame('key'));
        expect(canvases.map((canvas) => canvas.drawn.length)).toEqual([1, 1]);
        expect(canvases[0]).toMatchObject({ width: 640, height: 360 });
        expect(canvases[1]).toMatchObject({ width: 640, height: 360 });
        expect(canvases[0].drawn[0].close).toHaveBeenCalledTimes(1);

        // A view let go is drawn no more; the other still is.
        first.release();
        emit('vd:camera-frame', frame('delta'));
        expect(canvases.map((canvas) => canvas.drawn.length)).toEqual([1, 2]);

        // The stream let go: no view is drawn, and none is handed out.
        releaseViewerCameraStream(stream);
        emit('vd:camera-frame', frame('key'));
        expect(canvases[1].drawn).toHaveLength(2);
        expect(createViewerCameraView(stream)).toBeNull();
    });

    test('a packet that carries no bytes is not decoded', async () => {
        const stream = await getViewerCameraStream(CAMERA);
        emit('vd:camera-frame', { ...frame('key'), data: [1] });
        emit('vd:camera-frame', null);
        expect(decoders[0].chunks).toHaveLength(0);
        emit('vd:camera-frame', frame('key'));
        expect(decoders[0].chunks).toHaveLength(1);
        releaseViewerCameraStream(stream);
    });

    test('a page that cannot keep up drops frames until the next key frame', async () => {
        const stream = await getViewerCameraStream(CAMERA);
        emit('vd:camera-frame', frame('key'));
        const decoder = decoders[0];
        // Eight waiting is still keeping up.
        decoder.decodeQueueSize = 8;
        emit('vd:camera-frame', frame('delta'));
        expect(decoder.chunks).toHaveLength(2);
        // More than eight: dropped, a key frame too, then every delta after
        // it until a key frame, however short the queue has become.
        decoder.decodeQueueSize = 9;
        emit('vd:camera-frame', frame('key'));
        emit('vd:camera-frame', frame('delta'));
        decoder.decodeQueueSize = 0;
        emit('vd:camera-frame', frame('delta'));
        expect(decoder.chunks).toHaveLength(2);
        emit('vd:camera-frame', frame('key'));
        emit('vd:camera-frame', frame('delta'));
        expect(decoder.chunks.map((chunk) => chunk.type)).toEqual([
            'key',
            'delta',
            'key',
            'delta',
        ]);
        releaseViewerCameraStream(stream);
    });

    test('a decoder that failed is replaced, and the box hides until a key frame decodes again', async () => {
        const stream = await getViewerCameraStream(CAMERA);
        const live: boolean[] = [];
        listenViewerCameraLive(stream, (isLive) => live.push(isLive));
        emit('vd:camera-frame', frame('key'));
        expect(live).toEqual([false, true]);

        decoders[0].fail();
        // Nothing more comes from a decoder that closed itself: no frozen face.
        expect(live).toEqual([false, true, false]);
        // A delta has nothing to build on in a fresh decoder; a key frame does.
        emit('vd:camera-frame', frame('delta'));
        emit('vd:camera-frame', frame('key'));
        expect(decoders).toHaveLength(2);
        expect(decoders[1].chunks.map((chunk) => chunk.type)).toEqual(['key']);
        expect(live).toEqual([false, true, false, true]);

        releaseViewerCameraStream(stream);
        expect(decoders[1].state).toBe('closed');
        // An error after the camera was let go builds nothing new.
        decoders[1].fail();
        expect(decoders).toHaveLength(2);
    });

    test('a decoder that closed itself on an error is not closed again when the camera is let go', async () => {
        const stream = await getViewerCameraStream(CAMERA);
        emit('vd:camera-frame', frame('key'));
        decoders[0].fail();
        expect(() => releaseViewerCameraStream(stream)).not.toThrow();
        expect(sendDataMock).toHaveBeenLastCalledWith('vd:camera-watch', {
            cameraId: CAMERA,
            isWatching: false,
        });
        expect(generators[0].isStopped).toBe(true);
        expect(listeners.get('vd:camera-frame')?.size).toBe(0);
    });

    test('with no 2D canvas to draw in, no view is handed out and frames are still closed', async () => {
        vi.stubGlobal('MediaStreamTrackGenerator', undefined);
        vi.stubGlobal('document', {
            createElement: () => ({ getContext: () => null }),
        });
        const stream = await getViewerCameraStream(CAMERA);
        expect(createViewerCameraView(stream)).toBeNull();
        emit('vd:camera-frame', frame('key'));
        expect(decoders[0].frames).toHaveLength(1);
        expect(decoders[0].frames[0].close).toHaveBeenCalledTimes(1);
        releaseViewerCameraStream(stream);
    });

    test('a page with no video decoder cannot show one', async () => {
        vi.stubGlobal('VideoDecoder', undefined);
        await expect(getViewerCameraStream(CAMERA)).rejects.toThrow(
            'Camera is unavailable',
        );
        expect(sendDataMock).not.toHaveBeenCalled();
    });
});
