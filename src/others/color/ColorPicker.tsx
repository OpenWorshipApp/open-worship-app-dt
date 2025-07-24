import './ColorPicker.scss';

import { useState } from 'react';

import colorList from '../color-list.json';
import {
    AppColorType,
    transparentColor,
    colorToTransparent,
} from './colorHelpers';
import OpacitySlider from './OpacitySlider';
import RenderColors from './RenderColors';
import { useAppEffect } from '../../helper/debuggerHelpers';
import { freezeObject } from '../../helper/helpers';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../../context-menu/appContextMenuHelpers';
import { copyToClipboard } from '../../server/appHelpers';

freezeObject(colorList);

function setOpacity(color: string, opacity: number) {
    const hex = transparentColor(opacity);
    const newColor = color.split('');
    let offset = 0;
    if (newColor[0] === '#') {
        offset = 1;
    }
    newColor[offset + 6] = hex[0];
    newColor[offset + 7] = hex[1];
    return newColor.join('');
}

export default function ColorPicker({
    defaultColor,
    color,
    onColorChange,
    onNoColor,
    isCollapsable = false,
    isNoImmediate = false,
}: Readonly<{
    defaultColor: AppColorType;
    color: AppColorType | null;
    onColorChange?: (color: AppColorType, event: MouseEvent) => void;
    onNoColor?: (color: AppColorType, event: MouseEvent) => void;
    isCollapsable?: boolean;
    isNoImmediate?: boolean;
}>) {
    const [isOpened, setIsOpened] = useState(false);
    const [localColor, setLocalColor] = useState(color);
    const opacity = localColor !== null ? colorToTransparent(localColor) : 255;
    useAppEffect(() => {
        setLocalColor(color);
    }, [color]);
    const applyNewColor = (newColor: string, event: MouseEvent) => {
        const upperColor = newColor.toUpperCase() as AppColorType;
        if (!onColorChange) {
            return;
        }
        setLocalColor(upperColor);
        onColorChange(upperColor, event);
    };
    const handleColorChanging = (newColor: AppColorType | null, event: any) => {
        if (newColor === null) {
            onNoColor?.(defaultColor, event);
            return;
        }
        const newColorStr = setOpacity(newColor as string, opacity);
        applyNewColor(newColorStr, event);
    };
    const handleOpacityChanging = (value: number, event: any) => {
        if (localColor === null) {
            return;
        }
        const newColor = setOpacity(localColor, value);
        applyNewColor(newColor, event);
    };
    const handleContextMenuOpening = (event: any) => {
        if (!localColor) {
            return;
        }
        const contextMenuItems: ContextMenuItemType[] = [];
        // TODO: paste color
        if (localColor) {
            contextMenuItems.push({
                menuElement: 'Copy Color',
                onSelect: () => {
                    copyToClipboard(localColor);
                },
            });
        }
        showAppContextMenu(event, contextMenuItems);
    };
    if (isCollapsable && !isOpened) {
        return (
            <div
                className="flex-item color-picker app-caught-hover-pointer "
                onContextMenu={handleContextMenuOpening}
                style={{
                    border: '1px solid var(--bs-gray-700)',
                }}
                onClick={() => {
                    setIsOpened(true);
                }}
            >
                <i className="bi bi-chevron-right" />
                <div
                    className="h-100 px-1 app-ellipsis"
                    style={{
                        backgroundColor: color ?? 'transparent',
                        width: 'calc(100% - 10px)',
                        textShadow:
                            '0 0 2px var(--bs-gray-900), 0 0 2px var(--bs-gray-900)',
                    }}
                >
                    {color}
                </div>
            </div>
        );
    }
    return (
        <div
            className="flex-item color-picker"
            onContextMenu={handleContextMenuOpening}
            style={{
                backgroundColor: 'var(--bs-gray-700)',
            }}
        >
            {isCollapsable ? (
                <i
                    className="app-caught-hover-pointer bi bi-chevron-down"
                    onClick={() => {
                        setIsOpened(false);
                    }}
                />
            ) : null}
            <div className="p-1 overflow-hidden">
                <RenderColors
                    colors={colorList.main}
                    selectedColor={localColor}
                    onColorChange={handleColorChanging}
                    isNoImmediate={isNoImmediate}
                />
                {localColor !== null && (
                    <OpacitySlider
                        value={opacity}
                        onOpacityChanged={handleOpacityChanging}
                    />
                )}
            </div>
        </div>
    );
}
