import { toEditingHistoryFolderPath } from '../editing-manager/editingHistoryPathHelpers';
import {
    fsExistSync,
    fsList,
    fsMove,
    pathBasename,
    pathJoin,
    pathResolve,
} from '../server/fileHelpers';
import { appLocalStorage } from '../setting/directory-setting/appLocalStorage';
import { defaultDataDirNames, dirSourceSettingNames } from './constants';
import { handleError } from './errorHelpers';
import { toFilePathSettingKey } from './settingHelpers';

/**
 * ONE-OFF migration for the rename of the run-sheet subsystem.
 *
 * Everything an older version wrote outside the source tree still carries the
 * name it used then: its directory setting, every per-file row/preview setting,
 * the data folder itself and the file extension. Nothing reads those any more,
 * so without this pass an existing installation comes up with no folder
 * selected and no files in it.
 *
 * The old name is never spelled out here — it is DISCOVERED from the
 * installation being migrated (see `findLegacyDirSetting`), which is both why
 * this file can stay free of it and why the pass keeps working whatever that
 * name happened to be.
 *
 * Loaded through a dynamic `import()` from `init()`, and only while the marker
 * setting is still missing, so on every launch after the first this module is
 * never fetched, parsed or evaluated at all.
 */

const NAME = 'presenting-flow';
const DIR_SETTING_PREFIX = 'select-dir-';
const LEGACY_DOT_EXTENSION = '.owp';
const DOT_EXTENSION = '.owpf';
const LEGACY_HISTORY_SUFFIX = toEditingHistoryFolderPath(LEGACY_DOT_EXTENSION);
const HISTORY_SUFFIX = toEditingHistoryFolderPath(DOT_EXTENSION);

type LegacyDirSettingType = {
    /** The word the old version used, taken from its own setting key. */
    token: string;
    dirPath: string;
};

/**
 * Move `oldPath` to `newPath`, unless something is already sitting there — a
 * half-finished earlier attempt must never clobber what it already produced.
 */
async function moveIfFree(oldPath: string, newPath: string) {
    if (oldPath === newPath || fsExistSync(newPath)) {
        return false;
    }
    try {
        await fsMove(oldPath, newPath);
        return true;
    } catch (error) {
        handleError(error);
        return false;
    }
}

/**
 * The directory setting an older version left behind, found by what it POINTS
 * AT rather than by what it is called: the one folder holding files with the
 * old extension. No other subsystem writes that extension, so nothing else can
 * be mistaken for it — and a folder with none of those files has nothing worth
 * migrating anyway.
 */
async function findLegacyDirSetting(): Promise<LegacyDirSettingType | null> {
    const knownSettingNames = Object.values(dirSourceSettingNames);
    const keys = await appLocalStorage.listKeys();
    for (const key of keys) {
        if (
            !key.startsWith(DIR_SETTING_PREFIX) ||
            knownSettingNames.includes(key)
        ) {
            continue;
        }
        const storedDirPath = appLocalStorage.getItem(key);
        if (!storedDirPath || !fsExistSync(storedDirPath)) {
            continue;
        }
        const foundFileList = await fsList(storedDirPath);
        const hasLegacyFile = foundFileList.some(({ name, isFile }) => {
            return isFile && name.endsWith(LEGACY_DOT_EXTENSION);
        });
        if (hasLegacyFile) {
            return {
                token: key.slice(DIR_SETTING_PREFIX.length),
                dirPath: pathResolve(storedDirPath),
            };
        }
    }
    return null;
}

/**
 * Rename the data folder when it still carries the old DEFAULT name — the
 * token the app itself put there, pluralized. A folder the user pointed
 * somewhere themselves is left exactly where it is: its name is theirs.
 */
async function migrateDataDirectory(dirPath: string, token: string) {
    if (pathBasename(dirPath) !== `${token}s`) {
        return dirPath;
    }
    const parentDirPath = pathResolve(pathJoin(dirPath, '..'));
    const newDirPath = pathJoin(
        parentDirPath,
        defaultDataDirNames.PRESENTING_FLOW,
    );
    return (await moveIfFree(dirPath, newDirPath)) ? newDirPath : dirPath;
}

/** `<name>.owp` -> `<name>.owpf`, editing-history folder included. */
async function migrateFileExtensions(dirPath: string) {
    const foundFileList = await fsList(dirPath);
    for (const { name, filePath, isFile } of foundFileList) {
        let newName: string | null = null;
        if (isFile && name.endsWith(LEGACY_DOT_EXTENSION)) {
            newName =
                name.slice(0, -LEGACY_DOT_EXTENSION.length) + DOT_EXTENSION;
        } else if (!isFile && name.endsWith(LEGACY_HISTORY_SUFFIX)) {
            newName =
                name.slice(0, -LEGACY_HISTORY_SUFFIX.length) + HISTORY_SUFFIX;
        }
        if (newName !== null) {
            await moveIfFree(filePath, pathJoin(dirPath, newName));
        }
    }
}

/**
 * A setting is named after the thing it belongs to, so both halves of the key
 * moved: the prefix, and the sanitized file path baked into the rest of it (the
 * folder name and the extension).
 *
 * The folder goes first and by its SANITIZED PATH rather than by the token, so
 * a user-chosen folder that merely happens to contain the old word is not
 * rewritten into a path that does not exist.
 */
function toMigratedSettingKey(
    key: string,
    token: string,
    legacyDirKey: string,
    dirKey: string,
) {
    return key
        .split(legacyDirKey)
        .join(dirKey)
        .split(token)
        .join(NAME)
        .replace(/_owp(?![A-Za-z0-9])/g, '_owpf');
}

async function migrateSettings(
    token: string,
    legacyDirPath: string,
    dirPath: string,
) {
    const legacyDirKey = toFilePathSettingKey(legacyDirPath);
    const dirKey = toFilePathSettingKey(dirPath);
    const keys = await appLocalStorage.listKeys();
    for (const key of keys) {
        if (!key.includes(token)) {
            continue;
        }
        const newKey = toMigratedSettingKey(key, token, legacyDirKey, dirKey);
        if (newKey === key) {
            continue;
        }
        const value = appLocalStorage.getItem(key);
        if (value !== null) {
            appLocalStorage.setItem(newKey, value);
        }
        appLocalStorage.removeItem(key);
    }
}

export default async function migratePresentingFlowRename() {
    const legacyDirSetting = await findLegacyDirSetting();
    if (legacyDirSetting === null) {
        return;
    }
    const { token, dirPath: legacyDirPath } = legacyDirSetting;
    const dirPath = await migrateDataDirectory(legacyDirPath, token);
    await migrateFileExtensions(dirPath);
    await migrateSettings(token, legacyDirPath, dirPath);
    // Last, and unconditionally: `migrateSettings` carried the old value across
    // to the new key, and that value is the path the folder no longer has.
    appLocalStorage.setItem(dirSourceSettingNames.PRESENTING_FLOW, dirPath);
}
