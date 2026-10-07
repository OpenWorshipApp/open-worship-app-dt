import { tran } from '../lang/langHelpers';
import {
    PLAY_TO_BOTTOM_CLASSNAME,
    PLAY_TO_BOTTOM_MENU_CLASSNAME,
    TO_THE_TOP_CLASSNAME,
    getSubPixelScrollTop,
    releaseSubPixelScroll,
    writeSubPixelScrollTop,
} from './subPixelScrollHelpers';

export {
    PLAY_TO_BOTTOM_CLASSNAME,
    PLAY_TO_BOTTOM_MENU_CLASSNAME,
    TO_THE_TOP_CLASSNAME,
};
export const TO_THE_TOP_STYLE_STRING = `
.${PLAY_TO_BOTTOM_CLASSNAME} {
    padding: 0;
    margin: 0;
    font-size: 30px;
    text-align: center;
    position: absolute;
    right: 5px;
    bottom: 30px;
    opacity: 0.1;
    transition: opacity 0.3s ease-in-out;
    cursor: pointer;
}
.${PLAY_TO_BOTTOM_CLASSNAME}[data-speed]:not([data-speed=""]) {
    opacity: 0.4;
}
.${PLAY_TO_BOTTOM_CLASSNAME}:hover {
    opacity: 1;
}
/*
 * The auto-scroll button's own menu button, which says out loud what the four
 * mouse gestures on that button do.
 *
 * It has to dress itself here rather than lean on the shared
 * ".app-context-menu-dots" chrome, because this sheet is also injected into the
 * SCREEN's shadow root, where none of the app's stylesheets reach and the whole
 * control is built by hand out of an img.
 *
 * In the app document those same declarations lose to the shared chrome, which
 * is the intent - one look for every menu dots button in the app. Only "display"
 * has to be fought for, and only there: the shared rule sets "inline-flex"
 * unconditionally, so the two .app-qualified rules below out-specify it while
 * the bare ones carry the shadow root.
 */
.${PLAY_TO_BOTTOM_MENU_CLASSNAME} {
    display: none;
    position: absolute;
    box-sizing: border-box;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 5px;
    background-color: transparent;
    color: inherit;
    line-height: 1;
    opacity: 0.1;
    transition: opacity 0.3s ease-in-out;
    cursor: pointer;
}
/*
 * Shown only while auto-scroll is actually running. The speed data attribute is
 * already the state of record - the rule above dims the chevron on it - so the
 * whole visibility question is one sibling selector, with no React state, no
 * subscription and no observer. It follows that the button must come AFTER the
 * chevron, since the sibling combinator only reaches forward. It also inherits
 * "hidden when the view cannot scroll" for free: a view that cannot scroll can
 * never be scrolling.
 */
.${PLAY_TO_BOTTOM_CLASSNAME}[data-speed]:not([data-speed=""])
    ~ .${PLAY_TO_BOTTOM_MENU_CLASSNAME} {
    display: inline-flex;
}
.${PLAY_TO_BOTTOM_MENU_CLASSNAME}:hover,
.${PLAY_TO_BOTTOM_MENU_CLASSNAME}:focus-visible {
    opacity: 1;
}
.app .${PLAY_TO_BOTTOM_MENU_CLASSNAME}.app-context-menu-dots {
    display: none;
}
.app
    .${PLAY_TO_BOTTOM_CLASSNAME}[data-speed]:not([data-speed=""])
    ~ .${PLAY_TO_BOTTOM_MENU_CLASSNAME}.app-context-menu-dots {
    display: inline-flex;
}
.${TO_THE_TOP_CLASSNAME} {
    padding: 0;
    margin: 0;
    border-radius: 50%;
    font-size: 30px;
    text-align: center;
    position: absolute;
    right: 5px;
    bottom: 5px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
}
.${TO_THE_TOP_CLASSNAME}.asking-to-top {
    opacity: 0.4;
}
.${TO_THE_TOP_CLASSNAME}.show {
    opacity: 0.1;
    pointer-events: all;
    cursor: pointer;
}
.${TO_THE_TOP_CLASSNAME}.show:hover {
    opacity: 1;
}
`;
function checkElement(parent: HTMLElement, element: HTMLElement) {
    if (parent.scrollTop > 0) {
        element.classList.add('show');
    } else {
        element.classList.remove('show');
    }
}
export function applyToTheTop(
    element: HTMLElement,
    // The box that really scrolls is not always the button's own parent: in a
    // floating widget the list is the full height of its content and the
    // widget's body is what scrolls it. Named by selector rather than resolved
    // by measuring, so it is found even while the list is still empty.
    scrollingContainerSelector?: string,
) {
    // Translated at the call, never at module scope: this is the tooltip in
    // every list of every window, and it used to stay English in Khmer.
    element.title = tran('Click or Double Click to scroll to the top');
    const parent = scrollingContainerSelector
        ? element.closest<HTMLElement>(scrollingContainerSelector)
        : element.parentElement;
    if (parent === null) {
        return;
    }
    // This is applied from an inline ref callback, which React runs again on
    // every re-render — drop the listener the previous run left behind instead
    // of stacking another one on the scroller for the life of the list.
    const previousScrollCallback = (element as any)._scrollCallback;
    if (previousScrollCallback !== undefined) {
        parent.removeEventListener('scroll', previousScrollCallback);
    }
    const scrollCallback = ((element as any)._scrollCallback = () => {
        checkElement(parent, element);
    });
    parent.addEventListener('scroll', scrollCallback);
    const bringToTop = (event: any) => {
        preventEvent(event);
        const targetElement = parent.querySelector<HTMLElement>(
            '.' + PLAY_TO_BOTTOM_CLASSNAME,
        );
        if (targetElement?.dataset['speed']) {
            parent.classList.add('asking-to-top');
        } else {
            parent.scrollTo({
                top: 0,
                behavior: 'smooth',
            });
        }
    };
    element.ondblclick = bringToTop;
    element.onclick = (event: any) => {
        const playingElement = parent.querySelector(
            `.${PLAY_TO_BOTTOM_CLASSNAME}[data-speed]:not([data-speed=""])`,
        );
        if (playingElement !== null) {
            return;
        }
        bringToTop(event);
    };
    checkElement(parent, element);
}

// A speed keeps the meaning it always had -- CSS px per 60Hz frame on the
// Reader's default 35px text -- but is now applied per SECOND and scaled by the
// size the text is shown at. A per-frame step ran at half speed on a 30fps
// machine, and a bigger font read more slowly at the same speed.
const SPEED_FONT_SIZE = 35;
const SPEED_FRAME_RATE = 60;
const BASE_SPEED = 0.05;
// Re-read while playing, so a font-size change takes effect mid-scroll.
const FONT_MEASURE_MS = 500;
// The longest frame gap honoured in full: after a stall (a busy machine, a
// hidden window) the text carries on instead of leaping ahead.
const MAX_FRAME_MS = 100;
// The text whose size sets the pace: a verse in a bible view or on a screen.
const FONT_SAMPLE_SELECTOR = '[data-kjv-verse-key]';

type PlayToBottomStoreType = {
    speed: number;
    // The exact position, as a float, drawn to the sub-pixel
    // (`writeSubPixelScrollTop`). Reading the browser's whole-pixel offset
    // back each frame made a slow scroll advance in uneven hops.
    scrollTop: number;
    // The position last written, to tell a hand on the wheel or the scrollbar
    // from this loop's own writes.
    writtenTop: number | null;
    frameTime: number | null;
    fontScale: number;
    fontMeasuredAt: number;
    isRunning: boolean;
    onFrame?: AutoScrollFrameType;
};

/**
 * Every frame the auto-scroll moves, with its exact position, then once more
 * with `isPlaying` false when it stops -- so whatever follows it (a projector,
 * the panes of a sync group) can drop its sub-pixel slide too.
 */
export type AutoScrollFrameType = (
    scrollTop: number,
    isPlaying: boolean,
) => void;

/**
 * The auto-scroll state, hung off the button itself rather than held in the
 * closure that set the handlers up.
 *
 * `applyPlayToBottom` runs from an inline `ref` callback, so React re-runs it on
 * EVERY render of the host. A per-call `{ speed: 0 }` meant that after any
 * re-render `store.speed` read 0 while `data-speed` still said `0.21` — so the
 * next right-click computed `0 - 0.07`, clamped to zero and STOPPED the scroll
 * instead of slowing it. The running latch lives here for the same reason: a
 * re-render would otherwise arm a second animation loop over the same scroller
 * and the page would run away at double speed.
 */
function getPlayToBottomStore(element: HTMLElement): PlayToBottomStoreType {
    const anyElement = element as any;
    anyElement._playToBottomStore ??= {
        speed: 0,
        scrollTop: 0,
        writtenTop: null,
        frameTime: null,
        fontScale: 1,
        fontMeasuredAt: Number.NEGATIVE_INFINITY,
        isRunning: false,
    };
    return anyElement._playToBottomStore;
}

function toVisualScale(element: HTMLElement) {
    const height = element.offsetHeight;
    const scale =
        height > 0 ? element.getBoundingClientRect().height / height : 1;
    return scale > 0 ? scale : 1;
}

/**
 * How big the text LOOKS inside the scroller, against `SPEED_FONT_SIZE`. A
 * screen's mini preview draws the projector's text inside a
 * `transform: scale(...)`: its computed font size is the projector's, but it
 * scrolls a box a fraction of that size.
 */
function measureFontScale(parent: HTMLElement) {
    const sample =
        parent.querySelector<HTMLElement>(FONT_SAMPLE_SELECTOR) ?? parent;
    const fontSize = Number.parseFloat(getComputedStyle(sample).fontSize);
    if (!(fontSize > 0)) {
        return 1;
    }
    const scale =
        sample === parent ? 1 : toVisualScale(sample) / toVisualScale(parent);
    return (fontSize * scale) / SPEED_FONT_SIZE;
}

/** Ends a run's sub-pixel slide and tells the frame hook it stopped. */
function settleAutoScroll(parent: HTMLElement, store: PlayToBottomStoreType) {
    if (releaseSubPixelScroll(parent)) {
        store.onFrame?.(parent.scrollTop, false);
    }
}

function startAnimToBottom(
    parent: HTMLElement,
    element: HTMLElement,
    store: PlayToBottomStoreType,
    options: {
        onMoved: () => void;
        onStop: () => void;
        onToTheTop: () => void;
    },
    time?: number,
) {
    const maxScroll = parent.scrollHeight - parent.clientHeight;
    const shouldStop = store.speed <= 0 || parent.scrollTop >= maxScroll - 5;

    if (shouldStop) {
        settleAutoScroll(parent, store);
        options.onStop();
        return;
    }
    const nexTargetCallback = (frameTime: number) => {
        startAnimToBottom(parent, element, store, options, frameTime);
    };
    if (parent.classList.contains('asking-to-top')) {
        (parent as any)._askingToTop = false;
        settleAutoScroll(parent, store);
        parent.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
        setTimeout(() => {
            parent.classList.remove('asking-to-top');
            store.scrollTop = parent.scrollTop;
            store.writtenTop = parent.scrollTop;
            store.frameTime = null;
            options.onToTheTop();
            requestAnimationFrame(nexTargetCallback);
        }, 2e3);
        return;
    }
    if (time !== undefined) {
        // A wheel, the scrollbar or a verse brought into view moved it: carry
        // on from there, up as well as down.
        const currentTop = getSubPixelScrollTop(parent);
        if (
            store.writtenTop !== null &&
            Math.abs(currentTop - store.writtenTop) > 2
        ) {
            store.scrollTop = currentTop;
        }
        const elapsed =
            store.frameTime === null
                ? 0
                : Math.min(Math.max(time - store.frameTime, 0), MAX_FRAME_MS);
        store.frameTime = time;
        if (time - store.fontMeasuredAt >= FONT_MEASURE_MS) {
            store.fontScale = measureFontScale(parent);
            store.fontMeasuredAt = time;
        }
        const pxPerMs =
            ((BASE_SPEED + store.speed) * SPEED_FRAME_RATE * store.fontScale) /
            1000;
        const previousTop = store.scrollTop;
        store.scrollTop = Math.min(
            store.scrollTop + pxPerMs * elapsed,
            maxScroll,
        );
        if (store.scrollTop !== previousTop) {
            const wholeTop = parent.scrollTop;
            writeSubPixelScrollTop(parent, store.scrollTop);
            store.writtenTop = store.scrollTop;
            if (parent.scrollTop !== wholeTop) {
                setTimeout(() => {
                    options.onMoved();
                }, 0);
            }
            store.onFrame?.(store.scrollTop, true);
        }
    }
    requestAnimationFrame(nexTargetCallback);
}

function preventEvent(event: Event) {
    event.stopPropagation();
    event.preventDefault();
}
function showOnScrollable(parent: HTMLElement, element: HTMLElement) {
    if (parent.scrollHeight <= parent.clientHeight) {
        element.style.display = 'none';
    } else {
        element.style.display = 'block';
    }
}

export type MoveCheckType = {
    check: (container: HTMLElement) => void;
    threshold: number;
};

// A function, not a constant: `tran()` must run when the title is set, in the
// language the window is showing then.
function genPlayToBottomTitle() {
    return tran(
        'Click to scroll to the bottom, double click to speed up, ' +
            'right click to slow down, Alt + right click to stop',
    );
}
const speedOffset = 0.07;
export function applyPlayToBottom(
    element: HTMLElement,
    movedCheck?: MoveCheckType,
    onFrame?: AutoScrollFrameType,
) {
    const parent = element.parentElement;
    if (parent === null) {
        return;
    }
    const store = getPlayToBottomStore(element);
    store.onFrame = onFrame;
    // This runs again on every render of the host -- a font-size change among
    // them -- so the next frame reads the text size afresh.
    store.fontMeasuredAt = Number.NEGATIVE_INFINITY;
    const resetSpeed = () => {
        const speed = Number.parseFloat(element.dataset['speed'] ?? '0');
        store.speed = Number.isNaN(speed) ? 0 : speed;
        // Standing still, the tooltip is the only place the gestures are
        // written down; running, the menu button below says them instead and
        // the number is the one thing it cannot show at a glance.
        element.title =
            store.speed === 0 ? genPlayToBottomTitle() : store.speed.toFixed(2);
        start();
    };
    const setSpeed = (newSpeed: number) => {
        const speed = Math.max(0, newSpeed);
        element.dataset['speed'] = speed === 0 ? '' : speed.toString();
        resetSpeed();
    };
    const start = () => {
        if (store.speed === 0 || store.isRunning) {
            return;
        }
        store.isRunning = true;
        store.scrollTop = parent.scrollTop;
        store.writtenTop = parent.scrollTop;
        store.frameTime = performance.now();
        const movedThreshold = movedCheck?.threshold ?? 0;
        let scrollTop = parent.scrollTop - movedThreshold;
        startAnimToBottom(parent, element, store, {
            onToTheTop: () => {
                scrollTop = parent.scrollTop;
            },
            onMoved: movedThreshold
                ? () => {
                      if (parent.scrollTop > scrollTop) {
                          scrollTop = parent.scrollTop + movedThreshold;
                          movedCheck?.check(parent);
                      }
                  }
                : () => {},
            onStop: () => {
                store.isRunning = false;
                setSpeed(0);
                element.title = genPlayToBottomTitle();
            },
        });
    };
    element.onclick = (event) => {
        preventEvent(event);
        setSpeed(store.speed + speedOffset);
    };
    element.oncontextmenu = (event) => {
        preventEvent(event);
        if (!element.dataset['speed']) {
            return;
        }
        if (event.altKey) {
            setSpeed(0);
            return;
        }
        setSpeed(store.speed - speedOffset);
    };
    element.ondblclick = (event) => {
        preventEvent(event);
        setSpeed(store.speed + speedOffset * 3);
    };
    // Same reason as the scroll listener in `applyToTheTop`: this runs again on
    // every render of the host, and an observer per render would pile up on the
    // scroller for the life of the view.
    const anyElement = element as any;
    (
        anyElement._playToBottomResizeObserver as ResizeObserver | undefined
    )?.disconnect();
    const resizeObserver = (anyElement._playToBottomResizeObserver =
        new ResizeObserver((entries) => {
            for (const entry of entries) {
                showOnScrollable(entry.target as HTMLElement, element);
            }
        }));
    resizeObserver.observe(parent);
    showOnScrollable(parent, element);
    // Last, so the title and any resumed animation reflect the speed the button
    // was already carrying when this ran.
    resetSpeed();
}
