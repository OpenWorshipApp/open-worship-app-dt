import { AnyObjectType } from '../../helper/helpers';
import { AppColorType, compareColor } from './colorHelpers';
import SelectCustomColor from './SelectCustomColor';
import RenderColor from './RenderColor';
import RenderNoColor from './RenderNoColor';

export default function RenderColors({
    colors,
    selectedColor,
    onColorChange,
}: Readonly<{
    colors: AnyObjectType;
    selectedColor: AppColorType | null;
    onColorChange: (color: AppColorType | null, event: MouseEvent) => void;
}>) {
    const handleNoColoring = (event: any) => {
        onColorChange(null, event);
    };
    const handleColorChanging = (event: any, color: AppColorType) => {
        onColorChange(color, event);
    };
    const handleColorSelecting = (color: AppColorType, event: any) => {
        onColorChange(color, event);
    };
    return (
        <div>
            <div>
                {selectedColor ? (
                    <RenderColor
                        name={selectedColor}
                        color={selectedColor}
                        isSelected
                    />
                ) : (
                    <RenderNoColor isSelected />
                )}
            </div>
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
                                    selectedColor !== null &&
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
                />
            </div>
        </div>
    );
}
