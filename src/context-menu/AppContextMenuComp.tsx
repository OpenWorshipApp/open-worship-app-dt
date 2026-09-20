import './AppContextMenuComp.scss';

import { useCallback } from 'react';
import type { MouseEvent } from 'react';

import type { EventMapperType } from '../event/KeyboardEventListener';
import { toShortcutKey } from '../event/KeyboardEventListener';
import type { ContextMenuItemType } from './appContextMenuHelpers';
import {
    setPositionMenu,
    useAppContextMenuData,
    APP_CONTEXT_MENU_ITEM_CLASS,
    APP_CONTEXT_MENU_ID,
} from './appContextMenuHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

export const elementDivider = (
    <hr className="w-100" style={{ padding: 0, margin: 0 }} />
);

function ContextMenuItemComp({
    item,
    onClose,
}: Readonly<{
    item: ContextMenuItemType;
    onClose: () => void;
}>) {
    const isDisabled = (item.disabled ?? false) || item.onSelect === undefined;
    const itemRef = useAppCurrentRef(item);
    const isDisabledRef = useAppCurrentRef(isDisabled);
    const onCloseRef = useAppCurrentRef(onClose);
    const handleClick = useCallback((event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        const { onSelect } = itemRef.current;
        if (isDisabledRef.current) {
            return;
        }
        setTimeout(() => {
            onCloseRef.current();
            onSelect?.(event as any);
        }, 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleKeyDown = useCallback(
        (event: any) => {
            if (event.key !== 'Enter' && event.key !== ' ') {
                return;
            }
            // Space would scroll the page behind the menu.
            event.preventDefault();
            handleClick(event);
        },
        [handleClick],
    );
    if (item.menuElement === elementDivider) {
        return item.menuElement;
    }
    return (
        // `menuitem` and a tab stop: every menu in this app was a plain `div`
        // with an `onClick`, so the accessibility tree showed a bare group of
        // text nodes where a menu is, and no menu could be worked without a
        // mouse. The container carries the matching `menu` role.
        <div
            className={
                `${APP_CONTEXT_MENU_ITEM_CLASS} d-flex w-100 app-overflow-hidden` +
                `${isDisabled ? ' disabled' : ''}`
            }
            style={item.style ?? {}}
            role="menuitem"
            tabIndex={isDisabled ? -1 : 0}
            aria-disabled={isDisabled || undefined}
            title={
                item.title ??
                (typeof item.menuElement === 'string' ? item.menuElement : '')
            }
            onClick={handleClick}
            onKeyDown={handleKeyDown}
        >
            {item.childBefore || null}
            <div className="app-ellipsis flex-fill">{item.menuElement}</div>
            {item.keyboardShortcut !== undefined
                ? genContextMenuItemShortcutKey(item.keyboardShortcut)
                : null}
            {item.childAfter || null}
        </div>
    );
}

export default function AppContextMenuComp() {
    const data = useAppContextMenuData();
    const dataRef = useAppCurrentRef(data);
    const handleClose = useCallback(() => {
        dataRef.current?.onClose();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (data === null) {
        return null;
    }
    return (
        <div
            id={APP_CONTEXT_MENU_ID}
            onClick={handleClose}
            onContextMenu={handleClose}
        >
            <div
                tabIndex={0}
                ref={(div) => {
                    if (div === null) {
                        return;
                    }
                    setPositionMenu(div, data.event, data.options);
                    if (data.options?.shouldAutoFocusContainer) {
                        div.focus();
                    }
                }}
                className="app-context-menu app-focusable"
                role="menu"
            >
                {data.items.map((item, i) => {
                    return (
                        <ContextMenuItemComp
                            key={i}
                            item={item}
                            onClose={data.onClose}
                        />
                    );
                })}
            </div>
        </div>
    );
}

export function genContextMenuItemShortcutKey(eventMapper: EventMapperType) {
    const text = toShortcutKey(eventMapper);
    return (
        <div className="context-menu-shortcut-key" title={text}>
            <span className="">{text}</span>
        </div>
    );
}

/**
 * The chip that says which MOUSE gesture does what this item does.
 *
 * Kept apart from `genContextMenuItemShortcutKey` above on purpose. That one is
 * absolutely positioned over the item's right edge, which is fine for `Ctrl + S`
 * but not for `Alt + Right Click` — and least of all in Khmer, where the label
 * beneath it is far longer than its English key. This one stays in the flow and
 * takes its own width, so the label ellipsizes at the chip instead of under it.
 */
export function genContextMenuItemGestureHint(text: string) {
    return (
        <div className="context-menu-gesture-hint">
            <span>{text}</span>
        </div>
    );
}
