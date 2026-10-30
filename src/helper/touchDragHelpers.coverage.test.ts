// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { initTouchDragAndDrop } from './touchDragHelpers';

// The gesture's edges: the paths `touchDragHelpers.test.ts` does not walk --
// a second finger, a foreign touch, a refused drag start, the auto-scroll at
// a list's edge and the tap the drop must swallow.

class TestDataTransfer {
    private readonly store: Record<string, string> = {};
    effectAllowed = 'none';
    dropEffect = 'none';
    setData(format: string, data: string) {
        this.store[format] = data;
    }
    getData(format: string) {
        return this.store[format] ?? '';
    }
}

class TestDragEvent extends MouseEvent {
    readonly dataTransfer: any;
    constructor(type: string, init: any = {}) {
        super(type, init);
        this.dataTransfer = init.dataTransfer ?? null;
    }
}

type TestTouchType = { identifier: number; clientX: number; clientY: number };

function toTouch(
    clientX: number,
    clientY: number,
    identifier = 1,
): TestTouchType {
    return { identifier, clientX, clientY };
}

function dispatchTouchEvent(
    type: string,
    target: EventTarget,
    touches: TestTouchType[],
    changedTouches: TestTouchType[] = touches,
) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', { value: touches });
    Object.defineProperty(event, 'changedTouches', { value: changedTouches });
    target.dispatchEvent(event);
    return event;
}

let frameCallbacks: FrameRequestCallback[] = [];
function flushFrame() {
    const callbacks = frameCallbacks;
    frameCallbacks = [];
    for (const callback of callbacks) {
        callback(0);
    }
}

// jsdom lays nothing out, so a scrollable box is described by hand: its
// content larger than its viewport on both axes, and a scroll offset the
// test can read back.
function makeScrollable(element: HTMLElement) {
    const scroll = { top: 100, left: 100 };
    Object.defineProperties(element, {
        scrollHeight: { configurable: true, value: 500 },
        clientHeight: { configurable: true, value: 100 },
        scrollWidth: { configurable: true, value: 500 },
        clientWidth: { configurable: true, value: 100 },
        scrollTop: {
            configurable: true,
            get: () => scroll.top,
            set: (value: number) => {
                scroll.top = value;
            },
        },
        scrollLeft: {
            configurable: true,
            get: () => scroll.left,
            set: (value: number) => {
                scroll.left = value;
            },
        },
    });
    element.getBoundingClientRect = () =>
        ({
            top: 0,
            bottom: 100,
            left: 0,
            right: 100,
            width: 100,
            height: 100,
        }) as DOMRect;
    return scroll;
}

describe('touchDragHelpers edge cases', () => {
    let uninstall: () => void;
    let sourceElement: HTMLElement;
    let targetElement: HTMLElement;
    let events: string[];
    let elementAtPoint: Element | null;

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        (globalThis as any).DataTransfer = TestDataTransfer;
        (globalThis as any).DragEvent = TestDragEvent;
        frameCallbacks = [];
        globalThis.requestAnimationFrame = ((
            callback: FrameRequestCallback,
        ) => {
            frameCallbacks.push(callback);
            return frameCallbacks.length;
        }) as any;
        globalThis.cancelAnimationFrame = (() => {}) as any;

        events = [];
        elementAtPoint = null;
        document.elementFromPoint = (() => elementAtPoint) as any;

        sourceElement = document.createElement('div');
        sourceElement.setAttribute('draggable', 'true');
        sourceElement.addEventListener('dragstart', (event: any) => {
            events.push('dragstart');
            event.dataTransfer.setData('text', 'payload');
        });
        sourceElement.addEventListener('dragend', () => {
            events.push('dragend');
        });

        targetElement = document.createElement('div');
        for (const type of ['dragenter', 'dragleave', 'drop']) {
            targetElement.addEventListener(type, () => {
                events.push(type);
            });
        }
        targetElement.addEventListener('dragover', (event) => {
            events.push('dragover');
            event.preventDefault();
        });

        document.body.append(sourceElement, targetElement);
        uninstall = initTouchDragAndDrop();
    });

    afterEach(() => {
        uninstall();
        // Every finished drag arms a 400 ms tap guard on `window`; let it run
        // out here, or a guard left by one test swallows the next one's taps.
        vi.advanceTimersByTime(1000);
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    function pressAndHold(element: HTMLElement, x = 10, y = 10) {
        dispatchTouchEvent('touchstart', element, [toTouch(x, y)]);
        vi.advanceTimersByTime(300);
    }

    test('a touch that does not land on an element starts nothing', () => {
        elementAtPoint = targetElement;
        // `document` is the event target here: not an Element at all.
        dispatchTouchEvent('touchstart', document, [toTouch(10, 10)]);
        vi.advanceTimersByTime(300);
        dispatchTouchEvent('touchmove', document, [toTouch(100, 100)]);
        dispatchTouchEvent('touchend', document, [], [toTouch(100, 100)]);

        expect(events).toEqual([]);
    });

    test('a press that starts with two fingers is a pinch, not a drag', () => {
        elementAtPoint = targetElement;
        dispatchTouchEvent('touchstart', sourceElement, [
            toTouch(10, 10, 1),
            toTouch(40, 40, 2),
        ]);
        vi.advanceTimersByTime(300);
        dispatchTouchEvent('touchmove', document, [toTouch(100, 100)]);
        dispatchTouchEvent('touchend', document, [], [toTouch(100, 100)]);

        expect(events).toEqual([]);
    });

    test('a second finger during a drag aborts it without a drop', () => {
        elementAtPoint = targetElement;
        pressAndHold(sourceElement);
        dispatchTouchEvent('touchmove', document, [toTouch(100, 100)]);
        expect(events).toContain('dragstart');

        dispatchTouchEvent('touchstart', targetElement, [
            toTouch(100, 100, 1),
            toTouch(150, 150, 2),
        ]);
        expect(events).not.toContain('drop');
        expect(events.at(-2)).toBe('dragleave');
        expect(events.at(-1)).toBe('dragend');
        expect(document.querySelector('.app-touch-drag-ghost')).toBeNull();

        // The gesture is over: the first finger lifting drops nothing.
        const countBefore = events.length;
        dispatchTouchEvent('touchend', document, [], [toTouch(100, 100)]);
        expect(events).toHaveLength(countBefore);
    });

    test('another finger moving before the hold elapses does not cancel it', () => {
        elementAtPoint = targetElement;
        dispatchTouchEvent('touchstart', sourceElement, [toTouch(10, 10)]);
        // A different touch moved far away: not ours, so not a scroll.
        dispatchTouchEvent('touchmove', document, [toTouch(300, 300, 7)]);
        vi.advanceTimersByTime(300);
        dispatchTouchEvent('touchmove', document, [toTouch(100, 100)]);
        dispatchTouchEvent('touchend', document, [], [toTouch(100, 100)]);

        expect(events).toContain('dragstart');
        expect(events).toContain('drop');
    });

    test('an armed move of another touch neither drags nor blocks the scroll', () => {
        elementAtPoint = targetElement;
        pressAndHold(sourceElement);
        const foreignMove = dispatchTouchEvent('touchmove', document, [
            toTouch(200, 200, 9),
        ]);
        expect(foreignMove.defaultPrevented).toBe(false);
        expect(events).toEqual([]);

        const ownMove = dispatchTouchEvent('touchmove', document, [
            toTouch(100, 100),
        ]);
        expect(ownMove.defaultPrevented).toBe(true);
        expect(events).toContain('dragstart');
    });

    test('the end of another touch leaves the drag running', () => {
        elementAtPoint = targetElement;
        pressAndHold(sourceElement);
        dispatchTouchEvent('touchmove', document, [toTouch(100, 100)]);

        dispatchTouchEvent('touchend', document, [], [toTouch(50, 50, 4)]);
        expect(events).not.toContain('drop');
        expect(document.querySelector('.app-touch-drag-ghost')).not.toBeNull();

        dispatchTouchEvent('touchend', document, [], [toTouch(100, 100)]);
        expect(events).toContain('drop');
        expect(events.at(-1)).toBe('dragend');
    });

    test('a drag start the source refuses ends the gesture at once', () => {
        sourceElement.addEventListener('dragstart', (event) => {
            event.preventDefault();
        });
        elementAtPoint = targetElement;
        pressAndHold(sourceElement);
        const move = dispatchTouchEvent('touchmove', document, [
            toTouch(100, 100),
        ]);

        expect(events).toEqual(['dragstart']);
        expect(move.defaultPrevented).toBe(false);
        expect(document.querySelector('.app-touch-drag-ghost')).toBeNull();
        // Nothing is listening any more: the lift is not a drop.
        dispatchTouchEvent('touchend', document, [], [toTouch(100, 100)]);
        expect(events).toEqual(['dragstart']);
    });

    test('a runtime that lost drag events since the press gives up quietly', () => {
        elementAtPoint = targetElement;
        pressAndHold(sourceElement);
        (globalThis as any).DragEvent = undefined;
        const move = dispatchTouchEvent('touchmove', document, [
            toTouch(100, 100),
        ]);
        expect(move.defaultPrevented).toBe(false);
        dispatchTouchEvent('touchend', document, [], [toTouch(100, 100)]);

        expect(events).toEqual([]);
        expect(document.querySelector('.app-touch-drag-ghost')).toBeNull();
    });

    test('a long item name is cut in the drag ghost', () => {
        elementAtPoint = targetElement;
        sourceElement.dataset.touchDragLabel = 'x'.repeat(80);
        pressAndHold(sourceElement);
        dispatchTouchEvent('touchmove', document, [toTouch(100, 100)]);

        const ghost = document.querySelector('.app-touch-drag-ghost');
        expect(ghost?.textContent).toBe(`${'x'.repeat(60)}…`);
        dispatchTouchEvent('touchend', document, [], [toTouch(100, 100)]);
    });

    test('a pending frame after the drop does nothing', () => {
        elementAtPoint = targetElement;
        pressAndHold(sourceElement);
        dispatchTouchEvent('touchmove', document, [toTouch(100, 100)]);
        dispatchTouchEvent('touchend', document, [], [toTouch(100, 100)]);
        const countAfterDrop = events.length;

        // The frame queued before the drop still fires once.
        flushFrame();
        expect(events).toHaveLength(countAfterDrop);
        expect(events.at(-1)).toBe('dragend');
    });

    test('the tap the drop synthesizes is swallowed, and only that one', () => {
        const onClick = vi.fn();
        targetElement.addEventListener('click', onClick);
        elementAtPoint = targetElement;
        pressAndHold(sourceElement);
        dispatchTouchEvent('touchmove', document, [toTouch(100, 100)]);
        dispatchTouchEvent('touchend', document, [], [toTouch(100, 100)]);

        const syntheticClick = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
        });
        targetElement.dispatchEvent(syntheticClick);
        expect(syntheticClick.defaultPrevented).toBe(true);
        expect(onClick).not.toHaveBeenCalled();

        const contextMenu = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
        });
        targetElement.dispatchEvent(contextMenu);
        expect(contextMenu.defaultPrevented).toBe(true);

        // A real tap later on is the user's own again.
        targetElement.dispatchEvent(
            new MouseEvent('click', { bubbles: true, cancelable: true }),
        );
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    test('the swallowing guard expires even when no tap came', () => {
        const onClick = vi.fn();
        targetElement.addEventListener('click', onClick);
        elementAtPoint = targetElement;
        pressAndHold(sourceElement);
        dispatchTouchEvent('touchmove', document, [toTouch(100, 100)]);
        dispatchTouchEvent('touchend', document, [], [toTouch(100, 100)]);

        vi.advanceTimersByTime(400);
        const laterClick = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
        });
        targetElement.dispatchEvent(laterClick);
        expect(laterClick.defaultPrevented).toBe(false);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    test('a drag near the edges of the named scroll container scrolls it', () => {
        const container = document.createElement('div');
        container.id = 'touch-list';
        container.appendChild(sourceElement);
        document.body.appendChild(container);
        const scroll = makeScrollable(container);
        sourceElement.dataset.scrollContainerSelector = '#touch-list';

        pressAndHold(sourceElement, 50, 50);
        // Top-left corner: both axes step back.
        dispatchTouchEvent('touchmove', document, [toTouch(10, 10)]);
        expect(events).toContain('dragstart');
        expect(scroll).toEqual({ top: 86, left: 86 });

        // Bottom-right corner, applied on the next frame.
        dispatchTouchEvent('touchmove', document, [toTouch(95, 95)]);
        flushFrame();
        expect(scroll).toEqual({ top: 100, left: 100 });

        // The middle leaves it where it is.
        dispatchTouchEvent('touchmove', document, [toTouch(50, 50)]);
        flushFrame();
        expect(scroll).toEqual({ top: 100, left: 100 });
        dispatchTouchEvent('touchend', document, [], [toTouch(50, 50)]);
    });

    test('without a named container the nearest scrolling ancestor scrolls', () => {
        const scroller = document.createElement('div');
        scroller.style.overflowY = 'auto';
        const plainParent = document.createElement('div');
        plainParent.appendChild(sourceElement);
        scroller.appendChild(plainParent);
        document.body.appendChild(scroller);
        const scroll = makeScrollable(scroller);
        // A selector that matches nothing falls back to the search.
        sourceElement.dataset.scrollContainerSelector = '#not-there';

        pressAndHold(sourceElement, 50, 50);
        dispatchTouchEvent('touchmove', document, [toTouch(60, 95)]);
        expect(events).toContain('dragstart');
        expect(scroll.top).toBe(114);
        dispatchTouchEvent('touchend', document, [], [toTouch(60, 95)]);
    });

    test('a list that does not scroll is left alone', () => {
        const container = document.createElement('div');
        container.style.overflowY = 'auto';
        container.appendChild(sourceElement);
        document.body.appendChild(container);
        let scrollTopWrites = 0;
        Object.defineProperty(container, 'scrollTop', {
            configurable: true,
            get: () => 0,
            set: () => {
                scrollTopWrites++;
            },
        });

        pressAndHold(sourceElement, 50, 50);
        dispatchTouchEvent('touchmove', document, [toTouch(10, 10)]);
        flushFrame();
        expect(events).toContain('dragstart');
        expect(scrollTopWrites).toBe(0);
        dispatchTouchEvent('touchend', document, [], [toTouch(10, 10)]);
    });
});
