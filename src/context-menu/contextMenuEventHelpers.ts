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

export type MenuAnchorType = { x: number; y: number };

/**
 * Where a menu item was chosen, for a menu that item opens. Read AT the
 * press: the second menu opens once the first is gone. The pointer, or for a
 * key the item itself; `null` when neither is known.
 */
export function getMenuItemAnchor(
    event: MouseEvent | KeyboardEvent,
): MenuAnchorType | null {
    if ('clientX' in event && (event.clientX !== 0 || event.clientY !== 0)) {
        return { x: event.clientX, y: event.clientY };
    }
    const target = event.target as Element | null | undefined;
    if (target?.isConnected && 'getBoundingClientRect' in target) {
        const { left, top } = target.getBoundingClientRect();
        return { x: left, y: top };
    }
    return null;
}
