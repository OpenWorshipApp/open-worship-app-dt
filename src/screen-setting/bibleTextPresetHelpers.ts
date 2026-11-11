import SettingManager from '../helper/SettingManager';
import type { AnyObjectType } from '../helper/typeHelpers';
import {
    MAX_SAVED_PRESET_COUNT,
    type SavedPresetBaseType,
    addSavedPreset,
    genSavedPresetName,
    parseSavedPresetList,
    removeSavedPreset,
    renameSavedPreset,
    replaceSavedPreset,
} from '../others/savedPresetListHelpers';
import { SCREEN_BIBLE_SETTING_PREFIX } from '../_screen/screenBibleHelpers';
import {
    genBibleTextStylePatch,
    toBibleTextStyleView,
    type BibleTextStyleViewType,
} from '../_screen/bibleTextStyleHelpers';

/**
 * A look somebody made and wanted to keep: a name, and the WHOLE style it was
 * saved from -- size and colour included, because a preset is "exactly what
 * I had on the screen", and a look put back at another size is another look.
 *
 * Kept beside the style itself (same prefix, so Export / Import Settings
 * carries both in one section) and never sent to a screen: a screen draws the
 * style that is applied, and has no use for the ones that are not.
 */
export type BibleTextPresetType = SavedPresetBaseType & {
    style: AnyObjectType;
};

// A gallery, not an archive: past this the tiles stop being a glance, and the
// setting stops being a file read in one go when the panel opens.
export const MAX_BIBLE_TEXT_PRESET_COUNT = MAX_SAVED_PRESET_COUNT;

function toPreset(
    item: Record<string, unknown>,
    base: SavedPresetBaseType,
): BibleTextPresetType | null {
    const { style } = item;
    if (typeof style !== 'object' || style === null) {
        return null;
    }
    return { ...base, style: style as AnyObjectType };
}

const presetSettingManager = new SettingManager<BibleTextPresetType[]>({
    settingName: `${SCREEN_BIBLE_SETTING_PREFIX}-style-presets`,
    defaultValue: [],
    isErrorToDefault: true,
    validate: (jsonString) => {
        try {
            return Array.isArray(JSON.parse(jsonString));
        } catch (_error) {
            return false;
        }
    },
    serialize: (presets) => JSON.stringify(presets),
    // One bad entry is dropped, not the list it sits in: a preset edited by
    // hand, or written by a later release, must not cost the others.
    deserialize: (jsonString) => {
        return parseSavedPresetList(JSON.parse(jsonString), toPreset);
    },
});

export function getBibleTextPresets() {
    return presetSettingManager.getSetting();
}

export function setBibleTextPresets(presets: BibleTextPresetType[]) {
    presetSettingManager.setSetting(presets);
}

export function toBibleTextPresetView(preset: BibleTextPresetType) {
    return toBibleTextStyleView(preset.style);
}

/** `<base> 1`, `<base> 2`... the first number no preset is already called. */
export function genBibleTextPresetName(
    presets: readonly BibleTextPresetType[],
    baseName: string,
) {
    return genSavedPresetName(presets, baseName);
}

/** The list with the look added, or null when it is full or has no name. */
export function addBibleTextPreset(
    presets: readonly BibleTextPresetType[],
    name: string,
    view: BibleTextStyleViewType,
): BibleTextPresetType[] | null {
    return addSavedPreset(presets, name, {
        style: genBibleTextStylePatch(view),
    });
}

export function renameBibleTextPreset(
    presets: readonly BibleTextPresetType[],
    id: string,
    name: string,
): BibleTextPresetType[] {
    return renameSavedPreset(presets, id, name);
}

export function replaceBibleTextPresetStyle(
    presets: readonly BibleTextPresetType[],
    id: string,
    view: BibleTextStyleViewType,
): BibleTextPresetType[] {
    return replaceSavedPreset(presets, id, {
        style: genBibleTextStylePatch(view),
    });
}

export function removeBibleTextPreset(
    presets: readonly BibleTextPresetType[],
    id: string,
): BibleTextPresetType[] {
    return removeSavedPreset(presets, id);
}
