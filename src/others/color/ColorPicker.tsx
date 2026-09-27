import ContextMenuDotsButtonComp from '../../context-menu/ContextMenuDotsButtonComp';
import './ColorPicker.scss';

import { useCallback, useState } from 'react';

import colorList from '../color-list.json';
import type { AppColorType } from './colorHelpers';
import {
    transparentColor,
    colorToTransparent,
    checkIsColorDark,
    removeOpacityFromHexColor,
} from './colorHelpers';
import OpacitySliderComp from './OpacitySliderComp';
import RenderColorsComp from './RenderColorsComp';
import { useAppEffect, useAppCurrentRef } from '../../helper/appHooks';
import { freezeObject } from '../../helper/helpers';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import { copyToClipboard } from '../../server/appHelpers';
import { tran } from '../../lang/langHelpers';

freezeObject(colorList);

/**
 * The text color the collapsed chip writes its own hex in. The chip is painted
 * in the color it names, so a fixed text color vanishes on the one swatch that
 * matches it (`#ffffff` in white on white). A mostly see-through color shows
 * the panel behind it instead, and keeps the theme's own text.
 */
function genPreviewTextStyle(color: AppColorType | null | undefined) {
    if (!color || colorToTransparent(color) < 128) {
        return {};
    }
    const isDark = checkIsColorDark(removeOpacityFromHexColor(color));
    return {
        color: isDark ? '#ffffff' : '#000000',
        textShadow: 'none',
    };
}

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

export default function ColorPickerComp({
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
            // Alpha 0 is only ever "no color" (the slider stops at 1), so a
            // color picked from there must come out visible: carrying the 0
            // over stored an invisible `#FF000000` for "red".
            const opacityToKeep =
                opacityRef.current === 0 ? 255 : opacityRef.current;
            const newColorStr = setOpacity(newColor as string, opacityToKeep);
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
            childBefore: genContextMenuItemIcon('clipboard', {
                color: currentLocalColor,
            }),
            menuElement: tran('Copy Color'),
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
                className="app-flex-item color-picker"
                onContextMenu={handleContextMenuOpening}
            >
                {/* A real button, so the picker can be reached and opened
                    from the keyboard and has a name -- it was a clickable
                    div. Beside the `⋮`, not around it: a button may not hold
                    another. */}
                <button
                    type="button"
                    className="color-picker-toggle app-caught-hover-pointer"
                    aria-expanded={false}
                    aria-label={`${tran('Choose Color')}: ${color ?? ''}`}
                    onClick={handleOpen}
                >
                    <i className="bi bi-chevron-right" />
                    <span
                        className="h-100 px-1 app-ellipsis text-color-preview"
                        style={{
                            backgroundColor: color ?? 'transparent',
                            width: 'calc(100% - 10px)',
                            ...genPreviewTextStyle(color),
                        }}
                    >
                        {color}
                    </span>
                </button>
                <ContextMenuDotsButtonComp
                    onOpening={handleContextMenuOpening}
                />
            </div>
        );
    }
    return (
        <div
            className="app-flex-item color-picker"
            onContextMenu={handleContextMenuOpening}
        >
            {isCollapsable ? (
                <button
                    type="button"
                    className="color-picker-toggle app-caught-hover-pointer"
                    aria-expanded={true}
                    aria-label={tran('Collapse')}
                    title={tran('Collapse')}
                    onClick={handleClose}
                >
                    <i className="bi bi-chevron-down" />
                </button>
            ) : null}
            <ContextMenuDotsButtonComp
                className="float-end"
                onOpening={handleContextMenuOpening}
            />
            <div className="p-1 app-overflow-hidden">
                <RenderColorsComp
                    colors={colorList.main}
                    selectedColor={localColor}
                    onColorChange={handleColorChanging}
                    isNoImmediate={isNoImmediate}
                    canNoColor={onNoColor !== undefined}
                />
                {localColor !== null && (
                    <OpacitySliderComp
                        value={opacity}
                        onOpacityChanged={handleOpacityChanging}
                    />
                )}
            </div>
        </div>
    );
}
