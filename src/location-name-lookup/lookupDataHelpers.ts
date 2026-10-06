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
    // `bible-note` renders these records in its OWN surfaces — the mention
    // popup, the hover card, the advanced panel, the lookup list — with the
    // editor's font, which does not cover every script. A package that names a
    // font gets it applied there too; English names none, and then the records
    // keep the app's own font. One object for both managers: nothing mutates it.
    // Optional chaining only to satisfy the compiler: the guard above already
    // threw for a package this could not read the dataset out of.
    const fontFamily = langData?.fontFamily;
    const style = fontFamily === undefined ? undefined : { fontFamily };
    return {
        namesLookupManager: NamesLookupManager.fromRawDataset(
            { [langCode]: lookupData.namesMap },
            langCode,
            style,
        ),
        locationsLookupManager: LocationsLookupManager.fromRawDataset(
            { [langCode]: lookupData.locationsMap },
            langCode,
            style,
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
type LookupHolderType = {
    managers: LookupManagersType | null;
    pending: Promise<LookupManagersType> | null;
    count: number;
};

// Only languages with mounted consumers live here. Different-language details
// can coexist, while every panel of one language shares the same dataset.
const holders = new Map<string, LookupHolderType>();

function dropCachedLanguages() {
    // Mounted details still need their fixed-language managers. Only evict the
    // short reopen cache when the global selection changes.
    globalCacheManager10Seconds.deleteMatchedSync((key) => {
        return key.startsWith(LOOKUP_DATA_CACHE_KEY_PREFIX);
    });
}

// Subscribed at module load, which only happens once something actually uses
// the dataset — i.e. exactly when there is something to throw away. Eviction has
// to be driven by the CHANGE rather than by the next `acquireLookupData`,
// because between the two there may be no consumer left to ask, and the copy
// would sit in the cache regardless.
subscribeLookupLangCode(dropCachedLanguages);

export function acquireLookupData(
    langCode = getSelectedLookupLangCode(),
): Promise<LookupManagersType> {
    let holder = holders.get(langCode);
    if (holder === undefined) {
        holder = { managers: null, pending: null, count: 0 };
        holders.set(langCode, holder);
    }
    const currentHolder = holder;
    currentHolder.count += 1;
    if (currentHolder.managers !== null) {
        return Promise.resolve(currentHolder.managers);
    }
    if (currentHolder.pending === null) {
        currentHolder.pending = getLookupDataCached(langCode)
            .then((data) => {
                currentHolder.pending = null;
                // A released holder cannot reinstall itself after a late load.
                if (currentHolder.count > 0) {
                    currentHolder.managers = data;
                }
                return data;
            })
            .catch((error) => {
                currentHolder.pending = null;
                throw error;
            });
    }
    return currentHolder.pending;
}

export function releaseLookupData(langCode = getSelectedLookupLangCode()) {
    const holder = holders.get(langCode);
    if (holder === undefined) {
        return;
    }
    holder.count = Math.max(0, holder.count - 1);
    if (holder.count === 0) {
        holder.managers = null;
        holders.delete(langCode);
    }
}
