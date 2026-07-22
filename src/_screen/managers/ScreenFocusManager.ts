import { showSimpleToast } from '../../toast/toastHelpers';
import appProvider from '../../server/appProvider';
import { getSetting, setSetting } from '../../helper/settingHelpers';
import { genTimeoutAttempt } from '../../helper/timeoutHelpers';
import ScreenEventHandler from './ScreenEventHandler';
import { type GroupMembershipInf } from './ScreenEventHandler';
import {
    applyKeyboardOutline,
    applyOverlayBoxStyle,
    applyOverlayFocusability,
    checkIsKeyboardTarget,
    clampNumber,
    forwardToOwnScreenOutput,
    genFrameScheduler,
    toAlphaHex,
    toNativePoint,
} from './screenOverlayHelpers';
import type ScreenManagerBase from './ScreenManagerBase';
import type {
    BasicScreenMessageType,
    ScreenMessageType,
    DrawPaintPointType,
    FocusDataType,
} from '../screenTypeHelpers';

export type ScreenFocusEventType = 'update';

// Spotlight ("Focusing"): a full-screen dark mask with one clear hole that
// follows the cursor. It is deliberately NOT built on the draw overlay — there
// are no strokes, no undo history and nothing persisted about what is on screen.
// It is a live pointer, so the whole state is a handful of values and the wire
// message is that same state.
//
// The mask is DOM, not a canvas: a canvas would mean a native-resolution
// backing store (~8MB at 1080p, ~33MB supersampled) held for as long as the
// panel is open, which the low-spec target cannot spare for an effect that is
// one circle. It is a single screen-sized div whose `background` is a
// radial-gradient — the hole and the dim in one paint op, no extra element.
//
// A moving `box-shadow` hole was tried first (compositor-only moves, no
// gradient repaint) and DOES NOT RENDER: the spread has to exceed the screen
// diagonal to cover the corners, and Chromium silently drops a shadow that
// large. Verified live — the element was present and styled, and nothing
// painted. Do not "optimize" back to it.

const FOCUS_SIZE_PREFIX = 'screen-focus-size-';
const FOCUS_COLOR_PREFIX = 'screen-focus-color-';
const FOCUS_DIM_PREFIX = 'screen-focus-dim-';
const FOCUS_BLUR_PREFIX = 'screen-focus-blur-';
const FOCUS_CONTRAST_PREFIX = 'screen-focus-contrast-';
const FOCUS_OPEN_PREFIX = 'screen-focus-open-';
export const DEFAULT_FOCUS_SIZE = 300;
export const DEFAULT_FOCUS_COLOR = '#000000';
export const DEFAULT_FOCUS_DIM = 70;
export const DEFAULT_FOCUS_BLUR = 35;
export const FOCUS_SIZE_MIN = 40;
export const FOCUS_SIZE_MAX = 1200;
export const FOCUS_DIM_MIN = 10;
export const FOCUS_DIM_MAX = 100;
export const FOCUS_BLUR_MIN = 0;
export const FOCUS_BLUR_MAX = 100;
// Pointer moves are streamed to the output window and the sync group. 40ms
// (~25/s) reads as a smooth follow without turning a mouse sweep into an IPC
// flood.
const MOVE_SYNC_THROTTLE_MS = 40;
// Size/dim come from sliders, so persisting and broadcasting every tick would
// write to disk dozens of times per drag. The local mask updates immediately.
const SETTING_SYNC_MS = 150;

// The mask colour arrives from a `<input type="color">`, from disk or off the
// wire, and goes straight into a style string — so anything that is not exactly
// `#rrggbb` falls back rather than producing an unparseable gradient (which
// would silently paint NOTHING, i.e. an undimmed screen mid-service).
const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;
function toValidDimColor(color: unknown) {
    return typeof color === 'string' && HEX_COLOR_REGEX.test(color)
        ? color.toLowerCase()
        : DEFAULT_FOCUS_COLOR;
}

// Read one persisted integer, clamped into range, falling back to the shipped
// default for a missing or corrupt value.
function readPersistedNumber(
    key: string,
    fallback: number,
    min: number,
    max: number,
) {
    const parsed = Number.parseInt(getSetting(key) ?? '', 10);
    return Number.isFinite(parsed) ? clampNumber(parsed, min, max) : fallback;
}

export default class ScreenFocusManager
    extends ScreenEventHandler<ScreenFocusEventType>
    implements GroupMembershipInf
{
    static readonly eventNamePrefix: string = 'screen-focus-m';
    private _div: HTMLDivElement | null = null;
    private _isSetUp = false;
    // Whether the mask is currently on. Starts false on every load by design:
    // the spotlight waits for a press, so an app restart never comes back with
    // the congregation's screen dimmed.
    isSpotlighting = false;
    point: DrawPaintPointType | null = null;
    size = DEFAULT_FOCUS_SIZE;
    // The mask's colour; `dimOpacity` is its alpha.
    dimColor = DEFAULT_FOCUS_COLOR;
    dimOpacity = DEFAULT_FOCUS_DIM;
    edgeBlur = DEFAULT_FOCUS_BLUR;
    // false = spotlight (clear circle, dimmed surroundings).
    // true  = contrast (dimmed circle, clear surroundings) — used to BLOCK the
    // area under the pointer rather than to highlight it.
    isContrast = false;
    // Presenter-only: the focus panel is open, so the overlay accepts pointer
    // input. Output windows never arm.
    isArmed = false;
    // Whether this screen's previewer toggle is switched on while Focusing is
    // the selected control — the counterpart of ScreenDrawManager.isDrawEnabled,
    // and what makes the panel reopen after a reload.
    //
    // NOT the same thing as `isArmed`, and it must not be derived from it:
    // isArmed is live overlay state written by the panel's mount effect, which
    // StrictMode double-invokes (mount -> cleanup -> mount), so persisting from
    // there would record a spurious close. This is the user's toggle INTENT,
    // written only on the explicit click.
    isPanelOpen = false;
    private lastMoveSyncAt = 0;
    // Rect captured at pointer-down and reused for the whole gesture: the
    // overlay cannot move while the pointer is captured, so the moves skip the
    // layout-forcing getBoundingClientRect that mapping each point would need.
    private gestureRect: DOMRect | null = null;
    private readonly settingAttempt = genTimeoutAttempt(SETTING_SYNC_MS);
    // Streamed updates (pointer moves, incoming syncs) repaint at most once per
    // frame; one-off changes call applyMask directly.
    private readonly scheduleMask = genFrameScheduler(() => {
        this.applyMask();
    });
    private readonly boundPointerDown = this.handlePointerDown.bind(this);
    private readonly boundPointerMove = this.handlePointerMove.bind(this);
    private readonly boundPointerUp = this.handlePointerUp.bind(this);
    private readonly boundFocus = this.handleFocus.bind(this);
    private readonly boundBlur = this.handleBlur.bind(this);

    constructor(screenManagerBase: ScreenManagerBase) {
        super(screenManagerBase);
        this.loadPersisted();
    }

    private get sizeKey() {
        return `${FOCUS_SIZE_PREFIX}${this.screenId}`;
    }

    private get colorKey() {
        return `${FOCUS_COLOR_PREFIX}${this.screenId}`;
    }

    private get dimKey() {
        return `${FOCUS_DIM_PREFIX}${this.screenId}`;
    }

    private get blurKey() {
        return `${FOCUS_BLUR_PREFIX}${this.screenId}`;
    }

    private get contrastKey() {
        return `${FOCUS_CONTRAST_PREFIX}${this.screenId}`;
    }

    private get openKey() {
        return `${FOCUS_OPEN_PREFIX}${this.screenId}`;
    }

    // Read by BOTH the presenter and the output window on construction, so the
    // first spotlight is already the right size and darkness without waiting for
    // a sync to land.
    private loadPersisted() {
        this.size = readPersistedNumber(
            this.sizeKey,
            DEFAULT_FOCUS_SIZE,
            FOCUS_SIZE_MIN,
            FOCUS_SIZE_MAX,
        );
        this.dimColor = toValidDimColor(getSetting(this.colorKey));
        this.dimOpacity = readPersistedNumber(
            this.dimKey,
            DEFAULT_FOCUS_DIM,
            FOCUS_DIM_MIN,
            FOCUS_DIM_MAX,
        );
        this.edgeBlur = readPersistedNumber(
            this.blurKey,
            DEFAULT_FOCUS_BLUR,
            FOCUS_BLUR_MIN,
            FOCUS_BLUR_MAX,
        );
        this.isContrast = getSetting(this.contrastKey) === 'true';
        // Only the PANEL is restored. `isSpotlighting` stays false whatever is
        // on disk: an app restart must never come back with the congregation's
        // screen dimmed.
        this.isPanelOpen = getSetting(this.openKey) === 'true';
    }

    // Written on the previewer toggle click (and when the 3-dots switches the
    // control type, so the on/off state follows the panel that is showing).
    // Immediate rather than debounced like the slider settings — it is one click
    // and losing it to a crash would silently change what reopens.
    setIsPanelOpen(isPanelOpen: boolean) {
        if (this.isPanelOpen === isPanelOpen) {
            return;
        }
        this.isPanelOpen = isPanelOpen;
        // Presenter only: settings are one shared file, so letting the output
        // windows write too would just race the presenter for the same key.
        if (appProvider.isPagePresenter) {
            setSetting(this.openKey, `${isPanelOpen}`);
        }
    }

    get isShowing() {
        return this.isSpotlighting;
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
        this._isSetUp = false;
        this.render();
    }

    private setupContainer() {
        const div = this._div;
        if (div === null) {
            return;
        }
        applyOverlayBoxStyle(div, this.screenManagerBase, this.isArmed);
        // Touch input drives the spotlight exactly like a mouse, so the browser
        // must not claim the gesture for panning/zooming first.
        div.style.touchAction = 'none';
        applyOverlayFocusability(div, this.isArmed);
        if (!this._isSetUp) {
            this._isSetUp = true;
            div.style.outline = 'none';
            // Only the presenter drives the spotlight; output windows just
            // render what they are told.
            if (!appProvider.isPageScreen) {
                div.addEventListener('pointerdown', this.boundPointerDown);
                div.addEventListener('focus', this.boundFocus);
                div.addEventListener('blur', this.boundBlur);
            }
        }
    }

    private handleFocus() {
        this.applyFocusOutline(true);
    }

    private handleBlur() {
        this.applyFocusOutline(false);
    }

    private applyFocusOutline(isOwningKeyboard: boolean) {
        if (this._div === null) {
            return;
        }
        applyKeyboardOutline(
            this._div,
            isOwningKeyboard,
            this.screenManagerBase.width,
        );
    }

    // Whether this screen's spotlight overlay currently owns the keyboard. The
    // size/dim shortcuts are gated on it. Named for the KEYBOARD, not the
    // feature — "focus" means two different things in this file.
    get isShortcutTarget() {
        return checkIsKeyboardTarget(this._div);
    }

    // Move/up live on the window, not the overlay, so a drag that wanders off
    // the mini-preview still tracks and — more importantly — still gets its
    // pointerup. Released together in stopTracking.
    private startTracking() {
        globalThis.addEventListener('pointermove', this.boundPointerMove);
        globalThis.addEventListener('pointerup', this.boundPointerUp);
        globalThis.addEventListener('pointercancel', this.boundPointerUp);
    }

    private stopTracking() {
        this.gestureRect = null;
        globalThis.removeEventListener('pointermove', this.boundPointerMove);
        globalThis.removeEventListener('pointerup', this.boundPointerUp);
        globalThis.removeEventListener('pointercancel', this.boundPointerUp);
    }

    private detachEventListeners() {
        if (this._div !== null) {
            this._div.removeEventListener('pointerdown', this.boundPointerDown);
            this._div.removeEventListener('focus', this.boundFocus);
            this._div.removeEventListener('blur', this.boundBlur);
        }
        this.applyFocusOutline(false);
        this.stopTracking();
    }

    private clientToNative(clientX: number, clientY: number) {
        const rect =
            this.gestureRect ?? this._div?.getBoundingClientRect() ?? null;
        return toNativePoint(rect, clientX, clientY, this.screenManagerBase);
    }

    // Press and hold: the screen dims while the pointer is down and the hole
    // follows it. Releasing undims. Works for mouse, pen and touch alike —
    // these are Pointer Events, and the overlay sets touch-action: none so a
    // finger drag is a spotlight rather than a page pan.
    private handlePointerDown(event: PointerEvent) {
        if (!this.isArmed) {
            return;
        }
        // Primary button only for mice. Touch and pen report button 0 on
        // contact, so this does not exclude them.
        if (event.button !== 0) {
            return;
        }
        // Cache the overlay rect for the whole gesture (see gestureRect).
        this.gestureRect = this._div?.getBoundingClientRect() ?? null;
        const point = this.clientToNative(event.clientX, event.clientY);
        if (point === null) {
            this.gestureRect = null;
            return;
        }
        event.preventDefault();
        // Claim the keyboard for this screen so the size/dim keys act on the
        // preview the user is actually pointing at.
        this._div?.focus?.({ preventScroll: true });
        this.isSpotlighting = true;
        this.point = point;
        try {
            this._div?.setPointerCapture?.(event.pointerId);
        } catch {
            // Synthetic events reject capture; the window-level listeners
            // below still track the gesture.
        }
        this.startTracking();
        this.applyMask();
        this.sendFocusMessage();
        this.lastMoveSyncAt = Date.now();
        this.fireUpdateEvent();
    }

    private handlePointerUp() {
        this.stopTracking();
        this.stop();
    }

    private handlePointerMove(event: PointerEvent) {
        if (!this.isSpotlighting) {
            return;
        }
        const point = this.clientToNative(event.clientX, event.clientY);
        if (point === null) {
            return;
        }
        this.point = point;
        // Local follow is never throttled to a clock — the presenter must track
        // the cursor exactly — but it is coalesced to one repaint per frame:
        // a precision mouse fires moves far above the refresh rate and every
        // extra full-overlay repaint is work the user can never see. Only what
        // goes over the wire is rate limited.
        this.scheduleMask();
        const now = Date.now();
        if (now - this.lastMoveSyncAt >= MOVE_SYNC_THROTTLE_MS) {
            this.lastMoveSyncAt = now;
            this.sendFocusMessage();
        }
    }

    // Arm/disarm from the focus panel. Disarming (panel closed or control type
    // switched back to Drawing) always drops the mask: leaving a screen dimmed
    // with no visible panel to undim it would be a trap mid-service.
    setIsArmed(isArmed: boolean) {
        if (this.isArmed === isArmed) {
            return;
        }
        this.isArmed = isArmed;
        if (this._div !== null) {
            this._div.style.pointerEvents = isArmed ? 'auto' : 'none';
            applyOverlayFocusability(this._div, isArmed);
        }
        if (!isArmed) {
            this.stopTracking();
            // Closing the panel must also drop the ring and this screen's claim
            // on the size/dim keys. blur() fires the listener that clears the
            // ring; clear it directly too for the case where it never had focus.
            this._div?.blur?.();
            this.applyFocusOutline(false);
            this.stop();
            return;
        }
        this.fireUpdateEvent();
    }

    // Back to the shipped defaults. Assigned in one go rather than through the
    // five setters so this costs ONE repaint, one update broadcast to every open
    // panel and one debounced write, instead of five of each.
    resetSettings() {
        this.size = DEFAULT_FOCUS_SIZE;
        this.dimColor = DEFAULT_FOCUS_COLOR;
        this.dimOpacity = DEFAULT_FOCUS_DIM;
        this.edgeBlur = DEFAULT_FOCUS_BLUR;
        this.isContrast = false;
        this.commitSettingChange();
    }

    stop() {
        if (!this.isSpotlighting) {
            return;
        }
        this.isSpotlighting = false;
        this.applyMask();
        this.sendFocusMessage();
        this.fireUpdateEvent();
    }

    // Repaint now (a slider drag must track the thumb), tell the open panels,
    // and trail the disk write + the broadcast behind the drag.
    private commitSettingChange() {
        this.applyMask();
        this.fireUpdateEvent();
        this.settingAttempt(() => {
            this.persistSettings();
            this.sendFocusMessage();
        });
    }

    setSize(size: number) {
        const clamped = clampNumber(size, FOCUS_SIZE_MIN, FOCUS_SIZE_MAX);
        if (this.size === clamped) {
            return;
        }
        this.size = clamped;
        this.commitSettingChange();
    }

    setDimColor(dimColor: string) {
        const validated = toValidDimColor(dimColor);
        if (this.dimColor === validated) {
            return;
        }
        this.dimColor = validated;
        this.commitSettingChange();
    }

    setDimOpacity(dimOpacity: number) {
        const clamped = clampNumber(dimOpacity, FOCUS_DIM_MIN, FOCUS_DIM_MAX);
        if (this.dimOpacity === clamped) {
            return;
        }
        this.dimOpacity = clamped;
        this.commitSettingChange();
    }

    setEdgeBlur(edgeBlur: number) {
        const clamped = clampNumber(edgeBlur, FOCUS_BLUR_MIN, FOCUS_BLUR_MAX);
        if (this.edgeBlur === clamped) {
            return;
        }
        this.edgeBlur = clamped;
        this.commitSettingChange();
    }

    setIsContrast(isContrast: boolean) {
        if (this.isContrast === isContrast) {
            return;
        }
        this.isContrast = isContrast;
        this.commitSettingChange();
    }

    // Presenter only: settings live in one shared file, so letting the output
    // windows write too would just race the presenter for the same keys.
    private persistSettings() {
        if (!appProvider.isPagePresenter) {
            return;
        }
        setSetting(this.sizeKey, `${this.size}`);
        setSetting(this.colorKey, this.dimColor);
        setSetting(this.dimKey, `${this.dimOpacity}`);
        setSetting(this.blurKey, `${this.edgeBlur}`);
        setSetting(this.contrastKey, `${this.isContrast}`);
    }

    private sendFocusMessage() {
        // Receiving a group sync sets this screen's echo-guard flag, which would
        // otherwise permanently block its own outgoing messages. Same fix as
        // ScreenDrawManager.sendDrawMessage.
        ScreenFocusManager.enableSyncGroup(this.screenId);
        this.screenManagerBase.sendScreenMessage(
            {
                screenId: this.screenId,
                type: 'focus',
                data: this.toFocusData(),
            },
            false,
        );
    }

    // Overwritten per-screen by setGroupMembershipInf in the ScreenManager
    // constructor; the stubs keep the class structurally a GroupMembershipInf.
    async getMemberInstances(): Promise<ScreenFocusManager[]> {
        return [];
    }
    async getMemberIds(): Promise<number[]> {
        return [];
    }
    async checkIsMainInstance(): Promise<boolean> {
        return false;
    }

    async sendSyncScreen() {
        ScreenFocusManager.enableSyncGroup(this.screenId);
        super.sendSyncScreen();
    }

    private toFocusData(): FocusDataType {
        return {
            isSpotlighting: this.isSpotlighting,
            point: this.point === null ? null : { ...this.point },
            size: this.size,
            dimColor: this.dimColor,
            dimOpacity: this.dimOpacity,
            edgeBlur: this.edgeBlur,
            isContrast: this.isContrast,
        };
    }

    toSyncMessage(): BasicScreenMessageType {
        return {
            type: 'focus',
            data: this.toFocusData(),
        };
    }

    fireUpdateEvent() {
        super.fireUpdateEvent();
        ScreenFocusManager.fireUpdateEvent();
    }

    receiveSyncScreen(message: ScreenMessageType) {
        const data: FocusDataType | null = message.data ?? null;
        if (data === null) {
            return;
        }
        this.isSpotlighting = data.isSpotlighting === true;
        // Clone: sync-group members share the same message object in-process,
        // so keeping the incoming point would let one screen's next move mutate
        // another's state (see the foreground-sync-shared-refs note).
        this.point =
            data.point === null || data.point === undefined
                ? null
                : { x: data.point.x, y: data.point.y };
        if (typeof data.size === 'number') {
            this.size = clampNumber(data.size, FOCUS_SIZE_MIN, FOCUS_SIZE_MAX);
        }
        if (data.dimColor !== undefined) {
            this.dimColor = toValidDimColor(data.dimColor);
        }
        if (typeof data.dimOpacity === 'number') {
            this.dimOpacity = clampNumber(
                data.dimOpacity,
                FOCUS_DIM_MIN,
                FOCUS_DIM_MAX,
            );
        }
        if (typeof data.edgeBlur === 'number') {
            this.edgeBlur = clampNumber(
                data.edgeBlur,
                FOCUS_BLUR_MIN,
                FOCUS_BLUR_MAX,
            );
        }
        this.isContrast = data.isContrast === true;
        // Incoming moves arrive on the sender's 40ms throttle: coalesce to a
        // frame like the local path rather than repainting per message.
        this.scheduleMask();
        this.fireUpdateEvent();
        forwardToOwnScreenOutput(this.screenManagerBase, 'focus', data);
    }

    // The one style update on the hot path: a single radial-gradient that is
    // both the hole and the dim. Sized in native screen px, exactly like the
    // stroke coordinates, so it lands identically on the scaled mini-preview
    // and the unscaled output.
    private applyMask() {
        const div = this._div;
        if (div === null) {
            return;
        }
        const point = this.point;
        if (!this.isSpotlighting || point === null) {
            div.style.background = 'none';
            return;
        }
        const radius = this.size / 2;
        // The dim is the chosen colour at `dimOpacity` alpha, as `#rrggbbaa`.
        const dim = `${this.dimColor}${toAlphaHex(this.dimOpacity)}`;
        // The gradient's stops span 0..radius and its LAST colour continues
        // outwards forever, which is what covers the rest of the screen.
        // edgeBlur is where the fade starts as a percentage of the radius, so 0
        // keeps the circle uniform right up to the rim = a hard edge.
        const solidStop = 100 - this.edgeBlur;
        // Contrast just swaps which side of the rim is dark: spotlight clears
        // the circle and dims the rest, contrast dims the circle and leaves the
        // rest of the screen alone (blocking what the pointer is over).
        // The clear side is the SAME colour at zero alpha, not the `transparent`
        // keyword: a soft edge interpolates between the two stops, and fading a
        // coloured dim towards transparent-black can tint the rim.
        const clear = `${this.dimColor}00`;
        const [inner, outer] = this.isContrast ? [dim, clear] : [clear, dim];
        div.style.background =
            `radial-gradient(circle ${radius}px at ${point.x}px ${point.y}px,` +
            ` ${inner} 0, ${inner} ${solidStop}%, ${outer} 100%)`;
    }

    render() {
        // Full path (div-set / 'refresh' event): a screen resize changes the
        // overlay dimensions, so re-apply the container styles then repaint.
        this.setupContainer();
        this.applyMask();
    }

    clear() {
        this.stop();
    }

    delete() {
        this.detachEventListeners();
        // Flush a slider drag that ended less than a debounce ago (isImmediate
        // also clears the timer, so no stale write fires after teardown).
        this.settingAttempt(() => {
            this.persistSettings();
        }, true);
        super.delete();
    }

    static receiveSyncScreen(message: ScreenMessageType) {
        const { screenId } = message;
        const screenFocusManager = this.getInstance(screenId);
        if (screenFocusManager === null) {
            showSimpleToast(
                'Failed to apply to screen. Please make sure the screen is open.',
                'error',
            );
            return;
        }
        screenFocusManager.receiveSyncScreen(message);
    }

    static getInstance(screenId: number) {
        return super.getInstanceBase<ScreenFocusManager>(screenId);
    }
}
