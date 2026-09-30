// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vitest';

const {
    electronSendAsyncMock,
    handleErrorMock,
    enumerateDevicesMock,
    getUserMediaMock,
} = vi.hoisted(() => ({
    electronSendAsyncMock: vi.fn(),
    handleErrorMock: vi.fn(),
    enumerateDevicesMock: vi.fn(),
    getUserMediaMock: vi.fn(),
}));

vi.mock('../server/appHelpers', () => ({
    electronSendAsync: electronSendAsyncMock,
}));

vi.mock('./errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: {
            isDev: false,
        },
        envUtils: {
            isFEUseEffectWarning: false,
        },
    },
}));

describe('cameraHelpers', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeAll(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        Object.defineProperty(globalThis.HTMLMediaElement.prototype, 'play', {
            configurable: true,
            value: vi.fn(),
        });
    });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();

        Object.defineProperty(globalThis.navigator, 'mediaDevices', {
            configurable: true,
            value: {
                enumerateDevices: enumerateDevicesMock,
                getUserMedia: getUserMediaMock,
            },
        });

        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => {
                root?.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
    });

    test('requests camera access through electron', async () => {
        electronSendAsyncMock.mockResolvedValue(true);
        const { requestCameraAccess } = await import('./cameraHelpers');

        await expect(requestCameraAccess()).resolves.toBe(true);
        expect(electronSendAsyncMock).toHaveBeenCalledWith(
            'main:app:ask-camera-access',
        );
    });

    test('loads only video input devices for useCameraInfoList', async () => {
        electronSendAsyncMock.mockResolvedValue(true);
        enumerateDevicesMock.mockResolvedValue([
            { kind: 'audioinput', deviceId: 'a', groupId: 'ga', label: 'Mic' },
            {
                kind: 'videoinput',
                deviceId: 'c1',
                groupId: 'g1',
                label: 'Front Camera',
            },
            {
                kind: 'videoinput',
                deviceId: 'c2',
                groupId: 'g2',
                label: 'Rear Camera',
            },
        ]);
        const onValue = vi.fn();
        const { useCameraInfoList } = await import('./cameraHelpers');

        function Probe() {
            const cameraInfoList = useCameraInfoList();

            useEffect(() => {
                onValue(cameraInfoList);
            }, [cameraInfoList]);

            return <div data-count={cameraInfoList.length} />;
        }

        await act(async () => {
            const resolvedContainer = container;
            if (!resolvedContainer) {
                throw new Error('Missing test container');
            }
            root = createRoot(resolvedContainer);
            root.render(<Probe />);
        });
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(enumerateDevicesMock).toHaveBeenCalledTimes(1);
        expect(onValue).toHaveBeenLastCalledWith([
            {
                kind: 'videoinput',
                deviceId: 'c1',
                groupId: 'g1',
                label: 'Front Camera',
            },
            {
                kind: 'videoinput',
                deviceId: 'c2',
                groupId: 'g2',
                label: 'Rear Camera',
            },
        ]);
    });

    test('skips device enumeration when camera access is denied', async () => {
        electronSendAsyncMock.mockResolvedValue(false);
        enumerateDevicesMock.mockResolvedValue([]);
        const onValue = vi.fn();
        const { useCameraInfoList } = await import('./cameraHelpers');

        function Probe() {
            const cameraInfoList = useCameraInfoList();

            useEffect(() => {
                onValue(cameraInfoList);
            }, [cameraInfoList]);

            return null;
        }

        await act(async () => {
            const resolvedContainer = container;
            if (!resolvedContainer) {
                throw new Error('Missing test container');
            }
            root = createRoot(resolvedContainer);
            root.render(<Probe />);
        });
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(enumerateDevicesMock).not.toHaveBeenCalled();
        expect(onValue).toHaveBeenLastCalledWith([]);
    });

    test('requests a media stream for the selected camera id', async () => {
        const mediaStream = { getVideoTracks: vi.fn(() => []) };
        electronSendAsyncMock.mockResolvedValue(true);
        getUserMediaMock.mockResolvedValue(mediaStream);
        const { getCameraStream } = await import('./cameraHelpers');

        await expect(getCameraStream('camera-1')).resolves.toBe(mediaStream);
        expect(getUserMediaMock).toHaveBeenCalledWith({
            audio: false,
            video: { deviceId: { exact: 'camera-1' } },
        });

        electronSendAsyncMock.mockResolvedValue(false);
        await expect(getCameraStream('camera-2')).rejects.toThrow(
            'Camera access denied',
        );
    });

    test('renders video output and stops tracks when closed', async () => {
        const stopMock = vi.fn();
        // `getTracks` is what the ref-counted registry stops through.
        const mediaStream = {
            getVideoTracks: vi.fn(() => [{ stop: stopMock }]),
            getTracks: vi.fn(() => [{ stop: stopMock }]),
        };
        electronSendAsyncMock.mockResolvedValue(true);
        getUserMediaMock.mockResolvedValue(mediaStream);
        // The device is resolved before it is opened now, so it has to be on
        // the machine for this to get as far as a `<video>`.
        enumerateDevicesMock.mockResolvedValue([
            {
                kind: 'videoinput',
                deviceId: 'camera-1',
                groupId: 'g1',
                label: 'Front Camera',
            },
        ]);
        const { getCameraAndShowMedia } = await import('./cameraHelpers');

        const parentContainer = document.createElement('div');
        parentContainer.innerHTML = '<span>old</span>';

        const cleanup = await getCameraAndShowMedia({
            id: 'camera-1',
            extraStyle: { border: '1px solid red' },
            parentContainer,
            width: 320,
        } as any);

        const video = parentContainer.querySelector(
            'video',
        ) as HTMLVideoElement | null;
        expect(video).not.toBeNull();
        expect(parentContainer.textContent).toBe('');
        expect(video?.style.width).toBe('320px');
        expect(video?.style.border).toBe('1px solid red');

        video?.onloadedmetadata?.(new Event('loadedmetadata'));
        expect(
            globalThis.HTMLMediaElement.prototype.play,
        ).toHaveBeenCalledTimes(1);

        // Released through the ref-counted registry, which stops the device a
        // grace period after the LAST holder lets go -- several previews of one
        // camera in a window share a single stream.
        vi.useFakeTimers();
        try {
            cleanup();
            await vi.advanceTimersByTimeAsync(2000);
        } finally {
            vi.useRealTimers();
        }
        expect(stopMock).toHaveBeenCalledTimes(1);
    });

    test('resolves a stored camera by id, then by label, then gives up', async () => {
        electronSendAsyncMock.mockResolvedValue(true);
        enumerateDevicesMock.mockResolvedValue([
            {
                kind: 'videoinput',
                deviceId: 'rotated-id',
                groupId: 'g1',
                label: 'HD Webcam',
            },
        ]);
        const { resolveCameraDeviceId } = await import('./cameraHelpers');

        // Exact id wins.
        await expect(
            resolveCameraDeviceId('rotated-id', 'Anything'),
        ).resolves.toBe('rotated-id');
        // Chromium rotated the id, so the label is what finds it again.
        await expect(
            resolveCameraDeviceId('yesterdays-id', 'HD Webcam'),
        ).resolves.toBe('rotated-id');
        // Neither matches: the camera is not on this machine.
        await expect(
            resolveCameraDeviceId('yesterdays-id', 'Other Camera'),
        ).resolves.toBeNull();
        await expect(
            resolveCameraDeviceId('yesterdays-id', ''),
        ).resolves.toBeNull();
    });

    test('shares one stream per device and stops it after the grace period', async () => {
        vi.useFakeTimers();
        try {
            const stopMock = vi.fn();
            const mediaStream = {
                getTracks: vi.fn(() => [{ stop: stopMock }]),
            };
            electronSendAsyncMock.mockResolvedValue(true);
            getUserMediaMock.mockResolvedValue(mediaStream);
            const { acquireCameraStream, releaseCameraStream } =
                await import('./cameraHelpers');

            // Two screens showing the same camera open the device ONCE.
            const [streamA, streamB] = await Promise.all([
                acquireCameraStream('camera-1'),
                acquireCameraStream('camera-1'),
            ]);
            expect(streamA).toBe(mediaStream);
            expect(streamB).toBe(mediaStream);
            expect(getUserMediaMock).toHaveBeenCalledTimes(1);

            // One screen letting go keeps the other one's picture alive.
            releaseCameraStream('camera-1');
            await vi.advanceTimersByTimeAsync(5000);
            expect(stopMock).not.toHaveBeenCalled();

            // The last release only stops the device after the grace window, so
            // a re-render in between reuses the open stream.
            releaseCameraStream('camera-1');
            expect(stopMock).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(2000);
            expect(stopMock).toHaveBeenCalledTimes(1);

            // The slot is gone, so the next acquire really re-opens the device.
            await acquireCameraStream('camera-1');
            expect(getUserMediaMock).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    test('does not let a failed camera poison its registry slot', async () => {
        electronSendAsyncMock.mockResolvedValue(true);
        getUserMediaMock.mockRejectedValueOnce(new Error('device busy'));
        const { acquireCameraStream } = await import('./cameraHelpers');

        await expect(acquireCameraStream('camera-1')).rejects.toThrow(
            'device busy',
        );

        const mediaStream = { getTracks: vi.fn(() => []) };
        getUserMediaMock.mockResolvedValue(mediaStream);
        await expect(acquireCameraStream('camera-1')).resolves.toBe(
            mediaStream,
        );
        expect(getUserMediaMock).toHaveBeenCalledTimes(2);
    });

    test('uses animation handlers when provided and reports camera errors', async () => {
        const stopMock = vi.fn();
        // `getTracks` is what the ref-counted registry stops through.
        const mediaStream = {
            getVideoTracks: vi.fn(() => [{ stop: stopMock }]),
            getTracks: vi.fn(() => [{ stop: stopMock }]),
        };
        const parentContainer = document.createElement('div');
        const animInMock = vi.fn();
        const animOutMock = vi.fn(async () => undefined);
        const { getCameraAndShowMedia } = await import('./cameraHelpers');

        electronSendAsyncMock.mockResolvedValue(true);
        getUserMediaMock.mockResolvedValue(mediaStream);
        enumerateDevicesMock.mockResolvedValue([
            {
                kind: 'videoinput',
                deviceId: 'camera-1',
                groupId: 'g1',
                label: 'Front Camera',
            },
            {
                kind: 'videoinput',
                deviceId: 'camera-2',
                groupId: 'g2',
                label: 'Rear Camera',
            },
        ]);

        const cleanup = await getCameraAndShowMedia(
            {
                id: 'camera-1',
                extraStyle: undefined,
                parentContainer,
            } as any,
            {
                animIn: animInMock,
                animOut: animOutMock,
            } as any,
        );

        expect(animInMock).toHaveBeenCalledTimes(1);
        // Fake timers must be in place BEFORE the release, or the grace-period
        // timeout is scheduled on the real clock and advancing never fires it.
        vi.useFakeTimers();
        try {
            await Promise.resolve(cleanup());
            expect(animOutMock).toHaveBeenCalledTimes(1);
            await vi.advanceTimersByTimeAsync(2000);
        } finally {
            vi.useRealTimers();
        }
        expect(stopMock).toHaveBeenCalledTimes(1);

        getUserMediaMock.mockRejectedValueOnce(new Error('stream failure'));
        const onUnavailableMock = vi.fn();
        const fallbackCleanup = await getCameraAndShowMedia({
            id: 'camera-2',
            label: 'Rear Camera',
            extraStyle: undefined,
            parentContainer,
            onUnavailable: onUnavailableMock,
        } as any);

        expect(handleErrorMock).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'stream failure' }),
        );
        // The caller is TOLD, by the camera's readable name. A failure used to
        // be a console line only, so the projector showed nothing and the
        // operator had no way to find out why.
        expect(onUnavailableMock).toHaveBeenCalledWith('Rear Camera');
        expect(fallbackCleanup()).toBeUndefined();
    });

    test('opens a camera whose stored id rotated, by its label', async () => {
        const mediaStream = { getVideoTracks: vi.fn(() => []) };
        electronSendAsyncMock.mockResolvedValue(true);
        getUserMediaMock.mockResolvedValue(mediaStream);
        // Chromium rotates `deviceId` per origin and per session, and the
        // screen window is a different document from the presenter -- so the
        // id the presenter saved is routinely dead by the time `screen.html`
        // tries to open it. Before this, the projector silently showed nothing
        // while the mini preview kept working.
        enumerateDevicesMock.mockResolvedValue([
            {
                kind: 'videoinput',
                deviceId: 'todays-id',
                groupId: 'g1',
                label: 'HD Webcam',
            },
        ]);
        const { getCameraAndShowMedia } = await import('./cameraHelpers');
        const parentContainer = document.createElement('div');
        const onUnavailableMock = vi.fn();

        await getCameraAndShowMedia({
            id: 'yesterdays-id',
            label: 'HD Webcam',
            parentContainer,
            onUnavailable: onUnavailableMock,
        } as any);

        expect(getUserMediaMock).toHaveBeenCalledWith({
            audio: false,
            video: { deviceId: { exact: 'todays-id' } },
        });
        expect(onUnavailableMock).not.toHaveBeenCalled();
        expect(parentContainer.querySelector('video')).not.toBeNull();
    });

    test('says the camera is unavailable when it is not on this machine', async () => {
        electronSendAsyncMock.mockResolvedValue(true);
        enumerateDevicesMock.mockResolvedValue([]);
        const { getCameraAndShowMedia } = await import('./cameraHelpers');
        const parentContainer = document.createElement('div');
        const onUnavailableMock = vi.fn();

        const cleanup = await getCameraAndShowMedia({
            id: 'gone-id',
            label: 'Unplugged Camera',
            parentContainer,
            onUnavailable: onUnavailableMock,
        } as any);

        expect(getUserMediaMock).not.toHaveBeenCalled();
        expect(onUnavailableMock).toHaveBeenCalledWith('Unplugged Camera');
        expect(cleanup()).toBeUndefined();
    });
});
