import {
    getSetting,
    removeSetting,
    setSetting,
} from '../helper/settingHelpers';
import {
    genCommonStyleSettingNames,
    genDecorationSettingName,
    genPropsSettingNames,
} from './foregroundStyleSettingNames';

/**
 * Presets somebody SAVED (2026-11-09, the user: _foreground properties:
 * allow saving the setting to a new preset_): a name and the whole of a
 * session's Properties as they were -- where the box sits, its size, its
 * colours and font, Effects, layer and transition, and a marquee's own size
 * and speed -- put back EXACTLY when pressed, on whichever session is in
 * front. Unlike the app's own presets, nothing of it is worked out again:
 * a value that was the default when it was saved is the default again, so
 * nothing of the look it replaces is left behind.
 *
 * One setting per component (`foreground-<key>-saved-presets`), read when a
 * Presets row mounts and written only by it; never sent to a screen.
 */

export type ForegroundSavedPresetType = {
    id: string;
    name: string;
    /** By field (`props.widthPercentage`, `common.color`, `decoration`). */
    values: Record<string, string>;
};

// A row of buttons, not an archive: past this the row stops being a glance.
export const MAX_FOREGROUND_SAVED_PRESET_COUNT = 30;
const MAX_PRESET_NAME_LENGTH = 40;

export function genSavedPresetSettingName(widgetKey: string) {
    return `foreground-${widgetKey}-saved-presets`;
}

function toPresetName(name: unknown) {
    return typeof name === 'string'
        ? name.trim().slice(0, MAX_PRESET_NAME_LENGTH)
        : '';
}

function toSavedPreset(value: unknown): ForegroundSavedPresetType | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    const { id, name, values } = value as Record<string, unknown>;
    const presetName = toPresetName(name);
    if (
        typeof id !== 'string' ||
        id === '' ||
        presetName === '' ||
        typeof values !== 'object' ||
        values === null ||
        Array.isArray(values)
    ) {
        return null;
    }
    const cleanValues: Record<string, string> = {};
    for (const [field, fieldValue] of Object.entries(values)) {
        if (typeof fieldValue === 'string') {
            cleanValues[field] = fieldValue;
        }
    }
    return { id, name: presetName, values: cleanValues };
}

/**
 * The saved presets of one component. One bad entry is dropped, not the
 * list it sits in: a setting edited by hand must not cost the others.
 */
export function getForegroundSavedPresets(
    widgetKey: string,
): ForegroundSavedPresetType[] {
    const text = getSetting(genSavedPresetSettingName(widgetKey));
    let parsed: unknown;
    try {
        parsed = text ? JSON.parse(text) : null;
    } catch {
        parsed = null;
    }
    if (!Array.isArray(parsed)) {
        return [];
    }
    const presets: ForegroundSavedPresetType[] = [];
    const seenIdSet = new Set<string>();
    for (const item of parsed) {
        const preset = toSavedPreset(item);
        if (preset === null || seenIdSet.has(preset.id)) {
            continue;
        }
        seenIdSet.add(preset.id);
        presets.push(preset);
    }
    return presets.slice(0, MAX_FOREGROUND_SAVED_PRESET_COUNT);
}

export function setForegroundSavedPresets(
    widgetKey: string,
    presets: readonly ForegroundSavedPresetType[],
) {
    setSetting(genSavedPresetSettingName(widgetKey), JSON.stringify(presets));
}

/**
 * Every setting a session's look is kept under, by a field name that does
 * not depend on the session: what a saved preset stores, and what it puts
 * back on another session.
 */
function genLookFieldMap(widgetKey: string, prefix: string) {
    const fieldMap: Record<string, string> = {};
    for (const [field, key] of Object.entries(genPropsSettingNames(prefix))) {
        fieldMap[`props.${field}`] = key;
    }
    for (const [field, key] of Object.entries(
        genCommonStyleSettingNames(prefix),
    )) {
        fieldMap[`common.${field}`] = key;
    }
    fieldMap.decoration = genDecorationSettingName(prefix);
    // A marquee keeps its size and speed outside its Properties.
    if (widgetKey === 'marquee-top' || widgetKey === 'marquee-bottom') {
        const suffix = prefix.startsWith(widgetKey)
            ? prefix.slice(widgetKey.length)
            : '';
        for (const part of ['font-size', 'speed-percentage']) {
            fieldMap[`own.${part}`] =
                `foreground-${widgetKey}-${part}${suffix}`;
        }
    }
    return fieldMap;
}

/** The session's look as it is now: only the values somebody set. */
export function readForegroundLookValues(widgetKey: string, prefix: string) {
    const values: Record<string, string> = {};
    for (const [field, key] of Object.entries(
        genLookFieldMap(widgetKey, prefix),
    )) {
        const value = getSetting(key);
        if (value !== null && value !== '') {
            values[field] = value;
        }
    }
    return values;
}

/**
 * Puts a saved look on one session: every field it holds written, every
 * other one taken back to its default. Synchronous, so the caller can
 * restyle what is up and remount the panel straight after.
 */
export function applyForegroundSavedPreset(
    widgetKey: string,
    prefix: string,
    preset: ForegroundSavedPresetType,
) {
    for (const [field, key] of Object.entries(
        genLookFieldMap(widgetKey, prefix),
    )) {
        const value = preset.values[field];
        if (value === undefined) {
            if (getSetting(key) !== null) {
                removeSetting(key);
            }
        } else {
            setSetting(key, value);
        }
    }
}

/** `<base> 1`, `<base> 2`... the first number no preset is already called. */
export function genForegroundSavedPresetName(
    presets: readonly ForegroundSavedPresetType[],
    baseName: string,
) {
    const nameSet = new Set(
        presets.map((preset) => {
            return preset.name;
        }),
    );
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

/** The list with the session's look added; null when full or unnamed. */
export function addForegroundSavedPreset(
    presets: readonly ForegroundSavedPresetType[],
    name: string,
    values: Record<string, string>,
): ForegroundSavedPresetType[] | null {
    const presetName = toPresetName(name);
    if (
        presetName === '' ||
        presets.length >= MAX_FOREGROUND_SAVED_PRESET_COUNT
    ) {
        return null;
    }
    return [...presets, { id: genPresetId(), name: presetName, values }];
}

export function renameForegroundSavedPreset(
    presets: readonly ForegroundSavedPresetType[],
    id: string,
    name: string,
): ForegroundSavedPresetType[] {
    const presetName = toPresetName(name);
    return presets.map((preset) => {
        return preset.id === id && presetName !== ''
            ? { ...preset, name: presetName }
            : preset;
    });
}

export function replaceForegroundSavedPreset(
    presets: readonly ForegroundSavedPresetType[],
    id: string,
    values: Record<string, string>,
): ForegroundSavedPresetType[] {
    return presets.map((preset) => {
        return preset.id === id ? { ...preset, values } : preset;
    });
}

export function removeForegroundSavedPreset(
    presets: readonly ForegroundSavedPresetType[],
    id: string,
): ForegroundSavedPresetType[] {
    return presets.filter((preset) => {
        return preset.id !== id;
    });
}

/** A saved preset named in words (the assistant), case aside. */
export function findForegroundSavedPreset(widgetKey: string, name: string) {
    const wanted = name.trim().toLowerCase();
    if (wanted === '') {
        return null;
    }
    return (
        getForegroundSavedPresets(widgetKey).find((preset) => {
            return preset.name.toLowerCase() === wanted;
        }) ?? null
    );
}
