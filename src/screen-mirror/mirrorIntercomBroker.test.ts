// @vitest-environment jsdom

import { afterEach, beforeEach, expect, test, vi } from 'vitest';

// The broker's intercom with the browser's audio machinery stood in for:
// what is opened, decoded and let go on each configuration. (The encode and
// decode themselves were checked in this Electron's Chromium with a tone:
// 20 ms Opus packets of at most 121 bytes, decoded at 48 kHz mono.)
const decoders: any[] = [];
const contexts: any[] = [];

class FakeDecoder {
    state = 'unconfigured';
    decode = vi.fn();
    configure = vi.fn(() => {
        this.state = 'configured';
    });
    close = vi.fn(() => {
        this.state = 'closed';
    });
    constructor(readonly init: any) {
        decoders.push(this);
    }
}
class FakeContext {
    state = 'running';
    currentTime = 0;
    destination = {};
    close = vi.fn(async () => {});
    resume = vi.fn(async () => {});
    createGain() {
        return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
    }
    constructor() {
        contexts.push(this);
    }
}

let mod: typeof import('./mirrorIntercomBroker');

beforeEach(async () => {
    decoders.length = 0;
    contexts.length = 0;
    vi.stubGlobal('AudioDecoder', FakeDecoder);
    vi.stubGlobal('AudioContext', FakeContext);
    vi.stubGlobal(
        'EncodedAudioChunk',
        class {
            constructor(readonly init: any) {}
        },
    );
    vi.resetModules();
    mod = await import('./mirrorIntercomBroker');
});

afterEach(() => {
    mod.closeMirrorIntercom();
    vi.unstubAllGlobals();
});

test('a speaker plays its connection at its volume, and only while it is on', () => {
    mod.receiveIntercomMessage({
        type: 'config',
        isMicOn: false,
        speakers: { 'guest:a': 0.5 },
    });
    expect(decoders).toHaveLength(1);
    expect(decoders[0].configure).toHaveBeenCalledWith({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 1,
    });
    mod.receiveIntercomMessage({
        type: 'audio',
        key: 'guest:a',
        data: new Uint8Array([1, 2]),
    });
    mod.receiveIntercomMessage({
        type: 'audio',
        key: 'guest:a',
        data: new Uint8Array([3]),
    });
    // One after the other, 20 ms apart.
    expect(
        decoders[0].decode.mock.calls.map(([chunk]: any) => {
            return chunk.init.timestamp;
        }),
    ).toEqual([0, 20000]);
    // Another connection's sound, with no speaker on for it: nothing.
    mod.receiveIntercomMessage({
        type: 'audio',
        key: 'guest:b',
        data: new Uint8Array([1]),
    });
    expect(decoders).toHaveLength(1);
    // Turned off: its decoder goes, and with nothing on, the audio device.
    mod.receiveIntercomMessage({
        type: 'config',
        isMicOn: false,
        speakers: {},
    });
    expect(decoders[0].close).toHaveBeenCalled();
    expect(contexts[0].close).toHaveBeenCalled();
});

test('a volume changes the speaker it belongs to, within 0 to 1', () => {
    mod.receiveIntercomMessage({
        type: 'config',
        isMicOn: false,
        speakers: { 'link:a': 0.3, 'link:b': 4 },
    });
    expect(decoders).toHaveLength(2);
    mod.receiveIntercomMessage({
        type: 'config',
        isMicOn: false,
        speakers: { 'link:a': 0.8 },
    });
    // The same speaker kept, the other let go.
    expect(decoders).toHaveLength(2);
    expect(decoders[1].close).toHaveBeenCalled();
    expect(decoders[0].close).not.toHaveBeenCalled();
});

test('a message of no known type changes nothing', () => {
    mod.receiveIntercomMessage({ type: 'probe' } as any);
    expect(contexts).toHaveLength(0);
    expect(decoders).toHaveLength(0);
    // And an audio packet before any configuration has nowhere to go.
    mod.receiveIntercomMessage({
        type: 'audio',
        key: 'guest:a',
        data: new Uint8Array([1]),
    });
    expect(decoders).toHaveLength(0);
});

// The microphone read through a track processor, as in this Electron.
function stubMicrophone(getUserMedia: ReturnType<typeof vi.fn>) {
    const encoders: any[] = [];
    vi.stubGlobal(
        'AudioEncoder',
        class {
            state = 'configured';
            configure = vi.fn();
            encode = vi.fn();
            close = vi.fn();
            constructor(readonly init: any) {
                encoders.push(this);
            }
        },
    );
    const frame = { sampleRate: 48000, numberOfChannels: 1, close: vi.fn() };
    const read = vi
        .fn()
        .mockResolvedValueOnce({ value: frame, done: false })
        .mockReturnValue(new Promise(() => {}));
    vi.stubGlobal(
        'MediaStreamTrackProcessor',
        class {
            readable = {
                getReader: () => ({ read, cancel: vi.fn(async () => {}) }),
            };
        },
    );
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    return { encoders };
}

test("this computer's microphone packets go to the sender the broker was given", async () => {
    const track = { stop: vi.fn() };
    const getUserMedia = vi.fn(async () => ({
        getAudioTracks: () => [track],
        getTracks: () => [track],
    }));
    const { encoders } = stubMicrophone(getUserMedia);
    const sent: Uint8Array[] = [];
    mod.initMirrorIntercomBroker((data) => {
        sent.push(data);
    });
    mod.receiveIntercomMessage({ type: 'config', isMicOn: true, speakers: {} });
    await vi.waitFor(() => expect(encoders).toHaveLength(1));
    expect(getUserMedia).toHaveBeenCalledOnce();
    encoders[0].init.output({
        byteLength: 2,
        copyTo: (target: Uint8Array) => target.set([7, 8]),
    });
    expect(sent).toEqual([new Uint8Array([7, 8])]);
    // Said again, the microphone is not asked for twice.
    mod.receiveIntercomMessage({ type: 'config', isMicOn: true, speakers: {} });
    expect(getUserMedia).toHaveBeenCalledOnce();
    // Off: the microphone is let go.
    mod.receiveIntercomMessage({
        type: 'config',
        isMicOn: false,
        speakers: {},
    });
    expect(track.stop).toHaveBeenCalledOnce();
});

test('a microphone that cannot be had is reported, let go and asked for again on the next config', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const denied = new Error('Permission denied');
    const getUserMedia = vi.fn(async () => {
        throw denied;
    });
    stubMicrophone(getUserMedia);
    mod.receiveIntercomMessage({ type: 'config', isMicOn: true, speakers: {} });
    await vi.waitFor(() =>
        expect(warn).toHaveBeenCalledWith(
            'Intercom microphone is unavailable',
            denied,
        ),
    );
    expect(getUserMedia).toHaveBeenCalledOnce();
    // The wish was dropped with the failure, so the same config asks again.
    mod.receiveIntercomMessage({ type: 'config', isMicOn: true, speakers: {} });
    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(2));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
});
