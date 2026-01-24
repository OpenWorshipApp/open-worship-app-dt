import type { AppColorType } from '../others/color/colorHelpers';
import ScreenBibleManager from '../_screen/managers/ScreenBibleManager';
import AppRangeComp from '../others/AppRangeComp';
import {
    useStylingColor,
    useStylingFontSize,
} from '../_screen/preview/stylingHelpers';

export default function ScreenBibleAppearanceComp() {
    const [color, setColor] = useStylingColor();
    const [fontSize, setFontSize] = useStylingFontSize();
    return (
        <div>
            <span className="p-">
                Font Size:{' '}
                <span className="badge bg-success">({fontSize}px)</span>
            </span>
            <input
                className="float-end app-caught-hover-pointer"
                type="color"
                onChange={(event) => {
                    setColor(event.target.value as AppColorType);
                }}
                value={color}
            />
            <div>
                <AppRangeComp
                    value={fontSize}
                    title="Font Size"
                    setValue={setFontSize}
                    defaultSize={{
                        size: fontSize,
                        min: 1,
                        max: ScreenBibleManager.maxTextStyleTextFontSize,
                        step: 1,
                    }}
                />
            </div>
        </div>
    );
}
