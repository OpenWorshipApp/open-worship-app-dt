import type { CSSProperties } from 'react';

import { getSetting } from '../helper/settingHelpers';
import type { AppColorType } from '../others/color/colorHelpers';

/**
 * How an overlay is DRESSED -- its frame, its shadow, the space around its
 * words and how those words are set.
 *
 * All of it lives in ONE setting per widget rather than one key per property.
 * `appLocalStorage` is a file per key, so the thirteen values below would have
 * been thirteen more files read every time a widget works out its style, on a
 * machine where a media widget already reads one card's worth per file in a
 * folder. The alignment pad has stored its two values as one JSON string for
 * exactly that reason since it was written.
 *
 * Every default here is what the app already did, with one deliberate
 * exception: `padding`. Words touching the edge of their own coloured box is
 * what the box looks like with none, and that was the first thing reported
 * about the message widget.
 */
export type ForegroundBorderStyleType =
    'none' | 'solid' | 'dashed' | 'dotted' | 'double';
export type ForegroundShadowType =
    'none' | 'soft' | 'medium' | 'strong' | 'glow';
export type ForegroundTextShadowType = 'none' | 'soft' | 'glow' | 'outline';
export type ForegroundTextAlignType = 'left' | 'center' | 'right';

export type ForegroundDecorationType = {
    borderStyle: ForegroundBorderStyleType;
    /** Pixels: a frame is drawn against the screen, not against the text. */
    borderWidth: number;
    borderColor: AppColorType;
    shadow: ForegroundShadowType;
    shadowColor: AppColorType;
    /**
     * `em`, so the box keeps its proportions when the font size changes. A
     * padding in pixels looks right at one size and wrong at every other, and
     * the font size is the control an operator reaches for first.
     */
    padding: number;
    textAlign: ForegroundTextAlignType;
    /** 0 means "leave it alone" -- the screen's own line height stands. */
    lineHeight: number;
    /** `em`, like the padding and for the same reason. */
    letterSpacing: number;
    textShadow: ForegroundTextShadowType;
    textShadowColor: AppColorType;
    isItalic: boolean;
    isUnderline: boolean;
    isUppercase: boolean;
};

/**
 * What one line of a message is worth when nothing has been chosen. It is the
 * figure the message widget stacked its overlays by before any of this
 * existed, so an untouched session stacks exactly as it did.
 */
export const DEFAULT_MESSAGE_LINE_HEIGHT = 1.35;

export const DEFAULT_FOREGROUND_DECORATION: ForegroundDecorationType = {
    borderStyle: 'none',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    // `medium` IS the shadow every non-blending overlay has always had, down
    // to the colour: `0 10px 30px rgb(0 0 0 / 25%)`. Naming it did not change
    // it.
    shadow: 'medium',
    shadowColor: '#00000040',
    padding: 0.25,
    textAlign: 'left',
    lineHeight: 0,
    letterSpacing: 0,
    textShadow: 'none',
    textShadowColor: '#000000CC',
    isItalic: false,
    isUnderline: false,
    isUppercase: false,
};

export const FOREGROUND_BORDER_STYLE_LIST: readonly ForegroundBorderStyleType[] =
    ['none', 'solid', 'dashed', 'dotted', 'double'];
export const FOREGROUND_SHADOW_LIST: readonly ForegroundShadowType[] = [
    'none',
    'soft',
    'medium',
    'strong',
    'glow',
];
export const FOREGROUND_TEXT_SHADOW_LIST: readonly ForegroundTextShadowType[] =
    ['none', 'soft', 'glow', 'outline'];
export const FOREGROUND_TEXT_ALIGN_LIST: readonly ForegroundTextAlignType[] = [
    'left',
    'center',
    'right',
];

export const MAX_FOREGROUND_BORDER_WIDTH = 40;
export const MAX_FOREGROUND_PADDING = 2;
export const MAX_FOREGROUND_LINE_HEIGHT = 3;
export const MIN_FOREGROUND_LETTER_SPACING = -0.1;
export const MAX_FOREGROUND_LETTER_SPACING = 0.5;

export function genDecorationSettingName(prefix: string) {
    return `${prefix}-setting-show-widget-decoration`;
}

/**
 * The dressing a widget starts with.
 *
 * `isText` is the one thing that moves it: the default padding is written in
 * `em`, which needs a font size to mean anything, and the media widgets set
 * none -- a picture widget would inherit whatever the screen happens to be
 * on and inset its own clip by a few stray pixels. A widget with words sets
 * its own font size, so there the `em` is the operator's own number.
 */
export function genDecorationDefault(isText: boolean) {
    return isText
        ? DEFAULT_FOREGROUND_DECORATION
        : { ...DEFAULT_FOREGROUND_DECORATION, padding: 0 };
}

function toValidChoice<T extends string>(
    value: any,
    list: readonly T[],
    fallback: T,
): T {
    return list.includes(value) ? value : fallback;
}

function toValidNumber(value: any, fallback: number, min: number, max: number) {
    const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, parsed));
}

function toValidColor(value: any, fallback: AppColorType): AppColorType {
    return typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value)
        ? (value as AppColorType)
        : fallback;
}

/**
 * Read back whatever is on disk, field by field.
 *
 * Nothing here trusts the stored text: a settings file is a file a person can
 * edit, a half-written one is what a power cut leaves, and this value goes
 * straight into a projector's inline style. A junk field falls back to its own
 * default rather than taking the whole widget's dressing down with it.
 */
export function toForegroundDecoration(
    storedText: string | null,
    fallback: ForegroundDecorationType = DEFAULT_FOREGROUND_DECORATION,
): ForegroundDecorationType {
    if (storedText === null || storedText.trim() === '') {
        return fallback;
    }
    let parsed: any;
    try {
        parsed = JSON.parse(storedText);
    } catch {
        return fallback;
    }
    if (parsed === null || typeof parsed !== 'object') {
        return fallback;
    }
    return {
        borderStyle: toValidChoice(
            parsed.borderStyle,
            FOREGROUND_BORDER_STYLE_LIST,
            fallback.borderStyle,
        ),
        borderWidth: toValidNumber(
            parsed.borderWidth,
            fallback.borderWidth,
            0,
            MAX_FOREGROUND_BORDER_WIDTH,
        ),
        borderColor: toValidColor(parsed.borderColor, fallback.borderColor),
        shadow: toValidChoice(
            parsed.shadow,
            FOREGROUND_SHADOW_LIST,
            fallback.shadow,
        ),
        shadowColor: toValidColor(parsed.shadowColor, fallback.shadowColor),
        padding: toValidNumber(
            parsed.padding,
            fallback.padding,
            0,
            MAX_FOREGROUND_PADDING,
        ),
        textAlign: toValidChoice(
            parsed.textAlign,
            FOREGROUND_TEXT_ALIGN_LIST,
            fallback.textAlign,
        ),
        lineHeight: toValidNumber(
            parsed.lineHeight,
            fallback.lineHeight,
            0,
            MAX_FOREGROUND_LINE_HEIGHT,
        ),
        letterSpacing: toValidNumber(
            parsed.letterSpacing,
            fallback.letterSpacing,
            MIN_FOREGROUND_LETTER_SPACING,
            MAX_FOREGROUND_LETTER_SPACING,
        ),
        textShadow: toValidChoice(
            parsed.textShadow,
            FOREGROUND_TEXT_SHADOW_LIST,
            fallback.textShadow,
        ),
        textShadowColor: toValidColor(
            parsed.textShadowColor,
            fallback.textShadowColor,
        ),
        isItalic: parsed.isItalic === true,
        isUnderline: parsed.isUnderline === true,
        isUppercase: parsed.isUppercase === true,
    };
}

export function getForegroundDecoration(prefix: string, isText: boolean) {
    return toForegroundDecoration(
        getSetting(genDecorationSettingName(prefix)),
        genDecorationDefault(isText),
    );
}

export function checkIsDecorationEngaged(
    decoration: ForegroundDecorationType,
    fallback: ForegroundDecorationType,
) {
    const keys = Object.keys(fallback) as (keyof ForegroundDecorationType)[];
    return keys.some((key) => {
        return decoration[key] !== fallback[key];
    });
}

/** The pixels a frame actually takes, which is none while the style is off. */
export function getDecorationBorderWidth(decoration: ForegroundDecorationType) {
    return decoration.borderStyle === 'none' ? 0 : decoration.borderWidth;
}

/**
 * Offsets in PIXELS, because a box shadow belongs to the box rather than to
 * the type inside it -- a 30px fall reads the same under a clock and under a
 * notice, and scaling it with the font makes a big message cast a shadow the
 * size of the room.
 */
const SHADOW_MAP: Record<
    ForegroundShadowType,
    (color: AppColorType) => string
> = {
    none: () => {
        return 'none';
    },
    soft: (color) => {
        return `0 4px 12px ${color}`;
    },
    medium: (color) => {
        return `0 10px 30px ${color}`;
    },
    strong: (color) => {
        return `0 18px 50px ${color}`;
    },
    glow: (color) => {
        return `0 0 20px ${color}, 0 0 45px ${color}`;
    },
};

/**
 * ...and these in `em`, because a text shadow belongs to the LETTERFORM. An
 * outline two pixels thick disappears under 200px type and swallows the
 * strokes of a Khmer glyph at 30px.
 */
const TEXT_SHADOW_MAP: Record<
    ForegroundTextShadowType,
    (color: AppColorType) => string
> = {
    none: () => {
        return 'none';
    },
    soft: (color) => {
        return `0 0.03em 0.06em ${color}`;
    },
    glow: (color) => {
        return `0 0 0.12em ${color}, 0 0 0.25em ${color}`;
    },
    outline: (color) => {
        return (
            `-0.03em -0.03em 0 ${color}, 0.03em -0.03em 0 ${color},` +
            ` -0.03em 0.03em 0 ${color}, 0.03em 0.03em 0 ${color}`
        );
    },
};

export function genForegroundBoxShadow(decoration: ForegroundDecorationType) {
    return SHADOW_MAP[decoration.shadow](decoration.shadowColor);
}

export function genForegroundTextShadow(decoration: ForegroundDecorationType) {
    return TEXT_SHADOW_MAP[decoration.textShadow](decoration.textShadowColor);
}

/**
 * The dressing as CSS.
 *
 * `isText` is what separates a notice from a video: how words are set means
 * nothing to a clip, and emitting `text-align` onto an image widget is a
 * property that can only ever be noise in its inline style.
 *
 * `isBlending` drops the box shadow the way `genForegroundExtraStyle` always
 * has -- a black shadow is a no-op under `screen` and a dark ring under
 * `multiply` -- but ONLY while the shadow is the one nobody chose. A preset
 * picked by hand is an answer, and a control that silently ignores the answer
 * reads as a broken control.
 */
export function genForegroundDecorationStyle(
    decoration: ForegroundDecorationType,
    { isText, isBlending }: { isText: boolean; isBlending: boolean },
): CSSProperties {
    const style: CSSProperties = {};
    const borderWidth = getDecorationBorderWidth(decoration);
    if (borderWidth > 0) {
        style.border =
            `${borderWidth}px ${decoration.borderStyle}` +
            ` ${decoration.borderColor}`;
    }
    if (decoration.padding > 0) {
        style.padding = `${decoration.padding}em`;
    }
    if (borderWidth > 0 || decoration.padding > 0) {
        // The width the geometry rows set is a percentage of the screen, and
        // an operator asking for half the screen means half the screen -- not
        // half plus a frame plus two paddings, which is what the default
        // `content-box` would hand them.
        style.boxSizing = 'border-box';
    }
    const isDefaultShadow =
        decoration.shadow === DEFAULT_FOREGROUND_DECORATION.shadow &&
        decoration.shadowColor === DEFAULT_FOREGROUND_DECORATION.shadowColor;
    if (!(isBlending && isDefaultShadow)) {
        style.boxShadow = genForegroundBoxShadow(decoration);
    }
    if (!isText) {
        return style;
    }
    style.textAlign = decoration.textAlign;
    if (decoration.lineHeight > 0) {
        style.lineHeight = decoration.lineHeight;
    }
    if (decoration.letterSpacing !== 0) {
        style.letterSpacing = `${decoration.letterSpacing}em`;
    }
    if (decoration.textShadow !== 'none') {
        style.textShadow = genForegroundTextShadow(decoration);
    }
    if (decoration.isItalic) {
        style.fontStyle = 'italic';
    }
    if (decoration.isUnderline) {
        style.textDecoration = 'underline';
    }
    if (decoration.isUppercase) {
        style.textTransform = 'uppercase';
    }
    return style;
}
