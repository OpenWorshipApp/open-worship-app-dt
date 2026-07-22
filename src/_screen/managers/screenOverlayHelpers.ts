import appProvider from '../../server/appProvider';
import type ScreenManagerBase from './ScreenManagerBase';
import type { DrawPaintPointType, ScreenType } from '../screenTypeHelpers';

// Shared by the screen's two INDEPENDENT overlays — `#draw` (ScreenDrawManager,
// strokes on a canvas) and `#focus` (ScreenFocusManager, a spotlight mask).
// They are separate features with separate layers and no shared state, but they
// occupy the same box, take pointer input the same way and claim the keyboard
// the same way. The fiddly parts of that (shadow-root focus, native-px
// coordinate mapping, the targeted-IPC forward) are subtle enough that having
// two copies drift apart is a real risk, so they live here once.

export function clampNumber(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

// 0..100 opacity -> the 2-digit hex alpha of `#rrggbbaa`. Canvas and CSS both
// render the 8-digit form, so keeping every colour in one notation is cheaper
// than parsing the hex triple back out into an `rgba()`.
export function toAlphaHex(opacity: number) {
    return Math.round((clampNumber(opacity, 0, 100) / 100) * 255)
        .toString(16)
        .padStart(2, '0');
}

// Ring around the overlay that currently owns the keyboard. Cyan (at ~47%
// alpha) so it reads against both the magenta selected-screen card border and
// whatever is on the slide underneath.
export const OVERLAY_KEYBOARD_OUTLINE_COLOR = '#0dcaf078';

// The overlay box itself: pinned over the whole screen, and transparent to the
// pointer unless its panel has armed it.
export function applyOverlayBoxStyle(
    div: HTMLDivElement,
    screenManagerBase: ScreenManagerBase,
    isArmed: boolean,
) {
    div.style.position = 'absolute';
    div.style.top = '0';
    div.style.left = '0';
    div.style.width = `${screenManagerBase.width}px`;
    div.style.height = `${screenManagerBase.height}px`;
    div.style.overflow = 'hidden';
    div.style.pointerEvents = isArmed ? 'auto' : 'none';
}

// Focusable ONLY while this overlay can actually be used: presenter side, panel
// armed. Otherwise it would sit in the tab order of every mini-preview and of
// the real output window, where tabbing onto it paints the "I own the keyboard"
// ring on an overlay that ignores every key. -1 (rather than dropping the
// attribute) keeps the programmatic focus() on pointer-down working.
export function applyOverlayFocusability(
    element: HTMLElement,
    isArmed: boolean,
) {
    element.tabIndex = isArmed && !appProvider.isPageScreen ? 0 : -1;
}

// Ring the mini-screen whose overlay owns the keyboard, so it is obvious which
// screen a shortcut is about to act on. `outline` rather than `border` because
// it takes no layout space: the overlay keeps its exact box and nothing
// reflows.
export function applyKeyboardOutline(
    element: HTMLElement,
    isOwningKeyboard: boolean,
    screenWidth: number,
) {
    if (!isOwningKeyboard) {
        element.style.outline = 'none';
        element.style.outlineOffset = '0';
        return;
    }
    // The overlay is sized in NATIVE screen px and then CSS-scaled down by the
    // previewer, so a fixed 2px ring would render sub-pixel. Scale the ring with
    // the screen width instead (1080p/480 = 4px -> ~1px on a mini-preview).
    const width = Math.max(2, Math.round(screenWidth / 480));
    element.style.outline = `${width}px solid ${OVERLAY_KEYBOARD_OUTLINE_COLOR}`;
    element.style.outlineOffset = `-${width}px`;
}

// Whether this element currently owns the keyboard. Gates every overlay
// shortcut, so a key can never quietly act on a screen the user is not working
// on.
export function checkIsKeyboardTarget(element: HTMLElement | null) {
    if (element === null || !element.isConnected) {
        return false;
    }
    // activeElement survives the window being deactivated, so without this a
    // key pressed in another app — or the click that merely brings the
    // presenter back to the foreground — would still count.
    if (typeof document.hasFocus === 'function' && !document.hasFocus()) {
        return false;
    }
    // The overlay lives in the mini-screen's shadow root, so focus has to be
    // read off that root: document.activeElement is only ever the shadow host.
    const root = element.getRootNode() as Document | ShadowRoot;
    return root.activeElement === element;
}

// Viewport coords -> NATIVE screen pixels. Everything an overlay stores or
// sends is in native px, so a gesture made on the CSS-scaled mini-preview lands
// in the same place on the unscaled output and on group members.
export function toNativePoint(
    rect: DOMRect | null,
    clientX: number,
    clientY: number,
    screenManagerBase: ScreenManagerBase,
): DrawPaintPointType | null {
    if (rect === null || rect.width === 0 || rect.height === 0) {
        return null;
    }
    return {
        x: ((clientX - rect.left) * screenManagerBase.width) / rect.width,
        y: ((clientY - rect.top) * screenManagerBase.height) / rect.height,
    };
}

// A group-synced update reached THIS screen's presenter manager, but the
// screenMessage IPC is TARGETED — electron routes it only to the ORIGIN
// screen's output window. So mirror it to this screen's own output window.
// Presenter only; and a RAW send (no enableSyncGroup) so the noSyncGroupMap
// echo guard stays set and it cannot loop back to the group. Output windows
// never reach here (isPagePresenter is false).
export function forwardToOwnScreenOutput(
    screenManagerBase: ScreenManagerBase,
    type: ScreenType,
    data: any,
) {
    if (!appProvider.isPagePresenter) {
        return;
    }
    screenManagerBase.sendScreenMessage(
        { screenId: screenManagerBase.screenId, type, data },
        false,
    );
}

// Coalesce repaints onto the display's frame boundary. Pointer moves arrive far
// above the refresh rate on a precision mouse (and wire updates arrive on their
// own throttle), and every one of them would otherwise force a full-overlay
// repaint that the user can never see. Falls back to running inline where
// requestAnimationFrame is unavailable (jsdom, headless).
export function genFrameScheduler(run: () => void) {
    let isScheduled = false;
    return () => {
        if (isScheduled) {
            return;
        }
        isScheduled = true;
        const tick = () => {
            isScheduled = false;
            run();
        };
        if (typeof globalThis.requestAnimationFrame === 'function') {
            globalThis.requestAnimationFrame(tick);
        } else {
            tick();
        }
    };
}
