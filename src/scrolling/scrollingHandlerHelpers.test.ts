// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    applyPlayToBottom,
    applyToTheTop,
    PLAY_TO_BOTTOM_CLASSNAME,
    TO_THE_TOP_CLASSNAME,
    TO_THE_TOP_STYLE_STRING,
} from './scrollingHandlerHelpers';

type ResizeObserverEntryType = {
    callback: ResizeObserverCallback;
    observe: ReturnType<typeof vi.fn>;
};

const resizeObserverEntries: ResizeObserverEntryType[] = [];
const rafCallbacks: FrameRequestCallback[] = [];

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

        Object.defineProperty(globalThis, 'requestAnimationFrame', {
            configurable: true,
            value: vi.fn((callback: FrameRequestCallback) => {
                rafCallbacks.push(callback);
                return rafCallbacks.length;
            }),
        });

        class ResizeObserverMock {
            observe = vi.fn();

            constructor(callback: ResizeObserverCallback) {
                resizeObserverEntries.push({
                    callback,
                    observe: this.observe,
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
    });

    test('exposes style constants and safely handles orphaned controls', () => {
        const toTop = document.createElement('i');
        const play = document.createElement('i');

        expect(TO_THE_TOP_STYLE_STRING).toContain(`.${TO_THE_TOP_CLASSNAME}`);
        expect(TO_THE_TOP_STYLE_STRING).toContain(`.${PLAY_TO_BOTTOM_CLASSNAME}`);

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
        resizeObserverEntries[0]?.callback([
            { target: parent } as ResizeObserverEntry,
        ], {} as ResizeObserver);
        expect(play.style.display).toBe('block');

        const emptyContextEvent = createFakeEvent();
        play.oncontextmenu?.(emptyContextEvent);
        expect(play.dataset.speed).toBeUndefined();
        expect(emptyContextEvent.preventDefault).toHaveBeenCalledTimes(1);

        const clickEvent = createFakeEvent();
        play.onclick?.(clickEvent);
        expect(Number.parseFloat(play.dataset.speed ?? '0')).toBeCloseTo(0.07, 3);
        expect(play.title).toBe('0.07');
        expect(parent.scrollTop).toBeCloseTo(0.12, 3);
        vi.runOnlyPendingTimers();
        expect(movedCheck.check).toHaveBeenCalledWith(parent);

        const doubleClickEvent = createFakeEvent();
        play.ondblclick?.(doubleClickEvent);
        expect(Number.parseFloat(play.dataset.speed ?? '0')).toBeCloseTo(0.28, 3);
        expect(play.title).toBe('0.28');

        const contextEvent = createFakeEvent();
        play.oncontextmenu?.(contextEvent);
        expect(Number.parseFloat(play.dataset.speed ?? '0')).toBeCloseTo(0.21, 3);
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
});
