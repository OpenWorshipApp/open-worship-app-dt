import { useCallback } from 'react';

import type { AppColorType } from './colorHelpers';
import { compareColor } from './colorHelpers';
import SelectCustomColor from './SelectCustomColor';
import RenderColor from './RenderColor';
import RenderNoColor from './RenderNoColor';
import type { AnyObjectType } from '../../helper/typeHelpers';

export default function RenderColors({
    colors,
    selectedColor,
    onColorChange,
    isNoImmediate = false,
}: Readonly<{
    colors: AnyObjectType;
    selectedColor: AppColorType | null | undefined;
    onColorChange: (color: AppColorType | null, event: MouseEvent) => void;
    isNoImmediate?: boolean;
}>) {
    const handleNoColoring = useCallback(
        (event: any) => {
            onColorChange(null, event);
        },
        [onColorChange],
    );
    const handleColorChanging = useCallback(
        (event: any, color: AppColorType) => {
            onColorChange(color, event);
        },
        [onColorChange],
    );
    const handleColorSelecting = useCallback(
        (color: AppColorType, event: any) => {
            onColorChange(color, event);
        },
        [onColorChange],
    );
    return (
        <div>
            <div className="d-flex flex-wrap app-border-white-round">
                <RenderNoColor
                    isSelected={!selectedColor}
                    onClick={handleNoColoring}
                />
                {Object.entries(colors).map(
                    ([name, color]: [string, AppColorType]) => {
                        return (
                            <RenderColor
                                key={color}
                                name={name}
                                color={color}
                                isSelected={
                                    !!selectedColor &&
                                    compareColor(selectedColor, color)
                                }
                                onClick={handleColorChanging}
                            />
                        );
                    },
                )}
            </div>
            <div className="m-2">
                <SelectCustomColor
                    color={selectedColor}
                    onColorSelected={handleColorSelecting}
                    isNoImmediate={isNoImmediate}
                />
            </div>
        </div>
    );
}
