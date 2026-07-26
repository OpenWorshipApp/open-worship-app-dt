// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    showSimpleToast: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: mocks.showSimpleToast,
}));

import {
    checkBlockingMediaPlaying,
    checkMediaPlaying,
    handleAudioPausing,
    handleAudioPlaying,
    handleMediaPlaying,
    handleMediaStopped,
    YOUTUBE_PLAYING_ATTR,
} from './mediaControlHelpers';

function mockPaused(mediaElement: HTMLMediaElement, getPaused: () => boolean) {
    Object.defineProperty(mediaElement, 'paused', {
        configurable: true,
        get: getPaused,
    });
}

function toMediaEvent(mediaElement: HTMLMediaElement) {
    return {
        currentTarget: mediaElement,
        target: mediaElement,
    } as unknown as Event;
}

describe('audio and video unload blocking', () => {
    beforeEach(() => {
        document.body.replaceChildren();
        vi.clearAllMocks();
    });

    test('keeps blocking until all opted-in playback pauses or ends', () => {
        let isAudioPaused = false;
        let isVideoPaused = false;
        const audioElement = document.createElement('audio');
        const videoElement = document.createElement('video');
        const mutedBackgroundVideo = document.createElement('video');
        const shadowHost = document.createElement('div');
        const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
        mockPaused(audioElement, () => isAudioPaused);
        mockPaused(videoElement, () => isVideoPaused);
        mockPaused(mutedBackgroundVideo, () => false);
        shadowRoot.appendChild(videoElement);
        document.body.append(audioElement, shadowHost, mutedBackgroundVideo);

        handleAudioPlaying(toMediaEvent(audioElement));
        handleMediaPlaying(toMediaEvent(videoElement));
        expect(checkBlockingMediaPlaying()).toBe(true);

        isAudioPaused = true;
        handleAudioPausing(toMediaEvent(audioElement));
        const blockedByVideo = new Event('beforeunload', {
            cancelable: true,
        });
        window.dispatchEvent(blockedByVideo);
        expect(blockedByVideo.defaultPrevented).toBe(true);

        isVideoPaused = true;
        handleMediaStopped(toMediaEvent(videoElement));
        expect(checkBlockingMediaPlaying()).toBe(false);
        const allowedAfterVideoEnds = new Event('beforeunload', {
            cancelable: true,
        });
        window.dispatchEvent(allowedAfterVideoEnds);
        expect(allowedAfterVideoEnds.defaultPrevented).toBe(false);
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Media playing',
            expect.stringContaining('pause all audio and video'),
        );
    });

    test('detects a playing YouTube iframe only when opted in, piercing shadow roots', () => {
        const shadowHost = document.createElement('div');
        const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
        const iframe = document.createElement('iframe');
        iframe.setAttribute(YOUTUBE_PLAYING_ATTR, '');
        shadowRoot.appendChild(iframe);
        document.body.appendChild(shadowHost);

        // The default (opted-out) guard ignores YouTube — a background-audio
        // toggle or unload check must not be tripped by a video embed.
        expect(checkMediaPlaying({ withMessage: false })).toBe(false);

        expect(
            checkMediaPlaying({ withMessage: false, includeYouTube: true }),
        ).toBe(true);

        iframe.removeAttribute(YOUTUBE_PLAYING_ATTR);
        expect(
            checkMediaPlaying({ withMessage: false, includeYouTube: true }),
        ).toBe(false);
    });

    test('allows unloading after a playing video is removed', () => {
        const videoElement = document.createElement('video');
        mockPaused(videoElement, () => false);
        document.body.appendChild(videoElement);
        handleMediaPlaying(toMediaEvent(videoElement));

        videoElement.remove();
        const allowedAfterRemoval = new Event('beforeunload', {
            cancelable: true,
        });
        window.dispatchEvent(allowedAfterRemoval);

        expect(allowedAfterRemoval.defaultPrevented).toBe(false);
        expect(checkBlockingMediaPlaying()).toBe(false);
    });
    test('audio ending rewinds and either repeats or reports the stop', async () => {
        const { handleAudioEnding, handleMediaPlaying, showAudioPlayingToast } =
            await import('./mediaControlHelpers');
        const { showMediaPlayingToast } = await import('./mediaControlHelpers');

        // both guard toasts are plain notifications
        expect(() => {
            showMediaPlayingToast();
            showAudioPlayingToast();
        }).not.toThrow();

        const audioElement = document.createElement('audio');
        Object.defineProperties(audioElement, {
            currentTime: { configurable: true, writable: true, value: 12 },
            paused: { configurable: true, writable: true, value: false },
            play: { configurable: true, value: vi.fn(async () => {}) },
        });
        document.body.appendChild(audioElement);
        handleMediaPlaying(toMediaEvent(audioElement));

        handleAudioEnding(true, { target: audioElement });
        expect(audioElement.currentTime).toBe(0);
        // a repeating track starts over instead of releasing the guard
        expect(
            audioElement.hasAttribute('data-block-unload-while-playing'),
        ).toBe(true);

        audioElement.currentTime = 30;
        handleAudioEnding(false, { target: audioElement });
        expect(audioElement.currentTime).toBe(0);
        expect(
            audioElement.hasAttribute('data-block-unload-while-playing'),
        ).toBe(false);
        audioElement.remove();
    });
});
