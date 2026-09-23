/**
 * The DOM half of the windowing: which element actually hides the rows, and
 * one listener per scroller however many lists are riding it.
 *
 * A list here does not own its scroller -- the background grids scroll inside
 * `FileListHandlerComp`'s `card-body`, the Foreground slide show adds a second
 * scroller of its own around that, and a colour-note group is one list among
 * several in the same scroller. So instead of asking "what is my scroll
 * parent", this asks "what is the band of me the user can actually see",
 * which is the intersection of every clipping ancestor and the window.
 */

const CLIPPING_OVERFLOW_PATTERN = /(auto|scroll|hidden|clip)/;
const CONTAINING_BLOCK_CONTAIN_PATTERN = /(paint|layout|strict|content)/;
const CONTAINING_BLOCK_WILL_CHANGE_PATTERN = /(transform|perspective|filter)/;

/** `none` and "not stated at all" are the same answer. */
function checkIsStyleValueSet(value: string | null | undefined) {
    return (
        value !== undefined &&
        value !== null &&
        value !== '' &&
        value !== 'none'
    );
}

/**
 * The per-axis overflow, falling back to the shorthand: not every engine
 * fills `overflowY` in a computed style when only `overflow` was written.
 */
function toOverflowValueList(style: CSSStyleDeclaration) {
    const overflow = style.overflow ?? '';
    return [style.overflowY || overflow, style.overflowX || overflow];
}

/** An unstated position is `static`. */
function toPositionValue(style: CSSStyleDeclaration) {
    return style.position || 'static';
}

/**
 * Whether this element pins a `position: fixed` descendant to itself instead
 * of to the viewport -- a transform, a filter or paint containment does that.
 */
function checkIsFixedContainingBlock(style: CSSStyleDeclaration) {
    return (
        checkIsStyleValueSet(style.transform) ||
        checkIsStyleValueSet(style.perspective) ||
        checkIsStyleValueSet(style.filter) ||
        CONTAINING_BLOCK_CONTAIN_PATTERN.test(style.contain ?? '') ||
        CONTAINING_BLOCK_WILL_CHANGE_PATTERN.test(style.willChange ?? '')
    );
}

type VisibleWindowType = {
    // Both measured from the top of the list element, so a list never needs to
    // know its own offset inside the scroller's content.
    top: number;
    bottom: number;
};

/**
 * Every ancestor that can hide part of the list, nearest first. Walked ONCE
 * per layout rather than per frame: `getComputedStyle` resolves style, and
 * doing that for ten ancestors on every scroll event is the kind of cost this
 * module exists to remove.
 */
export function findClippingAncestors(element: HTMLElement | null) {
    const ancestorList: HTMLElement[] = [];
    if (element === null) {
        return ancestorList;
    }
    // An ancestor only clips what it contains in the POSITIONING sense. The
    // Foreground panel is a `position: fixed` floating widget sitting over the
    // presenter, so the presenter's own `overflow: hidden` -- which ends well
    // above the panel -- does not hide a thing in it. Intersecting with it
    // anyway made the panel's grid believe none of itself was on screen and
    // render nothing at all.
    let escapePosition = toPositionValue(getComputedStyle(element));
    let node = element.parentElement;
    while (node !== null && node !== document.body) {
        const style = getComputedStyle(node);
        const position = toPositionValue(style);
        let isClipping = toOverflowValueList(style).some((overflow) => {
            return CLIPPING_OVERFLOW_PATTERN.test(overflow);
        });
        if (escapePosition === 'fixed') {
            if (checkIsFixedContainingBlock(style)) {
                escapePosition = 'static';
            } else {
                isClipping = false;
            }
        } else if (escapePosition === 'absolute') {
            if (position !== 'static' || checkIsFixedContainingBlock(style)) {
                escapePosition = 'static';
            } else {
                isClipping = false;
            }
        }
        if (isClipping) {
            ancestorList.push(node);
        }
        if (position === 'fixed' || position === 'absolute') {
            escapePosition = position;
        }
        node = node.parentElement;
    }
    return ancestorList;
}

/** The ancestors worth listening to: the ones that can actually scroll. */
export function findScrollingAncestors(ancestorList: HTMLElement[]) {
    return ancestorList.filter((element) => {
        const [overflowY] = toOverflowValueList(getComputedStyle(element));
        return CLIPPING_OVERFLOW_PATTERN.test(overflowY);
    });
}

export function toVisibleWindow(
    element: HTMLElement,
    clippingAncestorList: HTMLElement[],
): VisibleWindowType {
    const elementRect = element.getBoundingClientRect();
    let top = 0;
    let bottom = window.innerHeight || document.documentElement.clientHeight;
    for (const ancestor of clippingAncestorList) {
        const rect = ancestor.getBoundingClientRect();
        top = Math.max(top, rect.top);
        bottom = Math.min(bottom, rect.bottom);
    }
    return { top: top - elementRect.top, bottom: bottom - elementRect.top };
}

type ScrollerEntryType = {
    listenerSet: Set<() => void>;
    dispose: () => void;
};

// Keyed by the element, so an entry cannot outlive the node it watches. It
// holds only the listeners currently mounted, and the last one out disposes
// the entry: nothing accumulates here.
const scrollerEntryMap = new WeakMap<HTMLElement, ScrollerEntryType>();

const SCROLL_FALLBACK_DELAY = 50;

function genScrollerEntry(element: HTMLElement): ScrollerEntryType {
    const listenerSet = new Set<() => void>();
    let frameId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const cancelPending = () => {
        if (frameId !== null) {
            cancelAnimationFrame(frameId);
            frameId = null;
        }
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };
    const flush = () => {
        cancelPending();
        for (const listener of listenerSet) {
            listener();
        }
    };
    // Scroll fires far faster than a frame, so answering once a frame is
    // enough -- but a window that is not on screen runs NO animation frames,
    // and a list that never answered would still be holding the rows from
    // before when the window came back. Whichever arrives first wins.
    const handleChange = () => {
        if (frameId !== null || timeoutId !== null) {
            return;
        }
        frameId = requestAnimationFrame(flush);
        timeoutId = setTimeout(flush, SCROLL_FALLBACK_DELAY);
    };
    element.addEventListener('scroll', handleChange, { passive: true });
    const resizeObserver = new ResizeObserver(handleChange);
    resizeObserver.observe(element);
    return {
        listenerSet,
        dispose: () => {
            element.removeEventListener('scroll', handleChange);
            resizeObserver.disconnect();
            cancelPending();
        },
    };
}

function subscribeScroller(element: HTMLElement, listener: () => void) {
    let entry = scrollerEntryMap.get(element);
    if (entry === undefined) {
        entry = genScrollerEntry(element);
        scrollerEntryMap.set(element, entry);
    }
    entry.listenerSet.add(listener);
    return () => {
        const currentEntry = scrollerEntryMap.get(element);
        if (currentEntry === undefined) {
            return;
        }
        currentEntry.listenerSet.delete(listener);
        if (currentEntry.listenerSet.size === 0) {
            currentEntry.dispose();
            scrollerEntryMap.delete(element);
        }
    };
}

export function subscribeScrollerList(
    elementList: HTMLElement[],
    listener: () => void,
) {
    const unsubscribeList = elementList.map((element) => {
        return subscribeScroller(element, listener);
    });
    return () => {
        for (const unsubscribe of unsubscribeList) {
            unsubscribe();
        }
    };
}

/**
 * Scrolls the band `[top, top + height]` -- measured from the top of the
 * list's scroller content -- into view inside the nearest ancestor that
 * actually scrolls. Returns false when there is nothing to scroll.
 */
export function scrollBandIntoView({
    clippingAncestorList,
    toBandTop,
    height,
    align = 'nearest',
}: {
    clippingAncestorList: HTMLElement[];
    // Given the scroller, since only it knows where its content starts.
    toBandTop: (scroller: HTMLElement) => number;
    height: number;
    align?: 'nearest' | 'center';
}) {
    const scroller = clippingAncestorList.find((ancestor) => {
        return ancestor.scrollHeight > ancestor.clientHeight;
    });
    if (scroller === undefined) {
        return false;
    }
    const top = toBandTop(scroller);
    const viewTop = scroller.scrollTop;
    const viewBottom = viewTop + scroller.clientHeight;
    if (align === 'nearest' && top >= viewTop && top + height <= viewBottom) {
        return true;
    }
    scroller.scrollTop = Math.max(
        0,
        align === 'center' ? top - (scroller.clientHeight - height) / 2 : top,
    );
    return true;
}
