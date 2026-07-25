import { useCallback } from 'react';

import type { AppColorType } from './colorHelpers';
import { compareColor } from './colorHelpers';
import SelectCustomColorComp from './SelectCustomColorComp';
import RenderColorComp from './RenderColorComp';
import RenderNoColorComp from './RenderNoColorComp';
import type { AnyObjectType } from '../../helper/typeHelpers';
import { useAppCurrentRef } from '../../helper/appHooks';

export default function RenderColorsComp({
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
    const onColorChangeRef = useAppCurrentRef(onColorChange);
    const handleNoColoring = useCallback((event: any) => {
        onColorChangeRef.current(null, event);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleColorChanging = useCallback(
        (event: any, color: AppColorType) => {
            onColorChangeRef.current(color, event);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleColorSelecting = useCallback(
        (color: AppColorType, event: any) => {
            onColorChangeRef.current(color, event);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return (
        <div>
            <div className="d-flex flex-wrap app-border-white-round">
                <RenderNoColorComp
                    isSelected={!selectedColor}
                    onClick={handleNoColoring}
                />
                {Object.entries(colors).map(
                    ([name, color]: [string, AppColorType]) => {
                        return (
                            <RenderColorComp
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
                <SelectCustomColorComp
                    color={selectedColor}
                    onColorSelected={handleColorSelecting}
                    isNoImmediate={isNoImmediate}
                />
            </div>
        </div>
    );
}
