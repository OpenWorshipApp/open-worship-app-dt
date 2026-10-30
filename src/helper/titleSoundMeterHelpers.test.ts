// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { initTitleSoundMeter } from './titleSoundMeterHelpers';

type MediaStateType = {
    paused?: boolean;
    ended?: boolean;
    muted?: boolean;
    volume?: number;
    readyState?: number;
};

// jsdom plays nothing, so every property the meter reads is pinned per
// element -- the meter only ever reads them.
function addMedia(
    tagName: 'audio' | 'video',
    {
        paused = false,
        ended = false,
        muted = false,
        volume = 1,
        readyState = 4,
    }: MediaStateType = {},
) {
    const element = document.createElement(tagName);
    const state = { paused, ended, muted, volume, readyState };
    for (const key of Object.keys(state) as (keyof typeof state)[]) {
        Object.defineProperty(element, key, {
            configurable: true,
            get: () => state[key],
        });
    }
    document.body.appendChild(element);
    return { element, state };
}

async function fire(element: HTMLElement, eventName: string) {
    // Media events do not bubble; the meter listens in the capture phase.
    element.dispatchEvent(new Event(eventName));
    await Promise.resolve();
    await Promise.resolve();
}

describe('the window title sound meter', () => {
    beforeEach(() => {
        initTitleSoundMeter();
        document.title = 'Presenter';
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    test('a quiet track shows the low meter', async () => {
        const { element } = addMedia('audio', { volume: 0.2 });
        await fire(element, 'play');
        expect(document.title).toBe('Presenter 🔈');
    });

    test('the level picks the meter, and the loudest audible element wins', async () => {
        const { element: medium } = addMedia('audio', { volume: 0.5 });
        await fire(medium, 'playing');
        expect(document.title).toBe('Presenter 🔉');

        const { element: loud } = addMedia('video', { volume: 0.9 });
        await fire(loud, 'volumechange');
        expect(document.title).toBe('Presenter 🔊');
    });

    test('paused, ended, muted, silent and empty media do not count', async () => {
        addMedia('audio', { paused: true });
        addMedia('audio', { ended: true });
        addMedia('video', { muted: true });
        addMedia('audio', { volume: 0 });
        const { element } = addMedia('video', { readyState: 1 });
        await fire(element, 'play');
        expect(document.title).toBe('Presenter');
    });

    test('the meter goes away once the sound stops', async () => {
        const { element, state } = addMedia('audio', { volume: 1 });
        await fire(element, 'play');
        expect(document.title).toBe('Presenter 🔊');

        state.paused = true;
        await fire(element, 'pause');
        expect(document.title).toBe('Presenter');
    });

    test('a title rewritten by other code is read afresh', async () => {
        const { element, state } = addMedia('audio', { volume: 0.6 });
        await fire(element, 'play');
        expect(document.title).toBe('Presenter 🔉');

        document.title = 'Slide Editor 🔉';
        state.volume = 0.1;
        await fire(element, 'volumechange');
        expect(document.title).toBe('Slide Editor 🔈');

        state.ended = true;
        await fire(element, 'ended');
        expect(document.title).toBe('Slide Editor');
    });

    test('a burst of media events is one recompute and one title write', async () => {
        const { element } = addMedia('audio', { volume: 1 });
        const titleSetter = vi.spyOn(document, 'title', 'set');
        element.dispatchEvent(new Event('play'));
        element.dispatchEvent(new Event('playing'));
        element.dispatchEvent(new Event('volumechange'));
        expect(titleSetter).not.toHaveBeenCalled();
        await Promise.resolve();
        await Promise.resolve();
        expect(titleSetter).toHaveBeenCalledTimes(1);
        expect(titleSetter).toHaveBeenCalledWith('Presenter 🔊');

        // An event that changes nothing writes nothing.
        await fire(element, 'emptied');
        expect(titleSetter).toHaveBeenCalledTimes(1);
    });
});
