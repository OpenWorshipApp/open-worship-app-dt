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
    handleAudioPausing,
    handleAudioPlaying,
    handleMediaPlaying,
    handleMediaStopped,
} from './audioControlHelpers';

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
});
