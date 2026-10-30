// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The branches `presentingControlManagers.test.ts` leaves: the guards that make
// every setter and handler a no-op when nothing changes, a stroke cut short
// mid-drag, the pointer kinds that must not draw, and the 50-deep history.
const { settingStore } = vi.hoisted(() => ({
    settingStore: new Map<string, string>(),
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => settingStore.get(key) ?? null,
    setSetting: vi.fn((key: string, value: string) => {
        settingStore.set(key, value);
    }),
}));
vi.mock('../server/appProvider', () => ({
    default: {
        isPagePresenter: true,
        isPageScreen: false,
        systemUtils: { isDev: false, isWindows: true },
    },
}));

import { setSetting } from '../helper/settingHelpers';
import PresentingDrawManager from './PresentingDrawManager';

const BOX_WIDTH = 400;
const BOX_HEIGHT = 300;

function stubBox(element: HTMLElement, width = BOX_WIDTH, height = BOX_HEIGHT) {
    element.getBoundingClientRect = () =>
        ({
            left: 0,
            top: 0,
            right: width,
            bottom: height,
            width,
            height,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        }) as DOMRect;
    Object.defineProperty(element, 'offsetWidth', { value: width });
    Object.defineProperty(element, 'offsetHeight', { value: height });
}

function mountCanvas(manager: PresentingDrawManager, width?: number) {
    const canvas = document.createElement('canvas');
    document.body.append(canvas);
    stubBox(canvas, width, width === 0 ? 0 : BOX_HEIGHT);
    // jsdom has no 2D backend; the calls are all these tests need.
    const context = new Proxy({} as any, {
        get(target, property: string) {
            target[property] ??= vi.fn();
            return target[property];
        },
    });
    canvas.getContext = vi.fn(() => context) as any;
    manager.canvas = canvas;
    return canvas;
}

function pointer(type: string, x: number, y: number, button = 0) {
    return new MouseEvent(type, {
        clientX: x,
        clientY: y,
        button,
        bubbles: true,
    });
}

function drawStroke(canvas: HTMLElement, offset = 0) {
    canvas.dispatchEvent(pointer('pointerdown', 10 + offset, 10));
    globalThis.dispatchEvent(pointer('pointermove', 20 + offset, 20));
    globalThis.dispatchEvent(pointer('pointerup', 20 + offset, 20));
}

let manager: PresentingDrawManager;

beforeEach(() => {
    // No frame clock: `genFrameScheduler` then paints inline, which keeps
    // every assertion below synchronous.
    vi.stubGlobal('requestAnimationFrame', undefined);
    settingStore.clear();
    document.body.innerHTML = '';
    manager = new PresentingDrawManager();
});

afterEach(() => {
    manager.delete();
    vi.unstubAllGlobals();
});

describe('update listeners', () => {
    test('hear every committed change until they unsubscribe', () => {
        const canvas = mountCanvas(manager);
        const listener = vi.fn();
        const unsubscribe = manager.addUpdateListener(listener);

        manager.setIsArmed(true);
        expect(listener).toHaveBeenCalledTimes(1);
        drawStroke(canvas);
        // Down (a stroke appears) and up (it is committed).
        expect(listener).toHaveBeenCalledTimes(3);

        unsubscribe();
        manager.clear();
        expect(listener).toHaveBeenCalledTimes(3);
    });
});

describe('no-op guards', () => {
    test('re-assigning the same canvas does not re-attach or repaint', () => {
        const canvas = mountCanvas(manager);
        expect(canvas.getContext).toHaveBeenCalledTimes(1);
        manager.canvas = canvas;
        expect(canvas.getContext).toHaveBeenCalledTimes(1);
    });

    test('arming twice and keeping the quality are not changes', () => {
        const listener = vi.fn();
        manager.addUpdateListener(listener);
        manager.setIsArmed(false);
        manager.setRenderQuality(manager.isHighQuality);
        expect(listener).not.toHaveBeenCalled();
        expect(setSetting).not.toHaveBeenCalled();

        manager.setIsArmed(true);
        manager.setIsArmed(true);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    test('undo and redo with nothing to walk to do nothing', () => {
        const listener = vi.fn();
        manager.addUpdateListener(listener);
        expect(manager.canUndo).toBe(false);
        expect(manager.canRedo).toBe(false);
        manager.undo();
        manager.redo();
        expect(listener).not.toHaveBeenCalled();
        expect(manager.strokeList).toEqual([]);
    });
});

describe('pointers that must not draw', () => {
    test('a right-click over the armed overlay is the context menu, not a dot', () => {
        const canvas = mountCanvas(manager);
        manager.setIsArmed(true);
        canvas.dispatchEvent(pointer('pointerdown', 10, 10, 2));
        expect(manager.strokeList).toEqual([]);
    });

    test('a canvas that is not laid out yet maps no point', () => {
        const canvas = mountCanvas(manager, 0);
        manager.setIsArmed(true);
        canvas.dispatchEvent(pointer('pointerdown', 10, 10));
        expect(manager.strokeList).toEqual([]);
        expect(manager.isShowing).toBe(false);
    });
});

describe('a stroke cut short', () => {
    test('disarming mid-drag lets go of the window listeners', () => {
        const canvas = mountCanvas(manager);
        manager.setIsArmed(true);
        canvas.dispatchEvent(pointer('pointerdown', 10, 10));
        const [stroke] = manager.strokeList;

        manager.setIsArmed(false);
        globalThis.dispatchEvent(pointer('pointermove', 50, 50));
        globalThis.dispatchEvent(pointer('pointerup', 50, 50));

        // The move went nowhere and the release committed nothing.
        expect(stroke.points).toEqual([{ x: 10, y: 10 }]);
        expect(manager.canUndo).toBe(false);
    });

    test('a clear mid-drag drops the stroke the moves would have extended', () => {
        const canvas = mountCanvas(manager);
        manager.setIsArmed(true);
        canvas.dispatchEvent(pointer('pointerdown', 10, 10));
        const [stroke] = manager.strokeList;

        manager.clear();
        globalThis.dispatchEvent(pointer('pointermove', 30, 30));
        globalThis.dispatchEvent(pointer('pointerup', 30, 30));

        expect(stroke.points).toEqual([{ x: 10, y: 10 }]);
        expect(manager.strokeList).toEqual([]);
        // The clear's own snapshot is the only thing to undo back to.
        manager.undo();
        expect(manager.strokeList).toEqual([stroke]);
        expect(manager.canUndo).toBe(false);
    });

    test('a cancelled pointer ends the stroke like a release', () => {
        const canvas = mountCanvas(manager);
        manager.setIsArmed(true);
        canvas.dispatchEvent(pointer('pointerdown', 10, 10));
        globalThis.dispatchEvent(pointer('pointercancel', 10, 10));
        expect(manager.canUndo).toBe(true);
        // ...and the window stopped listening.
        globalThis.dispatchEvent(pointer('pointermove', 90, 90));
        expect(manager.strokeList[0].points).toHaveLength(1);
    });
});

describe('history', () => {
    test('keeps the last 50 steps and forgets the ones before', () => {
        const canvas = mountCanvas(manager);
        manager.setIsArmed(true);
        for (let index = 0; index < 55; index++) {
            drawStroke(canvas, index);
        }
        expect(manager.strokeList).toHaveLength(55);

        let undoCount = 0;
        while (manager.canUndo) {
            manager.undo();
            undoCount++;
        }
        expect(undoCount).toBe(50);
        // The oldest snapshot still held is the one after stroke 5.
        expect(manager.strokeList).toHaveLength(5);
    });

    test('a new stroke after an undo drops the redo tail', () => {
        const canvas = mountCanvas(manager);
        manager.setIsArmed(true);
        drawStroke(canvas, 0);
        drawStroke(canvas, 5);
        manager.undo();
        expect(manager.canRedo).toBe(true);

        drawStroke(canvas, 9);
        expect(manager.canRedo).toBe(false);
        expect(manager.strokeList).toHaveLength(2);
    });
});

describe('render quality', () => {
    test('a change is persisted and repaints at the new scale', () => {
        const canvas = mountCanvas(manager);
        manager.setIsArmed(true);
        drawStroke(canvas);
        expect(canvas.width).toBe(BOX_WIDTH * 2);

        manager.setRenderQuality(false);
        expect(setSetting).toHaveBeenCalledWith(
            'presenting-control-paint-quality',
            'false',
        );
        expect(canvas.width).toBe(BOX_WIDTH);
    });
});
