import { getSetting, setSetting } from '../helper/settingHelpers';
import {
    type SavedPresetBaseType,
    parseSavedPresetList,
} from './savedPresetListHelpers';

/**
 * Where a panel's saved looks are KEPT: one setting per list, read when a
 * Presets row mounts and written only by a row (`PresetsRowComp`). The list
 * itself -- names, ids, the limit -- is `savedPresetListHelpers`'.
 *
 * Nothing is cached here: a list is a few kilobytes at most, and a row
 * re-reads it before every change (`mutateSavedPresets`), so two rows over the
 * same list -- two selected slide boxes, two Mini Screens sharing one brush
 * list -- never write over each other's additions.
 */

export function readSavedPresets<T extends SavedPresetBaseType>(
    settingName: string,
    toPreset: (
        item: Record<string, unknown>,
        base: SavedPresetBaseType,
    ) => T | null,
): T[] {
    const text = getSetting(settingName);
    if (!text) {
        return [];
    }
    try {
        return parseSavedPresetList(JSON.parse(text), toPreset);
    } catch {
        // A list that is not JSON any more is no list: the next save writes
        // a good one over it.
        return [];
    }
}

type SavedPresetsListenerType = (
    presets: readonly SavedPresetBaseType[],
) => void;

// The rows mounted in THIS window, by list: a save in one shows in the others
// at once, handed the list as written so none of them reads it again. Each row
// removes itself on unmount, so this never outgrows what is on screen.
const listenerSetMap = new Map<string, Set<SavedPresetsListenerType>>();

export function subscribeSavedPresets(
    settingName: string,
    listener: SavedPresetsListenerType,
) {
    let listenerSet = listenerSetMap.get(settingName);
    if (listenerSet === undefined) {
        listenerSet = new Set();
        listenerSetMap.set(settingName, listenerSet);
    }
    listenerSet.add(listener);
    return () => {
        const currentSet = listenerSetMap.get(settingName);
        if (currentSet === undefined) {
            return;
        }
        currentSet.delete(listener);
        if (currentSet.size === 0) {
            listenerSetMap.delete(settingName);
        }
    };
}

export function writeSavedPresets(
    settingName: string,
    presets: readonly SavedPresetBaseType[],
) {
    setSetting(settingName, JSON.stringify(presets));
    const listenerSet = listenerSetMap.get(settingName);
    if (listenerSet === undefined) {
        return;
    }
    for (const listener of [...listenerSet]) {
        listener(presets);
    }
}

/**
 * Read the list as it is NOW, change it, write it, tell the other rows. The
 * new list, or null when the change made none (a full list, an empty name).
 */
export function mutateSavedPresets<T extends SavedPresetBaseType>(
    settingName: string,
    toPreset: (
        item: Record<string, unknown>,
        base: SavedPresetBaseType,
    ) => T | null,
    mutate: (presets: T[]) => T[] | null,
): T[] | null {
    const newPresets = mutate(readSavedPresets(settingName, toPreset));
    if (newPresets === null) {
        return null;
    }
    writeSavedPresets(settingName, newPresets);
    return newPresets;
}
