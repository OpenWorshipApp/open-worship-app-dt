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

// jsdom never plays anything: its media elements are paused for good with no
// data. The meter only reads these properties, so each element gets its own.
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
    for (const key of Object.keys(state) as Array<keyof typeof state>) {
        Object.defineProperty(element, key, {
            configurable: true,
            get: () => state[key],
        });
    }
    document.body.appendChild(element);
    return { element, state };
}

function flushMicrotasks() {
    return new Promise<void>((resolve) => {
        queueMicrotask(resolve);
    });
}

const titleDescriptor = Object.getOwnPropertyDescriptor(
    Document.prototype,
    'title',
)!;
let titleWrites: string[] = [];

beforeEach(() => {
    document.title = 'Presenter';
    titleWrites = [];
    // Counts native title writes: the meter must only write on a change.
    Object.defineProperty(document, 'title', {
        configurable: true,
        get: () => titleDescriptor.get!.call(document),
        set: (value: string) => {
            titleWrites.push(value);
            titleDescriptor.set!.call(document, value);
        },
    });
    initTitleSoundMeter();
});

afterEach(() => {
    delete (document as any).title;
    document.body.innerHTML = '';
});

describe('initTitleSoundMeter', () => {
    test.each([
        [0.2, '🔈'],
        [1 / 3, '🔈'],
        [0.5, '🔉'],
        [2 / 3, '🔉'],
        [0.9, '🔊'],
    ])('volume %s shows %s', async (volume, meter) => {
        const { element } = addMedia('audio', { volume });
        element.dispatchEvent(new Event('play'));
        await flushMicrotasks();
        expect(document.title).toBe(`Presenter ${meter}`);
    });

    test('a media event that does not bubble is still heard on document', async () => {
        const { element } = addMedia('video', { volume: 0.9 });
        const event = new Event('playing', { bubbles: false });
        element.dispatchEvent(event);
        await flushMicrotasks();
        expect(document.title).toBe('Presenter 🔊');
    });

    test('the loudest audible element sets the level', async () => {
        addMedia('audio', { volume: 0.2 });
        addMedia('video', { volume: 0.9 });
        const { element } = addMedia('audio', { volume: 0.5 });
        element.dispatchEvent(new Event('volumechange'));
        await flushMicrotasks();
        expect(document.title).toBe('Presenter 🔊');
    });

    test.each<[string, MediaStateType]>([
        ['paused', { paused: true }],
        ['ended', { ended: true }],
        ['muted', { muted: true }],
        ['silent', { volume: 0 }],
        ['without data yet', { readyState: 1 }],
    ])('an element that is %s does not count', async (_label, state) => {
        const { element } = addMedia('audio', state);
        element.dispatchEvent(new Event('play'));
        await flushMicrotasks();
        expect(document.title).toBe('Presenter');
        expect(titleWrites).toEqual([]);
    });

    test('pausing the last audible element strips the meter', async () => {
        const { element, state } = addMedia('audio', { volume: 0.5 });
        element.dispatchEvent(new Event('play'));
        await flushMicrotasks();
        expect(document.title).toBe('Presenter 🔉');

        state.paused = true;
        element.dispatchEvent(new Event('pause'));
        await flushMicrotasks();
        expect(document.title).toBe('Presenter');
    });

    test('a level change swaps the meter instead of appending a second one', async () => {
        const { element, state } = addMedia('audio', { volume: 0.2 });
        element.dispatchEvent(new Event('play'));
        await flushMicrotasks();
        state.volume = 0.9;
        element.dispatchEvent(new Event('volumechange'));
        await flushMicrotasks();
        expect(document.title).toBe('Presenter 🔊');
        expect(titleWrites).toEqual(['Presenter 🔈', 'Presenter 🔊']);
    });

    test('a burst of events is coalesced into one recompute and one write', async () => {
        const { element } = addMedia('video', { volume: 0.5 });
        const querySpy = vi.spyOn(document, 'querySelectorAll');
        element.dispatchEvent(new Event('play'));
        element.dispatchEvent(new Event('playing'));
        element.dispatchEvent(new Event('volumechange'));
        // Nothing is read or written synchronously: it waits for a microtask.
        expect(querySpy).not.toHaveBeenCalled();
        expect(titleWrites).toEqual([]);
        await flushMicrotasks();
        expect(querySpy).toHaveBeenCalledTimes(1);
        expect(querySpy).toHaveBeenCalledWith('audio, video');
        expect(titleWrites).toEqual(['Presenter 🔉']);

        // Once that recompute ran, the next event schedules a fresh one.
        element.dispatchEvent(new Event('emptied'));
        await flushMicrotasks();
        expect(querySpy).toHaveBeenCalledTimes(2);
        // Same level, same title: no second native write.
        expect(titleWrites).toEqual(['Presenter 🔉']);
    });

    test('a meter left by other code is recomputed from the live title', async () => {
        document.title = 'Reader 🔊';
        titleWrites = [];
        const { element } = addMedia('audio', { paused: true });
        element.dispatchEvent(new Event('ended'));
        await flushMicrotasks();
        expect(document.title).toBe('Reader');

        document.title = 'Reader   🔈';
        const audible = addMedia('audio', { volume: 0.6 });
        audible.element.dispatchEvent(new Event('play'));
        await flushMicrotasks();
        expect(document.title).toBe('Reader 🔉');
    });
});
