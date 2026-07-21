import { showSimpleToast } from '../../toast/toastHelpers';
import appProvider from '../../server/appProvider';
import { getSetting, setSetting } from '../../helper/settingHelpers';
import ScreenEventHandler from './ScreenEventHandler';
import { type GroupMembershipInf } from './ScreenEventHandler';
import type ScreenManagerBase from './ScreenManagerBase';
import type {
    BasicScreenMessageType,
    ScreenMessageType,
    DrawDataType,
    DrawPaintStrokeType,
    DrawPaintPointType,
} from '../screenTypeHelpers';

export type ScreenDrawEventType = 'update';

// Local (presenter-only) paint-tool state. It is never synced to the output
// window or group members: only the resulting strokes are.
export type PaintToolType = {
    color: string;
    size: number;
    isStraight: boolean;
    is3D: boolean;
    isDots: boolean;
};

// Wire messages are kept tiny: a full snapshot is only sent on (re)sync/init;
// live drawing streams a `begin` (one stroke header) then throttled `points`
// batches. Sending the whole stroke list on every pointer move would bloat IPC
// on the low-spec target as drawings accumulate.
type DrawSyncActionType =
    | {
          action: 'sync';
          drawData: DrawDataType;
          // Undo/redo stack carried so a screen adopting the drawing (on
          // enable) inherits the full history, not just the current strokes.
          history?: DrawPaintStrokeType[][];
          historyIndex?: number;
          // Render quality (supersample + curve smoothing) so every member and
          // the output window paint the drawing at the same fidelity.
          isHighQuality?: boolean;
      }
    | { action: 'begin'; stroke: DrawPaintStrokeType }
    | { action: 'points'; strokeId: string; points: DrawPaintPointType[] }
    // A stroke finished on another member: snapshot the (already-synced)
    // current drawing so every member's undo stack grows in lockstep.
    | { action: 'commit' }
    | { action: 'clear' };

const SYNC_THROTTLE_MS = 60;
// Per-screen persistence: strokes + undo/redo history + panel-enabled flag, so a
// drawing (and the ability to keep undoing/redoing it) survives an app reload.
const DRAW_SETTING_PREFIX = 'screen-draw-data-';
// Per-screen render-quality flag, shared with the panel's toggle
// (MiniScreenDrawHandlersComp). Read by every manager (presenter + output) on
// load so the fidelity is right without waiting for a sync.
const DRAW_QUALITY_PREFIX = 'draw-paint-quality-';
// Supersample factor for high-quality mode: the backing store is rendered at
// HQ_SCALE× the native screen size then downscaled on display, which is real
// edge anti-aliasing. Kept at 2 to bound the extra memory on low-spec targets
// (4× pixels only while the user opts into high quality; fast mode stays 1×).
const HQ_SCALE = 2;

let strokeCounter = 0;
function genStrokeId() {
    return `stroke-${Date.now()}-${strokeCounter++}`;
}

function cloneStroke(stroke: DrawPaintStrokeType): DrawPaintStrokeType {
    return { ...stroke, points: [...stroke.points] };
}

function cloneDrawData(drawData: DrawDataType): DrawDataType {
    return {
        paintStrokeList: (drawData.paintStrokeList ?? []).map(cloneStroke),
    };
}

function cloneHistory(
    history: DrawPaintStrokeType[][],
): DrawPaintStrokeType[][] {
    return (history ?? []).map((snapshot) => {
        return (snapshot ?? []).map(cloneStroke);
    });
}

export default class ScreenDrawManager
    extends ScreenEventHandler<ScreenDrawEventType>
    implements GroupMembershipInf
{
    static readonly eventNamePrefix: string = 'screen-draw-m';
    private _div: HTMLDivElement | null = null;
    private _canvas: HTMLCanvasElement | null = null;
    private _ctx: CanvasRenderingContext2D | null = null;
    drawData: DrawDataType;
    // Whether this screen's draw panel is toggled on. Driven by the explicit
    // toggle click (not effect lifecycle, which StrictMode double-invokes), and
    // read across group members to decide whether a disable should clear.
    isDrawEnabled = false;
    // When null the overlay is passive (pointerEvents:none) and captures no
    // input. Set by the presenter's draw panel while the Paint tool is active.
    paintTool: PaintToolType | null = null;
    // Render fidelity. true (high quality, the default) = supersampled backing
    // store + quadratic-curve smoothing. false (fast) = 1× backing store +
    // straight polyline segments (lighter, for weaker hardware). Persisted per
    // screen and synced so the output window and group members match.
    isHighQuality = true;
    private currentStroke: DrawPaintStrokeType | null = null;
    private pendingPoints: DrawPaintPointType[] = [];
    private lastSyncAt = 0;
    private renderScheduled = false;
    // Undo/redo history of committed stroke lists. Each entry is a shallow copy
    // of the stroke list; finished strokes are never mutated, so snapshots share
    // stroke references and stay cheap. Kept in lockstep across sync-group
    // members (via 'commit'/'sync' messages) so any screen can undo/redo the
    // shared drawing and a screen enabling later adopts the full history.
    private static readonly MAX_HISTORY = 50;
    private history: DrawPaintStrokeType[][] = [[]];
    private historyIndex = 0;
    private readonly boundPointerDown = this.handlePointerDown.bind(this);
    private readonly boundPointerMove = this.handlePointerMove.bind(this);
    private readonly boundPointerUp = this.handlePointerUp.bind(this);
    private readonly boundKeyDown = this.handleKeyDown.bind(this);

    constructor(screenManagerBase: ScreenManagerBase) {
        super(screenManagerBase);
        this.drawData = { paintStrokeList: [] };
        this.loadPersisted();
    }

    private get settingKey() {
        return `${DRAW_SETTING_PREFIX}${this.screenId}`;
    }

    private get qualityKey() {
        return `${DRAW_QUALITY_PREFIX}${this.screenId}`;
    }

    // Native pixels of the backing store per native screen pixel. High quality
    // supersamples; fast is 1:1.
    private get renderScale() {
        return this.isHighQuality ? HQ_SCALE : 1;
    }

    private loadPersisted() {
        // Shared with the panel toggle; read here so the output window's manager
        // gets the right fidelity on load without waiting for a sync. Defaults to
        // high quality when unset (no persisted choice yet).
        const persistedQuality = getSetting(this.qualityKey);
        this.isHighQuality =
            persistedQuality === null ? true : persistedQuality === 'true';
        const raw = getSetting(this.settingKey);
        if (!raw) {
            return;
        }
        try {
            const parsed = JSON.parse(raw);
            this.drawData = cloneDrawData(
                parsed.drawData ?? { paintStrokeList: [] },
            );
            this.history =
                Array.isArray(parsed.history) && parsed.history.length > 0
                    ? cloneHistory(parsed.history)
                    : [[...this.drawData.paintStrokeList]];
            const lastIndex = this.history.length - 1;
            this.historyIndex =
                typeof parsed.historyIndex === 'number'
                    ? Math.max(0, Math.min(parsed.historyIndex, lastIndex))
                    : lastIndex;
            this.isDrawEnabled = parsed.isDrawEnabled === true;
        } catch {
            // Corrupt/legacy value: ignore and start fresh.
        }
    }

    // Only the presenter persists (settings are a shared file; output windows
    // get restored via the presenter's init re-sync, so this avoids write races).
    // Called on committed events only — never per pointer-move.
    private saveDrawData() {
        if (!appProvider.isPagePresenter) {
            return;
        }
        setSetting(
            this.settingKey,
            JSON.stringify({
                drawData: this.drawData,
                history: this.history,
                historyIndex: this.historyIndex,
                isDrawEnabled: this.isDrawEnabled,
            }),
        );
    }

    get isShowing() {
        return this.drawData.paintStrokeList.length > 0;
    }

    get div(): HTMLDivElement {
        return this._div ?? document.createElement('div');
    }

    set div(div: HTMLDivElement | null) {
        if (this._div === div) {
            return;
        }
        this.detachEventListeners();
        this._div = div;
        this._canvas = null;
        this._ctx = null;
        this.setupContainer();
        this.render();
    }

    private setupContainer() {
        const div = this._div;
        if (div === null) {
            return;
        }
        div.style.position = 'absolute';
        div.style.top = '0';
        div.style.left = '0';
        div.style.width = `${this.screenManagerBase.width}px`;
        div.style.height = `${this.screenManagerBase.height}px`;
        div.style.overflow = 'hidden';
        div.style.pointerEvents = this.paintTool !== null ? 'auto' : 'none';
        let canvas = this._canvas;
        if (canvas === null) {
            canvas = document.createElement('canvas');
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.pointerEvents = 'inherit';
            canvas.style.touchAction = 'none';
            // Focusable so it can own the keyboard (undo/redo) while active,
            // without a focus ring cluttering the scaled preview.
            canvas.tabIndex = 0;
            canvas.style.outline = 'none';
            div.appendChild(canvas);
            this._canvas = canvas;
            this._ctx = canvas.getContext('2d');
            // Only the presenter (not the output window) captures drawing input.
            if (!appProvider.isPageScreen) {
                canvas.addEventListener('pointerdown', this.boundPointerDown);
                canvas.addEventListener('keydown', this.boundKeyDown);
            }
        }
        const scale = this.renderScale;
        const width = Math.round(this.screenManagerBase.width * scale);
        const height = Math.round(this.screenManagerBase.height * scale);
        // Resizing clears the canvas; renderAllStrokes redraws right after, and a
        // quality toggle routes through render so the resize takes effect.
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
    }

    private detachEventListeners() {
        if (this._canvas !== null) {
            this._canvas.removeEventListener(
                'pointerdown',
                this.boundPointerDown,
            );
            this._canvas.removeEventListener('keydown', this.boundKeyDown);
        }
        globalThis.removeEventListener('pointermove', this.boundPointerMove);
        globalThis.removeEventListener('pointerup', this.boundPointerUp);
        this.currentStroke = null;
        this.pendingPoints = [];
    }

    private handleKeyDown(event: KeyboardEvent) {
        if (this.paintTool === null) {
            return;
        }
        const isCtrl = event.ctrlKey || event.metaKey;
        if (isCtrl && event.code === 'KeyZ') {
            event.preventDefault();
            event.stopPropagation();
            if (event.shiftKey) {
                this.redo();
            } else {
                this.undo();
            }
            return;
        }
        if (isCtrl && event.code === 'KeyY') {
            event.preventDefault();
            event.stopPropagation();
            this.redo();
            return;
        }
        // Consume every other key too: while the draw canvas is focused the app's
        // global keyboard shortcuts (which listen on document) must not fire.
        event.stopPropagation();
    }

    setPaintTool(paintTool: PaintToolType | null) {
        this.paintTool = paintTool;
        if (this._div !== null) {
            this._div.style.pointerEvents =
                paintTool !== null ? 'auto' : 'none';
        }
        this.fireUpdateEvent();
    }

    // Live quality toggle from the panel. Persists (shared key), re-renders at
    // the new backing-store resolution, and broadcasts a full sync so the output
    // window and group members switch fidelity in lockstep.
    setRenderQuality(isHighQuality: boolean) {
        if (this.isHighQuality === isHighQuality) {
            return;
        }
        this.isHighQuality = isHighQuality;
        if (appProvider.isPagePresenter) {
            setSetting(this.qualityKey, `${isHighQuality}`);
        }
        this.scheduleRender();
        this.sendDrawMessage(this.buildSyncAction());
        this.fireUpdateEvent();
    }

    private clientToNative(
        clientX: number,
        clientY: number,
    ): DrawPaintPointType | null {
        const canvas = this._canvas;
        if (canvas === null) {
            return null;
        }
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            return null;
        }
        // Map viewport coords to native screen pixels regardless of the
        // preview's CSS scale (rect is the scaled box; canvas.width is native).
        return {
            x:
                ((clientX - rect.left) * this.screenManagerBase.width) /
                rect.width,
            y:
                ((clientY - rect.top) * this.screenManagerBase.height) /
                rect.height,
        };
    }

    private handlePointerDown(event: PointerEvent) {
        const tool = this.paintTool;
        if (tool === null) {
            return;
        }
        const point = this.clientToNative(event.clientX, event.clientY);
        if (point === null) {
            return;
        }
        event.preventDefault();
        // Grab keyboard focus so undo/redo shortcuts target this canvas.
        this._canvas?.focus?.({ preventScroll: true });
        const stroke: DrawPaintStrokeType = {
            id: genStrokeId(),
            color: tool.color,
            size: tool.size,
            points: [point],
            isStraight: tool.isStraight,
            is3D: tool.is3D,
            isDots: tool.isDots,
        };
        this.currentStroke = stroke;
        this.pendingPoints = [];
        this.drawData.paintStrokeList = [
            ...this.drawData.paintStrokeList,
            stroke,
        ];
        try {
            this._canvas?.setPointerCapture?.(event.pointerId);
        } catch {
            // Some pointer ids (e.g. synthetic events) reject capture; the
            // window-level move/up listeners below still track the stroke.
        }
        globalThis.addEventListener('pointermove', this.boundPointerMove);
        globalThis.addEventListener('pointerup', this.boundPointerUp);
        this.sendDrawMessage({ action: 'begin', stroke: cloneStroke(stroke) });
        this.lastSyncAt = Date.now();
        this.scheduleRender();
        this.fireUpdateEvent();
    }

    private handlePointerMove(event: PointerEvent) {
        const stroke = this.currentStroke;
        if (stroke === null) {
            return;
        }
        const point = this.clientToNative(event.clientX, event.clientY);
        if (point === null) {
            return;
        }
        stroke.points.push(point);
        this.pendingPoints.push(point);
        this.scheduleRender();
        // Straight strokes rubber-band from the first point, so the receiver
        // needs the full point set, not an append; resend via `begin` snapshot.
        const now = Date.now();
        if (now - this.lastSyncAt >= SYNC_THROTTLE_MS) {
            this.flushPendingPoints();
            this.lastSyncAt = now;
        }
    }

    private handlePointerUp() {
        if (this.currentStroke === null) {
            return;
        }
        this.flushPendingPoints();
        this.currentStroke = null;
        globalThis.removeEventListener('pointermove', this.boundPointerMove);
        globalThis.removeEventListener('pointerup', this.boundPointerUp);
        this.recordHistory();
        // Tell the group the stroke is done so their undo stacks stay in step
        // (they already have the strokes from the streamed begin/points).
        this.sendDrawMessage({ action: 'commit' });
        this.saveDrawData();
        this.fireUpdateEvent();
    }

    private recordHistory() {
        // Drop any redo tail (we branched), then snapshot the committed strokes.
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push([...this.drawData.paintStrokeList]);
        if (this.history.length > ScreenDrawManager.MAX_HISTORY + 1) {
            this.history.shift();
        }
        this.historyIndex = this.history.length - 1;
    }

    get canUndo() {
        return this.historyIndex > 0;
    }

    get canRedo() {
        return this.historyIndex < this.history.length - 1;
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

    private applyHistorySnapshot() {
        this.currentStroke = null;
        this.pendingPoints = [];
        this.drawData = {
            paintStrokeList: [...this.history[this.historyIndex]],
        };
        this.scheduleRender();
        this.fireUpdateEvent();
        // Undo/redo are discrete actions: push the whole snapshot (with history)
        // so every member's undo stack stays identical.
        this.sendDrawMessage(this.buildSyncAction());
        this.saveDrawData();
    }

    private flushPendingPoints() {
        const stroke = this.currentStroke;
        if (stroke === null || this.pendingPoints.length === 0) {
            return;
        }
        if (stroke.isStraight) {
            // Only endpoints matter; keep the receiver in sync with a snapshot.
            this.sendDrawMessage({
                action: 'begin',
                stroke: cloneStroke(stroke),
            });
        } else {
            this.sendDrawMessage({
                action: 'points',
                strokeId: stroke.id,
                points: [...this.pendingPoints],
            });
        }
        this.pendingPoints = [];
    }

    private sendDrawMessage(data: DrawSyncActionType) {
        // Re-enable sync-group for this (the sender) screen: receiving a group
        // sync sets our noSyncGroupMap flag to true (echo guard), which would
        // otherwise permanently block our own outgoing draws to the group.
        ScreenDrawManager.enableSyncGroup(this.screenId);
        this.screenManagerBase.sendScreenMessage(
            {
                screenId: this.screenId,
                type: 'draw',
                data,
            },
            false,
        );
    }

    // Overwritten per-screen by setGroupMembershipInf in the ScreenManager
    // constructor; the stubs keep the class structurally a GroupMembershipInf.
    async getMemberInstances(): Promise<ScreenDrawManager[]> {
        return [];
    }
    async getMemberIds(): Promise<number[]> {
        return [];
    }
    async checkIsMainInstance(): Promise<boolean> {
        return false;
    }

    async sendSyncScreen(shouldFromOtherGroupMember = false) {
        // Enabling a draw panel requests the group's existing drawing: ask a
        // group member to broadcast its state, which the whole group (including
        // this just-enabled screen) then adopts. Mirrors ScreenManager.
        if (shouldFromOtherGroupMember) {
            const otherGroupMembers = await this.getMemberInstances();
            if (otherGroupMembers.length > 0) {
                await otherGroupMembers[0].sendSyncScreen();
                return;
            }
        }
        ScreenDrawManager.enableSyncGroup(this.screenId);
        super.sendSyncScreen();
    }

    // Toggling the draw panel on: adopt whatever the group has already drawn.
    enableDraw() {
        this.isDrawEnabled = true;
        this.saveDrawData();
        this.sendSyncScreen(true);
    }

    // Toggling the draw panel off: only wipe the drawing once NO group member
    // still has draw enabled, so an active member keeps the shared drawing.
    async disableDraw() {
        this.isDrawEnabled = false;
        const otherGroupMembers = await this.getMemberInstances();
        const anyOtherEnabled = otherGroupMembers.some((member) => {
            return member.isDrawEnabled;
        });
        if (anyOtherEnabled) {
            // Drawing stays; just persist that this screen's panel is now off.
            this.saveDrawData();
        } else {
            this.clear();
        }
    }

    private buildSyncAction(): DrawSyncActionType {
        return {
            action: 'sync',
            drawData: this.drawData,
            history: this.history,
            historyIndex: this.historyIndex,
            isHighQuality: this.isHighQuality,
        };
    }

    toSyncMessage(): BasicScreenMessageType {
        return {
            type: 'draw',
            data: this.buildSyncAction(),
        };
    }

    fireUpdateEvent() {
        super.fireUpdateEvent();
        ScreenDrawManager.fireUpdateEvent();
    }

    receiveSyncScreen(message: ScreenMessageType) {
        const data: DrawSyncActionType | null = message.data ?? null;
        if (data === null) {
            return;
        }
        // Clone everything we keep: sync-group members share the same message
        // object references in-process, so storing them raw would let one
        // screen's later mutations bleed into another's stroke list.
        if (data.action === 'sync') {
            this.drawData = cloneDrawData(
                data.drawData ?? { paintStrokeList: [] },
            );
            // Adopt the sender's render fidelity so the output window and group
            // members repaint at the same quality (resolution + smoothing).
            if (typeof data.isHighQuality === 'boolean') {
                this.isHighQuality = data.isHighQuality;
            }
            // Adopt the sender's undo/redo stack so this screen can undo/redo
            // the drawing it just received exactly as the source can.
            if (Array.isArray(data.history)) {
                this.history = cloneHistory(data.history);
                const lastIndex = this.history.length - 1;
                this.historyIndex =
                    typeof data.historyIndex === 'number'
                        ? Math.max(0, Math.min(data.historyIndex, lastIndex))
                        : lastIndex;
            }
        } else if (data.action === 'commit') {
            // A stroke finished elsewhere; our drawData already has it (via
            // begin/points), so snapshot it to keep our undo stack in step.
            this.recordHistory();
        } else if (data.action === 'begin') {
            const incoming = cloneStroke(data.stroke);
            const existingIndex = this.drawData.paintStrokeList.findIndex(
                (stroke) => stroke.id === incoming.id,
            );
            if (existingIndex === -1) {
                this.drawData.paintStrokeList = [
                    ...this.drawData.paintStrokeList,
                    incoming,
                ];
            } else {
                // Straight-stroke rubber-band update: replace in place.
                const nextList = [...this.drawData.paintStrokeList];
                nextList[existingIndex] = incoming;
                this.drawData.paintStrokeList = nextList;
            }
        } else if (data.action === 'points') {
            const stroke = this.drawData.paintStrokeList.find((item) => {
                return item.id === data.strokeId;
            });
            if (stroke !== undefined) {
                stroke.points.push(...data.points);
            }
        } else if (data.action === 'clear') {
            this.drawData = { paintStrokeList: [] };
            // Mirror the sender: push the empty state so undo can restore.
            this.recordHistory();
        }
        this.scheduleRender();
        this.fireUpdateEvent();
        this.forwardToOwnScreenOutput(data);
        // Persist only on committed actions (never per streamed begin/points).
        if (
            data.action === 'sync' ||
            data.action === 'commit' ||
            data.action === 'clear'
        ) {
            this.saveDrawData();
        }
    }

    private forwardToOwnScreenOutput(data: DrawSyncActionType) {
        // A group-synced update reached THIS screen's presenter manager, but the
        // screenMessage IPC is TARGETED (electron routes it only to the origin
        // screen's output window). So mirror it to this screen's own output
        // window. Presenter only; and a raw send (no enableSyncGroup) so the
        // noSyncGroupMap echo guard stays set and it doesn't loop back to the
        // group. Output windows never reach here (isPagePresenter is false).
        if (!appProvider.isPagePresenter) {
            return;
        }
        this.screenManagerBase.sendScreenMessage(
            { screenId: this.screenId, type: 'draw', data },
            false,
        );
    }

    private scheduleRender() {
        if (this.renderScheduled) {
            return;
        }
        this.renderScheduled = true;
        const run = () => {
            this.renderScheduled = false;
            this.renderAllStrokes();
        };
        if (typeof globalThis.requestAnimationFrame === 'function') {
            globalThis.requestAnimationFrame(run);
        } else {
            run();
        }
    }

    private drawStroke(
        ctx: CanvasRenderingContext2D,
        stroke: DrawPaintStrokeType,
    ) {
        const points = stroke.points;
        if (points.length === 0) {
            return;
        }
        ctx.save();
        ctx.strokeStyle = stroke.color;
        ctx.fillStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (stroke.is3D) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
            ctx.shadowBlur = Math.max(2, stroke.size * 0.9);
            ctx.shadowOffsetX = Math.max(1, stroke.size * 0.18);
            ctx.shadowOffsetY = Math.max(1, stroke.size * 0.18);
        }
        if (stroke.isDots) {
            for (const point of points) {
                ctx.beginPath();
                ctx.arc(point.x, point.y, stroke.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (stroke.isStraight) {
            const first = points[0];
            const last = points[points.length - 1];
            ctx.beginPath();
            ctx.moveTo(first.x, first.y);
            ctx.lineTo(last.x, last.y);
            ctx.stroke();
        } else if (points.length === 1) {
            // A single click with no drag: render a dot.
            ctx.beginPath();
            ctx.arc(points[0].x, points[0].y, stroke.size / 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.isHighQuality && points.length > 2) {
            // Smooth the freehand polyline into a quadratic curve through the
            // midpoints of consecutive samples, so corners read as curves rather
            // than the angular segments fast mode draws.
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length - 1; i++) {
                const midX = (points[i].x + points[i + 1].x) / 2;
                const midY = (points[i].y + points[i + 1].y) / 2;
                ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
            }
            const last = points[points.length - 1];
            ctx.lineTo(last.x, last.y);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    private renderAllStrokes() {
        this.setupContainer();
        const ctx = this._ctx;
        const canvas = this._canvas;
        if (ctx === null || canvas === null) {
            return;
        }
        const scale = this.renderScale;
        // Clear the whole backing store, then scale so stroke coordinates (native
        // screen px) map onto the supersampled canvas.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.imageSmoothingEnabled = this.isHighQuality;
        if (this.isHighQuality) {
            ctx.imageSmoothingQuality = 'high';
        }
        for (const stroke of this.drawData.paintStrokeList) {
            this.drawStroke(ctx, stroke);
        }
    }

    render() {
        this.renderAllStrokes();
    }

    // Local clear (no rebroadcast) — used when applying a synced clear.
    private clearLocal() {
        this.drawData = { paintStrokeList: [] };
        this.currentStroke = null;
        this.pendingPoints = [];
        this.scheduleRender();
        this.fireUpdateEvent();
    }

    clear() {
        this.clearLocal();
        // Keep the empty state on the undo stack so a clear can be undone.
        this.recordHistory();
        this.sendDrawMessage({ action: 'clear' });
        this.saveDrawData();
    }

    delete() {
        this.detachEventListeners();
        super.delete();
    }

    static receiveSyncScreen(message: ScreenMessageType) {
        const { screenId } = message;
        const screenDrawManager = this.getInstance(screenId);
        if (screenDrawManager === null) {
            showSimpleToast(
                'Failed to apply to screen. Please make sure the screen is open.',
                'error',
            );
            return;
        }
        screenDrawManager.receiveSyncScreen(message);
    }

    static getInstance(screenId: number) {
        return super.getInstanceBase<ScreenDrawManager>(screenId);
    }
}
