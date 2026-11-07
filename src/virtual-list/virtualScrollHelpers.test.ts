// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    findClippingAncestors,
    findScrollingAncestors,
    scrollBandIntoView,
    subscribeScrollerList,
    toVisibleWindow,
} from './virtualScrollHelpers';

function genElement(style: string, tagName = 'div') {
    const element = document.createElement(tagName);
    element.setAttribute('style', style);
    return element;
}

/** Nests the elements, oldest first, and returns the innermost one. */
function genNested(elementList: HTMLElement[]) {
    for (let index = 0; index < elementList.length - 1; index++) {
        elementList[index].appendChild(elementList[index + 1]);
    }
    document.body.appendChild(elementList[0]);
    return elementList[elementList.length - 1];
}

afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('subscribeScrollerList', () => {
    function installObserver() {
        const observers: Array<{
            notify: () => void;
            observe: ReturnType<typeof vi.fn>;
            disconnect: ReturnType<typeof vi.fn>;
        }> = [];
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe = vi.fn();
                disconnect = vi.fn();
                constructor(notify: () => void) {
                    observers.push(this);
                    this.notify = notify;
                }
                notify: () => void;
            },
        );
        return observers;
    }

    it('shares one observer and one frame across listeners on a scroller', () => {
        const observers = installObserver();
        const frames: FrameRequestCallback[] = [];
        const requestFrame = vi.fn((callback: FrameRequestCallback) => {
            frames.push(callback);
            return frames.length;
        });
        const cancelFrame = vi.fn();
        vi.stubGlobal('requestAnimationFrame', requestFrame);
        vi.stubGlobal('cancelAnimationFrame', cancelFrame);
        const scroller = document.createElement('div');
        const first = vi.fn();
        const second = vi.fn();
        const stopFirst = subscribeScrollerList([scroller], first);
        const stopSecond = subscribeScrollerList([scroller], second);
        expect(observers).toHaveLength(1);
        expect(observers[0].observe).toHaveBeenCalledWith(scroller);

        scroller.dispatchEvent(new Event('scroll'));
        scroller.dispatchEvent(new Event('scroll'));
        observers[0].notify();
        expect(requestFrame).toHaveBeenCalledOnce();
        frames[0](0);
        expect(first).toHaveBeenCalledOnce();
        expect(second).toHaveBeenCalledOnce();

        stopFirst();
        scroller.dispatchEvent(new Event('scroll'));
        frames[1](0);
        expect(first).toHaveBeenCalledOnce();
        expect(second).toHaveBeenCalledTimes(2);
        stopSecond();
        expect(observers[0].disconnect).toHaveBeenCalledOnce();
        scroller.dispatchEvent(new Event('scroll'));
        expect(requestFrame).toHaveBeenCalledTimes(2);
        expect(cancelFrame).toHaveBeenCalled();
    });

    it('flushes on the fallback timeout when an animation frame never arrives', () => {
        vi.useFakeTimers();
        const observers = installObserver();
        const cancelFrame = vi.fn();
        vi.stubGlobal(
            'requestAnimationFrame',
            vi.fn(() => 17),
        );
        vi.stubGlobal('cancelAnimationFrame', cancelFrame);
        const scroller = document.createElement('div');
        const listener = vi.fn();
        const stop = subscribeScrollerList([scroller], listener);
        observers[0].notify();
        expect(listener).not.toHaveBeenCalled();
        vi.advanceTimersByTime(50);
        expect(listener).toHaveBeenCalledOnce();
        expect(cancelFrame).toHaveBeenCalledWith(17);
        stop();
    });

    it('a second stop is harmless once the scroller is let go', () => {
        const observers = installObserver();
        vi.stubGlobal(
            'requestAnimationFrame',
            vi.fn(() => 1),
        );
        vi.stubGlobal('cancelAnimationFrame', vi.fn());
        const scroller = document.createElement('div');
        const stop = subscribeScrollerList([scroller], vi.fn());
        stop();
        expect(() => stop()).not.toThrow();
        expect(observers[0].disconnect).toHaveBeenCalledOnce();
        // A new subscriber starts a fresh entry rather than reviving the old.
        const stopAgain = subscribeScrollerList([scroller], vi.fn());
        expect(observers).toHaveLength(2);
        stopAgain();
    });

    it('watches each distinct clipping ancestor and stops all on cleanup', () => {
        const observers = installObserver();
        vi.stubGlobal(
            'requestAnimationFrame',
            vi.fn(() => 1),
        );
        vi.stubGlobal('cancelAnimationFrame', vi.fn());
        const ancestors = [
            document.createElement('div'),
            document.createElement('div'),
        ];
        const listener = vi.fn();
        const stop = subscribeScrollerList(ancestors, listener);
        expect(
            observers.map((observer) => observer.observe.mock.calls[0][0]),
        ).toEqual(ancestors);
        stop();
        expect(
            observers.every(
                (observer) => observer.disconnect.mock.calls.length === 1,
            ),
        ).toBe(true);
    });
});

describe('scrollBandIntoView', () => {
    function genScroller() {
        const scroller = document.createElement('div');
        Object.defineProperties(scroller, {
            clientHeight: { value: 400 },
            scrollHeight: { value: 4000 },
        });
        scroller.scrollTo = vi.fn();
        return scroller;
    }

    it('smoothly retargets repeated reveals without jumping scrollTop', () => {
        const scroller = genScroller();
        scroller.scrollTop = 100;
        for (const top of [800, 1200, 1600]) {
            expect(
                scrollBandIntoView({
                    clippingAncestorList: [scroller],
                    toBandTop: () => top,
                    height: 200,
                    align: 'center',
                    behavior: 'smooth',
                }),
            ).toBe(true);
        }
        expect(scroller.scrollTo).toHaveBeenNthCalledWith(1, {
            top: 700,
            behavior: 'smooth',
        });
        expect(scroller.scrollTo).toHaveBeenLastCalledWith({
            top: 1500,
            behavior: 'smooth',
        });
        expect(scroller.scrollTop).toBe(100);
    });

    it('is a no when no ancestor has anything to scroll', () => {
        const short = document.createElement('div');
        Object.defineProperties(short, {
            clientHeight: { value: 400 },
            scrollHeight: { value: 400 },
        });
        const toBandTop = vi.fn(() => 800);
        expect(
            scrollBandIntoView({
                clippingAncestorList: [short],
                toBandTop,
                height: 200,
            }),
        ).toBe(false);
        expect(
            scrollBandIntoView({
                clippingAncestorList: [],
                toBandTop,
                height: 200,
            }),
        ).toBe(false);
        expect(toBandTop).not.toHaveBeenCalled();
    });

    it('keeps immediate reveals and already-visible nearest rows unchanged', () => {
        const scroller = genScroller();
        scrollBandIntoView({
            clippingAncestorList: [scroller],
            toBandTop: () => 800,
            height: 200,
            align: 'center',
        });
        expect(scroller.scrollTop).toBe(700);
        scrollBandIntoView({
            clippingAncestorList: [scroller],
            toBandTop: () => 800,
            height: 200,
            behavior: 'smooth',
        });
        expect(scroller.scrollTo).not.toHaveBeenCalled();
        expect(scroller.scrollTop).toBe(700);
    });
});

describe('findScrollingAncestors', () => {
    it('keeps the ancestors whose vertical overflow scrolls or clips', () => {
        const auto = genElement('overflow-y: auto;');
        const hidden = genElement('overflow-y: hidden;');
        const sideways = genElement('overflow-x: auto; overflow-y: visible;');
        genNested([auto, hidden, sideways]);
        expect(findScrollingAncestors([auto, hidden, sideways])).toEqual([
            auto,
            hidden,
        ]);
        expect(findScrollingAncestors([])).toEqual([]);
    });
});

describe('toVisibleWindow', () => {
    function withRect(element: HTMLElement, top: number, bottom: number) {
        vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
            top,
            bottom,
        } as DOMRect);
        return element;
    }

    it('is the band every clipping ancestor and the window let through', () => {
        const list = withRect(document.createElement('div'), 100, 5000);
        const panel = withRect(document.createElement('div'), 50, 300);
        const body = withRect(document.createElement('div'), 80, 400);
        // Measured from the top of the list: its first 20px are hidden.
        expect(toVisibleWindow(list, [panel, body])).toEqual({
            top: -20,
            bottom: 200,
        });
    });

    it('is the window alone with no clipping ancestor', () => {
        const list = withRect(document.createElement('div'), 100, 5000);
        vi.stubGlobal('innerHeight', 700);
        expect(toVisibleWindow(list, [])).toEqual({ top: -100, bottom: 600 });
    });

    it("falls back to the document's height when the window reports none", () => {
        const list = withRect(document.createElement('div'), 10, 5000);
        vi.stubGlobal('innerHeight', 0);
        const descriptor = Object.getOwnPropertyDescriptor(
            document.documentElement,
            'clientHeight',
        );
        Object.defineProperty(document.documentElement, 'clientHeight', {
            value: 510,
            configurable: true,
        });
        try {
            expect(toVisibleWindow(list, [])).toEqual({
                top: -10,
                bottom: 500,
            });
        } finally {
            if (descriptor === undefined) {
                delete (document.documentElement as any).clientHeight;
            } else {
                Object.defineProperty(
                    document.documentElement,
                    'clientHeight',
                    descriptor,
                );
            }
        }
    });
});

describe('findClippingAncestors', () => {
    it('has nothing to walk from no element', () => {
        expect(findClippingAncestors(null)).toEqual([]);
    });

    it('takes every scrolling or hiding ancestor of a plain element', () => {
        const outer = genElement('overflow-y: hidden;');
        const scroller = genElement('overflow-y: auto;');
        const plain = genElement('');
        const list = genElement('');
        genNested([outer, scroller, plain, list]);
        expect(findClippingAncestors(list)).toEqual([scroller, outer]);
    });

    it('leaves out an ancestor that does not clip', () => {
        const visible = genElement('overflow: visible;');
        const list = genElement('');
        genNested([visible, list]);
        expect(findClippingAncestors(list)).toEqual([]);
    });

    it('stops at a fixed ancestor: nothing above it clips it', () => {
        // The Foreground panel. Its own `overflow: hidden` counts; the
        // presenter's, which ends above the panel, does not -- intersecting
        // with that made the panel's grid render nothing at all.
        const presenter = genElement('overflow-y: hidden;');
        const widget = genElement('position: fixed; overflow-y: hidden;');
        const content = genElement('overflow-y: auto;');
        const list = genElement('');
        genNested([presenter, widget, content, list]);
        expect(findClippingAncestors(list)).toEqual([content, widget]);
    });

    it('lets a transformed ancestor clip a fixed descendant again', () => {
        // A transform makes the element the containing block for `fixed`.
        const holder = genElement(
            'transform: translateX(1px); overflow: hidden;',
        );
        const widget = genElement('position: fixed;');
        const list = genElement('');
        genNested([holder, widget, list]);
        expect(findClippingAncestors(list)).toEqual([holder]);
    });

    it('skips ancestors an absolute element is not laid out inside', () => {
        const positioned = genElement('position: relative; overflow: hidden;');
        const between = genElement('overflow: hidden;');
        const floating = genElement('position: absolute;');
        const list = genElement('');
        genNested([positioned, between, floating, list]);
        expect(findClippingAncestors(list)).toEqual([positioned]);
    });
});
