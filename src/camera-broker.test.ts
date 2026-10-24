// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    handlers: new Map<string, (_event: unknown, packet: any) => void>(),
    sent: vi.fn(),
    mirrorSent: vi.fn(),
    initIntercom: vi.fn(),
    intercomSend: null as null | ((data: object) => void),
    receiveIntercom: vi.fn(),
    closeIntercom: vi.fn(),
    enumerateDevices: vi.fn(),
    getUserMedia: vi.fn(),
    tracks: [{ stop: vi.fn() }],
    peers: [] as any[],
}));

vi.mock('./server/appProvider', () => ({
    default: {
        messageUtils: {
            listenForData: (
                key: string,
                handler: (_event: unknown, packet: any) => void,
            ) => {
                state.handlers.set(key, handler);
            },
            sendData: state.sent,
        },
    },
}));
vi.mock('./screen-mirror/mirrorCameraTransport', () => ({
    sendMirrorCameraPacket: state.mirrorSent,
}));
vi.mock('./screen-mirror/mirrorIntercomBroker', () => ({
    initMirrorIntercomBroker: (send: (data: object) => void) => {
        state.intercomSend = send;
        state.initIntercom(send);
    },
    receiveIntercomMessage: state.receiveIntercom,
    closeMirrorIntercom: state.closeIntercom,
}));

class FakePeer {
    onicecandidate: ((event: any) => void) | null = null;
    onconnectionstatechange: (() => void) | null = null;
    connectionState = 'new';
    localDescription = { toJSON: () => ({ type: 'offer', sdp: 'offer' }) };
    remoteDescription: object | null = null;
    close = vi.fn();
    addTrack = vi.fn();
    addIceCandidate = vi.fn().mockResolvedValue(undefined);
    createOffer = vi.fn().mockResolvedValue({ type: 'offer', sdp: 'offer' });
    setLocalDescription = vi.fn().mockResolvedValue(undefined);
    setRemoteDescription = vi.fn().mockImplementation(async (description) => {
        this.remoteDescription = description;
    });
    setParameters = vi.fn().mockResolvedValue(undefined);
    getSenders = () => [
        {
            getParameters: () => ({ encodings: [{}] }),
            setParameters: this.setParameters,
        },
    ];

    constructor() {
        state.peers.push(this);
    }
}

async function flushPromises() {
    for (let i = 0; i < 12; i++) await Promise.resolve();
}

function emit(packet: object) {
    state.handlers.get('mirror:camera')!(null, packet);
}

beforeEach(async () => {
    state.peers.length = 0;
    state.sent.mockReset();
    state.mirrorSent.mockReset();
    state.initIntercom.mockReset();
    state.receiveIntercom.mockReset();
    state.closeIntercom.mockReset();
    state.enumerateDevices
        .mockReset()
        .mockResolvedValue([
            { kind: 'videoinput', deviceId: 'cam-1', label: 'Camera One' },
        ]);
    state.getUserMedia.mockReset().mockResolvedValue({
        getTracks: () => state.tracks,
        getVideoTracks: () => state.tracks,
    });
    state.tracks[0].stop.mockReset();
    vi.stubGlobal('RTCPeerConnection', FakePeer);
    Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
            enumerateDevices: state.enumerateDevices,
            getUserMedia: state.getUserMedia,
        },
    });
    if (state.handlers.size === 0) await import('./camera-broker');
});

afterEach(async () => {
    state.handlers.get('mirror:camera-reset')!(null, {});
    await flushPromises();
    vi.unstubAllGlobals();
});

describe('mirror camera broker', () => {
    it('shares one capture between peers and releases it after the last closes', async () => {
        emit({ type: 'camera-request', requestId: 'one', deviceId: 'cam-1' });
        emit({ type: 'camera-request', requestId: 'two', deviceId: 'cam-1' });
        await flushPromises();
        expect(state.enumerateDevices).toHaveBeenCalledOnce();
        expect(state.getUserMedia).toHaveBeenCalledOnce();
        expect(state.peers).toHaveLength(2);
        expect(state.peers[0].addTrack).toHaveBeenCalledWith(
            state.tracks[0],
            expect.any(Object),
        );
        expect(state.peers[0].setParameters).toHaveBeenCalledWith({
            encodings: [{ maxBitrate: 1_500_000, maxFramerate: 15 }],
        });
        expect(state.mirrorSent).toHaveBeenCalledWith({
            type: 'camera-signal',
            requestId: 'one',
            description: { type: 'offer', sdp: 'offer' },
        });

        emit({ type: 'camera-close', requestId: 'one' });
        await flushPromises();
        expect(state.peers[0].close).toHaveBeenCalledOnce();
        expect(state.tracks[0].stop).not.toHaveBeenCalled();
        emit({ type: 'camera-close', requestId: 'two' });
        await flushPromises();
        expect(state.peers[1].close).toHaveBeenCalledOnce();
        expect(state.tracks[0].stop).toHaveBeenCalledOnce();
    });

    it('queues candidates until the answer and forwards local candidates', async () => {
        emit({ type: 'camera-request', requestId: 'one', deviceId: 'cam-1' });
        await flushPromises();
        const peer = state.peers[0] as FakePeer;
        emit({
            type: 'camera-signal',
            requestId: 'one',
            candidate: { candidate: 'early' },
        });
        await flushPromises();
        expect(peer.addIceCandidate).not.toHaveBeenCalled();
        emit({
            type: 'camera-signal',
            requestId: 'one',
            description: { type: 'answer', sdp: 'answer' },
        });
        await flushPromises();
        expect(peer.setRemoteDescription).toHaveBeenCalledWith({
            type: 'answer',
            sdp: 'answer',
        });
        expect(peer.addIceCandidate).toHaveBeenCalledWith({
            candidate: 'early',
        });
        emit({
            type: 'camera-signal',
            requestId: 'one',
            candidate: { candidate: 'late' },
        });
        await flushPromises();
        expect(peer.addIceCandidate).toHaveBeenCalledWith({
            candidate: 'late',
        });

        peer.onicecandidate!({
            candidate: { toJSON: () => ({ candidate: 'local' }) },
        });
        expect(state.mirrorSent).toHaveBeenCalledWith({
            type: 'camera-signal',
            requestId: 'one',
            candidate: { candidate: 'local' },
        });
        peer.connectionState = 'failed';
        peer.onconnectionstatechange!();
        expect(peer.close).toHaveBeenCalledOnce();
        expect(state.mirrorSent).toHaveBeenCalledWith({
            type: 'camera-close',
            requestId: 'one',
        });
    });

    it('closes a request cancelled while capture is pending', async () => {
        let resolveCapture!: (stream: object) => void;
        state.getUserMedia.mockReturnValue(
            new Promise((resolve) => {
                resolveCapture = resolve;
            }),
        );
        emit({ type: 'camera-request', requestId: 'one', deviceId: 'cam-1' });
        await flushPromises();
        emit({ type: 'camera-close', requestId: 'one' });
        resolveCapture({
            getTracks: () => state.tracks,
            getVideoTracks: () => state.tracks,
        });
        await flushPromises();
        expect(state.peers[0].close).toHaveBeenCalledOnce();
        expect(state.peers[0].addTrack).not.toHaveBeenCalled();
        expect(state.tracks[0].stop).toHaveBeenCalledOnce();
    });

    it('reports an unavailable camera and relays intercom audio', async () => {
        state.enumerateDevices.mockResolvedValue([]);
        emit({
            type: 'camera-request',
            requestId: 'missing',
            deviceId: 'missing',
        });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await flushPromises();
        expect(warn).toHaveBeenCalledWith(
            'Mirror camera source is unavailable',
            expect.any(Error),
        );
        expect(state.mirrorSent).toHaveBeenCalledWith({
            type: 'camera-close',
            requestId: 'missing',
        });
        warn.mockRestore();

        state.intercomSend!({ bytes: [1, 2] });
        expect(state.sent).toHaveBeenCalledWith('mirror:intercom-audio', {
            bytes: [1, 2],
        });
        state.handlers.get('mirror:intercom')!(null, { kind: 'audio' });
        expect(state.receiveIntercom).toHaveBeenCalledWith({ kind: 'audio' });
        window.dispatchEvent(new Event('beforeunload'));
        expect(state.closeIntercom).toHaveBeenCalledOnce();
    });
});
