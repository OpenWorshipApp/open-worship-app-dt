/**
 * The pure half of `owa_screen_edit` (`agentScreenControlHelpers.ts`): the
 * words a model writes for a screen's controls, turned into what those
 * controls write -- the Bible text style's patch, a transition's name, a
 * display, a Bible version, a group's colour -- and the screens' state said
 * back in words (2026-11-13, the user: _chatbot is very smart to help user
 * control screen_ -- the size, colour or style of the Bible showing, another
 * version added to it, a transition, the display checked, screens grouped,
 * _everything in screen control_).
 *
 * Measured first through the help window on a scratch profile, Auto on
 * gemma4:cloud (`references/screen-asks.json`, 27 asks): not one of the 23
 * asks to change something was done -- every one was answered with the
 * panel's steps, and nine answers were wrong ("the app does not have a way
 * to group screens", "I cannot take a specific version off", "I will only
 * make changes to screen 1 from now on" with nothing behind it).
 *
 * Every rule here is the panel's own: a size steps by the factor the
 * foreground's `larger` steps by, a look is one of the Bible text panel's
 * twelve tiles (`genBibleTextLookEffect`), a colour from the other side of
 * the scale flips the edge with the words as the panel's colour picker does,
 * and Reset keeps the size as the panel's Reset does. Nothing here touches
 * the app, so it is tested with none behind it.
 */
import {
    DEFAULT_BIBLE_TEXT_FONT_SIZE,
    DEFAULT_BIBLE_TEXT_LINE_HEIGHT,
    MAX_BIBLE_TEXT_FONT_SIZE,
    MAX_BIBLE_TEXT_LETTER_SPACING,
    MAX_BIBLE_TEXT_LINE_HEIGHT,
    MAX_BIBLE_TEXT_OUTLINE_WIDTH,
    MIN_BIBLE_TEXT_LETTER_SPACING,
    MIN_BIBLE_TEXT_LINE_HEIGHT,
    checkIsBibleTextShadowOn,
    toBibleBackdrop,
    type BibleTextAlignType,
    type BibleTextEffectType,
    type BibleTextStyleViewType,
} from '../_screen/bibleTextStyleHelpers';
import {
    BIBLE_TEXT_LOOK_ID_LIST,
    findBibleTextLookId,
    genBibleBackdropPatch,
    genBibleTextEffectPatch,
    genBibleTextLookEffect,
    genBibleTextLookList,
    genBibleTextResetPatch,
    toBibleTextPanelEffect,
    type BibleTextLookIdType,
} from '../screen-setting/bibleTextLookHelpers';
import type { AnyObjectType } from './typeHelpers';
import { toForegroundHexColor } from './agentForegroundLookRules';

export type ScreenRefusalType = { reason: string };

export function checkIsScreenRefusal(
    value: unknown,
): value is ScreenRefusalType {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as ScreenRefusalType).reason === 'string'
    );
}

// --- the Bible text style ---------------------------------------------------

/** What `style` may carry; every field is optional, one call may set many. */
export type ScreenStyleArgsType = {
    size?: unknown;
    color?: unknown;
    bold?: unknown;
    italic?: unknown;
    shadow?: unknown;
    outline?: unknown;
    outlineColor?: unknown;
    glow?: unknown;
    glowColor?: unknown;
    look?: unknown;
    align?: unknown;
    lineHeight?: unknown;
    letterSpacing?: unknown;
    font?: unknown;
    backdrop?: unknown;
    highlight?: unknown;
    reset?: unknown;
};

export const SCREEN_STYLE_KEY_LIST = [
    'size',
    'color',
    'bold',
    'italic',
    'shadow',
    'outline',
    'outlineColor',
    'glow',
    'glowColor',
    'look',
    'align',
    'lineHeight',
    'letterSpacing',
    'font',
    'backdrop',
    'highlight',
    'reset',
] as const;

// The steps the foreground's own `larger` / `smaller` take
// (`toRelativeFactor` in `agentForegroundLookRules.ts`): one ask of either
// is a step a room sees, never a jump.
const LARGER_FACTOR = 1.25;
const SMALLER_FACTOR = 0.8;
// The panel's slider starts at 1px; a verse a congregation reads is not
// drawn under 10.
const MIN_ASKED_FONT_SIZE = 10;
const LINE_HEIGHT_STEP = 0.25;
const LETTER_SPACING_STEP = 0.02;

const LARGER_WORD_SET = new Set([
    'larger',
    'bigger',
    'big',
    'large',
    'up',
    'increase',
    'more',
]);
const SMALLER_WORD_SET = new Set([
    'smaller',
    'small',
    'down',
    'decrease',
    'less',
]);
const DEFAULT_WORD_SET = new Set(['default', 'normal', 'reset', 'original']);
const OFF_WORD_SET = new Set(['off', 'none', 'no', 'false', 'remove']);

function toWord(value: unknown) {
    return typeof value === 'string'
        ? value
              .trim()
              .toLowerCase()
              .replace(/[\s_-]+/g, ' ')
        : '';
}

function toNumber(value: unknown) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (
        typeof value === 'string' &&
        /^\s*-?\d+(?:\.\d+)?\s*(?:px|em)?\s*$/i.test(value)
    ) {
        return Number.parseFloat(value);
    }
    return null;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, places: number) {
    return Number.parseFloat(value.toFixed(places));
}

/** A size in words or pixels, from the size the screens draw now. */
export function toScreenFontSize(
    value: unknown,
    current: number,
): number | ScreenRefusalType {
    const word = toWord(value);
    // "much bigger", "a lot larger": two steps.
    const isMuch = /\b(much|lot|way|very)\b/.test(word);
    const lastWord = word.split(' ').at(-1) ?? '';
    if (LARGER_WORD_SET.has(lastWord)) {
        const factor = isMuch ? LARGER_FACTOR * LARGER_FACTOR : LARGER_FACTOR;
        return clamp(
            Math.round(current * factor),
            MIN_ASKED_FONT_SIZE,
            MAX_BIBLE_TEXT_FONT_SIZE,
        );
    }
    if (SMALLER_WORD_SET.has(lastWord)) {
        const factor = isMuch
            ? SMALLER_FACTOR * SMALLER_FACTOR
            : SMALLER_FACTOR;
        return clamp(
            Math.round(current * factor),
            MIN_ASKED_FONT_SIZE,
            MAX_BIBLE_TEXT_FONT_SIZE,
        );
    }
    if (DEFAULT_WORD_SET.has(word)) {
        return DEFAULT_BIBLE_TEXT_FONT_SIZE;
    }
    const pixels = toNumber(value);
    if (pixels !== null) {
        return clamp(
            Math.round(pixels),
            MIN_ASKED_FONT_SIZE,
            MAX_BIBLE_TEXT_FONT_SIZE,
        );
    }
    return {
        reason:
            '`size` is "larger", "smaller", "default" or a number of ' +
            `pixels from ${MIN_ASKED_FONT_SIZE} to ` +
            `${MAX_BIBLE_TEXT_FONT_SIZE}.`,
    };
}

const ALIGN_WORD_MAP: Record<string, BibleTextAlignType> = {
    left: 'start',
    start: 'start',
    normal: 'start',
    default: 'start',
    center: 'center',
    centre: 'center',
    centered: 'center',
    centred: 'center',
    middle: 'center',
    right: 'end',
    end: 'end',
    justify: 'justify',
    justified: 'justify',
};

const SHADOW_LOOK_MAP: Record<string, BibleTextLookIdType> = {
    soft: 'soft-shadow',
    deep: 'deep-shadow',
    dark: 'deep-shadow',
    strong: 'deep-shadow',
    hard: 'hard-shadow',
    sharp: 'hard-shadow',
    lifted: 'lifted',
};

const OUTLINE_WIDTH_MAP: Record<string, number> = {
    thin: 0.02,
    light: 0.02,
    normal: 0.04,
    medium: 0.04,
    thick: 0.07,
    heavy: 0.07,
    bold: 0.07,
    strong: 0.07,
};

const GLOW_LOOK_MAP: Record<string, BibleTextLookIdType> = {
    glow: 'glow',
    soft: 'glow',
    haze: 'haze',
    hazy: 'haze',
    big: 'haze',
    halo: 'halo',
};

function readBoolean(value: unknown) {
    if (value === true || value === false) {
        return value;
    }
    const word = toWord(value);
    if (['true', 'yes', 'on'].includes(word)) {
        return true;
    }
    if (OFF_WORD_SET.has(word)) {
        return false;
    }
    return null;
}

/** A look by its tile's id, or a few words of one: "heavy outline". */
export function toBibleTextLookId(value: unknown): BibleTextLookIdType | null {
    const word = toWord(value).replace(/ /g, '-');
    if ((BIBLE_TEXT_LOOK_ID_LIST as readonly string[]).includes(word)) {
        return word as BibleTextLookIdType;
    }
    const aliasMap: Record<string, BibleTextLookIdType> = {
        plain: 'normal',
        none: 'normal',
        default: 'normal',
        'thick-outline': 'heavy-outline',
        shadow: 'soft-shadow',
        'drop-shadow': 'soft-shadow',
        'blue-outline': 'blue-edge',
        'blue-glow': 'blue-edge',
    };
    return aliasMap[word] ?? null;
}

type ColorResolverType = (value: string) => string | null;

function resolveColor(value: unknown, resolve?: ColorResolverType) {
    return toForegroundHexColor(value, resolve);
}

/**
 * The patch `ScreenLongTextManager.applyTextStyle` takes for `args`, from
 * the style the screens draw now, and what was done in a few English words
 * for the model to say -- or why it cannot be done. Several fields in one
 * call make one patch: "bold with a shadow" is one change and one undo.
 */
export function genScreenStylePatch(
    view: BibleTextStyleViewType,
    args: ScreenStyleArgsType,
    resolve?: ColorResolverType,
): { patch: AnyObjectType; said: string[] } | ScreenRefusalType {
    const patch: AnyObjectType = {};
    const said: string[] = [];
    let backdrop = toBibleBackdrop(view.color);
    if (args.reset !== undefined) {
        if (readBoolean(args.reset) !== true) {
            return { reason: '`reset` is true or left out.' };
        }
        Object.assign(patch, genBibleTextResetPatch(backdrop));
        said.push(
            `the style is plain again, the size kept at ${view.fontSize}px ` +
                '(the panel\'s Reset keeps it; `size: "default"` puts ' +
                `it back to ${DEFAULT_BIBLE_TEXT_FONT_SIZE}px)`,
        );
    }
    if (args.backdrop !== undefined) {
        const word = toWord(args.backdrop);
        if (word !== 'dark' && word !== 'light') {
            return {
                reason:
                    '`backdrop` is "dark" (light words for a dark ' +
                    'background) or "light" (dark words).',
            };
        }
        Object.assign(patch, genBibleBackdropPatch(view, word));
        backdrop = word;
        said.push(
            `words for a ${word} background (${
                word === 'dark' ? 'white' : 'black'
            } words)`,
        );
    }
    if (args.color !== undefined) {
        const color = resolveColor(args.color, resolve);
        if (color === null) {
            return {
                reason:
                    `"${String(args.color)}" is not a colour the app ` +
                    'knows. Use a colour word (yellow, light blue) or a ' +
                    'hex value (#ffd700).',
            };
        }
        // A colour from the other side of the scale is the other kind of
        // background: the edge crosses over with the words it is edging,
        // the panel's own colour picker's rule (`handleTextColorChange`).
        const newBackdrop = toBibleBackdrop(color);
        if (newBackdrop !== backdrop && args.backdrop === undefined) {
            Object.assign(patch, genBibleBackdropPatch(view, newBackdrop));
            backdrop = newBackdrop;
        }
        patch.color = color;
        said.push(`the words ${color}`);
    }
    if (args.size !== undefined) {
        const fontSize = toScreenFontSize(args.size, view.fontSize);
        if (checkIsScreenRefusal(fontSize)) {
            return fontSize;
        }
        patch.fontSize = fontSize;
        said.push(`size ${view.fontSize}px -> ${fontSize}px`);
    }
    for (const [key, styleKey, onWord] of [
        ['bold', 'isBold', 'bold'],
        ['italic', 'isItalic', 'italic'],
    ] as const) {
        if (args[key] === undefined) {
            continue;
        }
        const isOn = readBoolean(args[key]);
        if (isOn === null) {
            return { reason: `\`${key}\` is true or false.` };
        }
        patch[styleKey] = isOn || undefined;
        said.push(isOn ? onWord : `not ${onWord}`);
    }
    if (args.align !== undefined) {
        const textAlign = ALIGN_WORD_MAP[toWord(args.align)];
        if (textAlign === undefined) {
            return {
                reason: '`align` is "left", "center", "right" or "justify".',
            };
        }
        patch.textAlign = textAlign === 'start' ? undefined : textAlign;
        said.push(
            textAlign === 'start'
                ? 'lined up at the start of each line again'
                : textAlign === 'end'
                  ? 'lined up on the right'
                  : textAlign === 'center'
                    ? 'centred'
                    : 'justified',
        );
    }
    if (args.lineHeight !== undefined) {
        const lineHeight = toStepped(
            args.lineHeight,
            view.lineHeight,
            LINE_HEIGHT_STEP,
            MIN_BIBLE_TEXT_LINE_HEIGHT,
            MAX_BIBLE_TEXT_LINE_HEIGHT,
            DEFAULT_BIBLE_TEXT_LINE_HEIGHT,
        );
        if (lineHeight === null) {
            return {
                reason:
                    '`lineHeight` is "tighter", "looser", "default" or a ' +
                    `number from ${MIN_BIBLE_TEXT_LINE_HEIGHT} to ` +
                    `${MAX_BIBLE_TEXT_LINE_HEIGHT} (1.5 is the default).`,
            };
        }
        patch.lineHeight =
            lineHeight === DEFAULT_BIBLE_TEXT_LINE_HEIGHT
                ? undefined
                : lineHeight;
        said.push(`line height ${view.lineHeight} -> ${lineHeight}`);
    }
    if (args.letterSpacing !== undefined) {
        const letterSpacing = toStepped(
            args.letterSpacing,
            view.letterSpacing,
            LETTER_SPACING_STEP,
            MIN_BIBLE_TEXT_LETTER_SPACING,
            MAX_BIBLE_TEXT_LETTER_SPACING,
            0,
        );
        if (letterSpacing === null) {
            return {
                reason:
                    '`letterSpacing` is "tighter", "wider", "default" or ' +
                    `a number of em from ${MIN_BIBLE_TEXT_LETTER_SPACING} ` +
                    `to ${MAX_BIBLE_TEXT_LETTER_SPACING}.`,
            };
        }
        patch.letterSpacing = letterSpacing || undefined;
        said.push(`letter spacing ${letterSpacing}em`);
    }
    if (args.font !== undefined) {
        if (typeof args.font !== 'string') {
            return { reason: '`font` is a font family name, or "" for none.' };
        }
        const font = args.font.trim();
        const isDefault = font === '' || DEFAULT_WORD_SET.has(toWord(font));
        patch.fontFamily = isDefault ? undefined : font;
        said.push(
            isDefault
                ? "each Bible in its own language's font again"
                : `the font "${font}"`,
        );
    }
    if (args.highlight !== undefined) {
        const color = resolveColor(args.highlight, resolve);
        if (color === null) {
            return {
                reason:
                    `"${String(args.highlight)}" is not a colour the app ` +
                    'knows for the highlight.',
            };
        }
        // The band for the side the words are on, faint as the panel's own.
        const banded = color.length === 7 ? `${color}33` : color;
        patch[
            backdrop === 'light' ? 'highlightColorLight' : 'highlightColorDark'
        ] = banded;
        said.push(`the selected verse marked in ${color}`);
    }
    const effectPlan = genScreenEffectPatch(view, args, backdrop, resolve);
    if (checkIsScreenRefusal(effectPlan)) {
        return effectPlan;
    }
    if (effectPlan !== null) {
        Object.assign(patch, effectPlan.patch);
        said.push(...effectPlan.said);
    }
    if (Object.keys(patch).length === 0) {
        return {
            reason:
                '`style` changed nothing: give at least one of ' +
                `${SCREEN_STYLE_KEY_LIST.join(', ')}.`,
        };
    }
    return { patch, said };
}

function toStepped(
    value: unknown,
    current: number,
    step: number,
    min: number,
    max: number,
    fallback: number,
) {
    const word = toWord(value);
    const lastWord = word.split(' ').at(-1) ?? '';
    if (
        ['tighter', 'closer', 'smaller', 'less', 'narrower', 'down'].includes(
            lastWord,
        )
    ) {
        return roundTo(clamp(current - step, min, max), 3);
    }
    if (
        [
            'looser',
            'wider',
            'larger',
            'more',
            'further',
            'apart',
            'up',
        ].includes(lastWord)
    ) {
        return roundTo(clamp(current + step, min, max), 3);
    }
    if (DEFAULT_WORD_SET.has(word)) {
        return fallback;
    }
    const number = toNumber(value);
    return number === null ? null : roundTo(clamp(number, min, max), 3);
}

/**
 * The outline, the shadow and the glow, from the effect the panel's sliders
 * show now: a shadow added keeps the outline there, a look replaces all
 * three (a tile is a whole look).
 */
function genScreenEffectPatch(
    view: BibleTextStyleViewType,
    args: ScreenStyleArgsType,
    backdrop: 'dark' | 'light',
    resolve?: ColorResolverType,
): { patch: AnyObjectType; said: string[] } | ScreenRefusalType | null {
    const isAsked =
        args.look !== undefined ||
        args.shadow !== undefined ||
        args.outline !== undefined ||
        args.outlineColor !== undefined ||
        args.glow !== undefined ||
        args.glowColor !== undefined;
    if (!isAsked) {
        return null;
    }
    const said: string[] = [];
    let effect: BibleTextEffectType =
        args.reset === undefined
            ? toBibleTextPanelEffect(view.effect, backdrop)
            : genBibleTextLookEffect('normal', backdrop);
    if (args.look !== undefined) {
        const lookId = toBibleTextLookId(args.look);
        if (lookId === null) {
            return {
                reason:
                    `"${String(args.look)}" is not one of the panel's looks: ` +
                    `${BIBLE_TEXT_LOOK_ID_LIST.join(', ')}.`,
            };
        }
        effect = genBibleTextLookEffect(lookId, backdrop);
        said.push(`the "${lookId}" look`);
    }
    if (args.shadow !== undefined) {
        const isOn = readBoolean(args.shadow);
        const lookId =
            isOn === true
                ? 'soft-shadow'
                : (SHADOW_LOOK_MAP[toWord(args.shadow).split(' ')[0] ?? ''] ??
                  null);
        if (isOn === false) {
            effect = {
                ...effect,
                shadowX: 0,
                shadowY: 0,
                shadowBlur: 0,
            };
            said.push('no shadow');
        } else if (lookId !== null) {
            const look = genBibleTextLookEffect(lookId, backdrop);
            effect = {
                ...effect,
                shadowX: look.shadowX,
                shadowY: look.shadowY,
                shadowBlur: look.shadowBlur,
                shadowColor: look.shadowColor,
            };
            said.push(`a ${lookId.replace('-', ' ')}`);
        } else {
            return {
                reason: '`shadow` is true, false, "soft", "deep" or "hard".',
            };
        }
    }
    if (args.outline !== undefined) {
        const isOn = readBoolean(args.outline);
        const width =
            isOn === true
                ? OUTLINE_WIDTH_MAP.normal
                : isOn === false
                  ? 0
                  : (OUTLINE_WIDTH_MAP[toWord(args.outline)] ??
                    toOutlineEm(args.outline));
        if (width === null) {
            return {
                reason:
                    '`outline` is true, false, "thin", "normal", "thick" ' +
                    `or a width in em up to ${MAX_BIBLE_TEXT_OUTLINE_WIDTH}.`,
            };
        }
        effect = { ...effect, outlineWidth: width };
        said.push(width === 0 ? 'no outline' : `an outline ${width}em wide`);
    }
    if (args.outlineColor !== undefined) {
        const color = resolveColor(args.outlineColor, resolve);
        if (color === null) {
            return {
                reason: `"${String(args.outlineColor)}" is not a colour the app knows.`,
            };
        }
        effect = {
            ...effect,
            outlineColor: color,
            // A colour for an outline that is not there asks for one.
            outlineWidth:
                effect.outlineWidth > 0
                    ? effect.outlineWidth
                    : OUTLINE_WIDTH_MAP.normal,
        };
        said.push(`the outline ${color}`);
    }
    if (args.glow !== undefined) {
        const isOn = readBoolean(args.glow);
        const lookId =
            isOn === true ? 'glow' : (GLOW_LOOK_MAP[toWord(args.glow)] ?? null);
        if (isOn === false) {
            effect = { ...effect, glowSize: 0 };
            said.push('no glow');
        } else if (lookId !== null) {
            const look = genBibleTextLookEffect(lookId, backdrop);
            effect = {
                ...effect,
                glowSize: look.glowSize,
                glowColor: look.glowColor,
            };
            said.push(`a ${lookId === 'glow' ? 'glow' : lookId}`);
        } else {
            return { reason: '`glow` is true, false, "haze" or "halo".' };
        }
    }
    if (args.glowColor !== undefined) {
        const color = resolveColor(args.glowColor, resolve);
        if (color === null) {
            return {
                reason: `"${String(args.glowColor)}" is not a colour the app knows.`,
            };
        }
        effect = {
            ...effect,
            glowColor: color,
            glowSize: effect.glowSize > 0 ? effect.glowSize : 0.2,
        };
        said.push(`the glow ${color}`);
    }
    return { patch: genBibleTextEffectPatch(effect), said };
}

function toOutlineEm(value: unknown) {
    const number = toNumber(value);
    if (number === null || number < 0) {
        return null;
    }
    // Pixels written for em: 4 is a 4px outline at the screen's size, which
    // the panel draws in em so it keeps its weight when the size changes.
    const em = number > MAX_BIBLE_TEXT_OUTLINE_WIDTH ? number / 65 : number;
    return roundTo(clamp(em, 0, MAX_BIBLE_TEXT_OUTLINE_WIDTH), 3);
}

/** The style in words, for a read: what a person would say about it. */
export function describeScreenStyle(view: BibleTextStyleViewType) {
    const parts = [`${view.fontSize}px`, `words ${view.color}`];
    if (view.fontFamily !== '') {
        parts.push(`font "${view.fontFamily}"`);
    }
    if (view.isBold) {
        parts.push('bold');
    }
    if (view.isItalic) {
        parts.push('italic');
    }
    if (view.textAlign !== 'start') {
        parts.push(
            view.textAlign === 'center'
                ? 'centred'
                : view.textAlign === 'end'
                  ? 'right'
                  : 'justified',
        );
    }
    if (view.lineHeight !== DEFAULT_BIBLE_TEXT_LINE_HEIGHT) {
        parts.push(`line height ${view.lineHeight}`);
    }
    if (view.letterSpacing !== 0) {
        parts.push(`letter spacing ${view.letterSpacing}em`);
    }
    const backdrop = toBibleBackdrop(view.color);
    const lookId = findBibleTextLookId(
        genBibleTextLookList(backdrop),
        view.textShadow,
    );
    if (view.effect === null) {
        parts.push('a text shadow written by hand');
    } else if (lookId !== null && lookId !== 'normal') {
        parts.push(`the "${lookId}" look`);
    } else if (lookId === null) {
        const effect = view.effect;
        if (effect.outlineWidth > 0) {
            parts.push(
                `outline ${effect.outlineWidth}em ${effect.outlineColor}`,
            );
        }
        if (checkIsBibleTextShadowOn(effect)) {
            parts.push(`shadow ${effect.shadowColor}`);
        }
        if (effect.glowSize > 0) {
            parts.push(`glow ${effect.glowColor}`);
        }
    }
    return parts.join(', ');
}

// --- transitions -------------------------------------------------------------

export const SCREEN_TRANSITION_LIST = ['none', 'fade', 'move', 'zoom'] as const;
export type ScreenTransitionType = (typeof SCREEN_TRANSITION_LIST)[number];

/**
 * Each layer's transition, by the word the card's **Tr:** row and a person
 * use; the value is the effect manager's `target`.
 */
export const SCREEN_TRANSITION_TARGET_MAP = {
    slide: 'vary-app-document',
    background: 'background',
    foreground: 'foreground',
} as const;
export type ScreenTransitionLayerType =
    keyof typeof SCREEN_TRANSITION_TARGET_MAP;

const TRANSITION_WORD_MAP: Record<string, ScreenTransitionType> = {
    none: 'none',
    off: 'none',
    no: 'none',
    cut: 'none',
    false: 'none',
    instant: 'none',
    fade: 'fade',
    dissolve: 'fade',
    crossfade: 'fade',
    'cross fade': 'fade',
    move: 'move',
    slide: 'move',
    push: 'move',
    zoom: 'zoom',
    scale: 'zoom',
};

export function toScreenTransition(
    value: unknown,
): ScreenTransitionType | null {
    return TRANSITION_WORD_MAP[toWord(value)] ?? null;
}

// --- displays ----------------------------------------------------------------

export type ScreenDisplayInfoType = {
    id: number;
    name: string;
    isVirtual: boolean;
    isPrimary: boolean;
    width: number;
    height: number;
};

function toSearchName(text: string) {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

/**
 * A display by its id or by its name as the card's display picker lists it
 * ("Virtual Display 1", "DELL U2415", "primary") -- the whole name first,
 * then one name that holds every word asked.
 */
export function findScreenDisplay(
    displays: ScreenDisplayInfoType[],
    wanted: unknown,
): ScreenDisplayInfoType | ScreenRefusalType {
    const listed = displays
        .map((display) => {
            return `"${display.name}" (id ${display.id}${
                display.isVirtual ? ', virtual' : ''
            })`;
        })
        .join(', ');
    const asNumber = toNumber(wanted);
    if (asNumber !== null) {
        const byId = displays.find((display) => {
            return display.id === asNumber;
        });
        if (byId !== undefined) {
            return byId;
        }
    }
    const name = toSearchName(String(wanted ?? ''));
    if (name === '') {
        return { reason: `Name a display: ${listed}.` };
    }
    if (['primary', 'main', 'this computer', 'laptop'].includes(name)) {
        const primary = displays.find((display) => {
            return display.isPrimary;
        });
        if (primary !== undefined) {
            return primary;
        }
    }
    const exact = displays.find((display) => {
        return toSearchName(display.name) === name;
    });
    if (exact !== undefined) {
        return exact;
    }
    const wordList = name.split(' ');
    const matchList = displays.filter((display) => {
        const displayName = toSearchName(display.name);
        return wordList.every((word) => {
            return displayName.split(' ').includes(word);
        });
    });
    if (matchList.length === 1) {
        return matchList[0];
    }
    return {
        reason:
            matchList.length > 1
                ? `"${String(wanted)}" fits more than one display: ${listed}. ` +
                  'Name one exactly.'
                : `No display is called "${String(wanted)}". The displays: ` +
                  `${listed}.`,
    };
}

// --- Bible versions ----------------------------------------------------------

export type ScreenBibleInfoType = {
    key: string;
    title: string;
    locale: string;
    /** The locale's language, its English name, from the runtime. */
    language: string;
};

/**
 * Installed Bibles by what a person calls them: the key ("KJV"), the title
 * or a word of it, or the language -- "the <language> Bible" -- in English, read
 * from the runtime's names for the locale (no language is named in code).
 * A language with more than one Bible installed is asked about.
 */
export function findScreenBibles(
    bibles: ScreenBibleInfoType[],
    wantedList: unknown[],
): ScreenBibleInfoType[] | ScreenRefusalType {
    const listed = bibles
        .map((bible) => {
            return `${bible.key} (${bible.language})`;
        })
        .join(', ');
    const foundList: ScreenBibleInfoType[] = [];
    for (const wanted of wantedList) {
        const raw = String(wanted ?? '').trim();
        const name = toSearchName(
            raw.replace(/\b(the|bible|version|translation)\b/gi, ' '),
        );
        const byKey = bibles.find((bible) => {
            return bible.key.toLowerCase() === raw.toLowerCase();
        });
        if (byKey !== undefined) {
            foundList.push(byKey);
            continue;
        }
        if (name === '') {
            return { reason: `Name a Bible: ${listed}.` };
        }
        const byLanguage = bibles.filter((bible) => {
            return toSearchName(bible.language) === name;
        });
        if (byLanguage.length === 1) {
            foundList.push(byLanguage[0]);
            continue;
        }
        if (byLanguage.length > 1) {
            return {
                reason:
                    `More than one ${byLanguage[0].language} Bible is ` +
                    'installed: ' +
                    byLanguage
                        .map((bible) => {
                            return `${bible.key} ("${bible.title}")`;
                        })
                        .join(', ') +
                    '. Ask which one, by its key.',
            };
        }
        const byTitle = bibles.filter((bible) => {
            const title = toSearchName(bible.title);
            return name.split(' ').every((word) => {
                return title.split(' ').includes(word);
            });
        });
        if (byTitle.length === 1) {
            foundList.push(byTitle[0]);
            continue;
        }
        return {
            reason:
                (byTitle.length > 1
                    ? `"${raw}" fits more than one Bible.`
                    : `No Bible called "${raw}" is installed.`) +
                ` Installed: ${listed}. A Bible is added in Settings, ` +
                'under the Bible tab.',
        };
    }
    return foundList;
}

/**
 * The versions the passage is drawn in after `add` and `remove`, in order:
 * one added goes after those there (the card's Shift+click), one removed
 * goes (the card's Remove), and at least one is left.
 */
export function planScreenBibleKeys(
    currentKeys: string[],
    addKeys: string[],
    removeKeys: string[],
): string[] | ScreenRefusalType {
    const removeSet = new Set(
        removeKeys.map((key) => {
            return key.toLowerCase();
        }),
    );
    const missing = removeKeys.filter((key) => {
        return !currentKeys.some((current) => {
            return current.toLowerCase() === key.toLowerCase();
        });
    });
    if (missing.length > 0) {
        return {
            reason:
                `${missing.join(', ')} is not on the screen; it shows ` +
                `${currentKeys.join(', ')}.`,
        };
    }
    const keptList = currentKeys.filter((key) => {
        return !removeSet.has(key.toLowerCase());
    });
    for (const key of addKeys) {
        if (
            !keptList.some((kept) => {
                return kept.toLowerCase() === key.toLowerCase();
            })
        ) {
            keptList.push(key);
        }
    }
    if (keptList.length === 0) {
        return {
            reason:
                'A passage is drawn in one version at least. To take the ' +
                'passage off the screen, use `clear: "bible"`; to change ' +
                'its version, add the new one and remove the old in one call.',
        };
    }
    return keptList;
}

// --- groups ------------------------------------------------------------------

/**
 * The colour notes a group may take, as the card's colour-note menu lists
 * them first (`color-list.json` `main`), plain enough to name in a sentence.
 * White and black are left for last: a swatch of either reads as "none".
 */
export const SCREEN_GROUP_COLOR_LIST = [
    ['yellow', '#FFFF00'],
    ['lime', '#00FF00'],
    ['aqua', '#00FFFF'],
    ['fuchsia', '#FF00FF'],
    ['red', '#FF0000'],
    ['blue', '#0000FF'],
    ['green', '#008000'],
    ['purple', '#800080'],
    ['teal', '#008080'],
    ['navy', '#000080'],
    ['maroon', '#800000'],
    ['olive', '#808000'],
    ['silver', '#C0C0C0'],
    ['gray', '#808080'],
] as const;

/** A group's colour by its word, a hex value, or the first nobody uses. */
export function pickScreenGroupColor(
    asked: unknown,
    usedColors: (string | null)[],
): { name: string; color: string } | ScreenRefusalType {
    const usedSet = new Set(
        usedColors
            .filter((color): color is string => {
                return typeof color === 'string' && color !== '';
            })
            .map((color) => {
                return color.toLowerCase();
            }),
    );
    if (typeof asked === 'string' && asked.trim() !== '') {
        const word = toWord(asked).replace(/ /g, '');
        const named = SCREEN_GROUP_COLOR_LIST.find(([name]) => {
            return name === word || (word === 'grey' && name === 'gray');
        });
        if (named !== undefined) {
            return { name: named[0], color: named[1] };
        }
        const hex = toForegroundHexColor(asked);
        if (hex !== null) {
            return { name: hex, color: hex.toUpperCase() };
        }
        return {
            reason:
                `"${asked}" is not a group colour. Use one of ` +
                `${SCREEN_GROUP_COLOR_LIST.map(([name]) => name).join(', ')}.`,
        };
    }
    const free =
        SCREEN_GROUP_COLOR_LIST.find(([, color]) => {
            return !usedSet.has(color.toLowerCase());
        }) ?? SCREEN_GROUP_COLOR_LIST[0];
    return { name: free[0], color: free[1] };
}

/** A colour note in words: "yellow", or its hex when it has no name here. */
export function toScreenGroupName(color: string | null) {
    if (color === null || color === '') {
        return null;
    }
    const named = SCREEN_GROUP_COLOR_LIST.find(([, value]) => {
        return value.toLowerCase() === color.toLowerCase();
    });
    return named?.[0] ?? color;
}
