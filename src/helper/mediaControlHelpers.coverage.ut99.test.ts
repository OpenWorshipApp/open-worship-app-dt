// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { showSimpleToastMock, playMediaElementMock } = vi.hoisted(() => ({
    showSimpleToastMock: vi.fn(),
    playMediaElementMock: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));
// `appProvider` reads the electron preload at module load; stubbed locally.
vi.mock('../server/appProvider', () => ({ default: {} }));
vi.mock('./mediaHelpers', () => ({ playMediaElement: playMediaElementMock }));

import EventHandler from '../event/EventHandler';
import {
    AUDIO_PLAYING_CHANGE_EVENT,
    BLOCK_UNLOAD_WHILE_PLAYING_ATTR,
    YOUTUBE_PLAYING_ATTR,
    checkBlockingMediaPlaying,
    checkMediaPlaying,
    handleAudioEnding,
    handleAudioPausing,
    handleAudioPlaying,
    handleMediaPlaying,
    handleMediaStopped,
    showAudioPlayingToast,
    showMediaPlayingToast3Attempt,
} from './mediaControlHelpers';

function addMedia(
    tagName: 'audio' | 'video',
    { isPaused = false, parent = document.body as ParentNode } = {},
) {
    const element = document.createElement(tagName);
    // jsdom's `paused` is a read-only getter that is always `true`.
    Object.defineProperty(element, 'paused', {
        configurable: true,
        writable: true,
        value: isPaused,
    });
    Object.defineProperty(element, 'currentTime', {
        configurable: true,
        writable: true,
        value: 42,
    });
    (parent as Element).append(element);
    return element;
}

function addShadowHost() {
    const host = document.createElement('div');
    document.body.append(host);
    return host.attachShadow({ mode: 'open' });
}

function dispatchBeforeUnload() {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event;
}

async function flushMicrotasks() {
    for (let i = 0; i < 5; i++) {
        await Promise.resolve();
    }
}

let pauseCalls: HTMLMediaElement[] = [];

beforeEach(() => {
    vi.useFakeTimers();
    pauseCalls = [];
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
        this: HTMLMediaElement,
    ) {
        pauseCalls.push(this);
    });
});

afterEach(() => {
    document.body.innerHTML = '';
    // Nothing is playing any more: this drops the unload guard if it is up.
    handleMediaStopped(new Event('pause'));
    // Lets the guard's force-leave counter reset for the next test.
    vi.advanceTimersByTime(3000);
    vi.useRealTimers();
});

describe('checkMediaPlaying', () => {
    test('a playing video is found and the toast says so', () => {
        addMedia('video');
        expect(checkMediaPlaying({})).toBe(true);
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Media is Playing',
            'Please pause all background audios before disabling audio handlers',
        );
    });

    test('withMessage false answers without a toast', () => {
        addMedia('audio');
        expect(checkMediaPlaying({ withMessage: false })).toBe(true);
        expect(showSimpleToastMock).not.toHaveBeenCalled();
    });

    test('paused media, or media opted out of guarding, does not count', () => {
        addMedia('audio', { isPaused: true });
        const preview = addMedia('video');
        preview.dataset.ignoreMediaGuarding = 'true';
        expect(checkMediaPlaying({})).toBe(false);
        expect(showSimpleToastMock).not.toHaveBeenCalled();
    });

    test('media playing inside a shadow root is found', () => {
        const shadowRoot = addShadowHost();
        const nested = document.createElement('div');
        shadowRoot.append(nested);
        // Two levels deep: a shadow root inside a shadow root.
        const innerShadow = nested.attachShadow({ mode: 'open' });
        addMedia('video', { parent: innerShadow });
        expect(checkMediaPlaying({ withMessage: false })).toBe(true);
    });

    test('the query and the root narrow the search', () => {
        const container = document.createElement('section');
        document.body.append(container);
        addMedia('video');
        addMedia('audio', { parent: container, isPaused: true });
        expect(
            checkMediaPlaying({ targetElement: container, withMessage: false }),
        ).toBe(false);
        expect(checkMediaPlaying({ query: 'audio', withMessage: false })).toBe(
            false,
        );
        expect(checkMediaPlaying({ query: 'video', withMessage: false })).toBe(
            true,
        );
    });

    test('a playing YouTube iframe counts only when asked for', () => {
        const iframe = document.createElement('iframe');
        iframe.setAttribute(YOUTUBE_PLAYING_ATTR, '');
        document.body.append(iframe);
        expect(checkMediaPlaying({ withMessage: false })).toBe(false);
        expect(
            checkMediaPlaying({ includeYouTube: true, withMessage: false }),
        ).toBe(true);
    });

    test('a playing YouTube iframe inside a shadow root is found', () => {
        const shadowRoot = addShadowHost();
        const iframe = document.createElement('iframe');
        iframe.setAttribute(YOUTUBE_PLAYING_ATTR, '');
        shadowRoot.append(iframe);
        expect(checkMediaPlaying({ includeYouTube: true })).toBe(true);
        expect(showSimpleToastMock).toHaveBeenCalledOnce();
    });

    test('a paused YouTube iframe (no attribute) does not count', () => {
        const shadowRoot = addShadowHost();
        shadowRoot.append(document.createElement('iframe'));
        document.body.append(document.createElement('iframe'));
        expect(checkMediaPlaying({ includeYouTube: true })).toBe(false);
    });
});

describe('toasts', () => {
    test('the leave-page toast names the three-attempt escape', () => {
        showMediaPlayingToast3Attempt();
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Media playing',
            'Please pause all audio and video before leaving the page. ' +
                'Or attempt 3 times to force leaving.',
        );
    });

    test('the audio toast only says what to do', () => {
        showAudioPlayingToast();
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Audio playing',
            'Pause the audio first, then try again.',
        );
    });
});

describe('checkBlockingMediaPlaying', () => {
    test('any playing audio blocks', () => {
        addMedia('audio');
        expect(checkBlockingMediaPlaying()).toBe(true);
    });

    test('a video blocks only once it is marked as guarded', () => {
        const video = addMedia('video');
        expect(checkBlockingMediaPlaying()).toBe(false);
        video.setAttribute(BLOCK_UNLOAD_WHILE_PLAYING_ATTR, '');
        expect(checkBlockingMediaPlaying()).toBe(true);
    });
});

describe('the unload guard', () => {
    test('an event that is not from a media element changes nothing', () => {
        const div = document.createElement('div');
        handleMediaPlaying({ currentTarget: div, target: div } as any);
        expect(div.hasAttribute(BLOCK_UNLOAD_WHILE_PLAYING_ATTR)).toBe(false);
        addMedia('audio');
        expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
    });

    test('playing media blocks leaving three times, then lets go', () => {
        const video = addMedia('video');
        handleMediaPlaying({ currentTarget: video } as any);
        expect(video.hasAttribute(BLOCK_UNLOAD_WHILE_PLAYING_ATTR)).toBe(true);

        for (let i = 0; i < 3; i++) {
            expect(dispatchBeforeUnload().defaultPrevented).toBe(true);
        }
        expect(showSimpleToastMock).toHaveBeenCalledTimes(3);
        expect(showSimpleToastMock).toHaveBeenLastCalledWith(
            'Media playing',
            expect.stringContaining('attempt 3 times'),
        );
        // The fourth attempt forces the way out, and the guard is gone.
        expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
        expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
        expect(showSimpleToastMock).toHaveBeenCalledTimes(3);
    });

    test('the attempt count resets after three quiet seconds', () => {
        const video = addMedia('video');
        handleMediaPlaying({ target: video } as any);
        dispatchBeforeUnload();
        dispatchBeforeUnload();
        vi.advanceTimersByTime(3000);
        for (let i = 0; i < 3; i++) {
            expect(dispatchBeforeUnload().defaultPrevented).toBe(true);
        }
    });

    test('stopping the last guarded media removes the guard', () => {
        const video = addMedia('video');
        handleMediaPlaying({ currentTarget: video } as any);
        handleMediaStopped({ currentTarget: video } as any);
        expect(video.hasAttribute(BLOCK_UNLOAD_WHILE_PLAYING_ATTR)).toBe(false);
        expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
        expect(showSimpleToastMock).not.toHaveBeenCalled();
    });

    test('stopping one of two keeps the guard for the other', () => {
        const first = addMedia('video');
        const second = addMedia('video');
        handleMediaPlaying({ currentTarget: first } as any);
        handleMediaPlaying({ currentTarget: second } as any);
        handleMediaStopped({ currentTarget: first } as any);
        expect(dispatchBeforeUnload().defaultPrevented).toBe(true);
    });

    test('a guard whose media paused on its own steps aside', () => {
        const video = addMedia('video');
        handleMediaPlaying({ currentTarget: video } as any);
        (video as any).paused = true;
        expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
        expect(showSimpleToastMock).not.toHaveBeenCalled();
        // ...and removed itself: playing again needs a fresh handleMediaPlaying.
        (video as any).paused = false;
        expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
    });
});

describe('background audio handlers', () => {
    let events: unknown[];
    let registered: ReturnType<typeof EventHandler.registerEventListener>;

    beforeEach(() => {
        events = [];
        registered = EventHandler.registerEventListener(
            [AUDIO_PLAYING_CHANGE_EVENT],
            (data: unknown) => {
                events.push(data);
            },
        );
    });

    afterEach(() => {
        EventHandler.unregisterEventListener(registered);
    });

    test('playing one track rewinds and pauses every other one', async () => {
        const playing = addMedia('audio');
        const other1 = addMedia('audio');
        const other2 = addMedia('audio', { isPaused: true });
        handleAudioPlaying({ target: playing, currentTarget: playing });
        expect(pauseCalls).toEqual([other1, other2]);
        expect([other1.currentTime, other2.currentTime]).toEqual([0, 0]);
        expect(playing.currentTime).toBe(42);
        expect(playing.hasAttribute(BLOCK_UNLOAD_WHILE_PLAYING_ATTR)).toBe(
            true,
        );
        await flushMicrotasks();
        expect(events).toEqual([playing]);
    });

    test('pausing a track drops its guard and announces null', async () => {
        const track = addMedia('audio');
        handleAudioPlaying({ target: track, currentTarget: track });
        (track as any).paused = true;
        handleAudioPausing({ target: track, currentTarget: track });
        expect(track.hasAttribute(BLOCK_UNLOAD_WHILE_PLAYING_ATTR)).toBe(false);
        expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
        await flushMicrotasks();
        expect(events).toEqual([track, null]);
    });

    test('an ending track on repeat rewinds and plays again', async () => {
        const track = addMedia('audio');
        track.setAttribute(BLOCK_UNLOAD_WHILE_PLAYING_ATTR, '');
        handleAudioEnding(true, { target: track, currentTarget: track });
        expect(track.currentTime).toBe(0);
        expect(playMediaElementMock).toHaveBeenCalledWith(track);
        // Still playing: the guard and the on-air state are untouched.
        expect(track.hasAttribute(BLOCK_UNLOAD_WHILE_PLAYING_ATTR)).toBe(true);
        await flushMicrotasks();
        expect(events).toEqual([]);
    });

    test('an ending track without repeat stops and announces null', async () => {
        const track = addMedia('audio');
        track.setAttribute(BLOCK_UNLOAD_WHILE_PLAYING_ATTR, '');
        (track as any).paused = true;
        handleAudioEnding(false, { target: track, currentTarget: track });
        expect(track.currentTime).toBe(0);
        expect(playMediaElementMock).not.toHaveBeenCalled();
        expect(track.hasAttribute(BLOCK_UNLOAD_WHILE_PLAYING_ATTR)).toBe(false);
        await flushMicrotasks();
        expect(events).toEqual([null]);
    });
});
