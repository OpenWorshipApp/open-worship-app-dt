// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('../screenHelpers', () => ({
    genVideoIDFromSrc: (src: string) => `video-${src}`,
}));

import {
    checkIsYouTubeSyncIframe,
    genYouTubeSyncId,
    SlideYouTubePlayer,
} from './slideYouTubeSyncHelpers';

function createIframe(src: string) {
    const posted: any[] = [];
    const fakeWin = {
        postMessage: (message: string) => {
            posted.push(JSON.parse(message));
        },
    };
    const iframe = document.createElement('iframe');
    Object.defineProperty(iframe, 'contentWindow', {
        value: fakeWin,
        configurable: true,
    });
    iframe.setAttribute('src', src);
    return { iframe, fakeWin, posted };
}

function sendMessage(
    source: any,
    data: unknown,
    origin = 'https://www.youtube.com',
) {
    const event = new MessageEvent('message', {
        data: JSON.stringify(data),
        origin,
    });
    Object.defineProperty(event, 'source', { value: source });
    window.dispatchEvent(event);
}

const YOUTUBE_SRC = 'https://www.youtube.com/embed/abc123?rel=0&enablejsapi=1';

describe('slideYouTubeSyncHelpers', () => {
    const players: SlideYouTubePlayer[] = [];
    afterEach(() => {
        while (players.length > 0) {
            players.pop()?.destroy();
        }
        vi.clearAllMocks();
    });

    function makePlayer(callbacks: any, options?: any, src = YOUTUBE_SRC) {
        const created = createIframe(src);
        const player = new SlideYouTubePlayer(
            created.iframe,
            'video-1',
            callbacks,
            options,
        );
        players.push(player);
        return { player, ...created };
    }

    test('detects YouTube sync iframes and derives a stable id', () => {
        const yt = createIframe(YOUTUBE_SRC).iframe;
        const site = createIframe('https://example.com').iframe;
        const noApi = createIframe(
            'https://www.youtube.com/embed/abc123?rel=0',
        ).iframe;
        expect(checkIsYouTubeSyncIframe(yt)).toBe(true);
        expect(checkIsYouTubeSyncIframe(site)).toBe(false);
        expect(checkIsYouTubeSyncIframe(noApi)).toBe(false);
        expect(genYouTubeSyncId(yt)).toBe(`video-${YOUTUBE_SRC}`);
    });

    test('starts the listening handshake on construction', () => {
        const { posted } = makePlayer({});
        expect(posted[0]).toEqual({
            event: 'listening',
            id: 'video-1',
            channel: 'widget',
        });
    });

    test('reports play, time and pause from infoDelivery messages', () => {
        const onPlay = vi.fn();
        const onPause = vi.fn();
        const onTimeUpdate = vi.fn();
        const { player, fakeWin } = makePlayer({
            onPlay,
            onPause,
            onTimeUpdate,
        });

        sendMessage(fakeWin, {
            event: 'infoDelivery',
            info: { currentTime: 5, playerState: 1 },
        });
        expect(onPlay).toHaveBeenCalledWith(5);
        expect(onTimeUpdate).toHaveBeenCalledWith(5, true);
        expect(player.isPlaying).toBe(true);
        expect(player.getCurrentTime()).toBe(5);

        sendMessage(fakeWin, {
            event: 'infoDelivery',
            info: { currentTime: 9, playerState: 2 },
        });
        expect(onPause).toHaveBeenCalledWith(9);
        expect(player.isPlaying).toBe(false);
    });

    test('marks the iframe playing so the media guards can detect it', () => {
        const { player, iframe, fakeWin } = makePlayer({});
        expect(iframe.hasAttribute('data-youtube-playing')).toBe(false);

        sendMessage(fakeWin, {
            event: 'infoDelivery',
            info: { currentTime: 0, playerState: 1 },
        });
        expect(iframe.hasAttribute('data-youtube-playing')).toBe(true);

        sendMessage(fakeWin, {
            event: 'infoDelivery',
            info: { currentTime: 2, playerState: 2 },
        });
        expect(iframe.hasAttribute('data-youtube-playing')).toBe(false);

        // Still playing again, then disposed → the marker must not linger.
        sendMessage(fakeWin, {
            event: 'infoDelivery',
            info: { currentTime: 3, playerState: 1 },
        });
        expect(iframe.hasAttribute('data-youtube-playing')).toBe(true);
        player.destroy();
        expect(iframe.hasAttribute('data-youtube-playing')).toBe(false);
    });

    test('ignores messages from other sources and non-YouTube origins', () => {
        const onPlay = vi.fn();
        const { fakeWin } = makePlayer({ onPlay });

        sendMessage(
            {},
            {
                event: 'infoDelivery',
                info: { currentTime: 1, playerState: 1 },
            },
        );
        sendMessage(
            fakeWin,
            { event: 'infoDelivery', info: { currentTime: 1, playerState: 1 } },
            'https://evil.example.com',
        );
        expect(onPlay).not.toHaveBeenCalled();
    });

    test('suppresses a single pause broadcast after a group-sync pause', () => {
        const onPause = vi.fn();
        const { player, fakeWin } = makePlayer({ onPause });

        sendMessage(fakeWin, {
            event: 'infoDelivery',
            info: { currentTime: 3, playerState: 1 },
        });
        player.pausedBySync = true;
        sendMessage(fakeWin, {
            event: 'infoDelivery',
            info: { currentTime: 3, playerState: 2 },
        });
        expect(onPause).not.toHaveBeenCalled();
        expect(player.pausedBySync).toBe(false);

        // A later, genuine pause is broadcast again.
        sendMessage(fakeWin, {
            event: 'infoDelivery',
            info: { currentTime: 4, playerState: 1 },
        });
        sendMessage(fakeWin, {
            event: 'infoDelivery',
            info: { currentTime: 6, playerState: 2 },
        });
        expect(onPause).toHaveBeenCalledWith(6);
    });

    test('posts control commands to the iframe', () => {
        const { player, posted } = makePlayer({});
        posted.length = 0;
        player.play();
        player.pause();
        player.seekTo(12.5);
        player.mute();
        player.unMute();
        expect(posted).toEqual([
            {
                event: 'command',
                func: 'playVideo',
                args: [],
                id: 'video-1',
                channel: 'widget',
            },
            {
                event: 'command',
                func: 'pauseVideo',
                args: [],
                id: 'video-1',
                channel: 'widget',
            },
            {
                event: 'command',
                func: 'seekTo',
                args: [12.5, true],
                id: 'video-1',
                channel: 'widget',
            },
            {
                event: 'command',
                func: 'mute',
                args: [],
                id: 'video-1',
                channel: 'widget',
            },
            {
                event: 'command',
                func: 'unMute',
                args: [],
                id: 'video-1',
                channel: 'widget',
            },
        ]);
        expect(player.getCurrentTime()).toBe(12.5);
    });

    test('mutes a follower once, as soon as the player is ready', () => {
        const { fakeWin, posted } = makePlayer({}, { muteOnReady: true });
        posted.length = 0;
        // First message from the player = ready → a single mute is posted.
        sendMessage(fakeWin, {
            event: 'infoDelivery',
            info: { currentTime: 0, playerState: 2 },
        });
        sendMessage(fakeWin, {
            event: 'infoDelivery',
            info: { currentTime: 0, playerState: 1 },
        });
        const mutes = posted.filter((m) => m.func === 'mute');
        expect(mutes).toHaveLength(1);
    });

    test('does not auto-mute the master (muteOnReady off)', () => {
        const { fakeWin, posted } = makePlayer({});
        posted.length = 0;
        sendMessage(fakeWin, {
            event: 'infoDelivery',
            info: { currentTime: 0, playerState: 1 },
        });
        expect(posted.some((m) => m.func === 'mute')).toBe(false);
    });

    test('stops reacting to messages after destroy', () => {
        const onPlay = vi.fn();
        const { player, fakeWin } = makePlayer({ onPlay });
        player.destroy();
        sendMessage(fakeWin, {
            event: 'infoDelivery',
            info: { currentTime: 1, playerState: 1 },
        });
        expect(onPlay).not.toHaveBeenCalled();
    });
});
