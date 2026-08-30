import type { MouseEvent as ReactMouseEventType } from 'react';
import { useRef } from 'react';

import { tran } from '../lang/langHelpers';

export const CONTEXT_MENU_DOTS_CLASSNAME = 'app-context-menu-dots';

/**
 * The `⋮` that opens the same menu as right-clicking whatever it sits on.
 *
 * A right-click is not an affordance. It is invisible — nothing on a row says a
 * menu is hiding behind it — and it does not exist at all on a touch screen, nor
 * under a browser that keeps its own menu on that button. The app is headed for
 * the web, so every surface whose actions live ONLY in a context menu carries
 * one of these beside the right-click that is already there.
 *
 * ALWAYS VISIBLE (dimmed), never hover-revealed: a pointer that can hover is
 * exactly the pointer that could have right-clicked anyway.
 *
 * The button stops the press from reaching its host. Almost every host is itself
 * clickable — a row that selects, a card that presents — and without this the
 * same press would also act on the item behind the menu it just opened.
 */
export default function ContextMenuDotsButtonComp({
    onOpening,
    isCorner = false,
    className = '',
    label,
}: Readonly<{
    // The menu to open. LEAVE IT OUT when the button sits INSIDE the element
    // that owns the menu: it then dispatches a real `contextmenu` on its parent
    // instead, which is the only way to stay right about a surface whose menu is
    // decided by an ancestor. A presenting flow's preview captures `contextmenu`
    // over the slide card it wraps and answers with the RUN's menu; a button
    // that called the card's own handler would quietly serve the wrong one.
    onOpening?: (event: ReactMouseEventType) => void;
    // Pins the button to its host's top-right corner. The host must establish a
    // positioning context of its own; use it for cards and previews, where an
    // inline button would take a bite out of the content.
    isCorner?: boolean;
    className?: string;
    // Only for a surface whose menu is NOT "this item's actions", e.g. a panel
    // header. Defaults to the same wording as every other ⋮ in the app.
    label?: string;
}>) {
    const title = label ?? tran('More Options');
    const buttonRef = useRef<HTMLButtonElement>(null);
    const handleOpening = (event: ReactMouseEventType) => {
        event.preventDefault();
        event.stopPropagation();
        if (onOpening !== undefined) {
            onOpening(event);
            return;
        }
        const hostElement = buttonRef.current?.parentElement;
        if (!hostElement) {
            return;
        }
        // Aimed at the button, so the menu opens where it was pressed, and
        // dispatched for real so every capturing ancestor gets its say in the
        // same order a right-click would give it.
        hostElement.dispatchEvent(
            new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: event.clientX,
                clientY: event.clientY,
            }),
        );
    };
    return (
        <button
            ref={buttonRef}
            type="button"
            className={
                `${CONTEXT_MENU_DOTS_CLASSNAME}` +
                `${isCorner ? ` ${CONTEXT_MENU_DOTS_CLASSNAME}--corner` : ''}` +
                ` ${className}`
            }
            title={title}
            aria-label={title}
            onClick={handleOpening}
            // Right-clicking the button itself must open the item's menu too,
            // not the one belonging to whatever is underneath it.
            onContextMenu={handleOpening}
            // A press that begins on the button must not start the host's own
            // drag or selection gesture.
            onMouseDown={(event) => {
                event.stopPropagation();
            }}
            onPointerDown={(event) => {
                event.stopPropagation();
            }}
        >
            <i className="bi bi-three-dots-vertical" />
        </button>
    );
}
