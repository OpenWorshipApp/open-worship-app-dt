// @vitest-environment jsdom

import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
    SCREEN_BIBLE_COLUMNS_CLASSNAME,
    SCREEN_BIBLE_COLUMN_CLASSNAME,
    SCREEN_BIBLE_SCROLL_CLASSNAME,
    alignScreenBibleColumns,
    followScreenBibleHost,
    getScreenBibleColumns,
    getScreenBibleScrollTop,
    getScreenBibleScroller,
    steerScreenBibleAutoScroll,
    toScreenBibleColumnClassName,
    toScreenBibleScrollSelector,
    wireScreenBibleColumns,
} from './screenBibleColumnHelpers';
import { applyRemoteScrollPercentage } from './managers/screenScrollSyncHelpers';
import {
    checkIsSubPixelScrolling,
    getSubPixelScrollTop,
    writeSubPixelScrollTop,
} from '../scrolling/subPixelScrollHelpers';

let frames: Map<number, FrameRequestCallback>;
let nextFrame = 0;
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
    writes.clear();
    document.body.replaceChildren();
    vi.unstubAllGlobals();
});

/** Runs frames until nothing asks for another. */
function settle() {
    let count = 0;
    while (frames.size) {
        if (++count > 200) {
            throw new Error('the follow loop never came to rest');
        }
        const callbacks = [...frames.values()];
        frames.clear();
        callbacks.forEach((callback) => callback(0));
    }
}

function rects(...list: Partial<DOMRect>[]) {
    return list.map((rect) => ({
        ...rect,
        bottom: rect.top! + rect.height!,
        width: rect.right! - rect.left!,
    })) as unknown as DOMRectList;
}

/** One Bible's column: ten verses, each a full line of `verseHeight`. */
function column(index: number, verseHeight: number, height = 200) {
    const element = document.createElement('div');
    element.className =
        `${SCREEN_BIBLE_COLUMN_CLASSNAME} ` +
        toScreenBibleColumnClassName(index);
    element.dataset.columnIndex = `${index}`;
    let scrollTop = 0;
    const log: number[] = [];
    writes.set(element, log);
    Object.defineProperties(element, {
        clientHeight: { value: height },
        clientWidth: { value: 300 },
        scrollWidth: { value: 300 },
        scrollHeight: { value: verseHeight * 10 },
        scrollTop: {
            get: () => scrollTop,
            set: (value: number) => {
                scrollTop = value;
                log.push(value);
                element.dispatchEvent(new Event('scroll'));
            },
        },
    });
    element.scrollTo = ((options: ScrollToOptions) => {
        element.scrollTop = options.top ?? 0;
    }) as typeof element.scrollTo;
    element.getBoundingClientRect = () =>
        ({ top: 0, bottom: height, left: 0, height, width: 300 }) as DOMRect;
    const text = document.createElement('div');
    element.append(text);
    for (let i = 0; i < 10; i++) {
        const verse = document.createElement('span');
        verse.className = 'highlight';
        verse.dataset.kjvVerseKey = `GEN 1:${i + 1}`;
        verse.getClientRects = () =>
            rects({
                top: i * verseHeight - getSubPixelScrollTop(element),
                height: verseHeight,
                left: 0,
                right: 300,
            });
        text.append(verse);
    }
    return element;
}

/** The screen's Bible div, holding a short and a long translation. */
function screen(verseHeights = [100, 180]) {
    const div = document.createElement('div');
    div.classList.add(SCREEN_BIBLE_SCROLL_CLASSNAME);
    const root = document.createElement('div');
    root.className = SCREEN_BIBLE_COLUMNS_CLASSNAME;
    root.append(document.createElement('style'));
    const columns = verseHeights.map((verseHeight, i) => {
        return column(i, verseHeight);
    });
    root.append(...columns);
    div.append(root);
    document.body.append(div);
    return { div, root, columns };
}

function wheel(element: HTMLElement, top: number) {
    element.dispatchEvent(new Event('wheel'));
    element.scrollTop = top;
}

test('finds the columns of rendered markup, and none in one table', () => {
    const { root, columns } = screen();
    expect(getScreenBibleColumns(root)).toEqual(columns);
    const table = document.createElement('div');
    table.append(document.createElement('table'));
    expect(getScreenBibleColumns(table)).toEqual([]);
});

test('a scroller is named by its place in the row, the one box by its own name', () => {
    const { div, columns } = screen();
    expect(toScreenBibleScrollSelector(div)).toBe(
        '.screen-bible-container-scroll',
    );
    expect(toScreenBibleScrollSelector(columns[1])).toBe(
        '.screen-bible-column-1',
    );
});

test('the longest column hosts the screen: its position, its buttons', () => {
    const { div, columns } = screen();
    const send = vi.fn();
    expect(getScreenBibleScroller(div)).toBe(div);
    const scroller = wireScreenBibleColumns(div, columns, send);
    expect(scroller).toBe(columns[1]);
    expect(getScreenBibleScroller(div)).toBe(columns[1]);
    // Drawn over the columns after it in the DOM, so its buttons can be hit.
    expect(columns[1].style.zIndex).toBe('1');
    expect(columns[0].style.zIndex).toBe('');
});

test('scrolling one column brings the others to the same verse, and only the leader is sent', () => {
    const { div, columns } = screen();
    const send = vi.fn();
    wireScreenBibleColumns(div, columns, send);
    // 250px into the short one: 1/8 into verse 4, on a line 31% down.
    wheel(columns[0], 250);
    settle();
    expect(columns[1].scrollTop).toBeCloseTo(500);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
        '.screen-bible-column-0',
        { x: Number.NaN, y: 250 / 800 },
        true,
    );
    // And the other way round, from the long one.
    send.mockClear();
    wheel(columns[1], 1600);
    settle();
    expect(columns[0].scrollTop).toBeCloseTo(800);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBe('.screen-bible-column-1');
});

test('a scroll another window sent leads here too, and is not sent back', () => {
    const { div, columns } = screen();
    const send = vi.fn();
    wireScreenBibleColumns(div, columns, send);
    applyRemoteScrollPercentage(columns[0], { x: 0, y: 250 / 800 });
    settle();
    expect(columns[0].scrollTop).toBe(250);
    expect(columns[1].scrollTop).toBeCloseTo(500);
    expect(send).not.toHaveBeenCalled();
    // Frame after frame of it, the follower keeps up instead of trailing.
    applyRemoteScrollPercentage(columns[0], { x: 0, y: 260 / 800 });
    const [frame] = [...frames.values()];
    frames.clear();
    frame(0);
    expect(columns[1].scrollTop).toBeCloseTo(520);
    expect(send).not.toHaveBeenCalled();
});

test('a mini preview auto-scroll frame slides every column by the fraction', () => {
    const { div, columns } = screen();
    wireScreenBibleColumns(div, columns, vi.fn());
    applyRemoteScrollPercentage(columns[1], { x: 0, y: 400.5 / 1600 }, true);
    settle();
    expect(checkIsSubPixelScrolling(columns[1])).toBe(true);
    expect(checkIsSubPixelScrolling(columns[0])).toBe(true);
    // The last frame lets go, here as well.
    applyRemoteScrollPercentage(columns[1], { x: 0, y: 401 / 1600 });
    settle();
    expect(checkIsSubPixelScrolling(columns[0])).toBe(false);
});

test('fresh columns are put where the host is at once', () => {
    const { div, columns } = screen();
    const send = vi.fn();
    const host = wireScreenBibleColumns(div, columns, send);
    // Half way down the long one: the very start of verse 6.
    host.scrollTop = 800;
    alignScreenBibleColumns(div);
    // No frame has run: there was nothing to glide out of.
    expect(columns[0].scrollTop).toBeCloseTo(400);
    // The host leads from then on, so a scroll nobody's hand made moves all.
    host.scrollTop = 1600;
    settle();
    expect(columns[0].scrollTop).toBeCloseTo(800);
});

test('the auto-scrolling host takes the lead back on every frame', () => {
    const { div, columns } = screen();
    const host = wireScreenBibleColumns(div, columns, vi.fn());
    // A hand on the other column made it the leader.
    wheel(columns[0], 400);
    settle();
    expect(columns[1].scrollTop).toBeCloseTo(800);
    host.scrollTop = 1600;
    followScreenBibleHost(div);
    settle();
    expect(columns[0].scrollTop).toBeCloseTo(800);
});

test('each layout answers to the names the other one sends', () => {
    const { div, columns } = screen();
    const send = vi.fn();
    // Columns: the host answers for the one box, which itself scrolls nothing.
    const host = wireScreenBibleColumns(div, columns, send);
    expect(div.classList.contains(SCREEN_BIBLE_SCROLL_CLASSNAME)).toBe(false);
    expect(host.classList.contains(SCREEN_BIBLE_SCROLL_CLASSNAME)).toBe(true);
    expect(columns[0].classList.contains(SCREEN_BIBLE_SCROLL_CLASSNAME)).toBe(
        false,
    );
    expect(div.querySelectorAll('.screen-bible-container-scroll')).toHaveLength(
        1,
    );
    // One box (Line Sync) over the same two Bibles: it answers for each column.
    wireScreenBibleColumns(div, [], send, 2);
    expect([...div.classList]).toEqual([
        SCREEN_BIBLE_SCROLL_CLASSNAME,
        'screen-bible-column-0',
        'screen-bible-column-1',
    ]);
    // A single Bible is one box in every window: no column is ever named.
    wireScreenBibleColumns(div, [], send, 1);
    expect([...div.classList]).toEqual([SCREEN_BIBLE_SCROLL_CLASSNAME]);
    // Back to columns: the box gives every name up again.
    wireScreenBibleColumns(div, [], send, 3);
    wireScreenBibleColumns(div, columns, send, 2);
    expect([...div.classList]).toEqual([]);
});

test('taking the columns away lets go of them', () => {
    const { div, columns } = screen();
    const send = vi.fn();
    wireScreenBibleColumns(div, columns, send);
    expect(wireScreenBibleColumns(div, [], send)).toBe(div);
    expect(getScreenBibleScroller(div)).toBe(div);
    wheel(columns[0], 250);
    settle();
    expect(writes.get(columns[1])).toEqual([]);
    expect(send).not.toHaveBeenCalled();
});

test('the screen is as far down as its furthest column', () => {
    const { div, columns } = screen();
    Object.defineProperty(div, 'scrollTop', { value: 7, configurable: true });
    expect(getScreenBibleScrollTop(div)).toBe(7);
    wireScreenBibleColumns(div, columns, vi.fn());
    columns[0].scrollTop = 40;
    columns[1].scrollTop = 90;
    expect(getScreenBibleScrollTop(div)).toBe(90);
});

test('a wheel on another column steers the host while it slides by itself', () => {
    const { div, columns } = screen();
    const host = wireScreenBibleColumns(div, columns, vi.fn());
    const other = columns[0];
    const turn = (target: HTMLElement, init: WheelEventInit = {}) => {
        const event = new WheelEvent('wheel', {
            bubbles: true,
            cancelable: true,
            deltaY: 120,
            ...init,
        });
        div.addEventListener(
            'wheel',
            (wheelEvent) => {
                steerScreenBibleAutoScroll(div, wheelEvent);
            },
            { once: true },
        );
        target.dispatchEvent(event);
        return event;
    };
    // Standing still, a wheel is the column's own.
    expect(turn(other).defaultPrevented).toBe(false);
    expect(host.scrollTop).toBe(0);

    writeSubPixelScrollTop(host, 300.5);
    // Over the host itself: the browser scrolls it, as it always did.
    expect(turn(host).defaultPrevented).toBe(false);
    expect(host.scrollTop).toBe(300);
    // Lines, not pixels: left alone.
    expect(turn(other, { deltaMode: 1 }).defaultPrevented).toBe(false);
    // Over the other column: the host takes it.
    expect(turn(other).defaultPrevented).toBe(true);
    expect(host.scrollTop).toBe(420);
    expect(turn(other, { deltaY: -20 }).defaultPrevented).toBe(true);
    expect(host.scrollTop).toBe(400);
});

test('a screen with no columns steers nothing', () => {
    const { div } = screen();
    const event = new WheelEvent('wheel', { cancelable: true, deltaY: 120 });
    steerScreenBibleAutoScroll(div, event);
    expect(event.defaultPrevented).toBe(false);
    // And has nothing to align or follow.
    alignScreenBibleColumns(div);
    followScreenBibleHost(div);
    expect(frames.size).toBe(0);
});
