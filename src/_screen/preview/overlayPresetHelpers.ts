import type { SpotlightLookType } from '../managers/screenOverlayHelpers';
import type { SavedPresetBaseType } from '../../others/savedPresetListHelpers';

/**
 * Presets for the two overlay tools (2026-11-10, the user: _like foreground
 * preset I want setting everywhere provide preset_): the BRUSH a Mini
 * Screen's Draw and Presenting Control's brush paint with, and the SPOTLIGHT
 * of a Mini Screen's Focus and Presenting Control's spotlight.
 *
 * One saved list per tool, shared by both places it is drawn: a highlighter
 * kept on screen 1 is the same highlighter over the app. Each list is under
 * its tool's own setting prefix (`draw-paint-`, `screen-focus-`), so Export /
 * Import Settings carries it with the drawing settings; the screen-delete
 * path drops only `<prefix><screenId>` keys, never these.
 *
 * What is left out on purpose: the brush's quality (what the MACHINE can
 * afford, not how a stroke looks -- a preset must never switch a weak
 * machine back to the slow path), its eraser (a tool choice), and the
 * spotlight's Hold / Follow (how it behaves).
 */

export const BRUSH_SAVED_PRESETS_SETTING_NAME = 'draw-paint-saved-presets';
export const SPOTLIGHT_SAVED_PRESETS_SETTING_NAME =
    'screen-focus-saved-presets';

export type BrushLookType = {
    /** `#rrggbb`: the panel's colour, its opacity kept apart in `alpha`. */
    color: string;
    alpha: number;
    size: number;
    isStraight: boolean;
    is3D: boolean;
    isDots: boolean;
};

export type BrushSavedPresetType = SavedPresetBaseType & {
    values: BrushLookType;
};

export type SpotlightSavedPresetType = SavedPresetBaseType & {
    values: SpotlightLookType;
};

// The same bounds both brushes' sliders have (1..60px, 5..100%) and both
// spotlights' (40..1200px, 10..100% dim, 0..100% blur): a hand-edited list
// must not hand a panel a value its own control could never reach.
const BRUSH_SIZE_RANGE = { min: 1, max: 60 };
const BRUSH_ALPHA_RANGE = { min: 5, max: 100 };
const SPOTLIGHT_SIZE_RANGE = { min: 40, max: 1200 };
const SPOTLIGHT_DIM_RANGE = { min: 10, max: 100 };
const SPOTLIGHT_BLUR_RANGE = { min: 0, max: 100 };
const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;

function toNumber(value: unknown, range: { min: number; max: number }) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
    }
    return Math.min(range.max, Math.max(range.min, Math.round(value)));
}

function toValues(item: Record<string, unknown>) {
    const { values } = item;
    return typeof values === 'object' &&
        values !== null &&
        !Array.isArray(values)
        ? (values as Record<string, unknown>)
        : null;
}

/** One saved brush as read off disk, or null when it is not one. */
export function toBrushSavedPreset(
    item: Record<string, unknown>,
    base: SavedPresetBaseType,
): BrushSavedPresetType | null {
    const values = toValues(item);
    if (values === null) {
        return null;
    }
    const alpha = toNumber(values.alpha, BRUSH_ALPHA_RANGE);
    const size = toNumber(values.size, BRUSH_SIZE_RANGE);
    if (
        typeof values.color !== 'string' ||
        !HEX_COLOR_REGEX.test(values.color) ||
        alpha === null ||
        size === null
    ) {
        return null;
    }
    return {
        ...base,
        values: {
            color: values.color.toLowerCase(),
            alpha,
            size,
            isStraight: values.isStraight === true,
            is3D: values.is3D === true,
            isDots: values.isDots === true,
        },
    };
}

/** One saved spotlight as read off disk, or null when it is not one. */
export function toSpotlightSavedPreset(
    item: Record<string, unknown>,
    base: SavedPresetBaseType,
): SpotlightSavedPresetType | null {
    const values = toValues(item);
    if (values === null) {
        return null;
    }
    const size = toNumber(values.size, SPOTLIGHT_SIZE_RANGE);
    const dimOpacity = toNumber(values.dimOpacity, SPOTLIGHT_DIM_RANGE);
    const edgeBlur = toNumber(values.edgeBlur, SPOTLIGHT_BLUR_RANGE);
    if (
        typeof values.dimColor !== 'string' ||
        !HEX_COLOR_REGEX.test(values.dimColor) ||
        size === null ||
        dimOpacity === null ||
        edgeBlur === null
    ) {
        return null;
    }
    return {
        ...base,
        values: {
            size,
            dimColor: values.dimColor.toLowerCase(),
            dimOpacity,
            edgeBlur,
            isContrast: values.isContrast === true,
        },
    };
}

export type BrushPresetIdType = 'highlight' | 'underline' | 'bold';

export const BRUSH_PRESET_LIST: readonly {
    id: BrushPresetIdType;
    iconName: string;
    look: BrushLookType;
}[] = [
    {
        // A marker run over words: wide, see-through, straight.
        id: 'highlight',
        iconName: 'highlighter',
        look: {
            color: '#ffd60a',
            alpha: 35,
            size: 28,
            isStraight: true,
            is3D: false,
            isDots: false,
        },
    },
    {
        id: 'underline',
        iconName: 'type-underline',
        look: {
            color: '#ff2d2d',
            alpha: 100,
            size: 5,
            isStraight: true,
            is3D: false,
            isDots: false,
        },
    },
    {
        id: 'bold',
        iconName: 'type-bold',
        look: {
            color: '#ff2d2d',
            alpha: 100,
            size: 20,
            isStraight: false,
            is3D: false,
            isDots: false,
        },
    },
];

export type SpotlightPresetIdType = 'haze' | 'strong' | 'halo';

export const SPOTLIGHT_PRESET_LIST: readonly {
    id: SpotlightPresetIdType;
    iconName: string;
    look: SpotlightLookType;
}[] = [
    {
        // The rest of the screen only veiled, the circle's rim soft.
        id: 'haze',
        iconName: 'cloud-haze2',
        look: {
            size: 360,
            dimColor: '#000000',
            dimOpacity: 45,
            edgeBlur: 70,
            isContrast: false,
        },
    },
    {
        // Nearly dark around a crisp circle: nothing else to look at.
        id: 'strong',
        iconName: 'record-circle',
        look: {
            size: 260,
            dimColor: '#000000',
            dimOpacity: 90,
            edgeBlur: 10,
            isContrast: false,
        },
    },
    {
        // A wide circle that fades out into the dim.
        id: 'halo',
        iconName: 'brightness-high',
        look: {
            size: 520,
            dimColor: '#000000',
            dimOpacity: 65,
            edgeBlur: 60,
            isContrast: false,
        },
    },
];
