import type { LangPluginType } from '../../../electron/langPluginProtocol';
import {
    DEFAULT_LANG_CODE,
    getLangCode,
    type LocaleType,
} from '../../lang/langHelpers';
import type { LangCatalogEntryType } from '../../lang/langPluginInstallHelpers';

// A Bible asks for its language (2026-11-05, the user: _the bible should ask
// for language package installed, e.g. BDS is fr (french) should ask for
// French language package installed to have fully language data_). Only
// English ships; a Bible in any other language gets its book names, digits,
// fonts and search words from that language's plugin, so a row of Settings >
// Bible whose language is missing or turned off says so and offers it.

export type BibleLangPackageStateType =
    // English, a language the world table does not know (nothing to offer),
    // or installed and on.
    | { kind: 'ready' }
    | { kind: 'turned-off'; plugin: LangPluginType }
    | { kind: 'missing'; langCode: string };

export function toBibleLangPackageState(
    locale: LocaleType | undefined,
    pluginList: LangPluginType[],
): BibleLangPackageStateType {
    const langCode = locale ? getLangCode(locale) : null;
    if (langCode === null || langCode === DEFAULT_LANG_CODE) {
        return { kind: 'ready' };
    }
    const plugin = pluginList.find((item) => {
        return item.langCode === langCode;
    });
    if (plugin === undefined) {
        return { kind: 'missing', langCode };
    }
    return plugin.isEnabled
        ? { kind: 'ready' }
        : { kind: 'turned-off', plugin };
}

/**
 * The language's own name, then its English one in brackets, as the
 * Languages tab shows it; the one name when both are the same.
 */
export function toLangPackageLabel(name: string, nativeName: string) {
    return nativeName && nativeName !== name ? `${nativeName} (${name})` : name;
}

// Every row of a missing language asks at the same moment, so the list reads
// the catalog ONCE -- a fetch in a packaged app -- and lets it go soon after.
const CATALOG_KEEP_MILLISECONDS = 30_000;
let catalogPromise: Promise<LangCatalogEntryType[] | null> | null = null;

/**
 * The catalog's languages, or null when it could not be read (offline). The
 * install helpers are imported here, on the first ask: their download, tar
 * and checksum code stays off the Bible tab until a Bible needs it.
 */
export function readLangCatalogForBibles() {
    if (catalogPromise === null) {
        const promise = import('../../lang/langPluginInstallHelpers')
            .then(({ getLangCatalogEntries }) => {
                // Quiet: nobody asked for this read, so dev's "no catalog
                // built yet" toast must not pop up for it.
                return getLangCatalogEntries(true);
            })
            .catch(() => {
                return null;
            });
        catalogPromise = promise;
        setTimeout(() => {
            if (catalogPromise === promise) {
                catalogPromise = null;
            }
        }, CATALOG_KEEP_MILLISECONDS);
    }
    return catalogPromise;
}

export function findLangCatalogEntry(
    entryList: LangCatalogEntryType[],
    langCode: string,
) {
    return (
        entryList.find((entry) => {
            return entry.langCode === langCode;
        }) ?? null
    );
}
