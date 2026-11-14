import type { SavedPresetBaseType } from '../others/savedPresetListHelpers';
import {
    LYRIC_STAGE_STYLE_DEFAULT,
    sanitizeLyricStageStyle,
    type LyricStageStyleType,
} from './lyricStageStyleHelpers';

/**
 * Presets for a stage's slide style (2026-11-10, the user, with the Stage
 * Style panel beside a foreground component's Presets row: _like foreground
 * preset I want setting everywhere provide preset_).
 *
 * The app's own looks are LAYOUTS: where the lyrics' box sits, how big it
 * is, how see-through and how large the words. They never touch the stage's
 * Theme or its Custom CSS -- a press must not throw away rules somebody
 * wrote, and a Light stage stays Light from one look to the next. A SAVED
 * look is the whole record, CSS and theme included: "exactly what I had".
 *
 * One saved list for every stage (`lyric-stage-style-saved-presets`), so a
 * look kept on Stage 0 can go on Stage 3; unprefixed, like the style itself,
 * and under `lyric-` so Export / Import Settings carries it with the lyrics.
 *
 * Imports only `./lyricStageStyleHelpers` from this folder: see the cycle
 * note there.
 */

export const LYRIC_STAGE_STYLE_SAVED_PRESETS_SETTING_NAME =
    'lyric-stage-style-saved-presets';

export type LyricStageStyleSavedPresetType = SavedPresetBaseType & {
    values: LyricStageStyleType;
};

/** One saved entry as read off disk, its record checked field by field. */
export function toLyricStageStyleSavedPreset(
    item: Record<string, unknown>,
    base: SavedPresetBaseType,
): LyricStageStyleSavedPresetType | null {
    const { values } = item;
    if (
        typeof values !== 'object' ||
        values === null ||
        Array.isArray(values)
    ) {
        return null;
    }
    return { ...base, values: sanitizeLyricStageStyle(values) };
}

export type LyricStageStyleLayoutType = Omit<
    LyricStageStyleType,
    'theme' | 'customCss'
>;

export type LyricStageStylePresetIdType =
    'full-screen' | 'center' | 'top-banner' | 'bottom-banner';

export type LyricStageStylePresetType = {
    id: LyricStageStylePresetIdType;
    iconName: string;
    layout: LyricStageStyleLayoutType;
};

const DEFAULT_LAYOUT: LyricStageStyleLayoutType = {
    marginHorizontalPercentage:
        LYRIC_STAGE_STYLE_DEFAULT.marginHorizontalPercentage,
    marginVerticalPercentage:
        LYRIC_STAGE_STYLE_DEFAULT.marginVerticalPercentage,
    isMarginLinked: LYRIC_STAGE_STYLE_DEFAULT.isMarginLinked,
    boxVerticalAlignment: LYRIC_STAGE_STYLE_DEFAULT.boxVerticalAlignment,
    boxHorizontalAlignment: LYRIC_STAGE_STYLE_DEFAULT.boxHorizontalAlignment,
    backgroundAlphaPercentage:
        LYRIC_STAGE_STYLE_DEFAULT.backgroundAlphaPercentage,
    extraFontSize: LYRIC_STAGE_STYLE_DEFAULT.extraFontSize,
};

// A band across the screen: the whole width less a little, under a third of
// the height, darker behind the words so they read over a picture or video,
// and words small enough for the band.
const BANNER_LAYOUT: Omit<LyricStageStyleLayoutType, 'boxVerticalAlignment'> = {
    marginHorizontalPercentage: 4,
    marginVerticalPercentage: 70,
    isMarginLinked: false,
    boxHorizontalAlignment: 'center',
    backgroundAlphaPercentage: 70,
    extraFontSize: 20,
};

export const LYRIC_STAGE_STYLE_PRESET_LIST: readonly LyricStageStylePresetType[] =
    [
        {
            id: 'full-screen',
            iconName: 'arrows-fullscreen',
            layout: {
                ...DEFAULT_LAYOUT,
                marginHorizontalPercentage: 0,
                marginVerticalPercentage: 0,
                isMarginLinked: true,
            },
        },
        {
            id: 'center',
            iconName: 'fullscreen-exit',
            layout: DEFAULT_LAYOUT,
        },
        {
            id: 'top-banner',
            iconName: 'layout-text-window',
            layout: { ...BANNER_LAYOUT, boxVerticalAlignment: 'start' },
        },
        {
            id: 'bottom-banner',
            iconName: 'layout-text-window-reverse',
            layout: { ...BANNER_LAYOUT, boxVerticalAlignment: 'end' },
        },
    ];

/** What one of the app's looks writes: its layout, nothing else. */
export function genLyricStageStylePresetPatch(
    preset: LyricStageStylePresetType,
): Partial<LyricStageStyleType> {
    return { ...preset.layout };
}
