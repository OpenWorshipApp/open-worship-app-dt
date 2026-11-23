import type { SavedPresetBaseType } from '../others/savedPresetListHelpers';
import { toCanonicalAnimationSrc } from './animationValueHelpers';

/**
 * The animations somebody saved from the Animations tab -- a recoloured
 * effect or their own shader -- kept the way every other panel's presets are
 * (`savedPresetHelpers`), one list for every screen's picker.
 */
export const ANIMATION_PRESET_SETTING_NAME = 'background-animation-presets';

export type SavedAnimationPresetType = SavedPresetBaseType & { src: string };

/** A saved one read off disk: an animation in its one form, or dropped. */
export function toSavedAnimationPreset(
    item: Record<string, unknown>,
    base: SavedPresetBaseType,
): SavedAnimationPresetType | null {
    const src = toCanonicalAnimationSrc(item.src);
    return src === null ? null : { ...base, src };
}

/**
 * Where a picker keeps the category it shows (2026-11-19): beside the
 * saved list it shows -- a Background session's own, removed with it
 * (`genPaintSessionSettingNames`) -- and Animation Show's apart.
 */
export function toAnimationCategorySettingName(
    presetSettingName: string,
    place: 'background' | 'foreground',
) {
    return place === 'background'
        ? `${presetSettingName}-category`
        : `${presetSettingName}-category-${place}`;
}
