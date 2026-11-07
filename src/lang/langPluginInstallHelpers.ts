import {
    messageCallback,
    streamDownloadFile,
} from '../background/downloadHelper';
import { appError as logError } from '../helper/loggerHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../progress-bar/progressBarHelpers';
import { tarExtract } from '../server/appHelpers';
import { appHomeStorage } from '../server/appHomeStorage';
import appProvider from '../server/appProvider';
import {
    ensureDirectory,
    fsCheckFileExist,
    fsCloneFile,
    fsDeleteDir,
    fsDeleteFile,
    fsMove,
    fsReadFile,
    getFileChecksum,
    getTempPath,
    pathBasename,
    pathJoin,
} from '../server/fileHelpers';
import { unlocking } from '../server/unlockingHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import {
    confirmUnverifiedPackFile,
    exportPackFile,
    pickPackFile,
    readPackFileJson,
    toNotInstallablePackMessage,
} from '../helper/packFileHelpers';
import {
    DISABLED_LANG_CODES_SETTING_NAME,
    LANG_PLUGIN_API_VERSION,
    LANG_PLUGIN_ENTRY_FILE_NAME,
    LANG_PLUGIN_META_FILE_NAME,
    checkIsLangVersionNewer,
    parseDisabledLangCodes,
    toLangPluginMeta,
    type LangPluginType,
} from '../../electron/langPluginProtocol';
import {
    DEFAULT_LOCALE,
    getCurrentLocale,
    getLangCode,
    languageNameMap,
    setCurrentLocale,
    tran,
} from './langHelpers';
import { notifyLangPluginsChanged } from './langPluginRegistry';

// Settings > Languages: find a language in the catalog, install it, update it,
// delete it, turn one off (2026-11-04, the user: _as a user I want to be able
// to search and install my language_). Installed languages go into
// `<data folder>/lang/<code>@<version>/` -- the writable one of the two homes
// a plugin has; `electron-build/lang` is the app's own and never written.
// The model is the Extra Binaries pack (`src/helper/extra-bin/`): the catalog
// is a file on the app's site (`<homepage>/lang/info.json`, published by
// `extra-work/s3-push-lang.js`), read only when this tab asks; in dev it is the
// mock `extra-work/lang/info.json` that `extra-work/build-lang-plugins.mjs
// --pack` writes, and "downloading" copies the local pack.
//
// Only the Languages tab imports this module (lazily), so the download, the
// tar and the checksum stay off every other window's graph.

export const LANG_TOAST_TITLE = 'Languages';
const PROGRESS_BAR_EVENT_KEY = 'lang-plugin-install';
const INSTALL_LOCK_KEY = 'lang-plugin-install';
const DEV_CATALOG_DIR_PARTS = ['extra-work', 'lang'] as const;
const CATALOG_MAX_BYTES = 1024 * 1024;

export type LangCatalogEntryType = {
    apiVersion: number;
    langCode: string;
    locale: string;
    name: string;
    nativeName: string;
    description: string;
    version: string;
    minAppVersion?: string;
    fileFullName: string;
    checksum: string;
    size?: number;
    // Where the pack is; written by the publish script. When absent it is
    // `<catalog folder>/<code>/<fileFullName>`.
    url?: string;
};

type LangCatalogType = {
    version: number;
    languages: { [langCode: string]: LangCatalogEntryType[] };
};

function getDevCatalogDirPath() {
    // In dev `app.getAppPath()` is the repo root.
    const appPath = appProvider.messageUtils.sendDataSync(
        'main:app:get-app-path',
    ) as string;
    return pathJoin(appPath, ...DEV_CATALOG_DIR_PARTS);
}

function getCatalogBaseUrl() {
    return `${appProvider.appInfo.homepage}/lang`;
}

async function readCatalog(isQuiet = false): Promise<LangCatalogType | null> {
    if (appProvider.systemUtils.isDev) {
        const dirPath = getDevCatalogDirPath();
        try {
            return JSON.parse(await fsReadFile(pathJoin(dirPath, 'info.json')));
        } catch (_error) {
            if (isQuiet) {
                return null;
            }
            showSimpleToast(
                tran(LANG_TOAST_TITLE),
                `${tran('No local language catalog was built yet')}: ` +
                    'run `node extra-work/build-lang-plugins.mjs --pack` ' +
                    `to create one in "${dirPath}"`,
            );
            return null;
        }
    }
    try {
        const response = await fetch(`${getCatalogBaseUrl()}/info.json`, {
            method: 'GET',
            cache: 'no-cache',
        });
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        const text = await response.text();
        if (text.length > CATALOG_MAX_BYTES) {
            throw new Error('The language catalog is too large.');
        }
        return JSON.parse(text);
    } catch (error) {
        logError('Error fetching the language catalog:', error);
        return null;
    }
}

/**
 * A pack's locale is its own language's: the language part of the tag is its
 * code, and English's table (`data/en/locales.json`), where it has a row,
 * agrees. No row is needed -- a language brings its locale in its own
 * `meta.json`, so a language the table never named is still offered and
 * installed, not silently left out of the catalog's list.
 */
export function checkIsLocaleOfLang(locale: string, langCode: string) {
    if (locale.split('-')[0] !== langCode) {
        return false;
    }
    const knownLangCode = getLangCode(locale as any);
    return knownLangCode === null || knownLangCode === langCode;
}

function checkIsUsableEntry(entry: unknown): entry is LangCatalogEntryType {
    if (entry === null || typeof entry !== 'object') {
        return false;
    }
    const item = entry as Partial<LangCatalogEntryType>;
    return (
        item.apiVersion === LANG_PLUGIN_API_VERSION &&
        typeof item.langCode === 'string' &&
        /^[a-z]{2,3}$/.test(item.langCode) &&
        item.langCode !== 'en' &&
        typeof item.locale === 'string' &&
        checkIsLocaleOfLang(item.locale, item.langCode) &&
        typeof item.version === 'string' &&
        typeof item.fileFullName === 'string' &&
        /^[\w.@-]+\.tar\.gz$/.test(item.fileFullName) &&
        typeof item.checksum === 'string' &&
        (typeof item.minAppVersion !== 'string' ||
            !checkIsLangVersionNewer(
                appProvider.appInfo.version,
                item.minAppVersion,
            ))
    );
}

/**
 * The newest pack of each language this app can load, by name. `null` when
 * the catalog could not be read (offline is not an error: what is installed
 * still shows). `isQuiet` for the launch's look for updates, which nobody
 * asked for and must never pop up dev's "not built yet" toast.
 */
export async function getLangCatalogEntries(
    isQuiet = false,
): Promise<LangCatalogEntryType[] | null> {
    const catalog = await readCatalog(isQuiet);
    if (catalog === null || typeof catalog.languages !== 'object') {
        return null;
    }
    const entryList: LangCatalogEntryType[] = [];
    for (const list of Object.values(catalog.languages ?? {})) {
        if (!Array.isArray(list)) {
            continue;
        }
        const newest = list
            .filter(checkIsUsableEntry)
            .reduce<LangCatalogEntryType | null>((best, entry) => {
                if (best === null) {
                    return entry;
                }
                return checkIsLangVersionNewer(best.version, entry.version)
                    ? entry
                    : best;
            }, null);
        if (newest !== null) {
            entryList.push(newest);
        }
    }
    return entryList.sort((a, b) => {
        return a.name.localeCompare(b.name);
    });
}

function normalizeSearchText(text: string) {
    return text.normalize('NFC').toLocaleLowerCase().trim();
}

/**
 * The entries a search finds: by the language's English name, its own name,
 * its code or its locale -- a person looks for their language in whichever
 * they can type.
 */
export function searchLangCatalog(
    entryList: LangCatalogEntryType[],
    query: string,
) {
    const normalizedQuery = normalizeSearchText(query);
    if (normalizedQuery === '') {
        return entryList;
    }
    return entryList.filter((entry) => {
        return [
            entry.name,
            entry.nativeName,
            entry.langCode,
            entry.locale,
            languageNameMap[entry.langCode] ?? '',
        ].some((text) => {
            return normalizeSearchText(text).includes(normalizedQuery);
        });
    });
}

/** True when the catalog has a newer pack of an installed language. */
export function checkIsLangUpdateAvailable(
    plugin: LangPluginType,
    entry: LangCatalogEntryType | undefined,
) {
    return (
        entry !== undefined &&
        checkIsLangVersionNewer(plugin.version, entry.version)
    );
}

/** The codes of the installed languages the catalog has a newer pack of. */
export function listLangUpdateCodes(
    pluginList: LangPluginType[],
    entryList: LangCatalogEntryType[],
) {
    const entryMap = new Map(
        entryList.map((entry) => {
            return [entry.langCode, entry];
        }),
    );
    return pluginList
        .filter((plugin) => {
            return checkIsLangUpdateAvailable(
                plugin,
                entryMap.get(plugin.langCode),
            );
        })
        .map((plugin) => {
            return plugin.langCode;
        });
}

// -- turning a language on or off ----------------------------------------

export function getDisabledLangCodes() {
    return parseDisabledLangCodes(
        appHomeStorage.getItem(DISABLED_LANG_CODES_SETTING_NAME),
    );
}

function fallBackToEnglishFor(langCode: string) {
    if (getLangCode(getCurrentLocale()) === langCode) {
        setCurrentLocale(DEFAULT_LOCALE);
    }
}

/**
 * Turns a language on or off for this computer. Off, it is no longer offered
 * anywhere, and a window shown in it is shown in English (the stored choice
 * goes back to English too, so turning it on again does not switch to it).
 */
export function setLangPluginEnabled(langCode: string, isEnabled: boolean) {
    const disabledSet = new Set(getDisabledLangCodes());
    if (isEnabled) {
        disabledSet.delete(langCode);
    } else {
        disabledSet.add(langCode);
        fallBackToEnglishFor(langCode);
    }
    if (disabledSet.size === 0) {
        appHomeStorage.removeItem(DISABLED_LANG_CODES_SETTING_NAME);
    } else {
        appHomeStorage.setItem(
            DISABLED_LANG_CODES_SETTING_NAME,
            JSON.stringify([...disabledSet].sort()),
        );
    }
    notifyLangPluginsChanged();
}

// -- installing ------------------------------------------------------------

// A language's own name in a sentence of another language, quoted and kept
// apart (Unicode's first-strong isolate): a right-to-left name otherwise pulls
// the quotes and the version beside it into its own direction.
export function isolateText(text: string) {
    return `"⁨${text}⁩"`;
}

function getLangPluginsDirPath() {
    const dirPath = appProvider.langUtils.getLangPluginsDirPath();
    if (!dirPath) {
        throw new Error('This window cannot install languages.');
    }
    return dirPath;
}

async function downloadPack(entry: LangCatalogEntryType, destFilePath: string) {
    await fsDeleteFile(destFilePath).catch(logError);
    if (appProvider.systemUtils.isDev) {
        // Dev has no published pack to fetch: the mock catalog's own file.
        messageCallback(tran('Copying the locally built pack...'));
        await fsCloneFile(
            pathJoin(getDevCatalogDirPath(), entry.fileFullName),
            destFilePath,
        );
    } else {
        messageCallback(tran('Downloading...'));
        const { initHttpRequest } =
            await import('../helper/bible-helpers/downloadHelpers');
        const url =
            entry.url ??
            `${getCatalogBaseUrl()}/${entry.langCode}/${entry.fileFullName}`;
        const response = await initHttpRequest(new URL(url));
        await streamDownloadFile(destFilePath, response, messageCallback, true);
    }
    // Verified BEFORE it is extracted: a language plugin is code the app runs.
    messageCallback(tran('Verifying...'));
    const checksum = await getFileChecksum(destFilePath, 'sha512');
    if (checksum !== entry.checksum) {
        throw new Error(tran('The downloaded language is damaged.'));
    }
}

async function readExtractedMeta(dirPath: string) {
    try {
        return JSON.parse(
            await fsReadFile(pathJoin(dirPath, LANG_PLUGIN_META_FILE_NAME)),
        );
    } catch (_error) {
        return null;
    }
}

type LangPackTargetType = {
    langCode: string;
    version: string;
    nativeName: string;
};

/**
 * Installs (or updates to) one catalog entry. Serialized: two extractions into
 * the data folder at once would interleave. The new copy goes into a folder of
 * its own and only then replaces the old one, which is deleted as well as it
 * can be -- a file the language is using right now (on Windows) keeps the old
 * folder until the next update, and the newer version wins anyway.
 */
export async function installLangPlugin(
    entry: LangCatalogEntryType,
    installedPlugin: LangPluginType | null,
) {
    return runLangPackInstall(
        entry,
        installedPlugin,
        async (downloadFilePath) => {
            await downloadPack(entry, downloadFilePath);
            return downloadFilePath;
        },
    );
}

/**
 * `prepareArchive` answers the pack to extract: downloaded into the path it
 * is handed, or the file a person picked (extracted where it lies).
 */
function runLangPackInstall(
    target: LangPackTargetType,
    installedPlugin: LangPluginType | null,
    prepareArchive: (downloadFilePath: string) => Promise<string>,
) {
    return unlocking(INSTALL_LOCK_KEY, async () => {
        showProgressBar(PROGRESS_BAR_EVENT_KEY);
        const rootDirPath = getLangPluginsDirPath();
        const downloadFilePath = pathJoin(
            rootDirPath,
            `.download-${target.langCode}-${target.version}.tar.gz`,
        );
        const stagingDirPath = pathJoin(
            rootDirPath,
            `.staging-${target.langCode}-${target.version}`,
        );
        const finalDirPath = pathJoin(
            rootDirPath,
            `${target.langCode}@${target.version}`,
        );
        try {
            await ensureDirectory(rootDirPath);
            const archiveFilePath = await prepareArchive(downloadFilePath);
            messageCallback(tran('Extracting...'));
            await fsDeleteDir(stagingDirPath).catch(logError);
            await ensureDirectory(stagingDirPath);
            await tarExtract(archiveFilePath, stagingDirPath);
            const meta = await readExtractedMeta(stagingDirPath);
            if (
                meta?.langCode !== target.langCode ||
                meta?.apiVersion !== LANG_PLUGIN_API_VERSION ||
                !(await fsCheckFileExist(
                    pathJoin(stagingDirPath, LANG_PLUGIN_ENTRY_FILE_NAME),
                ))
            ) {
                throw new Error(tran('The downloaded language is damaged.'));
            }
            await fsDeleteDir(finalDirPath).catch(logError);
            await fsMove(stagingDirPath, finalDirPath);
            for (const dirPath of installedPlugin?.removableDirPaths ?? []) {
                if (dirPath !== finalDirPath) {
                    await fsDeleteDir(dirPath).catch(logError);
                }
            }
            showSimpleToast(
                tran(LANG_TOAST_TITLE),
                `${tran('Installed')} ${isolateText(target.nativeName)} ` +
                    target.version,
            );
            notifyLangPluginsChanged();
            return true;
        } catch (error) {
            logError(error);
            showSimpleToast(
                tran(LANG_TOAST_TITLE),
                `${tran('Error')}: ${error}`,
            );
            return false;
        } finally {
            await fsDeleteFile(downloadFilePath).catch(() => {});
            await fsDeleteDir(stagingDirPath).catch(() => {});
            hideProgressBar(PROGRESS_BAR_EVENT_KEY);
        }
    });
}

// -- sharing a language as a file -----------------------------------------

/**
 * True when a pack's checksum is one the catalog published for this
 * language, under ANY version: a friend's file may be an older one than the
 * catalog now offers. Offline answers false (the person is asked).
 */
async function checkIsPublishedLangChecksum(
    langCode: string,
    checksum: string,
) {
    const catalog = await readCatalog(true);
    const list = catalog?.languages?.[langCode];
    return (
        Array.isArray(list) &&
        list.some((entry) => {
            return entry?.checksum === checksum;
        })
    );
}

// A version goes into a folder name: dotted numbers and nothing else.
const LANG_PACK_VERSION_PATTERN = /^\d+(?:\.\d+){0,3}$/;

/** A pack's own `meta.json` when this app can load it, otherwise null. */
function toImportableLangMeta(data: unknown) {
    const meta = toLangPluginMeta(data, appProvider.appInfo.version);
    if (
        meta === null ||
        !LANG_PACK_VERSION_PATTERN.test(meta.version) ||
        !checkIsLocaleOfLang(meta.locale, meta.langCode)
    ) {
        return null;
    }
    return meta;
}

/**
 * Installs a language from a file a friend passed on (Settings > Languages >
 * Import), with no network needed. Asked about first when the catalog has no
 * pack with its checksum; refused when the copy that came with the app is as
 * new (that copy would stay the one in use). `filePath` skips the picker.
 */
export async function importLangPluginFromFile(
    installedPluginList: LangPluginType[],
    filePath?: string | null,
) {
    const archiveFilePath = filePath ?? (await pickPackFile());
    if (!archiveFilePath) {
        return false;
    }
    const toastTitle = tran(LANG_TOAST_TITLE);
    const meta = toImportableLangMeta(
        await readPackFileJson(archiveFilePath, LANG_PLUGIN_META_FILE_NAME),
    );
    if (meta === null) {
        showSimpleToast(
            toastTitle,
            toNotInstallablePackMessage(`"${pathBasename(archiveFilePath)}"`),
        );
        return false;
    }
    const installedPlugin =
        installedPluginList.find((plugin) => {
            return plugin.langCode === meta.langCode;
        }) ?? null;
    const builtInVersion = installedPlugin?.builtInVersion ?? null;
    if (
        builtInVersion !== null &&
        !checkIsLangVersionNewer(builtInVersion, meta.version)
    ) {
        showSimpleToast(
            toastTitle,
            toNotInstallablePackMessage(
                `${isolateText(meta.nativeName)} ${meta.version} ` +
                    `(${tran('Built in')}: ${builtInVersion})`,
            ),
        );
        return false;
    }
    const checksum = await getFileChecksum(archiveFilePath, 'sha512');
    const isPublished =
        checksum !== null &&
        (await checkIsPublishedLangChecksum(meta.langCode, checksum));
    if (!isPublished && !(await confirmUnverifiedPackFile())) {
        return false;
    }
    return runLangPackInstall(meta, installedPlugin, async () => {
        return archiveFilePath;
    });
}

/**
 * Downloads a catalog entry's pack into Downloads, checked, without
 * installing it: the file to pass on to a friend whose computer has no
 * internet. Null when it failed (it has said so).
 */
export async function saveLangPackToDownloads(entry: LangCatalogEntryType) {
    return unlocking(INSTALL_LOCK_KEY, async () => {
        showProgressBar(PROGRESS_BAR_EVENT_KEY);
        const downloadFilePath = pathJoin(
            getTempPath(),
            `owa-lang-${entry.langCode}-${entry.version}-${Date.now()}.tar.gz`,
        );
        try {
            await downloadPack(entry, downloadFilePath);
            return await exportPackFile(
                tran(LANG_TOAST_TITLE),
                downloadFilePath,
                entry.fileFullName,
            );
        } catch (error) {
            logError(error);
            showSimpleToast(
                tran(LANG_TOAST_TITLE),
                `${tran('Error')}: ${error}`,
            );
            return null;
        } finally {
            await fsDeleteFile(downloadFilePath).catch(() => {});
            hideProgressBar(PROGRESS_BAR_EVENT_KEY);
        }
    });
}

/**
 * Deletes every installed copy of a language from the data folder. A language
 * that came with the app falls back to that copy; otherwise it is gone, and a
 * window shown in it is shown in English (2026-11-04, the user: _when language
 * plugin is deleted then should fallback to english if the language
 * selected_).
 */
export async function deleteLangPlugin(plugin: LangPluginType) {
    return unlocking(INSTALL_LOCK_KEY, async () => {
        if (plugin.builtInVersion === null) {
            fallBackToEnglishFor(plugin.langCode);
        }
        let isAllDeleted = true;
        for (const dirPath of plugin.removableDirPaths) {
            try {
                await fsDeleteDir(dirPath);
            } catch (error) {
                isAllDeleted = false;
                logError(error);
            }
        }
        notifyLangPluginsChanged();
        showSimpleToast(
            tran(LANG_TOAST_TITLE),
            isAllDeleted
                ? `${tran('Deleted')} ${isolateText(plugin.nativeName)}`
                : tran(
                      'Some files are in use. Close the app, then press it again to finish.',
                  ),
        );
        return isAllDeleted;
    });
}
