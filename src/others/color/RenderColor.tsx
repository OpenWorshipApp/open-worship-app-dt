import { useCallback, type DragEvent, type MouseEvent } from 'react';

import { copyToClipboard } from '../../server/appHelpers';
import type { AppColorType } from './colorHelpers';
import { serializeForDragging } from './colorHelpers';
import { genShowOnScreensContextMenu } from '../FileItemHandlerComp';
import ScreenBackgroundManager from '../../_screen/managers/ScreenBackgroundManager';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../../context-menu/appContextMenuHelpers';
import { HIGHLIGHT_SELECTED_CLASSNAME } from '../../helper/helpers';
import { useAppCurrentRef } from '../../helper/appHooks';

function showContextMenu(event: any, color: AppColorType) {
    const menuItems: ContextMenuItemType[] = [
        {
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
export default function RenderColor({
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
    const element = (
        <div
            title={name}
            draggable
            onDragStart={handleDragStart}
            onContextMenu={handleContextMenu}
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
