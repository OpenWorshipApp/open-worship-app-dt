import { useCallback, type DragEvent, type MouseEvent } from 'react';

import { copyToClipboard } from '../../server/appHelpers';
import type { AppColorType } from './colorHelpers';
import { serializeForDragging } from './colorHelpers';
import { genShowOnScreensContextMenu } from '../FileItemHandlerComp';
import ScreenBackgroundManager from '../../_screen/managers/ScreenBackgroundManager';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import {
    HIGHLIGHT_SELECTED_CLASSNAME,
    pressElementLikeButton,
} from '../../helper/helpers';
import { useAppCurrentRef } from '../../helper/appHooks';

function showContextMenu(event: any, color: AppColorType) {
    const menuItems: ContextMenuItemType[] = [
        {
            childBefore: genContextMenuItemIcon('clipboard', { color }),
            menuElement: `Copy '${color}' to clipboard`,
            onSelect: () => {
                copyToClipboard(color);
            },
        },
        ...genShowOnScreensContextMenu((event) => {
            ScreenBackgroundManager.handleBackgroundSelecting(
                event,
                'color',
                { src: color },
                true,
            );
        }),
    ];
    showAppContextMenu(event, menuItems);
}
export default function RenderColorComp({
    name,
    color,
    isSelected,
    onClick,
}: Readonly<{
    name: string;
    color: AppColorType;
    isSelected?: boolean;
    onClick?: (event: MouseEvent, color: AppColorType) => void;
}>) {
    const colorRef = useAppCurrentRef(color);
    const handleDragStart = useCallback((event: DragEvent) => {
        serializeForDragging(event, colorRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleContextMenu = useCallback((event: MouseEvent) => {
        showContextMenu(event, colorRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const onClickRef = useAppCurrentRef(onClick);
    const handleClick = useCallback((event: MouseEvent) => {
        onClickRef.current?.(event as any, colorRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Enter/Space activate it the way they would a real button. Needed because
    // a swatch renders as a styled div: without role/tabIndex it is absent
    // from the accessibility tree as a control (Chromium exposes it as a bare
    // `group`), so a keyboard or screen-reader user had no way to set a
    // background colour at all. Through `pressElementLikeButton` rather than
    // calling the handler directly, because what follows a colour press is
    // `chooseScreenIds`, which opens its "which screen?" menu at the event's
    // own coordinates.
    const handleKeyDown = useCallback((event: any) => {
        pressElementLikeButton(event);
    }, []);
    const element = (
        <div
            role="button"
            tabIndex={0}
            aria-label={name}
            aria-pressed={isSelected === true}
            title={name}
            draggable
            onDragStart={handleDragStart}
            onContextMenu={handleContextMenu}
            onKeyDown={handleKeyDown}
            className={
                'm-1 color-item app-caught-hover-pointer' +
                (isSelected ? ' app-border-white-round' : '')
            }
            style={{
                width: '20px',
                height: '15px',
                backgroundColor: color,
            }}
            onClick={handleClick}
        />
    );
    if (isSelected) {
        return (
            <span className={`${HIGHLIGHT_SELECTED_CLASSNAME} animation`}>
                {element}
            </span>
        );
    }
    return element;
}
