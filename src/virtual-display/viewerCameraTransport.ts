import appProvider from '../server/appProvider';

// A browser viewer's camera (`vd-camera:<viewer>`), shown by a window of this
// computer or by a browser drawing a screen of a virtual display: its VP8
// frames arrive (IPC here, the screen page's socket there) and this turns
// them back into a camera stream that the camera background and foreground
// draw like any other.
//
// Like a call's video it can pause: not shared yet, shared no more, or its
// browser reloading. The stream stays watched through that, and the box
// showing it hides while no pictures come (`listenViewerCameraLive`) --
// never an empty black box or a frozen face -- and shows again the moment
// they do, with nothing re-added.

const VIEWER_CAMERA_PREFIX = 'vd-camera:';
const CANVAS_FRAME_RATE = 15;

type SinkType = {
    stream: MediaStream;
    write: (frame: VideoFrame) => void;
    stop: () => void;
};
type WatchType = {
    cameraId: string;
    decoder: VideoDecoder;
    sink: SinkType;
    onFrame: (_event: unknown, data: any) => void;
    onEnd: (_event: unknown, data: any) => void;
    isLive: boolean;
    liveListeners: Set<(isLive: boolean) => void>;
};

const watches = new Map<MediaStream, WatchType>();

export function checkIsViewerCameraId(cameraId: string) {
    return cameraId.startsWith(VIEWER_CAMERA_PREFIX);
}

// Where decoded frames go: a track generator (Chromium -- the app, Chrome,
// Edge), else a canvas whose captured stream is the camera (Firefox, Safari).
function createSink(): SinkType {
    const Generator = (globalThis as any).MediaStreamTrackGenerator;
    if (typeof Generator === 'function') {
        const generator = new Generator({ kind: 'video' });
        const writer: WritableStreamDefaultWriter<VideoFrame> =
            generator.writable.getWriter();
        return {
            stream: new MediaStream([generator]),
            write: (frame) => {
                writer.write(frame).catch(() => frame.close());
            },
            stop: () => {
                void writer.close().catch(() => {});
                generator.stop();
            },
        };
    }
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context === null || typeof canvas.captureStream !== 'function') {
        throw new Error('Camera is unavailable');
    }
    const stream = canvas.captureStream(CANVAS_FRAME_RATE);
    return {
        stream,
        write: (frame) => {
            try {
                if (
                    canvas.width !== frame.displayWidth ||
                    canvas.height !== frame.displayHeight
                ) {
                    canvas.width = frame.displayWidth;
                    canvas.height = frame.displayHeight;
                }
                context.drawImage(frame, 0, 0);
            } finally {
                frame.close();
            }
        },
        stop: () => {
            stream.getTracks().forEach((track) => track.stop());
        },
    };
}

function setLive(watch: WatchType, isLive: boolean) {
    if (watch.isLive === isLive) {
        return;
    }
    watch.isLive = isLive;
    for (const listener of watch.liveListeners) {
        listener(isLive);
    }
}

function stopWatch(stream: MediaStream, watch: WatchType) {
    watches.delete(stream);
    watch.liveListeners.clear();
    appProvider.messageUtils.removeListener('vd:camera-frame', watch.onFrame);
    appProvider.messageUtils.removeListener('vd:camera-end', watch.onEnd);
    appProvider.messageUtils.sendData('vd:camera-watch', {
        cameraId: watch.cameraId,
        isWatching: false,
    });
    if (watch.decoder.state !== 'closed') {
        watch.decoder.close();
    }
    watch.sink.stop();
}

export async function getViewerCameraStream(cameraId: string) {
    if (typeof globalThis.VideoDecoder !== 'function') {
        throw new Error('Camera is unavailable');
    }
    const sink = createSink();
    const { stream } = sink;
    // A delta frame before the first key frame has nothing to build on.
    let isWaitingForKey = true;
    const decoder = new VideoDecoder({
        output: (frame) => {
            sink.write(frame);
            setLive(watch, true);
        },
        error: () => {
            isWaitingForKey = true;
        },
    });
    decoder.configure({ codec: 'vp8', optimizeForLatency: true });
    const watch: WatchType = {
        cameraId,
        decoder,
        sink,
        isLive: false,
        liveListeners: new Set(),
        onFrame: (_event, data) => {
            if (
                data?.cameraId !== cameraId ||
                !(data.data instanceof Uint8Array) ||
                decoder.state !== 'configured'
            ) {
                return;
            }
            if (isWaitingForKey && data.type !== 'key') {
                return;
            }
            isWaitingForKey = false;
            // A page that cannot keep up drops frames until a key one.
            if (decoder.decodeQueueSize > 8) {
                isWaitingForKey = true;
                return;
            }
            decoder.decode(
                new EncodedVideoChunk({
                    type: data.type === 'key' ? 'key' : 'delta',
                    timestamp: data.timestamp,
                    data: data.data,
                }),
            );
        },
        // Not shared now: paused, still watched -- sharing again starts the
        // browser's encoder for it, with a key frame first.
        onEnd: (_event, data) => {
            if (data?.cameraId === cameraId) {
                isWaitingForKey = true;
                setLive(watch, false);
            }
        },
    };
    watches.set(stream, watch);
    appProvider.messageUtils.listenForData('vd:camera-frame', watch.onFrame);
    appProvider.messageUtils.listenForData('vd:camera-end', watch.onEnd);
    appProvider.messageUtils.sendData('vd:camera-watch', {
        cameraId,
        isWatching: true,
    });
    return stream;
}

// Whether pictures come now: told at once, then on every change, until the
// returned function is called or the stream let go.
export function listenViewerCameraLive(
    stream: MediaStream,
    listener: (isLive: boolean) => void,
) {
    const watch = watches.get(stream);
    if (watch === undefined) {
        return () => {};
    }
    watch.liveListeners.add(listener);
    listener(watch.isLive);
    return () => {
        watch.liveListeners.delete(listener);
    };
}

// The camera stream let go: the browser sharing it is told when nothing shows
// it any more.
export function releaseViewerCameraStream(stream: MediaStream) {
    const watch = watches.get(stream);
    if (watch !== undefined) {
        stopWatch(stream, watch);
    }
}
