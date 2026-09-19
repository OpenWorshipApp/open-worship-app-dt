import SettingManager from '../helper/SettingManager';
import {
    getSetting,
    removeSettingsByPrefix,
    setSetting,
    toFilePathSettingKey,
} from '../helper/settingHelpers';
import {
    checkIsForeignAbsolutePath,
    pathResolve,
    selectDirs,
    toPathCompareKey,
} from '../server/fileHelpers';

const RESOURCES_FOLDER_LIST_SETTING_NAME = 'resources-folder-list';

/**
 * Every prefix a resources folder persists under.
 *
 * Listed here rather than at each use site so the cleanup below cannot miss one
 * that is added later -- the whole point of it is that nothing is left behind.
 * Same reasoning, and the same shape, as `PRESENTING_FLOW_SETTING_PREFIXES`.
 */
const RESOURCES_FOLDER_SETTING_PREFIXES = ['resources-folder-expanded'];

/**
 * Whether the free-text file-name box is open. Panel-wide, not per folder --
 * one search runs over every folder at once -- so it is a fixed key rather than
 * one derived from a path, and it is deliberately NOT in
 * `RESOURCES_FOLDER_SETTING_PREFIXES`: removing a folder must not close it.
 */
export const RESOURCES_SEARCH_SHOWING_SETTING_NAME = 'resources-search-showing';

/**
 * Whether the Others box is ticked -- every file named after no chapter at
 * all, listed under each folder. Panel-wide for the same reasons as the search
 * box above, and kept out of the folder prefixes for the same reason too.
 */
export const RESOURCES_OTHERS_SHOWING_SETTING_NAME = 'resources-others-showing';

export function toResourcesFolderExpandedSettingName(dirPath: string) {
    return `resources-folder-expanded-${toFilePathSettingKey(dirPath)}`;
}

/**
 * Compare two folder paths the way the FILE SYSTEM the user is on would.
 *
 * Windows and a default-configured macOS are case-insensitive, so adding
 * `D:\Songs` after `D:\songs` must count as the same folder there; ext4 would
 * scan the same tree twice. Only the comparison is case-folded -- the stored
 * path keeps the casing the picker returned, which is what the user recognises.
 */
export function toDirPathCompareKey(dirPath: string) {
    return toPathCompareKey(dirPath);
}

export function sanitizeResourcesFolderList(dirPathList: unknown): string[] {
    if (!Array.isArray(dirPathList)) {
        return [];
    }
    const seenKeys = new Set<string>();
    const sanitized: string[] = [];
    for (const dirPath of dirPathList) {
        if (typeof dirPath !== 'string' || dirPath.trim().length === 0) {
            continue;
        }
        // `pathResolve` also strips the trailing separator, so `D:\a` and
        // `D:\a\` are one folder rather than two scans of one tree. A folder
        // from the other OS family is kept as written: resolving it here broke
        // it for good once the list was saved (`checkIsForeignAbsolutePath`).
        const trimmed = dirPath.trim();
        const resolved = checkIsForeignAbsolutePath(trimmed)
            ? trimmed
            : pathResolve(trimmed);
        const key = toDirPathCompareKey(resolved);
        if (seenKeys.has(key)) {
            continue;
        }
        seenKeys.add(key);
        sanitized.push(resolved);
    }
    return sanitized;
}

const resourcesFolderListSettingManager = new SettingManager<string[]>({
    settingName: RESOURCES_FOLDER_LIST_SETTING_NAME,
    defaultValue: [],
    isErrorToDefault: true,
    validate: (jsonString) => {
        try {
            return Array.isArray(JSON.parse(jsonString));
        } catch (_error) {
            return false;
        }
    },
    serialize: (dirPathList) => {
        return JSON.stringify(sanitizeResourcesFolderList(dirPathList));
    },
    deserialize: (jsonString) => {
        return sanitizeResourcesFolderList(JSON.parse(jsonString));
    },
});

export function getResourcesFolderList() {
    return resourcesFolderListSettingManager.getSetting();
}

export function setResourcesFolderList(dirPathList: string[]) {
    resourcesFolderListSettingManager.setSetting(dirPathList);
}

export type ResourcesFolderAddingResultType = {
    /** The list to save, or `null` when nothing was actually new. */
    newDirPathList: string[] | null;
    addedDirPaths: string[];
    /** Candidates the list already held, by the file system's own rules. */
    duplicatedDirPaths: string[];
};

/**
 * Fold candidate folders into the list, saying which of them were new.
 *
 * The picker and a drop both need this, but they need different things from
 * it: the picker only asks "is there anything to save?", while a drop has to
 * be able to say WHY nothing happened -- a dropped folder that is already on
 * the list would otherwise land on a panel that does not visibly change.
 */
export function addResourcesFolders(
    existingDirPathList: string[],
    candidateDirPaths: string[],
): ResourcesFolderAddingResultType {
    const sanitizedExisting = sanitizeResourcesFolderList(existingDirPathList);
    const seenKeys = new Set(sanitizedExisting.map(toDirPathCompareKey));
    const addedDirPaths: string[] = [];
    const duplicatedDirPaths: string[] = [];
    for (const dirPath of sanitizeResourcesFolderList(candidateDirPaths)) {
        const key = toDirPathCompareKey(dirPath);
        if (seenKeys.has(key)) {
            duplicatedDirPaths.push(dirPath);
            continue;
        }
        // Added as it goes, so two spellings of one folder in a single drop
        // (`D:\Songs` and `D:\songs` on Windows) count once.
        seenKeys.add(key);
        addedDirPaths.push(dirPath);
    }
    return {
        newDirPathList:
            addedDirPaths.length === 0
                ? null
                : [...sanitizedExisting, ...addedDirPaths],
        addedDirPaths,
        duplicatedDirPaths,
    };
}

/**
 * Put folders on the SAVED list, for a caller that is not the panel -- File →
 * Import Data, which brings the data directory's `resources` folder back but
 * not this list (a setting is not data), so the files it restored would land
 * on a machine whose panel shows none of them. Returns the folders that were
 * new; a panel already open picks them up on its Reload.
 */
export function addResourcesFoldersToList(dirPaths: string[]) {
    const { newDirPathList, addedDirPaths } = addResourcesFolders(
        getResourcesFolderList(),
        dirPaths,
    );
    if (newDirPathList !== null) {
        setResourcesFolderList(newDirPathList);
    }
    return addedDirPaths;
}

/**
 * The list with one folder swapped for another IN ITS PLACE.
 *
 * For a folder that was copied somewhere else: the copy takes over the box the
 * user was looking at rather than being appended at the bottom, where it would
 * read as a second library instead of the same one, moved. Sanitized after the
 * swap, so a copy that was somehow already on the list is kept once.
 */
export function replaceResourcesFolder(
    dirPathList: string[],
    oldDirPath: string,
    newDirPath: string,
) {
    const oldKey = toDirPathCompareKey(pathResolve(oldDirPath));
    return sanitizeResourcesFolderList(
        dirPathList.map((dirPath) => {
            return toDirPathCompareKey(pathResolve(dirPath)) === oldKey
                ? newDirPath
                : dirPath;
        }),
    );
}

/**
 * Ask the user for folders and return the list with them appended.
 *
 * Returns `null` when nothing changed -- the dialog was cancelled, or every
 * picked folder was already in the list -- so the caller can skip the state
 * update and the settings write it would cause.
 */
export async function promptAddResourcesFolders(existingDirPathList: string[]) {
    const pickedDirPaths = await selectDirs();
    if (pickedDirPaths.length === 0) {
        return null;
    }
    return addResourcesFolders(existingDirPathList, pickedDirPaths)
        .newDirPathList;
}

/**
 * Hand a folder's open/collapsed state to the folder replacing it, so the box
 * the user was looking at stays the way they left it. Written before the new
 * box mounts, because that is the only time it reads the setting.
 */
export function carryResourcesFolderSettings(
    oldDirPath: string,
    newDirPath: string,
) {
    const value = getSetting(toResourcesFolderExpandedSettingName(oldDirPath));
    if (!value) {
        return;
    }
    setSetting(toResourcesFolderExpandedSettingName(newDirPath), value);
}

/**
 * Forget everything a resources folder persisted, once it is off the list.
 *
 * Settings are one FILE per key, and this feature names them after the folder,
 * so a removed folder would otherwise leave its `resources-folder-expanded-…`
 * behind with nothing left that could ever read or clear it again.
 */
export async function removeResourcesFolderSettings(dirPath: string) {
    const key = toFilePathSettingKey(dirPath);
    const removedKeys = await Promise.all(
        RESOURCES_FOLDER_SETTING_PREFIXES.map((prefix) => {
            return removeSettingsByPrefix(`${prefix}-${key}`);
        }),
    );
    return removedKeys.flat();
}
