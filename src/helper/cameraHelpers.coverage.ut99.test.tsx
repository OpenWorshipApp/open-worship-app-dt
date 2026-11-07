// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { mocks, devicesListeners } = vi.hoisted(() => {
    const mocks = {
        electronSendAsync: vi.fn(),
        handleError: vi.fn(),
        playMediaElement: vi.fn(),
        enumerateDevices: vi.fn(),
        getUserMedia: vi.fn(),
        sendDataSync: vi.fn(),
        sendData: vi.fn(),
        listenForData: vi.fn(),
        removeListener: vi.fn(),
        getMirrorCameraStream: vi.fn(),
        releaseMirrorCameraStream: vi.fn(),
        checkIsViewerCameraId: vi.fn(),
        createViewerCameraView: vi.fn(),
        getViewerCameraStream: vi.fn(),
        listenViewerCameraLive: vi.fn(),
        releaseViewerCameraStream: vi.fn(),
    };
    const devicesListeners = new Set<() => void>();
    // `cameraHelpers` reads `navigator.mediaDevices` once, at module load, so
    // the stand-in has to be there before the import below.
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        configurable: true,
        value: {
            enumerateDevices: (...args: unknown[]) =>
                (mocks.enumerateDevices as any)(...args),
            getUserMedia: (...args: unknown[]) =>
                (mocks.getUserMedia as any)(...args),
            addEventListener: (name: string, listener: () => void) => {
                if (name === 'devicechange') {
                    devicesListeners.add(listener);
                }
            },
            removeEventListener: (name: string, listener: () => void) => {
                if (name === 'devicechange') {
                    devicesListeners.delete(listener);
                }
            },
        },
    });
    return { mocks, devicesListeners };
});

vi.mock('../server/electronSendHelpers', () => ({
    electronSendAsync: mocks.electronSendAsync,
}));
vi.mock('./errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('./mediaHelpers', () => ({
    playMediaElement: mocks.playMediaElement,
}));
vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
        messageUtils: {
            sendDataSync: mocks.sendDataSync,
            sendData: mocks.sendData,
            listenForData: mocks.listenForData,
            removeListener: mocks.removeListener,
        },
    },
}));
vi.mock('../screen-mirror/mirrorCameraTransport', () => ({
    getMirrorCameraStream: mocks.getMirrorCameraStream,
    releaseMirrorCameraStream: mocks.releaseMirrorCameraStream,
}));
vi.mock('../virtual-display/viewerCameraTransport', () => ({
    checkIsViewerCameraId: mocks.checkIsViewerCameraId,
    createViewerCameraView: mocks.createViewerCameraView,
    getViewerCameraStream: mocks.getViewerCameraStream,
    listenViewerCameraLive: mocks.listenViewerCameraLive,
    releaseViewerCameraStream: mocks.releaseViewerCameraStream,
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

function genStream() {
    const stop = vi.fn();
    return { stop, stream: { getTracks: () => [{ stop }] } as any };
}

const frontCamera = {
    kind: 'videoinput',
    deviceId: 'front-id',
    groupId: 'g1',
    label: 'Front Camera',
    toJSON: () => ({}),
};

let remoteCameras: unknown = [];
let mirrorState: unknown = null;

beforeEach(() => {
    remoteCameras = [];
    mirrorState = null;
    devicesListeners.clear();
    mocks.electronSendAsync.mockResolvedValue(true);
    mocks.enumerateDevices.mockResolvedValue([]);
    mocks.checkIsViewerCameraId.mockReturnValue(false);
    mocks.createViewerCameraView.mockReturnValue(null);
    mocks.listenViewerCameraLive.mockReturnValue(() => {});
    mocks.sendDataSync.mockImplementation((channel: string) => {
        if (channel === 'mirror:cameras') {
            return remoteCameras;
        }
        if (channel === 'mirror:state') {
            return mirrorState;
        }
        return undefined;
    });
});

afterEach(() => {
    vi.useRealTimers();
});

describe('getAllCameraDevices', () => {
    test("tells the mirror this computer's cameras, trimmed to id, label and group", async () => {
        const remote = {
            deviceId: 'mirror-camera:pc2:x',
            groupId: '',
            label: 'a1: Laptop Camera',
        };
        remoteCameras = [remote];
        mocks.enumerateDevices.mockResolvedValue([
            {
                kind: 'audioinput',
                deviceId: 'mic',
                groupId: 'g0',
                label: 'Mic',
            },
            frontCamera,
        ]);
        await expect(getAllCameraDevices()).resolves.toEqual([
            frontCamera,
            remote,
        ]);
        expect(mocks.sendData).toHaveBeenCalledWith('mirror:physical-cameras', [
            { deviceId: 'front-id', label: 'Front Camera', groupId: 'g1' },
        ]);
    });

    test('without camera access only the other computers cameras are listed', async () => {
        mocks.electronSendAsync.mockResolvedValue(false);
        remoteCameras = 'not a list';
        await expect(getAllCameraDevices()).resolves.toEqual([]);
        expect(mocks.enumerateDevices).not.toHaveBeenCalled();
        expect(mocks.sendData).not.toHaveBeenCalled();
    });
});

describe('useCameraInfoList', () => {
    let container: HTMLDivElement;
    let root: Root;
    let rendered: string[];

    function ProbeComp() {
        const list = useCameraInfoList();
        rendered.push(list.map((camera) => camera.label).join(','));
        return <span>{list.map((camera) => camera.label).join(',')}</span>;
    }

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        rendered = [];
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        container.remove();
    });

    test('refreshes when a camera is plugged in here or on another computer', async () => {
        mocks.enumerateDevices.mockResolvedValue([frontCamera]);
        await act(async () => {
            root.render(<ProbeComp />);
        });
        expect(container.textContent).toBe('Front Camera');

        const [channel, onMirrorChange] = mocks.listenForData.mock.calls[0];
        expect(channel).toBe('mirror:devices-changed');
        expect(devicesListeners.size).toBe(1);

        remoteCameras = [
            { deviceId: 'mirror-camera:pc2:y', groupId: '', label: 'Remote' },
        ];
        await act(async () => {
            onMirrorChange();
        });
        expect(container.textContent).toBe('Front Camera,Remote');

        mocks.enumerateDevices.mockResolvedValue([
            frontCamera,
            { ...frontCamera, deviceId: 'usb-id', label: 'USB Camera' },
        ]);
        await act(async () => {
            for (const listener of devicesListeners) {
                listener();
            }
        });
        expect(container.textContent).toBe('Front Camera,USB Camera,Remote');

        // The same refresh is let go of on unmount, from both sources (the
        // async effect's cleanup runs once its promise settles).
        await act(async () => {
            root.unmount();
        });
        await act(async () => {
            await Promise.resolve();
        });
        expect(mocks.removeListener).toHaveBeenCalledWith(
            'mirror:devices-changed',
            onMirrorChange,
        );
        expect(devicesListeners.size).toBe(0);
    });

    test('a refresh that fails is reported, and the list is kept', async () => {
        mocks.enumerateDevices.mockResolvedValue([frontCamera]);
        await act(async () => {
            root.render(<ProbeComp />);
        });
        const error = new Error('enumerate failed');
        mocks.enumerateDevices.mockRejectedValue(error);
        await act(async () => {
            mocks.listenForData.mock.calls[0][1]();
        });
        expect(mocks.handleError).toHaveBeenCalledWith(error);
        expect(container.textContent).toBe('Front Camera');
        act(() => {
            root.unmount();
        });
    });
});

describe('getCameraStream for a mirror camera', () => {
    test("another computer's camera comes over the mirror, named without its prefix", async () => {
        mirrorState = { id: 'me' };
        remoteCameras = [
            {
                deviceId: 'mirror-camera:pc2:abc',
                groupId: '',
                label: 'a12: Laptop Camera',
            },
        ];
        const { stream } = genStream();
        mocks.getMirrorCameraStream.mockResolvedValue(stream);
        await expect(getCameraStream('mirror-camera:pc2:abc')).resolves.toBe(
            stream,
        );
        expect(mocks.getMirrorCameraStream).toHaveBeenCalledWith(
            'mirror-camera:pc2:abc',
            'Laptop Camera',
        );
        expect(mocks.getUserMedia).not.toHaveBeenCalled();
    });

    test('a mirror camera that is no longer listed is asked for with no label', async () => {
        mocks.getMirrorCameraStream.mockResolvedValue('stream');
        await getCameraStream('mirror-camera:pc3:zzz');
        expect(mocks.getMirrorCameraStream).toHaveBeenCalledWith(
            'mirror-camera:pc3:zzz',
            '',
        );
    });

    test("this computer's own camera, seen through the mirror, opens directly by its id", async () => {
        mirrorState = { id: 'me' };
        mocks.enumerateDevices.mockResolvedValue([
            { ...frontCamera, kind: 'audioinput', deviceId: 'local-id' },
            { ...frontCamera, deviceId: 'local-id' },
        ]);
        const { stream } = genStream();
        mocks.getUserMedia.mockResolvedValue(stream);
        await expect(
            getCameraStream('mirror-camera:me:local-id'),
        ).resolves.toBe(stream);
        expect(mocks.getUserMedia).toHaveBeenCalledWith({
            audio: false,
            video: { deviceId: { exact: 'local-id' } },
        });
        expect(mocks.getMirrorCameraStream).not.toHaveBeenCalled();
    });

    test('...or by its label when the id rotated', async () => {
        mirrorState = { id: 'me' };
        remoteCameras = [
            {
                deviceId: 'mirror-camera:me:old-id',
                groupId: '',
                label: 'a3: Front Camera',
            },
        ];
        mocks.enumerateDevices.mockResolvedValue([frontCamera]);
        mocks.getUserMedia.mockResolvedValue('stream');
        await getCameraStream('mirror-camera:me:old-id');
        expect(mocks.getUserMedia).toHaveBeenCalledWith({
            audio: false,
            video: { deviceId: { exact: 'front-id' } },
        });
    });

    test('...and says so when it is not here any more', async () => {
        mirrorState = { id: 'me' };
        mocks.enumerateDevices.mockResolvedValue([frontCamera]);
        await expect(getCameraStream('mirror-camera:me:gone')).rejects.toThrow(
            'Camera is unavailable',
        );
        expect(mocks.getUserMedia).not.toHaveBeenCalled();
    });

    test('access denied for a local camera is an error', async () => {
        mocks.electronSendAsync.mockResolvedValue(false);
        await expect(getCameraStream('front-id')).rejects.toThrow(
            'Camera access denied',
        );
    });
});

describe('the ref-counted stream registry', () => {
    test('re-acquiring inside the grace window keeps the open stream', async () => {
        vi.useFakeTimers();
        const { stream, stop } = genStream();
        mocks.getUserMedia.mockResolvedValue(stream);
        await acquireCameraStream('grace-cam');
        releaseCameraStream('grace-cam');
        await vi.advanceTimersByTimeAsync(1000);
        // A re-render takes it back before the device was stopped.
        await expect(acquireCameraStream('grace-cam')).resolves.toBe(stream);
        await vi.advanceTimersByTimeAsync(5000);
        expect(stop).not.toHaveBeenCalled();
        expect(mocks.getUserMedia).toHaveBeenCalledTimes(1);

        releaseCameraStream('grace-cam');
        await vi.advanceTimersByTimeAsync(1500);
        expect(stop).toHaveBeenCalledTimes(1);
    });

    test('releasing a device nobody holds does nothing', () => {
        vi.useFakeTimers();
        releaseCameraStream('never-opened');
        expect(vi.getTimerCount()).toBe(0);
    });

    test('a stream that is stopped tells the mirror and the viewer transports', async () => {
        vi.useFakeTimers();
        const { stream, stop } = genStream();
        mocks.getUserMedia.mockResolvedValue(stream);
        await acquireCameraStream('told-cam');
        releaseCameraStream('told-cam');
        await vi.advanceTimersByTimeAsync(1500);
        expect(mocks.releaseMirrorCameraStream).toHaveBeenCalledWith(stream);
        expect(mocks.releaseViewerCameraStream).toHaveBeenCalledWith(stream);
        expect(stop).toHaveBeenCalledTimes(1);
    });
});

describe('createCameraCanvasView', () => {
    const videoPrototype = HTMLVideoElement.prototype as any;

    afterEach(() => {
        delete videoPrototype.requestVideoFrameCallback;
    });

    test("a viewer's own canvas view wins", () => {
        const view = { element: document.createElement('canvas') };
        mocks.createViewerCameraView.mockReturnValue(view);
        expect(createCameraCanvasView({} as any)).toBe(view);
    });

    test('no 2d context means the plain video is used', () => {
        videoPrototype.requestVideoFrameCallback = () => 1;
        const getContext = vi
            .spyOn(HTMLCanvasElement.prototype, 'getContext')
            .mockReturnValue(null);
        expect(createCameraCanvasView({} as any)).toBeNull();
        expect(getContext).toHaveBeenCalledWith('2d');
        expect(mocks.playMediaElement).not.toHaveBeenCalled();
    });
});

describe('getCameraAndShowMedia releases exactly once', () => {
    test('a second release call does not take another preview stream', async () => {
        vi.useFakeTimers();
        const { stream, stop } = genStream();
        mocks.enumerateDevices.mockResolvedValue([
            { ...frontCamera, deviceId: 'shared-cam' },
        ]);
        mocks.getUserMedia.mockResolvedValue(stream);
        const first = document.createElement('div');
        const second = document.createElement('div');
        const releaseFirst = await getCameraAndShowMedia({
            id: 'shared-cam',
            parentContainer: first,
        } as any);
        const releaseSecond = await getCameraAndShowMedia({
            id: 'shared-cam',
            parentContainer: second,
            width: 320,
            extraStyle: { opacity: '0.5' },
        } as any);
        expect(mocks.getUserMedia).toHaveBeenCalledTimes(1);
        const video = second.querySelector('video')!;
        expect(video.style.width).toBe('320px');
        expect(video.style.opacity).toBe('0.5');

        releaseFirst();
        releaseFirst();
        await vi.advanceTimersByTimeAsync(5000);
        // The second preview still holds the device.
        expect(stop).not.toHaveBeenCalled();

        releaseSecond();
        await vi.advanceTimersByTimeAsync(1500);
        expect(stop).toHaveBeenCalledTimes(1);
    });

    test('a failure after the stream opened gives the stream back', async () => {
        vi.useFakeTimers();
        const { stream, stop } = genStream();
        mocks.enumerateDevices.mockResolvedValue([
            { ...frontCamera, deviceId: 'failing-cam', label: 'Desk Camera' },
        ]);
        mocks.getUserMedia.mockResolvedValue(stream);
        const error = new Error('live listener broke');
        mocks.listenViewerCameraLive.mockImplementation(() => {
            throw error;
        });
        const onUnavailable = vi.fn();
        const parentContainer = document.createElement('div');
        const release = await getCameraAndShowMedia({
            id: 'failing-cam',
            label: 'Desk Camera',
            parentContainer,
            onUnavailable,
        } as any);
        expect(mocks.handleError).toHaveBeenCalledWith(error);
        expect(onUnavailable).toHaveBeenCalledWith('Desk Camera');
        expect(parentContainer.childElementCount).toBe(0);
        expect(release()).toBeUndefined();

        await vi.advanceTimersByTimeAsync(1500);
        expect(stop).toHaveBeenCalledTimes(1);
    });

    test('a viewer camera that stops sending pictures is hidden, and shown again', async () => {
        let onLive: (isLive: boolean) => void = () => {};
        mocks.listenViewerCameraLive.mockImplementation(
            (_stream: unknown, callback: (isLive: boolean) => void) => {
                onLive = callback;
                return () => {};
            },
        );
        mocks.enumerateDevices.mockResolvedValue([
            { ...frontCamera, deviceId: 'live-cam' },
        ]);
        mocks.getUserMedia.mockResolvedValue(genStream().stream);
        const parentContainer = document.createElement('div');
        parentContainer.innerHTML = '<p>old preview</p>';
        await getCameraAndShowMedia({
            id: 'live-cam',
            parentContainer,
        } as any);
        const video = parentContainer.querySelector('video')!;
        expect(parentContainer.querySelector('p')).toBeNull();
        onLive(false);
        expect(video.style.visibility).toBe('hidden');
        onLive(true);
        expect(video.style.visibility).toBe('');
    });
});
