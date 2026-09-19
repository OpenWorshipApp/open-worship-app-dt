export const STICKY_AUTO_HIDE_CLASSNAME = 'app-sticky-auto-hide';
export const STICKY_HIDDEN_CLASSNAME = 'app-sticky-hidden';

// A gesture must cover this many pixels before it counts as an intentional
// scroll; below it the bar would flicker on wheel jitter or a touchpad rest.
const MIN_RUN_DISTANCE = 20;

// px/ms. Scrolling up slowly (reading back through the list) keeps the bar out
// of the way; a quick flick up means "give me the controls back".
const REVEAL_MIN_SPEED = 0.3;

// While the content is (almost) at the top the bar always stays visible.
const TOP_THRESHOLD = 4;

// A pause between two scroll events says nothing about how fast the user is
// scrolling now, so long gaps are capped instead of dragging the speed down.
const MAX_EVENT_GAP = 100;

export type StickyAutoHideCheckerType = (
    scrollTop: number,
    timestamp: number,
) => boolean | null;

/**
 * Decides, per scroll event, whether the sticky bar should hide (`true`), show
 * (`false`) or keep its current state (`null`). Kept free of DOM access so the
 * gesture rules can be unit tested and so the scroll handler itself does no
 * layout reads beyond `scrollTop`.
 */
export function genStickyAutoHideChecker(
    initScrollTop = 0,
    initTimestamp = 0,
): StickyAutoHideCheckerType {
    let lastScrollTop = initScrollTop;
    let lastTimestamp = initTimestamp;
    let isRunGoingDown = false;
    let runDistance = 0;
    let runDuration = 0;
    return (scrollTop: number, timestamp: number) => {
        const delta = scrollTop - lastScrollTop;
        const gap = Math.min(
            Math.max(timestamp - lastTimestamp, 1),
            MAX_EVENT_GAP,
        );
        lastScrollTop = scrollTop;
        lastTimestamp = timestamp;
        if (scrollTop <= TOP_THRESHOLD) {
            runDistance = 0;
            runDuration = 0;
            return false;
        }
        if (delta === 0) {
            return null;
        }
        const isGoingDown = delta > 0;
        if (isGoingDown !== isRunGoingDown) {
            isRunGoingDown = isGoingDown;
            runDistance = 0;
            runDuration = 0;
        }
        runDistance += Math.abs(delta);
        runDuration += gap;
        if (runDistance < MIN_RUN_DISTANCE) {
            return null;
        }
        const speed = runDistance / runDuration;
        runDistance = 0;
        runDuration = 0;
        if (isGoingDown) {
            return true;
        }
        return speed >= REVEAL_MIN_SPEED ? false : null;
    };
}

function findScrollingParent(element: HTMLElement) {
    let parent = element.parentElement;
    while (parent !== null) {
        const { overflowY } = getComputedStyle(parent);
        if (overflowY === 'auto' || overflowY === 'scroll') {
            return parent;
        }
        parent = parent.parentElement;
    }
    return null;
}

export function applyStickyAutoHide(element: HTMLElement) {
    const parent = findScrollingParent(element);
    if (parent === null) {
        return () => {};
    }
    const check = genStickyAutoHideChecker(parent.scrollTop, performance.now());
    // Toggling a class straight on the node instead of going through state:
    // scrolling must not re-render the list under it.
    const handleScrolling = () => {
        const shouldHide = check(parent.scrollTop, performance.now());
        if (shouldHide === null) {
            return;
        }
        element.classList.toggle(STICKY_HIDDEN_CLASSNAME, shouldHide);
    };
    parent.addEventListener('scroll', handleScrolling, { passive: true });
    return () => {
        parent.removeEventListener('scroll', handleScrolling);
        element.classList.remove(STICKY_HIDDEN_CLASSNAME);
    };
}
