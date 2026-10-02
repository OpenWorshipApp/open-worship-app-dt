// @vitest-environment jsdom

import { describe, expect, test } from 'vitest';

import { applyHorizontalWheelScroll } from './viewExtraHelpers';

// jsdom lays nothing out, so the strip's sizes are set by hand.
function genStrip({
    scrollWidth,
    clientWidth,
}: {
    scrollWidth: number;
    clientWidth: number;
}) {
    const strip = document.createElement('div');
    Object.defineProperty(strip, 'scrollWidth', { value: scrollWidth });
    Object.defineProperty(strip, 'clientWidth', { value: clientWidth });
    document.body.appendChild(strip);
    return strip;
}

function wheel(
    strip: HTMLElement,
    init: { deltaX?: number; deltaY?: number; deltaMode?: number },
) {
    const event = new WheelEvent('wheel', { cancelable: true, ...init });
    strip.dispatchEvent(event);
    return event;
}

// A pane header's hover actions in a narrow pane: the wheel was the only
// pointer way to reach the buttons past the edge, and it did nothing.
describe('applyHorizontalWheelScroll', () => {
    test('a strip that overflows scrolls sideways under the wheel', () => {
        const strip = genStrip({ scrollWidth: 221, clientWidth: 150 });
        const cleanup = applyHorizontalWheelScroll(strip)!;

        const event = wheel(strip, { deltaY: 40 });

        expect(strip.scrollLeft).toBe(40);
        expect(event.defaultPrevented).toBe(true);
        cleanup();
        strip.remove();
    });

    test('a device reporting lines scrolls by a line height each', () => {
        const strip = genStrip({ scrollWidth: 221, clientWidth: 150 });
        const cleanup = applyHorizontalWheelScroll(strip)!;

        wheel(strip, { deltaY: 2, deltaMode: WheelEvent.DOM_DELTA_LINE });

        expect(strip.scrollLeft).toBe(32);
        cleanup();
        strip.remove();
    });

    test('a strip that fits leaves the wheel alone', () => {
        const strip = genStrip({ scrollWidth: 150, clientWidth: 150 });
        const cleanup = applyHorizontalWheelScroll(strip)!;

        const event = wheel(strip, { deltaY: 40 });

        expect(strip.scrollLeft).toBe(0);
        expect(event.defaultPrevented).toBe(false);
        cleanup();
        strip.remove();
    });

    test('a sideways gesture is left to the browser', () => {
        const strip = genStrip({ scrollWidth: 221, clientWidth: 150 });
        const cleanup = applyHorizontalWheelScroll(strip)!;

        const event = wheel(strip, { deltaX: 30, deltaY: 5 });

        expect(event.defaultPrevented).toBe(false);
        cleanup();
        strip.remove();
    });

    test('the cleanup unbinds it', () => {
        const strip = genStrip({ scrollWidth: 221, clientWidth: 150 });
        const cleanup = applyHorizontalWheelScroll(strip)!;
        cleanup();

        const event = wheel(strip, { deltaY: 40 });

        expect(strip.scrollLeft).toBe(0);
        expect(event.defaultPrevented).toBe(false);
        strip.remove();
    });
});
