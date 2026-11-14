import fs from 'node:fs';
import path from 'node:path';

import {
    LANG_PLUGIN_ENTRY_FILE_NAME,
    LANG_PLUGIN_INLINE_FILE_NAMES,
    LANG_PLUGIN_META_FILE_NAME,
    LANG_PLUGINS_DIR_NAME,
    checkIsLangVersionNewer,
    toLangPluginMeta,
    type LangPluginMetaType,
    type LangPluginType,
} from './langPluginProtocol';

// The main process FINDS the language plugins (`langPluginProtocol.ts`): one
// scanner for both homes, so `electron-build/lang` and `<data folder>/lang`
// are treated the same way and nothing outside this file knows which is which.
// It only ever reads -- the app never writes into `electron-build/lang`, and
// installing into the data folder is the renderer's (Settings > Languages).

export type LangPluginScanContextType = {
    builtInDirPath: string;
    dataDirPath: string;
    disabledLangCodes: string[];
    appVersion: string;
};

type FoundCopyType = {
    meta: LangPluginMetaType;
    dirPath: string;
    isBuiltIn: boolean;
};

function readJsonFile(filePath: string): unknown {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (_error) {
        return null;
    }
}

/** Every loadable plugin folder directly under `rootDirPath`. */
function listCopies(
    rootDirPath: string,
    isBuiltIn: boolean,
    appVersion: string,
): FoundCopyType[] {
    let entryList: fs.Dirent[];
    try {
        entryList = fs.readdirSync(rootDirPath, { withFileTypes: true });
    } catch (_error) {
        return [];
    }
    const copyList: FoundCopyType[] = [];
    for (const entry of entryList) {
        // A dot-folder is an install in progress (`.staging-*`) or one being
        // taken out: never a language.
        if (!entry.isDirectory() || entry.name.startsWith('.')) {
            continue;
        }
        const dirPath = path.join(rootDirPath, entry.name);
        const meta = toLangPluginMeta(
            readJsonFile(path.join(dirPath, LANG_PLUGIN_META_FILE_NAME)),
            appVersion,
        );
        if (
            meta === null ||
            !fs.existsSync(path.join(dirPath, LANG_PLUGIN_ENTRY_FILE_NAME))
        ) {
            continue;
        }
        copyList.push({ meta, dirPath, isBuiltIn });
    }
    return copyList;
}

function readInlineFiles(dirPath: string) {
    const inlineFiles: { [fileName: string]: unknown } = {};
    for (const fileName of LANG_PLUGIN_INLINE_FILE_NAMES) {
        const data = readJsonFile(path.join(dirPath, fileName));
        if (data !== null) {
            inlineFiles[fileName] = data;
        }
    }
    return inlineFiles;
}

/**
 * One entry per language. The highest version of a language wins wherever it
 * is; on a tie the copy that came with the app does (it cannot be half-written
 * by an interrupted install).
 */
export function scanLangPlugins({
    builtInDirPath,
    dataDirPath,
    disabledLangCodes,
    appVersion,
}: LangPluginScanContextType): LangPluginType[] {
    const copyList = [
        ...listCopies(builtInDirPath, true, appVersion),
        ...listCopies(
            path.join(dataDirPath, LANG_PLUGINS_DIR_NAME),
            false,
            appVersion,
        ),
    ];
    const byLangCode = new Map<string, FoundCopyType[]>();
    for (const copy of copyList) {
        const list = byLangCode.get(copy.meta.langCode) ?? [];
        list.push(copy);
        byLangCode.set(copy.meta.langCode, list);
    }
    const pluginList: LangPluginType[] = [];
    for (const [langCode, list] of byLangCode) {
        const active = list.reduce((best, copy) => {
            if (checkIsLangVersionNewer(best.meta.version, copy.meta.version)) {
                return copy;
            }
            if (
                !checkIsLangVersionNewer(
                    copy.meta.version,
                    best.meta.version,
                ) &&
                copy.isBuiltIn &&
                !best.isBuiltIn
            ) {
                return copy;
            }
            return best;
        });
        const builtIn = list.find((copy) => copy.isBuiltIn) ?? null;
        pluginList.push({
            ...active.meta,
            isEnabled: !disabledLangCodes.includes(langCode),
            isBuiltIn: active.isBuiltIn,
            isRemovable: !active.isBuiltIn,
            builtInVersion: builtIn?.meta.version ?? null,
            dirPath: active.dirPath,
            removableDirPaths: list
                .filter((copy) => !copy.isBuiltIn)
                .map((copy) => copy.dirPath),
            inlineFiles: readInlineFiles(active.dirPath),
        });
    }
    return pluginList.sort((a, b) => {
        return (
            (a.order ?? Number.MAX_SAFE_INTEGER) -
                (b.order ?? Number.MAX_SAFE_INTEGER) ||
            a.langCode.localeCompare(b.langCode)
        );
    });
}

/**
 * `relativePath` inside `dirPath`, or null when it would leave it: what a page
 * asks for under `@lang/<code>/` must never reach the rest of the disk.
 */
export function resolveLangPluginFilePath(
    dirPath: string,
    relativePath: string,
): string | null {
    const rootDirPath = path.resolve(dirPath);
    const filePath = path.resolve(rootDirPath, relativePath);
    if (!filePath.startsWith(rootDirPath + path.sep)) {
        return null;
    }
    try {
        return fs.statSync(filePath).isFile() ? filePath : null;
    } catch (_error) {
        return null;
    }
}

/**
 * `@lang/<code>/<path>` out of a URL path (`/@lang/xx/assets/x.ttf`), or null.
 */
export function parseLangPluginRoute(urlPathname: string) {
    const match = /^\/@lang\/([a-z]{2,3})\/(.+)$/.exec(urlPathname);
    if (match === null) {
        return null;
    }
    try {
        return {
            langCode: match[1],
            relativePath: decodeURIComponent(match[2]),
        };
    } catch (_error) {
        return null;
    }
}

// -- the registry: what every caller in main reads -------------------------

// Short-lived on purpose (CLAUDE.md): a page asks for a plugin's fonts one by
// one, and a scan per request would read the disk for each; a change in
// Settings clears it at once.
const SCAN_CACHE_MS = 10e3;
let getScanContext: (() => LangPluginScanContextType) | null = null;
let cached: { at: number; list: LangPluginType[] } | null = null;

export function configureLangPlugins(
    getContext: () => LangPluginScanContextType,
) {
    getScanContext = getContext;
    cached = null;
}

export function clearLangPluginsCache() {
    cached = null;
}

export function getLangPlugins(): LangPluginType[] {
    if (getScanContext === null) {
        return [];
    }
    const now = Date.now();
    if (cached === null || now - cached.at > SCAN_CACHE_MS) {
        cached = { at: now, list: scanLangPlugins(getScanContext()) };
    }
    return cached.list;
}

export function getLangPluginsDirPath() {
    if (getScanContext === null) {
        return null;
    }
    return path.join(getScanContext().dataDirPath, LANG_PLUGINS_DIR_NAME);
}

/** The file a `@lang/<code>/<path>` request names, or null. */
export function findLangPluginAssetFilePath(urlPathname: string) {
    const route = parseLangPluginRoute(urlPathname);
    if (route === null) {
        return null;
    }
    const plugin = getLangPlugins().find((item) => {
        return item.langCode === route.langCode;
    });
    if (plugin === undefined) {
        return null;
    }
    return resolveLangPluginFilePath(plugin.dirPath, route.relativePath);
}

export function getBuiltInLangPluginsDirPath(appPath: string) {
    // `electron-build/**` is unpacked from the asar (`package.json`
    // `asarUnpack`), so its files are real ones `fs` and `require` can open.
    return path
        .join(appPath, 'electron-build', LANG_PLUGINS_DIR_NAME)
        .replace('app.asar', 'app.asar.unpacked');
}
