import {
    AUDIO_TRACK_ID,
    VIDEO_TIMESCALE,
    VIDEO_TRACK_ID,
    buildFragment,
    buildInitSegment,
    toAudioSpecificConfig,
    type SampleType,
} from './fmp4Muxer';

// A virtual display's live MP4: the compositor's own picture and its screens'
// mixed sound, encoded with WebCodecs and written a fragment per frame.
//
// It does only what a viewer needs: a frame the encoder cannot keep up with is
// dropped rather than queued (a queue is latency), a picture that does not
// change is re-sent once a second rather than thirty times, and a keyframe is
// made when a viewer joins rather than on a timer.

const AUDIO_SAMPLE_RATE = 48000;
const AUDIO_CHANNELS = 2;
const AAC_FRAME_SAMPLES = 1024;
// About 85 ms of sound to a fragment: four AAC frames.
const AUDIO_FRAMES_PER_FRAGMENT = 4;
const MAX_ENCODE_QUEUE = 2;

function toBytes(source: AllowSharedBufferSource) {
    return source instanceof ArrayBuffer
        ? new Uint8Array(source.slice(0))
        : new Uint8Array(
              (source as ArrayBufferView).buffer,
              (source as ArrayBufferView).byteOffset,
              (source as ArrayBufferView).byteLength,
          ).slice();
}
const IDLE_REPEAT_MILLISECOND = 1000;

type MediaStreamTrackProcessorType = new (init: {
    track: MediaStreamTrack;
}) => { readable: ReadableStream<any> };

export type LiveMp4EncoderOptionsType = {
    width: number;
    height: number;
    frameRate: number;
    bitrate: number;
    videoCodecs: string[];
    onData: (data: Uint8Array) => void;
    onLive: (description: string) => void;
    onError: (message: string) => void;
};

async function pickVideoConfig(options: LiveMp4EncoderOptionsType) {
    for (const codec of options.videoCodecs) {
        const config: VideoEncoderConfig = {
            codec,
            width: options.width,
            height: options.height,
            bitrate: options.bitrate,
            framerate: options.frameRate,
            latencyMode: 'realtime',
            avc: { format: 'avc' },
        } as VideoEncoderConfig;
        const support = await VideoEncoder.isConfigSupported(config);
        if (support.supported) {
            return config;
        }
    }
    return null;
}

async function pickAudioConfig() {
    const config: AudioEncoderConfig = {
        codec: 'mp4a.40.2',
        sampleRate: AUDIO_SAMPLE_RATE,
        numberOfChannels: AUDIO_CHANNELS,
        bitrate: 128000,
    };
    try {
        const support = await AudioEncoder.isConfigSupported(config);
        return support.supported ? config : null;
    } catch {
        return null;
    }
}

export class LiveMp4Encoder {
    private videoEncoder: VideoEncoder | null = null;
    private audioEncoder: AudioEncoder | null = null;
    private readers: ReadableStreamDefaultReader<any>[] = [];
    private lastFrame: VideoFrame | null = null;
    private lastEncodedAt = 0;
    private isKeyWanted = true;
    private isStopped = false;
    private idleTimer?: ReturnType<typeof setInterval>;
    private startedAt = performance.now();
    private lastTimestamp = -1;
    private sequence = 0;
    private avcC: Uint8Array | null = null;
    private audioSpecificConfig: Uint8Array | null = null;
    private isAudioOn = false;
    private isInitSent = false;
    private audioStart: number | null = null;
    private audioFramesWritten = 0;
    private audioPending: Uint8Array[] = [];

    constructor(private readonly options: LiveMp4EncoderOptionsType) {}

    private nowMicrosecond() {
        return Math.round((performance.now() - this.startedAt) * 1000);
    }

    // Strictly increasing, on one clock for picture and sound.
    private nextVideoTimestamp() {
        const timestamp = Math.max(
            this.nowMicrosecond(),
            this.lastTimestamp + 1,
        );
        this.lastTimestamp = timestamp;
        return timestamp;
    }

    async start(
        videoTrack: MediaStreamTrack,
        audioTrack: MediaStreamTrack | null,
    ) {
        const Processor = (globalThis as any)
            .MediaStreamTrackProcessor as MediaStreamTrackProcessorType;
        if (
            typeof Processor !== 'function' ||
            typeof VideoEncoder !== 'function'
        ) {
            throw new Error('This computer cannot make MP4 video');
        }
        const videoConfig = await pickVideoConfig(this.options);
        if (videoConfig === null) {
            throw new Error('This computer cannot make MP4 video');
        }
        const audioConfig =
            audioTrack === null ? null : await pickAudioConfig();
        this.videoEncoder = new VideoEncoder({
            output: (chunk, metadata) => this.onVideoChunk(chunk, metadata),
            error: (error) => this.fail(error),
        });
        this.videoEncoder.configure(videoConfig);
        if (audioConfig !== null && audioTrack !== null) {
            this.isAudioOn = true;
            this.audioSpecificConfig = toAudioSpecificConfig(
                AUDIO_SAMPLE_RATE,
                AUDIO_CHANNELS,
            );
            this.audioEncoder = new AudioEncoder({
                output: (chunk, metadata) => this.onAudioChunk(chunk, metadata),
                error: (error) => this.fail(error),
            });
            this.audioEncoder.configure(audioConfig);
            void this.pump(new Processor({ track: audioTrack }), (data) => {
                this.audioEncoder?.encode(data);
                data.close();
            });
        }
        void this.pump(new Processor({ track: videoTrack }), (frame) => {
            this.encodeFrame(frame);
        });
        this.idleTimer = setInterval(() => {
            if (
                performance.now() - this.lastEncodedAt >=
                IDLE_REPEAT_MILLISECOND
            ) {
                this.repeatLastFrame();
            }
        }, IDLE_REPEAT_MILLISECOND);
        this.options.onLive(
            `video/mp4; codecs="${videoConfig.codec}${this.isAudioOn ? ', mp4a.40.2' : ''}"`,
        );
    }

    private async pump(
        processor: { readable: ReadableStream<any> },
        handle: (value: any) => void,
    ) {
        const reader = processor.readable.getReader();
        this.readers.push(reader);
        while (!this.isStopped) {
            const { value, done } = await reader.read();
            if (done) {
                return;
            }
            if (this.isStopped) {
                value.close();
                return;
            }
            handle(value);
        }
    }

    private encodeFrame(frame: VideoFrame) {
        const encoder = this.videoEncoder;
        if (encoder === null || encoder.state !== 'configured') {
            frame.close();
            return;
        }
        const stamped = new VideoFrame(frame, {
            timestamp: this.nextVideoTimestamp(),
        });
        frame.close();
        this.lastFrame?.close();
        this.lastFrame = stamped.clone();
        // Behind already: this frame is dropped, never queued.
        if (encoder.encodeQueueSize > MAX_ENCODE_QUEUE && !this.isKeyWanted) {
            stamped.close();
            return;
        }
        encoder.encode(stamped, { keyFrame: this.isKeyWanted });
        this.isKeyWanted = false;
        this.lastEncodedAt = performance.now();
        stamped.close();
    }

    // The picture again, at the time it is now: a still screen is encoded
    // once a second, and a viewer who joins gets its keyframe without waiting
    // for something to move.
    private repeatLastFrame() {
        if (
            this.lastFrame === null ||
            this.videoEncoder?.state !== 'configured'
        ) {
            return;
        }
        const copy = new VideoFrame(this.lastFrame, {
            timestamp: this.nextVideoTimestamp(),
        });
        this.videoEncoder.encode(copy, { keyFrame: this.isKeyWanted });
        this.isKeyWanted = false;
        this.lastEncodedAt = performance.now();
        copy.close();
    }

    requestKeyFrame() {
        this.isKeyWanted = true;
        // Nothing moving: make it now.
        if (performance.now() - this.lastEncodedAt > 50) {
            this.repeatLastFrame();
        }
    }

    private sendInit() {
        if (this.isInitSent || this.avcC === null) {
            return;
        }
        this.isInitSent = true;
        this.options.onData(
            buildInitSegment(
                {
                    width: this.options.width,
                    height: this.options.height,
                    avcC: this.avcC,
                },
                this.isAudioOn && this.audioSpecificConfig !== null
                    ? {
                          sampleRate: AUDIO_SAMPLE_RATE,
                          channelCount: AUDIO_CHANNELS,
                          audioSpecificConfig: this.audioSpecificConfig,
                      }
                    : null,
            ),
        );
    }

    private onVideoChunk(
        chunk: EncodedVideoChunk,
        metadata?: EncodedVideoChunkMetadata,
    ) {
        const description = metadata?.decoderConfig?.description;
        if (description !== undefined && this.avcC === null) {
            this.avcC = toBytes(description);
            this.sendInit();
        }
        if (!this.isInitSent) {
            return;
        }
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        this.options.onData(
            buildFragment({
                sequence: ++this.sequence,
                trackId: VIDEO_TRACK_ID,
                baseDecodeTime: Math.round(
                    (chunk.timestamp * VIDEO_TIMESCALE) / 1_000_000,
                ),
                samples: [
                    {
                        data,
                        duration: Math.round(
                            VIDEO_TIMESCALE / this.options.frameRate,
                        ),
                        isKey: chunk.type === 'key',
                    },
                ],
            }),
        );
    }

    private onAudioChunk(
        chunk: EncodedAudioChunk,
        metadata?: EncodedAudioChunkMetadata,
    ) {
        const description = metadata?.decoderConfig?.description;
        if (description !== undefined && !this.isInitSent) {
            this.audioSpecificConfig = toBytes(description);
        }
        if (!this.isInitSent) {
            return;
        }
        // Sample-exact from the first frame on; placed on the picture's clock.
        this.audioStart ??= Math.round(
            (this.nowMicrosecond() * AUDIO_SAMPLE_RATE) / 1_000_000,
        );
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        this.audioPending.push(data);
        if (this.audioPending.length < AUDIO_FRAMES_PER_FRAGMENT) {
            return;
        }
        const samples: SampleType[] = this.audioPending
            .splice(0)
            .map((frameData) => ({
                data: frameData,
                duration: AAC_FRAME_SAMPLES,
                isKey: true,
            }));
        this.options.onData(
            buildFragment({
                sequence: ++this.sequence,
                trackId: AUDIO_TRACK_ID,
                baseDecodeTime:
                    this.audioStart +
                    this.audioFramesWritten * AAC_FRAME_SAMPLES,
                samples,
            }),
        );
        this.audioFramesWritten += samples.length;
    }

    private fail(error: unknown) {
        if (this.isStopped) {
            return;
        }
        this.stop();
        this.options.onError(
            error instanceof Error ? error.message : String(error),
        );
    }

    stop() {
        if (this.isStopped) {
            return;
        }
        this.isStopped = true;
        clearInterval(this.idleTimer);
        for (const reader of this.readers) {
            void reader.cancel().catch(() => {});
        }
        this.lastFrame?.close();
        this.lastFrame = null;
        for (const encoder of [this.videoEncoder, this.audioEncoder]) {
            if (encoder !== null && encoder.state !== 'closed') {
                encoder.close();
            }
        }
        this.videoEncoder = null;
        this.audioEncoder = null;
    }
}
