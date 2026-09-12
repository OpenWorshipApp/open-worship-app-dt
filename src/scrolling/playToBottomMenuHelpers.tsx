import {
    elementDivider,
    genContextMenuItemGestureHint,
} from '../context-menu/AppContextMenuComp';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { tran } from '../lang/langHelpers';

/**
 * Fires the gesture itself rather than reaching for the speed.
 *
 * The four actions already exist, as `onclick` / `oncontextmenu` / `ondblclick`
 * on the auto-scroll button (`applyPlayToBottom`), closed over state this module
 * cannot see. Dispatching the real event runs THOSE handlers, so the menu and
 * the mouse can never drift apart — and the menu keeps working if the speed
 * ladder is ever retuned.
 */
function genDispatcher(
    playElement: HTMLElement,
    type: 'click' | 'dblclick' | 'contextmenu',
    altKey = false,
) {
    return () => {
        playElement.dispatchEvent(
            // No `view`: the handlers on the other end read `altKey` and
            // nothing else, and jsdom rejects a `view` that is not a real
            // Window, which would make this untestable for no gain.
            new MouseEvent(type, {
                bubbles: true,
                cancelable: true,
                altKey,
            }),
        );
    };
}

export function genPlayToBottomContextMenuItems(
    playElement: HTMLElement,
): ContextMenuItemType[] {
    const speed = Number.parseFloat(playElement.dataset['speed'] ?? '0');
    return [
        {
            menuElement: tran('Auto Scroll Speed'),
            // No `onSelect`, which is how the menu renders a readout: the item
            // draws itself disabled.
            childAfter: (
                <div className="app-data" style={{ opacity: 0.8 }}>
                    {Number.isNaN(speed) ? '0.00' : speed.toFixed(2)}
                </div>
            ),
        },
        { menuElement: elementDivider },
        {
            childBefore: genContextMenuItemIcon('chevron-double-down'),
            menuElement: tran('Speed Up'),
            childAfter: genContextMenuItemGestureHint(tran('Click')),
            onSelect: genDispatcher(playElement, 'click'),
        },
        {
            childBefore: genContextMenuItemIcon('chevron-bar-down'),
            menuElement: tran('Speed Up Faster'),
            childAfter: genContextMenuItemGestureHint(tran('Double Click')),
            onSelect: genDispatcher(playElement, 'dblclick'),
        },
        {
            childBefore: genContextMenuItemIcon('dash-circle'),
            menuElement: tran('Slow Down'),
            childAfter: genContextMenuItemGestureHint(tran('Right Click')),
            onSelect: genDispatcher(playElement, 'contextmenu'),
        },
        { menuElement: elementDivider },
        {
            childBefore: genContextMenuItemIcon('stop-circle', {
                color: 'var(--bs-danger)',
            }),
            menuElement: tran('Stop Auto Scrolling'),
            childAfter: genContextMenuItemGestureHint(
                tran('Alt + Right Click'),
            ),
            onSelect: genDispatcher(playElement, 'contextmenu', true),
        },
    ];
}

/**
 * `event` is a React mouse event in the app and a native one on the screen,
 * where the whole control is built by hand; `showAppContextMenu` reads only the
 * two coordinates and the two stoppers that both of them carry.
 */
export function showPlayToBottomContextMenu(
    event: { clientX: number; clientY: number },
    playElement: HTMLElement,
) {
    showAppContextMenu(
        event as any,
        genPlayToBottomContextMenuItems(playElement),
        {
            // The gesture chips are wider than any keyboard shortcut, and
            // `setPositionMenu` applies this AFTER its own 210px clamp.
            style: { maxWidth: '260px' },
        },
    );
}
