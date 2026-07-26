import {
    buildSpotlightBackground,
    clampNumber,
    genFrameScheduler,
} from '../_screen/managers/screenOverlayHelpers';
import { setSetting } from '../helper/settingHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import type { DrawPaintPointType } from '../_screen/screenTypeHelpers';
import {
    DEFAULT_FOCUS_BLUR,
    DEFAULT_FOCUS_COLOR,
    DEFAULT_FOCUS_DIM,
    DEFAULT_FOCUS_PARAMS,
    DEFAULT_FOCUS_SIZE,
    DEFAULT_IS_CONTRAST,
    DEFAULT_IS_HOLD_MODE,
    FOCUS_BLUR_MAX,
    FOCUS_BLUR_MIN,
    FOCUS_BLUR_SETTING_NAME,
    FOCUS_COLOR_SETTING_NAME,
    FOCUS_CONTRAST_SETTING_NAME,
    FOCUS_DIM_MAX,
    FOCUS_DIM_MIN,
    FOCUS_DIM_SETTING_NAME,
    FOCUS_HOLD_SETTING_NAME,
    FOCUS_SIZE_MAX,
    FOCUS_SIZE_MIN,
    FOCUS_SIZE_SETTING_NAME,
    readPersistedFocusParams,
    toPresentingSettingKey,
    toValidHexColor,
    type PresentingFocusParamsType,
} from './presentingControlHelpers';

// Spotlight over the whole presenter window. Same single-radial-gradient mask as
// the screen spotlight (see `buildSpotlightBackground`), in window CSS px, with
// one addition the screen version has no use for: a FOLLOW mode.
//
// On a screen the operator drags on a small preview, so press-and-hold is the
// only sensible gesture. Here the pointer is already on the thing being talked
// about, so the default is for the spotlight to simply follow it while the tool
// is selected; Hold is offered for the "dim only on demand" case.
//
// The mask is DOM, not a canvas: a window-sized backing store would be ~8MB
// (~33MB supersampled) held for as long as the tool is open, for an effect that
// is one circle.
//
// Every pointer listener is on the OVERLAY, not the window. The armed overlay
// covers the whole window, so the only places the pointer can go are the toolbar
// and outside the app — and in both of those the spotlight should drop, which is
// exactly what the overlay's own `pointerleave` gives for free.

// Sliders would otherwise write to disk dozens of times per drag. The mask
// itself updates immediately; only the persist trails.
const SETTING_SYNC_MS = 150;

export default class PresentingFocusManager {
    private _div: HTMLDivElement | null = null;
    // Whether the mask is currently painted. In follow mode this is true from
    // the first pointer move until the pointer leaves the overlay or the tool is
    // deselected; in hold mode, only while the button is down.
    isSpotlighting = false;
    point: DrawPaintPointType | null = null;
    size = DEFAULT_FOCUS_SIZE;
    dimColor = DEFAULT_FOCUS_COLOR;
    dimOpacity = DEFAULT_FOCUS_DIM;
    edgeBlur = DEFAULT_FOCUS_BLUR;
    // false = spotlight (clear circle, dimmed surroundings).
    // true  = contrast (dimmed circle, clear surroundings) — blocks the area
    // under the pointer rather than highlighting it.
    isContrast = DEFAULT_IS_CONTRAST;
    isHoldMode = DEFAULT_IS_HOLD_MODE;
    // The focus tool is selected, so the overlay accepts pointer input.
    isArmed = false;
    // Rect captured on the first event of a run and reused for its moves: the
    // fixed overlay cannot move, so this skips a layout-forcing
    // getBoundingClientRect per sample. Dropped on resize via `render()`.
    private overlayRect: DOMRect | null = null;
    private readonly updateListenerSet = new Set<() => void>();
    private readonly settingAttempt = genTimeoutAttempt(SETTING_SYNC_MS);
    private readonly scheduleMask = genFrameScheduler(() => {
        this.applyMask();
    });
    private readonly boundPointerDown = this.handlePointerDown.bind(this);
    private readonly boundPointerMove = this.handlePointerMove.bind(this);
    private readonly boundPointerUp = this.handlePointerUp.bind(this);
    private readonly boundPointerLeave = this.handlePointerLeave.bind(this);

    constructor() {
        this.applyParams(readPersistedFocusParams());
    }

    // The one place the six settings are copied onto the engine — off disk on
    // construction, off the shipped defaults on reset. Anything else assigns a
    // single field through its own setter.
    private applyParams(params: PresentingFocusParamsType) {
        this.size = params.size;
        this.dimColor = params.dimColor;
        this.dimOpacity = params.dimOpacity;
        this.edgeBlur = params.edgeBlur;
        this.isContrast = params.isContrast;
        this.isHoldMode = params.isHoldMode;
    }

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

    set div(div: HTMLDivElement | null) {
        if (this._div === div) {
            return;
        }
        this.detachEventListeners();
        this._div = div;
        if (div !== null) {
            div.addEventListener('pointerdown', this.boundPointerDown);
            div.addEventListener('pointermove', this.boundPointerMove);
            div.addEventListener('pointerup', this.boundPointerUp);
            div.addEventListener('pointercancel', this.boundPointerUp);
            div.addEventListener('pointerleave', this.boundPointerLeave);
        }
        this.applyMask();
    }

    // Arm/disarm from the toolbar. Disarming always drops the mask: leaving the
    // app dimmed with the tool no longer selected would be a trap mid-service.
    setIsArmed(isArmed: boolean) {
        if (this.isArmed === isArmed) {
            return;
        }
        this.isArmed = isArmed;
        if (!isArmed) {
            // `stop()` is a no-op when the mask was never up, so the panel is
            // told either way rather than only on the dimmed-to-clear path.
            this.stop();
        }
        this.fireUpdateEvent();
    }

    // The window resized: the cached overlay rect is stale, and the mask is
    // positioned against it.
    render() {
        this.overlayRect = null;
        this.scheduleMask();
    }

    private clientToLocal(clientX: number, clientY: number) {
        if (this.overlayRect === null) {
            this.overlayRect = this._div?.getBoundingClientRect() ?? null;
        }
        const rect = this.overlayRect;
        if (rect === null || rect.width === 0 || rect.height === 0) {
            return null;
        }
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    // Follow mode needs no press at all — a move over the armed overlay is the
    // whole gesture. Hold mode ignores moves until the button goes down.
    private handlePointerMove(event: PointerEvent) {
        if (!this.isArmed) {
            return;
        }
        if (this.isHoldMode && !this.isSpotlighting) {
            return;
        }
        const point = this.clientToLocal(event.clientX, event.clientY);
        if (point === null) {
            return;
        }
        const wasSpotlighting = this.isSpotlighting;
        this.point = point;
        this.isSpotlighting = true;
        // A precision mouse fires moves far above the refresh rate and every
        // extra full-overlay repaint is work the user can never see, so the
        // repaint is coalesced to one per frame.
        this.scheduleMask();
        // Only the on/off transition is worth a re-render; the panel shows no
        // coordinates.
        if (!wasSpotlighting) {
            this.fireUpdateEvent();
        }
    }

    private handlePointerDown(event: PointerEvent) {
        if (!this.isArmed || event.button !== 0) {
            return;
        }
        const point = this.clientToLocal(event.clientX, event.clientY);
        if (point === null) {
            return;
        }
        // Stops the press from starting a text selection over the app beneath.
        event.preventDefault();
        const wasSpotlighting = this.isSpotlighting;
        this.point = point;
        this.isSpotlighting = true;
        this.applyMask();
        if (!wasSpotlighting) {
            this.fireUpdateEvent();
        }
    }

    private handlePointerUp() {
        // Follow mode keeps the spotlight on after the press; only hold mode
        // undims on release.
        if (this.isHoldMode) {
            this.stop();
        }
    }

    // The pointer left the overlay — onto the toolbar, or out of the window. A
    // spotlight frozen at the last position it saw is just a dim patch nobody is
    // pointing at.
    private handlePointerLeave() {
        this.stop();
    }

    private detachEventListeners() {
        const div = this._div;
        if (div === null) {
            return;
        }
        div.removeEventListener('pointerdown', this.boundPointerDown);
        div.removeEventListener('pointermove', this.boundPointerMove);
        div.removeEventListener('pointerup', this.boundPointerUp);
        div.removeEventListener('pointercancel', this.boundPointerUp);
        div.removeEventListener('pointerleave', this.boundPointerLeave);
    }

    stop() {
        if (!this.isSpotlighting) {
            return;
        }
        this.isSpotlighting = false;
        this.applyMask();
        this.fireUpdateEvent();
    }

    // Repaint now (a slider drag must track the thumb), tell the panel, and
    // trail the disk write behind the drag.
    private commitSettingChange() {
        this.applyMask();
        this.fireUpdateEvent();
        this.settingAttempt(() => {
            this.persistSettings();
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
        const validated = toValidHexColor(dimColor, DEFAULT_FOCUS_COLOR);
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

    setIsHoldMode(isHoldMode: boolean) {
        if (this.isHoldMode === isHoldMode) {
            return;
        }
        this.isHoldMode = isHoldMode;
        // Switching INTO hold with the mask already up would strand it on until
        // the next press/release pair, so drop it and wait for the press.
        if (isHoldMode) {
            this.stop();
        }
        this.commitSettingChange();
    }

    // Back to the shipped defaults in one go, so this costs ONE repaint, one
    // panel update and one debounced write instead of six of each.
    resetSettings() {
        this.applyParams(DEFAULT_FOCUS_PARAMS);
        // Resetting can land on Follow while the mask is up from a hold; that is
        // fine, but landing on Hold with the mask up would strand it, so use the
        // same guard the setter does.
        if (this.isHoldMode) {
            this.stop();
        }
        this.commitSettingChange();
    }

    private persistSettings() {
        setSetting(
            toPresentingSettingKey(FOCUS_SIZE_SETTING_NAME),
            `${this.size}`,
        );
        setSetting(
            toPresentingSettingKey(FOCUS_COLOR_SETTING_NAME),
            this.dimColor,
        );
        setSetting(
            toPresentingSettingKey(FOCUS_DIM_SETTING_NAME),
            `${this.dimOpacity}`,
        );
        setSetting(
            toPresentingSettingKey(FOCUS_BLUR_SETTING_NAME),
            `${this.edgeBlur}`,
        );
        setSetting(
            toPresentingSettingKey(FOCUS_CONTRAST_SETTING_NAME),
            `${this.isContrast}`,
        );
        setSetting(
            toPresentingSettingKey(FOCUS_HOLD_SETTING_NAME),
            `${this.isHoldMode}`,
        );
    }

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
        div.style.background = buildSpotlightBackground({
            point,
            size: this.size,
            dimColor: this.dimColor,
            dimOpacity: this.dimOpacity,
            edgeBlur: this.edgeBlur,
            isContrast: this.isContrast,
        });
    }

    // Stopping the controller. Like the draw engine's, this is RE-ENTRANT: a
    // StrictMode remount deletes and then hands the element straight back, and
    // `set div` repaints — so the run state has to be cleared here, or the
    // remounted overlay comes back dimmed at the last point it saw, with no tool
    // armed and nothing left listening to undim it.
    delete() {
        this.detachEventListeners();
        this.updateListenerSet.clear();
        // Flush a slider drag that ended less than a debounce ago (isImmediate
        // also clears the timer, so no stale write fires after teardown).
        this.settingAttempt(() => {
            this.persistSettings();
        }, true);
        this.isArmed = false;
        this.isSpotlighting = false;
        this.point = null;
        this.overlayRect = null;
        this._div = null;
    }
}
