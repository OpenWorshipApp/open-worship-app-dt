// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

// In-memory setting store so persistence can be round-tripped.
const settingStore = new Map<string, string>();
const getSettingMock = vi.fn((key: string) => {
    return settingStore.has(key) ? (settingStore.get(key) as string) : null;
});
const setSettingMock = vi.fn((key: string, value: string | null) => {
    settingStore.set(key, value ?? '');
});

vi.mock('../helper/settingHelpers', () => ({
    getSetting: getSettingMock,
    setSetting: setSettingMock,
}));
vi.mock('../server/appProvider', () => ({
    default: {
        isPagePresenter: true,
        isPageScreen: false,
        systemUtils: { isDev: false, isWindows: true },
    },
}));

const OVERLAY_WIDTH = 400;
const OVERLAY_HEIGHT = 300;

// The app overlay is `position: fixed; inset: 0`, so its box IS the window box:
// a pointer at clientX/Y lands on the same coordinate inside it. jsdom gives
// every element a zero-sized rect, which the engines read as "not laid out yet"
// and refuse to map, so both of these have to be faked.
function stubBox(element: HTMLElement) {
    element.getBoundingClientRect = () =>
        ({
            left: 0,
            top: 0,
            right: OVERLAY_WIDTH,
            bottom: OVERLAY_HEIGHT,
            width: OVERLAY_WIDTH,
            height: OVERLAY_HEIGHT,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        }) as DOMRect;
    Object.defineProperty(element, 'offsetWidth', { value: OVERLAY_WIDTH });
    Object.defineProperty(element, 'offsetHeight', { value: OVERLAY_HEIGHT });
}

function pointerEvent(type: string, clientX: number, clientY: number) {
    return new MouseEvent(type, { clientX, clientY, bubbles: true, button: 0 });
}

async function importDrawManager() {
    const mod = await import('./PresentingDrawManager');
    return mod.default;
}

async function importFocusManager() {
    const mod = await import('./PresentingFocusManager');
    return mod.default;
}

// jsdom has no canvas backend, so `getContext` throws "not implemented" and the
// engine would silently run with a null context. Record the calls instead: what
// these tests care about is the backing-store lifecycle and the stroke model,
// not the pixels.
function stubCanvasContext(canvas: HTMLCanvasElement) {
    const context = new Proxy(
        {},
        {
            get(target: any, property: string) {
                if (!(property in target)) {
                    target[property] = vi.fn();
                }
                return target[property];
            },
            set(target: any, property: string, value: any) {
                target[property] = value;
                return true;
            },
        },
    );
    canvas.getContext = vi.fn(() => context) as any;
}

function mountCanvas(manager: any) {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    stubBox(canvas);
    stubCanvasContext(canvas);
    manager.canvas = canvas;
    return canvas;
}

// The engines coalesce every repaint onto a frame; jsdom has no
// requestAnimationFrame timing to wait on beyond a macrotask.
async function flushFrames() {
    await new Promise((resolve) => {
        setTimeout(resolve, 20);
    });
}

// Select a drawing tool. Arming is a TOOL fact and the brush is a separate one,
// which is the whole point of the split — the settings panel comes and goes with
// the widget's collapse state, the armed tool does not.
function arm(manager: any, paintParams: any = { color: '#f00', size: 4 }) {
    manager.setPaintParams(paintParams);
    manager.setIsArmed(true);
}

// One freehand stroke: down on the canvas, moves and up on the window (so a drag
// that leaves the window still gets its release).
function stroke(canvas: HTMLElement, points: [number, number][]) {
    canvas.dispatchEvent(pointerEvent('pointerdown', ...points[0]));
    for (const point of points.slice(1)) {
        globalThis.dispatchEvent(pointerEvent('pointermove', ...point));
    }
    globalThis.dispatchEvent(pointerEvent('pointerup', ...points.at(-1)!));
}

beforeEach(() => {
    settingStore.clear();
    getSettingMock.mockClear();
    setSettingMock.mockClear();
    document.body.innerHTML = '';
});

describe('PresentingDrawManager', () => {
    test('keeps the backing store at 0x0 until something is drawn', async () => {
        const DrawManager = await importDrawManager();
        const manager = new DrawManager();
        const canvas = mountCanvas(manager);
        await flushFrames();

        expect(canvas.width).toBe(0);
        expect(canvas.height).toBe(0);

        arm(manager);
        stroke(canvas, [
            [10, 10],
            [20, 30],
            [40, 60],
        ]);
        await flushFrames();

        // Supersampled 2x in the default high-quality mode.
        expect(canvas.width).toBe(OVERLAY_WIDTH * 2);
        expect(canvas.height).toBe(OVERLAY_HEIGHT * 2);
        expect(manager.isShowing).toBe(true);
    });

    test('releases the backing store again when the drawing is cleared', async () => {
        const DrawManager = await importDrawManager();
        const manager = new DrawManager();
        const canvas = mountCanvas(manager);
        arm(manager);
        stroke(canvas, [
            [10, 10],
            [20, 30],
        ]);
        await flushFrames();
        expect(canvas.width).toBeGreaterThan(0);

        manager.clear();
        await flushFrames();

        expect(canvas.width).toBe(0);
        expect(canvas.height).toBe(0);
        expect(manager.isShowing).toBe(false);
    });

    test('a clear collapses the undo stack instead of appending to it', async () => {
        const DrawManager = await importDrawManager();
        const manager = new DrawManager();
        const canvas = mountCanvas(manager);
        arm(manager);
        for (let index = 0; index < 3; index++) {
            stroke(canvas, [
                [index, index],
                [index + 5, index + 5],
            ]);
        }
        expect(manager.strokeList).toHaveLength(3);

        manager.clear();
        // One undo restores what the clear wiped — a mis-click on Clear is
        // exactly what undo is for...
        expect(manager.canUndo).toBe(true);
        manager.undo();
        expect(manager.strokeList).toHaveLength(3);
        // ...but it must not walk back through the earlier drawings.
        manager.redo();
        expect(manager.canUndo).toBe(true);
        manager.undo();
        expect(manager.canUndo).toBe(false);
    });

    test('an eraser stroke forces the style toggles off', async () => {
        const DrawManager = await importDrawManager();
        const manager = new DrawManager();
        const canvas = mountCanvas(manager);
        arm(manager, {
            color: '#f00',
            size: 8,
            isStraight: true,
            is3D: true,
            isDots: true,
        });
        manager.setIsEraser(true);
        stroke(canvas, [
            [10, 10],
            [30, 30],
        ]);

        const [erased] = manager.strokeList;
        expect(erased.isEraser).toBe(true);
        expect(erased.isStraight).toBe(false);
        expect(erased.is3D).toBe(false);
        expect(erased.isDots).toBe(false);
    });

    test('a straight stroke rubber-bands instead of accumulating samples', async () => {
        const DrawManager = await importDrawManager();
        const manager = new DrawManager();
        const canvas = mountCanvas(manager);
        arm(manager, { color: '#f00', size: 4, isStraight: true });
        stroke(canvas, [
            [10, 10],
            [20, 20],
            [30, 30],
            [90, 70],
        ]);

        const [straight] = manager.strokeList;
        expect(straight.points).toEqual([
            { x: 10, y: 10 },
            { x: 90, y: 70 },
        ]);
    });

    // Regression: the settings panel used to be what armed the brush, via a
    // mount/unmount effect. The floating widget unmounts its content when
    // collapsed, so collapsing it disarmed the brush while the overlay went on
    // covering the app — the user could neither draw nor click through. Arming
    // is now a tool fact and brush edits are a separate call, so losing the
    // panel changes nothing about whether the brush draws.
    test('stays armed when the settings panel goes away', async () => {
        const DrawManager = await importDrawManager();
        const manager = new DrawManager();
        const canvas = mountCanvas(manager);
        arm(manager, { color: '#0f0', size: 6 });
        // ...panel unmounts (collapse). Nothing calls the engine at all.
        stroke(canvas, [
            [10, 10],
            [40, 40],
        ]);

        expect(manager.isArmed).toBe(true);
        expect(manager.strokeList).toHaveLength(1);
        expect(manager.strokeList[0].color).toBe('#0f0');
        expect(manager.strokeList[0].size).toBe(6);
    });

    test('draws with the persisted brush when no panel ever mounts', async () => {
        settingStore.set('presenting-control-paint-color', '#123456');
        settingStore.set('presenting-control-paint-alpha', '50');
        settingStore.set('presenting-control-paint-size', '24');
        settingStore.set('presenting-control-paint-dots', 'true');
        const DrawManager = await importDrawManager();
        const manager = new DrawManager();
        const canvas = mountCanvas(manager);
        // Armed straight from the keyboard (`B` with the widget collapsed):
        // setPaintParams is never called.
        manager.setIsArmed(true);
        stroke(canvas, [
            [10, 10],
            [40, 40],
        ]);

        const [drawn] = manager.strokeList;
        // 50% of 255 = 128 = 0x80.
        expect(drawn.color).toBe('#12345680');
        expect(drawn.size).toBe(24);
        expect(drawn.isDots).toBe(true);
    });

    test('captures nothing while no tool is armed', async () => {
        const DrawManager = await importDrawManager();
        const manager = new DrawManager();
        const canvas = mountCanvas(manager);
        stroke(canvas, [
            [10, 10],
            [40, 40],
        ]);

        expect(manager.strokeList).toHaveLength(0);
        expect(manager.isShowing).toBe(false);
    });

    // Fast quarters the backing store and skips curve smoothing, so it is the
    // one brush setting that decides whether the overlay is usable at all on a
    // weak machine. Re-picking it every session would defeat the point.
    test('the render quality survives the session', async () => {
        const DrawManager = await importDrawManager();
        const manager = new DrawManager();
        expect(manager.isHighQuality).toBe(true);

        manager.setRenderQuality(false);
        expect(settingStore.get('presenting-control-paint-quality')).toBe(
            'false',
        );

        expect(new DrawManager().isHighQuality).toBe(false);
    });

    test('fast quality halves the backing store per axis', async () => {
        const DrawManager = await importDrawManager();
        const manager = new DrawManager();
        const canvas = mountCanvas(manager);
        manager.setRenderQuality(false);
        arm(manager);
        stroke(canvas, [
            [10, 10],
            [40, 40],
        ]);
        await flushFrames();

        expect(canvas.width).toBe(OVERLAY_WIDTH);
        expect(canvas.height).toBe(OVERLAY_HEIGHT);
    });

    test('delete() drops the drawing and the backing store', async () => {
        const DrawManager = await importDrawManager();
        const manager = new DrawManager();
        const canvas = mountCanvas(manager);
        arm(manager);
        stroke(canvas, [
            [10, 10],
            [40, 40],
        ]);
        await flushFrames();
        expect(canvas.width).toBeGreaterThan(0);

        manager.delete();

        expect(canvas.width).toBe(0);
        expect(canvas.height).toBe(0);
        expect(manager.isShowing).toBe(false);
    });
});

describe('PresentingFocusManager', () => {
    function mountMask(manager: any) {
        const div = document.createElement('div');
        document.body.appendChild(div);
        stubBox(div);
        manager.div = div;
        return div;
    }

    test('follow mode spotlights on a bare pointer move', async () => {
        const FocusManager = await importFocusManager();
        const manager = new FocusManager();
        const div = mountMask(manager);
        manager.setIsArmed(true);

        div.dispatchEvent(pointerEvent('pointermove', 120, 90));
        await flushFrames();

        expect(manager.isSpotlighting).toBe(true);
        expect(manager.point).toEqual({ x: 120, y: 90 });
        expect(div.style.background).toContain('radial-gradient');
        expect(div.style.background).toContain('120px 90px');
    });

    test('follow mode keeps the spotlight after the press is released', async () => {
        const FocusManager = await importFocusManager();
        const manager = new FocusManager();
        const div = mountMask(manager);
        manager.setIsArmed(true);

        div.dispatchEvent(pointerEvent('pointerdown', 50, 50));
        div.dispatchEvent(pointerEvent('pointerup', 50, 50));

        expect(manager.isSpotlighting).toBe(true);
    });

    test('hold mode ignores moves until pressed and undims on release', async () => {
        const FocusManager = await importFocusManager();
        const manager = new FocusManager();
        const div = mountMask(manager);
        manager.setIsArmed(true);
        manager.setIsHoldMode(true);

        div.dispatchEvent(pointerEvent('pointermove', 30, 30));
        expect(manager.isSpotlighting).toBe(false);

        div.dispatchEvent(pointerEvent('pointerdown', 60, 40));
        expect(manager.isSpotlighting).toBe(true);
        div.dispatchEvent(pointerEvent('pointermove', 80, 40));
        expect(manager.point).toEqual({ x: 80, y: 40 });

        div.dispatchEvent(pointerEvent('pointerup', 80, 40));
        expect(manager.isSpotlighting).toBe(false);
        await flushFrames();
        expect(div.style.background).toBe('none');
    });

    test('the pointer leaving the overlay drops the mask', async () => {
        const FocusManager = await importFocusManager();
        const manager = new FocusManager();
        const div = mountMask(manager);
        manager.setIsArmed(true);
        div.dispatchEvent(pointerEvent('pointermove', 100, 100));
        expect(manager.isSpotlighting).toBe(true);

        div.dispatchEvent(pointerEvent('pointerleave', 0, 0));
        await flushFrames();

        expect(manager.isSpotlighting).toBe(false);
        expect(div.style.background).toBe('none');
    });

    test('disarming can never leave the app dimmed', async () => {
        const FocusManager = await importFocusManager();
        const manager = new FocusManager();
        const div = mountMask(manager);
        manager.setIsArmed(true);
        div.dispatchEvent(pointerEvent('pointermove', 100, 100));
        expect(manager.isSpotlighting).toBe(true);

        manager.setIsArmed(false);
        await flushFrames();

        expect(manager.isSpotlighting).toBe(false);
        expect(div.style.background).toBe('none');
        // ...and it stops listening entirely.
        div.dispatchEvent(pointerEvent('pointermove', 20, 20));
        expect(manager.isSpotlighting).toBe(false);
    });

    test('settings round-trip through the presenting-control keys', async () => {
        const FocusManager = await importFocusManager();
        const manager = new FocusManager();
        mountMask(manager);
        manager.setSize(500);
        manager.setDimOpacity(80);
        manager.setEdgeBlur(10);
        manager.setIsContrast(true);
        // The writes trail the slider drag by a debounce.
        await new Promise((resolve) => {
            setTimeout(resolve, 250);
        });

        expect(settingStore.get('presenting-control-focus-size')).toBe('500');
        expect(settingStore.get('presenting-control-focus-dim')).toBe('80');

        const restored = new FocusManager();
        expect(restored.size).toBe(500);
        expect(restored.dimOpacity).toBe(80);
        expect(restored.edgeBlur).toBe(10);
        expect(restored.isContrast).toBe(true);
        // The spotlight itself is never restored: an app restart must not come
        // back with the window dimmed.
        expect(restored.isSpotlighting).toBe(false);
    });

    test('reset restores the shipped defaults and re-persists them', async () => {
        const FocusManager = await importFocusManager();
        const manager = new FocusManager();
        mountMask(manager);
        manager.setSize(900);
        manager.setIsContrast(true);
        manager.setIsHoldMode(true);

        manager.resetSettings();
        await new Promise((resolve) => {
            setTimeout(resolve, 250);
        });

        expect(manager.size).toBe(260);
        expect(manager.isContrast).toBe(false);
        expect(manager.isHoldMode).toBe(false);
        expect(settingStore.get('presenting-control-focus-size')).toBe('260');
        expect(settingStore.get('presenting-control-focus-hold')).toBe('false');
    });

    // delete() is re-entrant: StrictMode tears the engine down and hands the
    // element straight back, and `set div` repaints. Leaving the run state
    // behind would bring the overlay back dimmed at the last point it saw, with
    // no tool armed and nothing listening to undim it.
    test('delete() leaves nothing that could repaint a stale mask', async () => {
        const FocusManager = await importFocusManager();
        const manager = new FocusManager();
        const div = mountMask(manager);
        manager.setIsArmed(true);
        div.dispatchEvent(pointerEvent('pointermove', 100, 100));
        expect(manager.isSpotlighting).toBe(true);

        manager.delete();
        expect(manager.isArmed).toBe(false);
        expect(manager.isSpotlighting).toBe(false);
        expect(manager.point).toBe(null);

        // ...and handing the element back paints nothing.
        manager.div = div;
        await flushFrames();
        expect(div.style.background).toBe('none');
    });

    test('a corrupt persisted value falls back instead of painting nothing', async () => {
        settingStore.set('presenting-control-focus-color', 'not-a-color');
        settingStore.set('presenting-control-focus-size', 'NaN');
        const FocusManager = await importFocusManager();
        const manager = new FocusManager();

        expect(manager.dimColor).toBe('#000000');
        expect(manager.size).toBe(260);
    });
});
