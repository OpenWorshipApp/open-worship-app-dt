import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { checkIsIntercomSupported, createIntercomAudio } from './intercomAudio';

type Decoder = {
    state: string;
    configure: ReturnType<typeof vi.fn>;
    decode: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    output: (data: any) => void;
    error: () => void;
};

type Encoder = {
    state: string;
    configure: ReturnType<typeof vi.fn>;
    encode: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    output: (chunk: any) => void;
    error: () => void;
};

function setupAudio() {
    const decoders: Decoder[] = [];
    const encoders: Encoder[] = [];
    const starts: number[] = [];
    const gains: Array<{
        gain: { value: number };
        connect: ReturnType<typeof vi.fn>;
        disconnect: ReturnType<typeof vi.fn>;
    }> = [];
    const sources: Array<{
        connect: ReturnType<typeof vi.fn>;
        disconnect: ReturnType<typeof vi.fn>;
    }> = [];
    const processors: Array<{
        onaudioprocess: ((event: any) => void) | null;
        connect: ReturnType<typeof vi.fn>;
        disconnect: ReturnType<typeof vi.fn>;
    }> = [];
    const contexts: Array<{
        state: string;
        currentTime: number;
        close: ReturnType<typeof vi.fn>;
        resume: ReturnType<typeof vi.fn>;
    }> = [];
    const getUserMedia = vi.fn();

    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    vi.stubGlobal(
        'AudioDecoder',
        class {
            state = 'configured';
            configure = vi.fn();
            decode = vi.fn();
            close = vi.fn(() => {
                this.state = 'closed';
            });
            output: (data: any) => void;
            error: () => void;

            constructor(callbacks: {
                output: (data: any) => void;
                error: () => void;
            }) {
                this.output = callbacks.output;
                this.error = callbacks.error;
                decoders.push(this);
            }
        },
    );
    vi.stubGlobal(
        'AudioEncoder',
        class {
            state = 'configured';
            configure = vi.fn();
            encode = vi.fn();
            close = vi.fn(() => {
                this.state = 'closed';
            });
            output: (chunk: any) => void;
            error: () => void;

            constructor(callbacks: {
                output: (chunk: any) => void;
                error: () => void;
            }) {
                this.output = callbacks.output;
                this.error = callbacks.error;
                encoders.push(this);
            }
        },
    );
    vi.stubGlobal(
        'EncodedAudioChunk',
        class {
            constructor(
                public init: {
                    type: string;
                    timestamp: number;
                    data: Uint8Array;
                },
            ) {}
        },
    );
    vi.stubGlobal(
        'AudioData',
        class {
            sampleRate!: number;
            numberOfFrames!: number;
            numberOfChannels!: number;
            timestamp!: number;
            close = vi.fn();

            constructor(init: {
                sampleRate: number;
                numberOfFrames: number;
                numberOfChannels: number;
                timestamp: number;
            }) {
                Object.assign(this, init);
            }
        },
    );
    vi.stubGlobal(
        'AudioContext',
        class {
            state = 'suspended';
            currentTime = 10;
            destination = {};
            close = vi.fn();
            resume = vi.fn(() => {
                this.state = 'running';
            });
            createGain = vi.fn(() => {
                const gain = {
                    gain: { value: 1 },
                    connect: vi.fn(),
                    disconnect: vi.fn(),
                };
                gains.push(gain);
                return gain;
            });
            createBuffer = vi.fn(() => ({
                duration: 0.02,
                getChannelData: () => new Float32Array(960),
            }));
            createBufferSource = vi.fn(() => ({
                buffer: null,
                connect: vi.fn(),
                start: (time: number) => starts.push(time),
            }));
            createMediaStreamSource = vi.fn(() => {
                const source = { connect: vi.fn(), disconnect: vi.fn() };
                sources.push(source);
                return source;
            });
            createScriptProcessor = vi.fn(() => {
                const processor = {
                    onaudioprocess: null as ((event: any) => void) | null,
                    connect: vi.fn(),
                    disconnect: vi.fn(),
                };
                processors.push(processor);
                return processor;
            });

            constructor() {
                contexts.push(this);
            }
        },
    );
    const track = { stop: vi.fn() };
    const stream = {
        getAudioTracks: () => [track],
        getTracks: () => [track],
    };
    getUserMedia.mockResolvedValue(stream);
    return {
        contexts,
        decoders,
        encoders,
        gains,
        getUserMedia,
        processors,
        sources,
        starts,
        stream,
        track,
    };
}

describe('intercom audio', () => {
    beforeEach(() => vi.unstubAllGlobals());
    afterEach(() => vi.unstubAllGlobals());

    it('requires a secure page, WebCodecs and microphone access', () => {
        setupAudio();
        expect(checkIsIntercomSupported()).toBe(true);
        vi.stubGlobal('isSecureContext', false);
        expect(checkIsIntercomSupported()).toBe(false);
        vi.stubGlobal('isSecureContext', true);
        vi.stubGlobal('AudioEncoder', undefined);
        expect(checkIsIntercomSupported()).toBe(false);
    });

    it('clamps each speaker volume, timestamps packets and plays decoded audio with a jitter cushion', () => {
        const audio = setupAudio();
        const intercom = createIntercomAudio(() => {});
        intercom.setSpeaker('guest:a', 3);
        expect(intercom.speakerKeys()).toEqual(['guest:a']);
        expect(audio.gains[0].gain.value).toBe(1);
        expect(audio.contexts[0].resume).toHaveBeenCalledOnce();
        expect(audio.decoders[0].configure).toHaveBeenCalledWith({
            codec: 'opus',
            sampleRate: 48000,
            numberOfChannels: 1,
        });

        intercom.setSpeaker('guest:a', -2);
        expect(audio.decoders).toHaveLength(1);
        expect(audio.gains[0].gain.value).toBe(0);
        intercom.receive('unknown', new Uint8Array([1]));
        intercom.receive('guest:a', new Uint8Array([1, 2]));
        intercom.receive('guest:a', new Uint8Array([3]));
        expect(audio.decoders[0].decode).toHaveBeenCalledTimes(2);
        expect(
            audio.decoders[0].decode.mock.calls.map(
                ([chunk]) => chunk.init.timestamp,
            ),
        ).toEqual([0, 20000]);

        const copyTo = vi.fn();
        const close = vi.fn();
        const decoded = {
            numberOfFrames: 960,
            sampleRate: 48000,
            copyTo,
            close,
        };
        audio.decoders[0].output(decoded);
        audio.decoders[0].output(decoded);
        expect(copyTo).toHaveBeenCalledTimes(2);
        expect(audio.starts).toEqual([10.08, 10.1]);
        expect(close).toHaveBeenCalledTimes(2);

        intercom.setSpeaker('guest:a', null);
        expect(intercom.speakerKeys()).toEqual([]);
        expect(audio.decoders[0].close).toHaveBeenCalledOnce();
        expect(audio.gains[0].disconnect).toHaveBeenCalledOnce();
        expect(audio.contexts[0].close).toHaveBeenCalledOnce();
    });

    it('closes a speaker on decoder failure and ignores invalid packets', () => {
        const audio = setupAudio();
        const intercom = createIntercomAudio(() => {});
        intercom.setSpeaker('viewer:1', 0.4);
        audio.decoders[0].state = 'closed';
        intercom.receive('viewer:1', new Uint8Array([1]));
        expect(audio.decoders[0].decode).not.toHaveBeenCalled();
        audio.decoders[0].error();
        expect(intercom.speakerKeys()).toEqual([]);
        expect(audio.gains[0].disconnect).toHaveBeenCalledOnce();
    });

    it('encodes fallback microphone frames and releases every audio resource', async () => {
        const audio = setupAudio();
        const packets: Uint8Array[] = [];
        const intercom = createIntercomAudio((packet) => packets.push(packet));
        await intercom.setMic(true);
        expect(intercom.isMicOn).toBe(true);
        expect(audio.getUserMedia).toHaveBeenCalledWith({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1,
            },
            video: false,
        });
        expect(audio.processors[0].onaudioprocess).toBeTypeOf('function');
        const samples = new Float32Array(1024);
        const inputBuffer = {
            getChannelData: () => samples,
            sampleRate: 48000,
        };
        audio.processors[0].onaudioprocess?.({ inputBuffer });
        audio.processors[0].onaudioprocess?.({ inputBuffer });
        expect(audio.encoders[0].configure).toHaveBeenCalledWith({
            codec: 'opus',
            sampleRate: 48000,
            numberOfChannels: 1,
            bitrate: 24000,
            opus: { frameDuration: 20000 },
        });
        expect(audio.encoders[0].encode).toHaveBeenCalledTimes(2);
        expect(
            audio.encoders[0].encode.mock.calls.map(
                ([frame]) => frame.timestamp,
            ),
        ).toEqual([0, 21333]);
        const copyTo = vi.fn((target: Uint8Array) => target.set([5, 6]));
        audio.encoders[0].output({ byteLength: 2, copyTo });
        expect(packets).toEqual([new Uint8Array([5, 6])]);

        await intercom.setMic(false);
        expect(intercom.isMicOn).toBe(false);
        expect(audio.processors[0].onaudioprocess).toBeNull();
        expect(audio.sources[0].disconnect).toHaveBeenCalledOnce();
        expect(audio.encoders[0].close).toHaveBeenCalledOnce();
        expect(audio.track.stop).toHaveBeenCalledOnce();
        expect(audio.contexts[0].close).toHaveBeenCalledOnce();
    });

    it('drops a microphone granted after it was switched off', async () => {
        const audio = setupAudio();
        let grant!: (stream: typeof audio.stream) => void;
        audio.getUserMedia.mockReturnValue(
            new Promise((resolve) => {
                grant = resolve;
            }),
        );
        const intercom = createIntercomAudio(() => {});
        const starting = intercom.setMic(true);
        await intercom.setMic(false);
        grant(audio.stream);
        await starting;
        expect(intercom.isMicOn).toBe(false);
        expect(audio.track.stop).toHaveBeenCalledOnce();
        expect(audio.encoders).toHaveLength(0);
    });

    it('stops the active microphone if its encoder fails', async () => {
        const audio = setupAudio();
        const intercom = createIntercomAudio(() => {});
        await intercom.setMic(true);
        audio.processors[0].onaudioprocess?.({
            inputBuffer: {
                getChannelData: () => new Float32Array(1024),
                sampleRate: 48000,
            },
        });
        audio.encoders[0].error();
        expect(intercom.isMicOn).toBe(false);
        expect(audio.track.stop).toHaveBeenCalledOnce();
        expect(audio.encoders[0].close).toHaveBeenCalledOnce();
    });

    it('cancels a track processor and closes a late frame after microphone shutdown', async () => {
        const audio = setupAudio();
        const cancel = vi.fn().mockResolvedValue(undefined);
        let deliver!: (result: { value: any; done: boolean }) => void;
        const read = vi
            .fn()
            .mockReturnValueOnce(
                new Promise((resolve) => {
                    deliver = resolve;
                }),
            )
            .mockResolvedValueOnce({ done: true });
        vi.stubGlobal(
            'MediaStreamTrackProcessor',
            class {
                readable = { getReader: () => ({ read, cancel }) };
            },
        );
        const intercom = createIntercomAudio(() => {});
        await intercom.setMic(true);
        expect(read).toHaveBeenCalledOnce();
        const frame = { close: vi.fn() };
        await intercom.setMic(false);
        deliver({ value: frame, done: false });
        await vi.waitFor(() => expect(frame.close).toHaveBeenCalledOnce());
        expect(cancel).toHaveBeenCalledOnce();
        expect(audio.encoders).toHaveLength(0);
        expect(audio.track.stop).toHaveBeenCalledOnce();
    });
});
