import { useState } from 'react';

import type { AppColorType } from '../../others/color/colorHelpers';
import {
    HEX_COLOR_BLACK,
    toHexColorString,
} from '../../others/color/colorHelpers';
import { useScreenBibleManagerEvents } from '../managers/screenEventHelpers';
import ScreenBibleManager from '../managers/ScreenBibleManager';

export function useStylingColor() {
    const [color, setColor] = useState(
        toHexColorString(ScreenBibleManager.textStyleTextColor) ??
            HEX_COLOR_BLACK,
    );
    useScreenBibleManagerEvents(['text-style'], undefined, () => {
        setColor(
            toHexColorString(ScreenBibleManager.textStyleTextColor) ??
                HEX_COLOR_BLACK,
        );
    });
    const setColorToStyle = (newColor: AppColorType) => {
        ScreenBibleManager.applyTextStyle({
            color: newColor,
        });
    };
    return [color, setColorToStyle] as const;
}

export function useStylingFontSize() {
    const [fontSize, setFontSize] = useState(
        ScreenBibleManager.textStyleTextFontSize,
    );
    useScreenBibleManagerEvents(['text-style'], undefined, () => {
        setFontSize(ScreenBibleManager.textStyleTextFontSize);
    });
    const setFontSizeToStyle = (newFontSize: number) => {
        ScreenBibleManager.applyTextStyle({
            fontSize: newFontSize,
        });
    };
    return [fontSize, setFontSizeToStyle] as const;
}
