import { appHomeStorage } from '../../server/appHomeStorage';
import { pathResolve, toPathCompareKey } from '../../server/storageFileHelpers';

/**
 * The data folders this computer has used, newest first, so Path Settings can
 * offer a way back to one without the folder picker.
 *
 * Kept in the machine-wide home store beside `selected-parent-dir` itself: a
 * per-data-folder setting would live in the folder it lists and change with
 * every switch. Imports only the start-up leaf helpers, because
 * `appLocalStorage` records here and every renderer loads it while booting.
 */
export const PARENT_DIR_HISTORY_SETTING_NAME = 'selected-parent-dir-history';
export const MAX_PARENT_DIR_HISTORY_COUNT = 10;

export function toParentDirHistory(dirPathList: unknown): string[] {
    if (!Array.isArray(dirPathList)) {
        return [];
    }
    const seenKeys = new Set<string>();
    const history: string[] = [];
    for (const dirPath of dirPathList) {
        if (typeof dirPath !== 'string' || dirPath.trim().length === 0) {
            continue;
        }
        // `pathResolve` drops a trailing separator, so a typed `D:\data\` and a
        // picked `D:\data` are one folder; the compare key folds case where
        // the file system does.
        const resolved = pathResolve(dirPath.trim());
        const key = toPathCompareKey(resolved);
        if (seenKeys.has(key)) {
            continue;
        }
        seenKeys.add(key);
        history.push(resolved);
        if (history.length === MAX_PARENT_DIR_HISTORY_COUNT) {
            break;
        }
    }
    return history;
}

export function getParentDirHistory(): string[] {
    const jsonString = appHomeStorage.getItem(PARENT_DIR_HISTORY_SETTING_NAME);
    if (!jsonString) {
        return [];
    }
    try {
        return toParentDirHistory(JSON.parse(jsonString));
    } catch (_error) {
        return [];
    }
}

function saveParentDirHistory(oldHistory: string[], newHistory: string[]) {
    if (JSON.stringify(oldHistory) === JSON.stringify(newHistory)) {
        return;
    }
    appHomeStorage.setItem(
        PARENT_DIR_HISTORY_SETTING_NAME,
        JSON.stringify(newHistory),
    );
}

/** Each folder moves to the front; the last one given ends up first. */
export function addParentDirHistory(...dirPaths: (string | null)[]) {
    const oldHistory = getParentDirHistory();
    let newHistory = oldHistory;
    for (const dirPath of dirPaths) {
        if (dirPath) {
            newHistory = toParentDirHistory([dirPath, ...newHistory]);
        }
    }
    saveParentDirHistory(oldHistory, newHistory);
}

export function removeParentDirHistory(dirPath: string) {
    const oldHistory = getParentDirHistory();
    const key = toPathCompareKey(pathResolve(dirPath));
    saveParentDirHistory(
        oldHistory,
        oldHistory.filter((item) => {
            return toPathCompareKey(item) !== key;
        }),
    );
}

/**
 * A folder that came back somewhere else (a stick on another drive letter)
 * takes over its old entry IN PLACE, so the old path does not stay listed as
 * missing while the folder it named is in use.
 */
export function replaceParentDirHistory(
    oldDirPath: string,
    newDirPath: string,
) {
    const oldHistory = getParentDirHistory();
    const key = toPathCompareKey(pathResolve(oldDirPath));
    saveParentDirHistory(
        oldHistory,
        toParentDirHistory(
            oldHistory.map((item) => {
                return toPathCompareKey(item) === key ? newDirPath : item;
            }),
        ),
    );
}
