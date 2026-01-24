import ColorPicker from '../../../others/color/ColorPicker';
import type { AppColorType } from '../../../others/color/colorHelpers';

export default function SlideEditorToolsColorComp({
    color,
    handleNoColoring,
    handleColorChanging,
}: Readonly<{
    color: AppColorType;
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
            <ColorPicker
                color={color}
                defaultColor="#ffffff"
                onNoColor={handleNoColoring}
                onColorChange={handleColorChanging}
                isCollapsable
            />
        </div>
    );
}
