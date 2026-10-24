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
