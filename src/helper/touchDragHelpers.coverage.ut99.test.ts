// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { initTouchDragAndDrop } from './touchDragHelpers';

// jsdom ships neither a DataTransfer nor a DragEvent; the shim only needs
// these shapes. (Each test file builds its own: no shared fixture.)
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

function toTouch(clientX: number, clientY: number, identifier = 1) {
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
let cancelledFrames: number[] = [];
let nextFrameId = 0;
function flushFrame() {
    const callbacks = frameCallbacks;
    frameCallbacks = [];
    for (const callback of callbacks) {
        callback(0);
    }
}

const originalDataTransfer = (globalThis as any).DataTransfer;
const originalDragEvent = (globalThis as any).DragEvent;
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
const originalElementFromPoint = document.elementFromPoint;

describe('touchDragHelpers edge cases', () => {
    let uninstall: () => void;
    let sourceElement: HTMLElement;
    let targetElement: HTMLElement;
    let events: string[];
    let elementAtPoint: Element | null;
    let uncaughtErrors: unknown[];
    const onWindowError = (event: ErrorEvent) => {
        uncaughtErrors.push(event.error);
    };

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        (globalThis as any).DataTransfer = TestDataTransfer;
        (globalThis as any).DragEvent = TestDragEvent;
        frameCallbacks = [];
        cancelledFrames = [];
        nextFrameId = 0;
        globalThis.requestAnimationFrame = ((
            callback: FrameRequestCallback,
        ) => {
            frameCallbacks.push(callback);
            nextFrameId += 1;
            return nextFrameId;
        }) as any;
        globalThis.cancelAnimationFrame = ((id: number) => {
            cancelledFrames.push(id);
        }) as any;

        events = [];
        elementAtPoint = null;
        uncaughtErrors = [];
        window.addEventListener('error', onWindowError);
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
        targetElement.addEventListener('drop', () => {
            events.push('drop');
        });

        document.body.append(sourceElement, targetElement);
        uninstall = initTouchDragAndDrop();
    });

    afterEach(() => {
        uninstall();
        window.removeEventListener('error', onWindowError);
        document.body.innerHTML = '';
        (globalThis as any).DataTransfer = originalDataTransfer;
        (globalThis as any).DragEvent = originalDragEvent;
        globalThis.requestAnimationFrame = originalRequestAnimationFrame;
        globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
        document.elementFromPoint = originalElementFromPoint;
        vi.useRealTimers();
    });

    function pressAndHold(element: EventTarget, touch = toTouch(10, 10)) {
        dispatchTouchEvent('touchstart', element, [touch]);
        vi.advanceTimersByTime(300);
    }

    function dragTo(x: number, y: number) {
        return dispatchTouchEvent('touchmove', document, [toTouch(x, y)]);
    }

    function drop(x: number, y: number) {
        dispatchTouchEvent('touchend', document, [], [toTouch(x, y)]);
    }

    test('a press that does not land on an element is ignored, without throwing', () => {
        elementAtPoint = targetElement;
        pressAndHold(document);
        dragTo(100, 100);
        drop(100, 100);
        expect(events).toEqual([]);
        expect(uncaughtErrors).toEqual([]);
    });

    test('a press with two fingers is left to the browser (pinch)', () => {
        elementAtPoint = targetElement;
        dispatchTouchEvent('touchstart', sourceElement, [
            toTouch(10, 10),
            toTouch(60, 60, 2),
        ]);
        vi.advanceTimersByTime(300);
        dragTo(100, 100);
        drop(100, 100);
        expect(events).toEqual([]);
    });

    test('nothing is armed where DragEvent does not exist', () => {
        delete (globalThis as any).DragEvent;
        elementAtPoint = targetElement;
        pressAndHold(sourceElement);
        const moveEvent = dragTo(100, 100);
        drop(100, 100);
        expect(events).toEqual([]);
        expect(moveEvent.defaultPrevented).toBe(false);
    });

    test('a drag cannot begin once DragEvent went away after arming', () => {
        elementAtPoint = targetElement;
        pressAndHold(sourceElement);
        delete (globalThis as any).DragEvent;
        const moveEvent = dragTo(100, 100);
        // The gesture was reset: page scroll is not blocked, and a later move
        // with DragEvent back finds no armed gesture to continue.
        expect(moveEvent.defaultPrevented).toBe(false);
        (globalThis as any).DragEvent = TestDragEvent;
        expect(dragTo(120, 120).defaultPrevented).toBe(false);
        drop(120, 120);
        expect(events).toEqual([]);
    });

    test('a dragstart handler that cancels stops the drag before it starts', () => {
        sourceElement.addEventListener('dragstart', (event) => {
            event.preventDefault();
        });
        elementAtPoint = targetElement;
        pressAndHold(sourceElement);
        const moveEvent = dragTo(100, 100);
        drop(100, 100);
        expect(events).toEqual(['dragstart']);
        expect(moveEvent.defaultPrevented).toBe(false);
        expect(document.querySelector('.app-touch-drag-ghost')).toBeNull();
        expect(frameCallbacks).toEqual([]);
    });

    test('another finger moving does not cancel or move the held press', () => {
        elementAtPoint = targetElement;
        dispatchTouchEvent('touchstart', sourceElement, [toTouch(10, 10)]);
        // Far away, but not our finger: still a press, not a scroll.
        dispatchTouchEvent('touchmove', document, [toTouch(300, 300, 7)]);
        vi.advanceTimersByTime(300);
        // Armed now; another finger's move must not start the drag either.
        const otherMove = dispatchTouchEvent('touchmove', document, [
            toTouch(300, 300, 7),
        ]);
        expect(otherMove.defaultPrevented).toBe(false);
        expect(events).toEqual([]);

        const ownMove = dragTo(100, 100);
        expect(ownMove.defaultPrevented).toBe(true);
        expect(events).toEqual(['dragstart', 'dragenter', 'dragover']);
    });

    test('another finger lifting does not end the drag', () => {
        elementAtPoint = targetElement;
        pressAndHold(sourceElement);
        dragTo(100, 100);
        dispatchTouchEvent('touchend', document, [], [toTouch(5, 5, 9)]);
        expect(events).not.toContain('dragend');
        expect(document.querySelector('.app-touch-drag-ghost')).not.toBeNull();

        drop(100, 100);
        expect(events.slice(-2)).toEqual(['drop', 'dragend']);
    });

    test('a second finger touching down aborts the drag without a drop', () => {
        elementAtPoint = targetElement;
        pressAndHold(sourceElement);
        dragTo(100, 100);
        dispatchTouchEvent('touchstart', targetElement, [
            toTouch(100, 100),
            toTouch(150, 150, 2),
        ]);
        expect(events.slice(-2)).toEqual(['dragleave', 'dragend']);
        expect(events).not.toContain('drop');
        expect(document.querySelector('.app-touch-drag-ghost')).toBeNull();
        // The frame loop was cancelled, and a stale frame does nothing.
        expect(cancelledFrames).toHaveLength(1);
        const eventCount = events.length;
        flushFrame();
        expect(events).toHaveLength(eventCount);
        expect(frameCallbacks).toEqual([]);
    });

    test('a long label is cut, an empty one falls back to the title', () => {
        elementAtPoint = targetElement;
        sourceElement.dataset.touchDragLabel = 'x'.repeat(61);
        pressAndHold(sourceElement);
        dragTo(100, 100);
        expect(
            document.querySelector('.app-touch-drag-ghost')?.textContent,
        ).toBe(`${'x'.repeat(60)}…`);
        drop(100, 100);

        delete sourceElement.dataset.touchDragLabel;
        sourceElement.title = '  Song: Amazing Grace ';
        vi.advanceTimersByTime(400);
        pressAndHold(sourceElement);
        dragTo(100, 100);
        expect(
            document.querySelector('.app-touch-drag-ghost')?.textContent,
        ).toBe('Song: Amazing Grace');
    });

    test('the ghost follows the finger and lives on #app when there is one', () => {
        const appElement = document.createElement('div');
        appElement.id = 'app';
        document.body.appendChild(appElement);
        elementAtPoint = targetElement;
        pressAndHold(sourceElement);
        dragTo(100, 50);
        const ghostElement = document.querySelector<HTMLElement>(
            '.app-touch-drag-ghost',
        )!;
        expect(ghostElement.parentElement).toBe(appElement);
        expect(ghostElement.style.transform).toBe('translate(114px, 64px)');
        expect(ghostElement.style.pointerEvents).toBe('none');
    });

    describe('the tap the drop would synthesize', () => {
        test('is swallowed for 400ms after the drop, then let through', () => {
            const clicks: string[] = [];
            targetElement.addEventListener('click', () => {
                clicks.push('click');
            });
            targetElement.addEventListener('contextmenu', () => {
                clicks.push('contextmenu');
            });
            elementAtPoint = targetElement;
            pressAndHold(sourceElement);
            dragTo(100, 100);
            drop(100, 100);

            const click = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
            });
            targetElement.dispatchEvent(click);
            const menu = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
            });
            targetElement.dispatchEvent(menu);
            expect(clicks).toEqual([]);
            expect(click.defaultPrevented).toBe(true);
            expect(menu.defaultPrevented).toBe(true);

            // Only the first of each is swallowed (`once`).
            targetElement.dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            );
            expect(clicks).toEqual(['click']);
        });

        test('a tap after the window is untouched', () => {
            const clicks: string[] = [];
            targetElement.addEventListener('click', () => {
                clicks.push('click');
            });
            targetElement.addEventListener('contextmenu', () => {
                clicks.push('contextmenu');
            });
            elementAtPoint = targetElement;
            pressAndHold(sourceElement);
            dragTo(100, 100);
            drop(100, 100);

            vi.advanceTimersByTime(400);
            targetElement.dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            );
            targetElement.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
            expect(clicks).toEqual(['click', 'contextmenu']);
        });
    });

    describe('auto scroll near the edge of the list', () => {
        function makeScrollable(
            element: HTMLElement,
            {
                rect = { top: 0, bottom: 400, left: 0, right: 300 },
                vertical = true,
                horizontal = true,
            } = {},
        ) {
            const sizes = {
                scrollHeight: vertical ? 2000 : 400,
                clientHeight: 400,
                scrollWidth: horizontal ? 1500 : 300,
                clientWidth: 300,
            };
            for (const [key, value] of Object.entries(sizes)) {
                Object.defineProperty(element, key, {
                    configurable: true,
                    value,
                });
            }
            Object.defineProperty(element, 'scrollTop', {
                configurable: true,
                writable: true,
                value: 500,
            });
            Object.defineProperty(element, 'scrollLeft', {
                configurable: true,
                writable: true,
                value: 500,
            });
            element.getBoundingClientRect = () => rect as DOMRect;
        }

        // After the move that begins the drag, the target and the scroll are
        // only updated once per animation frame.
        function scrollAfterFrame(
            container: HTMLElement,
            x: number,
            y: number,
        ) {
            container.scrollTop = 500;
            container.scrollLeft = 500;
            dragTo(x, y);
            flushFrame();
            return [container.scrollTop, container.scrollLeft];
        }

        function beginDragMidList() {
            pressAndHold(sourceElement, toTouch(150, 200));
            dragTo(150, 210);
        }

        test('a scrolling ancestor is found and scrolled toward each edge', () => {
            const list = document.createElement('div');
            list.style.overflowY = 'auto';
            list.style.overflowX = 'scroll';
            makeScrollable(list);
            const row = document.createElement('div');
            list.appendChild(row);
            row.appendChild(sourceElement);
            document.body.appendChild(list);
            elementAtPoint = targetElement;

            beginDragMidList();
            // Middle of the list: no scroll.
            expect([list.scrollTop, list.scrollLeft]).toEqual([500, 500]);
            expect(scrollAfterFrame(list, 150, 220)).toEqual([500, 500]);
            expect(scrollAfterFrame(list, 150, 20)).toEqual([486, 500]);
            expect(scrollAfterFrame(list, 150, 390)).toEqual([514, 500]);
            expect(scrollAfterFrame(list, 20, 200)).toEqual([500, 486]);
            expect(scrollAfterFrame(list, 290, 200)).toEqual([500, 514]);
            // Each frame keeps scrolling while the finger rests at the edge.
            flushFrame();
            expect(list.scrollLeft).toBe(528);
        });

        test('an ancestor that cannot scroll is skipped', () => {
            const outer = document.createElement('div');
            outer.style.overflowY = 'auto';
            makeScrollable(outer);
            // Declares a scrolling overflow but has nothing to scroll.
            const inner = document.createElement('div');
            inner.style.overflowY = 'auto';
            inner.style.overflowX = 'auto';
            makeScrollable(inner, { vertical: false, horizontal: false });
            inner.appendChild(sourceElement);
            outer.appendChild(inner);
            document.body.appendChild(outer);
            elementAtPoint = targetElement;

            beginDragMidList();
            expect(scrollAfterFrame(outer, 150, 20)).toEqual([486, 500]);
            expect([inner.scrollTop, inner.scrollLeft]).toEqual([500, 500]);
        });

        test('an item can name its scroll container by selector', () => {
            const panel = document.createElement('div');
            panel.className = 'named-panel';
            // Only vertically scrollable: horizontal edges do nothing.
            makeScrollable(panel, { horizontal: false });
            document.body.appendChild(panel);
            sourceElement.dataset.scrollContainerSelector = '.named-panel';
            elementAtPoint = targetElement;

            beginDragMidList();
            expect(scrollAfterFrame(panel, 150, 395)).toEqual([514, 500]);
            expect(scrollAfterFrame(panel, 5, 200)).toEqual([500, 500]);
        });

        test('a selector that matches nothing falls back to the ancestors', () => {
            const list = document.createElement('div');
            list.style.overflowY = 'scroll';
            makeScrollable(list, { horizontal: false });
            list.appendChild(sourceElement);
            document.body.appendChild(list);
            sourceElement.dataset.scrollContainerSelector = '.not-there';
            elementAtPoint = targetElement;

            beginDragMidList();
            expect(scrollAfterFrame(list, 150, 10)).toEqual([486, 500]);
        });

        test('with no scrolling ancestor nothing scrolls', () => {
            const list = document.createElement('div');
            makeScrollable(list);
            list.appendChild(sourceElement);
            document.body.appendChild(list);
            elementAtPoint = targetElement;

            beginDragMidList();
            expect(scrollAfterFrame(list, 150, 10)).toEqual([500, 500]);
        });
    });
});
