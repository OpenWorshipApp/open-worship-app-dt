// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../server/appProvider', () => ({ default: { isPageScreen: false } }));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../helper/loggerHelpers', () => ({
    appTrace: vi.fn(),
    appWarning: vi.fn(),
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
    vi.spyOn(target, 'getBoundingClientRect').mockImplementation(
        () => new DOMRect(x - width / 2, y - height / 2, width, height),
    );
    canvas.append(editor, chrome);
    return { editor, target, chrome, frame };
}

function init(scale = 1) {
    controller.scaleFactor = scale;
    const box = addBox(1);
    controller.initEvent(box.editor, box.chrome, done);
    vi.spyOn(controller, 'getCurrentRotation').mockReturnValue(0);
    return box;
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

describe('box pointer lifecycle', () => {
    test('a click selects, while a scaled drag commits its top-left position and matching chrome', () => {
        const box = init(2);
        const clicked = vi.fn();
        controller.onClick = clicked;
        pointer(box.target, 'pointerdown', 20, 30);
        pointer(window, 'pointerup', 20, 30);
        expect(clicked).toHaveBeenCalledOnce();
        expect(done).not.toHaveBeenCalled();
        pointer(box.target, 'pointerdown', 20, 30);
        pointer(window, 'pointermove', 60, 90);
        expect(controller.getInfo()).toEqual({
            left: 70,
            top: 90,
            width: 100,
            height: 80,
            rotate: 0,
        });
        expect(box.chrome.style.left).toBe('120px');
        expect(box.chrome.style.top).toBe('130px');
        expect(document.body.textContent).toContain('x: 70, y: 90');
        pointer(window, 'pointerup');
        expect(done).toHaveBeenCalledWith([]);
        expect(document.body.textContent).not.toContain('x:');
        pointer(window, 'pointermove', 500, 500);
        expect(box.editor.style.left).toBe('120px');
    });

    test('moves selected unlocked boxes together, snapshots snap targets once and commits followers', () => {
        const box = init();
        const follower = addBox(2, 250, 200, 60, 40);
        const locked = addBox(3, 300, 300);
        locked.editor.classList.remove('controlling');
        controller.getMoveGroupIds = () => [2, 1, 3, 99];
        const targets = vi.fn(() => ({ vertical: [125], horizontal: [130] }));
        controller.getSnapTargets = targets;
        const snap = vi.fn();
        controller.onSnapping = snap;
        pointer(box.target, 'pointerdown', 10, 10);
        pointer(window, 'pointermove', 32, 38);
        pointer(window, 'pointermove', 33, 39);
        expect(targets).toHaveBeenCalledExactlyOnceWith([2, 1, 3, 99]);
        expect(snap).toHaveBeenCalledTimes(1);
        expect(follower.editor.style.left).toBe('275px');
        expect(follower.chrome.style.top).toBe('230px');
        expect(locked.editor.style.left).toBe('300px');
        pointer(window, 'pointerup');
        expect(done).toHaveBeenCalledExactlyOnceWith([
            { id: 2, left: 245, top: 210 },
        ]);
        expect(snap).toHaveBeenLastCalledWith({ vertical: [], horizontal: [] });
    });

    test('adds an unlisted leader to exclusions and tolerates a missing follower chrome', () => {
        const box = init();
        const follower = addBox(2, 200, 200);
        follower.chrome.remove();
        controller.getMoveGroupIds = () => [2];
        const targets = vi.fn(() => ({ vertical: [], horizontal: [] }));
        controller.getSnapTargets = targets;
        pointer(box.target, 'pointerdown');
        pointer(window, 'pointermove', 10, 20);
        pointer(window, 'pointercancel');
        expect(targets).toHaveBeenCalledWith([2, 1]);
        expect(done).toHaveBeenCalledWith([{ id: 2, left: 160, top: 180 }]);
    });

    test('ignores right clicks and dot handles', () => {
        const box = init();
        pointer(box.target, 'pointerdown', 0, 0, { button: 2 });
        pointer(window, 'pointermove', 40, 40);
        pointer(window, 'pointerup');
        expect(done).not.toHaveBeenCalled();
        box.target.className = 'dot';
        pointer(box.target, 'pointerdown');
        pointer(window, 'pointermove', 40, 40);
        pointer(window, 'pointerup');
        expect(done).not.toHaveBeenCalled();
        expect(box.editor.style.left).toBe('100px');
    });

    test('reinitialization detaches the old controls and release removes every pointerdown listener', () => {
        const old = init();
        const replacement = addBox(2);
        controller.initEvent(replacement.editor, replacement.chrome, done);
        pointer(old.target, 'pointerdown');
        pointer(window, 'pointermove', 20, 20);
        pointer(window, 'pointerup');
        expect(done).not.toHaveBeenCalled();
        expect(controller.listened).toHaveLength(10);
        controller.showDragInfo(new MouseEvent('mousemove'), 'badge');
        controller.release();
        expect(controller.listened).toEqual([]);
        expect(controller.getInfo()).toBeNull();
        expect(document.body.textContent).not.toContain('badge');
        pointer(replacement.target, 'pointerdown');
        pointer(window, 'pointerup');
        expect(done).not.toHaveBeenCalled();
    });

    test('captures the pointer when supported and tolerates a capture failure', () => {
        const box = init();
        const capture = vi.fn();
        Object.defineProperty(box.target, 'setPointerCapture', {
            value: capture,
            configurable: true,
        });
        pointer(box.target, 'pointerdown');
        pointer(window, 'pointerup');
        expect(capture).toHaveBeenCalledOnce();
        capture.mockImplementation(() => {
            throw new Error('released');
        });
        expect(() => pointer(box.target, 'pointerdown')).not.toThrow();
        pointer(window, 'pointerup');
    });
});

describe('resize and rotation', () => {
    test.each([
        ['right-mid', 20, 0, 120, 80, 110, 100],
        ['left-mid', -20, 0, 120, 80, 90, 100],
        ['bottom-mid', 0, 20, 100, 100, 100, 110],
        ['top-mid', 0, -20, 100, 100, 100, 90],
        ['right-bottom', 20, 20, 120, 100, 110, 110],
        ['left-top', -20, -20, 120, 100, 90, 90],
    ])(
        '%s keeps the opposite edge anchored',
        (handle, dx, dy, width, height, x, y) => {
            const box = init();
            pointer(box.chrome.querySelector(`.${handle}`)!, 'pointerdown');
            pointer(window, 'pointermove', dx, dy);
            expect(box.target.style.width).toBe(`${width}px`);
            expect(box.frame.style.height).toBe(`${height}px`);
            expect(box.editor.style.left).toBe(`${x}px`);
            expect(box.chrome.style.top).toBe(`${y}px`);
            expect(document.body.textContent).toContain(
                `w: ${width}, h: ${height}`,
            );
            pointer(window, 'pointerup');
            expect(done).toHaveBeenCalledWith([]);
        },
    );

    test.each(['ctrlKey', 'metaKey'] as const)(
        '%s resizes symmetrically around the center',
        (modifier) => {
            const box = init();
            pointer(box.chrome.querySelector('.right-bottom')!, 'pointerdown');
            pointer(window, 'pointermove', 20, 10, { [modifier]: true });
            expect(controller.getInfo()).toMatchObject({
                left: 30,
                top: 50,
                width: 140,
                height: 100,
            });
            expect(box.editor.style.left).toBe('100px');
            expect(box.editor.style.top).toBe('100px');
        },
    );

    test.each(['left-top', 'right-bottom'])(
        'center anchoring clamps minimum dimensions for %s',
        (handle) => {
            const box = init();
            const direction = handle === 'left-top' ? 1 : -1;
            pointer(box.chrome.querySelector(`.${handle}`)!, 'pointerdown');
            pointer(window, 'pointermove', direction * 100, direction * 100, {
                ctrlKey: true,
            });
            expect(box.target.style.width).toBe('40px');
            expect(box.target.style.height).toBe('40px');
            expect(box.editor.style.left).toBe('100px');
            expect(box.editor.style.top).toBe('100px');
        },
    );

    test.each([
        ['right-mid', 25, 0, 125, 100],
        ['bottom-mid', 0, 20, 125, 100],
        ['right-bottom', 25, 5, 125, 100],
        ['right-bottom', 5, 40, 150, 120],
    ])('aspect ratio stays 5:4 with %s', (handle, dx, dy, width, height) => {
        const box = init();
        controller.lockAspectRatio = true;
        pointer(box.chrome.querySelector(`.${handle}`)!, 'pointerdown');
        pointer(window, 'pointermove', dx, dy);
        expect(box.target.style.width).toBe(`${width}px`);
        expect(box.target.style.height).toBe(`${height}px`);
    });

    test('a rotated corner resize preserves the ratio and the opposite corner', () => {
        const box = init();
        controller.lockAspectRatio = true;
        vi.mocked(controller.getCurrentRotation).mockReturnValue(90);
        pointer(box.chrome.querySelector('.right-bottom')!, 'pointerdown');
        pointer(window, 'pointermove', -20, 25);
        expect(box.target.style.width).toBe('125px');
        expect(box.target.style.height).toBe('100px');
        expect(Number.parseFloat(box.editor.style.left)).toBeCloseTo(90);
        expect(Number.parseFloat(box.editor.style.top)).toBeCloseTo(112.5);
    });

    test('rotation updates the box and chrome, and stops on pointer cancellation', () => {
        const box = init();
        pointer(box.chrome.querySelector('.rotate')!, 'pointerdown');
        pointer(window, 'pointermove', 200, 100);
        expect(box.editor.style.transform).toBe('rotate(90deg)');
        expect(box.chrome.style.transform).toBe('rotate(90deg)');
        expect(controller.getInfo()?.rotate).toBe(90);
        expect(document.body.textContent).toContain('90°');
        pointer(window, 'pointercancel');
        expect(done).toHaveBeenCalledWith([]);
        controller.unRotateBox();
        expect(box.chrome.style.transform).toBe('rotate(0deg)');
        pointer(window, 'pointermove', 300, 300);
        expect(box.editor.style.transform).toBe('rotate(0deg)');
    });

    test.each([
        ['none', 0],
        ['matrix(0.7071, 0.7071, -0.7071, 0.7071, 0, 0)', 45],
        ['matrix(0.7071, -0.7071, 0.7071, 0.7071, 0, 0)', 315],
    ])('reads fractional rotation matrices: %s', (transform, angle) => {
        const style = document.createElement('div').style;
        style.transform = transform;
        expect(controller.rotationFromStyle(style)).toBe(angle);
    });
});

describe('snapping', () => {
    test('snaps the nearest box edge or center within a screen-scaled threshold', () => {
        controller.scaleFactor = 2;
        expect(
            controller.applyMoveSnapping(
                { vertical: [50], horizontal: [140] },
                102,
                103,
                100,
                80,
            ),
        ).toEqual({ x: 100, y: 100 });
        expect(
            controller.applyMoveSnapping(
                { vertical: [100], horizontal: [100] },
                110,
                110,
                100,
                80,
            ),
        ).toEqual({ x: 110, y: 110 });
        expect(controller.applyMoveSnapping(null, 5, 6, 100, 80)).toEqual({
            x: 5,
            y: 6,
        });
    });

    test.each([
        [false, false, 105, 105, 110, 90],
        [true, true, 95, 95, 110, 90],
    ])(
        'snaps only the dragged resize edges (left=%s, top=%s)',
        (left, top, x, y, width, height) => {
            controller.snapThresholdScreenPx = 12;
            expect(
                controller.applyResizeSnapping(
                    {
                        vertical: [left ? 40 : 160],
                        horizontal: [top ? 50 : 150],
                    },
                    100,
                    100,
                    100,
                    80,
                    { left, top, xResize: true, yResize: true, rotate: 0 },
                ),
            ).toEqual({ newX: x, newY: y, newW: width, newH: height });
        },
    );

    test('rotated resizes bypass snapping', () => {
        expect(
            controller.applyResizeSnapping(
                { vertical: [150], horizontal: [140] },
                100,
                100,
                100,
                80,
                {
                    left: false,
                    top: false,
                    xResize: true,
                    yResize: true,
                    rotate: 45,
                },
            ),
        ).toEqual({ newX: 100, newY: 100, newW: 100, newH: 80 });
    });
});
