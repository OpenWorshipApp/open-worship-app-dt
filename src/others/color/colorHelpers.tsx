import { DragTypeEnum } from '../../helper/DragInf';
import { handleDragStart } from '../../helper/dragHelpers';
import { removeOpacityFromHexColor } from '../../server/appHelpers';

export const HEX_COLOR_BLACK = '#000000';
export const HEX_COLOR_WHITE = '#FFFFFF';
export type AppColorType = `#${string}`;

export function toHexColorString(color: any): string | null {
    color = color.toLowerCase();
    if (typeof color !== 'string' || color === 'transparent') {
        return null;
    }
    if (color === 'white') {
        return HEX_COLOR_WHITE;
    }
    if (color === 'black') {
        return HEX_COLOR_BLACK;
    }
    if (color.startsWith('#')) {
        if (color.length === 4) {
            // #fff => #ffffff
            return (
                '#' +
                color[1] +
                color[1] +
                color[2] +
                color[2] +
                color[3] +
                color[3]
            );
        }
        if (color.length === 7 || color.length === 9) {
            return color;
        }
        return null;
    }
    // rgb(255, 255, 255) => #ffffff
    const regex = /(\d+),\s*(\d+),\s*(\d+)/;
    const rgb = regex.exec(color);
    if (rgb === null) {
        return null;
    }
    const r = Number.parseInt(rgb[1]).toString(16).padStart(2, '0');
    const g = Number.parseInt(rgb[2]).toString(16).padStart(2, '0');
    const b = Number.parseInt(rgb[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}

export const colorToTransparent = (fullColor: AppColorType): number => {
    const hexStr = `${fullColor[7]}${fullColor[8]}`;
    return Number.parseInt(hexStr, 16) || 255;
};

export const transparentColor = (n: number): string => {
    const hex = n.toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
};

export function compareColor(
    color1: AppColorType,
    color2: AppColorType,
): boolean {
    return (
        removeOpacityFromHexColor(
            toHexColorString(color1) || '',
        ).toLowerCase() ===
        removeOpacityFromHexColor(toHexColorString(color2) || '').toLowerCase()
    );
}

export function colorDeserialize(data: AppColorType) {
    return data;
}
export function serializeForDragging(event: any, color: AppColorType) {
    handleDragStart(event, {
        dragSerialize: () => {
            return {
                type: DragTypeEnum.BACKGROUND_COLOR,
                data: color,
            };
        },
    });
}

export function checkIsColorDark(color: any): boolean {
    const hexColor = toHexColorString(color);
    if (hexColor === null) {
        return false;
    }
    const r = Number.parseInt(hexColor.slice(1, 3), 16);
    const g = Number.parseInt(hexColor.slice(3, 5), 16);
    const b = Number.parseInt(hexColor.slice(5, 7), 16);
    const alpha = colorToTransparent((hexColor + 'ffffffff') as any) / 255;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    // Adjust brightness based on alpha
    const adjustedBrightness = brightness * alpha + 255 * (1 - alpha);
    return adjustedBrightness < 128;
}
