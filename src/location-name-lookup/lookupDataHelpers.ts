import type { LocationsLookupManager, NamesLookupManager } from 'bible-note';

import { globalCacheManager10Seconds } from '../others/CacheManager';
import { unlockingCacher } from '../server/unlockingHelpers';
import { getLangDataByCodeAsync } from '../lang/langHelpers';
import { readJsonFile } from '../lang/lookupDataVersionHelpers';
import {
    getSelectedLookupLangCode,
    subscribeLookupLangCode,
} from './lookupLangHelpers';

export type LookupManagersType = {
    namesLookupManager: NamesLookupManager;
    locationsLookupManager: LocationsLookupManager;
};

const LOOKUP_DATA_CACHE_KEY_PREFIX = 'LocationNameLookupData';

function genCacheKey(langCode: string) {
    return `${LOOKUP_DATA_CACHE_KEY_PREFIX}-${langCode}`;
}

/**
 * ONE language's dataset, never every shipped language's.
 *
 * `fromRawDataset` normalizes every entry of the map it is handed, eagerly — so
 * passing it both packages meant reading ~70MB of JSON and materializing two
 * full sets of records to serve one. The manager is rebuilt when the selection
 * changes instead, which costs a load the user asked for rather than a resident
 * copy nobody looks at.
 */
async function loadLookupData(langCode: string): Promise<LookupManagersType> {
    const langData = await getLangDataByCodeAsync(langCode);
    const lookupData =
        langData?.getLookupData === undefined
            ? null
            : await langData.getLookupData({
                  packageDir: langData.packageDir,
                  readJsonFile,
              });
    if (lookupData === null) {
        throw new Error(
            `Failed to load lookup data for language code: ${langCode}`,
        );
    }
    // DYNAMIC on purpose. `bible-note` is a ~46MB package (Lexical, Excalidraw,
    // the whole note editor) and this is the only reason anything outside the
    // note window would touch it. A static import here would put that graph in
    // every window's eager chunk — including the screen output window, which
    // never opens a note. Resolved lazily, it stays an on-demand chunk that only
    // a user who actually opens the lookup panel ever downloads.
    const { NamesLookupManager, LocationsLookupManager } =
        await import('bible-note');
    return {
        namesLookupManager: NamesLookupManager.fromRawDataset(
            { [langCode]: lookupData.namesMap },
            langCode,
        ),
        locationsLookupManager: LocationsLookupManager.fromRawDataset(
            { [langCode]: lookupData.locationsMap },
            langCode,
        ),
    };
}

/**
 * The lookup dataset is ~34MB of JSON that `fromRawDataset` then re-materializes
 * as normalized records, so it must never be loaded speculatively and must not
 * outlive the UI that needs it.
 *
 * `unlockingCacher` serializes concurrent first-opens so that parse can never
 * run twice in parallel, and caches through `globalCacheManager10Seconds`,
 * which expires the entry 10s after the WRITE (not the last read — see the
 * comment on `CacheManager.getSync`). That short window is only a convenience
 * for a close-then-reopen; what actually keeps ONE instance alive for as long
 * as any UI needs it is `acquireLookupData` below, NOT this cache.
 *
 * Keyed by language so a switch can never be served the previous one out of
 * that window.
 */
export async function getLookupDataCached(
    langCode: string = getSelectedLookupLangCode(),
): Promise<LookupManagersType> {
    const cacheKey = genCacheKey(langCode);
    return await unlockingCacher(
        cacheKey,
        () => {
            return loadLookupData(langCode);
        },
        globalCacheManager10Seconds,
    );
}

// A reference count, NOT another cache. The panel and the detail widgets are
// separate React trees with separate lifetimes, and each used to ask for the
// dataset on its own: past the 60s cache window that meant a second ~34MB fetch
// + re-materialization while the first copy was still held, i.e. two full
// copies resident and a multi-second freeze mid-service. Holding the single
// resolved value while ANY consumer is mounted removes both. The value is
// dropped the moment the last one unmounts, so nothing outlives the UI.
let heldManagers: LookupManagersType | null = null;
let heldLangCode: string | null = null;
let pendingManagers: Promise<LookupManagersType> | null = null;
let holderCount = 0;
// Bumped whenever what is in flight stops being what is wanted, so a load that
// was already running cannot install itself as the held value afterwards.
let loadGeneration = 0;

function dropHeldManagers() {
    heldManagers = null;
    heldLangCode = null;
    pendingManagers = null;
    loadGeneration += 1;
}

function dropEveryLanguage() {
    dropHeldManagers();
    // Not just the holder: the 10s window behind it would otherwise keep the
    // previous language's ~34MB resident right while the new one is being
    // built, which is the one moment the app can least afford a second copy.
    globalCacheManager10Seconds.deleteMatchedSync((key) => {
        return key.startsWith(LOOKUP_DATA_CACHE_KEY_PREFIX);
    });
}

// Subscribed at module load, which only happens once something actually uses
// the dataset — i.e. exactly when there is something to throw away. Eviction has
// to be driven by the CHANGE rather than by the next `acquireLookupData`,
// because between the two there may be no consumer left to ask, and the copy
// would sit in the cache regardless.
subscribeLookupLangCode(dropEveryLanguage);

export function acquireLookupData(): Promise<LookupManagersType> {
    const langCode = getSelectedLookupLangCode();
    holderCount += 1;
    // Belt and braces for a selection that changed before this module was even
    // loaded, and therefore before the subscription above existed.
    if (heldLangCode !== null && heldLangCode !== langCode) {
        dropEveryLanguage();
    }
    if (heldManagers !== null) {
        return Promise.resolve(heldManagers);
    }
    if (pendingManagers === null) {
        const generation = loadGeneration;
        heldLangCode = langCode;
        pendingManagers = getLookupDataCached(langCode)
            .then((data) => {
                // Superseded by a language change while this was in flight: the
                // consumers have already asked again for the new one, and this
                // must not overwrite it.
                if (generation !== loadGeneration) {
                    return data;
                }
                pendingManagers = null;
                // Everyone may have unmounted while this was in flight; then
                // there is nothing to hold it for and it must not be retained.
                if (holderCount > 0) {
                    heldManagers = data;
                }
                return data;
            })
            .catch((error) => {
                if (generation === loadGeneration) {
                    pendingManagers = null;
                    heldLangCode = null;
                }
                throw error;
            });
    }
    return pendingManagers;
}

export function releaseLookupData() {
    holderCount = Math.max(0, holderCount - 1);
    if (holderCount === 0) {
        heldManagers = null;
        // Only when nothing is in flight: while a load is still running this
        // names ITS language, and clearing it would hide a language change from
        // the next acquire, which would then join a load for the old one.
        if (pendingManagers === null) {
            heldLangCode = null;
        }
    }
}
