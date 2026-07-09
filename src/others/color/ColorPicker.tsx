import './ColorPicker.scss';

import { useCallback, useState } from 'react';

import colorList from '../color-list.json';
import type { AppColorType } from './colorHelpers';
import { transparentColor, colorToTransparent } from './colorHelpers';
import OpacitySlider from './OpacitySlider';
import RenderColors from './RenderColors';
import { useAppEffect, useAppCurrentRef } from '../../helper/appHooks';
import { freezeObject } from '../../helper/helpers';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../../context-menu/appContextMenuHelpers';
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
    color: AppColorType | null | undefined;
    onColorChange?: (color: AppColorType, event: MouseEvent) => void;
    onNoColor?: (color: AppColorType, event: MouseEvent) => void;
    isCollapsable?: boolean;
    isNoImmediate?: boolean;
}>) {
    const [isOpened, setIsOpened] = useState(false);
    const [localColor, setLocalColor] = useState(color);
    const opacity = localColor ? colorToTransparent(localColor) : 255;
    useAppEffect(() => {
        setLocalColor(color);
    }, [color]);
    const applyNewColor = useCallback(
        (newColor: string, event: MouseEvent) => {
            const upperColor = newColor.toUpperCase() as AppColorType;
            if (!onColorChange) {
                return;
            }
            setLocalColor(upperColor);
            onColorChange(upperColor, event);
        },
        [onColorChange],
    );
    const onNoColorRef = useAppCurrentRef(onNoColor);
    const defaultColorRef = useAppCurrentRef(defaultColor);
    const opacityRef = useAppCurrentRef(opacity);
    const applyNewColorRef = useAppCurrentRef(applyNewColor);
    const handleColorChanging = useCallback(
        (newColor: AppColorType | null, event: any) => {
            if (newColor === null) {
                onNoColorRef.current?.(defaultColorRef.current, event);
                return;
            }
            const newColorStr = setOpacity(
                newColor as string,
                opacityRef.current,
            );
            applyNewColorRef.current(newColorStr, event);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const localColorRef = useAppCurrentRef(localColor);
    const handleOpacityChanging = useCallback((value: number, event: any) => {
        if (!localColorRef.current) {
            return;
        }
        const newColor = setOpacity(localColorRef.current, value);
        applyNewColorRef.current(newColor, event);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleContextMenuOpening = useCallback((event: any) => {
        const currentLocalColor = localColorRef.current;
        if (!currentLocalColor) {
            return;
        }
        const contextMenuItems: ContextMenuItemType[] = [];
        // TODO: paste color
        contextMenuItems.push({
            menuElement: 'Copy Color',
            onSelect: () => {
                copyToClipboard(currentLocalColor);
            },
        });
        showAppContextMenu(event, contextMenuItems);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleOpen = useCallback(() => {
        setIsOpened(true);
    }, []);
    const handleClose = useCallback(() => {
        setIsOpened(false);
    }, []);
    if (isCollapsable && !isOpened) {
        return (
            <div
                className="app-flex-item color-picker app-caught-hover-pointer "
                onContextMenu={handleContextMenuOpening}
                onClick={handleOpen}
            >
                <i className="bi bi-chevron-right" />
                <div
                    className="h-100 px-1 app-ellipsis text-color-preview"
                    style={{
                        backgroundColor: color ?? 'transparent',
                        width: 'calc(100% - 10px)',
                    }}
                >
                    {color}
                </div>
            </div>
        );
    }
    return (
        <div
            className="app-flex-item color-picker"
            onContextMenu={handleContextMenuOpening}
        >
            {isCollapsable ? (
                <i
                    className="app-caught-hover-pointer bi bi-chevron-down"
                    onClick={handleClose}
                />
            ) : null}
            <div className="p-1 app-overflow-hidden">
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
