// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The module reads `navigator.mediaDevices` ONCE, at load, so the stand-in is
// put there before anything is imported and only its functions change.
const h = vi.hoisted(() => {
    const mediaDevices = {
        enumerateDevices: vi.fn(),
        getUserMedia: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    };
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        configurable: true,
        value: mediaDevices,
    });
    return {
        mediaDevices,
        listeners: {} as Record<string, () => void>,
        sendDataSync: vi.fn(),
        sendData: vi.fn(),
        removeListener: vi.fn(),
        electronSendAsync: vi.fn(),
        handleError: vi.fn(),
        getMirrorCameraStream: vi.fn(),
        createViewerCameraView: vi.fn(),
    };
});

vi.mock('../server/electronSendHelpers', () => ({
    electronSendAsync: h.electronSendAsync,
}));
vi.mock('./errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('./mediaHelpers', () => ({ playMediaElement: vi.fn() }));
vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
        messageUtils: {
            sendDataSync: h.sendDataSync,
            sendData: h.sendData,
            listenForData: (channel: string, callback: () => void) => {
                h.listeners[channel] = callback;
            },
            removeListener: h.removeListener,
        },
    },
}));
vi.mock('../screen-mirror/mirrorCameraTransport', () => ({
    getMirrorCameraStream: h.getMirrorCameraStream,
    releaseMirrorCameraStream: vi.fn(),
}));
vi.mock('../virtual-display/viewerCameraTransport', () => ({
    checkIsViewerCameraId: (cameraId: string) => {
        return cameraId.startsWith('viewer-camera:');
    },
    createViewerCameraView: h.createViewerCameraView,
    getViewerCameraStream: vi.fn(),
    listenViewerCameraLive: () => () => {},
    releaseViewerCameraStream: vi.fn(),
}));

import {
    acquireCameraStream,
    createCameraCanvasView,
    getAllCameraDevices,
    getCameraAndShowMedia,
    getCameraStream,
    releaseCameraStream,
    useCameraInfoList,
} from './cameraHelpers';

const FRONT = {
    kind: 'videoinput',
    deviceId: 'front-id',
    groupId: 'g1',
    label: 'Front Camera',
};
const MIC = {
    kind: 'audioinput',
    deviceId: 'mic',
    groupId: 'g2',
    label: 'Mic',
};

function genStream() {
    const stop = vi.fn();
    return { stop, stream: { getTracks: () => [{ stop }] } };
}

// `mirror:cameras` is the other computers' cameras; `mirror:state` this one.
function answerMirror(cameras: unknown[], stateId: string | null = null) {
    h.sendDataSync.mockImplementation((channel: string) => {
        if (channel === 'mirror:cameras') {
            return cameras;
        }
        return stateId === null ? null : { id: stateId };
    });
}

beforeEach(() => {
    h.electronSendAsync.mockResolvedValue(true);
    h.mediaDevices.enumerateDevices.mockResolvedValue([MIC, FRONT]);
    h.createViewerCameraView.mockReturnValue(null);
    answerMirror([]);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('getAllCameraDevices', () => {
    test('tells the mirror this computer’s cameras and lists the remote ones after', async () => {
        const remote = {
            deviceId: 'mirror-camera:host2:x',
            groupId: '',
            label: 'a1: Hall Camera',
        };
        answerMirror([remote]);
        const cameras = await getAllCameraDevices();
        expect(cameras).toEqual([FRONT, remote]);
        expect(h.sendData).toHaveBeenCalledWith('mirror:physical-cameras', [
            { deviceId: 'front-id', label: 'Front Camera', groupId: 'g1' },
        ]);
    });
});

describe('useCameraInfoList', () => {
    let host: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        host = document.createElement('div');
        document.body.append(host);
        root = createRoot(host);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        host.remove();
        vi.unstubAllGlobals();
    });

    test('refreshes when a camera is plugged in or a mirror changes, and lets go on unmount', async () => {
        const seen: string[][] = [];
        function ProbeComp() {
            seen.push(useCameraInfoList().map((camera) => camera.label));
            return null;
        }
        await act(async () => root.render(<ProbeComp />));
        expect(seen.at(-1)).toEqual(['Front Camera']);
        const [eventName, onDeviceChange] =
            h.mediaDevices.addEventListener.mock.calls[0];
        expect(eventName).toBe('devicechange');

        h.mediaDevices.enumerateDevices.mockResolvedValue([
            FRONT,
            { ...FRONT, deviceId: 'usb-id', label: 'USB Camera' },
        ]);
        await act(async () => onDeviceChange());
        expect(seen.at(-1)).toEqual(['Front Camera', 'USB Camera']);

        answerMirror([
            { deviceId: 'mirror-camera:host2:x', groupId: '', label: 'Hall' },
        ]);
        await act(async () => h.listeners['mirror:devices-changed']());
        expect(seen.at(-1)).toEqual(['Front Camera', 'USB Camera', 'Hall']);

        await act(async () => root.unmount());
        expect(h.removeListener).toHaveBeenCalledWith(
            'mirror:devices-changed',
            h.listeners['mirror:devices-changed'],
        );
        expect(h.mediaDevices.removeEventListener).toHaveBeenCalledWith(
            'devicechange',
            onDeviceChange,
        );
        root = createRoot(host);
    });
});

describe('getCameraStream for a mirrored camera', () => {
    test('this computer’s own camera, named through the mirror, is opened here by its id', async () => {
        answerMirror([], 'host1');
        h.mediaDevices.enumerateDevices.mockResolvedValue([MIC, FRONT]);
        const { stream } = genStream();
        h.mediaDevices.getUserMedia.mockResolvedValue(stream);

        expect(await getCameraStream('mirror-camera:host1:front-id')).toBe(
            stream,
        );
        expect(h.mediaDevices.getUserMedia).toHaveBeenCalledWith({
            audio: false,
            video: { deviceId: { exact: 'front-id' } },
        });
        expect(h.getMirrorCameraStream).not.toHaveBeenCalled();
    });

    test('…or by its label when the id rotated', async () => {
        answerMirror(
            [
                {
                    deviceId: 'mirror-camera:host1:stale-id',
                    groupId: '',
                    label: 'a2: Front Camera',
                },
            ],
            'host1',
        );
        h.mediaDevices.getUserMedia.mockResolvedValue(genStream().stream);
        await getCameraStream('mirror-camera:host1:stale-id');
        expect(h.mediaDevices.getUserMedia).toHaveBeenCalledWith({
            audio: false,
            video: { deviceId: { exact: 'front-id' } },
        });
    });

    test('…and is unavailable when it is not plugged in', async () => {
        answerMirror([], 'host1');
        await expect(
            getCameraStream('mirror-camera:host1:gone-id'),
        ).rejects.toThrow('Camera is unavailable');
        expect(h.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    });

    test('another computer’s camera comes over the mirror, by its plain name', async () => {
        answerMirror(
            [
                {
                    deviceId: 'mirror-camera:host2:cam',
                    groupId: '',
                    label: 'a1: Hall Camera',
                },
            ],
            'host1',
        );
        const { stream } = genStream();
        h.getMirrorCameraStream.mockResolvedValue(stream);
        expect(await getCameraStream('mirror-camera:host2:cam')).toBe(stream);
        expect(h.getMirrorCameraStream).toHaveBeenCalledWith(
            'mirror-camera:host2:cam',
            'Hall Camera',
        );

        // Not listed (yet): asked for with no name.
        answerMirror([], null);
        await getCameraStream('mirror-camera:host3:cam');
        expect(h.getMirrorCameraStream).toHaveBeenLastCalledWith(
            'mirror-camera:host3:cam',
            '',
        );
        expect(h.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    });
});

describe('the shared camera stream', () => {
    test('taken again inside the grace window, it is never stopped', async () => {
        vi.useFakeTimers();
        const { stop, stream } = genStream();
        h.mediaDevices.getUserMedia.mockResolvedValue(stream);
        expect(await acquireCameraStream('front-id')).toBe(stream);
        releaseCameraStream('front-id');
        await vi.advanceTimersByTimeAsync(1_000);

        expect(await acquireCameraStream('front-id')).toBe(stream);
        await vi.advanceTimersByTimeAsync(5_000);
        expect(stop).not.toHaveBeenCalled();
        expect(h.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);

        releaseCameraStream('front-id');
        await vi.advanceTimersByTimeAsync(1_500);
        expect(stop).toHaveBeenCalledTimes(1);
    });

    test('letting go of a camera nobody opened touches nothing', async () => {
        vi.useFakeTimers();
        const { stop, stream } = genStream();
        h.mediaDevices.getUserMedia.mockResolvedValue(stream);
        await acquireCameraStream('kept-id');
        releaseCameraStream('never-opened');
        await vi.advanceTimersByTimeAsync(5_000);
        expect(stop).not.toHaveBeenCalled();
        releaseCameraStream('kept-id');
        await vi.advanceTimersByTimeAsync(1_500);
        expect(stop).toHaveBeenCalledTimes(1);
    });
});

describe('createCameraCanvasView', () => {
    afterEach(() => {
        delete (HTMLVideoElement.prototype as any).requestVideoFrameCallback;
    });

    test('a browser that cannot draw into a canvas keeps the video', () => {
        (HTMLVideoElement.prototype as any).requestVideoFrameCallback = vi.fn();
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
            null,
        );
        expect(createCameraCanvasView(genStream().stream as any)).toBeNull();
        expect(
            (HTMLVideoElement.prototype as any).requestVideoFrameCallback,
        ).not.toHaveBeenCalled();
    });
});

describe('getCameraAndShowMedia', () => {
    test('a second close does not release the camera twice', async () => {
        vi.useFakeTimers();
        const { stop, stream } = genStream();
        h.mediaDevices.getUserMedia.mockResolvedValue(stream);
        const parentContainer = document.createElement('div');
        const close = await getCameraAndShowMedia({
            id: 'front-id',
            label: 'Front Camera',
            parentContainer,
        } as any);
        expect(parentContainer.querySelector('video')).not.toBeNull();

        // Another view keeps the same camera open.
        await acquireCameraStream('front-id');
        await close();
        await close();
        await vi.advanceTimersByTimeAsync(5_000);
        expect(stop).not.toHaveBeenCalled();

        releaseCameraStream('front-id');
        await vi.advanceTimersByTimeAsync(1_500);
        expect(stop).toHaveBeenCalledTimes(1);
    });

    test('a failure after the camera opened hands it back and says so', async () => {
        vi.useFakeTimers();
        const { stop, stream } = genStream();
        h.mediaDevices.getUserMedia.mockResolvedValue(stream);
        const error = new Error('no canvas here');
        h.createViewerCameraView.mockImplementation(() => {
            throw error;
        });
        const onUnavailable = vi.fn();
        const parentContainer = document.createElement('div');
        const close = await getCameraAndShowMedia({
            id: 'front-id',
            label: 'Front Camera',
            parentContainer,
            onUnavailable,
        } as any);

        expect(h.handleError).toHaveBeenCalledWith(error);
        expect(onUnavailable).toHaveBeenCalledWith('Front Camera');
        expect(parentContainer.childElementCount).toBe(0);
        await vi.advanceTimersByTimeAsync(1_500);
        expect(stop).toHaveBeenCalledTimes(1);
        // Closing what never showed does nothing.
        expect(() => close()).not.toThrow();
    });
});
