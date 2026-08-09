import { useSyncExternalStore } from 'react';

import { appManagedDataDirNames } from '../helper/constants';
import { handleError } from '../helper/errorHelpers';
import appProvider from '../server/appProvider';
import {
    fsCheckFileExist,
    fsCreateDir,
    fsReadFile,
    fsWriteFile,
    pathJoin,
} from '../server/fileHelpers';
import { unlocking } from '../server/unlockingHelpers';
import { appLocalStorage } from '../setting/directory-setting/appLocalStorage';
import {
    LOOKUP_TEXT_INDEX_VERSION,
    type LookupRecordLabelsType,
    type LookupTextIndexType,
} from './verseTextIndexTypes';

/**
 * Reading and writing the derived lookup files, and holding them in memory only
 * for as long as something is actually looking at one.
 *
 * There are TWO files — the in-text index and its labels sidecar — because they
 * have different audiences: every KJV verse view needs the index, while only the
 * "names & locations in what I am reading" tab needs the labels. Splitting them
 * keeps the label bytes off every reader that never opens that tab.
 *
 * They are still BUILT together. Building is the one moment the app pays for the
 * full ~35MB dataset, so a missing file rebuilds both under a single lock and
 * whichever loader lost the race just re-reads the file the winner wrote.
 */

const INDEX_FILE_NAME = 'verse-text-index.json';
const RECORD_LABELS_FILE_NAME = 'verse-record-labels.json';
const BUILD_LOCK_KEY = 'lookup-verse-text-index';

type FileEnvelopeType<T> = {
    _cachingTime: number;
    // The shipped dataset only ever changes with the app itself, so the app
    // version is what tells a cache built by an earlier install apart.
    _appVersion: string;
    value: T;
};

async function getLookupDataDirPath() {
    const dirPath = pathJoin(
        appLocalStorage.defaultStorage,
        appManagedDataDirNames.LOOKUP_DATA,
    );
    try {
        await fsCreateDir(dirPath);
    } catch (error: any) {
        if (
            error.code !== 'EEXIST' &&
            !error.message?.includes('file already exists')
        ) {
            handleError(error);
            return null;
        }
    }
    return dirPath;
}

async function readCachedFile<T extends { version: number }>(
    filePath: string,
    checkIsValid: (value: T) => boolean,
) {
    if (!(await fsCheckFileExist(filePath))) {
        return null;
    }
    try {
        const jsonText = await fsReadFile(filePath);
        if (jsonText === null) {
            return null;
        }
        const envelope = JSON.parse(jsonText) as FileEnvelopeType<T>;
        if (
            envelope._appVersion !== appProvider.appInfo.version ||
            envelope.value?.version !== LOOKUP_TEXT_INDEX_VERSION ||
            !checkIsValid(envelope.value)
        ) {
            return null;
        }
        return envelope.value;
    } catch (error) {
        handleError(error);
        return null;
    }
}

async function writeCachedFile<T>(filePath: string, value: T) {
    try {
        const envelope: FileEnvelopeType<T> = {
            _cachingTime: Date.now(),
            _appVersion: appProvider.appInfo.version,
            value,
        };
        await fsWriteFile(filePath, JSON.stringify(envelope));
    } catch (error) {
        handleError(error);
    }
}

function checkIsIndexValid(value: LookupTextIndexType) {
    return Array.isArray(value.ids);
}

function checkIsRecordLabelsValid(value: LookupRecordLabelsType) {
    return (
        Array.isArray(value.labels) &&
        value.types?.length === value.labels.length &&
        value.titles?.length === value.labels.length
    );
}

/**
 * Reads one of the two derived files, building BOTH of them if it is missing or
 * was written by an older app version.
 *
 * The re-read inside the lock is what keeps a cold start from paying for the
 * dataset twice: the index and the labels can be requested at the same moment,
 * and the second one through finds the file already on disk.
 */
async function loadDerivedFile<T extends { version: number }>(
    fileName: string,
    checkIsValid: (value: T) => boolean,
    pickBuilt: (built: {
        index: LookupTextIndexType;
        recordLabels: LookupRecordLabelsType;
    }) => T,
): Promise<T | null> {
    const dirPath = await getLookupDataDirPath();
    if (dirPath === null) {
        return null;
    }
    const filePath = pathJoin(dirPath, fileName);
    const cachedValue = await readCachedFile<T>(filePath, checkIsValid);
    if (cachedValue !== null) {
        return cachedValue;
    }
    return await unlocking(BUILD_LOCK_KEY, async () => {
        const rebuiltValue = await readCachedFile<T>(filePath, checkIsValid);
        if (rebuiltValue !== null) {
            return rebuiltValue;
        }
        // DYNAMIC on purpose: this is the only path that reads the full ~35MB
        // dataset, and it runs at most once per app version.
        const { buildLookupTextIndex } =
            await import('./verseTextIndexBuilder');
        const built = await buildLookupTextIndex();
        if (built === null) {
            return null;
        }
        // Written together so the two can never drift apart in a way the
        // consumers would have to reconcile.
        await writeCachedFile(pathJoin(dirPath, INDEX_FILE_NAME), built.index);
        await writeCachedFile(
            pathJoin(dirPath, RECORD_LABELS_FILE_NAME),
            built.recordLabels,
        );
        return pickBuilt(built);
    });
}

export async function loadLookupTextIndexFile() {
    return await loadDerivedFile<LookupTextIndexType>(
        INDEX_FILE_NAME,
        checkIsIndexValid,
        (built) => built.index,
    );
}

export async function loadLookupRecordLabelsFile() {
    return await loadDerivedFile<LookupRecordLabelsType>(
        RECORD_LABELS_FILE_NAME,
        checkIsRecordLabelsValid,
        (built) => built.recordLabels,
    );
}

/**
 * A subscriber-counted store around one of the loaders.
 *
 * The value is dropped as soon as the last consumer unsubscribes rather than
 * parked in a cache: re-reading a local file is far cheaper than holding it
 * resident for a view the user has navigated away from.
 */
export function genLookupFileStore<T>(load: () => Promise<T | null>) {
    let loadedValue: T | null = null;
    let isLoading = false;
    const listeners = new Set<() => void>();

    const notify = () => {
        for (const listener of listeners) {
            listener();
        }
    };
    const startLoading = () => {
        if (loadedValue !== null || isLoading) {
            return;
        }
        isLoading = true;
        load()
            .then((value) => {
                isLoading = false;
                // Everything may have unmounted while this was in flight; then
                // there is nothing to hold it for and it must not be retained.
                if (listeners.size > 0 && value !== null) {
                    loadedValue = value;
                    notify();
                }
            })
            .catch((error) => {
                isLoading = false;
                handleError(error);
            });
    };
    const subscribe = (listener: () => void) => {
        listeners.add(listener);
        startLoading();
        return () => {
            listeners.delete(listener);
            if (listeners.size === 0) {
                loadedValue = null;
            }
        };
    };
    const getSnapshot = () => {
        return loadedValue;
    };
    // The value, or null while it is still loading. Subscribing is what triggers
    // the single shared load, and unsubscribing the last consumer releases it.
    return function useLookupFileValue() {
        return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    };
}
