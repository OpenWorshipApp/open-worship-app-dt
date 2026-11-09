/**
 * How a foreground component LOOKS, as words the help window's assistant can
 * say -- `{size: "larger", color: "gold", position: "bottom"}` -- turned into
 * exactly the settings the Properties panel writes when a person sets the
 * same thing (2026-11-09, the user: _chatbot can help modify any foreground
 * component_).
 *
 * Nothing here reads or writes a setting. The caller hands in `read` for the
 * values a change is relative to (a size made larger, the Effects JSON a
 * border is merged into) and gets back the writes, each a key and a value --
 * or `null` for a key to take off, which is how the panel says "back to the
 * default" (a transition unticked, the layer put back on top). Every rule is
 * the panel's own rule, so a look the assistant sets is one the panel shows.
 *
 * A field the component does not have -- a place on the screen for a marquee,
 * a blend mode for a quick text -- is refused in a sentence that names what
 * it does take, never quietly dropped: an answer that said "moved it to the
 * top" over nothing moving is the failure this whole door exists to end.
 */
import type { ForegroundPropsFlagsType } from '../presenter-foreground/foregroundComponentRules';
import {
    genCommonStyleSettingNames,
    genDecorationSettingName,
    genPropsSettingNames,
} from '../presenter-foreground/foregroundStyleSettingNames';

export type ForegroundSettingWriteType = {
    key: string;
    /** `null` takes the key off: the panel's default stands again. */
    value: string | null;
};

export type ForegroundLookPlanType =
    | { writes: ForegroundSettingWriteType[]; said: string[] }
    | { reason: string };

export type ForegroundLookContextType = {
    /** `countdown`, `marquee-top` -- for the refusals and the marquee keys. */
    widget: string;
    /** The Properties prefix being changed (`quick-text-s5k1`, `time-<id>`). */
    prefix: string;
    /** The session's suffix, for a marquee's own size and speed keys. */
    suffix: string;
    flags: ForegroundPropsFlagsType;
    read: (key: string) => string | null;
    /**
     * A colour word or CSS colour as `#rrggbb` / `#rrggbbaa`, or null. The
     * renderer resolves every CSS name; the built-in table below is the
     * fallback a test or a window without a canvas still has.
     */
    toHexColor?: (value: string) => string | null;
};

// The panel's own bounds and defaults (`propertiesSettingHelpers.tsx`).
const DEFAULT_FONT_SIZE = 100;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 600;
const DEFAULT_SCALE = 1;
const MIN_SCALE = 0.1;
const MAX_SCALE = 3;
const MAX_BLUR = 50;
const MIN_SPEED = 10;
const MAX_SPEED = 1000;
const LARGER_FACTOR = 1.25;
const SMALLER_FACTOR = 0.8;

const BORDER_STYLE_LIST = ['none', 'solid', 'dashed', 'dotted', 'double'];
const SHADOW_LIST = ['none', 'soft', 'medium', 'strong', 'glow'];
const TEXT_SHADOW_LIST = ['none', 'soft', 'glow', 'outline'];
const TEXT_ALIGN_LIST = ['left', 'center', 'right'];
const TRANSITION_LIST = ['none', 'fade', 'move', 'zoom'];
const BLEND_MODE_LIST = [
    'normal',
    'darken',
    'multiply',
    'color-burn',
    'lighten',
    'screen',
    'color-dodge',
    'plus-lighter',
    'overlay',
    'soft-light',
    'hard-light',
    'difference',
    'exclusion',
    'hue',
    'saturation',
    'color',
    'luminosity',
];

/** The fields a `look` may carry -- also what a refusal lists. */
export const FOREGROUND_LOOK_FIELD_LIST = [
    'size',
    'color',
    'background',
    'blur',
    'font',
    'bold',
    'position',
    'width',
    'scale',
    'opacity',
    'round',
    'border',
    'borderWidth',
    'borderColor',
    'shadow',
    'textAlign',
    'textShadow',
    'italic',
    'underline',
    'uppercase',
    'padding',
    'behind',
    'onTop',
    'blend',
    'transition',
    'speed',
] as const;

const COLOR_NAME_MAP: Record<string, string> = {
    white: '#ffffff',
    black: '#000000',
    red: '#ff0000',
    green: '#008000',
    blue: '#0000ff',
    yellow: '#ffff00',
    orange: '#ffa500',
    purple: '#800080',
    pink: '#ffc0cb',
    gray: '#808080',
    grey: '#808080',
    navy: '#000080',
    gold: '#ffd700',
    silver: '#c0c0c0',
    brown: '#a52a2a',
    cyan: '#00ffff',
    magenta: '#ff00ff',
    teal: '#008080',
    maroon: '#800000',
    lime: '#00ff00',
    darkblue: '#00008b',
    darkred: '#8b0000',
    darkgreen: '#006400',
    lightblue: '#add8e6',
    skyblue: '#87ceeb',
    transparent: '#00000000',
};

/** `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` or a colour word, as `#hex`. */
export function toForegroundHexColor(
    value: unknown,
    toHexColor?: (value: string) => string | null,
): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const text = value.trim().toLowerCase();
    const short = /^#([\da-f])([\da-f])([\da-f])([\da-f])?$/.exec(text);
    if (short !== null) {
        return (
            '#' +
            short
                .slice(1)
                .filter((part) => {
                    return part !== undefined;
                })
                .map((part) => {
                    return part + part;
                })
                .join('')
        );
    }
    if (/^#(?:[\da-f]{6}|[\da-f]{8})$/.test(text)) {
        return text;
    }
    const name = text.replace(/[\s_-]+/g, '');
    if (COLOR_NAME_MAP[name] !== undefined) {
        return COLOR_NAME_MAP[name];
    }
    const resolved = toHexColor?.(text) ?? null;
    return resolved !== null && /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(resolved)
        ? resolved.toLowerCase()
        : null;
}

function readNumber(read: ForegroundLookContextType['read'], key: string) {
    const parsed = Number.parseFloat(read(key) ?? '');
    return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function round2(value: number) {
    return Math.round(value * 100) / 100;
}

/** "larger", "bigger" → ×1.25; "smaller" → ×0.8; else null. */
function toRelativeFactor(value: unknown) {
    if (typeof value !== 'string') {
        return null;
    }
    const text = value.trim().toLowerCase();
    if (/^(?:larger|bigger|increase|up|more)$/.test(text)) {
        return LARGER_FACTOR;
    }
    if (/^(?:smaller|decrease|down|less)$/.test(text)) {
        return SMALLER_FACTOR;
    }
    return null;
}

function toPositiveNumber(value: unknown) {
    const parsed =
        typeof value === 'number'
            ? value
            : typeof value === 'string'
              ? Number.parseFloat(value)
              : Number.NaN;
    return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value: unknown) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        if (/^(?:true|yes|on)$/i.test(value.trim())) {
            return true;
        }
        if (/^(?:false|no|off)$/i.test(value.trim())) {
            return false;
        }
    }
    return null;
}

function checkIsRemoval(value: unknown) {
    return (
        typeof value === 'string' &&
        /^(?:none|default|remove|clear|off|reset)$/i.test(value.trim())
    );
}

/**
 * "top", "bottom left", "top-right", "center", "middle", "left" → the pad's
 * alignment. A side alone keeps the other axis in the middle.
 */
export function toForegroundAlignment(value: unknown) {
    if (typeof value !== 'string') {
        return null;
    }
    const words = value
        .toLowerCase()
        .replace(/[-_,]+/g, ' ')
        .split(/\s+/)
        .filter((word) => {
            return word !== '' && word !== 'of' && word !== 'the';
        });
    if (words.length === 0) {
        return null;
    }
    let horizontalAlignment: 'left' | 'center' | 'right' = 'center';
    let verticalAlignment: 'start' | 'center' | 'end' = 'center';
    for (const word of words) {
        if (word === 'left') {
            horizontalAlignment = 'left';
        } else if (word === 'right') {
            horizontalAlignment = 'right';
        } else if (word === 'top' || word === 'upper') {
            verticalAlignment = 'start';
        } else if (word === 'bottom' || word === 'lower') {
            verticalAlignment = 'end';
        } else if (!['center', 'centre', 'middle', 'screen'].includes(word)) {
            return null;
        }
    }
    return { horizontalAlignment, verticalAlignment };
}

/** The pad's alignment said back in words: `bottom left`, `center`. */
export function toForegroundPlaceWords(alignmentText: string | null) {
    let parsed: any;
    try {
        parsed = JSON.parse(alignmentText ?? '{}') ?? {};
    } catch {
        parsed = {};
    }
    const vertical =
        parsed.verticalAlignment === 'start'
            ? 'top'
            : parsed.verticalAlignment === 'end'
              ? 'bottom'
              : '';
    const horizontal =
        parsed.horizontalAlignment === 'left' ||
        parsed.horizontalAlignment === 'right'
            ? parsed.horizontalAlignment
            : '';
    return [vertical, horizontal].filter(Boolean).join(' ') || 'center';
}

function genFieldRefusal(widget: string, field: string, what: string) {
    return {
        reason:
            `The ${widget} has no ${what}, so "${field}" cannot be set on it. ` +
            'Leave it out.',
    };
}

/** What a component takes, for a refusal naming the rest. */
function genFieldListFor(
    widget: string,
    flags: ForegroundPropsFlagsType,
): string[] {
    const isMarquee = widget === 'marquee-top' || widget === 'marquee-bottom';
    return FOREGROUND_LOOK_FIELD_LIST.filter((field) => {
        if (field === 'speed') {
            return isMarquee;
        }
        if (field === 'size') {
            return flags.isFontSize || isMarquee || flags.isGeometry;
        }
        if (
            [
                'color',
                'background',
                'blur',
                'font',
                'bold',
                'textAlign',
                'textShadow',
                'italic',
                'underline',
                'uppercase',
            ].includes(field)
        ) {
            return flags.isCommonStyle;
        }
        if (['position', 'width', 'scale', 'opacity'].includes(field)) {
            return flags.isGeometry;
        }
        if (field === 'blend') {
            return flags.isBlendMode;
        }
        return true;
    });
}

/**
 * The writes for ONE `look`. All or nothing: the first field that cannot be
 * set refuses the lot, so a change is never half made.
 */
export function planForegroundLook(
    look: unknown,
    context: ForegroundLookContextType,
): ForegroundLookPlanType {
    if (look === null || typeof look !== 'object' || Array.isArray(look)) {
        return {
            reason: 'look must be an object of fields, e.g. {"size": "larger"}.',
        };
    }
    const { widget, prefix, suffix, flags, read } = context;
    const names = genPropsSettingNames(prefix);
    const commonNames = genCommonStyleSettingNames(prefix);
    const isMarquee = widget === 'marquee-top' || widget === 'marquee-bottom';
    const allowedFieldList = genFieldListFor(widget, flags);
    const writes: ForegroundSettingWriteType[] = [];
    const said: string[] = [];
    const decorationPatch: Record<string, unknown> = {};
    const entries = Object.entries(look as Record<string, unknown>).filter(
        ([, value]) => {
            return value !== undefined && value !== null && value !== '';
        },
    );
    if (entries.length === 0) {
        return { reason: 'look has no field to change.' };
    }
    const toHex = (value: unknown) => {
        return toForegroundHexColor(value, context.toHexColor);
    };
    for (const [field, value] of entries) {
        if (
            !(FOREGROUND_LOOK_FIELD_LIST as readonly string[]).includes(field)
        ) {
            return {
                reason:
                    `"${field}" is not a look field. The ${widget} takes: ` +
                    `${allowedFieldList.join(', ')}.`,
            };
        }
        if (!allowedFieldList.includes(field as any)) {
            return {
                reason:
                    `The ${widget} has no "${field}". It takes: ` +
                    `${allowedFieldList.join(', ')}.`,
            };
        }
        switch (field) {
            case 'size': {
                const factor = toRelativeFactor(value);
                if (isMarquee) {
                    const key = `foreground-${widget}-font-size${suffix}`;
                    const current = readNumber(read, key) ?? 0;
                    let next: number | null;
                    if (factor !== null) {
                        if (current <= 0) {
                            return {
                                reason:
                                    'The marquee is on Auto size (it fits its ' +
                                    'band), so there is no size to make ' +
                                    `${factor > 1 ? 'larger' : 'smaller'}. ` +
                                    'Give a size in px instead, e.g. 60.',
                            };
                        }
                        next = Math.round(current * factor);
                    } else {
                        next = checkIsRemoval(value)
                            ? 0
                            : toPositiveNumber(value);
                    }
                    if (next === null || next < 0 || next > MAX_FONT_SIZE) {
                        return {
                            reason:
                                `size "${String(value)}" is not a size: give ` +
                                'px (e.g. 60), "larger", "smaller" or "auto".',
                        };
                    }
                    writes.push({ key, value: `${next}` });
                    said.push(
                        next === 0
                            ? 'size auto'
                            : `size ${current > 0 ? `${current} → ` : ''}${next}px`,
                    );
                    break;
                }
                if (flags.isFontSize) {
                    const current =
                        readNumber(read, names.fontSize) ?? DEFAULT_FONT_SIZE;
                    const next =
                        factor !== null
                            ? Math.round(current * factor)
                            : toPositiveNumber(value);
                    if (
                        next === null ||
                        next < MIN_FONT_SIZE ||
                        next > MAX_FONT_SIZE
                    ) {
                        return {
                            reason:
                                `size "${String(value)}" is not a size: give ` +
                                `px from ${MIN_FONT_SIZE} to ${MAX_FONT_SIZE}, ` +
                                '"larger" or "smaller".',
                        };
                    }
                    writes.push({ key: names.fontSize, value: `${next}` });
                    said.push(`size ${current} → ${next}px`);
                    break;
                }
                // A clock, a picture, a camera: its size IS its scale.
                if (factor === null) {
                    return {
                        reason:
                            `The ${widget} is sized by its scale, not by px: ` +
                            'say "larger" or "smaller", or set scale (0.1-3).',
                    };
                }
                const current = readNumber(read, names.scale) ?? DEFAULT_SCALE;
                const next = round2(
                    clamp(current * factor, MIN_SCALE, MAX_SCALE),
                );
                writes.push({ key: names.scale, value: `${next}` });
                said.push(`scale ${current} → ${next}`);
                break;
            }
            case 'scale': {
                const factor = toRelativeFactor(value);
                const current = readNumber(read, names.scale) ?? DEFAULT_SCALE;
                const next =
                    factor !== null
                        ? current * factor
                        : toPositiveNumber(value);
                if (next === null || next < MIN_SCALE || next > MAX_SCALE) {
                    return {
                        reason: `scale must be from ${MIN_SCALE} to ${MAX_SCALE}.`,
                    };
                }
                writes.push({ key: names.scale, value: `${round2(next)}` });
                said.push(`scale ${round2(next)}`);
                break;
            }
            case 'width': {
                const next = toPositiveNumber(value);
                if (next === null || next < 1 || next > 100) {
                    return {
                        reason: 'width is a percentage of the screen, 1-100.',
                    };
                }
                writes.push({
                    key: names.widthPercentage,
                    value: `${Math.round(next)}`,
                });
                said.push(`width ${Math.round(next)}%`);
                break;
            }
            case 'opacity': {
                const next = toPositiveNumber(value);
                if (next === null || next < 0 || next > 100) {
                    return { reason: 'opacity is a percentage, 0-100.' };
                }
                writes.push({
                    key: names.opacityPercentage,
                    value: `${Math.round(next)}`,
                });
                said.push(`opacity ${Math.round(next)}%`);
                break;
            }
            case 'position': {
                const alignment = toForegroundAlignment(value);
                if (alignment === null) {
                    return {
                        reason:
                            `position "${String(value)}" is not a place: say ` +
                            'top, bottom, left, right, center, or two of them ' +
                            '("bottom left").',
                    };
                }
                writes.push(
                    { key: names.alignment, value: JSON.stringify(alignment) },
                    // The pad's nudges are from the side it was on.
                    { key: names.offsetX, value: null },
                    { key: names.offsetY, value: null },
                );
                said.push(
                    `position ${toForegroundPlaceWords(JSON.stringify(alignment))}`,
                );
                break;
            }
            case 'round': {
                if (checkIsRemoval(value)) {
                    writes.push(
                        { key: names.roundSizePixel, value: '0' },
                        { key: names.roundPercentage, value: '0' },
                    );
                    said.push('square corners');
                    break;
                }
                const next = toPositiveNumber(value);
                if (next === null || next < 0 || next > 500) {
                    return {
                        reason: 'round is the corner size in px, e.g. 12, or "none".',
                    };
                }
                // The panel's px unit: a pixel size of 0 means "use the
                // percentage", so 0 px is said as square corners instead.
                writes.push(
                    { key: names.roundSizePixel, value: `${Math.round(next)}` },
                    ...(next === 0
                        ? [{ key: names.roundPercentage, value: '0' }]
                        : []),
                );
                said.push(
                    next === 0
                        ? 'square corners'
                        : `round ${Math.round(next)}px`,
                );
                break;
            }
            case 'color':
            case 'background': {
                const key =
                    field === 'color'
                        ? commonNames.color
                        : commonNames.backgroundColor;
                if (field === 'background' && checkIsRemoval(value)) {
                    writes.push({ key, value: '#00000000' });
                    said.push('no background');
                    break;
                }
                if (field === 'color' && checkIsRemoval(value)) {
                    writes.push({ key, value: null });
                    said.push('text colour back to the default');
                    break;
                }
                const hex = toHex(value);
                if (hex === null) {
                    return {
                        reason:
                            `${field} "${String(value)}" is not a colour: give ` +
                            'a colour name or #rrggbb.',
                    };
                }
                writes.push({ key, value: hex.toUpperCase() });
                said.push(
                    `${field === 'color' ? 'text colour' : 'background'} ${String(value)}`,
                );
                break;
            }
            case 'blur': {
                const next = checkIsRemoval(value)
                    ? 0
                    : toPositiveNumber(value);
                if (next === null || next < 0 || next > MAX_BLUR) {
                    return {
                        reason: `blur is px behind the words, 0-${MAX_BLUR}.`,
                    };
                }
                writes.push({
                    key: commonNames.backdropFilter,
                    value: `${Math.round(next)}`,
                });
                said.push(`blur ${Math.round(next)}px`);
                break;
            }
            case 'font': {
                if (checkIsRemoval(value)) {
                    writes.push({ key: commonNames.fontFamily, value: null });
                    said.push('font back to the default');
                    break;
                }
                const font = typeof value === 'string' ? value.trim() : '';
                if (font === '' || font.length > 80 || /[;{}<>]/.test(font)) {
                    return { reason: 'font is the name of an installed font.' };
                }
                writes.push({ key: commonNames.fontFamily, value: font });
                said.push(`font ${font}`);
                break;
            }
            case 'bold': {
                const isBold = toBoolean(value);
                if (isBold === null) {
                    return { reason: 'bold is true or false.' };
                }
                writes.push({
                    key: commonNames.fontWeight,
                    value: isBold ? '700' : null,
                });
                said.push(isBold ? 'bold' : 'not bold');
                break;
            }
            case 'behind': {
                const isBehind = toBoolean(value);
                if (isBehind === null) {
                    return {
                        reason: 'behind is true (behind the slide) or false.',
                    };
                }
                writes.push({
                    key: names.isBehind,
                    value: isBehind ? 'true' : null,
                });
                said.push(
                    isBehind ? 'behind the slide' : 'in front of the slide',
                );
                break;
            }
            case 'onTop': {
                const isOnTop = toBoolean(value);
                if (isOnTop === null) {
                    return {
                        reason: 'onTop is true (always on top) or false.',
                    };
                }
                writes.push({
                    key: names.isAlwaysOnTop,
                    value: isOnTop ? 'true' : 'false',
                });
                said.push(isOnTop ? 'always on top' : 'not always on top');
                break;
            }
            case 'blend': {
                const mode =
                    typeof value === 'string'
                        ? value.trim().toLowerCase().replace(/\s+/g, '-')
                        : '';
                if (!BLEND_MODE_LIST.includes(mode)) {
                    return {
                        reason:
                            `blend "${String(value)}" is not a blend mode: ` +
                            `${BLEND_MODE_LIST.join(', ')}.`,
                    };
                }
                writes.push({
                    key: names.blendMode,
                    value: mode === 'normal' ? null : mode,
                });
                said.push(`blend ${mode}`);
                break;
            }
            case 'transition': {
                const effect =
                    typeof value === 'string' ? value.trim().toLowerCase() : '';
                if (checkIsRemoval(effect) && effect !== 'none') {
                    writes.push({ key: names.transitionEffect, value: null });
                    said.push("the component's own transition");
                    break;
                }
                if (!TRANSITION_LIST.includes(effect)) {
                    return {
                        reason:
                            `transition "${String(value)}" is not one: ` +
                            `${TRANSITION_LIST.join(', ')}, or "default".`,
                    };
                }
                writes.push({ key: names.transitionEffect, value: effect });
                said.push(`transition ${effect} (the next time it comes up)`);
                break;
            }
            case 'speed': {
                const key = `foreground-${widget}-speed-percentage${suffix}`;
                const factor = toRelativeFactor(value);
                const current = readNumber(read, key) ?? 100;
                const next =
                    factor !== null
                        ? Math.round(current * factor)
                        : toPositiveNumber(value);
                if (next === null || next < MIN_SPEED || next > MAX_SPEED) {
                    return {
                        reason:
                            `speed is a percentage of normal, ${MIN_SPEED}-` +
                            `${MAX_SPEED} (100 is normal), "faster" or "slower".`,
                    };
                }
                writes.push({ key, value: `${Math.round(next)}` });
                said.push(`speed ${Math.round(next)}%`);
                break;
            }
            case 'border': {
                if (checkIsRemoval(value)) {
                    decorationPatch.borderStyle = 'none';
                    said.push('no border');
                    break;
                }
                const style =
                    typeof value === 'string' ? value.trim().toLowerCase() : '';
                if (!BORDER_STYLE_LIST.includes(style)) {
                    return {
                        reason: `border is one of: ${BORDER_STYLE_LIST.join(', ')}.`,
                    };
                }
                decorationPatch.borderStyle = style;
                said.push(`border ${style}`);
                break;
            }
            case 'borderWidth': {
                const next = toPositiveNumber(value);
                if (next === null || next < 0 || next > 40) {
                    return { reason: 'borderWidth is px, 0-40.' };
                }
                decorationPatch.borderWidth = next;
                said.push(`border ${next}px`);
                break;
            }
            case 'borderColor': {
                const hex = toHex(value);
                if (hex === null) {
                    return {
                        reason: `borderColor "${String(value)}" is not a colour.`,
                    };
                }
                decorationPatch.borderColor = hex.toUpperCase();
                said.push(`border colour ${String(value)}`);
                break;
            }
            case 'shadow':
            case 'textShadow': {
                const list =
                    field === 'shadow' ? SHADOW_LIST : TEXT_SHADOW_LIST;
                const shadow =
                    typeof value === 'string' ? value.trim().toLowerCase() : '';
                if (!list.includes(shadow)) {
                    return {
                        reason: `${field} is one of: ${list.join(', ')}.`,
                    };
                }
                decorationPatch[field] = shadow;
                said.push(
                    `${field === 'shadow' ? 'shadow' : 'text shadow'} ${shadow}`,
                );
                break;
            }
            case 'textAlign': {
                const align =
                    typeof value === 'string'
                        ? value.trim().toLowerCase().replace('centre', 'center')
                        : '';
                if (!TEXT_ALIGN_LIST.includes(align)) {
                    return { reason: 'textAlign is left, center or right.' };
                }
                decorationPatch.textAlign = align;
                said.push(`words ${align}`);
                break;
            }
            case 'italic':
            case 'underline':
            case 'uppercase': {
                const isOn = toBoolean(value);
                if (isOn === null) {
                    return { reason: `${field} is true or false.` };
                }
                const decorationKey =
                    field === 'italic'
                        ? 'isItalic'
                        : field === 'underline'
                          ? 'isUnderline'
                          : 'isUppercase';
                decorationPatch[decorationKey] = isOn;
                said.push(`${isOn ? '' : 'not '}${field}`);
                break;
            }
            case 'padding': {
                const next = toPositiveNumber(value);
                if (next === null || next < 0 || next > 2) {
                    return { reason: 'padding is in em (the font size), 0-2.' };
                }
                decorationPatch.padding = next;
                said.push(`padding ${next}em`);
                break;
            }
            default:
                return genFieldRefusal(widget, field, field);
        }
    }
    if (Object.keys(decorationPatch).length > 0) {
        // ONE JSON key holds every Effects value: merge into what is stored,
        // never replace it, or a border would take the shadow away with it.
        const key = genDecorationSettingName(prefix);
        let stored: Record<string, unknown>;
        try {
            const parsed = JSON.parse(read(key) ?? '{}');
            stored =
                parsed !== null && typeof parsed === 'object' ? parsed : {};
        } catch {
            stored = {};
        }
        writes.push({
            key,
            value: JSON.stringify({ ...stored, ...decorationPatch }),
        });
    }
    return { writes, said };
}
