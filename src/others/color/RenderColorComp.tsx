import { use, useCallback, type DragEvent, type MouseEvent } from 'react';

import { copyToClipboard } from '../../server/appHelpers';
import type { AppColorType } from './colorHelpers';
import { serializeForDragging } from './colorHelpers';
import { checkIsColorDark } from './colorValueHelpers';
import { genShowOnScreensContextMenu } from '../FileItemHandlerComp';
import ScreenBackgroundManager from '../../_screen/managers/ScreenBackgroundManager';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import { pressElementLikeButton } from '../../helper/helpers';
import { useAppCurrentRef } from '../../helper/appHooks';
import { ColorSwatchExtraMenuContext } from './colorSwatchMenuHelpers';

function showContextMenu(
    event: any,
    color: AppColorType,
    extraMenuItems: ContextMenuItemType[] = [],
) {
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
                'fill',
                { src: color },
                true,
            );
        }),
        ...extraMenuItems,
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
    const genExtraMenuItems = use(ColorSwatchExtraMenuContext);
    const genExtraMenuItemsRef = useAppCurrentRef(genExtraMenuItems);
    const handleDragStart = useCallback((event: DragEvent) => {
        serializeForDragging(event, colorRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleContextMenu = useCallback((event: MouseEvent) => {
        showContextMenu(
            event,
            colorRef.current,
            genExtraMenuItemsRef.current?.(colorRef.current),
        );
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
    // A square tile on a grid (`ColorPicker.scss`): the one in force gets a
    // steady ring and a tick in whichever of black or white reads on it. It
    // used to be wrapped in a bordered, pulsing span, which pushed every
    // swatch after it along the row.
    return (
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
                'color-item app-caught-hover-pointer' +
                (isSelected ? ' is-selected' : '') +
                (checkIsColorDark(color) ? ' is-dark' : '')
            }
            style={{ backgroundColor: color }}
            onClick={handleClick}
        >
            {isSelected ? (
                <i className="bi bi-check-lg" aria-hidden="true" />
            ) : null}
        </div>
    );
}
