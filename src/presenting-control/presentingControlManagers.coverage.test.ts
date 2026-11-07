// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The engines' early returns and edges, beside the lifecycle and stroke-model
// tests in `presentingControlManagers.test.ts`.
const { state, mocks } = vi.hoisted(() => ({
    state: { settings: new Map<string, string>() },
    mocks: { getSetting: vi.fn(), setSetting: vi.fn() },
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: mocks.getSetting,
    setSetting: mocks.setSetting,
}));
vi.mock('../server/appProvider', () => ({
    default: {
        isPagePresenter: true,
        isPageScreen: false,
        systemUtils: { isDev: false, isWindows: true },
    },
}));

import PresentingDrawManager from './PresentingDrawManager';
import PresentingFocusManager from './PresentingFocusManager';
import {
    checkIsArmedTool,
    checkIsDrawingTool,
    presentingToolList,
    readPersistedBoolean,
    readPersistedNumber,
    toValidHexColor,
} from './presentingControlHelpers';

const WIDTH = 400;
const HEIGHT = 300;
const mountedElements: HTMLElement[] = [];

beforeEach(() => {
    state.settings.clear();
    mocks.getSetting.mockImplementation((key: string) => {
        return state.settings.get(key) ?? null;
    });
    mocks.setSetting.mockImplementation((key: string, value: string) => {
        state.settings.set(key, value);
    });
});

afterEach(() => {
    for (const element of mountedElements.splice(0)) {
        element.remove();
    }
});

function genRect(width: number, height: number) {
    return {
        left: 0,
        top: 0,
        right: width,
        bottom: height,
        width,
        height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
    } as DOMRect;
}

// jsdom lays nothing out; a zero box is what the engines treat as "not ready".
function mount<T extends HTMLElement>(element: T, isLaidOut = true) {
    document.body.appendChild(element);
    mountedElements.push(element);
    if (isLaidOut) {
        element.getBoundingClientRect = () => {
            return genRect(WIDTH, HEIGHT);
        };
        Object.defineProperty(element, 'offsetWidth', { value: WIDTH });
        Object.defineProperty(element, 'offsetHeight', { value: HEIGHT });
    }
    return element;
}

function mountCanvas(manager: PresentingDrawManager, isLaidOut = true) {
    const canvas = mount(document.createElement('canvas'), isLaidOut);
    // No canvas backend in jsdom; the engine only needs something to call.
    const context = new Proxy({} as Record<string | symbol, unknown>, {
        get(target, property) {
            if (!(property in target)) {
                target[property] = () => {};
            }
            return target[property];
        },
    });
    canvas.getContext = vi.fn(() => context) as any;
    manager.canvas = canvas;
    return canvas;
}

function pointer(type: string, clientX: number, clientY: number, button = 0) {
    return new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        button,
    });
}

function stroke(canvas: HTMLElement, points: [number, number][]) {
    canvas.dispatchEvent(pointer('pointerdown', ...points[0]));
    for (const point of points.slice(1)) {
        globalThis.dispatchEvent(pointer('pointermove', ...point));
    }
    globalThis.dispatchEvent(pointer('pointerup', ...points.at(-1)!));
}

describe('presentingControlHelpers', () => {
    test('only the brush and the eraser draw; every tool but interact arms', () => {
        expect(presentingToolList.filter(checkIsDrawingTool)).toEqual([
            'paint',
            'eraser',
        ]);
        expect(presentingToolList.filter(checkIsArmedTool)).toEqual([
            'paint',
            'eraser',
            'focus',
        ]);
    });

    test('persisted values are validated before an engine trusts them', () => {
        expect(toValidHexColor('#ABCDEF', '#000000')).toBe('#abcdef');
        expect(toValidHexColor('#abc', '#000000')).toBe('#000000');
        expect(toValidHexColor(42, '#111111')).toBe('#111111');

        state.settings.set('presenting-control-paint-size', '999');
        expect(readPersistedNumber('paint-size', 10, 1, 60)).toBe(60);
        state.settings.set('presenting-control-paint-size', '-4');
        expect(readPersistedNumber('paint-size', 10, 1, 60)).toBe(1);

        // An empty value is "never set", not `false`.
        state.settings.set('presenting-control-paint-dots', '');
        expect(readPersistedBoolean('paint-dots', true)).toBe(true);
        state.settings.set('presenting-control-paint-dots', 'false');
        expect(readPersistedBoolean('paint-dots', true)).toBe(false);
    });
});

describe('PresentingDrawManager edges', () => {
    test('update listeners hear changes until they unsubscribe', () => {
        const manager = new PresentingDrawManager();
        const listener = vi.fn();
        const unsubscribe = manager.addUpdateListener(listener);

        manager.clear();
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        manager.clear();
        expect(listener).toHaveBeenCalledTimes(1);
    });

    test('nothing that is already so is done again', () => {
        const manager = new PresentingDrawManager();
        const canvas = mountCanvas(manager);
        const listener = vi.fn();
        manager.addUpdateListener(listener);

        // The same canvas handed back is not re-attached.
        manager.canvas = canvas;
        expect(canvas.getContext).toHaveBeenCalledTimes(1);

        manager.setIsArmed(false);
        expect(listener).not.toHaveBeenCalled();
        manager.setIsArmed(true);
        manager.setIsArmed(true);
        expect(listener).toHaveBeenCalledTimes(1);

        // Quality is already high: no write, no update.
        manager.setRenderQuality(true);
        expect(mocks.setSetting).not.toHaveBeenCalled();
        expect(listener).toHaveBeenCalledTimes(1);

        // Undo with nothing behind it and redo with nothing ahead are no-ops.
        manager.undo();
        manager.redo();
        expect(listener).toHaveBeenCalledTimes(1);
    });

    test('disarming mid-stroke lets go of the pointer at once', () => {
        const manager = new PresentingDrawManager();
        const canvas = mountCanvas(manager);
        const listener = vi.fn();
        manager.addUpdateListener(listener);
        manager.setIsArmed(true);
        canvas.dispatchEvent(pointer('pointerdown', 10, 10));
        expect(manager.strokeList).toHaveLength(1);
        listener.mockClear();

        manager.setIsArmed(false);
        expect(listener).toHaveBeenCalledTimes(1);
        globalThis.dispatchEvent(pointer('pointermove', 50, 50));
        globalThis.dispatchEvent(pointer('pointerup', 50, 50));

        // The window listeners went with the arm: the stroke stopped growing
        // and the release reached nothing.
        expect(manager.strokeList[0].points).toEqual([{ x: 10, y: 10 }]);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    test('a press that cannot be mapped, or is not the primary button, draws nothing', () => {
        const manager = new PresentingDrawManager();
        const unlaidCanvas = mountCanvas(manager, false);
        manager.setIsArmed(true);
        const unmapped = pointer('pointerdown', 10, 10);
        unlaidCanvas.dispatchEvent(unmapped);
        expect(manager.strokeList).toHaveLength(0);
        expect(unmapped.defaultPrevented).toBe(false);

        const canvas = mountCanvas(manager);
        const rightClick = pointer('pointerdown', 10, 10, 2);
        canvas.dispatchEvent(rightClick);
        // The app's context menu, not a dot.
        expect(rightClick.defaultPrevented).toBe(false);
        expect(manager.strokeList).toHaveLength(0);
    });

    test('a clear mid-stroke ends that stroke without committing it', () => {
        const manager = new PresentingDrawManager();
        const canvas = mountCanvas(manager);
        const listener = vi.fn();
        manager.addUpdateListener(listener);
        manager.setIsArmed(true);
        canvas.dispatchEvent(pointer('pointerdown', 10, 10));
        listener.mockClear();

        manager.clear();
        globalThis.dispatchEvent(pointer('pointermove', 40, 40));
        globalThis.dispatchEvent(pointer('pointerup', 40, 40));

        expect(manager.strokeList).toEqual([]);
        // The clear told the toolbar; the release had nothing left to commit.
        expect(listener).toHaveBeenCalledTimes(1);
        expect(manager.canRedo).toBe(false);
    });

    test('a second pointer over a box that collapsed does not move the first stroke', () => {
        const manager = new PresentingDrawManager();
        const canvas = mountCanvas(manager);
        manager.setIsArmed(true);
        canvas.dispatchEvent(pointer('pointerdown', 10, 10));

        // The box is gone (window minimised mid-press) when another pointer
        // lands: it is refused, and the first stroke's moves stop mapping.
        canvas.getBoundingClientRect = () => {
            return genRect(0, 0);
        };
        canvas.dispatchEvent(pointer('pointerdown', 20, 20));
        globalThis.dispatchEvent(pointer('pointermove', 30, 30));
        globalThis.dispatchEvent(pointer('pointerup', 30, 30));

        expect(manager.strokeList).toHaveLength(1);
        expect(manager.strokeList[0].points).toEqual([{ x: 10, y: 10 }]);
    });

    test('the undo history keeps the last 50 steps', () => {
        const manager = new PresentingDrawManager();
        const canvas = mountCanvas(manager);
        manager.setIsArmed(true);
        for (let index = 0; index < 52; index++) {
            stroke(canvas, [
                [index, index],
                [index + 5, index + 5],
            ]);
        }
        expect(manager.strokeList).toHaveLength(52);

        let undoCount = 0;
        while (manager.canUndo) {
            manager.undo();
            undoCount++;
        }

        expect(undoCount).toBe(50);
        // The two oldest states fell off the front of the history.
        expect(manager.strokeList).toHaveLength(2);
    });
});

describe('PresentingFocusManager edges', () => {
    test('nothing that is already so is done again', () => {
        const manager = new PresentingFocusManager();
        const listener = vi.fn();
        manager.addUpdateListener(listener);
        const div = mount(document.createElement('div'));
        manager.div = div;
        expect(div.style.background).toBe('none');

        // The same element handed back is not re-attached or repainted.
        div.style.background = 'red';
        manager.div = div;
        expect(div.style.background).toBe('red');

        manager.setIsArmed(false);
        expect(listener).not.toHaveBeenCalled();
        manager.setIsArmed(true);
        manager.setIsArmed(true);
        expect(listener).toHaveBeenCalledTimes(1);

        // Every setter compares the CLEAN value against what is there.
        manager.setSize(260);
        manager.setDimOpacity(65);
        manager.setEdgeBlur(35);
        manager.setIsContrast(false);
        manager.setIsHoldMode(false);
        expect(listener).toHaveBeenCalledTimes(1);
        manager.setSize(5000);
        manager.setSize(9999);
        expect(manager.size).toBe(1200);
        manager.setDimOpacity(500);
        manager.setDimOpacity(101);
        manager.setEdgeBlur(-3);
        manager.setEdgeBlur(-90);
        expect([manager.dimOpacity, manager.edgeBlur]).toEqual([100, 0]);
        expect(listener).toHaveBeenCalledTimes(4);

        // Teardown flushes the trailing write now, so no timer outlives it.
        manager.delete();
        expect(state.settings.get('presenting-control-focus-size')).toBe(
            '1200',
        );
        expect(state.settings.get('presenting-control-focus-blur')).toBe('0');
    });

    test('presses that are not for it leave the app undimmed', () => {
        const manager = new PresentingFocusManager();
        const div = mount(document.createElement('div'));
        manager.div = div;

        // Not armed: a press is the app's.
        const unarmed = pointer('pointerdown', 50, 50);
        div.dispatchEvent(unarmed);
        expect(manager.isSpotlighting).toBe(false);
        expect(unarmed.defaultPrevented).toBe(false);

        manager.setIsArmed(true);
        const rightClick = pointer('pointerdown', 50, 50, 2);
        div.dispatchEvent(rightClick);
        expect(manager.isSpotlighting).toBe(false);
        expect(rightClick.defaultPrevented).toBe(false);
    });

    test('an overlay that is not laid out yet maps no pointer at all', () => {
        const manager = new PresentingFocusManager();
        const div = mount(document.createElement('div'), false);
        manager.div = div;
        manager.setIsArmed(true);

        div.dispatchEvent(pointer('pointermove', 50, 50));
        const press = pointer('pointerdown', 50, 50);
        div.dispatchEvent(press);

        expect(manager.isSpotlighting).toBe(false);
        expect(manager.point).toBeNull();
        expect(press.defaultPrevented).toBe(false);
        expect(div.style.background).toBe('none');
    });

    test('moving the pointer while lit repaints without re-rendering the panel', () => {
        const manager = new PresentingFocusManager();
        const div = mount(document.createElement('div'));
        manager.div = div;
        manager.setIsArmed(true);
        const listener = vi.fn();
        manager.addUpdateListener(listener);

        div.dispatchEvent(pointer('pointerdown', 50, 50));
        div.dispatchEvent(pointer('pointerdown', 60, 60));
        div.dispatchEvent(pointer('pointermove', 70, 70));
        div.dispatchEvent(pointer('pointermove', 80, 80));

        expect(manager.point).toEqual({ x: 80, y: 80 });
        // Only the off-to-on transition is worth a panel render.
        expect(listener).toHaveBeenCalledTimes(1);
    });
});
