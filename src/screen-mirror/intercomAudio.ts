// The sound of an intercom, wherever it runs -- the app's hidden broker window
// or a browser watching a virtual display: this device's microphone encoded to
// Opus in 20 ms packets, and each connection's packets decoded and played at
// its own volume with a small cushion against the network's unevenness.
// Nothing of the app is imported: a browser viewer page loads it on its own.

type SpeakerType = {
    decoder: AudioDecoder;
    gain: GainNode;
    // When the next decoded packet starts, in the context's time.
    nextTime: number;
    timestamp: number;
};
type MicType = {
    stream: MediaStream;
    stop: () => void;
    encoder: AudioEncoder | null;
};

const SAMPLE_RATE = 48000;
const PACKET_MICROSECONDS = 20000;
const JITTER_SECONDS = 0.08;
const MAX_AHEAD_SECONDS = 0.5;
// A microphone read through a script processor, where a track processor is
// missing (Firefox, Safari): frames of this many samples.
const FALLBACK_FRAMES = 1024;

// Whether this page can capture and play an intercom at all: WebCodecs and a
// microphone need a secure page (https, or this computer itself).
export function checkIsIntercomSupported() {
    return (
        globalThis.isSecureContext === true &&
        typeof globalThis.AudioEncoder === 'function' &&
        typeof globalThis.AudioDecoder === 'function' &&
        typeof navigator !== 'undefined' &&
        typeof navigator.mediaDevices?.getUserMedia === 'function'
    );
}

export function createIntercomAudio(onPacket: (data: Uint8Array) => void) {
    let context: AudioContext | null = null;
    const speakers = new Map<string, SpeakerType>();
    let mic: MicType | null = null;
    let micRun = 0;

    const getContext = () => {
        if (context === null) {
            context = new AudioContext({
                sampleRate: SAMPLE_RATE,
                latencyHint: 'interactive',
            });
        }
        if (context.state === 'suspended') {
            void context.resume();
        }
        return context;
    };

    const play = (speaker: SpeakerType, data: AudioData) => {
        const audio = getContext();
        try {
            const buffer = audio.createBuffer(
                1,
                data.numberOfFrames,
                data.sampleRate,
            );
            data.copyTo(buffer.getChannelData(0), {
                planeIndex: 0,
                format: 'f32-planar',
            });
            const now = audio.currentTime;
            if (
                speaker.nextTime < now + 0.01 ||
                speaker.nextTime > now + MAX_AHEAD_SECONDS
            ) {
                speaker.nextTime = now + JITTER_SECONDS;
            }
            const source = audio.createBufferSource();
            source.buffer = buffer;
            source.connect(speaker.gain);
            source.start(speaker.nextTime);
            speaker.nextTime += buffer.duration;
        } finally {
            data.close();
        }
    };

    const closeSpeaker = (key: string) => {
        const speaker = speakers.get(key);
        if (speaker === undefined) {
            return;
        }
        speakers.delete(key);
        if (speaker.decoder.state !== 'closed') {
            speaker.decoder.close();
        }
        speaker.gain.disconnect();
    };

    const openSpeaker = (key: string) => {
        const audio = getContext();
        const gain = audio.createGain();
        gain.connect(audio.destination);
        const speaker: SpeakerType = {
            gain,
            nextTime: 0,
            timestamp: 0,
            decoder: new AudioDecoder({
                output: (data) => play(speaker, data),
                error: () => closeSpeaker(key),
            }),
        };
        speaker.decoder.configure({
            codec: 'opus',
            sampleRate: SAMPLE_RATE,
            numberOfChannels: 1,
        });
        speakers.set(key, speaker);
        return speaker;
    };

    const stopMic = () => {
        micRun++;
        const current = mic;
        mic = null;
        if (current === null) {
            return;
        }
        current.stop();
        if (current.encoder !== null && current.encoder.state !== 'closed') {
            current.encoder.close();
        }
        for (const track of current.stream.getTracks()) {
            track.stop();
        }
    };

    // Encodes one frame; the encoder takes the first frame's own rate and
    // channels -- the far side always decodes mono at 48 kHz (Opus carries
    // both).
    const encode = (current: MicType, frame: AudioData) => {
        try {
            if (mic !== current) {
                return;
            }
            if (current.encoder === null) {
                const encoder = new AudioEncoder({
                    output: (chunk) => {
                        const data = new Uint8Array(chunk.byteLength);
                        chunk.copyTo(data);
                        onPacket(data);
                    },
                    error: () => {
                        if (mic === current) {
                            stopMic();
                        }
                    },
                });
                encoder.configure({
                    codec: 'opus',
                    sampleRate: frame.sampleRate,
                    numberOfChannels: frame.numberOfChannels,
                    bitrate: 24000,
                    opus: { frameDuration: PACKET_MICROSECONDS },
                } as AudioEncoderConfig);
                current.encoder = encoder;
            }
            if (current.encoder.state === 'configured') {
                current.encoder.encode(frame);
            }
        } finally {
            frame.close();
        }
    };

    // A track processor where there is one (Chromium); else a script
    // processor that builds the frames itself.
    const readMic = (current: MicType, track: MediaStreamTrack) => {
        const Processor = (globalThis as any).MediaStreamTrackProcessor;
        if (typeof Processor === 'function') {
            const reader: ReadableStreamDefaultReader<AudioData> =
                new Processor({ track }).readable.getReader();
            current.stop = () => {
                void reader.cancel().catch(() => {});
            };
            void (async () => {
                for (;;) {
                    const { value, done } = await reader.read();
                    if (done || value === undefined) {
                        break;
                    }
                    encode(current, value);
                }
            })();
            return;
        }
        const audio = getContext();
        const source = audio.createMediaStreamSource(current.stream);
        const processor = audio.createScriptProcessor(FALLBACK_FRAMES, 1, 1);
        let timestamp = 0;
        processor.onaudioprocess = (event) => {
            const samples = event.inputBuffer.getChannelData(0);
            const frame = new AudioData({
                format: 'f32-planar',
                sampleRate: event.inputBuffer.sampleRate,
                numberOfFrames: samples.length,
                numberOfChannels: 1,
                timestamp,
                data: samples,
            });
            timestamp += Math.round(
                (samples.length / event.inputBuffer.sampleRate) * 1e6,
            );
            encode(current, frame);
        };
        source.connect(processor);
        // A script processor runs only when connected onward; nothing of the
        // microphone is heard here.
        const silence = audio.createGain();
        silence.gain.value = 0;
        processor.connect(silence);
        silence.connect(audio.destination);
        current.stop = () => {
            processor.onaudioprocess = null;
            source.disconnect();
            processor.disconnect();
            silence.disconnect();
        };
    };

    const releaseIfIdle = () => {
        if (mic === null && speakers.size === 0 && context !== null) {
            void context.close();
            context = null;
        }
    };

    return {
        // This device's microphone on or off; rejects when it cannot be had.
        async setMic(isOn: boolean) {
            if (!isOn) {
                stopMic();
                releaseIfIdle();
                return;
            }
            if (mic !== null) {
                return;
            }
            const run = ++micRun;
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                },
                video: false,
            });
            const [track] = stream.getAudioTracks();
            if (run !== micRun || track === undefined) {
                stream.getTracks().forEach((item) => item.stop());
                return;
            }
            const current: MicType = {
                stream,
                stop: () => {},
                encoder: null,
            };
            mic = current;
            readMic(current, track);
        },
        get isMicOn() {
            return mic !== null;
        },
        // A connection's speaker at a volume from 0 to 1, or off (null).
        setSpeaker(key: string, volume: number | null) {
            if (volume === null) {
                closeSpeaker(key);
                releaseIfIdle();
                return;
            }
            const speaker = speakers.get(key) ?? openSpeaker(key);
            speaker.gain.gain.value = Math.min(1, Math.max(0, volume));
        },
        speakerKeys() {
            return [...speakers.keys()];
        },
        // One packet of that connection's sound, if its speaker is on.
        receive(key: string, data: Uint8Array) {
            const speaker = speakers.get(key);
            if (
                speaker === undefined ||
                speaker.decoder.state !== 'configured' ||
                !(data instanceof Uint8Array)
            ) {
                return;
            }
            speaker.decoder.decode(
                new EncodedAudioChunk({
                    type: 'key',
                    timestamp: speaker.timestamp,
                    data,
                }),
            );
            speaker.timestamp += PACKET_MICROSECONDS;
        },
        close() {
            stopMic();
            for (const key of [...speakers.keys()]) {
                closeSpeaker(key);
            }
            void context?.close();
            context = null;
        },
    };
}

export type IntercomAudioType = ReturnType<typeof createIntercomAudio>;
