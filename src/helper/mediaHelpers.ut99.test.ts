// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { handleErrorMock } = vi.hoisted(() => ({
    handleErrorMock: vi.fn(),
}));

vi.mock('./errorHelpers', () => ({ handleError: handleErrorMock }));

import {
    captureVideoFrameDataUrl,
    playMediaElement,
    releaseMediaElement,
    releaseMediaElementWhenDetached,
} from './mediaHelpers';

function genFakeMedia() {
    const calls: string[] = [];
    return {
        calls,
        media: {
            isConnected: false,
            play: vi.fn(),
            pause: vi.fn(() => calls.push('pause')),
            removeAttribute: vi.fn((name: string) =>
                calls.push(`removeAttribute:${name}`),
            ),
            load: vi.fn(() => calls.push('load')),
        },
    };
}

describe('playMediaElement', () => {
    test('resolves once play() resolves, without an error', async () => {
        const { media } = genFakeMedia();
        media.play.mockResolvedValue(undefined);
        await expect(playMediaElement(media as any)).resolves.toBeUndefined();
        expect(media.play).toHaveBeenCalledOnce();
        expect(handleErrorMock).not.toHaveBeenCalled();
    });

    test('an engine whose play() returns nothing still resolves', async () => {
        const { media } = genFakeMedia();
        media.play.mockReturnValue(undefined);
        await expect(playMediaElement(media as any)).resolves.toBeUndefined();
        expect(handleErrorMock).not.toHaveBeenCalled();
    });

    test('an AbortError (play interrupted by pause) is swallowed', async () => {
        const { media } = genFakeMedia();
        media.play.mockRejectedValue(
            new DOMException('interrupted by pause()', 'AbortError'),
        );
        await playMediaElement(media as any);
        expect(handleErrorMock).not.toHaveBeenCalled();
    });

    test.each([
        [
            'another DOMException',
            new DOMException('no source', 'NotSupportedError'),
        ],
        ['a plain error', new Error('decoder died')],
    ])('%s is reported', async (_label, error) => {
        const { media } = genFakeMedia();
        media.play.mockRejectedValue(error);
        await playMediaElement(media as any);
        expect(handleErrorMock).toHaveBeenCalledWith(error);
    });
});

describe('releaseMediaElement', () => {
    test('pauses, drops the src and reloads, in that order', () => {
        const { media, calls } = genFakeMedia();
        releaseMediaElement(media as any);
        expect(calls).toEqual(['pause', 'removeAttribute:src', 'load']);
        expect(handleErrorMock).not.toHaveBeenCalled();
    });

    test('a throw is reported instead of escaping', () => {
        const { media } = genFakeMedia();
        const error = new Error('gone');
        media.pause.mockImplementation(() => {
            throw error;
        });
        expect(() => releaseMediaElement(media as any)).not.toThrow();
        expect(handleErrorMock).toHaveBeenCalledWith(error);
        expect(media.load).not.toHaveBeenCalled();
    });
});

describe('releaseMediaElementWhenDetached', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    test('waits for the commit, then releases an element that left', () => {
        const { media, calls } = genFakeMedia();
        releaseMediaElementWhenDetached(media as any);
        expect(calls).toEqual([]);
        vi.advanceTimersByTime(0);
        expect(calls).toEqual(['pause', 'removeAttribute:src', 'load']);
    });

    test('keeps an element React re-attached (still connected)', () => {
        const { media, calls } = genFakeMedia();
        releaseMediaElementWhenDetached(media as any);
        media.isConnected = true;
        vi.advanceTimersByTime(0);
        expect(calls).toEqual([]);
    });
});

describe('captureVideoFrameDataUrl', () => {
    let videos: HTMLVideoElement[] = [];
    let canvases: HTMLCanvasElement[] = [];
    let drawImageMock: ReturnType<typeof vi.fn>;
    let getContextMock: ReturnType<typeof vi.fn>;
    let toDataURLMock: ReturnType<typeof vi.fn>;
    let releaseCalls: string[] = [];

    beforeEach(() => {
        vi.useFakeTimers();
        videos = [];
        canvases = [];
        releaseCalls = [];
        const originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation(((
            tagName: string,
            options?: ElementCreationOptions,
        ) => {
            const element = originalCreateElement(tagName, options);
            if (tagName === 'video') {
                videos.push(element as HTMLVideoElement);
            } else if (tagName === 'canvas') {
                canvases.push(element as HTMLCanvasElement);
            }
            return element;
        }) as typeof document.createElement);
        // jsdom has neither a media pipeline nor a canvas backend.
        vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {
            releaseCalls.push('pause');
        });
        vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {
            releaseCalls.push('load');
        });
        drawImageMock = vi.fn();
        getContextMock = vi.fn(() => ({ drawImage: drawImageMock }));
        toDataURLMock = vi.fn(() => 'data:image/jpeg;base64,AAAA');
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
            getContextMock as any,
        );
        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(
            toDataURLMock as any,
        );
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    function loadFrame(video: HTMLVideoElement, width: number, height: number) {
        Object.defineProperty(video, 'videoWidth', { value: width });
        Object.defineProperty(video, 'videoHeight', { value: height });
        video.dispatchEvent(new Event('loadeddata'));
    }

    test('draws the first frame at full size and releases the player', async () => {
        const promise = captureVideoFrameDataUrl('file:///clip.mp4');
        const [video] = videos;
        expect(video.muted).toBe(true);
        expect(video.preload).toBe('auto');
        expect(video.src).toBe('file:///clip.mp4');

        loadFrame(video, 1280, 720);
        await expect(promise).resolves.toBe('data:image/jpeg;base64,AAAA');
        const [canvas] = canvases;
        expect([canvas.width, canvas.height]).toEqual([1280, 720]);
        expect(getContextMock).toHaveBeenCalledWith('2d');
        expect(drawImageMock).toHaveBeenCalledWith(video, 0, 0, 1280, 720);
        expect(toDataURLMock).toHaveBeenCalledWith('image/jpeg', 0.9);
        expect(releaseCalls).toEqual(['pause', 'load']);
        expect(video.hasAttribute('src')).toBe(false);
        // The give-up timeout was cleared with it.
        expect(vi.getTimerCount()).toBe(0);
    });

    test('scales a wide frame down to maxWidth with the asked quality', async () => {
        const promise = captureVideoFrameDataUrl('file:///big.mp4', {
            maxWidth: 320,
            quality: 0.5,
        });
        loadFrame(videos[0], 1920, 1081);
        await expect(promise).resolves.toBe('data:image/jpeg;base64,AAAA');
        const [canvas] = canvases;
        // 1081 * (320 / 1920) = 180.17 -> rounded.
        expect([canvas.width, canvas.height]).toEqual([320, 180]);
        expect(toDataURLMock).toHaveBeenCalledWith('image/jpeg', 0.5);
    });

    test('never scales a frame that is already narrower than maxWidth', async () => {
        const promise = captureVideoFrameDataUrl('file:///small.mp4', {
            maxWidth: 640,
        });
        loadFrame(videos[0], 320, 240);
        await promise;
        expect([canvases[0].width, canvases[0].height]).toEqual([320, 240]);
    });

    test('no 2d context means no still', async () => {
        getContextMock.mockReturnValue(null);
        const promise = captureVideoFrameDataUrl('file:///clip.mp4');
        loadFrame(videos[0], 640, 360);
        await expect(promise).resolves.toBeNull();
        expect(drawImageMock).not.toHaveBeenCalled();
        expect(releaseCalls).toEqual(['pause', 'load']);
    });

    test('a frame with no width means no still', async () => {
        const promise = captureVideoFrameDataUrl('file:///audio-only.mp4');
        loadFrame(videos[0], 0, 0);
        await expect(promise).resolves.toBeNull();
        expect(drawImageMock).not.toHaveBeenCalled();
        expect(toDataURLMock).not.toHaveBeenCalled();
    });

    test('a canvas that refuses to encode is reported and gives null', async () => {
        const error = new DOMException('tainted', 'SecurityError');
        toDataURLMock.mockImplementation(() => {
            throw error;
        });
        const promise = captureVideoFrameDataUrl('https://elsewhere/clip.mp4');
        loadFrame(videos[0], 640, 360);
        await expect(promise).resolves.toBeNull();
        expect(handleErrorMock).toHaveBeenCalledWith(error);
        expect(releaseCalls).toEqual(['pause', 'load']);
    });

    test('a load error gives null and releases the player', async () => {
        const promise = captureVideoFrameDataUrl('file:///broken.mp4');
        videos[0].dispatchEvent(new Event('error'));
        await expect(promise).resolves.toBeNull();
        expect(canvases).toHaveLength(0);
        expect(releaseCalls).toEqual(['pause', 'load']);
    });

    test('a video that never loads gives up after ten seconds', async () => {
        let settled: string | null | undefined;
        captureVideoFrameDataUrl('file:///never.mp4').then((value) => {
            settled = value;
        });
        await vi.advanceTimersByTimeAsync(9_999);
        expect(settled).toBeUndefined();
        await vi.advanceTimersByTimeAsync(1);
        expect(settled).toBeNull();
        expect(releaseCalls).toEqual(['pause', 'load']);
    });
});
