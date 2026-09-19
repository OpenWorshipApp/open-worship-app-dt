import appProvider from '../../server/appProvider';
import type ScreenManagerBase from './ScreenManagerBase';
import type {
    DrawPaintPointType,
    DrawPaintStrokeType,
    ScreenType,
} from '../screenTypeHelpers';

// Shared by the screen's two INDEPENDENT overlays — `#draw` (ScreenDrawManager,
// strokes on a canvas) and `#focus` (ScreenFocusManager, a spotlight mask).
// They are separate features with separate layers and no shared state, but they
// occupy the same box, take pointer input the same way and claim the keyboard
// the same way. The fiddly parts of that (shadow-root focus, native-px
// coordinate mapping, the targeted-IPC forward) are subtle enough that having
// two copies drift apart is a real risk, so they live here once.
//
// The two PAINT primitives at the bottom (`paintStroke`, the canvas painter, and
// `buildSpotlightBackground`, the mask's one CSS value) are shared further
// still: the app-wide annotation overlay (`src/presenting-control`) draws over
// the whole presenter window with exactly the same brush and the same spotlight,
// just in window px instead of native screen px. Those two functions are pure —
// they touch no manager state and no IPC — which is what lets the app overlay
// reuse them without dragging any of the screen/sync machinery in.

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

// Paint ONE stroke onto an already-transformed 2D context. Pure: the caller owns
// the canvas, the transform (native screen px for a screen overlay, window px
// for the app-wide one) and the clear, so this is only ever "put these points on
// that context".
//
// `isHighQuality` here selects the CURVE SMOOTHING only — the supersampled
// backing store is the caller's business, since it is the caller that owns the
// canvas size.
export function paintStroke(
    ctx: CanvasRenderingContext2D,
    stroke: DrawPaintStrokeType,
    isHighQuality: boolean,
) {
    const points = stroke.points;
    if (points.length === 0) {
        return;
    }
    ctx.save();
    if (stroke.isEraser) {
        // Manual eraser: keep the destination only where the source is
        // transparent, so painting an opaque path here rubs out everything
        // already drawn beneath it. The stored color is irrelevant — only the
        // source alpha matters, so paint fully opaque.
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = '#000';
        ctx.fillStyle = '#000';
    } else {
        ctx.strokeStyle = stroke.color;
        ctx.fillStyle = stroke.color;
    }
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
    } else if (isHighQuality && points.length > 2) {
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

export type SpotlightMaskType = {
    point: DrawPaintPointType;
    // Hole DIAMETER, in the same px space as `point`.
    size: number;
    dimColor: string;
    // 0..100 alpha of the dim.
    dimOpacity: number;
    // Softness of the rim as a percentage of the radius; 0 = hard edge.
    edgeBlur: number;
    // Invert: dim the circle instead of everything around it.
    isContrast: boolean;
};

// The spotlight's ENTIRE paint: one radial-gradient that is both the hole and
// the dim, no extra element. Returns a `background` value.
//
// A moving `box-shadow` hole was tried first (compositor-only moves, no gradient
// repaint) and DOES NOT RENDER: the spread has to exceed the screen diagonal to
// cover the corners, and Chromium silently drops a shadow that large. Verified
// live — the element was present and styled, and nothing painted. Do not
// "optimize" back to it.
export function buildSpotlightBackground({
    point,
    size,
    dimColor,
    dimOpacity,
    edgeBlur,
    isContrast,
}: SpotlightMaskType) {
    const radius = size / 2;
    // The dim is the chosen colour at `dimOpacity` alpha, as `#rrggbbaa`.
    const dim = `${dimColor}${toAlphaHex(dimOpacity)}`;
    // The gradient's stops span 0..radius and its LAST colour continues outwards
    // forever, which is what covers the rest of the screen. edgeBlur is where the
    // fade starts as a percentage of the radius, so 0 keeps the circle uniform
    // right up to the rim = a hard edge.
    const solidStop = 100 - edgeBlur;
    // Contrast just swaps which side of the rim is dark: spotlight clears the
    // circle and dims the rest, contrast dims the circle and leaves the rest
    // alone (blocking what the pointer is over).
    // The clear side is the SAME colour at zero alpha, not the `transparent`
    // keyword: a soft edge interpolates between the two stops, and fading a
    // coloured dim towards transparent-black can tint the rim.
    const clear = `${dimColor}00`;
    const [inner, outer] = isContrast ? [dim, clear] : [clear, dim];
    return (
        `radial-gradient(circle ${radius}px at ${point.x}px ${point.y}px,` +
        ` ${inner} 0, ${inner} ${solidStop}%, ${outer} 100%)`
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
