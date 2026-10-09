import { afterEach, beforeEach, expect, test, vi } from 'vitest';

// The muxer as a recorder: what the encoder writes, fragment by fragment.
const { written } = vi.hoisted(() => ({ written: [] as any[] }));
vi.mock('./fmp4Muxer', () => ({
    AUDIO_TRACK_ID: 2,
    VIDEO_TRACK_ID: 1,
    VIDEO_TIMESCALE: 90000,
    buildInitSegment: () => new Uint8Array([0]),
    buildFragment: (fragment: any) => {
        written.push(fragment);
        return new Uint8Array([1]);
    },
    toAudioSpecificConfig: () => new Uint8Array([2]),
}));

import { LiveMp4Encoder } from './liveMp4Encoder';

// WebCodecs, as far as the encoder uses it: a frame carries its timestamp,
// and the encoder hands each one straight back as a chunk.
class FakeVideoFrame {
    timestamp: number;
    constructor(source: { timestamp?: number }, init?: { timestamp: number }) {
        this.timestamp = init?.timestamp ?? source.timestamp ?? 0;
    }
    clone() {
        return new FakeVideoFrame(this);
    }
    close() {}
}
class FakeVideoEncoder {
    static isConfigSupported = async () => ({ supported: true });
    state = 'unconfigured';
    encodeQueueSize = 0;
    private isFirst = true;
    constructor(
        private readonly init: { output: (chunk: any, meta?: any) => void },
    ) {}
    configure() {
        this.state = 'configured';
    }
    encode(frame: FakeVideoFrame, options: { keyFrame: boolean }) {
        const meta = this.isFirst
            ? { decoderConfig: { description: new Uint8Array([9]) } }
            : undefined;
        this.isFirst = false;
        this.init.output(
            {
                timestamp: frame.timestamp,
                type: options.keyFrame ? 'key' : 'delta',
                byteLength: 1,
                copyTo: (data: Uint8Array) => data.set([7]),
            },
            meta,
        );
    }
    close() {
        this.state = 'closed';
    }
}
let pushFrame: (frame: FakeVideoFrame) => void = () => {};
class FakeProcessor {
    readable = new ReadableStream({
        start: (controller) => {
            pushFrame = (frame) => controller.enqueue(frame);
        },
    });
}

beforeEach(() => {
    written.length = 0;
    vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'performance'],
    });
    vi.stubGlobal('VideoFrame', FakeVideoFrame);
    vi.stubGlobal('VideoEncoder', FakeVideoEncoder);
    vi.stubGlobal('MediaStreamTrackProcessor', FakeProcessor);
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

async function startEncoder() {
    const encoder = new LiveMp4Encoder({
        width: 1280,
        height: 720,
        frameRate: 30,
        bitrate: 1_000_000,
        videoCodecs: ['avc1.42E01F'],
        onData: () => {},
        onLive: () => {},
        onError: (message) => {
            throw new Error(message);
        },
    });
    await encoder.start({} as MediaStreamTrack, null);
    return encoder;
}

// A frame from the capture, `afterMillisecond` from now.
async function capture(afterMillisecond: number) {
    await vi.advanceTimersByTimeAsync(afterMillisecond);
    pushFrame(new FakeVideoFrame({}));
    await vi.advanceTimersByTimeAsync(0);
}

test('every frame lasts exactly until the next: the picture has no holes', async () => {
    const encoder = await startEncoder();
    await capture(0);
    // Held until the next one says how long it lasts.
    expect(written).toHaveLength(0);
    await capture(33);
    await capture(40);
    await capture(30);
    expect(written).toHaveLength(3);
    for (let index = 1; index < written.length; index++) {
        const previous = written[index - 1];
        expect(previous.baseDecodeTime + previous.samples[0].duration).toBe(
            written[index].baseDecodeTime,
        );
    }
    expect(written.map((fragment) => fragment.samples[0].duration)).toEqual(
        [33, 40, 30].map((millisecond) => millisecond * 90),
    );
    // The first frame is the keyframe a viewer starts on.
    expect(written[0].samples[0].isKey).toBe(true);
    expect(written[1].samples[0].isKey).toBe(false);
    encoder.stop();
});

test('a still picture is sent again ten times a second, with no gaps', async () => {
    const encoder = await startEncoder();
    await capture(0);
    // Nothing new for a second: the picture again every 100 ms.
    await vi.advanceTimersByTimeAsync(1000);
    expect(written.length).toBeGreaterThanOrEqual(9);
    for (const fragment of written) {
        expect(fragment.samples[0].duration).toBe(100 * 90);
    }
    for (let index = 1; index < written.length; index++) {
        const previous = written[index - 1];
        expect(previous.baseDecodeTime + previous.samples[0].duration).toBe(
            written[index].baseDecodeTime,
        );
    }
    // Stopped: no more.
    encoder.stop();
    const count = written.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(written).toHaveLength(count);
});

test('a viewer joining gets a keyframe at once, even on a still picture', async () => {
    const encoder = await startEncoder();
    await capture(0);
    await vi.advanceTimersByTimeAsync(250);
    encoder.requestKeyFrame();
    // Made on the next tick (asked within 50 ms of a frame) and written once
    // the frame after it exists: within 200 ms.
    await vi.advanceTimersByTimeAsync(200);
    expect(
        written.some((fragment, index) => {
            return index > 0 && fragment.samples[0].isKey;
        }),
    ).toBe(true);
    encoder.stop();
});
