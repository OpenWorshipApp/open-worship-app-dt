import SettingManager from '../helper/SettingManager';
import {
    removeSettingsByPrefix,
    toFilePathSettingKey,
} from '../helper/settingHelpers';
import { pathResolve, selectDirs } from '../server/fileHelpers';
import appProvider from '../server/appProvider';

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
function toDirPathCompareKey(dirPath: string) {
    return appProvider.systemUtils.isLinux ? dirPath : dirPath.toLowerCase();
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
        // `D:\a\` are one folder rather than two scans of one tree.
        const resolved = pathResolve(dirPath.trim());
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
    const newDirPathList = sanitizeResourcesFolderList([
        ...existingDirPathList,
        ...pickedDirPaths,
    ]);
    if (newDirPathList.length === existingDirPathList.length) {
        return null;
    }
    return newDirPathList;
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
