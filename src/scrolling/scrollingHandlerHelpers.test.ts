// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import {
    applyPlayToBottom,
    applyToTheTop,
    PLAY_TO_BOTTOM_CLASSNAME,
    TO_THE_TOP_CLASSNAME,
    TO_THE_TOP_STYLE_STRING,
} from './scrollingHandlerHelpers';
import {
    checkIsSubPixelScrolling,
    getSubPixelScrollTop,
} from './subPixelScrollHelpers';

type ResizeObserverEntryType = {
    callback: ResizeObserverCallback;
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
};

const resizeObserverEntries: ResizeObserverEntryType[] = [];
const rafCallbacks: FrameRequestCallback[] = [];
// One clock for frames and `performance.now()`, so timing is deterministic.
let frameClock = 0;

function defineScrollMetrics(
    element: HTMLElement,
    {
        clientHeight,
        scrollHeight,
        scrollTop,
    }: { clientHeight: number; scrollHeight: number; scrollTop: number },
) {
    let currentScrollTop = scrollTop;

    Object.defineProperty(element, 'clientHeight', {
        configurable: true,
        value: clientHeight,
    });
    Object.defineProperty(element, 'scrollHeight', {
        configurable: true,
        value: scrollHeight,
    });
    Object.defineProperty(element, 'scrollTop', {
        configurable: true,
        get: () => currentScrollTop,
        set: (value: number) => {
            currentScrollTop = value;
        },
    });
}

function runNextAnimationFrame() {
    const callback = rafCallbacks.shift();
    if (callback) {
        callback(performance.now());
    }
}

/** Runs `count` frames, each `frameMs` after the last; returns the times. */
function runFrames(count: number, frameMs = 1000 / 60) {
    for (let i = 0; i < count; i++) {
        frameClock += frameMs;
        rafCallbacks.shift()?.(frameClock);
    }
}

/** A scroller with 1000px to travel and a play button in it. */
function setUpPlaying({
    fontSize,
    devicePixelRatio = 1,
}: { fontSize?: string; devicePixelRatio?: number } = {}) {
    const parent = document.createElement('div');
    const play = document.createElement('i');
    play.className = PLAY_TO_BOTTOM_CLASSNAME;
    if (fontSize !== undefined) {
        const verse = document.createElement('span');
        verse.dataset.kjvVerseKey = 'JHN 3:16';
        verse.style.fontSize = fontSize;
        parent.append(verse);
    }
    parent.append(play);
    // Attached: jsdom only refreshes computed style inside the document.
    document.body.append(parent);
    defineScrollMetrics(parent, {
        clientHeight: 100,
        scrollHeight: 1100,
        scrollTop: 0,
    });
    const writes: number[] = [];
    const descriptor = Object.getOwnPropertyDescriptor(parent, 'scrollTop')!;
    Object.defineProperty(parent, 'scrollTop', {
        configurable: true,
        get: descriptor.get,
        set: (value: number) => {
            writes.push(value);
            descriptor.set!(value);
        },
    });
    vi.stubGlobal('devicePixelRatio', devicePixelRatio);
    return { parent, play, writes };
}

function createFakeEvent(options?: { altKey?: boolean }) {
    return {
        altKey: options?.altKey ?? false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
    } as any;
}

describe('scrollingHandlerHelpers', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        resizeObserverEntries.length = 0;
        rafCallbacks.length = 0;
        frameClock = 1000;
        vi.spyOn(performance, 'now').mockImplementation(() => frameClock);

        Object.defineProperty(globalThis, 'requestAnimationFrame', {
            configurable: true,
            value: vi.fn((callback: FrameRequestCallback) => {
                rafCallbacks.push(callback);
                return rafCallbacks.length;
            }),
        });

        class ResizeObserverMock {
            observe = vi.fn();
            disconnect = vi.fn();

            constructor(callback: ResizeObserverCallback) {
                resizeObserverEntries.push({
                    callback,
                    observe: this.observe,
                    disconnect: this.disconnect,
                });
            }
        }

        Object.defineProperty(globalThis, 'ResizeObserver', {
            configurable: true,
            value: ResizeObserverMock,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        document.body.replaceChildren();
    });

    test('exposes style constants and safely handles orphaned controls', () => {
        const toTop = document.createElement('i');
        const play = document.createElement('i');

        expect(TO_THE_TOP_STYLE_STRING).toContain(`.${TO_THE_TOP_CLASSNAME}`);
        expect(TO_THE_TOP_STYLE_STRING).toContain(
            `.${PLAY_TO_BOTTOM_CLASSNAME}`,
        );

        applyToTheTop(toTop);
        applyPlayToBottom(play);

        expect(toTop.title).toBe('Click or Double Click to scroll to the top');
        expect(play.title).toBe('');
        expect(toTop.onclick).toBeNull();
        expect(play.onclick).toBeNull();
    });

    test('toggles the top button and scrolls to top only when play-to-bottom is idle', () => {
        const parent = document.createElement('div');
        const toTop = document.createElement('i');
        const play = document.createElement('i');
        play.className = PLAY_TO_BOTTOM_CLASSNAME;
        parent.append(toTop, play);

        defineScrollMetrics(parent, {
            clientHeight: 120,
            scrollHeight: 360,
            scrollTop: 0,
        });
        (parent as any).scrollTo = vi.fn(({ top }: { top: number }) => {
            parent.scrollTop = top;
        });

        applyToTheTop(toTop);
        expect(toTop.classList.contains('show')).toBe(false);

        parent.scrollTop = 40;
        parent.dispatchEvent(new Event('scroll'));
        expect(toTop.classList.contains('show')).toBe(true);

        parent.scrollTop = 0;
        parent.dispatchEvent(new Event('scroll'));
        expect(toTop.classList.contains('show')).toBe(false);

        const clickEvent = createFakeEvent();
        toTop.onclick?.(clickEvent);
        expect(clickEvent.preventDefault).toHaveBeenCalledTimes(1);
        expect(clickEvent.stopPropagation).toHaveBeenCalledTimes(1);
        expect((parent as any).scrollTo).toHaveBeenCalledWith({
            behavior: 'smooth',
            top: 0,
        });

        play.dataset.speed = '0.35';
        const blockedClickEvent = createFakeEvent();
        toTop.onclick?.(blockedClickEvent);
        expect((parent as any).scrollTo).toHaveBeenCalledTimes(1);
        expect(parent.classList.contains('asking-to-top')).toBe(false);

        const doubleClickEvent = createFakeEvent();
        toTop.ondblclick?.(doubleClickEvent);
        expect(parent.classList.contains('asking-to-top')).toBe(true);
        expect(doubleClickEvent.preventDefault).toHaveBeenCalledTimes(1);
        expect(doubleClickEvent.stopPropagation).toHaveBeenCalledTimes(1);
    });

    test('shows or hides the play-to-bottom button and updates speed controls', () => {
        const parent = document.createElement('div');
        const play = document.createElement('i');
        parent.append(play);

        defineScrollMetrics(parent, {
            clientHeight: 160,
            scrollHeight: 160,
            scrollTop: 0,
        });
        (parent as any).scrollTo = vi.fn(({ top }: { top: number }) => {
            parent.scrollTop = top;
        });

        const movedCheck = {
            check: vi.fn(),
            threshold: 0.1,
        };

        applyPlayToBottom(play, movedCheck);
        expect(play.title).toBe(
            'Click to scroll to the bottom, double click to speed up, right click to slow down, Alt + right click to stop',
        );
        expect(play.style.display).toBe('none');
        expect(resizeObserverEntries[0]?.observe).toHaveBeenCalledWith(parent);

        Object.defineProperty(parent, 'scrollHeight', {
            configurable: true,
            value: 360,
        });
        resizeObserverEntries[0]?.callback(
            [{ target: parent } as unknown as ResizeObserverEntry],
            {} as ResizeObserver,
        );
        expect(play.style.display).toBe('block');

        const emptyContextEvent = createFakeEvent();
        play.oncontextmenu?.(emptyContextEvent);
        expect(play.dataset.speed).toBeUndefined();
        expect(emptyContextEvent.preventDefault).toHaveBeenCalledTimes(1);

        const clickEvent = createFakeEvent();
        play.onclick?.(clickEvent);
        expect(Number.parseFloat(play.dataset.speed ?? '0')).toBeCloseTo(
            0.07,
            3,
        );
        expect(play.title).toBe('0.07');
        expect(parent.scrollTop).toBe(0); // it moves with time, not on click
        runFrames(10); // 10 frames x 0.12px = 1.2px: one whole pixel shown
        expect(parent.scrollTop).toBe(1);
        vi.runOnlyPendingTimers();
        expect(movedCheck.check).toHaveBeenCalledWith(parent);

        const doubleClickEvent = createFakeEvent();
        play.ondblclick?.(doubleClickEvent);
        expect(Number.parseFloat(play.dataset.speed ?? '0')).toBeCloseTo(
            0.28,
            3,
        );
        expect(play.title).toBe('0.28');

        const contextEvent = createFakeEvent();
        play.oncontextmenu?.(contextEvent);
        expect(Number.parseFloat(play.dataset.speed ?? '0')).toBeCloseTo(
            0.21,
            3,
        );
        expect(play.title).toBe('0.21');

        const altContextEvent = createFakeEvent({ altKey: true });
        play.oncontextmenu?.(altContextEvent);
        runNextAnimationFrame();
        expect(play.dataset.speed).toBe('');
        expect(play.title).toBe(
            'Click to scroll to the bottom, double click to speed up, right click to slow down, Alt + right click to stop',
        );
    });

    test('stops immediately at the bottom and handles the asking-to-top animation path', () => {
        const bottomParent = document.createElement('div');
        const bottomPlay = document.createElement('i');
        bottomParent.append(bottomPlay);

        defineScrollMetrics(bottomParent, {
            clientHeight: 100,
            scrollHeight: 400,
            scrollTop: 295,
        });
        (bottomParent as any).scrollTo = vi.fn(({ top }: { top: number }) => {
            bottomParent.scrollTop = top;
        });
        applyPlayToBottom(bottomPlay);

        bottomPlay.onclick?.(createFakeEvent());
        expect(bottomPlay.dataset.speed).toBe('');
        expect(bottomPlay.title).toBe(
            'Click to scroll to the bottom, double click to speed up, right click to slow down, Alt + right click to stop',
        );

        const topParent = document.createElement('div');
        const topPlay = document.createElement('i');
        topParent.append(topPlay);
        defineScrollMetrics(topParent, {
            clientHeight: 100,
            scrollHeight: 400,
            scrollTop: 50,
        });
        (topParent as any).scrollTo = vi.fn(({ top }: { top: number }) => {
            topParent.scrollTop = top;
        });
        topParent.classList.add('asking-to-top');

        applyPlayToBottom(topPlay);
        topPlay.onclick?.(createFakeEvent());

        expect((topParent as any).scrollTo).toHaveBeenCalledWith({
            behavior: 'smooth',
            top: 0,
        });
        expect((topParent as any)._askingToTop).toBe(false);
        expect(topParent.classList.contains('asking-to-top')).toBe(true);

        vi.advanceTimersByTime(2000);
        expect(topParent.classList.contains('asking-to-top')).toBe(false);
        expect(rafCallbacks.length).toBeGreaterThan(0);
    });
    // `applyPlayToBottom` is called from an inline `ref` callback, so React runs
    // it again on every render of the host. Everything below used to be rebuilt
    // from scratch each time.
    test('survives a re-apply with one loop, one observer and its speed', () => {
        const parent = document.createElement('div');
        const play = document.createElement('i');
        play.className = PLAY_TO_BOTTOM_CLASSNAME;
        parent.append(play);

        defineScrollMetrics(parent, {
            clientHeight: 100,
            scrollHeight: 400,
            scrollTop: 0,
        });

        applyPlayToBottom(play);
        play.onclick?.(createFakeEvent());
        play.onclick?.(createFakeEvent());
        expect(Number.parseFloat(play.dataset.speed ?? '0')).toBeCloseTo(
            0.14,
            3,
        );
        const framesWhileRunning = rafCallbacks.length;
        expect(framesWhileRunning).toBeGreaterThan(0);

        applyPlayToBottom(play);

        // The speed the button is carrying survives the re-apply...
        expect(Number.parseFloat(play.dataset.speed ?? '0')).toBeCloseTo(
            0.14,
            3,
        );
        expect(play.title).toBe('0.14');
        // ...no second animation loop was armed over the same scroller...
        expect(rafCallbacks.length).toBe(framesWhileRunning);
        // ...and the observer from the first run was dropped rather than left
        // on the scroller beside the new one.
        expect(resizeObserverEntries).toHaveLength(2);
        expect(resizeObserverEntries[0]?.disconnect).toHaveBeenCalledTimes(1);
        expect(resizeObserverEntries[1]?.observe).toHaveBeenCalledWith(parent);

        // Slowing down still SLOWS. With the speed rebuilt at 0 on every
        // render, this computed `0 - 0.07`, clamped to zero, and stopped the
        // scroll outright.
        play.oncontextmenu?.(createFakeEvent());
        expect(Number.parseFloat(play.dataset.speed ?? '0')).toBeCloseTo(
            0.07,
            3,
        );
    });
    test('keeps its pace per second, whatever the frame rate', () => {
        const fast = setUpPlaying();
        applyPlayToBottom(fast.play);
        fast.play.onclick?.(createFakeEvent());
        runFrames(120); // two seconds at 60fps
        const slow = setUpPlaying();
        rafCallbacks.length = 0;
        applyPlayToBottom(slow.play);
        slow.play.onclick?.(createFakeEvent());
        runFrames(60, 1000 / 30); // the same two seconds at 30fps
        // 0.12px a 60Hz frame = 7.2px a second, at either rate. A per-frame
        // step used to cover half the distance at 30fps.
        expect(fast.parent.scrollTop).toBe(14);
        expect(slow.parent.scrollTop).toBe(14);
    });

    test('scales its pace with the size the text is shown at', () => {
        const normal = setUpPlaying({ fontSize: '35px' });
        applyPlayToBottom(normal.play);
        normal.play.onclick?.(createFakeEvent());
        runFrames(120);
        const big = setUpPlaying({ fontSize: '70px' });
        rafCallbacks.length = 0;
        applyPlayToBottom(big.play);
        big.play.onclick?.(createFakeEvent());
        runFrames(120);
        expect(getSubPixelScrollTop(normal.parent)).toBeCloseTo(14.4, 6);
        // twice the text, twice the px
        expect(getSubPixelScrollTop(big.parent)).toBeCloseTo(28.8, 6);
    });

    test('a slow scroll steps whole device pixels at an even beat', () => {
        const { play, writes } = setUpPlaying({ devicePixelRatio: 1.25 });
        applyPlayToBottom(play);
        play.onclick?.(createFakeEvent());
        const stepFrames: number[] = [];
        for (let frame = 1; frame <= 120; frame++) {
            const before = writes.length;
            runFrames(1);
            if (writes.length > before) {
                stepFrames.push(frame);
            }
        }
        // 7.2px a second in 0.8px device pixels: 9 steps a second, each one
        // device pixel, a write only when the pixel changes.
        expect(writes.length).toBe(stepFrames.length);
        expect(writes.length).toBeGreaterThanOrEqual(17);
        for (let i = 1; i < writes.length; i++) {
            expect(writes[i] - writes[i - 1]).toBeCloseTo(0.8, 6);
        }
        const gaps = stepFrames
            .slice(1)
            .map((frame, i) => frame - stepFrames[i]);
        expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1);
    });

    test('carries on from where a hand scrolled it, up as well as down', () => {
        const { parent, play } = setUpPlaying();
        applyPlayToBottom(play);
        play.onclick?.(createFakeEvent());
        runFrames(600); // 10 seconds: 72px
        expect(parent.scrollTop).toBe(72);
        parent.scrollTop = 10; // scrolled back up to re-read
        runFrames(60);
        // It used to snap straight back down to 72.
        expect(parent.scrollTop).toBe(17);
        parent.scrollTop = 500;
        runFrames(60);
        expect(parent.scrollTop).toBe(507);
    });

    test('hands every frame its exact position, slides while it plays', () => {
        const { parent, play } = setUpPlaying();
        const onFrame = vi.fn();
        applyPlayToBottom(play, undefined, onFrame);
        play.onclick?.(createFakeEvent());
        runFrames(3);
        expect(onFrame).toHaveBeenCalledTimes(3);
        expect(onFrame.mock.calls[2][0]).toBeCloseTo(0.36, 6);
        runFrames(6); // 1.08px: the first whole pixel is the scroll offset
        expect(parent.scrollTop).toBe(1);
        expect(checkIsSubPixelScrolling(parent)).toBe(true);
        play.oncontextmenu?.(createFakeEvent({ altKey: true }));
        runFrames(1);
        expect(checkIsSubPixelScrolling(parent)).toBe(false);
        expect(onFrame).toHaveBeenLastCalledWith(1, false);
    });

    test('a font-size change re-applied mid-scroll changes the pace at once', () => {
        const { parent, play } = setUpPlaying({ fontSize: '35px' });
        applyPlayToBottom(play);
        play.onclick?.(createFakeEvent());
        runFrames(60);
        expect(parent.scrollTop).toBe(7);
        parent.querySelector<HTMLElement>('span')!.style.fontSize = '70px';
        applyPlayToBottom(play); // the host re-rendered with the new size
        runFrames(60);
        expect(getSubPixelScrollTop(parent)).toBeCloseTo(21.6, 6); // 7.2 + 14.4
    });
    test('glides the text every frame and lets go when it stops', () => {
        const { parent, play, writes } = setUpPlaying();
        const text = document.createElement('div');
        parent.prepend(text);
        const onFrame = vi.fn();
        applyPlayToBottom(play, undefined, onFrame);
        play.onclick?.(createFakeEvent());
        const slides = new Set<string>();
        for (let i = 0; i < 8; i++) {
            runFrames(1);
            slides.add(text.style.translate);
        }
        // 0.12px a frame: a new position every frame, no whole pixel yet.
        expect(slides.size).toBe(8);
        expect(writes).toEqual([]);
        expect(text.style.willChange).toBe('transform');
        expect(play.style.translate).toBe(''); // the button stays put
        runFrames(1); // 1.08px
        expect(writes).toEqual([1]);
        expect(text.style.translate).toBe('0 -0.080px');
        play.oncontextmenu?.(createFakeEvent({ altKey: true }));
        runFrames(1);
        expect(text.style.translate).toBe('');
        expect(text.style.willChange).toBe('');
        expect(onFrame).toHaveBeenLastCalledWith(1, false);
    });
});
