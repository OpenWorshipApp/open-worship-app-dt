import type { CSSProperties } from 'react';

import {
    HEX_COLOR_BLACK,
    HEX_COLOR_WHITE,
    checkIsColorDark,
} from '../others/color/colorValueHelpers';
import type { AnyObjectType } from '../helper/typeHelpers';
import {
    checkIsBibleTextShadowOn,
    genBibleTextEffectDefault,
    genBibleTextFontFamilyCss,
    genBibleTextShadow,
    type BibleTextEffectType,
    type BibleTextStyleViewType,
} from '../_screen/bibleTextStyleHelpers';

/**
 * What is BEHIND the words. It is what decides everything else here: words on
 * a dark picture are light and edged in dark, words on a light one the
 * reverse, and a look judged against the wrong one tells the operator nothing.
 * Never stored -- it is read off the colour of the words, so a colour changed
 * anywhere (the contrast fix a colour background makes) moves it too.
 */
export type BibleBackdropType = 'dark' | 'light';

export const BIBLE_TEXT_LOOK_ID_LIST = [
    'normal',
    'thin-outline',
    'outline',
    'heavy-outline',
    'soft-shadow',
    'deep-shadow',
    'hard-shadow',
    'lifted',
    'glow',
    'haze',
    'halo',
    'blue-edge',
] as const;
export type BibleTextLookIdType = (typeof BIBLE_TEXT_LOOK_ID_LIST)[number];

const WORD_COLOR_MAP: Record<BibleBackdropType, string> = {
    dark: HEX_COLOR_WHITE,
    light: HEX_COLOR_BLACK,
};
// What an edge is drawn in so it shows against the words it is edging.
const CONTRAST_COLOR_MAP: Record<BibleBackdropType, string> = {
    dark: HEX_COLOR_BLACK,
    light: HEX_COLOR_WHITE,
};
// The navy the first outline presets were tinted with, and its pale twin.
const TINT_COLOR_MAP: Record<BibleBackdropType, string> = {
    dark: '#16235F',
    light: '#A9BAFF',
};

export function toBibleBackdrop(color: string): BibleBackdropType {
    return checkIsColorDark(color) ? 'light' : 'dark';
}

export function genBibleWordColor(backdrop: BibleBackdropType) {
    return WORD_COLOR_MAP[backdrop];
}

/**
 * A look, as the values the panel's own controls show -- so pressing one and
 * then nudging a slider continues from it instead of starting over. Every
 * number sits on a step of its slider.
 */
export function genBibleTextLookEffect(
    lookId: BibleTextLookIdType,
    backdrop: BibleBackdropType,
): BibleTextEffectType {
    const contrast = CONTRAST_COLOR_MAP[backdrop];
    const tint = TINT_COLOR_MAP[backdrop];
    const base: BibleTextEffectType = {
        ...genBibleTextEffectDefault(),
        outlineColor: contrast,
        shadowColor: contrast,
        glowColor: contrast,
    };
    switch (lookId) {
        case 'normal':
            return base;
        case 'thin-outline':
            return { ...base, outlineWidth: 0.02 };
        case 'outline':
            return { ...base, outlineWidth: 0.04 };
        case 'heavy-outline':
            return { ...base, outlineWidth: 0.07 };
        case 'soft-shadow':
            return {
                ...base,
                shadowY: 0.03,
                shadowBlur: 0.1,
                shadowColor: `${contrast}CC`,
            };
        case 'deep-shadow':
            return {
                ...base,
                shadowX: 0.03,
                shadowY: 0.07,
                shadowBlur: 0.22,
                shadowColor: `${contrast}E6`,
            };
        case 'hard-shadow':
            return { ...base, shadowX: 0.045, shadowY: 0.045 };
        case 'lifted':
            return {
                ...base,
                outlineWidth: 0.02,
                shadowX: 0.02,
                shadowY: 0.05,
                shadowBlur: 0.08,
                shadowColor: `${contrast}CC`,
            };
        case 'glow':
            return { ...base, glowSize: 0.2 };
        case 'haze':
            return { ...base, glowSize: 0.5, glowColor: `${contrast}B3` };
        case 'halo':
            return { ...base, outlineWidth: 0.03, glowSize: 0.24 };
        case 'blue-edge':
            return {
                ...base,
                outlineWidth: 0.035,
                outlineColor: tint,
                glowSize: 0.2,
                glowColor: tint,
            };
    }
}

export type BibleTextLookType = {
    id: BibleTextLookIdType;
    effect: BibleTextEffectType;
    textShadow: string;
};

export function genBibleTextLookList(
    backdrop: BibleBackdropType,
): BibleTextLookType[] {
    return BIBLE_TEXT_LOOK_ID_LIST.map((id) => {
        const effect = genBibleTextLookEffect(id, backdrop);
        return { id, effect, textShadow: genBibleTextShadow(effect) };
    });
}

/**
 * The look the screen is wearing, or null for one made by hand. Matched on
 * what is DRAWN: two effects that differ only in the colour of a layer that
 * is switched off are the same look.
 */
export function findBibleTextLookId(
    lookList: readonly BibleTextLookType[],
    textShadow: string,
) {
    return lookList.find((look) => look.textShadow === textShadow)?.id ?? null;
}

/**
 * The effect the sliders work on. A layer that is off has no colour worth
 * keeping, so it takes the one that will SHOW against the words the moment it
 * is turned on -- an outline dragged up from zero on black words used to
 * arrive black on black.
 */
export function toBibleTextPanelEffect(
    effect: BibleTextEffectType | null,
    backdrop: BibleBackdropType,
): BibleTextEffectType {
    const contrast = CONTRAST_COLOR_MAP[backdrop];
    const source = effect ?? genBibleTextEffectDefault();
    return {
        ...source,
        outlineColor: source.outlineWidth > 0 ? source.outlineColor : contrast,
        shadowColor: checkIsBibleTextShadowOn(source)
            ? source.shadowColor
            : contrast,
        glowColor: source.glowSize > 0 ? source.glowColor : contrast,
    };
}

export function genBibleTextEffectPatch(effect: BibleTextEffectType) {
    return { effect, textShadow: genBibleTextShadow(effect) };
}

function swapContrastColor(color: string, backdrop: BibleBackdropType) {
    const previousContrast = WORD_COLOR_MAP[backdrop];
    // Only the plain black or white an edge defaults to follows the words
    // across; a colour somebody chose is theirs. The alpha rides along.
    return color.slice(0, 7).toUpperCase() === previousContrast
        ? `${CONTRAST_COLOR_MAP[backdrop]}${color.slice(7)}`
        : color;
}

/**
 * Flip the words for the other kind of background: their colour, and the
 * edge with them, so a white word edged in black becomes a black word edged
 * in white -- the same look, not a reset. CSS written by hand is left as
 * written; only the colour of the words moves.
 */
export function genBibleBackdropPatch(
    view: BibleTextStyleViewType,
    backdrop: BibleBackdropType,
): AnyObjectType {
    const color = WORD_COLOR_MAP[backdrop];
    if (view.effect === null) {
        return { color };
    }
    const previousBackdrop = toBibleBackdrop(view.color);
    const lookId = findBibleTextLookId(
        genBibleTextLookList(previousBackdrop),
        view.textShadow,
    );
    const effect =
        lookId === null
            ? {
                  ...view.effect,
                  outlineColor: swapContrastColor(
                      view.effect.outlineColor,
                      backdrop,
                  ),
                  shadowColor: swapContrastColor(
                      view.effect.shadowColor,
                      backdrop,
                  ),
                  glowColor: swapContrastColor(view.effect.glowColor, backdrop),
              }
            : genBibleTextLookEffect(lookId, backdrop);
    return { color, ...genBibleTextEffectPatch(effect) };
}

/**
 * Plain words again. The size stays: it is set once for a room and a
 * projector, and a verse jumping to another size mid-service is not what
 * anybody pressing Reset is asking for.
 */
export function genBibleTextResetPatch(
    backdrop: BibleBackdropType,
): AnyObjectType {
    return {
        fontFamily: undefined,
        color: WORD_COLOR_MAP[backdrop],
        textShadow: 'none',
        effect: undefined,
        isBold: undefined,
        isItalic: undefined,
        lineHeight: undefined,
        letterSpacing: undefined,
        textAlign: undefined,
    };
}

/**
 * What every sample of a style shares -- the stage and each tile -- with the
 * `text-shadow` left to the caller, since that is what a tile is FOR.
 */
export function genBibleSampleStyle(
    view: BibleTextStyleViewType,
): CSSProperties {
    return {
        fontFamily:
            view.fontFamily === ''
                ? undefined
                : genBibleTextFontFamilyCss(view.fontFamily),
        color: view.color,
        fontWeight: view.isBold ? 700 : undefined,
        fontStyle: view.isItalic ? 'italic' : undefined,
        letterSpacing:
            view.letterSpacing === 0 ? undefined : `${view.letterSpacing}em`,
    };
}

/**
 * A `text-shadow` drawn at the preview's size instead of the screen's. The
 * panel's own looks are in `em` and need nothing; an older preset or CSS
 * typed by hand is in `px`, which on a 24px sample would be four times as
 * heavy as it is on a 101px verse.
 */
export function toPreviewTextShadow(textShadow: string, fontSize: number) {
    if (fontSize <= 0) {
        return textShadow;
    }
    return textShadow.replace(/(-?\d*\.?\d+)px/gi, (_match, pixels: string) => {
        const em = Number.parseFloat(pixels) / fontSize;
        return `${Number.parseFloat(em.toFixed(4))}em`;
    });
}
