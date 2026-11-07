import { ensureLangPlugins } from '../lang/langPluginRegistry';
import {
    getLangCatalogEntries,
    listLangUpdateCodes,
} from '../lang/langPluginInstallHelpers';
import { checkIsVersionOutdated } from '../server/updatingAppHelpers';
import { getInstalledExtraBinVersion } from './extra-bin/extraBinHelpers';
import { getExtraBinEntry } from './extra-bin/extraBinInstallHelpers';
import { reportPackageUpdates } from './packageUpdateHelpers';

// The launch's one look for updates to what is installed (2026-11-04, the
// user: _as a user I want the app check for installed packages (languages,
// extra-bin) for available update at launch so I can know_). Imported only
// when it runs (`packageUpdateHelpers.ts`): the catalog read, the download
// helpers and the version math stay off every window's start-up.
//
// Each half asks the network only when something is installed to compare --
// most computers have no language but English and never install the media
// tools -- and nothing read here is kept: main keeps the codes, a few bytes.

/** Null when it could not be told (offline, no catalog). */
async function readLangUpdateCodes() {
    const pluginList = await ensureLangPlugins();
    if (pluginList.length === 0) {
        return [];
    }
    const entryList = await getLangCatalogEntries(true);
    if (entryList === null) {
        return null;
    }
    return listLangUpdateCodes(pluginList, entryList);
}

/** Null when it could not be told; a pack not installed has no update. */
async function readIsExtraBinOutdated() {
    const installedVersion = await getInstalledExtraBinVersion();
    if (installedVersion === null) {
        return false;
    }
    const entry = await getExtraBinEntry(true);
    if (entry === null) {
        return null;
    }
    return checkIsVersionOutdated(installedVersion, entry.version);
}

/**
 * Looks and tells main. A half that could not be told is left out of the
 * report, which still marks the launch as looked at: a page switch does not
 * ask the network again, and Settings tells main afresh when it reads.
 */
export async function checkPackageUpdates() {
    const [langCodes, isExtraBinOutdated] = await Promise.all([
        readLangUpdateCodes().catch((error) => {
            console.error('Failed to check the languages for updates:', error);
            return null;
        }),
        readIsExtraBinOutdated().catch((error) => {
            console.error('Failed to check the extra binaries:', error);
            return null;
        }),
    ]);
    reportPackageUpdates({
        ...(langCodes === null ? {} : { langCodes }),
        ...(isExtraBinOutdated === null ? {} : { isExtraBinOutdated }),
    });
    return { langCodes, isExtraBinOutdated };
}
