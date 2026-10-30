// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({ handleError: vi.fn() }));

vi.mock('./errorHelpers', () => ({ handleError: h.handleError }));

import {
    captureVideoFrameDataUrl,
    playMediaElement,
    releaseMediaElement,
    releaseMediaElementWhenDetached,
} from './mediaHelpers';

// jsdom has no media player and no canvas: the element methods the helpers
// call are stubbed on the prototypes and read back as what was done.
let pauseSpy: ReturnType<typeof vi.spyOn>;
let loadSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    pauseSpy = vi
        .spyOn(HTMLMediaElement.prototype, 'pause')
        .mockImplementation(() => {});
    loadSpy = vi
        .spyOn(HTMLMediaElement.prototype, 'load')
        .mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
});

describe('playMediaElement', () => {
    test('a play that starts is left alone', async () => {
        const video = document.createElement('video');
        video.play = vi.fn().mockResolvedValue(undefined);
        await playMediaElement(video);
        expect(video.play).toHaveBeenCalledTimes(1);
        expect(h.handleError).not.toHaveBeenCalled();
    });

    test('a play interrupted by a pause is not an app error', async () => {
        const video = document.createElement('video');
        video.play = vi
            .fn()
            .mockRejectedValue(new DOMException('interrupted', 'AbortError'));
        await playMediaElement(video);
        expect(h.handleError).not.toHaveBeenCalled();
    });

    test('any other refusal is reported', async () => {
        const error = new DOMException('no source', 'NotSupportedError');
        const audio = document.createElement('audio');
        audio.play = vi.fn().mockRejectedValue(error);
        await playMediaElement(audio);
        expect(h.handleError).toHaveBeenCalledWith(error);

        const plainError = new Error('boom');
        audio.play = vi.fn().mockRejectedValue(plainError);
        await playMediaElement(audio);
        expect(h.handleError).toHaveBeenLastCalledWith(plainError);
    });

    test('an engine whose play returns nothing still resolves', async () => {
        const audio = document.createElement('audio');
        audio.play = vi.fn().mockReturnValue(undefined);
        await expect(playMediaElement(audio)).resolves.toBeUndefined();
        expect(h.handleError).not.toHaveBeenCalled();
    });
});

describe('releaseMediaElement', () => {
    test('pauses, drops the source and reloads so the player is handed back', () => {
        const video = document.createElement('video');
        video.setAttribute('src', 'file:///clip.mp4');
        releaseMediaElement(video);
        expect(pauseSpy).toHaveBeenCalledTimes(1);
        expect(video.hasAttribute('src')).toBe(false);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(h.handleError).not.toHaveBeenCalled();
    });

    test('a player that throws is reported, not raised', () => {
        const error = new Error('detached player');
        pauseSpy.mockImplementation(() => {
            throw error;
        });
        const audio = document.createElement('audio');
        expect(() => releaseMediaElement(audio)).not.toThrow();
        expect(h.handleError).toHaveBeenCalledWith(error);
        expect(loadSpy).not.toHaveBeenCalled();
    });
});

describe('releaseMediaElementWhenDetached', () => {
    test('keeps an element React re-attached', () => {
        vi.useFakeTimers();
        const video = document.createElement('video');
        document.body.appendChild(video);
        video.setAttribute('src', 'file:///clip.mp4');
        releaseMediaElementWhenDetached(video);
        expect(pauseSpy).not.toHaveBeenCalled();
        vi.advanceTimersByTime(0);
        expect(pauseSpy).not.toHaveBeenCalled();
        expect(video.getAttribute('src')).toBe('file:///clip.mp4');
    });

    test('releases an element that really left the document', () => {
        vi.useFakeTimers();
        const video = document.createElement('video');
        video.setAttribute('src', 'file:///clip.mp4');
        releaseMediaElementWhenDetached(video);
        // Checked after the commit, never at once.
        expect(pauseSpy).not.toHaveBeenCalled();
        vi.advanceTimersByTime(0);
        expect(pauseSpy).toHaveBeenCalledTimes(1);
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(video.hasAttribute('src')).toBe(false);
    });
});

describe('captureVideoFrameDataUrl', () => {
    let createdVideos: HTMLVideoElement[];
    let drawImage: ReturnType<typeof vi.fn>;
    let getContextSpy: ReturnType<typeof vi.spyOn>;
    let toDataURLSpy: ReturnType<typeof vi.spyOn>;
    let canvasSizes: { width: number; height: number }[];

    beforeEach(() => {
        createdVideos = [];
        canvasSizes = [];
        drawImage = vi.fn();
        const createElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation(((
            tagName: string,
        ) => {
            const element = createElement(tagName);
            if (element instanceof HTMLVideoElement) {
                createdVideos.push(element);
            }
            return element;
        }) as typeof document.createElement);
        getContextSpy = vi
            .spyOn(HTMLCanvasElement.prototype, 'getContext')
            .mockImplementation(function (this: HTMLCanvasElement) {
                canvasSizes.push({ width: this.width, height: this.height });
                return { drawImage } as any;
            });
        toDataURLSpy = vi
            .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
            .mockImplementation(
                (type?: string, quality?: any) => `data:${type};q=${quality}`,
            );
    });

    function loadFrame(video: HTMLVideoElement, width: number, height: number) {
        Object.defineProperty(video, 'videoWidth', { value: width });
        Object.defineProperty(video, 'videoHeight', { value: height });
        video.dispatchEvent(new Event('loadeddata'));
    }

    test('scales a large frame down to the thumbnail width', async () => {
        const capturing = captureVideoFrameDataUrl('file:///big.mp4', {
            maxWidth: 320,
            quality: 0.5,
        });
        const [video] = createdVideos;
        expect(video.muted).toBe(true);
        expect(video.preload).toBe('auto');
        expect(video.src).toBe('file:///big.mp4');

        loadFrame(video, 1920, 1080);
        expect(await capturing).toBe('data:image/jpeg;q=0.5');
        expect(canvasSizes).toEqual([{ width: 320, height: 180 }]);
        expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 320, 180);
        // The throwaway player is handed back at once.
        expect(pauseSpy).toHaveBeenCalledTimes(1);
        expect(loadSpy).toHaveBeenCalledTimes(1);
    });

    test('keeps a frame that is already small enough at its own size', async () => {
        const capturing = captureVideoFrameDataUrl('file:///small.mp4', {
            maxWidth: 640,
        });
        loadFrame(createdVideos[0], 320, 240);
        expect(await capturing).toBe('data:image/jpeg;q=0.9');
        expect(canvasSizes).toEqual([{ width: 320, height: 240 }]);
    });

    test('takes the full frame when no width is asked for', async () => {
        const capturing = captureVideoFrameDataUrl('file:///any.mp4');
        loadFrame(createdVideos[0], 1280, 720);
        await capturing;
        expect(canvasSizes).toEqual([{ width: 1280, height: 720 }]);
    });

    test('a video that cannot load gives no still', async () => {
        const capturing = captureVideoFrameDataUrl('file:///broken.mp4');
        createdVideos[0].dispatchEvent(new Event('error'));
        expect(await capturing).toBeNull();
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(getContextSpy).not.toHaveBeenCalled();
    });

    test('a video with no picture gives no still', async () => {
        const capturing = captureVideoFrameDataUrl('file:///audio-only.mp4');
        loadFrame(createdVideos[0], 0, 0);
        expect(await capturing).toBeNull();
        expect(drawImage).not.toHaveBeenCalled();
    });

    test('a canvas with no 2d context gives no still', async () => {
        getContextSpy.mockReturnValue(null);
        const capturing = captureVideoFrameDataUrl('file:///clip.mp4');
        loadFrame(createdVideos[0], 640, 360);
        expect(await capturing).toBeNull();
        expect(toDataURLSpy).not.toHaveBeenCalled();
    });

    test('a frame that cannot be encoded is reported and gives no still', async () => {
        const error = new Error('tainted canvas');
        toDataURLSpy.mockImplementation(() => {
            throw error;
        });
        const capturing = captureVideoFrameDataUrl('https://x/clip.mp4');
        loadFrame(createdVideos[0], 640, 360);
        expect(await capturing).toBeNull();
        expect(h.handleError).toHaveBeenCalledWith(error);
        expect(loadSpy).toHaveBeenCalledTimes(1);
    });

    test('a video that never loads gives up after ten seconds', async () => {
        vi.useFakeTimers();
        const capturing = captureVideoFrameDataUrl('file:///stuck.mp4');
        await vi.advanceTimersByTimeAsync(9_999);
        expect(loadSpy).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(await capturing).toBeNull();
        expect(loadSpy).toHaveBeenCalledTimes(1);
    });
});
