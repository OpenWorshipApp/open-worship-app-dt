import { DragTypeEnum } from '../../helper/DragInf';
import { handleDragStart } from '../../helper/dragHelpers';
import { removeOpacityFromHexColor } from '../../server/appHelpers';

export const BLACK_COLOR = '#000000';
export type AppColorType = `#${string}`;

export function toHexColorString(color: string): string {
    // rgb(255, 255, 255) => #ffffff
    const regex = /(\d+),\s*(\d+),\s*(\d+)/;
    const rgb = regex.exec(color);
    if (rgb !== null) {
        const r = Number.parseInt(rgb[1]).toString(16).padStart(2, '0');
        const g = Number.parseInt(rgb[2]).toString(16).padStart(2, '0');
        const b = Number.parseInt(rgb[3]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }
    return color;
}

export const colorToTransparent = (color: AppColorType): number => {
    const hexStr = `${color[7]}${color[8]}`;
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
        removeOpacityFromHexColor(color1).toLowerCase() ===
        removeOpacityFromHexColor(color2).toLowerCase()
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
