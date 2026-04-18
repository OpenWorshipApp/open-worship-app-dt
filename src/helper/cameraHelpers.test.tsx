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
        const mediaStream = {
            getVideoTracks: vi.fn(() => [{ stop: stopMock }]),
        };
        electronSendAsyncMock.mockResolvedValue(true);
        getUserMediaMock.mockResolvedValue(mediaStream);
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

        cleanup();
        expect(stopMock).toHaveBeenCalledTimes(1);
    });

    test('uses animation handlers when provided and reports camera errors', async () => {
        const stopMock = vi.fn();
        const mediaStream = {
            getVideoTracks: vi.fn(() => [{ stop: stopMock }]),
        };
        const parentContainer = document.createElement('div');
        const animInMock = vi.fn();
        const animOutMock = vi.fn(async () => undefined);
        const { getCameraAndShowMedia } = await import('./cameraHelpers');

        electronSendAsyncMock.mockResolvedValue(true);
        getUserMediaMock.mockResolvedValue(mediaStream);

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
        await Promise.resolve(cleanup());
        expect(animOutMock).toHaveBeenCalledTimes(1);
        expect(stopMock).toHaveBeenCalledTimes(1);

        getUserMediaMock.mockRejectedValueOnce(new Error('stream failure'));
        const fallbackCleanup = await getCameraAndShowMedia({
            id: 'camera-2',
            extraStyle: undefined,
            parentContainer,
        } as any);

        expect(handleErrorMock).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'stream failure' }),
        );
        expect(fallbackCleanup()).toBeUndefined();
    });
});
