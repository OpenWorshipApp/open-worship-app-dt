// Leaf on purpose: `ScreenManagerBase` applies remote scrolls, the managers
// send local ones (`registerScrollingSyncEvent`, re-exported by
// `screenEventHelpers` for them) and the Bible columns do both, and all of
// them read the same per-element state. None may pull another in for it.

import {
    checkIsSubPixelScrolling,
    releaseSubPixelScroll,
    writeSubPixelScrollTop,
} from '../../scrolling/subPixelScrollHelpers';

export type ScrollPercentageType = { x: number; y: number };

export type ScrollSyncStateType = {
    callback:
        ((scroll: ScrollPercentageType, isFromWheel: boolean) => void) | null;
    // Told after a sync message scrolled the element, sub-pixel frames
    // included -- those move it without a scroll event. What scrolls WITH the
    // element follows from here: the other Bible columns of its screen.
    onRemoteScroll: (() => void) | null;
    // Last wheel on the element itself.
    wheelAt: number;
    // Last operator input on the element: a wheel, or a press -- a scrollbar
    // grab, the "to the top" button, the auto-scroll button.
    inputAt: number;
    // Last scroll a sync message applied to the element.
    remoteAt: number;
};

// Weak: the vary-document previewer builds a fresh container on every render.
const scrollSyncStateMap = new WeakMap<HTMLElement, ScrollSyncStateType>();

export function getScrollSyncState(element: HTMLElement) {
    let state = scrollSyncStateMap.get(element);
    if (state === undefined) {
        state = {
            callback: null,
            onRemoteScroll: null,
            wheelAt: Number.NEGATIVE_INFINITY,
            inputAt: Number.NEGATIVE_INFINITY,
            remoteAt: Number.NEGATIVE_INFINITY,
        };
        scrollSyncStateMap.set(element, state);
    }
    return state;
}

export function applyRemoteScrollPercentage(
    element: HTMLElement,
    scroll: ScrollPercentageType,
    isSubPixel = false,
) {
    // Marked BEFORE the scroll, and read -- never consumed -- by
    // `registerScrollingSyncEvent`: every scroll event that follows within the
    // quiet window is this one's, however many there are.
    const state = getScrollSyncState(element);
    state.remoteAt = performance.now();
    const left = scroll.x * (element.scrollWidth - element.clientWidth);
    const top = scroll.y * (element.scrollHeight - element.clientHeight);
    if (isSubPixel) {
        // A mini preview's auto-scroll, one frame of it: glide by the same
        // fractions of a pixel instead of ticking whole ones.
        if (element.scrollLeft !== left) {
            element.scrollLeft = left;
        }
        writeSubPixelScrollTop(element, top);
    } else {
        releaseSubPixelScroll(element);
        element.scrollTo({ left, top });
    }
    state.onRemoteScroll?.();
}

// How long after a wheel on a container its scroll events still count as the
// operator's: Chrome animates a wheel notch over ~200ms and a touchpad's
// momentum arrives as more wheels; the rest is headroom for a slow machine,
// whose frames -- and so whose scroll events -- run late.
const WHEEL_SCROLL_WINDOW_MS = 1000;

// How long after a sync message scrolled a container the scroll events it
// fires are still that message's, unless the operator touched the container
// since. A remote scroll is never just the one event its `scrollTo` fires: the
// bible view's header shrinks over the first 118px and reflows the table, the
// browser's scroll anchoring and clamping answer that a frame or more later,
// and a slow machine is later still.
const REMOTE_SCROLL_QUIET_MS = 1000;

export function registerScrollingSyncEvent(
    divHaftScale: HTMLElement,
    callback: (scroll: { x: number; y: number }, isFromWheel: boolean) => void,
) {
    // Once per element, the latest callback answering. The bible view is
    // handed the same div again every time its host's effect re-runs, and
    // each pass used to stack another pair of listeners.
    const state = getScrollSyncState(divHaftScale);
    const isRegistered = state.callback !== null;
    state.callback = callback;
    if (isRegistered) {
        return;
    }
    // A wheel only reaches this element from a pointer over it, so the scroll
    // it drives is the operator's. It used to be cancelled unless
    // `getIsMouseOverApp()` and `getIsWindowFocused()` agreed, and neither
    // does when it matters: the first waits for a mouse MOVE after a (re)load,
    // so a pointer already resting on a mini screen scrolled nothing, and the
    // second is false for a window the pointer only hovers (the OS wheels the
    // window under the pointer), so the mini screen was dead until clicked.
    // Passive now, which also lets the browser scroll off the main thread.
    divHaftScale.addEventListener(
        'wheel',
        () => {
            state.wheelAt = state.inputAt = performance.now();
        },
        { passive: true },
    );
    divHaftScale.addEventListener(
        'pointerdown',
        () => {
            state.inputAt = performance.now();
        },
        { passive: true },
    );
    divHaftScale.addEventListener('scroll', (event) => {
        event.preventDefault();
        const now = performance.now();
        const isFromWheel =
            state.wheelAt > state.remoteAt &&
            now - state.wheelAt < WHEEL_SCROLL_WINDOW_MS;
        // Sliding by fractions of a pixel means an auto-scroll is driving it
        // -- this window's own, or a mini preview's sent frame by frame -- and
        // its driver broadcasts the exact position itself. Its offsets,
        // rounded to a pixel, used to echo back and knock the preview it came
        // from off its slide every few frames: the preview shook. Only a
        // wheel speaks for it.
        if (checkIsSubPixelScrolling(divHaftScale) && !isFromWheel) {
            return;
        }
        // A scroll a sync message set off (`applyRemoteScrollPercentage`)
        // must not be broadcast back, or two windows -- or two grouped mini
        // screens -- echo each other's scroll forever. It used to be a stamp
        // that the first scroll event matched and CONSUMED, so a second
        // listener on the same div, or the reflow's follow-up event, found it
        // gone and sent the remote position straight back out. Now every
        // event inside the quiet window is swallowed, unless the operator
        // wheeled or pressed this container after the remote scroll landed.
        if (
            state.inputAt < state.remoteAt &&
            now - state.remoteAt < REMOTE_SCROLL_QUIET_MS
        ) {
            return;
        }
        state.callback?.(
            {
                x:
                    divHaftScale.scrollLeft /
                    (divHaftScale.scrollWidth - divHaftScale.clientWidth),
                y:
                    divHaftScale.scrollTop /
                    (divHaftScale.scrollHeight - divHaftScale.clientHeight),
            },
            isFromWheel,
        );
    });
}
