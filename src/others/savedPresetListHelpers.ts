/**
 * The LIST of looks somebody saved, in any panel that keeps them
 * (2026-11-10, the user: _like foreground preset I want setting everywhere
 * provide preset_): a name, an id, and whatever that panel needs to put the
 * look back -- the payload is the panel's own (`values`, `style` ...), checked
 * by the panel.
 *
 * Pure, and with no imports: a panel's helper that only shapes a list (the
 * Bible text tiles keep theirs in a `SettingManager`) must not load the
 * settings machinery with it. Reading and writing a list, and telling the
 * other rows, is `savedPresetHelpers`.
 */

export type SavedPresetBaseType = { id: string; name: string };

// A row of buttons, not an archive: past this the row stops being a glance.
export const MAX_SAVED_PRESET_COUNT = 30;
const MAX_SAVED_PRESET_NAME_LENGTH = 40;

export function toSavedPresetName(name: unknown) {
    return typeof name === 'string'
        ? name.trim().slice(0, MAX_SAVED_PRESET_NAME_LENGTH)
        : '';
}

/** `<base> 1`, `<base> 2`... the first number no preset is already called. */
export function genSavedPresetName(
    presets: readonly SavedPresetBaseType[],
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

export function genSavedPresetId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * The presets of a list as they were read: one bad entry is dropped, not the
 * list it sits in -- a setting edited by hand, or written by a later release,
 * must not cost the others. `toPreset` checks the payload; the id and the
 * name are checked here.
 */
export function parseSavedPresetList<T extends SavedPresetBaseType>(
    parsed: unknown,
    toPreset: (
        item: Record<string, unknown>,
        base: SavedPresetBaseType,
    ) => T | null,
): T[] {
    if (!Array.isArray(parsed)) {
        return [];
    }
    const presets: T[] = [];
    const seenIdSet = new Set<string>();
    for (const item of parsed) {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) {
            continue;
        }
        const record = item as Record<string, unknown>;
        const { id } = record;
        const name = toSavedPresetName(record.name);
        if (typeof id !== 'string' || id === '' || name === '') {
            continue;
        }
        if (seenIdSet.has(id)) {
            continue;
        }
        const preset = toPreset(record, { id, name });
        if (preset === null) {
            continue;
        }
        seenIdSet.add(id);
        presets.push(preset);
    }
    return presets.slice(0, MAX_SAVED_PRESET_COUNT);
}

/** The list with one more; null when it is full or the name is empty. */
export function addSavedPreset<T extends SavedPresetBaseType>(
    presets: readonly T[],
    name: string,
    rest: Omit<T, 'id' | 'name'>,
): T[] | null {
    const presetName = toSavedPresetName(name);
    if (presetName === '' || presets.length >= MAX_SAVED_PRESET_COUNT) {
        return null;
    }
    return [
        ...presets,
        { id: genSavedPresetId(), name: presetName, ...rest } as T,
    ];
}

export function renameSavedPreset<T extends SavedPresetBaseType>(
    presets: readonly T[],
    id: string,
    name: string,
): T[] {
    const presetName = toSavedPresetName(name);
    return presets.map((preset) => {
        return preset.id === id && presetName !== ''
            ? { ...preset, name: presetName }
            : preset;
    });
}

export function replaceSavedPreset<T extends SavedPresetBaseType>(
    presets: readonly T[],
    id: string,
    rest: Omit<T, 'id' | 'name'>,
): T[] {
    return presets.map((preset) => {
        return preset.id === id ? { ...preset, ...rest } : preset;
    });
}

export function removeSavedPreset<T extends SavedPresetBaseType>(
    presets: readonly T[],
    id: string,
): T[] {
    return presets.filter((preset) => {
        return preset.id !== id;
    });
}

/** A preset named in words (the assistant), case aside. */
export function findSavedPresetByName<T extends SavedPresetBaseType>(
    presets: readonly T[],
    name: string,
): T | null {
    const wanted = name.trim().toLowerCase();
    if (wanted === '') {
        return null;
    }
    return (
        presets.find((preset) => {
            return preset.name.toLowerCase() === wanted;
        }) ?? null
    );
}
