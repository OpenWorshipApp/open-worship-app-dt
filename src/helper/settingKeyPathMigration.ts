import {
    DATA_DIR_RELATIVE_PATH_TOKEN,
    fsListDirectories,
    getDataDirPath,
    pathSeparator,
    toDataDirRelativePath,
} from '../server/fileHelpers';
import { appLocalStorage } from '../setting/directory-setting/appLocalStorage';
import { dirSourceSettingNames } from './constants';
import { handleError } from './errorHelpers';
import { getSetting, toAbsoluteFilePathSettingKey } from './settingHelpers';

/**
 * ONE-OFF, per data folder: setting names written before 2026-09-19 carry the
 * ABSOLUTE path of the file they belong to
 * (`widget-size-app-document-previewer-C__Users_me_data_documents_song_ows`),
 * which is dead on any other computer or drive letter. They are renamed to the
 * form `toFilePathSettingKey` writes now, relative to the data folder
 * (`…-@data_documents_song_ows`).
 *
 * A name carrying THIS data folder's path is certain. One carrying another
 * computer's is recognised by where its path meets one of this data folder's
 * own top-level folders (`_documents_`, `_lyrics_` …) -- a guess, but what it
 * moves is a panel size or a row's expanded state, and a newer setting of the
 * same name is never overwritten.
 *
 * Loaded through a dynamic `import()` from `init()`, and only while its marker
 * setting is missing, so after the first launch it is never even fetched.
 */

// Where an absolute path starts inside a key: a sanitized `/` (`_Users_…`) or
// drive (`C__Users_…`), at the start or after the `-` that joins key parts.
// A `-` INSIDE a folder name (`open-worship-data`) is followed by a letter.
const PATH_START_REGEX = /(?:^|-)(?=_|[A-Za-z]__)/g;

/**
 * `key` with every absolute path that runs into one of `childKeys` (the data
 * folder's top-level folder names, sanitized) replaced by the relative form.
 */
export function toMigratedSettingKey(
    key: string,
    dataDirKey: string,
    relativeKey: string,
    childKeys: string[],
    // The folders this data folder is set to use OUTSIDE itself (a Documents
    // folder kept elsewhere), sanitized: a file there keeps an absolute key,
    // so its name must not be guessed into the relative form.
    outsideDirKeys: string[] = [],
) {
    let migratedKey = key.split(dataDirKey).join(relativeKey);
    const pathStarts = [...migratedKey.matchAll(PATH_START_REGEX)].map(
        (match) => {
            return match.index + (match[0] === '-' ? 1 : 0);
        },
    );
    // Right to left, so an earlier start's indices stay valid.
    for (const pathStart of pathStarts.reverse()) {
        const rest = migratedKey.slice(pathStart);
        const isOutsideDir = outsideDirKeys.some((outsideDirKey) => {
            return rest.startsWith(`${outsideDirKey}_`);
        });
        if (isOutsideDir) {
            continue;
        }
        let childIndex = -1;
        for (const childKey of childKeys) {
            const index = rest.indexOf(`_${childKey}_`);
            // The nearest child folder: the path's own data folder is the
            // one directly above it.
            if (index > 0 && (childIndex === -1 || index < childIndex)) {
                childIndex = index;
            }
        }
        const nextPathStart = rest.slice(1).search(/-(?=_|[A-Za-z]__)/);
        if (
            childIndex === -1 ||
            (nextPathStart !== -1 && childIndex > nextPathStart + 1)
        ) {
            continue;
        }
        migratedKey =
            migratedKey.slice(0, pathStart) +
            relativeKey +
            rest.slice(childIndex + 1);
    }
    return migratedKey;
}

export default async function migrateSettingKeyPaths() {
    const dataDirPath = getDataDirPath();
    if (dataDirPath === null) {
        return;
    }
    const dataDirKey = toAbsoluteFilePathSettingKey(
        dataDirPath + pathSeparator,
    );
    const relativeKey = toAbsoluteFilePathSettingKey(
        `${DATA_DIR_RELATIVE_PATH_TOKEN}/`,
    );
    const childKeys = (await fsListDirectories(dataDirPath)).map((name) => {
        return toAbsoluteFilePathSettingKey(name);
    });
    const outsideDirKeys = Object.values(dirSourceSettingNames)
        .map((settingName) => {
            return getSetting(settingName) ?? '';
        })
        .filter((dirPath) => {
            return dirPath !== '' && toDataDirRelativePath(dirPath) === dirPath;
        })
        .map((dirPath) => {
            return toAbsoluteFilePathSettingKey(dirPath);
        });
    for (const key of await appLocalStorage.listKeys()) {
        const newKey = toMigratedSettingKey(
            key,
            dataDirKey,
            relativeKey,
            childKeys,
            outsideDirKeys,
        );
        if (newKey === key) {
            continue;
        }
        try {
            const value = appLocalStorage.getItem(key);
            if (value !== null && appLocalStorage.getItem(newKey) === null) {
                appLocalStorage.setItem(newKey, value);
            }
            appLocalStorage.removeItem(key);
        } catch (error) {
            handleError(error);
        }
    }
}
