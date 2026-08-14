import type { LocationsLookupManager, NamesLookupManager } from 'bible-note';

import type { AnyObjectType } from '../helper/typeHelpers';
import { globalCacheManager10Seconds } from '../others/CacheManager';
import { unlockingCacher } from '../server/unlockingHelpers';
import { DEFAULT_LANG_CODE, getAllLangsAsync } from '../lang/langHelpers';

export type LookupManagersType = {
    namesLookupManager: NamesLookupManager;
    locationsLookupManager: LocationsLookupManager;
};

const LOOKUP_DATA_CACHE_KEY = 'LocationNameLookupData';

async function loadLookupData(): Promise<LookupManagersType> {
    const langDataList = await getAllLangsAsync();
    const namesData: { [key: string]: AnyObjectType } = {};
    const locationsData: { [key: string]: AnyObjectType } = {};
    for (const langData of langDataList) {
        if (langData.getLookupData === undefined) {
            continue;
        }
        const lookupData = await langData.getLookupData('');
        if (lookupData !== null) {
            locationsData[langData.langCode] = lookupData.locationsMap;
            namesData[langData.langCode] = lookupData.namesMap;
        }
    }
    if (namesData[DEFAULT_LANG_CODE] === undefined) {
        throw new Error('Failed to load English lookup data');
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
            namesData,
            DEFAULT_LANG_CODE,
        ),
        locationsLookupManager: LocationsLookupManager.fromRawDataset(
            locationsData,
            DEFAULT_LANG_CODE,
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
 */
export async function getLookupDataCached(): Promise<LookupManagersType> {
    return await unlockingCacher(
        LOOKUP_DATA_CACHE_KEY,
        loadLookupData,
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
let pendingManagers: Promise<LookupManagersType> | null = null;
let holderCount = 0;

export function acquireLookupData(): Promise<LookupManagersType> {
    holderCount += 1;
    if (heldManagers !== null) {
        return Promise.resolve(heldManagers);
    }
    if (pendingManagers === null) {
        pendingManagers = getLookupDataCached()
            .then((data) => {
                pendingManagers = null;
                // Everyone may have unmounted while this was in flight; then
                // there is nothing to hold it for and it must not be retained.
                if (holderCount > 0) {
                    heldManagers = data;
                }
                return data;
            })
            .catch((error) => {
                pendingManagers = null;
                throw error;
            });
    }
    return pendingManagers;
}

export function releaseLookupData() {
    holderCount = Math.max(0, holderCount - 1);
    if (holderCount === 0) {
        heldManagers = null;
    }
}
