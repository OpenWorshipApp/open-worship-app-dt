// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// In-memory setting store so persistence can be round-tripped.
const settingStore = new Map<string, string>();
const getSettingMock = vi.fn((key: string) => {
    return settingStore.has(key) ? (settingStore.get(key) as string) : null;
});
const setSettingMock = vi.fn((key: string, value: string | null) => {
    settingStore.set(key, value ?? '');
});

const appProviderMock = {
    isPagePresenter: true,
    isPageScreen: false,
    systemUtils: { isDev: false },
    messageUtils: { listenForData: vi.fn(), sendData: vi.fn() },
};

vi.mock('../../helper/settingHelpers', () => ({
    getSetting: getSettingMock,
    setSetting: setSettingMock,
}));
vi.mock('../../server/appProvider', () => ({ default: appProviderMock }));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: vi.fn() }));
vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: vi.fn(),
}));
vi.mock('./screenManagerBaseHelpers', () => ({
    getScreenManagerBase: vi.fn(() => null),
    getSelectedScreenManagerBases: vi.fn(() => []),
    getAllScreenManagerBases: vi.fn(() => []),
}));
vi.mock('../../helper/loggerHelpers', () => ({ appLog: vi.fn() }));

function createBase(screenId = 30) {
    return {
        screenId,
        width: 100,
        height: 100,
        noSyncGroupMap: new Map<string, boolean>(),
        checkIsLockedWithMessage: vi.fn(() => false),
        sendScreenMessage: vi.fn(),
        createScreenManagerBaseGhost: vi.fn((id: number) => ({
            screenId: id,
            isDeleted: true,
        })),
    } as any;
}

async function importManager() {
    const mod = await import('./ScreenDrawManager');
    return mod.default;
}

function drawMessage(screenId: number, data: any) {
    return { screenId, type: 'draw', data } as any;
}

function makeStroke(id: string, extra: any = {}) {
    return {
        id,
        color: '#ff0000',
        size: 4,
        points: [{ x: 1, y: 1 }],
        ...extra,
    };
}

describe('ScreenDrawManager', () => {
    // jsdom has no 2D context, so every test that mounts an overlay needs a stub.
    // Install a no-op one for all of them and restore the real prototype method
    // afterwards — tests that assert on drawing calls install a richer stub of
    // their own, and without the restore that richer stub leaks into whatever
    // runs next.
    const originalGetContext = HTMLCanvasElement.prototype.getContext;

    beforeEach(() => {
        vi.clearAllMocks();
        settingStore.clear();
        appProviderMock.isPagePresenter = true;
        appProviderMock.isPageScreen = false;
        document.body.innerHTML = '';
        HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            quadraticCurveTo: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            stroke: vi.fn(),
            clearRect: vi.fn(),
            setTransform: vi.fn(),
        })) as any;
    });

    afterEach(() => {
        HTMLCanvasElement.prototype.getContext = originalGetContext;
    });

    test('receiveSyncScreen begin/points/commit builds drawData and history', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase());

        manager.receiveSyncScreen(
            drawMessage(30, { action: 'begin', stroke: makeStroke('s1') }),
        );
        expect(manager.drawData.paintStrokeList).toHaveLength(1);
        expect(manager.isShowing).toBe(true);

        manager.receiveSyncScreen(
            drawMessage(30, {
                action: 'points',
                strokeId: 's1',
                points: [
                    { x: 2, y: 2 },
                    { x: 3, y: 3 },
                ],
            }),
        );
        expect(manager.drawData.paintStrokeList[0].points).toHaveLength(3);

        expect(manager.canUndo).toBe(false);
        manager.receiveSyncScreen(drawMessage(30, { action: 'commit' }));
        expect(manager.canUndo).toBe(true);
    });

    test('begin with an existing id replaces the stroke in place', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase());

        manager.receiveSyncScreen(
            drawMessage(30, {
                action: 'begin',
                stroke: makeStroke('s1', { points: [{ x: 0, y: 0 }] }),
            }),
        );
        manager.receiveSyncScreen(
            drawMessage(30, {
                action: 'begin',
                stroke: makeStroke('s1', {
                    points: [
                        { x: 0, y: 0 },
                        { x: 9, y: 9 },
                    ],
                }),
            }),
        );
        expect(manager.drawData.paintStrokeList).toHaveLength(1);
        expect(manager.drawData.paintStrokeList[0].points).toHaveLength(2);
    });

    test('undo/redo restore snapshots; sync adopts and clones', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase());

        manager.receiveSyncScreen(
            drawMessage(30, { action: 'begin', stroke: makeStroke('a') }),
        );
        manager.receiveSyncScreen(drawMessage(30, { action: 'commit' }));
        manager.receiveSyncScreen(
            drawMessage(30, { action: 'begin', stroke: makeStroke('b') }),
        );
        manager.receiveSyncScreen(drawMessage(30, { action: 'commit' }));
        expect(manager.drawData.paintStrokeList.map((s: any) => s.id)).toEqual([
            'a',
            'b',
        ]);

        manager.undo();
        expect(manager.drawData.paintStrokeList.map((s: any) => s.id)).toEqual([
            'a',
        ]);
        expect(manager.canRedo).toBe(true);
        manager.redo();
        expect(manager.drawData.paintStrokeList.map((s: any) => s.id)).toEqual([
            'a',
            'b',
        ]);

        // A sync message shares object refs in-process; the manager must clone.
        const shared = makeStroke('c', { points: [{ x: 5, y: 5 }] });
        manager.receiveSyncScreen(
            drawMessage(30, {
                action: 'sync',
                drawData: { paintStrokeList: [shared] },
                history: [[], [shared]],
                historyIndex: 1,
                isHighQuality: false,
            }),
        );
        expect(manager.drawData.paintStrokeList.map((s: any) => s.id)).toEqual([
            'c',
        ]);
        expect((manager as any).isHighQuality).toBe(false);
        // Mutating the original must not bleed into the manager's copy.
        shared.points.push({ x: 9, y: 9 });
        expect(manager.drawData.paintStrokeList[0].points).toHaveLength(1);
    });

    test('clear empties the drawing but leaves it undoable', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase());
        manager.receiveSyncScreen(
            drawMessage(30, { action: 'begin', stroke: makeStroke('a') }),
        );
        manager.receiveSyncScreen(drawMessage(30, { action: 'commit' }));

        manager.clear();
        expect(manager.isShowing).toBe(false);
        // The clear itself is an undo step back to the drawing.
        expect(manager.canUndo).toBe(true);
        manager.undo();
        expect(manager.isShowing).toBe(true);
    });

    test('persists in deduped v2 form and reloads round-trip', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase(31));
        manager.receiveSyncScreen(
            drawMessage(31, { action: 'begin', stroke: makeStroke('A') }),
        );
        manager.receiveSyncScreen(drawMessage(31, { action: 'commit' }));
        manager.receiveSyncScreen(
            drawMessage(31, { action: 'begin', stroke: makeStroke('B') }),
        );
        manager.receiveSyncScreen(drawMessage(31, { action: 'commit' }));
        manager.isDrawEnabled = true;

        // delete() flushes the debounced persist synchronously.
        manager.delete();

        const blob = settingStore.get('screen-draw-data-31');
        expect(blob).toBeTruthy();
        const parsed = JSON.parse(blob as string);
        expect(parsed.version).toBe(2);
        // Each unique stroke stored ONCE regardless of history depth.
        expect(Object.keys(parsed.strokePool).sort()).toEqual(['A', 'B']);
        expect(parsed.historyIds).toEqual([[], ['A'], ['A', 'B']]);

        const reloaded = new ScreenDrawManager(createBase(31));
        expect(reloaded.drawData.paintStrokeList.map((s: any) => s.id)).toEqual(
            ['A', 'B'],
        );
        expect(reloaded.isDrawEnabled).toBe(true);
        expect(reloaded.canUndo).toBe(true);
        reloaded.undo();
        reloaded.undo();
        expect(reloaded.isShowing).toBe(false);
    });

    test('loadPersisted tolerates corrupt, legacy, and out-of-range data', async () => {
        const ScreenDrawManager = await importManager();

        settingStore.set('screen-draw-data-32', 'not-json');
        const corrupt = new ScreenDrawManager(createBase(32));
        expect(corrupt.drawData.paintStrokeList).toHaveLength(0);

        // Legacy inline-history form (no version, history = arrays of strokes)
        // with an out-of-range historyIndex that must be clamped.
        const legacyStroke = makeStroke('L');
        settingStore.set(
            'screen-draw-data-33',
            JSON.stringify({
                drawData: { paintStrokeList: [legacyStroke] },
                history: [[], [legacyStroke]],
                historyIndex: 99,
                isDrawEnabled: false,
            }),
        );
        const legacy = new ScreenDrawManager(createBase(33));
        expect(legacy.drawData.paintStrokeList.map((s: any) => s.id)).toEqual([
            'L',
        ]);
        expect(legacy.canUndo).toBe(true);
        expect(legacy.canRedo).toBe(false);
    });

    test('disableDraw clears only when no other member has draw enabled', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase(34));
        manager.receiveSyncScreen(
            drawMessage(34, { action: 'begin', stroke: makeStroke('x') }),
        );
        manager.receiveSyncScreen(drawMessage(34, { action: 'commit' }));
        expect(manager.isShowing).toBe(true);

        // Another group member still has draw enabled -> drawing stays.
        (manager as any).getMemberInstances = vi.fn(async () => [
            { isDrawEnabled: true },
        ]);
        await manager.disableDraw();
        expect(manager.isShowing).toBe(true);

        // No other member enabled -> the shared drawing is cleared.
        (manager as any).getMemberInstances = vi.fn(async () => []);
        await manager.disableDraw();
        expect(manager.isShowing).toBe(false);
    });

    test('straight stroke keeps only two points; freehand accumulates', async () => {
        const ScreenDrawManager = await importManager();
        // jsdom has no canvas backend; give the overlay a no-op 2D context so
        // the real render path runs instead of throwing "Not implemented".
        HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            quadraticCurveTo: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            stroke: vi.fn(),
            clearRect: vi.fn(),
            setTransform: vi.fn(),
        })) as any;
        const manager = new ScreenDrawManager(createBase(35));
        const div = document.createElement('div');
        document.body.appendChild(div);
        manager.div = div;
        const canvas = div.querySelector('canvas') as HTMLCanvasElement;
        // jsdom has no layout, so stub the rect the coord-mapping reads.
        canvas.getBoundingClientRect = () =>
            ({
                left: 0,
                top: 0,
                right: 100,
                bottom: 100,
                width: 100,
                height: 100,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }) as DOMRect;

        const down = (x: number, y: number) => {
            canvas.dispatchEvent(
                new MouseEvent('pointerdown', {
                    clientX: x,
                    clientY: y,
                    bubbles: true,
                }),
            );
        };
        const move = (x: number, y: number) => {
            globalThis.dispatchEvent(
                new MouseEvent('pointermove', { clientX: x, clientY: y }),
            );
        };
        const up = () => {
            globalThis.dispatchEvent(new MouseEvent('pointerup', {}));
        };
        const lastStroke = () => {
            const list = manager.drawData.paintStrokeList;
            return list[list.length - 1];
        };

        manager.setPaintTool({
            color: '#f00',
            size: 4,
            isStraight: true,
            is3D: false,
            isDots: false,
        });
        // Click-to-select: the first touch on an unfocused overlay only claims
        // the screen, it must not paint.
        down(10, 10);
        expect(manager.drawData.paintStrokeList).toHaveLength(0);
        expect(manager.isFocused).toBe(true);

        down(10, 10);
        move(50, 50);
        move(80, 20);
        expect(lastStroke().points).toHaveLength(2);
        expect(lastStroke().points[0]).toEqual({ x: 10, y: 10 });
        expect(lastStroke().points[1]).toEqual({ x: 80, y: 20 });
        up();

        manager.setPaintTool({
            color: '#f00',
            size: 4,
            isStraight: false,
            is3D: false,
            isDots: false,
        });
        down(0, 0);
        move(5, 5);
        move(10, 10);
        move(15, 15);
        expect(lastStroke().points.length).toBeGreaterThanOrEqual(4);
        up();
    });

    test('eraser tool tags strokes isEraser and forces style flags off', async () => {
        const ScreenDrawManager = await importManager();
        // A save/restore-honouring stub. The point is that it can FAIL: if
        // drawStroke ever set destination-out without the surrounding
        // save()/restore(), the composite op would leak onto the next stroke and
        // paint would silently start erasing. A stub whose save/restore are
        // no-ops cannot tell those two implementations apart.
        const paintedWith: string[] = [];
        HTMLCanvasElement.prototype.getContext = vi.fn(() => {
            const stack: string[] = [];
            const ctx: any = {
                globalCompositeOperation: 'source-over',
                save: () => {
                    stack.push(ctx.globalCompositeOperation);
                },
                restore: () => {
                    ctx.globalCompositeOperation = stack.pop() ?? 'source-over';
                },
                beginPath: vi.fn(),
                moveTo: vi.fn(),
                lineTo: vi.fn(),
                quadraticCurveTo: vi.fn(),
                arc: vi.fn(),
                fill: () => {
                    paintedWith.push(ctx.globalCompositeOperation);
                },
                stroke: () => {
                    paintedWith.push(ctx.globalCompositeOperation);
                },
                clearRect: vi.fn(),
                setTransform: vi.fn(),
            };
            return ctx;
        }) as any;
        const manager = new ScreenDrawManager(createBase(36));
        const div = document.createElement('div');
        document.body.appendChild(div);
        manager.div = div;
        const canvas = div.querySelector('canvas') as HTMLCanvasElement;
        canvas.getBoundingClientRect = () =>
            ({
                left: 0,
                top: 0,
                right: 100,
                bottom: 100,
                width: 100,
                height: 100,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }) as DOMRect;

        // Enable every style flag; the eraser must still produce a plain stroke.
        manager.setPaintTool({
            color: '#f00',
            size: 8,
            isStraight: true,
            is3D: true,
            isDots: true,
            isEraser: true,
        });
        const down = () => {
            canvas.dispatchEvent(
                new MouseEvent('pointerdown', {
                    clientX: 10,
                    clientY: 10,
                    bubbles: true,
                }),
            );
        };
        // First touch only selects the screen; the second one erases.
        down();
        down();
        globalThis.dispatchEvent(
            new MouseEvent('pointermove', { clientX: 40, clientY: 40 }),
        );
        globalThis.dispatchEvent(new MouseEvent('pointerup', {}));

        const stroke = manager.drawData.paintStrokeList[0];
        expect(stroke.isEraser).toBe(true);
        expect(stroke.isStraight).toBe(false);
        expect(stroke.is3D).toBe(false);
        expect(stroke.isDots).toBe(false);

        // Paint a normal stroke AFTER the erase, so the repaint below replays
        // eraser-then-paint and the composite op has somewhere to leak to.
        manager.setPaintTool({
            color: '#00f',
            size: 8,
            isStraight: false,
            is3D: false,
            isDots: false,
        });
        down();
        globalThis.dispatchEvent(
            new MouseEvent('pointermove', { clientX: 70, clientY: 70 }),
        );
        globalThis.dispatchEvent(new MouseEvent('pointerup', {}));

        // Force a synchronous repaint (scheduleRender defers via rAF).
        paintedWith.length = 0;
        (manager as any).render();
        // The eraser cuts out, and the paint stroke after it composites normally
        // — i.e. restore() actually put source-over back.
        expect(paintedWith).toEqual(['destination-out', 'source-over']);
    });

    test('canvas keydown swallows app shortcuts but lets palette keys bubble', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase(37));
        const div = document.createElement('div');
        document.body.appendChild(div);
        manager.div = div;
        const canvas = div.querySelector('canvas') as HTMLCanvasElement;
        manager.setPaintTool({
            color: '#f00',
            size: 8,
            isStraight: false,
            is3D: false,
            isDots: false,
        });

        const onDocumentKeyDown = vi.fn();
        document.addEventListener('keydown', onDocumentKeyDown);
        const press = (key: string, init: KeyboardEventInit = {}) => {
            canvas.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key,
                    bubbles: true,
                    cancelable: true,
                    ...init,
                }),
            );
        };

        // Slide navigation must not fire while the canvas owns the keyboard.
        press('ArrowRight');
        expect(onDocumentKeyDown).not.toHaveBeenCalled();

        // The draw panel's quick-select keys have to reach document.onkeydown.
        press('e');
        press(']');
        expect(onDocumentKeyDown).toHaveBeenCalledTimes(2);

        // Ctrl+Z stays handled locally by the canvas.
        press('z', { ctrlKey: true, code: 'KeyZ' });
        expect(onDocumentKeyDown).toHaveBeenCalledTimes(2);
        document.removeEventListener('keydown', onDocumentKeyDown);
    });

    test('only the focused draw canvas claims the palette shortcuts', async () => {
        const ScreenDrawManager = await importManager();
        const attach = (manager: any) => {
            const div = document.createElement('div');
            document.body.appendChild(div);
            manager.div = div;
            return div.querySelector('canvas') as HTMLCanvasElement;
        };
        const managerA = new ScreenDrawManager(createBase(38));
        const managerB = new ScreenDrawManager(createBase(39));
        const canvasA = attach(managerA);
        const canvasB = attach(managerB);

        // Nothing focused: the keys are left alone entirely.
        expect(managerA.isFocused).toBe(false);
        expect(managerB.isFocused).toBe(false);

        // Drawing on one mini-screen focuses its canvas, which then owns the
        // keys so erasing/sizing can be done per screen.
        canvasA.focus();
        expect(managerA.isFocused).toBe(true);
        expect(managerB.isFocused).toBe(false);
        // ...and it is ringed so the user can see which screen owns the keys.
        expect(canvasA.style.outline).toContain('solid');
        expect(canvasB.style.outline).not.toContain('solid');

        // Focusing the other mini-screen hands both over.
        canvasB.focus();
        expect(managerA.isFocused).toBe(false);
        expect(managerB.isFocused).toBe(true);
        expect(canvasA.style.outline).toBe('none');

        canvasB.blur();
        expect(managerA.isFocused).toBe(false);
        expect(managerB.isFocused).toBe(false);
        expect(canvasB.style.outline).toBe('none');
    });

    test('disarming the paint tool drops the focus ring and the shortcut claim', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase(40));
        const div = document.createElement('div');
        document.body.appendChild(div);
        manager.div = div;
        const canvas = div.querySelector('canvas') as HTMLCanvasElement;
        manager.setPaintTool({
            color: '#f00',
            size: 8,
            isStraight: false,
            is3D: false,
            isDots: false,
        });
        canvas.focus();
        expect(manager.isFocused).toBe(true);

        // Closing the draw panel must not leave the screen holding the keys.
        manager.setPaintTool(null);
        expect(manager.isFocused).toBe(false);
        expect(canvas.style.outline).toBe('none');
    });

    test('isFocused reads focus off the shadow root the overlay ships in', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase(41));
        // Production mounts the overlay inside the mini-screen's shadow root, so
        // document.activeElement only ever reports the HOST. Reading focus at
        // document level would make isFocused permanently false here — and with
        // it every palette shortcut and every stroke.
        const host = document.createElement('div');
        document.body.appendChild(host);
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const div = document.createElement('div');
        shadowRoot.appendChild(div);
        manager.div = div;
        const canvas = div.querySelector('canvas') as HTMLCanvasElement;

        expect(manager.isFocused).toBe(false);
        canvas.focus();
        expect(shadowRoot.activeElement).toBe(canvas);
        expect(document.activeElement).toBe(host);
        expect(manager.isFocused).toBe(true);
    });

    test('non-primary pointer buttons neither focus nor draw', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase(42));
        const div = document.createElement('div');
        document.body.appendChild(div);
        manager.div = div;
        const canvas = div.querySelector('canvas') as HTMLCanvasElement;
        canvas.getBoundingClientRect = () =>
            ({
                left: 0,
                top: 0,
                right: 100,
                bottom: 100,
                width: 100,
                height: 100,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }) as DOMRect;
        manager.setPaintTool({
            color: '#f00',
            size: 8,
            isStraight: false,
            is3D: false,
            isDots: false,
        });
        const down = (button: number) => {
            canvas.dispatchEvent(
                new MouseEvent('pointerdown', {
                    clientX: 10,
                    clientY: 10,
                    button,
                    bubbles: true,
                }),
            );
        };

        // Right-click must fall through to the preview's context menu: the armed
        // overlay covers the whole mini-screen, so swallowing it would both steal
        // the keyboard and leave a dot behind.
        down(2);
        expect(manager.isFocused).toBe(false);
        expect(manager.drawData.paintStrokeList).toHaveLength(0);

        // Middle-click likewise.
        down(1);
        expect(manager.isFocused).toBe(false);

        // The primary button still selects, then draws.
        down(0);
        expect(manager.isFocused).toBe(true);
        expect(manager.drawData.paintStrokeList).toHaveLength(0);
        down(0);
        expect(manager.drawData.paintStrokeList).toHaveLength(1);
        globalThis.dispatchEvent(new MouseEvent('pointerup', {}));
    });
});
