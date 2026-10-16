// @vitest-environment jsdom

import { afterEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    sendData: vi.fn(),
    listener: null as null | ((event: unknown, packet: any) => void),
    listenForData: vi.fn((channel: string, callback: any) => {
        if (channel === 'mirror:camera') mocks.listener = callback;
    }),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        messageUtils: {
            sendData: mocks.sendData,
            listenForData: mocks.listenForData,
        },
    },
}));

class FakePeer {
    onicecandidate: ((event: any) => void) | null = null;
    ontrack: ((event: any) => void) | null = null;
    onconnectionstatechange: (() => void) | null = null;
    remoteDescription: any = null;
    localDescription: any = null;
    connectionState = 'new';
    close = vi.fn();
    addIceCandidate = vi.fn(async (_candidate: any) => {});
    createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'accepted' }));
    setRemoteDescription = vi.fn(async (description: any) => {
        this.remoteDescription = description;
    });
    setLocalDescription = vi.fn(async (_description: any) => {
        this.localDescription = {
            toJSON: () => ({ type: 'answer', sdp: 'accepted' }),
        };
    });
}

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

test('negotiates a mirror camera, releases streams and closes failed requests', async () => {
    const peers: FakePeer[] = [];
    let requestNumber = 0;
    vi.stubGlobal('crypto', {
        randomUUID: () => `request-${++requestNumber}`,
    });
    vi.stubGlobal(
        'RTCPeerConnection',
        class extends FakePeer {
            constructor(_configuration: any) {
                super();
                peers.push(this);
            }
        },
    );
    const {
        getMirrorCameraStream,
        releaseMirrorCameraStream,
        sendMirrorCameraPacket,
    } = await import('./mirrorCameraTransport');

    const first = getMirrorCameraStream('camera-1', 'Pulpit');
    expect(mocks.listenForData).toHaveBeenCalledOnce();
    expect(mocks.sendData).toHaveBeenCalledWith('mirror:camera-send', {
        type: 'camera-request',
        requestId: 'request-1',
        deviceId: 'camera-1',
        label: 'Pulpit',
    });
    mocks.listener?.(
        {},
        {
            requestId: 'request-1',
            candidate: { candidate: 'early' },
        },
    );
    expect(peers[0].addIceCandidate).not.toHaveBeenCalled();
    mocks.listener?.(
        {},
        {
            requestId: 'request-1',
            description: { type: 'offer', sdp: 'from-host' },
        },
    );
    await vi.waitFor(() =>
        expect(mocks.sendData).toHaveBeenCalledWith('mirror:camera-send', {
            type: 'camera-signal',
            requestId: 'request-1',
            description: { type: 'answer', sdp: 'accepted' },
        }),
    );
    expect(peers[0].addIceCandidate).toHaveBeenCalledWith({
        candidate: 'early',
    });
    mocks.listener?.(
        {},
        {
            requestId: 'request-1',
            candidate: { candidate: 'late' },
        },
    );
    await vi.waitFor(() =>
        expect(peers[0].addIceCandidate).toHaveBeenCalledWith({
            candidate: 'late',
        }),
    );
    peers[0].onicecandidate?.({
        candidate: { toJSON: () => ({ candidate: 'local' }) },
    });
    expect(mocks.sendData).toHaveBeenCalledWith('mirror:camera-send', {
        type: 'camera-signal',
        requestId: 'request-1',
        candidate: { candidate: 'local' },
    });

    const stream = { id: 'remote-stream' } as MediaStream;
    peers[0].ontrack?.({ streams: [stream] });
    expect(await first).toBe(stream);
    releaseMirrorCameraStream(stream);
    expect(peers[0].close).toHaveBeenCalledOnce();
    expect(mocks.sendData).toHaveBeenCalledWith('mirror:camera-send', {
        type: 'camera-close',
        requestId: 'request-1',
    });
    releaseMirrorCameraStream(stream);
    expect(peers[0].close).toHaveBeenCalledOnce();

    const second = getMirrorCameraStream('camera-2');
    expect(mocks.listenForData).toHaveBeenCalledOnce();
    mocks.listener?.({}, { type: 'camera-close', requestId: 'request-2' });
    await expect(second).rejects.toThrow('Camera is unavailable');
    expect(peers[1].close).toHaveBeenCalledOnce();

    const third = getMirrorCameraStream('camera-3');
    peers[2].setRemoteDescription.mockRejectedValueOnce(new Error('bad offer'));
    mocks.listener?.(
        {},
        {
            requestId: 'request-3',
            description: { type: 'offer', sdp: 'bad' },
        },
    );
    await expect(third).rejects.toThrow('Camera is unavailable');
    expect(mocks.sendData).toHaveBeenCalledWith('mirror:camera-send', {
        type: 'camera-close',
        requestId: 'request-3',
    });

    vi.useFakeTimers();
    const fourth = getMirrorCameraStream('camera-4');
    const fourthRejected = expect(fourth).rejects.toThrow(
        'Camera is unavailable',
    );
    window.dispatchEvent(new Event('beforeunload'));
    expect(mocks.sendData).toHaveBeenCalledWith('mirror:camera-send', {
        type: 'camera-close',
        requestId: 'request-4',
    });
    await vi.advanceTimersByTimeAsync(15000);
    await fourthRejected;
    expect(peers[3].close).toHaveBeenCalledOnce();

    sendMirrorCameraPacket({ type: 'probe' });
    expect(mocks.sendData).toHaveBeenCalledWith('mirror:camera-send', {
        type: 'probe',
    });
});
