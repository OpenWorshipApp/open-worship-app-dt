import {
    HEX_COLOR_BLACK,
    HEX_COLOR_WHITE,
} from '../others/color/colorValueHelpers';
import { sanitizeCssValue } from '../helper/sanitizeHelpers';
import type { AnyObjectType } from '../helper/typeHelpers';
import { SCREEN_FONT_FAMILY } from './screenFontFamily';

// The on-screen Bible text style: what the one setting object may hold, and
// the CSS it becomes on a screen. Every screen page loads this through
// `ScreenBibleManager`, so it imports nothing a screen does not already have.
//
// The object is kept the shape it always had (`fontSize`, `color`,
// `textShadow`) so a style saved by an earlier release, an imported
// `.owasetting` and a Screen Mirror peer all still read it. What is new sits
// beside those: `effect` is the outline / shadow / glow the panel's own
// controls made, kept so the controls can be opened again on the same values,
// and `textShadow` is always the CSS that effect came out as -- the screen
// reads `textShadow` alone.

export type BibleTextAlignType = 'start' | 'center' | 'end' | 'justify';

/**
 * Every length is in `em`, so a look stays the same look when the font size
 * changes -- a 2px outline is a hairline at 150px and a slab at 40px.
 */
export type BibleTextEffectType = {
    outlineWidth: number;
    outlineColor: string;
    shadowX: number;
    shadowY: number;
    shadowBlur: number;
    shadowColor: string;
    glowSize: number;
    glowColor: string;
};

export type BibleTextStyleViewType = {
    /** '' while each Bible is left in its own language's font. */
    fontFamily: string;
    fontSize: number;
    color: string;
    textShadow: string;
    /** null while `textShadow` is CSS somebody wrote by hand. */
    effect: BibleTextEffectType | null;
    isBold: boolean;
    isItalic: boolean;
    lineHeight: number;
    letterSpacing: number;
    textAlign: BibleTextAlignType;
};

export const DEFAULT_BIBLE_TEXT_FONT_SIZE = 65;
export const MAX_BIBLE_TEXT_FONT_SIZE = 200;
// What `#bible-screen-view td` is set in when nothing says otherwise.
export const DEFAULT_BIBLE_TEXT_LINE_HEIGHT = 1.5;
export const MIN_BIBLE_TEXT_LINE_HEIGHT = 1;
export const MAX_BIBLE_TEXT_LINE_HEIGHT = 3;
export const MIN_BIBLE_TEXT_LETTER_SPACING = -0.05;
export const MAX_BIBLE_TEXT_LETTER_SPACING = 0.3;
export const MAX_BIBLE_TEXT_OUTLINE_WIDTH = 0.1;
export const MAX_BIBLE_TEXT_SHADOW_OFFSET = 0.2;
export const MAX_BIBLE_TEXT_SHADOW_BLUR = 0.5;
export const MAX_BIBLE_TEXT_GLOW_SIZE = 0.6;
// The chosen family, published on every row of the table. A verse of a Bible
// whose language brings a font of its own (Khmer) says that font inline, where
// no rule here could reach it -- so it reads this first and keeps its own
// behind it, for the letters the chosen one does not have.
export const BIBLE_TEXT_FONT_FAMILY_VAR = '--bible-font-family';

const NO_TEXT_SHADOW = 'none';
const HEX_COLOR_PATTERN = /^#(?:[\da-f]{6}|[\da-f]{8})$/i;
const TEXT_ALIGN_LIST: readonly BibleTextAlignType[] = [
    'start',
    'center',
    'end',
    'justify',
];

// The style reaches a screen from a setting file, an imported archive or a
// Screen Mirror peer, and `textShadow` can be typed by hand -- and all of it
// is written into a `<style>`. Whatever could close the declaration or the
// rule comes off first; what is left is at worst a value the browser ignores.
// A comment opener is refused whole: unclosed, it would swallow every
// declaration written after it.
function readCssValue(value: unknown) {
    if (typeof value !== 'string') {
        return '';
    }
    const cssValue = sanitizeCssValue(value).trim();
    return cssValue.includes('/*') ? '' : cssValue;
}

function clampNumber(value: unknown, min: number, max: number, fallback = 0) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, value));
}

function toEffectColor(value: unknown) {
    return typeof value === 'string' && HEX_COLOR_PATTERN.test(value)
        ? value
        : HEX_COLOR_BLACK;
}

export function genBibleTextEffectDefault(): BibleTextEffectType {
    return {
        outlineWidth: 0,
        outlineColor: HEX_COLOR_BLACK,
        shadowX: 0,
        shadowY: 0,
        shadowBlur: 0,
        shadowColor: HEX_COLOR_BLACK,
        glowSize: 0,
        glowColor: HEX_COLOR_BLACK,
    };
}

/** An effect read back out of a setting: every field in range, or null. */
export function toBibleTextEffect(value: unknown): BibleTextEffectType | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    const effect = value as AnyObjectType;
    return {
        outlineWidth: clampNumber(
            effect.outlineWidth,
            0,
            MAX_BIBLE_TEXT_OUTLINE_WIDTH,
        ),
        outlineColor: toEffectColor(effect.outlineColor),
        shadowX: clampNumber(
            effect.shadowX,
            -MAX_BIBLE_TEXT_SHADOW_OFFSET,
            MAX_BIBLE_TEXT_SHADOW_OFFSET,
        ),
        shadowY: clampNumber(
            effect.shadowY,
            -MAX_BIBLE_TEXT_SHADOW_OFFSET,
            MAX_BIBLE_TEXT_SHADOW_OFFSET,
        ),
        shadowBlur: clampNumber(
            effect.shadowBlur,
            0,
            MAX_BIBLE_TEXT_SHADOW_BLUR,
        ),
        shadowColor: toEffectColor(effect.shadowColor),
        glowSize: clampNumber(effect.glowSize, 0, MAX_BIBLE_TEXT_GLOW_SIZE),
        glowColor: toEffectColor(effect.glowColor),
    };
}

function toEm(value: number) {
    // Four places is a tenth of a pixel at the largest font size; `-0` and a
    // cosine's 6e-17 both come out as a plain `0`.
    const rounded = Number.parseFloat(value.toFixed(4));
    return rounded === 0 ? '0' : `${rounded}em`;
}

// An outline is the glyph drawn again around a ring. Each copy is a paint, so
// a thin ring takes the fewest that still close: the gap between two
// neighbours has to stay under the thinnest stroke of a letter.
function genOutlineCopyCount(outlineWidth: number) {
    if (outlineWidth <= 0.03) {
        return 8;
    }
    return outlineWidth <= 0.055 ? 12 : 16;
}

export function checkIsBibleTextShadowOn(effect: BibleTextEffectType) {
    return (
        effect.shadowX !== 0 || effect.shadowY !== 0 || effect.shadowBlur > 0
    );
}

/** The CSS `text-shadow` an effect is drawn with; `none` when it does nothing. */
export function genBibleTextShadow(effect: BibleTextEffectType) {
    const layers: string[] = [];
    if (effect.outlineWidth > 0) {
        const count = genOutlineCopyCount(effect.outlineWidth);
        for (let i = 0; i < count; i++) {
            const angle = (2 * Math.PI * i) / count;
            layers.push(
                `${toEm(Math.cos(angle) * effect.outlineWidth)} ` +
                    `${toEm(Math.sin(angle) * effect.outlineWidth)} 0 ` +
                    effect.outlineColor,
            );
        }
    }
    if (checkIsBibleTextShadowOn(effect)) {
        layers.push(
            `${toEm(effect.shadowX)} ${toEm(effect.shadowY)} ` +
                `${toEm(effect.shadowBlur)} ${effect.shadowColor}`,
        );
    }
    if (effect.glowSize > 0) {
        // A tight one for density and a wide one for the fall-off: a single
        // blur this wide is too thin to hold a letter's edge over a picture.
        layers.push(
            `0 0 ${toEm(effect.glowSize / 2)} ${effect.glowColor}`,
            `0 0 ${toEm(effect.glowSize)} ${effect.glowColor}`,
        );
    }
    return layers.length === 0 ? NO_TEXT_SHADOW : layers.join(', ');
}

export function readBibleTextFontSize(textStyle: AnyObjectType) {
    return typeof textStyle.fontSize === 'number' &&
        Number.isFinite(textStyle.fontSize)
        ? textStyle.fontSize
        : DEFAULT_BIBLE_TEXT_FONT_SIZE;
}

/**
 * A family's name, to be written between double quotes. `readCssValue` has
 * taken the quotes and the backslash out of it; a line break is the one thing
 * left that would end a CSS string early.
 */
export function readBibleTextFontFamily(textStyle: AnyObjectType) {
    return readCssValue(textStyle.fontFamily).replaceAll(/\s+/g, ' ');
}

/**
 * The chosen family as a `font-family` value, the screen's own stack behind
 * it: a style can arrive on a machine that does not have the font, and a
 * family alone would fall through to the browser's serif there.
 */
export function genBibleTextFontFamilyCss(fontFamily: string) {
    return `"${fontFamily}", ${SCREEN_FONT_FAMILY}`;
}

export function readBibleTextColor(textStyle: AnyObjectType) {
    return readCssValue(textStyle.color) || HEX_COLOR_WHITE;
}

export function readBibleTextShadow(textStyle: AnyObjectType) {
    return readCssValue(textStyle.textShadow) || NO_TEXT_SHADOW;
}

/**
 * The effect the panel's controls should open on.
 *
 * Only while it still IS what the screen draws. An earlier release, or CSS
 * typed by hand, changes `textShadow` and knows nothing of `effect`; trusting
 * a stale one would show sliders describing a look that is not on the screen.
 */
function readBibleTextEffect(textStyle: AnyObjectType, textShadow: string) {
    const effect = toBibleTextEffect(textStyle.effect);
    if (effect !== null && genBibleTextShadow(effect) === textShadow) {
        return effect;
    }
    return textShadow === NO_TEXT_SHADOW ? genBibleTextEffectDefault() : null;
}

export function toBibleTextStyleView(
    textStyle: AnyObjectType,
): BibleTextStyleViewType {
    const textShadow = readBibleTextShadow(textStyle);
    return {
        fontFamily: readBibleTextFontFamily(textStyle),
        fontSize: readBibleTextFontSize(textStyle),
        color: readBibleTextColor(textStyle),
        textShadow,
        effect: readBibleTextEffect(textStyle, textShadow),
        isBold: textStyle.isBold === true,
        isItalic: textStyle.isItalic === true,
        lineHeight: clampNumber(
            textStyle.lineHeight,
            MIN_BIBLE_TEXT_LINE_HEIGHT,
            MAX_BIBLE_TEXT_LINE_HEIGHT,
            DEFAULT_BIBLE_TEXT_LINE_HEIGHT,
        ),
        letterSpacing: clampNumber(
            textStyle.letterSpacing,
            MIN_BIBLE_TEXT_LETTER_SPACING,
            MAX_BIBLE_TEXT_LETTER_SPACING,
        ),
        textAlign: TEXT_ALIGN_LIST.includes(textStyle.textAlign)
            ? textStyle.textAlign
            : 'start',
    };
}

/**
 * A view as the setting object that draws it, EVERY key named: the ones at
 * their default are `undefined`, so applying it over another style clears
 * what that one had set instead of leaving it behind. It is what a saved
 * preset holds, and what putting one back writes.
 */
export function genBibleTextStylePatch(
    view: BibleTextStyleViewType,
): AnyObjectType {
    return {
        fontFamily: view.fontFamily || undefined,
        fontSize: view.fontSize,
        color: view.color,
        textShadow: view.textShadow,
        effect: view.effect ?? undefined,
        isBold: view.isBold || undefined,
        isItalic: view.isItalic || undefined,
        lineHeight:
            view.lineHeight === DEFAULT_BIBLE_TEXT_LINE_HEIGHT
                ? undefined
                : view.lineHeight,
        letterSpacing: view.letterSpacing || undefined,
        textAlign: view.textAlign === 'start' ? undefined : view.textAlign,
    };
}

/**
 * The declarations of `#bible-screen-view tr`.
 *
 * The cell's own two (`line-height`, `text-align`) ride inside it as a nested
 * rule and only when they are set: unset, the screen sheet's `1.5em` and each
 * column's own reading direction stand exactly as before. `text-align` is
 * `!important` because a right-to-left column sets its side inline.
 *
 * A chosen family is written twice, for two readers: the declaration for
 * whatever inherits the row's font, the variable for a verse that names its
 * language's font inline (`BIBLE_TEXT_FONT_FAMILY_VAR`).
 *
 * Two styles that come out as the same text here are the same look on a
 * screen, which is how the panel tells which saved preset is the one on.
 */
export function genBibleTextViewCss(view: BibleTextStyleViewType) {
    const declarations = [
        `font-size: ${view.fontSize}px;`,
        `color: ${view.color};`,
        `text-shadow: ${view.textShadow};`,
    ];
    if (view.fontFamily !== '') {
        declarations.push(
            `${BIBLE_TEXT_FONT_FAMILY_VAR}: "${view.fontFamily}";`,
            `font-family: ${genBibleTextFontFamilyCss(view.fontFamily)};`,
        );
    }
    if (view.isBold) {
        declarations.push('font-weight: 700;');
    }
    if (view.isItalic) {
        declarations.push('font-style: italic;');
    }
    if (view.letterSpacing !== 0) {
        declarations.push(`letter-spacing: ${toEm(view.letterSpacing)};`);
    }
    const cellDeclarations: string[] = [];
    if (view.lineHeight !== DEFAULT_BIBLE_TEXT_LINE_HEIGHT) {
        cellDeclarations.push(`line-height: ${toEm(view.lineHeight)};`);
    }
    if (view.textAlign !== 'start') {
        cellDeclarations.push(`text-align: ${view.textAlign} !important;`);
    }
    if (cellDeclarations.length > 0) {
        declarations.push(`& td { ${cellDeclarations.join(' ')} }`);
    }
    return declarations.join('\n');
}

export function genBibleTextStyleCss(textStyle: AnyObjectType) {
    return genBibleTextViewCss(toBibleTextStyleView(textStyle));
}
