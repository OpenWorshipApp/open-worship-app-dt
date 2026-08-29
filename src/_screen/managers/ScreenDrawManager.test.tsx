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
const removeSettingMock = vi.fn((key: string) => {
    settingStore.delete(key);
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
    removeSetting: removeSettingMock,
}));
vi.mock('../../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: getSettingMock,
        setItem: setSettingMock,
    },
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

// `history`/`historyIndex` are private implementation state; the tests assert
// on them through a cast rather than widening the class API.
function historyOf(manager: any): any[][] {
    return manager.history;
}

function historyIndexOf(manager: any): number {
    return manager.historyIndex;
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

    test('undoing past a clear cannot resurrect an earlier cleared drawing', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase());
        const drawAndCommit = (id: string) => {
            manager.receiveSyncScreen(
                drawMessage(30, { action: 'begin', stroke: makeStroke(id) }),
            );
            manager.receiveSyncScreen(drawMessage(30, { action: 'commit' }));
        };

        // A first drawing, wiped. Then a second, unrelated drawing.
        drawAndCommit('old');
        manager.clear();
        drawAndCommit('new');
        manager.clear();

        // One undo restores what THIS clear wiped -- a mis-click on Clear is
        // exactly what undo is for.
        expect(manager.canUndo).toBe(true);
        manager.undo();
        expect(
            manager.drawData.paintStrokeList.map((stroke: any) => stroke.id),
        ).toEqual(['new']);

        // ...and that is the end of the road. Undoing further used to walk back
        // into the FIRST, already-cleared drawing and put it back on the
        // congregation's screen, and canUndo never went false so the button
        // never disabled.
        expect(manager.canUndo).toBe(false);
        manager.undo();
        expect(
            manager.drawData.paintStrokeList.map((stroke: any) => stroke.id),
        ).toEqual(['new']);
    });

    test('a synced clear collapses the receiver history too', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase());
        const drawAndCommit = (id: string) => {
            manager.receiveSyncScreen(
                drawMessage(30, { action: 'begin', stroke: makeStroke(id) }),
            );
            manager.receiveSyncScreen(drawMessage(30, { action: 'commit' }));
        };

        drawAndCommit('old');
        manager.receiveSyncScreen(drawMessage(30, { action: 'clear' }));
        drawAndCommit('new');
        manager.receiveSyncScreen(drawMessage(30, { action: 'clear' }));

        // Otherwise a group member is the one left holding -- and able to
        // resurrect -- the older cleared drawing.
        manager.undo();
        expect(
            manager.drawData.paintStrokeList.map((stroke: any) => stroke.id),
        ).toEqual(['new']);
        expect(manager.canUndo).toBe(false);
    });

    test('persists in deduped v2 form and reloads round-trip', async () => {
        vi.useFakeTimers();
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

        // Let the debounced persist land (delete() no longer flushes it — a
        // deleted screen's drawing must not outlive the screen).
        vi.advanceTimersByTime(500);
        vi.useRealTimers();

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

    test('releaseDiv ignores a stale div so a remount keeps the live overlay', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase(34));
        manager.paintTool = {
            color: '#fff',
            size: 4,
            isStraight: false,
            is3D: false,
            isDots: false,
        };

        const oldDiv = document.createElement('div');
        document.body.appendChild(oldDiv);
        manager.div = oldDiv;
        expect(oldDiv.querySelector('canvas')).not.toBeNull();

        // A previewer remount attaches the REPLACEMENT div before the old
        // tree's ref cleanup runs (its React root unmounts a microtask later),
        // so the release must be a no-op by then.
        const newDiv = document.createElement('div');
        document.body.appendChild(newDiv);
        manager.div = newDiv;
        manager.releaseDiv(oldDiv);

        expect(manager.div).toBe(newDiv);
        expect(newDiv.querySelector('canvas')).not.toBeNull();
        expect(oldDiv.querySelector('canvas')).toBeNull();

        // Releasing the div it actually holds still tears the overlay down.
        manager.releaseDiv(newDiv);
        expect(newDiv.querySelector('canvas')).toBeNull();
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

    test('canvas keydown swallows app shortcuts MID-STROKE only, and always lets palette keys bubble', async () => {
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

        // FOCUSED BUT IDLE: the globals must still work. The canvas takes focus
        // from the click-to-select gesture (a single click that does not paint),
        // so swallowing here meant merely picking a screen silently killed every
        // global shortcut -- including the F6-F10 clear-layer keys -- until the
        // user clicked elsewhere.
        press('ArrowRight');
        expect(onDocumentKeyDown).toHaveBeenCalledTimes(1);
        press('F8');
        expect(onDocumentKeyDown).toHaveBeenCalledTimes(2);

        // MID-STROKE: now slide navigation must not fire.
        (manager as any).currentStroke = { id: 'x', points: [] };
        press('ArrowRight');
        expect(onDocumentKeyDown).toHaveBeenCalledTimes(2);

        // The draw panel's quick-select keys reach document.onkeydown even
        // mid-stroke -- that is exactly when they are most useful.
        press('e');
        press(']');
        expect(onDocumentKeyDown).toHaveBeenCalledTimes(4);

        // Ctrl+Z stays handled locally by the canvas.
        press('z', { ctrlKey: true, code: 'KeyZ' });
        expect(onDocumentKeyDown).toHaveBeenCalledTimes(4);
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

    test('re-setting the div leaves no orphaned canvas behind', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase(43));
        const div = document.createElement('div');
        document.body.appendChild(div);

        manager.div = div;
        expect(div.querySelectorAll('canvas')).toHaveLength(1);
        const firstCanvas = div.querySelector('canvas');

        // StrictMode runs the ref as `div -> null -> div` on every mount. A
        // canvas left behind here stacks under the new one and keeps painting
        // the strokes it last held, so a cleared drawing would stay on the
        // output window with no way to remove it.
        manager.div = null;
        expect(div.querySelectorAll('canvas')).toHaveLength(0);

        manager.div = div;
        expect(div.querySelectorAll('canvas')).toHaveLength(1);
        expect(div.querySelector('canvas')).not.toBe(firstCanvas);
    });

    test('re-assigning the same div is a no-op', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase(44));
        const div = document.createElement('div');
        document.body.appendChild(div);

        manager.div = div;
        const canvas = div.querySelector('canvas');
        manager.div = div;

        expect(div.querySelector('canvas')).toBe(canvas);
        // the getter falls back to a detached div when nothing is mounted
        manager.div = null;
        expect(manager.div).toBeInstanceOf(HTMLDivElement);
    });

    test('a synced history shares one clone per distinct stroke', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase(45));
        const first = makeStroke('s1');
        const second = makeStroke('s2');

        manager.receiveSyncScreen(
            drawMessage(45, {
                action: 'sync',
                drawData: { paintStrokeList: [first, second] },
                // cumulative snapshots share stroke references, exactly as the
                // sender's own history does
                history: [[first], [first, second], null as any],
                historyIndex: 1,
            }),
        );

        const [snapshotOne, snapshotTwo, snapshotThree] = historyOf(manager);
        expect(snapshotOne[0]).toBe(snapshotTwo[0]);
        expect(snapshotOne[0]).not.toBe(first);
        expect(snapshotThree).toEqual([]);
        expect(historyIndexOf(manager)).toBe(1);
    });

    test('the output window never persists the drawing itself', async () => {
        const ScreenDrawManager = await importManager();
        appProviderMock.isPagePresenter = false;
        appProviderMock.isPageScreen = true;
        const manager = new ScreenDrawManager(createBase(46));

        manager.receiveSyncScreen(
            drawMessage(46, { action: 'begin', stroke: makeStroke('s1') }),
        );
        manager.receiveSyncScreen(drawMessage(46, { action: 'commit' }));

        expect(setSettingMock).not.toHaveBeenCalled();
    });

    test('deleting the screen drops the drawing instead of flushing it', async () => {
        vi.useFakeTimers();
        try {
            const ScreenDrawManager = await importManager();
            const manager = new ScreenDrawManager(createBase(47));

            manager.receiveSyncScreen(
                drawMessage(47, { action: 'begin', stroke: makeStroke('s1') }),
            );
            manager.receiveSyncScreen(drawMessage(47, { action: 'commit' }));
            expect(setSettingMock).not.toHaveBeenCalledWith(
                'screen-draw-data-47',
                expect.any(String),
            );

            vi.advanceTimersByTime(500);
            expect(setSettingMock).toHaveBeenCalledWith(
                'screen-draw-data-47',
                expect.any(String),
            );

            // A stroke committed less than a debounce before the delete must
            // NOT be flushed: screen ids are reused, so a flush would hand this
            // drawing to whichever screen is created next under id 47.
            manager.receiveSyncScreen(
                drawMessage(47, { action: 'begin', stroke: makeStroke('s2') }),
            );
            manager.receiveSyncScreen(drawMessage(47, { action: 'commit' }));
            setSettingMock.mockClear();
            manager.delete();
            expect(setSettingMock).not.toHaveBeenCalled();
            expect(removeSettingMock).toHaveBeenCalledWith(
                'screen-draw-data-47',
            );
            expect(removeSettingMock).toHaveBeenCalledWith(
                'draw-paint-quality-47',
            );
            expect(settingStore.has('screen-draw-data-47')).toBe(false);

            // ...and the cancelled timer must not fire afterwards either.
            vi.advanceTimersByTime(500);
            expect(setSettingMock).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    test('persisted history falls back to the current drawing', async () => {
        const ScreenDrawManager = await importManager();
        settingStore.set(
            'screen-draw-data-48',
            JSON.stringify({
                drawData: { paintStrokeList: [makeStroke('s1')] },
                version: 2,
                strokePool: {},
                historyIds: [],
            }),
        );

        const manager = new ScreenDrawManager(createBase(48));

        expect(historyOf(manager)).toHaveLength(1);
        expect(historyOf(manager)[0]).toHaveLength(1);
        expect(manager.canUndo).toBe(false);
    });

    test('keyboard undo and redo shortcuts drive the history', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase(49));
        const div = document.createElement('div');
        document.body.appendChild(div);
        manager.div = div;
        const canvas = div.querySelector('canvas') as HTMLCanvasElement;
        const keyDown = (code: string, extra: KeyboardEventInit = {}) => {
            canvas.dispatchEvent(
                new KeyboardEvent('keydown', {
                    code,
                    ctrlKey: true,
                    bubbles: true,
                    cancelable: true,
                    ...extra,
                }),
            );
        };

        // an unarmed canvas ignores every key
        keyDown('KeyZ');
        expect(historyIndexOf(manager)).toBe(0);

        manager.setPaintTool({
            color: '#f00',
            size: 8,
            isStraight: false,
            is3D: false,
            isDots: false,
        });
        manager.receiveSyncScreen(
            drawMessage(49, { action: 'begin', stroke: makeStroke('s1') }),
        );
        manager.receiveSyncScreen(drawMessage(49, { action: 'commit' }));
        expect(manager.canUndo).toBe(true);

        keyDown('KeyZ');
        expect(manager.canUndo).toBe(false);
        expect(manager.canRedo).toBe(true);

        keyDown('KeyZ', { shiftKey: true });
        expect(manager.canRedo).toBe(false);

        keyDown('KeyZ');
        keyDown('KeyY');
        expect(manager.canRedo).toBe(false);
        expect(manager.canUndo).toBe(true);

        // redo with nothing to redo is a no-op
        keyDown('KeyY');
        expect(manager.canRedo).toBe(false);
    });

    test('updatePaintToolParams arms once and then edits in place', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase(50));
        const div = document.createElement('div');
        document.body.appendChild(div);
        manager.div = div;
        const tool = {
            color: '#f00',
            size: 8,
            isStraight: false,
            is3D: false,
            isDots: false,
        };

        manager.updatePaintToolParams(tool);
        expect(manager.paintTool).toEqual(tool);
        // arming flips the overlay to receive pointer events
        expect(div.style.pointerEvents).toBe('auto');

        const updatedTool = { ...tool, color: '#00f', size: 12 };
        manager.updatePaintToolParams(updatedTool);
        expect(manager.paintTool).toEqual(updatedTool);
        expect(div.style.pointerEvents).toBe('auto');
    });

    test('setRenderQuality persists, re-renders, and broadcasts once', async () => {
        const ScreenDrawManager = await importManager();
        const base = createBase(51);
        const manager = new ScreenDrawManager(base);

        expect(manager.isHighQuality).toBe(true);

        manager.setRenderQuality(true);
        expect(base.sendScreenMessage).not.toHaveBeenCalled();

        manager.setRenderQuality(false);
        expect(manager.isHighQuality).toBe(false);
        expect(setSettingMock).toHaveBeenCalledWith(
            'draw-paint-quality-51',
            'false',
        );
        expect(base.sendScreenMessage).toHaveBeenCalledTimes(1);

        // the output window follows the toggle but never persists it
        appProviderMock.isPagePresenter = false;
        setSettingMock.mockClear();
        manager.setRenderQuality(true);
        expect(manager.isHighQuality).toBe(true);
        expect(setSettingMock).not.toHaveBeenCalled();
    });

    test('pointer handlers ignore events without an armed tool or a usable point', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase(52));
        const div = document.createElement('div');
        document.body.appendChild(div);
        manager.div = div;
        const canvas = div.querySelector('canvas') as HTMLCanvasElement;
        const pointerDown = () => {
            canvas.dispatchEvent(
                new MouseEvent('pointerdown', {
                    clientX: 10,
                    clientY: 10,
                    button: 0,
                    bubbles: true,
                }),
            );
        };

        // no tool armed
        pointerDown();
        expect(manager.drawData.paintStrokeList).toHaveLength(0);

        manager.setPaintTool({
            color: '#f00',
            size: 8,
            isStraight: false,
            is3D: false,
            isDots: false,
        });
        // a zero-sized canvas cannot map a client point onto the screen
        canvas.getBoundingClientRect = () =>
            ({
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                width: 0,
                height: 0,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }) as DOMRect;
        pointerDown();
        pointerDown();
        expect(manager.drawData.paintStrokeList).toHaveLength(0);

        // a move with no stroke in progress is dropped
        globalThis.dispatchEvent(
            new MouseEvent('pointermove', { clientX: 5, clientY: 5 }),
        );
        expect(manager.drawData.paintStrokeList).toHaveLength(0);

        // ...and so is a pointer-up
        globalThis.dispatchEvent(new MouseEvent('pointerup', {}));
        expect(manager.canUndo).toBe(false);
    });

    test('a moving pointer stops sampling once the rect stops resolving', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase(53));
        const div = document.createElement('div');
        document.body.appendChild(div);
        manager.div = div;
        const canvas = div.querySelector('canvas') as HTMLCanvasElement;
        let rect = {
            left: 0,
            top: 0,
            right: 100,
            bottom: 100,
            width: 100,
            height: 100,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        } as DOMRect;
        canvas.getBoundingClientRect = () => rect;
        manager.setPaintTool({
            color: '#f00',
            size: 8,
            isStraight: false,
            is3D: false,
            isDots: false,
        });

        canvas.dispatchEvent(
            new MouseEvent('pointerdown', {
                clientX: 10,
                clientY: 10,
                button: 0,
                bubbles: true,
            }),
        );
        canvas.dispatchEvent(
            new MouseEvent('pointerdown', {
                clientX: 10,
                clientY: 10,
                button: 0,
                bubbles: true,
            }),
        );
        expect(manager.drawData.paintStrokeList).toHaveLength(1);

        // the cached stroke rect collapses: further samples are unusable
        rect = { ...rect, width: 0, height: 0 } as DOMRect;
        (manager as any).strokeRect = rect;
        globalThis.dispatchEvent(
            new MouseEvent('pointermove', { clientX: 20, clientY: 20 }),
        );
        expect(manager.drawData.paintStrokeList[0].points).toHaveLength(1);

        globalThis.dispatchEvent(new MouseEvent('pointerup', {}));
    });

    test('long drawing sessions cap the undo history', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase(54));

        for (let index = 0; index < 55; index++) {
            manager.receiveSyncScreen(
                drawMessage(54, {
                    action: 'begin',
                    stroke: makeStroke(`s${index}`),
                }),
            );
            manager.receiveSyncScreen(drawMessage(54, { action: 'commit' }));
        }

        expect(historyOf(manager)).toHaveLength(51);
        expect(historyIndexOf(manager)).toBe(50);
    });

    test('group membership defaults to an empty group', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase(55));

        await expect(manager.getMemberInstances()).resolves.toEqual([]);
        await expect(manager.getMemberIds()).resolves.toEqual([]);
        await expect(manager.checkIsMainInstance()).resolves.toBe(false);
    });

    test('enabling draw adopts the drawing a group member already has', async () => {
        const ScreenDrawManager = await importManager();
        const base = createBase(56);
        const manager = new ScreenDrawManager(base);
        const memberBase = createBase(57);
        const member = new ScreenDrawManager(memberBase);
        manager.getMemberInstances = vi.fn(async () => [member]);

        manager.enableDraw();
        await Promise.resolve();
        await Promise.resolve();

        expect(manager.isDrawEnabled).toBe(true);
        // the member broadcasts its own state; this screen adopts it
        expect(memberBase.sendScreenMessage).toHaveBeenCalledWith(
            expect.objectContaining({ screenId: 57, type: 'draw' }),
            false,
        );
        expect(base.sendScreenMessage).not.toHaveBeenCalled();

        // with nobody else in the group, this screen broadcasts its own state
        manager.getMemberInstances = vi.fn(async () => []);
        await manager.sendSyncScreen(true);
        expect(base.sendScreenMessage).toHaveBeenCalledWith(
            expect.objectContaining({ screenId: 56, type: 'draw' }),
            false,
        );
    });

    test('toSyncMessage carries the drawing, history, and quality', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase(58));
        manager.receiveSyncScreen(
            drawMessage(58, { action: 'begin', stroke: makeStroke('s1') }),
        );
        manager.receiveSyncScreen(drawMessage(58, { action: 'commit' }));

        expect(manager.toSyncMessage()).toEqual({
            type: 'draw',
            data: {
                action: 'sync',
                drawData: manager.drawData,
                history: historyOf(manager),
                historyIndex: historyIndexOf(manager),
                isHighQuality: true,
            },
        });
    });

    test('an empty sync message is ignored', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase(59));

        manager.receiveSyncScreen(drawMessage(59, null));

        expect(manager.drawData.paintStrokeList).toHaveLength(0);
    });

    test('legacy persisted data without a history snapshots the drawing', async () => {
        const ScreenDrawManager = await importManager();
        settingStore.set(
            'screen-draw-data-61',
            JSON.stringify({
                drawData: { paintStrokeList: [makeStroke('s1')] },
            }),
        );

        const manager = new ScreenDrawManager(createBase(61));

        expect(historyOf(manager)).toEqual([manager.drawData.paintStrokeList]);
        expect(historyIndexOf(manager)).toBe(0);
    });

    test('a stroke throttles its point sync and survives being cleared mid-draw', async () => {
        vi.useFakeTimers();
        try {
            const ScreenDrawManager = await importManager();
            const base = createBase(62);
            const manager = new ScreenDrawManager(base);
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
            const pointerDown = () => {
                canvas.dispatchEvent(
                    new MouseEvent('pointerdown', {
                        clientX: 10,
                        clientY: 10,
                        button: 0,
                        bubbles: true,
                    }),
                );
            };
            const pointerMove = (clientX: number) => {
                globalThis.dispatchEvent(
                    new MouseEvent('pointermove', { clientX, clientY: 20 }),
                );
            };

            pointerDown();
            pointerDown();
            expect(manager.drawData.paintStrokeList).toHaveLength(1);

            base.sendScreenMessage.mockClear();
            // inside the throttle window the samples only accumulate locally
            pointerMove(20);
            expect(base.sendScreenMessage).not.toHaveBeenCalled();

            vi.advanceTimersByTime(100);
            pointerMove(30);
            expect(base.sendScreenMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ action: 'points' }),
                }),
                false,
            );

            // a synced clear drops the in-flight stroke; the remaining pointer
            // events must not resurrect or re-commit it
            manager.receiveSyncScreen(drawMessage(62, { action: 'clear' }));
            base.sendScreenMessage.mockClear();
            pointerMove(40);
            globalThis.dispatchEvent(new MouseEvent('pointerup', {}));

            expect(manager.drawData.paintStrokeList).toHaveLength(0);
            expect(base.sendScreenMessage).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    test('a sync message for a closed screen reports the failure', async () => {
        const ScreenDrawManager = await importManager();
        const manager = new ScreenDrawManager(createBase(60));
        const { showSimpleToast } = await import('../../toast/toastHelpers');

        expect(ScreenDrawManager.getInstance(60)).toBe(manager);

        ScreenDrawManager.receiveSyncScreen(
            drawMessage(60, { action: 'begin', stroke: makeStroke('s1') }),
        );
        expect(manager.drawData.paintStrokeList).toHaveLength(1);

        ScreenDrawManager.receiveSyncScreen(
            drawMessage(9999, { action: 'clear' }),
        );
        expect(showSimpleToast).toHaveBeenCalledWith(
            'Failed to apply to screen. Please make sure the screen is open.',
            'error',
        );
    });
});
