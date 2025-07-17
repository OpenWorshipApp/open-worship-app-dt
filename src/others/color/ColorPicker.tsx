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
}: Readonly<{
    defaultColor: AppColorType;
    color: AppColorType | null;
    onColorChange?: (color: AppColorType, event: MouseEvent) => void;
    onNoColor?: (color: AppColorType, event: MouseEvent) => void;
}>) {
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
    return (
        <div
            className="flex-item color-picker"
            style={{
                backgroundColor: 'var(--bs-gray-700)',
            }}
        >
            <div className="p-1 overflow-hidden">
                <RenderColors
                    colors={colorList.main}
                    selectedColor={localColor}
                    onColorChange={handleColorChanging}
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
