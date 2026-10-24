import SettingManager from '../helper/SettingManager';
import type { AnyObjectType } from '../helper/typeHelpers';
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
export type BibleTextPresetType = {
    id: string;
    name: string;
    style: AnyObjectType;
};

// A gallery, not an archive: past this the tiles stop being a glance, and the
// setting stops being a file read in one go when the panel opens.
export const MAX_BIBLE_TEXT_PRESET_COUNT = 30;
const MAX_PRESET_NAME_LENGTH = 40;

function toPresetName(name: unknown) {
    return typeof name === 'string'
        ? name.trim().slice(0, MAX_PRESET_NAME_LENGTH)
        : '';
}

function toPreset(value: unknown): BibleTextPresetType | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    const { id, name, style } = value as AnyObjectType;
    const presetName = toPresetName(name);
    if (
        typeof id !== 'string' ||
        id === '' ||
        presetName === '' ||
        typeof style !== 'object' ||
        style === null
    ) {
        return null;
    }
    return { id, name: presetName, style };
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
        const presets: BibleTextPresetType[] = [];
        const seenIdSet = new Set<string>();
        for (const item of JSON.parse(jsonString) as unknown[]) {
            const preset = toPreset(item);
            if (preset === null || seenIdSet.has(preset.id)) {
                continue;
            }
            seenIdSet.add(preset.id);
            presets.push(preset);
        }
        return presets.slice(0, MAX_BIBLE_TEXT_PRESET_COUNT);
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
    const nameSet = new Set(presets.map((preset) => preset.name));
    for (let i = 1; ; i++) {
        const name = `${baseName} ${i}`;
        if (!nameSet.has(name)) {
            return name;
        }
    }
}

function genPresetId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** The list with the look added, or null when it is full or has no name. */
export function addBibleTextPreset(
    presets: readonly BibleTextPresetType[],
    name: string,
    view: BibleTextStyleViewType,
): BibleTextPresetType[] | null {
    const presetName = toPresetName(name);
    if (presetName === '' || presets.length >= MAX_BIBLE_TEXT_PRESET_COUNT) {
        return null;
    }
    return [
        ...presets,
        {
            id: genPresetId(),
            name: presetName,
            style: genBibleTextStylePatch(view),
        },
    ];
}

export function renameBibleTextPreset(
    presets: readonly BibleTextPresetType[],
    id: string,
    name: string,
): BibleTextPresetType[] {
    const presetName = toPresetName(name);
    return presets.map((preset) => {
        return preset.id === id && presetName !== ''
            ? { ...preset, name: presetName }
            : preset;
    });
}

export function replaceBibleTextPresetStyle(
    presets: readonly BibleTextPresetType[],
    id: string,
    view: BibleTextStyleViewType,
): BibleTextPresetType[] {
    return presets.map((preset) => {
        return preset.id === id
            ? { ...preset, style: genBibleTextStylePatch(view) }
            : preset;
    });
}

export function removeBibleTextPreset(
    presets: readonly BibleTextPresetType[],
    id: string,
): BibleTextPresetType[] {
    return presets.filter((preset) => {
        return preset.id !== id;
    });
}
