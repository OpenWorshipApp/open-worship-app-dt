// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    MAX_GLIDE_MS,
    MIN_GLIDE_MS,
    easeOutCubic,
    glideDomIntoView,
    glideScrollTop,
    toGlideDuration,
    toGlideTargetTop,
} from './screenGlideScrollHelpers';
import { getScrollSyncState } from './screenScrollSyncHelpers';

// jsdom lays nothing out: a scroller of a given size, scrolled to a given
// place, holding a row at a given place in its content.
function genScroller({
    viewHeight = 100,
    scrollHeight = 1000,
    scrollTop = 0,
    scale = 1,
}: {
    viewHeight?: number;
    scrollHeight?: number;
    scrollTop?: number;
    scale?: number;
} = {}) {
    const scroller = document.createElement('div');
    scroller.style.overflowY = 'auto';
    Object.defineProperty(scroller, 'clientHeight', { value: viewHeight });
    Object.defineProperty(scroller, 'offsetHeight', { value: viewHeight });
    Object.defineProperty(scroller, 'scrollHeight', { value: scrollHeight });
    let top = scrollTop;
    Object.defineProperty(scroller, 'scrollTop', {
        get: () => top,
        set: (value: number) => {
            top = value;
        },
    });
    scroller.getBoundingClientRect = () => {
        return { top: 50, height: viewHeight * scale } as DOMRect;
    };
    document.body.appendChild(scroller);
    return scroller;
}

function genRow(
    scroller: HTMLElement,
    contentTop: number,
    height: number,
    scale = 1,
) {
    const wrapper = document.createElement('div');
    const row = document.createElement('span');
    wrapper.appendChild(row);
    scroller.appendChild(wrapper);
    row.getBoundingClientRect = () => {
        return {
            top: 50 + (contentTop - scroller.scrollTop) * scale,
            height: height * scale,
        } as DOMRect;
    };
    return row;
}

// Frames run by hand, at the times a test names.
let frames: Map<number, FrameRequestCallback>;
let frameId = 0;
function runFrame(time: number) {
    const pending = [...frames.entries()];
    frames.clear();
    for (const [, callback] of pending) {
        callback(time);
    }
}

beforeEach(() => {
    frames = new Map();
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        frameId += 1;
        frames.set(frameId, callback);
        return frameId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
        frames.delete(id);
    });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
});

describe('a glide on a screen', () => {
    test('leaves fast and arrives slowly', () => {
        expect(easeOutCubic(0)).toBe(0);
        expect(easeOutCubic(1)).toBe(1);
        // A quarter of the time covers well over half of the way...
        expect(easeOutCubic(0.25)).toBeGreaterThan(0.55);
        // ...and the last quarter barely moves.
        expect(1 - easeOutCubic(0.75)).toBeLessThan(0.02);
    });

    test('takes longer the further it goes, in screen heights, within bounds', () => {
        expect(toGlideDuration(10, 100)).toBe(MIN_GLIDE_MS + 30);
        // The same move on a mini screen a third of the size: the same time.
        expect(toGlideDuration(300, 300)).toBe(toGlideDuration(100, 100));
        expect(toGlideDuration(-100, 100)).toBe(toGlideDuration(100, 100));
        expect(toGlideDuration(100_000, 100)).toBe(MAX_GLIDE_MS);
        expect(toGlideDuration(0, 0)).toBe(MIN_GLIDE_MS);
    });

    test('puts a row where scrollIntoView would, a scaled mini screen too', () => {
        const scroller = genScroller({ scrollTop: 200 });
        const row = genRow(scroller, 500, 20);
        expect(toGlideTargetTop(scroller, row, 'start')).toBe(500);
        expect(toGlideTargetTop(scroller, row, 'center')).toBe(460);
        // Below the view: its bottom to the view's bottom.
        expect(toGlideTargetTop(scroller, row, 'nearest')).toBe(420);
        // Above it: its top to the view's top.
        expect(
            toGlideTargetTop(scroller, genRow(scroller, 120, 20), 'nearest'),
        ).toBe(120);
        // In view already: nowhere to go.
        expect(
            toGlideTargetTop(scroller, genRow(scroller, 230, 20), 'nearest'),
        ).toBeNull();
        // Taller than the view: its start.
        expect(
            toGlideTargetTop(scroller, genRow(scroller, 400, 300), 'nearest'),
        ).toBe(400);
        // Never past either end.
        expect(
            toGlideTargetTop(scroller, genRow(scroller, 990, 10), 'start'),
        ).toBe(900);
        expect(
            toGlideTargetTop(scroller, genRow(scroller, 10, 10), 'center'),
        ).toBe(0);

        const mini = genScroller({ scrollTop: 200, scale: 0.25 });
        expect(
            toGlideTargetTop(mini, genRow(mini, 500, 20, 0.25), 'start'),
        ).toBe(500);
    });

    test('moves frame by frame, fast first, and lands exactly', () => {
        const scroller = genScroller();
        glideScrollTop(scroller, 400);
        // Nothing jumps at once.
        expect(scroller.scrollTop).toBe(0);
        const duration = toGlideDuration(400, 100);
        const positions: number[] = [];
        for (const time of [1000, 1100, 1200, 1000 + duration]) {
            runFrame(time);
            positions.push(scroller.scrollTop);
        }
        expect(positions[0]).toBe(0);
        expect(positions[1] - positions[0]).toBeGreaterThan(
            positions[2] - positions[1],
        );
        expect(positions[3]).toBe(400);
        // Done: no frame is left running.
        expect(frames.size).toBe(0);
    });

    test('every frame is the window own scroll, so none goes out as the operator', () => {
        const scroller = genScroller();
        const state = getScrollSyncState(scroller);
        glideScrollTop(scroller, 400);
        expect(state.remoteAt).toBe(1000);
        vi.mocked(performance.now).mockReturnValue(2500);
        runFrame(1300);
        // Marked again on a frame drawn late, past the quiet window.
        expect(state.remoteAt).toBe(2500);
    });

    test('a wheel or a press takes it back at once, and a new glide replaces the old', () => {
        const scroller = genScroller();
        const state = getScrollSyncState(scroller);
        glideScrollTop(scroller, 400);
        runFrame(1100);
        const stoppedAt = scroller.scrollTop;
        state.inputAt = 1050;
        runFrame(1200);
        expect(scroller.scrollTop).toBe(stoppedAt);
        expect(frames.size).toBe(0);

        state.inputAt = Number.NEGATIVE_INFINITY;
        glideScrollTop(scroller, 800);
        glideScrollTop(scroller, 100);
        expect(frames.size).toBe(1);
        runFrame(5000);
        expect(scroller.scrollTop).toBe(100);
    });

    test('is not started for less than a pixel', () => {
        const scroller = genScroller({ scrollTop: 300 });
        glideScrollTop(scroller, 300.4);
        expect(frames.size).toBe(0);
        expect(getScrollSyncState(scroller).remoteAt).toBe(
            Number.NEGATIVE_INFINITY,
        );
    });

    test('scrolls only the screen own view, never a panel around it', () => {
        const outer = genScroller({ scrollTop: 0 });
        const view = document.createElement('div');
        outer.appendChild(view);
        const row = document.createElement('span');
        view.appendChild(row);
        // The view itself cannot scroll: nothing moves, not even the outer.
        glideDomIntoView(row, 'start', view);
        expect(frames.size).toBe(0);
        // A row outside the view is not its to bring.
        glideDomIntoView(document.createElement('span'), 'start', view);
        expect(frames.size).toBe(0);

        const scroller = genScroller({ scrollTop: 0 });
        const inner = genRow(scroller, 500, 20);
        glideDomIntoView(inner, 'center', scroller);
        runFrame(5000);
        expect(scroller.scrollTop).toBe(460);
        // Already in view: nothing to do.
        glideDomIntoView(inner, 'nearest', scroller);
        expect(frames.size).toBe(0);
    });

    test('without animation frames it goes straight there', () => {
        vi.stubGlobal('requestAnimationFrame', undefined);
        const scroller = genScroller();
        glideScrollTop(scroller, 250);
        expect(scroller.scrollTop).toBe(250);
    });
});
