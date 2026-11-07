// Leaf on purpose, beside `screenScrollSyncHelpers`, whose state it reads:
// `ScreenLongTextManager` brings a selected verse or row into view with it,
// on the mini screens and on the projector alike.

import {
    getScrollSyncState,
    markProgrammaticScroll,
} from './screenScrollSyncHelpers';

/**
 * A selected verse or row is brought into view on a screen by a GLIDE: quick
 * to leave, then slower and slower into place -- an ease-out. The browser's
 * own smooth scroll eases in AND out over a short time bound to the distance,
 * so a long move read as a lurch to a room reading along (the user,
 * 2026-11-06: _should be ease in fast to slow, let say while user reading and
 * it move quickly this will cause distruptioin_).
 *
 * The time is counted in SCREEN HEIGHTS travelled, not pixels: a mini screen
 * and the projector hold the same rows at two sizes, and each glides on its
 * own layout (`bible-screen-view-selected-index`), so they arrive together.
 */
export const MIN_GLIDE_MS = 450;
export const MAX_GLIDE_MS = 900;
const GLIDE_MS_PER_VIEW = 300;

export type GlideBlockType = 'start' | 'center' | 'nearest';

// One glide per scroller: a new selection takes over from the last.
const glideFrameMap = new WeakMap<HTMLElement, number>();

export function easeOutCubic(progress: number) {
    return 1 - (1 - progress) ** 3;
}

export function toGlideDuration(distance: number, viewHeight: number) {
    const views = Math.abs(distance) / Math.max(viewHeight, 1);
    return Math.min(
        MAX_GLIDE_MS,
        Math.max(MIN_GLIDE_MS, MIN_GLIDE_MS + views * GLIDE_MS_PER_VIEW),
    );
}

/**
 * The element that scrolls `dom`: the nearest one up to `boundary` (the
 * screen's own view) that can scroll. Never one past it -- the browser's
 * `scrollIntoView` also scrolled the presenter's panels around a mini
 * screen.
 */
function findScroller(dom: Element, boundary: HTMLElement) {
    if (!boundary.contains(dom)) {
        return null;
    }
    let element = dom.parentElement;
    while (element !== null) {
        const { overflowY } = getComputedStyle(element);
        if (overflowY === 'auto' || overflowY === 'scroll') {
            return element;
        }
        if (element === boundary) {
            return null;
        }
        element = element.parentElement;
    }
    return null;
}

/**
 * Where `scroller` has to be for `dom` to sit at `block`, as
 * `scrollIntoView` places it; null when it is already where `nearest` wants
 * it. Measured on the screen, then read back in the scroller's own pixels: a
 * mini screen is the screen drawn under a `scale`.
 */
export function toGlideTargetTop(
    scroller: HTMLElement,
    dom: Element,
    block: GlideBlockType,
) {
    const scrollerRect = scroller.getBoundingClientRect();
    const domRect = dom.getBoundingClientRect();
    const scale =
        scroller.offsetHeight > 0
            ? scrollerRect.height / scroller.offsetHeight
            : 1;
    const ratio = scale > 0 ? scale : 1;
    const viewHeight = scroller.clientHeight;
    const height = domRect.height / ratio;
    const top =
        (domRect.top - scrollerRect.top) / ratio -
        scroller.clientTop +
        scroller.scrollTop;
    let targetTop: number;
    if (block === 'start') {
        targetTop = top;
    } else if (block === 'center') {
        targetTop = top - (viewHeight - height) / 2;
    } else if (top < scroller.scrollTop) {
        targetTop = top;
    } else if (top + height > scroller.scrollTop + viewHeight) {
        // Taller than the view: its start, as the browser does.
        targetTop = height > viewHeight ? top : top + height - viewHeight;
    } else {
        return null;
    }
    const maxTop = Math.max(scroller.scrollHeight - viewHeight, 0);
    return Math.min(maxTop, Math.max(0, targetTop));
}

export function cancelScrollGlide(scroller: HTMLElement) {
    const frame = glideFrameMap.get(scroller);
    if (frame !== undefined) {
        cancelAnimationFrame(frame);
        glideFrameMap.delete(scroller);
    }
}

/**
 * Glide `scroller` to `targetTop`. Every frame is marked as this window's own
 * scroll (`markProgrammaticScroll`), however late a slow machine draws it, so
 * none of it goes out to the other windows as the operator's -- each of them
 * glides on its own. A wheel or a press on the scroller takes it back at once:
 * the glide stops where it is.
 */
export function glideScrollTop(scroller: HTMLElement, targetTop: number) {
    cancelScrollGlide(scroller);
    const fromTop = scroller.scrollTop;
    const distance = targetTop - fromTop;
    if (Math.abs(distance) < 1) {
        return;
    }
    markProgrammaticScroll(scroller);
    if (typeof requestAnimationFrame !== 'function') {
        scroller.scrollTop = targetTop;
        return;
    }
    const state = getScrollSyncState(scroller);
    const startedAt = performance.now();
    const duration = toGlideDuration(distance, scroller.clientHeight);
    const step = (now: number) => {
        if (state.inputAt > startedAt) {
            glideFrameMap.delete(scroller);
            return;
        }
        const progress = Math.min(1, Math.max(0, (now - startedAt) / duration));
        markProgrammaticScroll(scroller);
        scroller.scrollTop = fromTop + distance * easeOutCubic(progress);
        if (progress < 1) {
            glideFrameMap.set(scroller, requestAnimationFrame(step));
        } else {
            glideFrameMap.delete(scroller);
        }
    };
    glideFrameMap.set(scroller, requestAnimationFrame(step));
}

/** `scrollIntoView` for a screen's text, as a glide (see above). */
export function glideDomIntoView(
    dom: Element,
    block: GlideBlockType,
    boundary: HTMLElement,
) {
    const scroller = findScroller(dom, boundary);
    if (scroller === null) {
        return;
    }
    const targetTop = toGlideTargetTop(scroller, dom, block);
    if (targetTop !== null) {
        glideScrollTop(scroller, targetTop);
    }
}
