import type { ColorModeType } from './colorContrastHelpers';
import {
    type AppColorType,
    checkIsColorDark,
    colorToTransparent,
    compareColor,
} from './colorValueHelpers';

/**
 * The swatches the picker's Dark / Light switch puts under the sixteen basic
 * ones (2026-11-14, the user: _enhance color picker panel_, _should have
 * dark/light mode switch_). The basic sixteen stay as they were, by name --
 * agents press them by it (`owa_click "navy"`) and colour notes and screen
 * groups name them (`color-list.json` `main`) -- so the switch only chooses
 * which tones are offered beside them: deep ones that light words read on
 * (a dark slide, a dark background), or pale ones that dark words read on.
 *
 * Two rows of eight a side, one column per hue (neutral, red, orange,
 * yellow, green, teal, blue, purple), the row nearest the extreme first.
 * None of them is one of the basic sixteen, so a held colour is lit in one
 * place only. Pure and tiny: imported by every colour picker.
 */
export const COLOR_TONE_MAP: Readonly<
    Record<ColorModeType, readonly AppColorType[]>
> = Object.freeze({
    dark: Object.freeze([
        '#18181B',
        '#450A0A',
        '#431407',
        '#422006',
        '#052E16',
        '#042F2E',
        '#172554',
        '#3B0764',
        '#3F3F46',
        '#7F1D1D',
        '#7C2D12',
        '#713F12',
        '#14532D',
        '#134E4A',
        '#1E3A8A',
        '#581C87',
    ] as AppColorType[]),
    light: Object.freeze([
        '#F4F4F5',
        '#FEE2E2',
        '#FFEDD5',
        '#FEF9C3',
        '#DCFCE7',
        '#CCFBF1',
        '#DBEAFE',
        '#F3E8FF',
        '#D4D4D8',
        '#FCA5A5',
        '#FDBA74',
        '#FDE047',
        '#86EFAC',
        '#5EEAD4',
        '#93C5FD',
        '#D8B4FE',
    ] as AppColorType[]),
});

/** The tone list a colour is one of, alpha aside; null for any other. */
export function findColorTone(
    color: AppColorType | null | undefined,
): ColorModeType | null {
    if (!color) {
        return null;
    }
    for (const tone of ['dark', 'light'] as const) {
        const isFound = COLOR_TONE_MAP[tone].some((toneColor) => {
            return compareColor(toneColor, color);
        });
        if (isFound) {
            return tone;
        }
    }
    return null;
}

/**
 * The side the switch opens on: the list holding the held colour, else the
 * side the held colour is on, else Dark -- a picker holding nothing is most
 * often a background's, and a worship background is most often dark. A
 * colour mostly see-through says nothing about either side.
 */
export function toInitialColorTone(
    color: AppColorType | null | undefined,
): ColorModeType {
    const tone = findColorTone(color);
    if (tone !== null) {
        return tone;
    }
    if (!color || colorToTransparent(color) < 128) {
        return 'dark';
    }
    return checkIsColorDark(color.slice(0, 7)) ? 'dark' : 'light';
}
