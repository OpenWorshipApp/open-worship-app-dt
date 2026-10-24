// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ genVideoIDFromSrc: vi.fn() }));
vi.mock('../screenHelpers', () => ({ genVideoIDFromSrc: h.genVideoIDFromSrc }));
vi.mock('../../helper/mediaControlHelpers', () => ({
    YOUTUBE_PLAYING_ATTR: 'data-youtube-playing',
}));

import {
    checkIsYouTubeSyncIframe,
    genYouTubeSyncId,
    SlideYouTubePlayer,
} from './slideYouTubeSyncHelpers';

function makeIframe() {
    const iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube.com/embed/abc?enablejsapi=1';
    document.body.appendChild(iframe);
    const post = vi.spyOn(iframe.contentWindow!, 'postMessage');
    return { iframe, post };
}

function deliver(
    iframe: HTMLIFrameElement,
    data: unknown,
    origin = 'https://www.youtube.com',
    source: MessageEventSource | null = iframe.contentWindow,
) {
    window.dispatchEvent(
        new MessageEvent('message', {
            data: typeof data === 'string' ? data : JSON.stringify(data),
            origin,
            source,
        }),
    );
}

beforeEach(() => {
    vi.useFakeTimers();
    h.genVideoIDFromSrc.mockReset();
    h.genVideoIDFromSrc.mockReturnValue('video-id');
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.replaceChildren();
});

describe('YouTube slide synchronization', () => {
    it('accepts only API-enabled YouTube embeds and derives a shared id', () => {
        const { iframe } = makeIframe();
        expect(checkIsYouTubeSyncIframe(iframe)).toBe(true);
        expect(genYouTubeSyncId(iframe)).toBe('video-id');
        expect(h.genVideoIDFromSrc).toHaveBeenCalledWith(
            iframe.getAttribute('src'),
        );
        iframe.src = 'https://www.youtube.com/embed/abc';
        expect(checkIsYouTubeSyncIframe(iframe)).toBe(false);
        iframe.src = 'https://example.org/embed/abc?enablejsapi=1';
        expect(checkIsYouTubeSyncIframe(iframe)).toBe(false);
    });

    it('retries the listening handshake until the player answers', () => {
        const { iframe, post } = makeIframe();
        const player = new SlideYouTubePlayer(iframe, 'slide-1', {});
        expect(JSON.parse(post.mock.calls[0][0] as string)).toEqual({
            event: 'listening',
            id: 'slide-1',
            channel: 'widget',
        });
        vi.advanceTimersByTime(800);
        expect(post).toHaveBeenCalledTimes(3);
        iframe.dispatchEvent(new Event('load'));
        expect(post).toHaveBeenCalledTimes(4);
        deliver(iframe, { event: 'infoDelivery', info: { currentTime: 4 } });
        vi.advanceTimersByTime(800);
        expect(post).toHaveBeenCalledTimes(4);
        expect(player.getCurrentTime()).toBe(4);
        player.destroy();
    });

    it('ignores unrelated, untrusted and malformed messages', () => {
        const { iframe, post } = makeIframe();
        const onPlay = vi.fn();
        const player = new SlideYouTubePlayer(iframe, 'slide-1', { onPlay });
        deliver(
            iframe,
            { info: { playerState: 1 } },
            'https://youtube.com',
            window,
        );
        deliver(iframe, { info: { playerState: 1 } }, 'https://example.org');
        deliver(iframe, '{bad json');
        deliver(iframe, null);
        expect(onPlay).not.toHaveBeenCalled();
        vi.advanceTimersByTime(400);
        expect(post).toHaveBeenCalledTimes(2);
        player.destroy();
    });

    it('mutes a follower on readiness and broadcasts only master state changes', () => {
        const { iframe, post } = makeIframe();
        const callbacks = {
            onPlay: vi.fn(),
            onPause: vi.fn(),
            onTimeUpdate: vi.fn(),
        };
        const player = new SlideYouTubePlayer(iframe, 'slide-1', callbacks, {
            muteOnReady: true,
        });
        deliver(iframe, { info: { currentTime: 12, playerState: 1 } });
        expect(player.isPlaying).toBe(true);
        expect(iframe.hasAttribute('data-youtube-playing')).toBe(true);
        expect(callbacks.onPlay).toHaveBeenCalledWith(12);
        expect(callbacks.onTimeUpdate).toHaveBeenCalledWith(12, true);
        expect(
            post.mock.calls.map(
                ([message]) => JSON.parse(message as string).func,
            ),
        ).toContain('mute');
        deliver(iframe, { info: { currentTime: 13, playerState: 1 } });
        expect(callbacks.onPlay).toHaveBeenCalledTimes(1);
        player.pausedBySync = true;
        deliver(iframe, { event: 'onStateChange', info: 2 });
        expect(player.isPlaying).toBe(false);
        expect(iframe.hasAttribute('data-youtube-playing')).toBe(false);
        expect(player.pausedBySync).toBe(false);
        expect(callbacks.onPause).not.toHaveBeenCalled();
        deliver(iframe, { event: 'onStateChange', info: 0 });
        expect(callbacks.onPause).toHaveBeenCalledWith(13);
        player.destroy();
    });

    it('posts playback controls and skips repeated playback rates', () => {
        const { iframe, post } = makeIframe();
        const player = new SlideYouTubePlayer(iframe, 'slide-1', {});
        post.mockClear();
        player.play();
        player.pause();
        player.seekTo(31);
        player.mute();
        player.unMute();
        player.setVolume(55);
        player.setPlaybackRate(1);
        player.setPlaybackRate(1.5);
        player.setPlaybackRate(1.5);
        expect(player.getCurrentTime()).toBe(31);
        expect(player.playbackRate).toBe(1.5);
        expect(
            post.mock.calls.map(([message]) => {
                const { func, args } = JSON.parse(message as string);
                return [func, args];
            }),
        ).toEqual([
            ['playVideo', []],
            ['pauseVideo', []],
            ['seekTo', [31, true]],
            ['mute', []],
            ['unMute', []],
            ['unMute', []],
            ['setVolume', [55]],
            ['setPlaybackRate', [1.5]],
        ]);
        player.destroy();
    });

    it('stops messages, playback state and retries when destroyed', () => {
        const { iframe, post } = makeIframe();
        const onPlay = vi.fn();
        const player = new SlideYouTubePlayer(iframe, 'slide-1', { onPlay });
        deliver(iframe, { info: { playerState: 1 } });
        expect(iframe.hasAttribute('data-youtube-playing')).toBe(true);
        player.destroy();
        expect(iframe.hasAttribute('data-youtube-playing')).toBe(false);
        post.mockClear();
        iframe.dispatchEvent(new Event('load'));
        deliver(iframe, { info: { playerState: 1 } });
        vi.advanceTimersByTime(2000);
        expect(post).not.toHaveBeenCalled();
        expect(onPlay).toHaveBeenCalledTimes(1);
    });
});
