// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    acquireCameraStreamMock,
    releaseCameraStreamMock,
    resolveCameraDeviceIdMock,
    handleErrorMock,
    playMediaElementMock,
} = vi.hoisted(() => ({
    acquireCameraStreamMock: vi.fn(),
    releaseCameraStreamMock: vi.fn(),
    resolveCameraDeviceIdMock: vi.fn(),
    handleErrorMock: vi.fn(),
    playMediaElementMock: vi.fn(),
}));

vi.mock('../../helper/cameraHelpers', () => ({
    acquireCameraStream: acquireCameraStreamMock,
    releaseCameraStream: releaseCameraStreamMock,
    resolveCameraDeviceId: resolveCameraDeviceIdMock,
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('../../helper/mediaHelpers', () => ({
    playMediaElement: playMediaElementMock,
}));

import {
    checkIsCameraMediaElement,
    setCameraBadgeVisibility,
    SlideCameraAttachment,
} from './slideCameraSyncHelpers';

function createCameraVideo(deviceId = 'device-1', label = 'HD Webcam') {
    const parent = document.createElement('div');
    const video = document.createElement('video');
    video.setAttribute('data-camera-item', '');
    video.setAttribute('data-camera-device-id', deviceId);
    video.setAttribute('data-camera-device-label', label);
    const badge = document.createElement('div');
    badge.setAttribute('data-preview-only', '');
    parent.append(video, badge);
    return { video, badge };
}

async function flushPromises() {
    for (let index = 0; index < 5; index++) {
        await Promise.resolve();
    }
}

describe('slideCameraSyncHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resolveCameraDeviceIdMock.mockResolvedValue('device-1');
    });

    test('recognises only the camera item marker', () => {
        const { video, badge } = createCameraVideo();
        expect(checkIsCameraMediaElement(video)).toBe(true);
        expect(checkIsCameraMediaElement(badge)).toBe(false);
        expect(checkIsCameraMediaElement(document.createElement('video'))).toBe(
            false,
        );
    });

    test('hides and shows the placeholder badge beside the video', () => {
        const { video, badge } = createCameraVideo();
        setCameraBadgeVisibility(video, false);
        expect(badge.style.display).toBe('none');
        setCameraBadgeVisibility(video, true);
        expect(badge.style.display).toBe('');
    });

    test('attaches the resolved stream and hides the badge once it plays', async () => {
        const mediaStream = {} as MediaStream;
        acquireCameraStreamMock.mockResolvedValue(mediaStream);
        const attachment = new SlideCameraAttachment();
        const { video, badge } = createCameraVideo();

        attachment.attach(video);
        // `renderToStaticMarkup` drops React's `muted`, so the attach must set
        // it — without it Chromium's autoplay policy rejects `play()`.
        expect(video.muted).toBe(true);

        await flushPromises();
        expect(resolveCameraDeviceIdMock).toHaveBeenCalledWith(
            'device-1',
            'HD Webcam',
        );
        expect(video.srcObject).toBe(mediaStream);
        expect(badge.style.display).toBe('');

        video.onloadedmetadata?.(new Event('loadedmetadata'));
        expect(playMediaElementMock).toHaveBeenCalledWith(video);
        expect(badge.style.display).toBe('none');

        attachment.releaseAll();
        expect(releaseCameraStreamMock).toHaveBeenCalledWith('device-1');
    });

    test('releases a stream that arrives after the slide was torn down', async () => {
        // The whole point of the generation counter: `cleanupSlideContent` is
        // synchronous but opening a device is not, so a render that is already
        // gone must not leave the camera light on.
        let resolveStream: (stream: MediaStream) => void = () => {};
        acquireCameraStreamMock.mockReturnValue(
            new Promise<MediaStream>((resolve) => {
                resolveStream = resolve;
            }),
        );
        const attachment = new SlideCameraAttachment();
        const { video } = createCameraVideo();

        attachment.attach(video);
        await flushPromises();

        attachment.releaseAll();
        // Nothing was acquired yet, so the teardown itself releases nothing...
        expect(releaseCameraStreamMock).not.toHaveBeenCalled();

        resolveStream({} as MediaStream);
        await flushPromises();

        // ...the late arrival releases itself instead, and never paints.
        expect(releaseCameraStreamMock).toHaveBeenCalledWith('device-1');
        expect(video.srcObject).toBeFalsy();
    });

    test('leaves the placeholder alone when the camera is not on this machine', async () => {
        resolveCameraDeviceIdMock.mockResolvedValue(null);
        const attachment = new SlideCameraAttachment();
        const { video, badge } = createCameraVideo();

        attachment.attach(video);
        await flushPromises();

        expect(acquireCameraStreamMock).not.toHaveBeenCalled();
        expect(video.srcObject).toBeFalsy();
        // The badge stays up: it is already the right "camera not here" UI, and
        // this runs once per screen per render so a toast would be a storm.
        expect(badge.style.display).toBe('');
        expect(handleErrorMock).not.toHaveBeenCalled();
    });

    test('reports a failure to open the device without throwing', async () => {
        acquireCameraStreamMock.mockRejectedValue(new Error('device busy'));
        const attachment = new SlideCameraAttachment();
        const { video } = createCameraVideo();

        attachment.attach(video);
        await flushPromises();

        expect(handleErrorMock).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'device busy' }),
        );
        expect(video.srcObject).toBeFalsy();
    });
});
