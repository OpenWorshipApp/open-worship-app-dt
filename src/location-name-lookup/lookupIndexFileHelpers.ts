import { useSyncExternalStore } from 'react';

import { appManagedDataDirNames } from '../helper/constants';
import { handleError } from '../helper/errorHelpers';
import appProvider from '../server/appProvider';
import {
    fsCheckFileExist,
    fsCreateDir,
    fsDeleteFile,
    fsReadFile,
    fsWriteFile,
    pathJoin,
} from '../server/fileHelpers';
import { DEFAULT_LANG_CODE, getLangDataByCodeAsync } from '../lang/langHelpers';
import { unlocking } from '../server/unlockingHelpers';
import { appLocalStorage } from '../setting/directory-setting/appLocalStorage';
import {
    LOOKUP_TEXT_INDEX_VERSION,
    type LookupRecordLabelsType,
    type LookupTextIndexType,
} from './verseTextIndexTypes';
import { readJsonFileVersion } from '../lang/lookupDataVersionHelpers';
import {
    getSelectedLookupLangCode,
    subscribeLookupLangCode,
} from './lookupLangHelpers';

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
 *
 * The index is English and unversioned by language — it matches KJV wording, so
 * there is only ever one of it. The labels are what the user reads, so there is
 * one sidecar PER LOOKUP LANGUAGE, each aligned to the same English id list.
 */

const INDEX_FILE_NAME = 'verse-text-index.json';
const BUILD_LOCK_KEY = 'lookup-verse-text-index';

function genRecordLabelsFileName(langCode: string) {
    return `verse-record-labels-${langCode}.json`;
}

// Before the sidecar was one-per-language it had no suffix. Nothing will ever
// read that file again, and it is a quarter of a megabyte in a data folder on
// machines that are usually tight on disk.
const LEGACY_RECORD_LABELS_FILE_NAME = 'verse-record-labels.json';
let isLegacyFileSwept = false;

function sweepLegacyRecordLabelsFile(dirPath: string) {
    if (isLegacyFileSwept) {
        return;
    }
    isLegacyFileSwept = true;
    const filePath = pathJoin(dirPath, LEGACY_RECORD_LABELS_FILE_NAME);
    // Fire and forget: nothing waits on a tidy-up, and a folder that never had
    // the old file is the normal case.
    fsCheckFileExist(filePath)
        .then((isExisting) => {
            return isExisting ? fsDeleteFile(filePath) : undefined;
        })
        .catch(handleError);
}

type FileEnvelopeType<T> = {
    _cachingTime: number;
    // The app version tells a cache built by an earlier install apart.
    _appVersion: string;
    // ...and this tells apart a cache built from an OLDER DATASET within the
    // same install: the two map files carry their own version numbers now, so a
    // corrected name or place must expire the derived files even though the app
    // around them did not change.
    _dataVersion: string;
    value: T;
};

// What a dataset that cannot report a version is stored as. It must round-trip
// equal to itself, so such a package keeps the app-version-only behaviour rather
// than rebuilding the ~34MB dataset on every launch.
const UNKNOWN_DATA_VERSION = '';

const dataVersionPromiseMap = new Map<string, Promise<string>>();

async function readLookupDataVersion(langCode: string) {
    // ONE language package, addressed by code — `getAllLangsAsync` would pull
    // every other language's chunk in for nothing.
    const langData = await getLangDataByCodeAsync(langCode);
    if (langData?.getLookupDataVersion === undefined) {
        return UNKNOWN_DATA_VERSION;
    }
    const dataVersion = await langData.getLookupDataVersion({
        packageDir: langData.packageDir,
        readJsonFileVersion,
    });
    if (dataVersion === null) {
        return UNKNOWN_DATA_VERSION;
    }
    return `${dataVersion.namesMap}-${dataVersion.locationsMap}`;
}

/**
 * Memoized for the session: the shipped files cannot change under a running app,
 * and both derived files ask for this on every load.
 *
 * Per language, because the index is stamped with English's version while a
 * labels sidecar is stamped with the version of the package it was written from
 * — a corrected Khmer name has to expire the Khmer sidecar and nothing else.
 * The map is bounded by the number of shipped languages.
 */
function getLookupDataVersionCached(langCode: string) {
    let dataVersionPromise = dataVersionPromiseMap.get(langCode);
    if (dataVersionPromise === undefined) {
        dataVersionPromise = readLookupDataVersion(langCode).catch((error) => {
            handleError(error);
            return UNKNOWN_DATA_VERSION;
        });
        dataVersionPromiseMap.set(langCode, dataVersionPromise);
    }
    return dataVersionPromise;
}

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
    dataVersion: string,
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
            envelope._dataVersion !== dataVersion ||
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

async function writeCachedFile<T>(
    filePath: string,
    dataVersion: string,
    value: T,
) {
    try {
        const envelope: FileEnvelopeType<T> = {
            _cachingTime: Date.now(),
            _appVersion: appProvider.appInfo.version,
            _dataVersion: dataVersion,
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
 * was written by an older app version or from an older dataset.
 *
 * The re-read inside the lock is what keeps a cold start from paying for the
 * dataset twice: the index and the labels can be requested at the same moment,
 * and the second one through finds the file already on disk.
 *
 * `labelsLangCode` decides which sidecar the build writes, so asking for either
 * file always produces the pair the current selection needs.
 */
async function loadDerivedFile<T extends { version: number }>(
    fileName: string,
    dataVersionLangCode: string,
    labelsLangCode: string,
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
    sweepLegacyRecordLabelsFile(dirPath);
    const filePath = pathJoin(dirPath, fileName);
    const dataVersion = await getLookupDataVersionCached(dataVersionLangCode);
    const cachedValue = await readCachedFile<T>(
        filePath,
        dataVersion,
        checkIsValid,
    );
    if (cachedValue !== null) {
        return cachedValue;
    }
    return await unlocking(BUILD_LOCK_KEY, async () => {
        const rebuiltValue = await readCachedFile<T>(
            filePath,
            dataVersion,
            checkIsValid,
        );
        if (rebuiltValue !== null) {
            return rebuiltValue;
        }
        // DYNAMIC on purpose: this is the only path that reads the full ~35MB
        // dataset, and it runs at most once per app version per dataset version
        // per lookup language.
        const { buildLookupTextIndex } =
            await import('./verseTextIndexBuilder');
        const built = await buildLookupTextIndex(labelsLangCode);
        if (built === null) {
            return null;
        }
        // Each file carries the version of the package it was actually built
        // from: the index is always English, the sidecar is whatever language it
        // was written in.
        const [indexDataVersion, labelsDataVersion] = await Promise.all([
            getLookupDataVersionCached(DEFAULT_LANG_CODE),
            getLookupDataVersionCached(labelsLangCode),
        ]);
        // Written together so the two can never drift apart in a way the
        // consumers would have to reconcile.
        await writeCachedFile(
            pathJoin(dirPath, INDEX_FILE_NAME),
            indexDataVersion,
            built.index,
        );
        await writeCachedFile(
            pathJoin(dirPath, genRecordLabelsFileName(labelsLangCode)),
            labelsDataVersion,
            built.recordLabels,
        );
        return pickBuilt(built);
    });
}

export async function loadLookupTextIndexFile() {
    return await loadDerivedFile<LookupTextIndexType>(
        INDEX_FILE_NAME,
        // The index is built from English and matched against KJV wording, so it
        // is stamped with English's version whatever the user reads records in.
        DEFAULT_LANG_CODE,
        getSelectedLookupLangCode(),
        checkIsIndexValid,
        (built) => built.index,
    );
}

export async function loadLookupRecordLabelsFile() {
    const langCode = getSelectedLookupLangCode();
    return await loadDerivedFile<LookupRecordLabelsType>(
        genRecordLabelsFileName(langCode),
        langCode,
        langCode,
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
 *
 * `isLangDependent` marks a store whose file is one-per-lookup-language, so a
 * language change has to throw the resident copy away and read the other file.
 * The index store is NOT one of those: it is English by construction.
 */
export function genLookupFileStore<T>(
    load: () => Promise<T | null>,
    isLangDependent = false,
) {
    let loadedValue: T | null = null;
    let isLoading = false;
    // Bumped when what is in flight stops being what is wanted, so a read of the
    // previous language's file cannot install itself once it lands.
    let loadGeneration = 0;
    let unsubscribeLangCode: (() => void) | null = null;
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
        const generation = loadGeneration;
        load()
            .then((value) => {
                if (generation !== loadGeneration) {
                    return;
                }
                isLoading = false;
                // Everything may have unmounted while this was in flight; then
                // there is nothing to hold it for and it must not be retained.
                if (listeners.size > 0 && value !== null) {
                    loadedValue = value;
                    notify();
                }
            })
            .catch((error) => {
                if (generation === loadGeneration) {
                    isLoading = false;
                }
                handleError(error);
            });
    };
    const subscribe = (listener: () => void) => {
        listeners.add(listener);
        // Only while something is actually rendering this: a store nobody reads
        // has nothing to invalidate, and the subscription would outlive it.
        if (isLangDependent && unsubscribeLangCode === null) {
            unsubscribeLangCode = subscribeLookupLangCode(() => {
                loadGeneration += 1;
                isLoading = false;
                loadedValue = null;
                // Renders the loading state rather than the previous language's
                // labels while the other file is read.
                notify();
                startLoading();
            });
        }
        startLoading();
        return () => {
            listeners.delete(listener);
            if (listeners.size === 0) {
                loadedValue = null;
                unsubscribeLangCode?.();
                unsubscribeLangCode = null;
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
