// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// `playMediaElement` is the real thing everywhere else, but jsdom's `play()`
// throws "Not implemented" — stubbed so the executor's own behaviour is what is
// under test rather than jsdom's media support.
vi.mock('../../helper/mediaHelpers', () => ({
    playMediaElement: vi.fn((mediaElement: any) => {
        mediaElement.paused = false;
        return Promise.resolve();
    }),
}));

const {
    applyScreenSlideMediaControl,
    cancelScreenSlideMediaControl,
    stopScreenSlideMediaControl,
} = await import('./screenSlideMediaControlHelpers');

type FakeMediaType = {
    id: string;
    paused: boolean;
    currentTime: number;
    volume: number;
    playbackRate: number;
    pause: () => void;
    addEventListener: (name: string, handler: () => void) => void;
    removeEventListener: (name: string, handler: () => void) => void;
    fireTimeUpdate: () => void;
    listenerCount: () => number;
};

function genFakeMedia(id = 'video-abc'): FakeMediaType {
    const listeners = new Set<() => void>();
    return {
        id,
        paused: true,
        currentTime: 0,
        volume: 1,
        playbackRate: 1,
        pause() {
            this.paused = true;
        },
        addEventListener(name, handler) {
            if (name === 'timeupdate') {
                listeners.add(handler);
            }
        },
        removeEventListener(name, handler) {
            if (name === 'timeupdate') {
                listeners.delete(handler);
            }
        },
        fireTimeUpdate() {
            for (const handler of Array.from(listeners)) {
                handler();
            }
        },
        listenerCount() {
            return listeners.size;
        },
    };
}

function genFakePlayer(id = 'youtube-abc') {
    const calls: [string, number][] = [];
    return {
        id,
        isPlaying: false,
        calls,
        getCurrentTime() {
            return 0;
        },
        play() {
            this.isPlaying = true;
            calls.push(['play', 0]);
        },
        pause() {
            this.isPlaying = false;
            calls.push(['pause', 0]);
        },
        seekTo(seconds: number) {
            calls.push(['seekTo', seconds]);
        },
        setVolume(volume: number) {
            calls.push(['setVolume', volume]);
        },
        setPlaybackRate(rate: number) {
            calls.push(['setPlaybackRate', rate]);
        },
    };
}

let screenIdCount = 0;

function genFakeManager(
    mediaElements: FakeMediaType[],
    youTubePlayers: any[] = [],
) {
    screenIdCount += 1;
    const syncCalls: any[] = [];
    return {
        screenId: screenIdCount,
        div: {} as any,
        getAllMediaElements: () => {
            return mediaElements as any;
        },
        getSlideYouTubePlayers: () => {
            return youTubePlayers;
        },
        setSlideVideoCurrentTimeForce: async (...args: any[]) => {
            syncCalls.push(args);
        },
        syncCalls,
    } as any;
}

describe('driving the media of a slide from a run sheet', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    test('nothing is armed when the screen holds no slide', () => {
        const media = genFakeMedia();
        const manager = genFakeManager([media]);
        manager.div = null;

        applyScreenSlideMediaControl(manager, { mode: 'play' });

        vi.advanceTimersByTime(10_000);
        expect(media.paused).toBe(true);
    });

    test('a delay holds everything back, then the start point is seeked', () => {
        const media = genFakeMedia();
        const manager = genFakeManager([media]);

        applyScreenSlideMediaControl(manager, {
            mode: 'play',
            delaySecond: 3,
            startAtSecond: 10,
        });

        expect(media.paused).toBe(true);
        expect(media.currentTime).toBe(0);
        vi.advanceTimersByTime(2_999);
        expect(media.paused).toBe(true);
        vi.advanceTimersByTime(1);
        expect(media.currentTime).toBe(10);
        expect(media.paused).toBe(false);
    });

    test('volume and speed apply in every mode, and only the speed is synced', () => {
        const media = genFakeMedia();
        const manager = genFakeManager([media]);

        applyScreenSlideMediaControl(manager, {
            mode: 'pause',
            volume: 70,
            speed: 2,
        });

        expect(media.volume).toBe(0.7);
        expect(media.playbackRate).toBe(2);
        // The projected screen is force-muted, so a volume is presenter-side only
        // and nothing about it is broadcast — the RATE has to be, or the follower
        // is re-seeked forward on every tick to keep up with a 2x master.
        expect(manager.syncCalls).toEqual([['video-abc', 0, false, 2]]);
    });

    test('an unset volume leaves what the operator set by hand alone', () => {
        const media = genFakeMedia();
        media.volume = 0.4;
        const manager = genFakeManager([media]);

        applyScreenSlideMediaControl(manager, { mode: 'play' });

        expect(media.volume).toBe(0.4);
        expect(media.playbackRate).toBe(1);
        expect(manager.syncCalls).toEqual([]);
    });

    test('pause after N seconds counts from the play', () => {
        const media = genFakeMedia();
        const manager = genFakeManager([media]);

        applyScreenSlideMediaControl(manager, {
            mode: 'play',
            pauseAfterSecond: 60,
        });

        expect(media.paused).toBe(false);
        vi.advanceTimersByTime(59_000);
        expect(media.paused).toBe(false);
        vi.advanceTimersByTime(1_000);
        expect(media.paused).toBe(true);
    });

    test('pause at a media time is WATCHED, and the watcher is one-shot', () => {
        const media = genFakeMedia();
        const manager = genFakeManager([media]);

        applyScreenSlideMediaControl(manager, {
            mode: 'play',
            startAtSecond: 10,
            pauseAtSecond: 70,
        });

        expect(media.listenerCount()).toBe(1);
        media.currentTime = 69.9;
        media.fireTimeUpdate();
        expect(media.paused).toBe(false);
        media.currentTime = 70;
        media.fireTimeUpdate();
        expect(media.paused).toBe(true);
        // Removed on fire, so a rewind and replay is not silently cut short again.
        expect(media.listenerCount()).toBe(0);
    });

    test('stop rewinds to where a play on the same line would have begun', () => {
        const media = genFakeMedia();
        media.paused = false;
        media.currentTime = 42;
        const manager = genFakeManager([media]);

        applyScreenSlideMediaControl(manager, {
            mode: 'stop',
            startAtSecond: 10,
        });

        expect(media.paused).toBe(true);
        expect(media.currentTime).toBe(10);
    });

    test('a later controller on the same screen supersedes the first', () => {
        const media = genFakeMedia();
        const manager = genFakeManager([media]);

        applyScreenSlideMediaControl(manager, {
            mode: 'play',
            pauseAfterSecond: 60,
        });
        applyScreenSlideMediaControl(manager, {
            mode: 'play',
            pauseAfterSecond: 5,
        });

        vi.advanceTimersByTime(5_000);
        expect(media.paused).toBe(true);
        // The first one's 60s pause must not fire into whatever is playing by then.
        media.paused = false;
        vi.advanceTimersByTime(60_000);
        expect(media.paused).toBe(false);
    });

    test('cancelling drops the pending timers AND the watcher', () => {
        const media = genFakeMedia();
        const manager = genFakeManager([media]);

        applyScreenSlideMediaControl(manager, {
            mode: 'play',
            delaySecond: 3,
            pauseAfterSecond: 60,
        });
        applyScreenSlideMediaControl(manager, {
            mode: 'play',
            pauseAtSecond: 70,
        });
        expect(media.listenerCount()).toBe(1);

        cancelScreenSlideMediaControl(manager.screenId);

        expect(media.listenerCount()).toBe(0);
        media.paused = false;
        vi.advanceTimersByTime(120_000);
        expect(media.paused).toBe(false);
    });

    test('unselecting the slide stops everything the controller started', () => {
        const media = genFakeMedia();
        const secondMedia = genFakeMedia('video-def');
        const player = genFakePlayer();
        const manager = genFakeManager([media, secondMedia], [player]);

        applyScreenSlideMediaControl(manager, {
            mode: 'play',
            pauseAfterSecond: 60,
        });
        expect(media.paused).toBe(false);
        expect(secondMedia.paused).toBe(false);
        expect(player.isPlaying).toBe(true);

        expect(stopScreenSlideMediaControl(manager)).toBe(true);

        // EVERY media of the outgoing slide, in both flavours — the whole of what
        // "all the media in this slide" means to an operator leaving the line.
        expect(media.paused).toBe(true);
        expect(secondMedia.paused).toBe(true);
        expect(player.isPlaying).toBe(false);
        // And the controller is disarmed with it: the queued `pauseAfterSecond`
        // must not fire into whatever the operator put up in the meantime.
        expect(media.listenerCount()).toBe(0);
        media.paused = false;
        vi.advanceTimersByTime(120_000);
        expect(media.paused).toBe(false);
    });

    test('a delayed controller is stopped before it has played anything', () => {
        const media = genFakeMedia();
        const manager = genFakeManager([media]);

        applyScreenSlideMediaControl(manager, { mode: 'play', delaySecond: 3 });
        expect(media.paused).toBe(true);

        expect(stopScreenSlideMediaControl(manager)).toBe(true);

        // The delayed `run` would otherwise start the media playing INTO a slide
        // that is already on its way out.
        vi.advanceTimersByTime(10_000);
        expect(media.paused).toBe(true);
    });

    test('a screen under no controller is left alone, and says so', () => {
        const media = genFakeMedia();
        const manager = genFakeManager([media]);
        media.paused = false;

        // Media the OPERATOR started by clicking the mini screen: not the sheet's
        // to stop, and the caller needs the `false` to keep guarding it.
        expect(stopScreenSlideMediaControl(manager)).toBe(false);
        expect(media.paused).toBe(false);

        // Nor is a controller that has already been cancelled.
        applyScreenSlideMediaControl(manager, { mode: 'play' });
        cancelScreenSlideMediaControl(manager.screenId);
        expect(stopScreenSlideMediaControl(manager)).toBe(false);
    });

    test('a YouTube embed is seeked, played, and stopped on a derived timeout', () => {
        const player = genFakePlayer();
        const manager = genFakeManager([], [player]);

        applyScreenSlideMediaControl(manager, {
            mode: 'play',
            startAtSecond: 10,
            pauseAtSecond: 70,
            volume: 70,
            speed: 2,
        });

        expect(player.calls).toEqual([
            ['setVolume', 70],
            ['setPlaybackRate', 2],
            ['seekTo', 10],
            ['play', 0],
        ]);
        // It has no `timeupdate` to watch, so the stop point is timed from the
        // media-clock delta divided by the rate: (70 - 10) / 2 = 30 seconds.
        vi.advanceTimersByTime(29_000);
        expect(player.isPlaying).toBe(true);
        vi.advanceTimersByTime(1_000);
        expect(player.isPlaying).toBe(false);
    });
});
