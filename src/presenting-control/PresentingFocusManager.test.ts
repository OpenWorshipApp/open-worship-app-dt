// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The branches `presentingControlManagers.test.ts` leaves: every setter's
// "nothing changed" guard (each one is a repaint, a panel re-render and a
// debounced disk write saved), and the pointer cases that must not spotlight.
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
import PresentingFocusManager from './PresentingFocusManager';
import { DEFAULT_FOCUS_PARAMS } from './presentingControlHelpers';

function mountMask(manager: PresentingFocusManager, size = 400) {
    const div = document.createElement('div');
    document.body.append(div);
    div.getBoundingClientRect = () =>
        ({
            left: 0,
            top: 0,
            right: size,
            bottom: size,
            width: size,
            height: size,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        }) as DOMRect;
    manager.div = div;
    return div;
}

function pointer(type: string, x: number, y: number, button = 0) {
    return new MouseEvent(type, {
        clientX: x,
        clientY: y,
        button,
        bubbles: true,
    });
}

let manager: PresentingFocusManager;

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', undefined);
    settingStore.clear();
    document.body.innerHTML = '';
    manager = new PresentingFocusManager();
});

afterEach(() => {
    manager.delete();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('no-op guards', () => {
    test('handing back the same element neither re-listens nor repaints', () => {
        const div = mountMask(manager);
        const addListener = vi.spyOn(div, 'addEventListener');
        div.style.background = 'red';
        manager.div = div;
        expect(addListener).not.toHaveBeenCalled();
        // A real re-assignment would have painted `none` over this.
        expect(div.style.background).toBe('red');
    });

    test('a setter given the value it already holds changes nothing', async () => {
        mountMask(manager);
        const listener = vi.fn();
        manager.addUpdateListener(listener);

        manager.setIsArmed(false);
        manager.setSize(DEFAULT_FOCUS_PARAMS.size);
        manager.setDimOpacity(DEFAULT_FOCUS_PARAMS.dimOpacity);
        manager.setEdgeBlur(DEFAULT_FOCUS_PARAMS.edgeBlur);
        manager.setIsContrast(DEFAULT_FOCUS_PARAMS.isContrast);
        manager.setIsHoldMode(DEFAULT_FOCUS_PARAMS.isHoldMode);
        manager.stop();
        await vi.advanceTimersByTimeAsync(500);

        expect(listener).not.toHaveBeenCalled();
        expect(setSetting).not.toHaveBeenCalled();
    });

    test('a value clamped onto the current one is not a change either', () => {
        const listener = vi.fn();
        manager.addUpdateListener(listener);
        manager.setSize(5000);
        expect(manager.size).toBe(1200);
        listener.mockClear();

        manager.setSize(9999);
        manager.setDimOpacity(DEFAULT_FOCUS_PARAMS.dimOpacity);
        manager.setEdgeBlur(DEFAULT_FOCUS_PARAMS.edgeBlur);
        expect(listener).not.toHaveBeenCalled();
    });
});

describe('setters', () => {
    test('repaint at once and trail ONE write behind a drag', async () => {
        const div = mountMask(manager);
        manager.setIsArmed(true);
        div.dispatchEvent(pointer('pointermove', 100, 100));
        const before = div.style.background;

        manager.setDimOpacity(30);
        manager.setDimOpacity(40);
        manager.setEdgeBlur(0);
        expect(div.style.background).not.toBe(before);
        expect(setSetting).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(150);
        expect(settingStore.get('presenting-control-focus-dim')).toBe('40');
        expect(settingStore.get('presenting-control-focus-blur')).toBe('0');
        // Six keys, written once each for the whole drag.
        expect(setSetting).toHaveBeenCalledTimes(6);
    });

    test('switching into hold drops a spotlight that is up', () => {
        const div = mountMask(manager);
        manager.setIsArmed(true);
        div.dispatchEvent(pointer('pointermove', 100, 100));
        expect(manager.isSpotlighting).toBe(true);

        manager.setIsHoldMode(true);
        expect(manager.isSpotlighting).toBe(false);
        expect(div.style.background).toBe('none');
    });

    test('delete flushes a write that was still trailing', () => {
        manager.setSize(700);
        expect(setSetting).not.toHaveBeenCalled();
        manager.delete();
        expect(settingStore.get('presenting-control-focus-size')).toBe('700');
    });
});

describe('pointers that must not spotlight', () => {
    test('a press while disarmed or with another button is ignored', () => {
        const div = mountMask(manager);
        div.dispatchEvent(pointer('pointerdown', 50, 50));
        expect(manager.isSpotlighting).toBe(false);

        manager.setIsArmed(true);
        div.dispatchEvent(pointer('pointerdown', 50, 50, 2));
        expect(manager.isSpotlighting).toBe(false);
    });

    test('an overlay that is not laid out maps no point', () => {
        const div = mountMask(manager, 0);
        manager.setIsArmed(true);
        div.dispatchEvent(pointer('pointermove', 50, 50));
        div.dispatchEvent(pointer('pointerdown', 50, 50));
        expect(manager.isSpotlighting).toBe(false);
        expect(manager.point).toBeNull();
    });

    test('a press in follow mode spotlights at once and is told once', () => {
        const div = mountMask(manager);
        const listener = vi.fn();
        manager.addUpdateListener(listener);
        manager.setIsArmed(true);
        listener.mockClear();

        div.dispatchEvent(pointer('pointerdown', 60, 70));
        div.dispatchEvent(pointer('pointerdown', 80, 90));
        expect(manager.point).toEqual({ x: 80, y: 90 });
        expect(listener).toHaveBeenCalledTimes(1);
        expect(div.style.background).toContain('80px 90px');
    });

    test('a resize drops the cached rect so the next point maps afresh', () => {
        const div = mountMask(manager);
        manager.setIsArmed(true);
        div.dispatchEvent(pointer('pointermove', 10, 10));
        div.getBoundingClientRect = () =>
            ({
                left: 100,
                top: 50,
                width: 400,
                height: 400,
            }) as DOMRect;
        // Still the cached rect...
        div.dispatchEvent(pointer('pointermove', 150, 150));
        expect(manager.point).toEqual({ x: 150, y: 150 });
        // ...until the window says it moved.
        manager.render();
        div.dispatchEvent(pointer('pointermove', 150, 150));
        expect(manager.point).toEqual({ x: 50, y: 100 });
    });
});
