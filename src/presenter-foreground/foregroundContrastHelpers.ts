import {
    type AppColorType,
    checkIsColorDark,
} from '../others/color/colorValueHelpers';
import {
    DEFAULT_BACKGROUND_COLOR,
    DEFAULT_TEXT_COLOR,
} from './foregroundStyleSettingNames';

/**
 * Dark / Light for a foreground box of words (2026-11-09, the user: _all
 * foreground properties preset should support dark/light mode_, then
 * _dark/light just do calculation to make current text and background color
 * contrast_, _do not change background color but make it darker/lighter_,
 * _make text color lighter/darker_).
 *
 * Nothing is chosen from a list: the box keeps its own colours -- their hue,
 * their saturation, their transparency -- and only how LIGHT each is moves.
 * Dark puts a darker box behind lighter words, for a dark slide; Light a
 * lighter box behind darker words, for a light one. A colour already on its
 * side is left as it is; each is first mirrored across the middle
 * (lightness 1 - L), then the words and, once they can go no further, the
 * box are moved on toward black and white until the words read at 4.5 to 1
 * (WCAG AA) against the box as it shows over a slide of that side.
 *
 * Pure: no setting is read here.
 */

export type ForegroundColorModeType = 'dark' | 'light';

export const FOREGROUND_COLOR_MODE_LIST: readonly ForegroundColorModeType[] = [
    'dark',
    'light',
];

export function checkIsForegroundColorMode(
    value: unknown,
): value is ForegroundColorModeType {
    return FOREGROUND_COLOR_MODE_LIST.includes(value as any);
}

/**
 * The side a box is on, read off its WORDS and never stored -- as the Bible
 * text's switch is: light words are the dark side.
 */
export function toForegroundColorMode(
    textColor: string,
): ForegroundColorModeType {
    return checkIsColorDark(textColor) ? 'light' : 'dark';
}

export const MIN_FOREGROUND_TEXT_CONTRAST = 4.5;
const LIGHTNESS_STEP = 0.02;

type HslaType = {
    h: number;
    s: number;
    l: number;
    /** Two hex digits, or '' for a colour written without them. */
    alphaHex: string;
};

function toHsla(color: string): HslaType | null {
    if (typeof color !== 'string') {
        return null;
    }
    let hex = color.trim();
    if (/^#[0-9a-f]{3}$/i.test(hex)) {
        hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) {
        return null;
    }
    const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
    const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
    const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) {
            h = (g - b) / d + (g < b ? 6 : 0);
        } else if (max === g) {
            h = (b - r) / d + 2;
        } else {
            h = (r - g) / d + 4;
        }
        h /= 6;
    }
    return { h, s, l, alphaHex: hex.slice(7, 9).toUpperCase() };
}

function hueToChannel(p: number, q: number, t: number) {
    let tt = t;
    if (tt < 0) {
        tt += 1;
    }
    if (tt > 1) {
        tt -= 1;
    }
    if (tt < 1 / 6) {
        return p + (q - p) * 6 * tt;
    }
    if (tt < 1 / 2) {
        return q;
    }
    if (tt < 2 / 3) {
        return p + (q - p) * (2 / 3 - tt) * 6;
    }
    return p;
}

function toRgb({ h, s, l }: HslaType): [number, number, number] {
    if (s === 0) {
        return [l, l, l];
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [
        hueToChannel(p, q, h + 1 / 3),
        hueToChannel(p, q, h),
        hueToChannel(p, q, h - 1 / 3),
    ];
}

function toHex(hsla: HslaType): AppColorType {
    const digits = toRgb(hsla)
        .map((channel) => {
            return Math.round(Math.min(1, Math.max(0, channel)) * 255)
                .toString(16)
                .padStart(2, '0');
        })
        .join('');
    return `#${digits}${hsla.alphaHex}`.toUpperCase() as AppColorType;
}

function toAlpha(hsla: HslaType) {
    return hsla.alphaHex === '' ? 1 : Number.parseInt(hsla.alphaHex, 16) / 255;
}

function toLuminance([r, g, b]: [number, number, number]) {
    const toLinear = (channel: number) => {
        return channel <= 0.03928
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function blendOver(
    top: [number, number, number],
    alpha: number,
    under: [number, number, number],
): [number, number, number] {
    return [
        top[0] * alpha + under[0] * (1 - alpha),
        top[1] * alpha + under[1] * (1 - alpha),
        top[2] * alpha + under[2] * (1 - alpha),
    ];
}

/** The words against the box, the box shown over a slide of that side. */
function toContrast(
    text: HslaType,
    background: HslaType,
    mode: ForegroundColorModeType,
) {
    const slide: [number, number, number] =
        mode === 'light' ? [1, 1, 1] : [0, 0, 0];
    const box = blendOver(toRgb(background), toAlpha(background), slide);
    const words = blendOver(toRgb(text), toAlpha(text), box);
    const a = toLuminance(box);
    const b = toLuminance(words);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

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

/**
 * The words' and the box's colours on `mode`'s side, each keeping its own
 * hue, saturation and transparency. A colour that did not have to move is
 * handed back exactly as it came, so pressing the side a box is already on
 * changes nothing.
 */
export function genForegroundContrastColors(
    colors: { color: string; backgroundColor: string },
    mode: ForegroundColorModeType,
): { color: string; backgroundColor: string } {
    const text = toHsla(colors.color);
    const background = toHsla(colors.backgroundColor);
    if (text === null || background === null) {
        return colors;
    }
    const isLight = mode === 'light';
    // Lighter or darker, never another colour.
    const textEnd = isLight ? 0 : 1;
    const backgroundEnd = isLight ? 1 : 0;
    const startText = text.l;
    const startBackground = background.l;
    text.l = isLight
        ? Math.min(text.l, 1 - text.l)
        : Math.max(text.l, 1 - text.l);
    background.l = isLight
        ? Math.max(background.l, 1 - background.l)
        : Math.min(background.l, 1 - background.l);
    const toward = (value: number, end: number) => {
        return end > value
            ? Math.min(end, value + LIGHTNESS_STEP)
            : Math.max(end, value - LIGHTNESS_STEP);
    };
    // 1 / 0.02 steps each way at most: black on white always passes.
    for (let index = 0; index < 120; index++) {
        if (
            toContrast(text, background, mode) >= MIN_FOREGROUND_TEXT_CONTRAST
        ) {
            break;
        }
        if (text.l !== textEnd) {
            text.l = toward(text.l, textEnd);
        } else if (background.l !== backgroundEnd) {
            background.l = toward(background.l, backgroundEnd);
        } else {
            break;
        }
    }
    return {
        color: text.l === startText ? colors.color : toHex(text),
        backgroundColor:
            background.l === startBackground
                ? colors.backgroundColor
                : toHex(background),
    };
}
