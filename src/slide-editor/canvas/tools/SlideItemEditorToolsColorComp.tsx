import ColorPicker from '../../../others/color/ColorPicker';
import { AppColorType } from '../../../others/color/colorHelpers';

export default function SlideItemEditorToolsColorComp({
    color, handleNoColoring, handleColorChanging,
}: Readonly<{
    color: AppColorType,
    handleNoColoring?: () => void,
    handleColorChanging: (newColor: AppColorType) => void,
}>) {
    return (
        <div className='border-white-round' style={{
            maxWidth: '200px',
        }}>
            <ColorPicker color={color}
                defaultColor='#ffffff'
                onNoColor={handleNoColoring}
                onColorChange={handleColorChanging}
            />
        </div>
    );
}
