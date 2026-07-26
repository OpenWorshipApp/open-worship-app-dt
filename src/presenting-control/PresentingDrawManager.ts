import {
    genFrameScheduler,
    paintStroke,
} from '../_screen/managers/screenOverlayHelpers';
import { setSetting } from '../helper/settingHelpers';
import type { DrawPaintStrokeType } from '../_screen/screenTypeHelpers';
import {
    DEFAULT_IS_HIGH_QUALITY,
    PAINT_QUALITY_SETTING_NAME,
    readPersistedBoolean,
    readPersistedPaintParams,
    toPresentingSettingKey,
    type PresentingPaintParamsType,
} from './presentingControlHelpers';

// Freehand annotation over the whole presenter window. See
// `presentingControlHelpers.ts` for why this is not ScreenDrawManager: no
// screens, no sync group, no IPC, and — deliberately — no persistence of the
// strokes. The drawing is scoped to one "start controlling" session; keeping it
// on disk would mean a settings write on every stroke and a surprise annotation
// waiting on top of the app after a restart.
//
// The engine owns the BRUSH (seeded off disk here, edited live by the panel) and
// is armed by the TOOL, not by its panel being mounted. Those are two different
// facts and conflating them was a bug: the settings panel is unmounted whenever
// the floating widget is collapsed, so a collapsed widget silently disarmed the
// brush while the overlay went on covering the app — the user could neither draw
// nor click through.

const HQ_SCALE = 2;
const MAX_HISTORY = 50;

let strokeCounter = 0;
function genStrokeId() {
    return `presenting-stroke-${Date.now()}-${strokeCounter++}`;
}

export default class PresentingDrawManager {
    private _canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    strokeList: DrawPaintStrokeType[] = [];
    // false = passive: the overlay is click-through and this manager captures
    // nothing. Driven by the TOOL (brush or eraser selected), so it survives the
    // settings panel unmounting when the widget collapses.
    isArmed = false;
    // Which of the two drawing tools is live. Not part of the brush: the style
    // toggles do not apply when erasing.
    isEraser = false;
    // How the brush looks. Seeded from disk so a stroke is right even if the
    // panel never mounts; the panel pushes edits through `setPaintParams`.
    paintParams: PresentingPaintParamsType = readPersistedPaintParams();
    // Persisted, unlike the strokes: this is the setting that decides whether a
    // 1080p window costs an ~8MB backing store or a ~33MB supersampled one, and
    // an operator on a weak machine who turns it off should not have to find it
    // again at the start of every service.
    isHighQuality = readPersistedBoolean(
        PAINT_QUALITY_SETTING_NAME,
        DEFAULT_IS_HIGH_QUALITY,
    );
    // Undo/redo of committed stroke lists. Finished strokes are never mutated,
    // so the snapshots share stroke references and stay cheap.
    private history: DrawPaintStrokeType[][] = [[]];
    private historyIndex = 0;
    private currentStroke: DrawPaintStrokeType | null = null;
    // Canvas rect captured at pointer-down and reused for the whole stroke, so
    // pointer-move mapping doesn't force a synchronous layout on every sample.
    private strokeRect: DOMRect | null = null;
    private readonly updateListenerSet = new Set<() => void>();
    private readonly scheduleRender = genFrameScheduler(() => {
        this.renderAllStrokes();
    });
    private readonly boundPointerDown = this.handlePointerDown.bind(this);
    private readonly boundPointerMove = this.handlePointerMove.bind(this);
    private readonly boundPointerUp = this.handlePointerUp.bind(this);

    addUpdateListener(listener: () => void) {
        this.updateListenerSet.add(listener);
        return () => {
            this.updateListenerSet.delete(listener);
        };
    }

    private fireUpdateEvent() {
        for (const listener of this.updateListenerSet) {
            listener();
        }
    }

    get isShowing() {
        return this.strokeList.length > 0;
    }

    get canUndo() {
        return this.historyIndex > 0;
    }

    get canRedo() {
        return this.historyIndex < this.history.length - 1;
    }

    // Native pixels of the backing store per window CSS pixel. High quality
    // supersamples then downscales on display, which is real edge
    // anti-aliasing; fast is 1:1.
    private get renderScale() {
        return this.isHighQuality ? HQ_SCALE : 1;
    }

    set canvas(canvas: HTMLCanvasElement | null) {
        if (this._canvas === canvas) {
            return;
        }
        this.detachEventListeners();
        this._canvas = canvas;
        this.ctx = canvas?.getContext('2d') ?? null;
        if (canvas !== null) {
            canvas.addEventListener('pointerdown', this.boundPointerDown);
        }
        this.render();
    }

    // Arm/disarm from the selected TOOL. The only thing that stops this manager
    // capturing the pointer — in particular, NOT the settings panel unmounting.
    setIsArmed(isArmed: boolean) {
        if (this.isArmed === isArmed) {
            return;
        }
        this.isArmed = isArmed;
        if (!isArmed) {
            // Disarming mid-stroke (tool switched with the button still down)
            // must not leave the window listeners attached.
            this.stopTracking();
            this.currentStroke = null;
        }
        this.fireUpdateEvent();
    }

    setIsEraser(isEraser: boolean) {
        this.isEraser = isEraser;
    }

    // Live brush edits from the panel. A plain assignment on purpose: this runs
    // on every slider tick and nothing about it needs a re-render — the next
    // stroke simply reads the new values.
    setPaintParams(paintParams: PresentingPaintParamsType) {
        this.paintParams = paintParams;
    }

    // One click, one write — no debounce: this is a toggle, not a slider.
    setRenderQuality(isHighQuality: boolean) {
        if (this.isHighQuality === isHighQuality) {
            return;
        }
        this.isHighQuality = isHighQuality;
        setSetting(
            toPresentingSettingKey(PAINT_QUALITY_SETTING_NAME),
            `${isHighQuality}`,
        );
        this.scheduleRender();
        this.fireUpdateEvent();
    }

    // Size the backing store LAZILY: keep it at 0x0 whenever there is nothing
    // drawn, so an open-but-unused controller holds no canvas memory (a
    // supersampled 1080p store is ~33MB). Sized up on the first stroke and
    // released back to 0x0 on clear.
    private syncCanvasSize() {
        const canvas = this._canvas;
        if (canvas === null) {
            return;
        }
        const scale = this.renderScale;
        const isNeeded = this.strokeList.length > 0;
        // The canvas is stretched over the fixed overlay, so its CSS box IS the
        // window box — offsetWidth/Height avoid a getBoundingClientRect here.
        const width = isNeeded ? Math.round(canvas.offsetWidth * scale) : 0;
        const height = isNeeded ? Math.round(canvas.offsetHeight * scale) : 0;
        // Assigning width/height clears the canvas; renderAllStrokes redraws
        // right after.
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
    }

    private renderAllStrokes() {
        this.syncCanvasSize();
        const ctx = this.ctx;
        const canvas = this._canvas;
        if (ctx === null || canvas === null) {
            return;
        }
        const scale = this.renderScale;
        // Clear the whole backing store, then scale so stroke coordinates
        // (window CSS px) map onto the supersampled canvas.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.imageSmoothingEnabled = this.isHighQuality;
        if (this.isHighQuality) {
            ctx.imageSmoothingQuality = 'high';
        }
        for (const stroke of this.strokeList) {
            paintStroke(ctx, stroke, this.isHighQuality);
        }
    }

    // The window was resized: the canvas CSS box changed, so the backing store
    // has to be re-sized and everything repainted. Strokes keep their window
    // coordinates (they are annotations ON the app, and the app itself reflows),
    // so nothing is rescaled.
    render() {
        this.scheduleRender();
    }

    private clientToLocal(clientX: number, clientY: number) {
        const rect =
            this.strokeRect ?? this._canvas?.getBoundingClientRect() ?? null;
        if (rect === null || rect.width === 0 || rect.height === 0) {
            return null;
        }
        // The overlay is unscaled and unrotated, so the canvas' CSS box and the
        // viewport share a unit: this is a translation, not a mapping.
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    private handlePointerDown(event: PointerEvent) {
        if (!this.isArmed) {
            return;
        }
        // Primary button only: a right-click over the armed overlay is the app's
        // context menu, not a dot.
        if (event.button !== 0) {
            return;
        }
        // Cache the canvas rect for the whole stroke: the overlay is fixed and
        // cannot move while the pointer is down, so the moves skip the
        // layout-forcing getBoundingClientRect.
        this.strokeRect = this._canvas?.getBoundingClientRect() ?? null;
        const point = this.clientToLocal(event.clientX, event.clientY);
        if (point === null) {
            return;
        }
        event.preventDefault();
        const isEraser = this.isEraser;
        const params = this.paintParams;
        const stroke: DrawPaintStrokeType = {
            id: genStrokeId(),
            color: params.color,
            size: params.size,
            points: [point],
            // The eraser is always a plain round freehand path: the style
            // toggles don't apply when erasing, so force them off for a
            // predictable "rub out any chunk" gesture.
            isStraight: isEraser ? false : params.isStraight,
            is3D: isEraser ? false : params.is3D,
            isDots: isEraser ? false : params.isDots,
            isEraser,
        };
        this.currentStroke = stroke;
        this.strokeList = [...this.strokeList, stroke];
        try {
            this._canvas?.setPointerCapture?.(event.pointerId);
        } catch {
            // Some pointer ids (e.g. synthetic events) reject capture; the
            // window-level listeners below still track the stroke.
        }
        this.startTracking();
        this.scheduleRender();
        this.fireUpdateEvent();
    }

    private handlePointerMove(event: PointerEvent) {
        const stroke = this.currentStroke;
        if (stroke === null) {
            return;
        }
        const point = this.clientToLocal(event.clientX, event.clientY);
        if (point === null) {
            return;
        }
        // A plain straight stroke only ever renders its two endpoints, so
        // rubber-band in place instead of accumulating the dead intermediate
        // samples. Straight+Dots still needs every point (Dots draws one at
        // each), so exclude that combination.
        if (stroke.isStraight && !stroke.isDots) {
            stroke.points = [stroke.points[0], point];
        } else {
            stroke.points.push(point);
        }
        this.scheduleRender();
    }

    private handlePointerUp() {
        this.stopTracking();
        if (this.currentStroke === null) {
            return;
        }
        this.currentStroke = null;
        this.recordHistory();
        this.fireUpdateEvent();
    }

    // Move/up live on the window, not the canvas, so a drag that leaves the
    // window still gets its pointerup. A cancelled pointer (pen/touch OS cancel)
    // never fires `pointerup`, so it is treated as one.
    private startTracking() {
        globalThis.addEventListener('pointermove', this.boundPointerMove);
        globalThis.addEventListener('pointerup', this.boundPointerUp);
        globalThis.addEventListener('pointercancel', this.boundPointerUp);
    }

    private stopTracking() {
        this.strokeRect = null;
        globalThis.removeEventListener('pointermove', this.boundPointerMove);
        globalThis.removeEventListener('pointerup', this.boundPointerUp);
        globalThis.removeEventListener('pointercancel', this.boundPointerUp);
    }

    private detachEventListeners() {
        this._canvas?.removeEventListener('pointerdown', this.boundPointerDown);
        this.stopTracking();
        this.currentStroke = null;
    }

    private recordHistory() {
        // Drop any redo tail (we branched), then snapshot the committed strokes.
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push([...this.strokeList]);
        if (this.history.length > MAX_HISTORY + 1) {
            this.history.shift();
        }
        this.historyIndex = this.history.length - 1;
    }

    private applyHistorySnapshot() {
        this.currentStroke = null;
        this.strokeList = [...this.history[this.historyIndex]];
        this.scheduleRender();
        this.fireUpdateEvent();
    }

    undo() {
        if (!this.canUndo) {
            return;
        }
        this.historyIndex -= 1;
        this.applyHistorySnapshot();
    }

    redo() {
        if (!this.canRedo) {
            return;
        }
        this.historyIndex += 1;
        this.applyHistorySnapshot();
    }

    // A clear COLLAPSES the undo stack to at most "before the clear" -> "after
    // the clear" instead of appending to it, so one Undo restores a mis-clicked
    // Clear but a second one is a no-op — rather than walking back through every
    // drawing made earlier in the session.
    clear() {
        const strokeListBeforeClear = this.strokeList;
        this.currentStroke = null;
        this.strokeList = [];
        this.history =
            strokeListBeforeClear.length > 0
                ? [[...strokeListBeforeClear], []]
                : [[]];
        this.historyIndex = this.history.length - 1;
        this.scheduleRender();
        this.fireUpdateEvent();
    }

    // Stopping the controller: drop the listeners, the strokes and — crucially —
    // the supersampled backing store, so nothing of this session stays resident.
    delete() {
        this.detachEventListeners();
        this.updateListenerSet.clear();
        this.isArmed = false;
        this.strokeList = [];
        this.history = [[]];
        this.historyIndex = 0;
        if (this._canvas !== null) {
            this._canvas.width = 0;
            this._canvas.height = 0;
        }
        this._canvas = null;
        this.ctx = null;
    }
}
