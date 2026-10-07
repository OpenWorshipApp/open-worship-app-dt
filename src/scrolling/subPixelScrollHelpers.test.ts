// @vitest-environment jsdom

import { afterEach, expect, test, vi } from 'vitest';

import {
    PLAY_TO_BOTTOM_CLASSNAME,
    PLAY_TO_BOTTOM_MENU_CLASSNAME,
    TO_THE_TOP_CLASSNAME,
    checkIsSubPixelScrolling,
    getSubPixelScrollTop,
    releaseSubPixelScroll,
    writeSubPixelScrollTop,
} from './subPixelScrollHelpers';

afterEach(() => {
    vi.unstubAllGlobals();
});

function setUp() {
    const scroller = document.createElement('div');
    let scrollTop = 0;
    const writes: number[] = [];
    Object.defineProperty(scroller, 'scrollTop', {
        configurable: true,
        get: () => scrollTop,
        set: (value: number) => {
            writes.push(value);
            scrollTop = value;
        },
    });
    const text = document.createElement('div');
    const pinned = [
        TO_THE_TOP_CLASSNAME,
        PLAY_TO_BOTTOM_CLASSNAME,
        PLAY_TO_BOTTOM_MENU_CLASSNAME,
    ].map((className) => {
        const element = document.createElement('i');
        element.className = className;
        return element;
    });
    const style = document.createElement('style');
    scroller.append(text, style, ...pinned);
    return { scroller, text, pinned, style, writes };
}

test('whole device pixels scroll; the rest slides the content', () => {
    vi.stubGlobal('devicePixelRatio', 1.25);
    const { scroller, text, pinned, style, writes } = setUp();
    writeSubPixelScrollTop(scroller, 10.5); // 13.125 device pixels
    expect(scroller.scrollTop).toBeCloseTo(10.4, 6);
    expect(text.style.translate).toBe('0 -0.100px');
    expect(text.style.willChange).toBe('transform');
    expect(getSubPixelScrollTop(scroller)).toBeCloseTo(10.5, 6);
    expect(checkIsSubPixelScrolling(scroller)).toBe(true);
    // The controls pinned over the text stay where they are.
    for (const element of [...pinned, style]) {
        expect(element.style.translate).toBe('');
        expect(element.style.willChange).toBe('');
    }
    // Within the same device pixel only the slide changes.
    writeSubPixelScrollTop(scroller, 10.7);
    expect(writes).toHaveLength(1);
    expect(text.style.translate).toBe('0 -0.300px');
    writeSubPixelScrollTop(scroller, 11.25);
    expect(writes).toHaveLength(2);
    expect(scroller.scrollTop).toBeCloseTo(11.2, 6);
});

test('a child swapped in by a re-render slides too', () => {
    const { scroller, text } = setUp();
    writeSubPixelScrollTop(scroller, 3.5);
    const replacement = document.createElement('div');
    text.replaceWith(replacement);
    writeSubPixelScrollTop(scroller, 3.75);
    expect(replacement.style.translate).toBe('0 -0.750px');
    releaseSubPixelScroll(scroller);
    expect(replacement.style.translate).toBe('');
    expect(replacement.style.willChange).toBe('');
});

test('letting go leaves a plain offset on the nearest pixel and no layer', () => {
    const { scroller, text } = setUp();
    expect(releaseSubPixelScroll(scroller)).toBe(false);
    writeSubPixelScrollTop(scroller, 20.75);
    expect(releaseSubPixelScroll(scroller)).toBe(true);
    expect(scroller.scrollTop).toBe(21);
    expect(text.style.translate).toBe('');
    expect(text.style.willChange).toBe('');
    expect(checkIsSubPixelScrolling(scroller)).toBe(false);
    expect(getSubPixelScrollTop(scroller)).toBe(21);
    writeSubPixelScrollTop(scroller, 30.25);
    releaseSubPixelScroll(scroller);
    expect(scroller.scrollTop).toBe(30);
});
