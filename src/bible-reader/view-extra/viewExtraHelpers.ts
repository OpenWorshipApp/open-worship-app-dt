import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { createContext, use } from 'react';

export function cleanupVerseNumberClicked(event: ReactMouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    setTimeout(() => {
        const selection = globalThis.getSelection();
        if (selection === null || selection.rangeCount === 0) {
            return;
        }
        // A selection the user has made SINCE this click is theirs, not the
        // leftovers this cleanup was armed to sweep away. Without this check the
        // marking toolbar vanishes mid-gesture for two seconds after any verse
        // number is clicked, and there is no way to tell why.
        if (!selection.isCollapsed) {
            return;
        }
        selection.removeAllRanges();
    }, 2e3);
}

// A wheel "line" in pixels, for the few devices that report lines.
const WHEEL_LINE_HEIGHT = 16;

/**
 * A ref for a strip of buttons that scrolls sideways -- a pane header's hover
 * actions. It has no vertical scroll of its own, so an ordinary mouse wheel did
 * nothing over it and the buttons past its edge could not be reached. While
 * the strip overflows, a vertical wheel scrolls it sideways instead; when it
 * fits, or the gesture is already sideways (a trackpad swipe), the wheel is
 * left alone. Returns its own cleanup, so it binds once per element.
 */
export function applyHorizontalWheelScroll(element: HTMLElement | null) {
    if (element === null) {
        return;
    }
    const handleWheel = (event: WheelEvent) => {
        if (element.scrollWidth <= element.clientWidth) {
            return;
        }
        if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) {
            return;
        }
        event.preventDefault();
        element.scrollLeft +=
            event.deltaMode === WheelEvent.DOM_DELTA_LINE
                ? event.deltaY * WHEEL_LINE_HEIGHT
                : event.deltaY;
    };
    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
        element.removeEventListener('wheel', handleWheel);
    };
}

export const BibleViewTitleMaterialContext = createContext<{
    titleElement: ReactNode;
    /**
     * A button that belongs with the pane's own actions -- the lookup's edit
     * pencil. It used to ride at the end of the title, which is exactly where
     * the hover actions float, so a press meant for the pencil landed on
     * whatever action was drawn over it (Close, in a three-pane Reader).
     */
    actionElement?: ReactNode;
} | null>(null);

export function useBibleViewTitleMaterialContext() {
    const context = use(BibleViewTitleMaterialContext);
    if (context === null) {
        throw new Error(
            'useBibleViewTitleMaterialContext must be used within a ' +
                'BibleViewTitleMaterialContext',
        );
    }
    return context;
}
