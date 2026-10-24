export const TO_THE_TOP_CLASSNAME = 'app-to-the-top';
export const PLAY_TO_BOTTOM_CLASSNAME = 'play-to-bottom';
export const PLAY_TO_BOTTOM_MENU_CLASSNAME = 'play-to-bottom-menu';
// The controls pinned over a scroller ride along with nothing.
const PINNED_SELECTOR =
    `style, .${TO_THE_TOP_CLASSNAME}, .${PLAY_TO_BOTTOM_CLASSNAME},` +
    ` .${PLAY_TO_BOTTOM_MENU_CLASSNAME}`;

type SubPixelStateType = {
    fraction: number;
    targets: Set<HTMLElement>;
};

function getState(scroller: HTMLElement): SubPixelStateType | undefined {
    return (scroller as any)._subPixelScroll;
}

/** One device pixel in CSS px: the step a scroll offset is drawn in. */
export function getDevicePixel() {
    return 1 / (globalThis.devicePixelRatio || 1);
}

/**
 * Scroll to `top` with sub-pixel precision. A scroll offset is only ever drawn
 * on whole device pixels, so a slow auto-scroll crawled in visible one-pixel
 * ticks -- six to nine a second at its slowest, which reads as shaking. The
 * whole pixels go to `scrollTop`; the rest slides the content with a
 * `translate` on its own compositor layer, which costs no layout and no
 * repaint. `translate`, not `transform`: a screen's content already carries
 * its own `transform: scale(...)`, and the two compose.
 *
 * Only for a scroll that is moving by itself; `releaseSubPixelScroll` when it
 * stops, so no layer outlives it.
 */
export function writeSubPixelScrollTop(scroller: HTMLElement, top: number) {
    const pixel = getDevicePixel();
    const whole = Math.floor(top / pixel + 1e-6) * pixel;
    const fraction = Math.min(Math.max(top - whole, 0), pixel);
    if (Math.abs(scroller.scrollTop - whole) >= pixel / 2) {
        scroller.scrollTop = whole;
    }
    let state = getState(scroller);
    if (state === undefined) {
        state = { fraction: 0, targets: new Set() };
        (scroller as any)._subPixelScroll = state;
    }
    state.fraction = fraction;
    const translate = fraction ? `0 ${(-fraction).toFixed(3)}px` : '';
    // Every frame, not once: a host re-render can swap a child in.
    for (const child of Array.from(scroller.children)) {
        if (!(child instanceof HTMLElement) || child.matches(PINNED_SELECTOR)) {
            continue;
        }
        if (!state.targets.has(child)) {
            state.targets.add(child);
            child.style.willChange = 'transform';
        }
        if (child.style.translate !== translate) {
            child.style.translate = translate;
        }
    }
}

/** Back to a plain scroll offset, rounded to the nearest device pixel. */
export function releaseSubPixelScroll(scroller: HTMLElement) {
    const state = getState(scroller);
    if (state === undefined) {
        return false;
    }
    delete (scroller as any)._subPixelScroll;
    for (const target of state.targets) {
        target.style.translate = '';
        target.style.willChange = '';
    }
    if (state.fraction >= getDevicePixel() / 2) {
        scroller.scrollTop += getDevicePixel();
    }
    return true;
}

export function checkIsSubPixelScrolling(scroller: HTMLElement) {
    return getState(scroller) !== undefined;
}

/** `scrollTop` plus the part of a pixel the content is slid by. */
export function getSubPixelScrollTop(scroller: HTMLElement) {
    return scroller.scrollTop + (getState(scroller)?.fraction ?? 0);
}
