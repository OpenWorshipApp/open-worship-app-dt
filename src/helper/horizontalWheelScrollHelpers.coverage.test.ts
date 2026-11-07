// @vitest-environment jsdom

import { afterEach, describe, expect, test } from 'vitest';

import { applyHorizontalWheelScroll } from './horizontalWheelScrollHelpers';

function genOverflowingStrip() {
    const strip = document.createElement('div');
    Object.defineProperty(strip, 'scrollWidth', { value: 300 });
    Object.defineProperty(strip, 'clientWidth', { value: 100 });
    strip.scrollLeft = 120;
    document.body.appendChild(strip);
    return strip;
}

function wheel(target: HTMLElement, init: WheelEventInit) {
    const event = new WheelEvent('wheel', { cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
}

afterEach(() => {
    document.body.innerHTML = '';
});

describe('applyHorizontalWheelScroll edges', () => {
    test('a ref that is not attached yet binds nothing', () => {
        expect(applyHorizontalWheelScroll(null)).toBeUndefined();
    });

    test('a wheel up scrolls the strip back towards its start', () => {
        const strip = genOverflowingStrip();
        const cleanup = applyHorizontalWheelScroll(strip)!;
        wheel(strip, { deltaY: -50 });
        expect(strip.scrollLeft).toBe(70);
        cleanup();
    });

    test('a diagonal gesture as wide as it is tall counts as sideways', () => {
        const strip = genOverflowingStrip();
        const cleanup = applyHorizontalWheelScroll(strip)!;
        const event = wheel(strip, { deltaX: 20, deltaY: -20 });
        expect(event.defaultPrevented).toBe(false);
        expect(strip.scrollLeft).toBe(120);
        cleanup();
    });
});
