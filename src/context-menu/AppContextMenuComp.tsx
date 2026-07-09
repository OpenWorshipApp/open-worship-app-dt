import './AppContextMenuComp.scss';

import { useCallback } from 'react';
import type { CSSProperties, MouseEvent } from 'react';

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
    if (item.menuElement === elementDivider) {
        return item.menuElement;
    }
    return (
        <div
            className={
                `${APP_CONTEXT_MENU_ITEM_CLASS} d-flex w-100 app-overflow-hidden` +
                `${isDisabled ? ' disabled' : ''}`
            }
            style={item.style ?? {}}
            title={
                item.title ??
                (typeof item.menuElement === 'string' ? item.menuElement : '')
            }
            onClick={handleClick}
        >
            {item.childBefore || null}
            <div className="app-ellipsis flex-fill">{item.menuElement}</div>
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
            >
                {data.items.map((item, i) => {
                    if (item.keyboardShortcut !== undefined) {
                        item.childAfter = (
                            <>
                                {genContextMenuItemShortcutKey(
                                    item.keyboardShortcut,
                                )}
                                {item.childAfter ?? null}
                            </>
                        );
                    }
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
    return (
        <div className="context-menu-shortcut-key">
            <span className="">{toShortcutKey(eventMapper)}</span>
        </div>
    );
}

export function genContextMenuItemIcon(name: string, style?: CSSProperties) {
    return (
        <i
            className={`bi bi-${name}`}
            style={{
                color: 'var(--bs-info-text-emphasis)',
                marginRight: '2px',
                ...style,
            }}
        />
    );
}
