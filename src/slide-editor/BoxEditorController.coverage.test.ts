// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../server/appProvider', () => ({ default: { isPageScreen: false } }));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../helper/errorHelpers', () => ({ handleError: () => {} }));
vi.mock('../helper/loggerHelpers', () => ({
    appTrace: () => {},
    appWarning: () => {},
}));
vi.mock('../server/unlockingHelpers', () => ({
    unlocking: async (_key: string, callback: () => Promise<unknown>) =>
        callback(),
}));

import BoxEditorController, { type BoxMoveType } from './BoxEditorController';

let canvas: HTMLDivElement;
let controller: BoxEditorController;
let done: ReturnType<typeof vi.fn<(moves: BoxMoveType[]) => void>>;

function pointer(
    target: EventTarget,
    name: string,
    x = 0,
    y = 0,
    options: MouseEventInit = {},
) {
    const event = new MouseEvent(name, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        ...options,
    });
    target.dispatchEvent(event);
    return event;
}

// A box centred on (x, y): the editor anchor is positioned by its center,
// the inner target carries the size, the chrome frame mirrors it.
function addBox(id: number, x = 100, y = 100, width = 100, height = 80) {
    const editor = document.createElement('div');
    editor.className = 'editor-controller-box-wrapper controlling';
    editor.style.left = `${x}px`;
    editor.style.top = `${y}px`;
    editor.style.transform = 'rotate(0deg)';
    const target = document.createElement('div');
    target.dataset.appBoxEditorId = String(id);
    target.style.width = `${width}px`;
    target.style.height = `${height}px`;
    editor.appendChild(target);
    const chrome = document.createElement('div');
    chrome.className = 'editor-controller-box-chrome';
    const frame = document.createElement('div');
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
    chrome.appendChild(frame);
    for (const name of [...Object.keys(controller.resizeActorList), 'rotate']) {
        const handle = document.createElement('div');
        handle.className = name;
        frame.appendChild(handle);
    }
    Object.defineProperties(editor, {
        offsetLeft: { get: () => Number.parseFloat(editor.style.left) },
        offsetTop: { get: () => Number.parseFloat(editor.style.top) },
    });
    Object.defineProperties(target, {
        offsetWidth: { get: () => Number.parseFloat(target.style.width) },
        offsetHeight: { get: () => Number.parseFloat(target.style.height) },
    });
    canvas.append(editor, chrome);
    return { editor, target, chrome, frame };
}

function initBox(width = 100, height = 80) {
    const box = addBox(1, 100, 100, width, height);
    controller.initEvent(box.editor, box.chrome, done);
    vi.spyOn(controller, 'getCurrentRotation').mockReturnValue(0);
    return box;
}

function handleOf(box: ReturnType<typeof addBox>, name: string) {
    return box.chrome.querySelector(`.${name}`) as HTMLDivElement;
}

function geometry(box: ReturnType<typeof addBox>) {
    return {
        width: box.target.style.width,
        height: box.target.style.height,
        left: box.editor.style.left,
        top: box.editor.style.top,
    };
}

beforeEach(() => {
    canvas = document.createElement('div');
    document.body.appendChild(canvas);
    controller = new BoxEditorController(1);
    done = vi.fn();
});

afterEach(() => {
    pointer(window, 'pointercancel');
    controller.release();
    canvas.remove();
});

describe('an edge dragged past the minimum size', () => {
    // The 100x80 box is centred on (100, 100): its edges are at 50/150 and
    // 60/140, and the edge across from the handle stays where it is. Found
    // by UT-92 (2026-11-03): the shift was recomputed from the already-
    // clamped size, so it was always 0 and the centre jumped back to 100 --
    // 30px for the last 2px of the drag.
    test.each([
        ['left-mid', 61, 0, '40px', '80px', '130px', '100px'],
        ['right-mid', -61, 0, '40px', '80px', '70px', '100px'],
        ['top-mid', 0, 41, '100px', '40px', '100px', '120px'],
        ['bottom-mid', 0, -41, '100px', '40px', '100px', '80px'],
    ])(
        'the %s handle stops the box at 40px, its far edge in place',
        (handle, dx, dy, width, height, left, top) => {
            const box = initBox();
            pointer(handleOf(box, handle), 'pointerdown');
            pointer(window, 'pointermove', dx, dy);
            expect(box.target.style.width).toBe(width);
            expect(box.target.style.height).toBe(height);
            expect(box.editor.style.left).toBe(left);
            expect(box.editor.style.top).toBe(top);
            expect(box.frame.style.width).toBe(width);
            expect(box.frame.style.height).toBe(height);
            expect(document.body.textContent).toContain(
                `w: ${Number.parseInt(width)}, h: ${Number.parseInt(height)}`,
            );
            pointer(window, 'pointerup');
            expect(done).toHaveBeenCalledExactlyOnceWith([]);
        },
    );
});

describe('an aspect-locked corner dragged past the minimum size', () => {
    test('a wide box keeps its ratio at the minimum height and its far corner in place', () => {
        // 100x80 centred on (100, 100): its right-bottom corner is at
        // (150, 140), and so is the 50x40 box's centred on (125, 120).
        const box = initBox(100, 80);
        controller.lockAspectRatio = true;
        pointer(handleOf(box, 'left-top'), 'pointerdown');
        pointer(window, 'pointermove', 100, 100);
        expect(geometry(box)).toEqual({
            width: '50px',
            height: '40px',
            left: '125px',
            top: '120px',
        });
    });

    test('a tall box keeps its ratio at the minimum width and its far corner in place', () => {
        // 80x100: right-bottom corner at (140, 150), as is the 40x50
        // box's centred on (120, 125).
        const box = initBox(80, 100);
        controller.lockAspectRatio = true;
        pointer(handleOf(box, 'left-top'), 'pointerdown');
        pointer(window, 'pointermove', 100, 100);
        expect(geometry(box)).toEqual({
            width: '40px',
            height: '50px',
            left: '120px',
            top: '125px',
        });
    });

    test('Ctrl keeps the center while the locked corner scales both axes', () => {
        const box = initBox(100, 80);
        controller.lockAspectRatio = true;
        pointer(handleOf(box, 'right-bottom'), 'pointerdown');
        pointer(window, 'pointermove', 10, 10, { ctrlKey: true });
        // both edges move: 100+20 wide, 80+20 high; the height changed
        // more, so the width follows it at 5:4
        expect(geometry(box)).toEqual({
            width: '125px',
            height: '100px',
            left: '100px',
            top: '100px',
        });
        pointer(window, 'pointermove', 10, 10, { metaKey: true });
        expect(geometry(box)).toEqual({
            width: '125px',
            height: '100px',
            left: '100px',
            top: '100px',
        });
    });
});

describe('a rotated box read from its computed style', () => {
    test('a 90° box widens along the screen y axis when its right edge is dragged down', () => {
        const box = addBox(1);
        box.editor.style.transform = 'matrix(0, 1, -1, 0, 0, 0)';
        controller.initEvent(box.editor, box.chrome, done);
        expect(controller.getCurrentRotation(box.editor)).toBe(90);
        pointer(handleOf(box, 'right-mid'), 'pointerdown');
        pointer(window, 'pointermove', 0, 30);
        expect(geometry(box)).toEqual({
            width: '130px',
            height: '80px',
            left: '100px',
            top: '115px',
        });
        pointer(window, 'pointerup');
        expect(done).toHaveBeenCalledExactlyOnceWith([]);
    });
});

describe('a box released in the middle of a drag', () => {
    test('letting go of the button afterwards commits nothing', () => {
        const box = initBox();
        const follower = addBox(2, 250, 200, 60, 40);
        controller.getMoveGroupIds = () => [1, 2];
        pointer(box.target, 'pointerdown', 10, 10);
        pointer(window, 'pointermove', 20, 20);
        expect(follower.editor.style.left).toBe('260px');
        expect(document.body.textContent).toContain('x:');
        controller.release();
        expect(document.body.textContent).not.toContain('x:');
        // Found by UT-92 (2026-11-03): the drag's window listeners outlived
        // `release()` -- the pointerup returned before removing them -- so
        // the follower kept moving with the pointer, the badge came back,
        // and once a box was attached again a stray pointerup committed the
        // old drag through ITS callback.
        pointer(window, 'pointermove', 60, 60);
        expect(follower.editor.style.left).toBe('260px');
        expect(document.body.textContent).not.toContain('x:');
        pointer(window, 'pointerup', 20, 20);
        expect(done).not.toHaveBeenCalled();
        expect(controller.getInfo()).toBe(null);
        const doneAgain = vi.fn();
        controller.initEvent(box.editor, box.chrome, doneAgain);
        pointer(window, 'pointermove', 80, 80);
        pointer(window, 'pointerup', 80, 80);
        expect(follower.editor.style.left).toBe('260px');
        expect(doneAgain).not.toHaveBeenCalled();
        expect(document.body.textContent).not.toContain('x:');
    });

    test('a resize or a rotation is ended by the release too', () => {
        const box = initBox();
        pointer(handleOf(box, 'right-mid'), 'pointerdown');
        pointer(window, 'pointermove', 10, 0);
        expect(box.target.style.width).toBe('110px');
        controller.release();
        expect(document.body.textContent).not.toContain('w:');
        const doneAgain = vi.fn();
        controller.initEvent(box.editor, box.chrome, doneAgain);
        pointer(window, 'pointermove', 30, 0);
        pointer(window, 'pointerup', 30, 0);
        expect(box.target.style.width).toBe('110px');
        expect(doneAgain).not.toHaveBeenCalled();

        pointer(handleOf(box, 'rotate'), 'pointerdown');
        controller.release();
        controller.initEvent(box.editor, box.chrome, doneAgain);
        pointer(window, 'pointermove', 300, 100);
        pointer(window, 'pointerup', 300, 100);
        expect(box.editor.style.transform).toBe('rotate(0deg)');
        expect(doneAgain).not.toHaveBeenCalled();
    });

    test('a new drag ends one still listening', () => {
        // A pointerdown with no pointerup between (a lost pointer, a second
        // finger) used to stack a second set of window listeners.
        const box = initBox();
        pointer(handleOf(box, 'right-mid'), 'pointerdown');
        pointer(handleOf(box, 'bottom-mid'), 'pointerdown');
        pointer(window, 'pointermove', 10, 10);
        expect(geometry(box)).toMatchObject({ width: '100px', height: '90px' });
        pointer(window, 'pointerup');
        expect(done).toHaveBeenCalledExactlyOnceWith([]);
    });
});

describe('a controller with no box attached', () => {
    test('commits nothing, moves nothing and starts no drag', () => {
        const fresh = new BoxEditorController(1);
        expect(fresh.onDone([])).toBeUndefined();
        expect(fresh.getInfo()).toBe(null);
        const addListener = vi.spyOn(globalThis, 'addEventListener');
        fresh.repositionElement(10, 20);
        fresh.resizeBox(30, 40);
        fresh.rotateBox(45);
        fresh.unRotateBox();
        const rotateEvent = new MouseEvent('pointerdown', {
            cancelable: true,
        });
        fresh.rotateHandler(rotateEvent as PointerEvent);
        const resizeEvent = new MouseEvent('pointerdown', {
            cancelable: true,
        });
        fresh.resizeHandler(resizeEvent as PointerEvent, {
            left: false,
            top: false,
            xResize: true,
            yResize: true,
        });
        expect(rotateEvent.defaultPrevented).toBe(false);
        expect(resizeEvent.defaultPrevented).toBe(false);
        expect(addListener).not.toHaveBeenCalled();
        expect(document.body.textContent).toBe('');
    });
});

describe('move snapping by the far edges', () => {
    test('the right edge and the top edge snap the box center to their lines', () => {
        const onSnapping = vi.fn();
        controller.onSnapping = onSnapping;
        // right edge at 305 is 5px from 300, top edge at 55 is 5px from 50
        expect(
            controller.applyMoveSnapping(
                { vertical: [300], horizontal: [50] },
                255,
                95,
                100,
                80,
            ),
        ).toEqual({ x: 250, y: 90 });
        expect(onSnapping).toHaveBeenCalledExactlyOnceWith({
            vertical: [300],
            horizontal: [50],
        });
        // the same lines again are not re-emitted
        controller.applyMoveSnapping(
            { vertical: [300], horizontal: [50] },
            256,
            94,
            100,
            80,
        );
        expect(onSnapping).toHaveBeenCalledOnce();
    });
});
