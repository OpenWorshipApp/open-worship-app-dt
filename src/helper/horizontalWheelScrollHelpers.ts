// A wheel "line" in pixels, for the few devices that report lines.
const WHEEL_LINE_HEIGHT = 16;

/**
 * A ref for a row that scrolls sideways -- a pane header's hover actions, a
 * floating widget's title. It has no vertical scroll of its own, so an
 * ordinary mouse wheel did nothing over it and whatever ran past its edge could
 * not be reached. While the row overflows, a vertical wheel scrolls it sideways
 * instead; when it fits, or the gesture is already sideways (a trackpad
 * swipe), the wheel is left alone. Returns its own cleanup, so it binds once
 * per element.
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
