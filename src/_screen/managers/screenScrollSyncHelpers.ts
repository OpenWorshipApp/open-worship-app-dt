// Leaf on purpose: `ScreenManagerBase` applies remote scrolls and
// `screenEventHelpers` sends local ones, and both read the same per-element
// state. Neither may pull the other in for it.

import {
    releaseSubPixelScroll,
    writeSubPixelScrollTop,
} from '../../scrolling/subPixelScrollHelpers';

export type ScrollPercentageType = { x: number; y: number };

export type ScrollSyncStateType = {
    callback:
        ((scroll: ScrollPercentageType, isFromWheel: boolean) => void) | null;
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
    getScrollSyncState(element).remoteAt = performance.now();
    const left = scroll.x * (element.scrollWidth - element.clientWidth);
    const top = scroll.y * (element.scrollHeight - element.clientHeight);
    if (isSubPixel) {
        // A mini preview's auto-scroll, one frame of it: glide by the same
        // fractions of a pixel instead of ticking whole ones.
        if (element.scrollLeft !== left) {
            element.scrollLeft = left;
        }
        writeSubPixelScrollTop(element, top);
        return;
    }
    releaseSubPixelScroll(element);
    element.scrollTo({ left, top });
}
