// @vitest-environment jsdom

import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
    BibleGroupScrollSync,
    locatePosition,
    readPosition,
} from './bibleGroupScrollHelpers';
import {
    checkIsSubPixelScrolling,
    getSubPixelScrollTop,
    releaseSubPixelScroll,
    writeSubPixelScrollTop,
} from '../scrolling/subPixelScrollHelpers';

let frames: Map<number, FrameRequestCallback>;
let nextFrame = 0;
const cleanups: (() => void)[] = [];
const writes = new Map<HTMLElement, number[]>();

beforeEach(() => {
    frames = new Map();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        frames.set(++nextFrame, callback);
        return nextFrame;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});

afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    writes.clear();
    document.body.replaceChildren();
    vi.unstubAllGlobals();
});

function frame() {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(0));
}

/** Runs frames until nothing asks for another; returns how many ran. */
function settle() {
    let count = 0;
    while (frames.size) {
        if (++count > 200) {
            throw new Error('the follow loop never came to rest');
        }
        frame();
    }
    return count;
}

function rects(...list: Partial<DOMRect>[]) {
    return list.map((rect) => ({
        ...rect,
        bottom: rect.top! + rect.height!,
        width: rect.right! - rect.left!,
    })) as unknown as DOMRectList;
}

/** Ten verses, each one full line of `verseHeight`, then `padding` below. */
function pane(height = 200, verseHeight = 100, top = 0, padding = 0) {
    const container = document.createElement('div');
    document.body.append(container);
    let scrollTop = 0;
    const log: number[] = [];
    writes.set(container, log);
    Object.defineProperties(container, {
        clientHeight: { value: height, configurable: true },
        clientWidth: { value: 300 },
        scrollHeight: { value: verseHeight * 10 + padding },
        scrollTop: {
            get: () => scrollTop,
            set: (value: number) => {
                scrollTop = value;
                log.push(value);
                container.dispatchEvent(new Event('scroll'));
            },
        },
    });
    container.getBoundingClientRect = () =>
        ({ top, bottom: top + height, left: 0, height, width: 300 }) as DOMRect;
    for (let i = 0; i < 10; i++) {
        const verse = document.createElement('div');
        verse.className = 'verse-text';
        verse.dataset.kjvVerseKey = `GEN 1:${i + 1}`;
        verse.getClientRects = () =>
            rects({
                // The slide moves the verses as a real layout would.
                top: top + i * verseHeight - getSubPixelScrollTop(container),
                height: verseHeight,
                left: 0,
                right: 300,
            });
        container.append(verse);
    }
    return container;
}

function join(
    sync: BibleGroupScrollSync,
    element: HTMLElement,
    group = 'pink',
) {
    cleanups.push(sync.register(element, group));
}

function wheel(element: HTMLElement, top: number) {
    element.dispatchEvent(new Event('wheel'));
    element.scrollTop = top;
}

test('follows the same reading point across unequal translations and sizes', () => {
    const sync = new BibleGroupScrollSync();
    const source = pane();
    const target = pane(300, 180, 600);
    join(sync, source);
    join(sync, target);
    // 31% down the content: a reference line 31% down the pane, 1/8 into
    // verse 4. The same point of verse 4 sits 31% down the follower.
    wheel(source, 250);
    expect(readPosition(source, 62.5)).toEqual({
        key: 'GEN 1:4',
        part: 'verse',
        fraction: 0.125,
    });
    settle();
    expect(target.scrollTop).toBeCloseTo(468.75);
    expect(source.scrollTop).toBe(250);
});

test('moves with the leader every frame inside one verse, not verse by verse', () => {
    const sync = new BibleGroupScrollSync();
    const source = pane();
    const target = pane(300, 180, 600);
    join(sync, source);
    join(sync, target);
    wheel(source, 250);
    settle();
    wheel(source, 260); // still verse 4
    frame();
    expect(target.scrollTop).toBeCloseTo(487.5); // in that same frame
    expect(frames.size).toBe(0); // the follower's scroll cannot echo
});

test('reaches the top and the bottom together with the leader', () => {
    const sync = new BibleGroupScrollSync();
    const source = pane(200, 100, 0, 60); // room below the last verse
    const target = pane(300, 180);
    join(sync, source);
    join(sync, target);
    wheel(source, 860);
    settle();
    expect(target.scrollTop).toBeCloseTo(1500);
    wheel(source, 0);
    settle();
    expect(target.scrollTop).toBeCloseTo(0);
});

test('enabling sync eases followers to the clicked pane without another scroll', () => {
    const sync = new BibleGroupScrollSync();
    const first = pane();
    const second = pane(300, 180);
    first.scrollTop = 50;
    second.scrollTop = 840; // 3/5 into verse 6 in the pane whose toggle was pressed
    // The click schedules alignment, then React registers the enabled panes
    // during the layout commit before that frame runs.
    sync.syncFrom(second);
    join(sync, first);
    join(sync, second);
    frame();
    // A glide, not a jump: part of the way on the first frame.
    expect(first.scrollTop).toBeGreaterThan(50);
    expect(first.scrollTop).toBeLessThan(250);
    expect(settle()).toBeLessThan(60); // it comes to rest by itself
    expect(first.scrollTop).toBeCloseTo(448);
    expect(second.scrollTop).toBe(840);
});

test('verses sharing a line keep a strictly increasing reading order', () => {
    for (const isRtl of [false, true]) {
        const container = document.createElement('div');
        const text = document.createElement('div');
        if (isRtl) {
            text.dir = 'rtl';
        }
        container.append(text);
        Object.defineProperties(container, {
            clientWidth: { value: 300 },
            scrollHeight: { value: 120 },
        });
        container.getBoundingClientRect = () =>
            ({ top: 0, left: 0, height: 120, width: 300 }) as DOMRect;
        // Two half-line verses on the first line, then a full line.
        const lines = [
            { top: 0, height: 40, left: 0, right: 150 },
            { top: 0, height: 40, left: 150, right: 300 },
            { top: 40, height: 40, left: 0, right: 300 },
        ];
        if (isRtl) {
            [lines[0], lines[1]] = [lines[1], lines[0]];
        }
        lines.forEach((line, i) => {
            const verse = document.createElement('span');
            verse.className = 'verse-text';
            verse.dataset.kjvVerseKey = `GEN 1:${i + 1}`;
            verse.getClientRects = () => rects(line);
            text.append(verse);
        });
        const read = (y: number) => readPosition(container, y);
        expect(read(10)).toEqual({
            key: 'GEN 1:1',
            part: 'verse',
            fraction: 0.5,
        });
        expect(read(30)).toEqual({
            key: 'GEN 1:2',
            part: 'verse',
            fraction: 0.5,
        });
        expect(read(50)).toEqual({
            key: 'GEN 1:3',
            part: 'verse',
            fraction: 0.25,
        });
        expect(read(100)).toEqual({
            key: 'GEN 1:3',
            part: 'after',
            fraction: 0.5,
        });
        expect(
            locatePosition(container, {
                key: 'GEN 1:2',
                part: 'verse',
                fraction: 0.5,
            }),
        ).toBe(30);
    }
});

test('wheel input on a follower takes over, including before a queued frame', () => {
    const sync = new BibleGroupScrollSync();
    const first = pane();
    const second = pane(200, 200);
    join(sync, first);
    join(sync, second);
    wheel(first, 250);
    wheel(second, 1000); // replacing the pending first-pane input
    settle();
    expect(first.scrollTop).toBeCloseTo(444.44);
    expect(second.scrollTop).toBe(1000);
    wheel(first, 50); // scroll back up
    settle();
    expect(second.scrollTop).toBeCloseTo(112.5);
    expect(first.scrollTop).toBe(50);
});

test('coalesces scroll events into one write per follower per frame', () => {
    const sync = new BibleGroupScrollSync();
    const first = pane();
    const second = pane();
    join(sync, first);
    join(sync, second);
    wheel(first, 240);
    settle();
    const log = writes.get(second)!;
    log.length = 0;
    wheel(first, 250);
    wheel(first, 260);
    wheel(first, 270);
    expect(frames.size).toBe(1);
    frame();
    expect(log).toHaveLength(1);
    expect(log[0]).toBeCloseTo(270);
    expect(frames.size).toBe(0); // nothing left to do: at rest
});

test('a follower moved by something else glides back instead of jumping', () => {
    const sync = new BibleGroupScrollSync();
    const source = pane();
    const target = pane();
    join(sync, source);
    join(sync, target);
    wheel(source, 250);
    settle();
    expect(target.scrollTop).toBeCloseTo(250);
    target.scrollTop = 0; // e.g. a verse brought into view
    wheel(source, 260);
    frame();
    expect(target.scrollTop).toBeGreaterThan(0);
    expect(target.scrollTop).toBeLessThan(130);
    settle();
    expect(target.scrollTop).toBeCloseTo(260);
});

test('disabling a follower mid-glide leaves it where it is', () => {
    const sync = new BibleGroupScrollSync();
    const source = pane();
    const target = pane();
    join(sync, source);
    const unregister = sync.register(target, 'pink');
    wheel(source, 450);
    frame();
    const at = target.scrollTop;
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(450);
    unregister();
    wheel(source, 500);
    settle();
    expect(target.scrollTop).toBe(at);
});

test('leaves other groups, hidden panes, a missing verse and a playing pane alone', () => {
    const sync = new BibleGroupScrollSync();
    const source = pane();
    const unrelated = pane();
    const hidden = pane(0);
    const missing = pane();
    missing.querySelector('[data-kjv-verse-key="GEN 1:4"]')!.remove();
    const playing = pane();
    const play = document.createElement('i');
    play.className = 'play-to-bottom';
    play.dataset.speed = '0.2';
    playing.append(play);
    join(sync, source);
    join(sync, unrelated, 'blue');
    join(sync, hidden);
    join(sync, missing);
    join(sync, playing);
    wheel(source, 250);
    settle();
    for (const target of [unrelated, hidden, missing, playing]) {
        expect(writes.get(target)).toEqual([]);
    }
});

test.each(['pointerdown', 'touchstart', 'keydown'])(
    '%s chooses the pane; programmatic scrolling alone does not',
    (input) => {
        const sync = new BibleGroupScrollSync();
        const source = pane();
        const target = pane();
        join(sync, source);
        join(sync, target);
        source.scrollTop = 250;
        settle();
        expect(writes.get(target)).toEqual([]);
        source.dispatchEvent(
            input === 'keydown'
                ? new KeyboardEvent(input, { key: 'PageDown' })
                : new Event(input),
        );
        source.scrollTop = 250;
        settle();
        expect(target.scrollTop).toBeCloseTo(250);
    },
);

test('unregistering cancels pending work and releases the pane listeners', () => {
    const sync = new BibleGroupScrollSync();
    const source = pane();
    const target = pane();
    const unregister = sync.register(source, 'pink');
    join(sync, target);
    wheel(source, 250);
    unregister();
    expect(frames.size).toBe(0);
    wheel(source, 450);
    settle();
    expect(writes.get(target)).toEqual([]);
});

test('text editing and non-scrolling keys do not make a pane the source', () => {
    const sync = new BibleGroupScrollSync();
    const source = pane();
    const target = pane();
    const input = document.createElement('input');
    source.append(input);
    join(sync, source);
    join(sync, target);
    input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    source.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    source.scrollTop = 250;
    settle();
    expect(writes.get(target)).toEqual([]);
});

test('followers glide by fractions of a pixel with an auto-scrolling leader', () => {
    const sync = new BibleGroupScrollSync();
    const source = pane();
    const target = pane();
    join(sync, source);
    join(sync, target);
    source.dispatchEvent(new Event('pointerdown')); // the play button's press
    writeSubPixelScrollTop(source, 250.5);
    settle();
    expect(checkIsSubPixelScrolling(target)).toBe(true);
    expect(getSubPixelScrollTop(target)).toBeCloseTo(250.5, 6);
    expect(target.scrollTop).toBe(250);
    // Inside one pixel there is no scroll event: the leader says when.
    writeSubPixelScrollTop(source, 250.75);
    expect(frames.size).toBe(0);
    sync.followFrame(target); // not the leader: nothing
    expect(frames.size).toBe(0);
    sync.followFrame(source);
    settle();
    expect(getSubPixelScrollTop(target)).toBeCloseTo(250.75, 6);
    // It stops: the leader lets go, and so does every follower.
    releaseSubPixelScroll(source);
    sync.followFrame(source);
    settle();
    expect(checkIsSubPixelScrolling(target)).toBe(false);
    expect(target.scrollTop).toBeCloseTo(251, 6);
});

test('a follower leaving the group drops its slide', () => {
    const sync = new BibleGroupScrollSync();
    const source = pane();
    const target = pane();
    join(sync, source);
    const unregister = sync.register(target, 'pink');
    source.dispatchEvent(new Event('pointerdown'));
    writeSubPixelScrollTop(source, 250.5);
    sync.followFrame(source);
    settle();
    expect(checkIsSubPixelScrolling(target)).toBe(true);
    unregister();
    expect(checkIsSubPixelScrolling(target)).toBe(false);
});
