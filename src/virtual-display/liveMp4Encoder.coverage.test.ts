import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The muxer as a recorder: the init segment's tracks and every fragment.
const { written, inits } = vi.hoisted(() => ({
    written: [] as any[],
    inits: [] as Array<{ video: any; audio: any }>,
}));
vi.mock('./fmp4Muxer', () => ({
    AUDIO_TRACK_ID: 2,
    VIDEO_TRACK_ID: 1,
    VIDEO_TIMESCALE: 90000,
    buildInitSegment: (video: any, audio: any) => {
        inits.push({ video, audio });
        return new Uint8Array([0]);
    },
    buildFragment: (fragment: any) => {
        written.push(fragment);
        return new Uint8Array([1]);
    },
    toAudioSpecificConfig: () => new Uint8Array([2]),
}));

import { LiveMp4Encoder } from './liveMp4Encoder';

// WebCodecs and the track processor, as far as the encoder uses them, with
// switches for what a weaker computer answers.
const fake = {
    videoSupported: (_codec: string) => true,
    audioSupport: async (): Promise<{ supported: boolean }> => ({
        supported: true,
    }),
    // The first video chunk carries the avcC; off, the first one does not.
    videoDescribesFirst: true,
    audioDescription: null as null | AllowSharedBufferSource,
};
const videoConfigs: any[] = [];
const videoEncoders: FakeVideoEncoder[] = [];
const audioEncoders: FakeAudioEncoder[] = [];
const closedFrames: FakeVideoFrame[] = [];
const streams = new Map<
    unknown,
    { push: (value: any) => void; end: () => void; cancelled: () => boolean }
>();

class FakeVideoFrame {
    timestamp: number;
    isClosed = false;
    constructor(source: { timestamp?: number }, init?: { timestamp: number }) {
        this.timestamp = init?.timestamp ?? source.timestamp ?? 0;
    }
    clone() {
        return new FakeVideoFrame(this);
    }
    close() {
        this.isClosed = true;
        closedFrames.push(this);
    }
}

class FakeVideoEncoder {
    static isConfigSupported = async (config: any) => {
        videoConfigs.push(config);
        return { supported: fake.videoSupported(config.codec) };
    };
    state = 'unconfigured';
    encodeQueueSize = 0;
    encoded: Array<{ timestamp: number; keyFrame: boolean }> = [];
    configured: any = null;
    private count = 0;
    constructor(
        readonly init: {
            output: (chunk: any, meta?: any) => void;
            error: (error: unknown) => void;
        },
    ) {
        videoEncoders.push(this);
    }
    configure(config: any) {
        this.configured = config;
        this.state = 'configured';
    }
    encode(frame: FakeVideoFrame, options: { keyFrame: boolean }) {
        this.encoded.push({
            timestamp: frame.timestamp,
            keyFrame: options.keyFrame,
        });
        this.count++;
        const describes = fake.videoDescribesFirst
            ? this.count === 1
            : this.count === 2;
        this.init.output(
            {
                timestamp: frame.timestamp,
                type: options.keyFrame ? 'key' : 'delta',
                byteLength: 1,
                copyTo: (data: Uint8Array) => data.set([7]),
            },
            describes
                ? { decoderConfig: { description: new Uint8Array([9, 9]) } }
                : undefined,
        );
    }
    close() {
        this.state = 'closed';
    }
}

class FakeAudioEncoder {
    static isConfigSupported = async () => fake.audioSupport();
    state = 'unconfigured';
    configured: any = null;
    encoded: any[] = [];
    private count = 0;
    constructor(
        readonly init: {
            output: (chunk: any, meta?: any) => void;
            error: (error: unknown) => void;
        },
    ) {
        audioEncoders.push(this);
    }
    configure(config: any) {
        this.configured = config;
        this.state = 'configured';
    }
    encode(data: any) {
        this.encoded.push(data);
        this.count++;
        this.init.output(
            {
                byteLength: 2,
                copyTo: (target: Uint8Array) => target.set([5, this.count]),
            },
            this.count === 1 && fake.audioDescription !== null
                ? { decoderConfig: { description: fake.audioDescription } }
                : undefined,
        );
    }
    close() {
        this.state = 'closed';
    }
}

class FakeProcessor {
    readable: ReadableStream<any>;
    constructor({ track }: { track: unknown }) {
        let isCancelled = false;
        this.readable = new ReadableStream({
            start: (controller) => {
                streams.set(track, {
                    push: (value) => controller.enqueue(value),
                    end: () => controller.close(),
                    cancelled: () => isCancelled,
                });
            },
            cancel: () => {
                isCancelled = true;
            },
        });
    }
}

const videoTrack = { kind: 'video' } as unknown as MediaStreamTrack;
const audioTrack = { kind: 'audio' } as unknown as MediaStreamTrack;

function makeEncoder(patch: Record<string, unknown> = {}) {
    const calls = {
        live: [] as string[],
        errors: [] as string[],
        data: [] as Uint8Array[],
    };
    const encoder = new LiveMp4Encoder({
        width: 1280,
        height: 720,
        frameRate: 30,
        bitrate: 1_000_000,
        videoCodecs: ['avc1.640028', 'avc1.42E01F'],
        onData: (data) => calls.data.push(data),
        onLive: (description) => calls.live.push(description),
        onError: (message) => calls.errors.push(message),
        ...patch,
    });
    return { encoder, calls };
}

async function flush(millisecond = 0) {
    await vi.advanceTimersByTimeAsync(millisecond);
}

function pushVideo() {
    const frame = new FakeVideoFrame({});
    streams.get(videoTrack)!.push(frame);
    return frame;
}

function pushAudio() {
    const data = { close: vi.fn() };
    streams.get(audioTrack)!.push(data);
    return data;
}

beforeEach(() => {
    written.length = 0;
    inits.length = 0;
    videoConfigs.length = 0;
    videoEncoders.length = 0;
    audioEncoders.length = 0;
    closedFrames.length = 0;
    streams.clear();
    fake.videoSupported = () => true;
    fake.audioSupport = async () => ({ supported: true });
    fake.videoDescribesFirst = true;
    fake.audioDescription = null;
    vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'performance'],
    });
    vi.stubGlobal('VideoFrame', FakeVideoFrame);
    vi.stubGlobal('VideoEncoder', FakeVideoEncoder);
    vi.stubGlobal('AudioEncoder', FakeAudioEncoder);
    vi.stubGlobal('MediaStreamTrackProcessor', FakeProcessor);
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('LiveMp4Encoder.start refuses what it cannot make', () => {
    test('without a track processor it cannot make MP4 video', async () => {
        vi.stubGlobal('MediaStreamTrackProcessor', undefined);
        const { encoder, calls } = makeEncoder();
        await expect(encoder.start(videoTrack, null)).rejects.toThrow(
            'This computer cannot make MP4 video',
        );
        expect(videoEncoders).toHaveLength(0);
        expect(calls.live).toEqual([]);
    });

    test('without WebCodecs it cannot make MP4 video', async () => {
        vi.stubGlobal('VideoEncoder', undefined);
        const { encoder } = makeEncoder();
        await expect(encoder.start(videoTrack, null)).rejects.toThrow(
            'This computer cannot make MP4 video',
        );
    });

    test('with no codec supported it asks each one, in order, then refuses', async () => {
        fake.videoSupported = () => false;
        const { encoder, calls } = makeEncoder();
        await expect(encoder.start(videoTrack, audioTrack)).rejects.toThrow(
            'This computer cannot make MP4 video',
        );
        expect(videoConfigs).toEqual([
            {
                codec: 'avc1.640028',
                width: 1280,
                height: 720,
                bitrate: 1_000_000,
                framerate: 30,
                latencyMode: 'realtime',
                avc: { format: 'avc' },
            },
            expect.objectContaining({ codec: 'avc1.42E01F' }),
        ]);
        expect(videoEncoders).toHaveLength(0);
        expect(audioEncoders).toHaveLength(0);
        expect(calls.live).toEqual([]);
    });

    test('the first supported codec is the one configured', async () => {
        fake.videoSupported = (codec) => codec === 'avc1.42E01F';
        const { encoder, calls } = makeEncoder();
        await encoder.start(videoTrack, null);
        expect(videoEncoders[0].configured.codec).toBe('avc1.42E01F');
        expect(calls.live).toEqual(['video/mp4; codecs="avc1.42E01F"']);
        encoder.stop();
    });
});

describe('LiveMp4Encoder sound', () => {
    test('with AAC it says so, and writes four AAC frames to a fragment', async () => {
        const { encoder, calls } = makeEncoder();
        await encoder.start(videoTrack, audioTrack);
        expect(calls.live).toEqual([
            'video/mp4; codecs="avc1.640028, mp4a.40.2"',
        ]);
        expect(audioEncoders[0].configured).toEqual({
            codec: 'mp4a.40.2',
            sampleRate: 48000,
            numberOfChannels: 2,
            bitrate: 128000,
        });

        // Sound before the picture's first chunk is dropped: no init yet.
        const early = pushAudio();
        await flush();
        expect(audioEncoders[0].encoded).toEqual([early]);
        expect(early.close).toHaveBeenCalledOnce();
        expect(written).toEqual([]);

        pushVideo();
        await flush();
        expect(inits).toHaveLength(1);
        expect(inits[0].video).toEqual({
            width: 1280,
            height: 720,
            avcC: new Uint8Array([9, 9]),
        });
        expect(inits[0].audio).toEqual({
            sampleRate: 48000,
            channelCount: 2,
            audioSpecificConfig: new Uint8Array([2]),
        });

        await flush(40);
        for (let index = 0; index < 7; index++) {
            pushAudio();
        }
        await flush();
        const audio = written.filter((fragment) => fragment.trackId === 2);
        // Seven frames: one fragment of four, three still pending.
        expect(audio).toHaveLength(1);
        expect(audio[0].samples).toHaveLength(4);
        for (const sample of audio[0].samples) {
            expect(sample.duration).toBe(1024);
            expect(sample.isKey).toBe(true);
        }
        expect(audio[0].samples.map((sample: any) => [...sample.data])).toEqual(
            [
                [5, 2],
                [5, 3],
                [5, 4],
                [5, 5],
            ],
        );
        // On the picture's clock: 40 ms in, at 48 kHz.
        const start = audio[0].baseDecodeTime;
        expect(start).toBe(Math.round((40_000 * 48000) / 1_000_000));

        pushAudio();
        await flush();
        const next = written.filter((fragment) => fragment.trackId === 2);
        expect(next).toHaveLength(2);
        // Sample-exact after the first: four frames later.
        expect(next[1].baseDecodeTime).toBe(start + 4 * 1024);
        expect(next[1].sequence).toBeGreaterThan(next[0].sequence);
        encoder.stop();
    });

    test('a description the sound encoder gives before the init replaces the default', async () => {
        const buffer = new Uint8Array([0x12, 0x10]).buffer;
        fake.audioDescription = buffer;
        const { encoder } = makeEncoder();
        await encoder.start(videoTrack, audioTrack);
        pushAudio();
        await flush();
        // Copied, not kept: the encoder may reuse its buffer.
        new Uint8Array(buffer).set([0, 0]);
        pushVideo();
        await flush();
        expect(inits[0].audio.audioSpecificConfig).toEqual(
            new Uint8Array([0x12, 0x10]),
        );
        encoder.stop();
    });

    test('a computer without AAC makes a silent MP4 and never reads the sound', async () => {
        fake.audioSupport = async () => ({ supported: false });
        const first = makeEncoder();
        await first.encoder.start(videoTrack, audioTrack);
        expect(first.calls.live).toEqual(['video/mp4; codecs="avc1.640028"']);
        expect(audioEncoders).toHaveLength(0);
        expect(streams.has(audioTrack)).toBe(false);
        first.encoder.stop();

        fake.audioSupport = async () => {
            throw new Error('AudioEncoder is not allowed');
        };
        const second = makeEncoder();
        await second.encoder.start(videoTrack, audioTrack);
        expect(second.calls.live).toEqual(['video/mp4; codecs="avc1.640028"']);
        expect(second.calls.errors).toEqual([]);
        expect(audioEncoders).toHaveLength(0);

        pushVideo();
        await flush();
        expect(inits[0].audio).toBeNull();
        second.encoder.stop();
    });
});

describe('LiveMp4Encoder picture edges', () => {
    test('a first chunk with no avcC is not written; the first described one starts it', async () => {
        fake.videoDescribesFirst = false;
        const { encoder } = makeEncoder();
        await encoder.start(videoTrack, null);
        pushVideo();
        await flush();
        expect(inits).toHaveLength(0);
        await flush(33);
        pushVideo();
        await flush();
        expect(inits).toHaveLength(1);
        // That one is held for the next; the one before it is gone.
        expect(written).toEqual([]);
        await flush(33);
        pushVideo();
        await flush();
        expect(written).toHaveLength(1);
        expect(written[0].samples[0].duration).toBe(33 * 90);
        encoder.stop();
    });

    test('a frame the encoder is behind on is dropped, but kept for repeats', async () => {
        const { encoder } = makeEncoder();
        await encoder.start(videoTrack, null);
        pushVideo();
        await flush();
        const video = videoEncoders[0];
        expect(video.encoded).toHaveLength(1);

        video.encodeQueueSize = 3;
        await flush(20);
        const dropped = pushVideo();
        await flush();
        expect(video.encoded).toHaveLength(1);
        expect(dropped.isClosed).toBe(true);

        // A viewer joining still gets its keyframe: the queue does not drop it.
        encoder.requestKeyFrame();
        await flush(20);
        pushVideo();
        await flush();
        expect(video.encoded.at(-1)!.keyFrame).toBe(true);
        encoder.stop();
    });

    test('a frame that arrives after the encoder closed is only closed', async () => {
        const { encoder } = makeEncoder();
        await encoder.start(videoTrack, null);
        videoEncoders[0].state = 'closed';
        const frame = pushVideo();
        await flush();
        expect(frame.isClosed).toBe(true);
        expect(videoEncoders[0].encoded).toEqual([]);
        // Nothing to repeat either.
        await flush(500);
        expect(videoEncoders[0].encoded).toEqual([]);
        encoder.stop();
    });

    test('a keyframe asked for before any picture makes nothing', async () => {
        const { encoder } = makeEncoder();
        await encoder.start(videoTrack, null);
        await flush(100);
        encoder.requestKeyFrame();
        await flush(300);
        expect(videoEncoders[0].encoded).toEqual([]);
        // The next real frame is the keyframe.
        pushVideo();
        await flush();
        expect(videoEncoders[0].encoded).toEqual([
            expect.objectContaining({ keyFrame: true }),
        ]);
        encoder.stop();
    });

    test('a capture that ends stops reading without an error', async () => {
        const { encoder, calls } = makeEncoder();
        await encoder.start(videoTrack, null);
        pushVideo();
        streams.get(videoTrack)!.end();
        await flush();
        expect(videoEncoders[0].encoded).toHaveLength(1);
        expect(calls.errors).toEqual([]);
        encoder.stop();
    });

    test('a frame read just as it stops is closed, not encoded', async () => {
        const { encoder } = makeEncoder();
        await encoder.start(videoTrack, null);
        const frame = pushVideo();
        encoder.stop();
        await flush();
        expect(frame.isClosed).toBe(true);
        expect(videoEncoders).toHaveLength(1);
        expect(videoEncoders[0].encoded).toEqual([]);
    });
});

describe('LiveMp4Encoder failing and stopping', () => {
    test('an encoder error stops everything and is reported once', async () => {
        const { encoder, calls } = makeEncoder();
        await encoder.start(videoTrack, audioTrack);
        pushVideo();
        await flush();
        const video = videoEncoders[0];
        const audio = audioEncoders[0];

        video.init.error(new Error('Encoder lost the GPU'));
        expect(calls.errors).toEqual(['Encoder lost the GPU']);
        expect(video.state).toBe('closed');
        expect(audio.state).toBe('closed');
        expect(streams.get(videoTrack)!.cancelled()).toBe(true);
        expect(streams.get(audioTrack)!.cancelled()).toBe(true);
        // The frame kept for repeats is let go.
        expect(closedFrames.length).toBeGreaterThan(0);

        // Stopped: a second failure is not reported, nothing more is made.
        audio.init.error('late');
        expect(calls.errors).toEqual(['Encoder lost the GPU']);
        const count = video.encoded.length;
        await flush(1000);
        expect(video.encoded).toHaveLength(count);
    });

    test('a failure that is not an Error is reported as its text', async () => {
        const { encoder, calls } = makeEncoder();
        await encoder.start(videoTrack, audioTrack);
        audioEncoders[0].init.error('AAC encoder crashed');
        expect(calls.errors).toEqual(['AAC encoder crashed']);
        // Stopped already: stopping again changes nothing.
        encoder.stop();
        expect(calls.errors).toEqual(['AAC encoder crashed']);
    });

    test('stop leaves an encoder that closed itself alone', async () => {
        const { encoder } = makeEncoder();
        await encoder.start(videoTrack, null);
        const video = videoEncoders[0];
        video.state = 'closed';
        const close = vi.spyOn(video, 'close');
        encoder.stop();
        expect(close).not.toHaveBeenCalled();
        encoder.stop();
        expect(close).not.toHaveBeenCalled();
    });
});
