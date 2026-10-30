// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({ toast: vi.fn(), play: vi.fn() }));

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: h.toast }));
vi.mock('./mediaHelpers', () => ({ playMediaElement: h.play }));

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
} from './mediaControlHelpers';

// jsdom plays nothing: `paused`, `pause()` and `currentTime` are pinned on
// each element, and the helpers only read or call them.
function addMedia(
    tagName: 'audio' | 'video',
    { isPaused = false, root = document.body as ParentNode } = {},
) {
    const element = document.createElement(tagName);
    const state = { paused: isPaused };
    Object.defineProperty(element, 'paused', {
        configurable: true,
        get: () => state.paused,
    });
    Object.defineProperty(element, 'currentTime', {
        configurable: true,
        writable: true,
        value: 12,
    });
    element.pause = vi.fn(() => {
        state.paused = true;
    });
    root.appendChild(element);
    return { element, state };
}

function addShadowHost() {
    const host = document.createElement('div');
    document.body.appendChild(host);
    return host.attachShadow({ mode: 'open' });
}

function fireBeforeUnload() {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
}

async function flushEvents() {
    for (let i = 0; i < 5; i++) {
        await Promise.resolve();
    }
}

afterEach(() => {
    document.body.innerHTML = '';
    // Nothing is playing any more, so this also takes the unload guard off.
    handleMediaStopped(new Event('pause'));
});

describe('checkMediaPlaying', () => {
    test('a playing video is found, and said once asked to', () => {
        addMedia('video');
        expect(checkMediaPlaying({})).toBe(true);
        expect(h.toast).toHaveBeenCalledWith(
            'Media is Playing',
            'Please pause all background audios before disabling audio handlers',
        );
    });

    test('says nothing when asked not to, and nothing when all is quiet', () => {
        addMedia('audio');
        expect(checkMediaPlaying({ withMessage: false })).toBe(true);
        document.body.innerHTML = '';
        addMedia('audio', { isPaused: true });
        expect(checkMediaPlaying({})).toBe(false);
        expect(h.toast).not.toHaveBeenCalled();
    });

    test('a scratch player that opted out is not counted', () => {
        const { element } = addMedia('audio');
        element.dataset.ignoreMediaGuarding = 'true';
        expect(checkMediaPlaying({ withMessage: false })).toBe(false);
    });

    test('media inside a shadow root is found', () => {
        const shadowRoot = addShadowHost();
        const nested = document.createElement('div');
        shadowRoot.appendChild(nested);
        addMedia('video', { root: nested.attachShadow({ mode: 'open' }) });
        expect(checkMediaPlaying({ withMessage: false })).toBe(true);
    });

    test('only the query and the element asked about are searched', () => {
        const box = document.createElement('section');
        document.body.appendChild(box);
        addMedia('video');
        expect(
            checkMediaPlaying({
                query: 'audio',
                targetElement: box,
                withMessage: false,
            }),
        ).toBe(false);
        addMedia('audio', { root: box });
        expect(
            checkMediaPlaying({
                query: 'audio',
                targetElement: box,
                withMessage: false,
            }),
        ).toBe(true);
    });

    test('a playing YouTube frame counts only for callers that ask', () => {
        const iframe = document.createElement('iframe');
        iframe.setAttribute(YOUTUBE_PLAYING_ATTR, '');
        document.body.appendChild(iframe);
        expect(checkMediaPlaying({ withMessage: false })).toBe(false);
        expect(
            checkMediaPlaying({ withMessage: false, includeYouTube: true }),
        ).toBe(true);
    });

    test('a playing YouTube frame inside a shadow root is found too', () => {
        const shadowRoot = addShadowHost();
        shadowRoot.appendChild(document.createElement('span'));
        const iframe = document.createElement('iframe');
        iframe.setAttribute(YOUTUBE_PLAYING_ATTR, '');
        shadowRoot.appendChild(iframe);
        expect(
            checkMediaPlaying({ withMessage: false, includeYouTube: true }),
        ).toBe(true);
        iframe.removeAttribute(YOUTUBE_PLAYING_ATTR);
        expect(
            checkMediaPlaying({ withMessage: false, includeYouTube: true }),
        ).toBe(false);
    });
});

describe('the toasts', () => {
    test('a refused press says only what to do', () => {
        showAudioPlayingToast();
        expect(h.toast).toHaveBeenCalledWith(
            'Audio playing',
            'Pause the audio first, then try again.',
        );
    });
});

describe('the unload guard', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        // Lets the force-leave counter reset between tests.
        vi.advanceTimersByTime(3_001);
        vi.useRealTimers();
    });

    test('a playing video blocks leaving, and the third retry gets through', () => {
        const { element } = addMedia('video');
        const event = new Event('play');
        element.addEventListener('play', handleMediaPlaying);
        element.dispatchEvent(event);
        expect(element.hasAttribute(BLOCK_UNLOAD_WHILE_PLAYING_ATTR)).toBe(
            true,
        );
        expect(checkBlockingMediaPlaying()).toBe(true);

        expect(fireBeforeUnload()).toBe(true);
        expect(h.toast).toHaveBeenLastCalledWith(
            'Media playing',
            'Please pause all audio and video before leaving the page. ' +
                'Or attempt 3 times to force leaving.',
        );
        expect(fireBeforeUnload()).toBe(true);
        expect(fireBeforeUnload()).toBe(true);
        // The fourth press in a row is the person insisting.
        expect(fireBeforeUnload()).toBe(false);
        expect(h.toast).toHaveBeenCalledTimes(3);
    });

    test('any playing audio blocks, unless it opted out', () => {
        const { element } = addMedia('audio');
        expect(checkBlockingMediaPlaying()).toBe(true);
        element.dataset.ignoreMediaGuarding = 'true';
        expect(checkBlockingMediaPlaying()).toBe(false);
    });

    test('an event from something that is not media changes nothing', () => {
        const button = document.createElement('button');
        document.body.appendChild(button);
        button.addEventListener('click', handleMediaPlaying);
        button.dispatchEvent(new Event('click'));
        expect(button.hasAttribute(BLOCK_UNLOAD_WHILE_PLAYING_ATTR)).toBe(
            false,
        );
        expect(fireBeforeUnload()).toBe(false);
    });

    test('stopping the last guarded media lets the page go', () => {
        const { element, state } = addMedia('video');
        element.addEventListener('play', handleMediaPlaying);
        element.addEventListener('pause', handleMediaStopped);
        element.dispatchEvent(new Event('play'));

        state.paused = true;
        element.dispatchEvent(new Event('pause'));
        expect(element.hasAttribute(BLOCK_UNLOAD_WHILE_PLAYING_ATTR)).toBe(
            false,
        );
        expect(fireBeforeUnload()).toBe(false);
        expect(h.toast).not.toHaveBeenCalled();
    });

    test('a guard on the page that finds nothing playing steps aside', () => {
        const { element, state } = addMedia('video');
        element.addEventListener('play', handleMediaPlaying);
        element.dispatchEvent(new Event('play'));
        // Paused behind the guard's back: the next unload finds nothing.
        state.paused = true;
        expect(fireBeforeUnload()).toBe(false);
        expect(h.toast).not.toHaveBeenCalled();
    });
});

describe('the background audio handlers', () => {
    let payloads: unknown[];
    let registered: ReturnType<typeof EventHandler.registerEventListener>;

    beforeEach(() => {
        payloads = [];
        registered = EventHandler.registerEventListener(
            [AUDIO_PLAYING_CHANGE_EVENT],
            (data: unknown) => {
                payloads.push(data);
            },
        );
    });

    afterEach(() => {
        EventHandler.unregisterEventListener(registered);
    });

    test('starting a track stops and rewinds every other one', async () => {
        const { element: other } = addMedia('audio');
        const { element: track } = addMedia('audio');
        track.addEventListener('play', handleAudioPlaying);
        track.dispatchEvent(new Event('play'));

        expect(other.pause).toHaveBeenCalledTimes(1);
        expect(other.currentTime).toBe(0);
        expect(track.pause).not.toHaveBeenCalled();
        expect(track.currentTime).toBe(12);
        expect(track.hasAttribute(BLOCK_UNLOAD_WHILE_PLAYING_ATTR)).toBe(true);
        await flushEvents();
        expect(payloads).toEqual([track]);
    });

    test('a pause tells the listeners nothing plays', async () => {
        const { element, state } = addMedia('audio');
        element.addEventListener('play', handleAudioPlaying);
        element.addEventListener('pause', handleAudioPausing);
        element.dispatchEvent(new Event('play'));
        state.paused = true;
        element.dispatchEvent(new Event('pause'));

        expect(element.hasAttribute(BLOCK_UNLOAD_WHILE_PLAYING_ATTR)).toBe(
            false,
        );
        await flushEvents();
        expect(payloads).toEqual([element, null]);
    });

    test('a repeating track starts over from the top', async () => {
        const { element } = addMedia('audio');
        handleAudioEnding(true, { target: element });
        expect(element.currentTime).toBe(0);
        expect(h.play).toHaveBeenCalledWith(element);
        await flushEvents();
        expect(payloads).toEqual([]);
    });

    test('a track that ends for good rewinds and says nothing plays', async () => {
        const { element, state } = addMedia('audio');
        element.addEventListener('play', handleAudioPlaying);
        element.dispatchEvent(new Event('play'));
        state.paused = true;

        const ended = new Event('ended');
        element.addEventListener('ended', (event) => {
            handleAudioEnding(false, event);
        });
        element.dispatchEvent(ended);
        expect(element.currentTime).toBe(0);
        expect(h.play).not.toHaveBeenCalled();
        expect(element.hasAttribute(BLOCK_UNLOAD_WHILE_PLAYING_ATTR)).toBe(
            false,
        );
        await flushEvents();
        expect(payloads).toEqual([element, null]);
    });
});
