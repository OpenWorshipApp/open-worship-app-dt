import { copyToClipboard } from '../../server/appHelpers';
import { AppColorType, serializeForDragging } from './colorHelpers';
import { genShowOnScreensContextMenu } from '../FileItemHandlerComp';
import ScreenBackgroundManager from '../../_screen/managers/ScreenBackgroundManager';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../../context-menu/appContextMenuHelpers';

function showContextMenu(event: any, color: AppColorType) {
    const menuItems: ContextMenuItemType[] = [
        {
            menuElement: `Copy to '${color}' to clipboard`,
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
    const element = (
        <div
            title={name}
            draggable
            onDragStart={(event) => {
                serializeForDragging(event, color);
            }}
            onContextMenu={(event) => {
                showContextMenu(event, color);
            }}
            className={
                'm-1 color-item app-caught-hover-pointer' +
                (isSelected ? ' app-border-white-round' : '')
            }
            style={{
                width: '20px',
                height: '15px',
                backgroundColor: color,
            }}
            onClick={(event) => {
                onClick?.(event as any, color);
            }}
        />
    );
    if (isSelected) {
        return (
            <span className="app-highlight-selected animation">{element}</span>
        );
    }
    return element;
}
