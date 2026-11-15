import type { SavedPresetBaseType } from '../others/savedPresetListHelpers';
import { toCanonicalFillSrc } from './fillValueHelpers';

/**
 * The fills somebody saved from the Fills tab (2026-11-14, the user: _should
 * allow customizing and saving preset_): the panel's Presets row, kept the
 * way every other panel's are (`savedPresetHelpers`), one list for every
 * screen's picker.
 */
export const FILL_PRESET_SETTING_NAME = 'background-fill-presets';

export type SavedFillPresetType = SavedPresetBaseType & { src: string };

/** A saved one read off disk: a fill in its one form, or dropped. */
export function toSavedFillPreset(
    item: Record<string, unknown>,
    base: SavedPresetBaseType,
): SavedFillPresetType | null {
    const src = toCanonicalFillSrc(item.src);
    return src === null ? null : { ...base, src };
}
