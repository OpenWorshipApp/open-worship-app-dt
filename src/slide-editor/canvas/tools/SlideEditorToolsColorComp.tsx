import ColorPickerComp from '../../../others/color/ColorPicker';
import {
    HEX_COLOR_WHITE,
    type AppColorType,
} from '../../../others/color/colorHelpers';

export default function SlideEditorToolsColorComp({
    color,
    label,
    handleNoColoring,
    handleColorChanging,
}: Readonly<{
    color: AppColorType;
    label: string;
    handleNoColoring?: () => void;
    handleColorChanging: (newColor: AppColorType) => void;
}>) {
    return (
        <div
            className="app-border-white-round"
            style={{
                maxWidth: '300px',
            }}
        >
            <ColorPickerComp
                color={color}
                colorInputLabel={label}
                defaultColor={HEX_COLOR_WHITE}
                onNoColor={handleNoColoring}
                onColorChange={handleColorChanging}
                isCollapsable
            />
        </div>
    );
}
