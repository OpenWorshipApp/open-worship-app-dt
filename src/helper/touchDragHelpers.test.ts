// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { initTouchDragAndDrop } from './touchDragHelpers';

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

function toTouch(clientX: number, clientY: number): TestTouchType {
    return { identifier: 1, clientX, clientY };
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

describe('touchDragHelpers', () => {
    let uninstall: () => void;
    let sourceElement: HTMLElement;
    let targetElement: HTMLElement;
    let events: string[];
    let droppedData: string | null;
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
        droppedData = null;
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
        targetElement.setAttribute('draggable', 'true');
        targetElement.addEventListener('dragenter', () => {
            events.push('dragenter');
        });
        targetElement.addEventListener('dragover', (event) => {
            events.push('dragover');
            event.preventDefault();
        });
        targetElement.addEventListener('dragleave', () => {
            events.push('dragleave');
        });
        targetElement.addEventListener('drop', (event: any) => {
            events.push('drop');
            droppedData = event.dataTransfer.getData('text');
        });

        document.body.append(sourceElement, targetElement);
        uninstall = initTouchDragAndDrop();
    });

    afterEach(() => {
        uninstall();
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    function pressAndHold(element: HTMLElement) {
        dispatchTouchEvent('touchstart', element, [toTouch(10, 10)]);
        vi.advanceTimersByTime(300);
    }

    test('long press then move runs a full drag and drop', () => {
        elementAtPoint = targetElement;
        pressAndHold(sourceElement);
        dispatchTouchEvent('touchmove', document, [toTouch(100, 100)]);
        flushFrame();
        dispatchTouchEvent('touchend', document, [], [toTouch(100, 100)]);

        expect(events).toContain('dragstart');
        expect(events).toContain('dragenter');
        expect(events).toContain('dragover');
        expect(events).toContain('drop');
        expect(events.at(-1)).toBe('dragend');
        expect(droppedData).toBe('payload');
    });

    test('the drop reads the data written by the drag start', () => {
        elementAtPoint = targetElement;
        pressAndHold(sourceElement);
        dispatchTouchEvent('touchmove', document, [toTouch(100, 100)]);
        dispatchTouchEvent('touchend', document, [], [toTouch(100, 100)]);

        expect(droppedData).toBe('payload');
    });

    test('moving before the long press elapses scrolls instead of dragging', () => {
        elementAtPoint = targetElement;
        dispatchTouchEvent('touchstart', sourceElement, [toTouch(10, 10)]);
        dispatchTouchEvent('touchmove', document, [toTouch(10, 60)]);
        vi.advanceTimersByTime(300);
        dispatchTouchEvent('touchmove', document, [toTouch(100, 100)]);
        dispatchTouchEvent('touchend', document, [], [toTouch(100, 100)]);

        expect(events).toEqual([]);
    });

    test('a press that never moves does not start a drag', () => {
        elementAtPoint = targetElement;
        pressAndHold(sourceElement);
        dispatchTouchEvent('touchmove', document, [toTouch(12, 12)]);
        dispatchTouchEvent('touchend', document, [], [toTouch(12, 12)]);

        expect(events).toEqual([]);
    });

    test('a drop target that ignores drag over receives no drop', () => {
        const plainElement = document.createElement('div');
        plainElement.addEventListener('drop', () => {
            events.push('unexpected-drop');
        });
        plainElement.addEventListener('dragleave', () => {
            events.push('dragleave');
        });
        document.body.appendChild(plainElement);
        elementAtPoint = plainElement;

        pressAndHold(sourceElement);
        dispatchTouchEvent('touchmove', document, [toTouch(100, 100)]);
        dispatchTouchEvent('touchend', document, [], [toTouch(100, 100)]);

        expect(events).not.toContain('unexpected-drop');
        expect(events).toContain('dragleave');
        expect(events.at(-1)).toBe('dragend');
    });

    test('leaving a target notifies it before entering the next one', () => {
        elementAtPoint = targetElement;
        pressAndHold(sourceElement);
        dispatchTouchEvent('touchmove', document, [toTouch(100, 100)]);
        elementAtPoint = sourceElement;
        flushFrame();

        expect(events).toContain('dragleave');
    });

    test('a press on a text input is left to the browser', () => {
        const inputElement = document.createElement('input');
        sourceElement.appendChild(inputElement);
        elementAtPoint = targetElement;

        dispatchTouchEvent('touchstart', inputElement, [toTouch(10, 10)]);
        vi.advanceTimersByTime(300);
        dispatchTouchEvent('touchmove', document, [toTouch(100, 100)]);
        dispatchTouchEvent('touchend', document, [], [toTouch(100, 100)]);

        expect(events).toEqual([]);
    });

    test('a touch cancel aborts the drag without dropping', () => {
        elementAtPoint = targetElement;
        pressAndHold(sourceElement);
        dispatchTouchEvent('touchmove', document, [toTouch(100, 100)]);
        dispatchTouchEvent('touchcancel', document, [], [toTouch(100, 100)]);

        expect(events).not.toContain('drop');
        expect(events.at(-1)).toBe('dragend');
    });

    test('the drag ghost is removed once the gesture ends', () => {
        elementAtPoint = targetElement;
        sourceElement.dataset.touchDragLabel = 'Slide #3';
        pressAndHold(sourceElement);
        dispatchTouchEvent('touchmove', document, [toTouch(100, 100)]);
        const ghostElement = document.querySelector('.app-touch-drag-ghost');
        expect(ghostElement).not.toBeNull();
        expect(ghostElement?.textContent).toBe('Slide #3');

        dispatchTouchEvent('touchend', document, [], [toTouch(100, 100)]);
        expect(document.querySelector('.app-touch-drag-ghost')).toBeNull();
    });
});
