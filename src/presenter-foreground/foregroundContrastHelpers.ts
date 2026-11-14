import {
    COLOR_MODE_LIST,
    MIN_TEXT_CONTRAST,
    type ColorModeType,
    checkIsColorMode,
    genContrastColors,
    toColorMode,
} from '../others/color/colorContrastHelpers';
import {
    DEFAULT_BACKGROUND_COLOR,
    DEFAULT_TEXT_COLOR,
} from './foregroundStyleSettingNames';

/**
 * Dark / Light for a foreground box of words: the calculation is
 * `colorContrastHelpers`' (shared with a slide's text box since 2026-11-10),
 * kept under the names every foreground module already calls it by.
 */

export type ForegroundColorModeType = ColorModeType;

export const FOREGROUND_COLOR_MODE_LIST = COLOR_MODE_LIST;

export const checkIsForegroundColorMode = checkIsColorMode;

/**
 * The side a box is on, read off its WORDS and never stored -- as the Bible
 * text's switch is: light words are the dark side.
 */
export const toForegroundColorMode = toColorMode;

export const MIN_FOREGROUND_TEXT_CONTRAST = MIN_TEXT_CONTRAST;

/**
 * The words' and the box's colours on `mode`'s side, each keeping its own
 * hue, saturation and transparency (`genContrastColors`).
 */
export const genForegroundContrastColors = genContrastColors;

/**
 * What the words and their box are drawn in while nobody has picked a
 * colour: the panel's defaults on the side the APP's theme is on (the same
 * day, the user: _make the properties dark/light same with app theme (if
 * not set by user)_) -- white on the dark blue box in a dark window, their
 * light side in a light one. A colour somebody picked, or a preset wrote,
 * is theirs and stays.
 */
export function genForegroundDefaultColors(isDarkTheme: boolean) {
    const colors = {
        color: DEFAULT_TEXT_COLOR as string,
        backgroundColor: DEFAULT_BACKGROUND_COLOR as string,
    };
    return isDarkTheme ? colors : genForegroundContrastColors(colors, 'light');
}
