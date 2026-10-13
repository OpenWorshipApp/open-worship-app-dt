// Deliberately a leaf module, like `contextMenuIconHelpers`: a control that
// only needs to say WHERE a menu opens must not bring the whole context-menu
// UI (KeyboardEventListener, the SCSS, the text-selection helpers) with it.

export function createMouseEvent(clientX: number, clientY: number) {
    return new MouseEvent('click', {
        clientX,
        clientY,
        bubbles: true,
        cancelable: true,
        view: window,
    });
}

/**
 * The event for a menu opened by a KEY. A key has no pointer position, so the
 * menu hangs under the control the key stands for.
 */
export function createMouseEventUnder(element: Element) {
    const { left, bottom } = element.getBoundingClientRect();
    return createMouseEvent(left, bottom);
}
