// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    BibleGroupScrollSync,
    locatePosition,
    readPosition,
} from './bibleGroupScrollHelpers';

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

function settle() {
    for (let count = 0; frames.size; count++) {
        if (count > 200) {
            throw new Error('the follow loop never came to rest');
        }
        const callbacks = [...frames.values()];
        frames.clear();
        callbacks.forEach((callback) => callback(0));
    }
}

type BoxType = { top: number; height: number };

/**
 * A pane 200px tall and 300px wide over 1000px of content: a 50px heading,
 * then one verse per 100px line. `boxesOf(i)` overrides a verse's line boxes
 * (none at all: it is not laid out).
 */
function pane(boxesOf: (index: number) => BoxType[] | null = () => null) {
    const container = document.createElement('div');
    document.body.append(container);
    let scrollTop = 0;
    const log: number[] = [];
    writes.set(container, log);
    Object.defineProperties(container, {
        clientHeight: { value: 200, configurable: true },
        clientWidth: { value: 300 },
        scrollHeight: { value: 1050 },
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
        ({ top: 0, bottom: 200, left: 0, height: 200, width: 300 }) as DOMRect;
    for (let i = 0; i < 10; i++) {
        const verse = document.createElement('div');
        verse.className = 'verse-text';
        verse.dataset.kjvVerseKey = `GEN 1:${i + 1}`;
        verse.getClientRects = () => {
            const boxes = boxesOf(i) ?? [
                { top: 50 + i * 100 - scrollTop, height: 100 },
            ];
            return boxes.map(({ top, height }) => ({
                top,
                height,
                bottom: top + height,
                left: 0,
                right: 300,
                width: 300,
            })) as unknown as DOMRectList;
        };
        container.append(verse);
    }
    return container;
}

describe('the space above the first verse', () => {
    test('reads as a share of the way to the first verse, and back', () => {
        const container = pane();
        const position = readPosition(container, 25);
        expect(position).toEqual({
            key: 'GEN 1:1',
            part: 'before',
            fraction: 0.5,
        });
        expect(locatePosition(container, position!)).toBe(25);
    });
});

describe('verses with no box to measure', () => {
    test('a first verse not laid out reads no position', () => {
        const container = pane((index) => (index === 0 ? [] : null));
        expect(readPosition(container, 20)).toBeNull();
    });

    test('a last verse whose last line has no box reads no position', () => {
        // Its first line is there, its end is not.
        const container = pane((index) => {
            return index === 9
                ? [
                      { top: 950, height: 100 },
                      { top: 1050, height: 0 },
                  ]
                : null;
        });
        expect(readPosition(container, 1000)).toBeNull();
    });

    test('a passage without the verse cannot place it', () => {
        const container = pane();
        expect(
            locatePosition(container, {
                key: 'EXO 1:1',
                part: 'verse',
                fraction: 0.5,
            }),
        ).toBeNull();
    });
});

describe('a leader with nothing to read', () => {
    test('moves no follower', () => {
        const sync = new BibleGroupScrollSync();
        const leader = pane(() => []);
        const follower = pane();
        cleanups.push(sync.register(leader, 'pink'));
        cleanups.push(sync.register(follower, 'pink'));
        leader.dispatchEvent(new Event('wheel'));
        leader.scrollTop = 250;
        settle();
        expect(writes.get(follower)).toEqual([]);
    });
});
