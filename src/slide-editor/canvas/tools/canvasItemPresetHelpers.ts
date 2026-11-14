import { toValidBlendMode } from '../../../helper/blendModeHelpers';
import {
    type ColorModeType,
    genContrastColors,
} from '../../../others/color/colorContrastHelpers';
import type { AppColorType } from '../../../others/color/colorValueHelpers';
import type { SavedPresetBaseType } from '../../../others/savedPresetListHelpers';
import {
    checkIsMediaCanvasItemType,
    hAlignmentList,
    vAlignmentList,
    type HAlignmentType,
    type VAlignmentType,
} from '../canvasHelpers';
import {
    toValidCanvasShadow,
    type CanvasItemShadowType,
} from '../canvasShadowHelpers';

/**
 * Presets for a slide's box (2026-11-10, the user: _like stage setting,
 * slide's canvas item setting, ..._, then _for slide editing make sure
 * support dark/light preset_).
 *
 * A look is what a box WEARS, never where it is or what it says: its
 * backing colour, glass, corners, shadow and blend, and for a box of words
 * their colour, size, font, weight and (plain text only) alignment. Never
 * position, size, rotation, the words, the lock, the reading direction or
 * the transition -- a press restyles the box the person placed, and a look
 * put on another box must not move it.
 *
 * Every look field travels in the patch, the ones a look has none of as the
 * value that CLEARS them (`shadow: null`, `blendMode: 'normal'`,
 * `fontFamily: null`, `fontWeight: null`), never as `undefined`:
 * `applyProps` removes a cleared shadow and blend mode, so a box put back to
 * a look with none keeps none; and a box of words must keep its font and
 * weight `null` or a string -- a JSON save drops an `undefined` key, and
 * `checkIsValidTextStyleProps` then refuses the box when the document is
 * opened again.
 *
 * Saved looks are one list for every slide document
 * (`slide-editor-canvas-item-saved-presets`, the editors' section of Export /
 * Import Settings), each marked by what it was saved from: a box of words
 * sees both kinds, a picture or any other box only the box looks.
 */

export const CANVAS_ITEM_SAVED_PRESETS_SETTING_NAME =
    'slide-editor-canvas-item-saved-presets';

export type CanvasItemPresetKindType = 'text' | 'box';

export type CanvasItemBoxLookType = {
    backgroundColor: AppColorType;
    backdropFilter: number;
    roundSizePercentage: number;
    roundSizePixel: number;
    /** `normal` clears it (`cleanupBlendMode`). */
    blendMode: string;
    /** `null` clears it (`cleanupCanvasShadow`). */
    shadow: CanvasItemShadowType | null;
};

export type CanvasItemTextLookType = {
    color: AppColorType;
    fontSize: number;
    fontFamily: string | null;
    fontWeight: string | null;
    textHorizontalAlignment: HAlignmentType;
    textVerticalAlignment: VAlignmentType;
};

export type CanvasItemLookType = {
    kind: CanvasItemPresetKindType;
    box: CanvasItemBoxLookType;
    /** Present on a `text` look only. */
    text?: CanvasItemTextLookType;
};

export type CanvasItemSavedPresetType = SavedPresetBaseType &
    CanvasItemLookType;

export type CanvasItemPresetTargetType = {
    /** A box of words: text or a Bible passage. */
    hasTextProps: boolean;
    /** Plain text only: a Bible item lays its own lines out. */
    isAlignmentEnabled: boolean;
    /** A picture or a video fills its box: no backing colour is ever seen. */
    isMedia: boolean;
};

export function genCanvasItemPresetTarget(type: string) {
    return {
        hasTextProps: type === 'text' || type === 'bible',
        isAlignmentEnabled: type === 'text',
        isMedia: checkIsMediaCanvasItemType(type),
    } satisfies CanvasItemPresetTargetType;
}

const TRANSPARENT_COLOR = '#00000000' as AppColorType;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{3,8}$/;
// Bounds, not taste: what a typed field could hold, so a hand-edited preset
// cannot paint a blur that a low-spec machine cannot raster.
const MAX_BACKDROP_FILTER = 200;
const MAX_ROUND_SIZE_PIXEL = 2000;
const MAX_FONT_SIZE = 2000;

function toColor(value: unknown, fallback: AppColorType): AppColorType {
    return typeof value === 'string' && HEX_COLOR_PATTERN.test(value)
        ? (value as AppColorType)
        : fallback;
}

function toNumber(value: unknown, min: number, max: number, fallback: number) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, value));
}

function toOptionalString(value: unknown) {
    return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function toBoxLook(value: unknown): CanvasItemBoxLookType | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null;
    }
    const box = value as Record<string, unknown>;
    return {
        backgroundColor: toColor(box.backgroundColor, TRANSPARENT_COLOR),
        backdropFilter: toNumber(box.backdropFilter, 0, MAX_BACKDROP_FILTER, 0),
        roundSizePercentage: toNumber(box.roundSizePercentage, 0, 100, 0),
        roundSizePixel: toNumber(
            box.roundSizePixel,
            0,
            MAX_ROUND_SIZE_PIXEL,
            0,
        ),
        blendMode: toValidBlendMode(
            typeof box.blendMode === 'string' ? box.blendMode : undefined,
        ),
        shadow: toValidCanvasShadow(box.shadow),
    };
}

function toTextLook(value: unknown): CanvasItemTextLookType | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null;
    }
    const text = value as Record<string, unknown>;
    const fontSize = toNumber(text.fontSize, 1, MAX_FONT_SIZE, Number.NaN);
    if (Number.isNaN(fontSize)) {
        return null;
    }
    return {
        color: toColor(text.color, '#FFFFFF'),
        fontSize,
        fontFamily: toOptionalString(text.fontFamily),
        fontWeight: toOptionalString(text.fontWeight),
        textHorizontalAlignment: hAlignmentList.includes(
            text.textHorizontalAlignment as HAlignmentType,
        )
            ? (text.textHorizontalAlignment as HAlignmentType)
            : 'center',
        textVerticalAlignment: vAlignmentList.includes(
            text.textVerticalAlignment as VAlignmentType,
        )
            ? (text.textVerticalAlignment as VAlignmentType)
            : 'center',
    };
}

/** One saved entry as read off disk, checked field by field, or null. */
export function toCanvasItemSavedPreset(
    item: Record<string, unknown>,
    base: SavedPresetBaseType,
): CanvasItemSavedPresetType | null {
    const box = toBoxLook(item.box);
    if (box === null) {
        return null;
    }
    if (item.kind === 'box') {
        return { ...base, kind: 'box', box };
    }
    if (item.kind !== 'text') {
        return null;
    }
    const text = toTextLook(item.text);
    return text === null ? null : { ...base, kind: 'text', box, text };
}

/** The look the box wears now: what Save as Preset keeps. */
export function readCanvasItemLook(
    props: Record<string, any>,
    target: CanvasItemPresetTargetType,
): CanvasItemLookType {
    const box: CanvasItemBoxLookType = {
        backgroundColor: toColor(props.backgroundColor, TRANSPARENT_COLOR),
        backdropFilter: toNumber(
            props.backdropFilter,
            0,
            MAX_BACKDROP_FILTER,
            0,
        ),
        roundSizePercentage: toNumber(props.roundSizePercentage, 0, 100, 0),
        roundSizePixel: toNumber(
            props.roundSizePixel,
            0,
            MAX_ROUND_SIZE_PIXEL,
            0,
        ),
        blendMode: toValidBlendMode(props.blendMode),
        shadow: toValidCanvasShadow(props.shadow),
    };
    if (!target.hasTextProps) {
        return { kind: 'box', box };
    }
    const text = toTextLook(props);
    return text === null ? { kind: 'box', box } : { kind: 'text', box, text };
}

/** Which saved looks a box can wear: words take both kinds. */
export function checkIsCanvasItemPresetFor(
    preset: CanvasItemLookType,
    target: CanvasItemPresetTargetType,
) {
    return preset.kind === 'box' || target.hasTextProps;
}

/**
 * The ONE patch a saved look writes: the box always, the words when the box
 * has words (alignment only where the panel offers it). Every field is in it,
 * so nothing of the look it replaces is left behind.
 */
export function genCanvasItemLookPatch(
    look: CanvasItemLookType,
    target: CanvasItemPresetTargetType,
): Record<string, unknown> {
    const patch: Record<string, unknown> = { ...look.box };
    if (!target.hasTextProps || look.text === undefined) {
        return patch;
    }
    patch.color = look.text.color;
    patch.fontSize = look.text.fontSize;
    patch.fontFamily = look.text.fontFamily;
    patch.fontWeight = look.text.fontWeight;
    if (target.isAlignmentEnabled) {
        patch.textHorizontalAlignment = look.text.textHorizontalAlignment;
        patch.textVerticalAlignment = look.text.textVerticalAlignment;
    }
    return patch;
}

export type CanvasItemPresetIdType =
    'plain' | 'shadow' | 'glass-effect' | 'highlight' | 'urgent-alert';

/**
 * One of the app's looks. On a box of words its two colours are worked out
 * for the side the words are on (`genContrastColors`, as a foreground
 * preset's are), hue and alpha kept: a look goes on as written on the side
 * it was written for, and on the other side its words and box trade
 * lightness. So Highlight, dark words on marker yellow, is a deep amber box
 * under light words on the Dark side, and Glass Effect is a white frost on
 * the Light side and a smoked glass on the Dark one -- each chip shows what
 * a press puts on. It sets the box, the words' colour and their weight
 * (bold, or `null` for the font's own, so no look depends on the one
 * pressed before it), never a size or a font: the box keeps its own size.
 */
export type CanvasItemPresetType = {
    id: CanvasItemPresetIdType;
    iconName: string;
    /** For a box of words only. */
    isTextOnly: boolean;
    /** Never on a picture or a video, which hide what it changes. */
    isMediaHidden: boolean;
    box: CanvasItemBoxLookType;
    color: AppColorType;
    fontWeight: string | null;
};

const NO_BOX: CanvasItemBoxLookType = {
    backgroundColor: TRANSPARENT_COLOR,
    backdropFilter: 0,
    roundSizePercentage: 0,
    roundSizePixel: 0,
    blendMode: 'normal',
    shadow: null,
};

export const CANVAS_ITEM_PRESET_LIST: readonly CanvasItemPresetType[] = [
    {
        id: 'plain',
        iconName: 'square',
        isTextOnly: false,
        isMediaHidden: false,
        box: NO_BOX,
        color: '#FFFFFF',
        fontWeight: null,
    },
    {
        // A drop shadow follows what is PAINTED -- the letters of a box with
        // no backing, the cut-out of a logo -- where a box shadow would draw
        // a rectangle in mid-air (`canvasShadowHelpers`).
        id: 'shadow',
        iconName: 'shadows',
        isTextOnly: false,
        isMediaHidden: false,
        box: {
            ...NO_BOX,
            shadow: {
                kind: 'drop',
                offsetX: 0,
                offsetY: 6,
                blur: 16,
                color: '#000000B3',
            },
        },
        color: '#FFFFFF',
        fontWeight: null,
    },
    {
        id: 'glass-effect',
        iconName: 'window-stack',
        isTextOnly: false,
        isMediaHidden: true,
        box: {
            backgroundColor: '#FFFFFF26',
            backdropFilter: 12,
            roundSizePercentage: 6,
            roundSizePixel: 0,
            blendMode: 'normal',
            shadow: {
                kind: 'box',
                offsetX: 0,
                offsetY: 8,
                blur: 24,
                color: '#00000059',
            },
        },
        color: '#FFFFFF',
        fontWeight: null,
    },
    {
        id: 'highlight',
        iconName: 'highlighter',
        isTextOnly: true,
        isMediaHidden: true,
        box: {
            ...NO_BOX,
            backgroundColor: '#FFD60A',
            roundSizePercentage: 4,
        },
        color: '#111111',
        fontWeight: '700',
    },
    {
        id: 'urgent-alert',
        iconName: 'exclamation-triangle-fill',
        isTextOnly: true,
        isMediaHidden: true,
        box: {
            ...NO_BOX,
            backgroundColor: '#B91C1CF2',
            roundSizePercentage: 4,
        },
        color: '#FFFFFF',
        fontWeight: '700',
    },
];

export function getCanvasItemPresetList(target: CanvasItemPresetTargetType) {
    return CANVAS_ITEM_PRESET_LIST.filter((preset) => {
        if (preset.isTextOnly && !target.hasTextProps) {
            return false;
        }
        return !(preset.isMediaHidden && target.isMedia);
    });
}

/**
 * The words' and the box's colours of one of the app's looks on `mode`'s
 * side; a box with no words has no side, and wears the look as written.
 */
export function genCanvasItemPresetColors(
    preset: CanvasItemPresetType,
    mode: ColorModeType | null,
) {
    const colors = {
        color: preset.color as string,
        backgroundColor: preset.box.backgroundColor as string,
    };
    return mode === null ? colors : genContrastColors(colors, mode);
}

/** The ONE patch one of the app's looks writes on a box. */
export function genCanvasItemPresetPatch(
    preset: CanvasItemPresetType,
    target: CanvasItemPresetTargetType,
    mode: ColorModeType | null,
): Record<string, unknown> {
    const { color, backgroundColor } = genCanvasItemPresetColors(
        preset,
        target.hasTextProps ? mode : null,
    );
    const patch: Record<string, unknown> = { ...preset.box, backgroundColor };
    if (target.hasTextProps) {
        patch.color = color;
        patch.fontWeight = preset.fontWeight;
    }
    return patch;
}
