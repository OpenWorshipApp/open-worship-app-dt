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
    canNoColor = true,
}: Readonly<{
    colors: AnyObjectType;
    selectedColor: AppColorType | null | undefined;
    onColorChange: (color: AppColorType | null, event: MouseEvent) => void;
    isNoImmediate?: boolean;
    // Whether this picker can actually clear. A picker with nothing to clear
    // -- the Background Colors tab before any screen has a colour -- used to
    // draw the red "x" tile anyway, fully enabled-looking, wired to a handler
    // its owner never supplied: pressing it did nothing at all. An offered
    // control that cannot act is worse than no control.
    canNoColor?: boolean;
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
                {canNoColor ? (
                    <RenderNoColorComp
                        isSelected={!selectedColor}
                        onClick={handleNoColoring}
                    />
                ) : null}
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
