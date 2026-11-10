import fs from 'node:fs';
import path from 'node:path';
import { ipcRenderer } from 'electron';

import {
    LANG_PLUGIN_ENTRY_FILE_NAME,
    LANG_PLUGINS_CHANNEL,
    LANG_PLUGINS_DIR_CHANNEL,
    toLangPluginBaseUrl,
    type LangPluginType,
} from '../langPluginProtocol';

// The window's door to the language plugins (`langPluginProtocol.ts`): the
// list comes from the main process, which scans both homes; the code of the
// ONE language a window asks for is loaded here, on that call -- never at
// module load (memory `preload-must-not-eval-at-load`), never a language the
// window does not ask for.
//
// A plugin's `index.js` is a factory (`extra-work/build-lang-plugins.mjs`);
// what it gets is `host`: where its assets are served from and where its files
// are on disk. Assets go through `owa://local/@lang/<code>/`, the app's own
// origin, so a packaged page's CSP admits them.

// `owa://local`, as `fsServe.ts` serves it. Not imported from there: that
// module carries the main process's protocol handler.
const APP_ORIGIN = 'owa://local';
const JSON_FILE_NAME_PATTERN = /^[A-Za-z0-9_-]+\.json$/;

type OpenLyricInternalType = { [name: string]: unknown };
type LoadedType = {
    key: string;
    data: any;
};
// One entry per language, replaced when its copy changes (an update installs
// beside the old one, under another folder).
const loadedMap = new Map<string, LoadedType>();

async function getLangPlugins(): Promise<LangPluginType[]> {
    try {
        const list = await ipcRenderer.invoke(LANG_PLUGINS_CHANNEL);
        return Array.isArray(list) ? list : [];
    } catch (error) {
        console.error('Failed to list the language plugins:', error);
        return [];
    }
}

async function getLangPlugin(langCode: string) {
    const pluginList = await getLangPlugins();
    return (
        pluginList.find((plugin) => {
            return plugin.langCode === langCode;
        }) ?? null
    );
}

/** Where a plugin's assets are fetched from, for its factory and its facts. */
function getLangAssetBaseUrl(langCode: string) {
    return toLangPluginBaseUrl(APP_ORIGIN, langCode);
}

function genHost(plugin: LangPluginType) {
    const baseUrl = getLangAssetBaseUrl(plugin.langCode);
    const openLyricCallbacks: ((m: OpenLyricInternalType) => void)[] = [];
    const host = {
        langCode: plugin.langCode,
        baseUrl,
        dirPath: plugin.dirPath,
        assetUrl(relativePath: string) {
            return new URL(relativePath, baseUrl).href;
        },
        toFilePath(relativePath: string) {
            return path.join(plugin.dirPath, relativePath);
        },
        onOpenLyricInternal(callback: (m: OpenLyricInternalType) => void) {
            openLyricCallbacks.push(callback);
        },
        // Every `new Worker(` of a plugin lands here (the build rewrites it).
        createWorker(url: string | URL, options?: WorkerOptions) {
            return createPluginWorker(plugin, baseUrl, String(url), options);
        },
    };
    return { host, openLyricCallbacks };
}

// One `blob:` copy per worker script, for the life of the window: a script is
// started again for each spellcheck channel, and there are one or two of them.
const workerBlobUrlMap = new Map<string, string>();

/**
 * A worker starts only from the window's own origin -- the same-origin rule,
 * and every page's `worker-src 'self' blob:`. A packaged window is on
 * `owa://local`, like the plugin's assets, and starts it as it is. A window
 * on another origin (dev's `https://localhost:3000`) gets the SAME file, read
 * off the disk, as a `blob:`: a language's song plugin's spellcheck worker was
 * refused there once the plugin left the app's own bundle (2026-11-05). A
 * worker that imports a file next to it would not survive that move; the
 * build of the plugin is where such a one would have to be inlined.
 */
function createPluginWorker(
    plugin: LangPluginType,
    baseUrl: string,
    url: string,
    options?: WorkerOptions,
) {
    // By text: `new URL('owa://...').origin` is "null" wherever the scheme is
    // not registered as standard.
    const pageOrigin = globalThis.location?.origin ?? '';
    const isOwnOrigin = pageOrigin !== '' && url.startsWith(`${pageOrigin}/`);
    if (isOwnOrigin || !url.startsWith(baseUrl)) {
        return new Worker(url, options);
    }
    let blobUrl = workerBlobUrlMap.get(url);
    if (blobUrl === undefined) {
        const relativePath = decodeURIComponent(
            url.slice(baseUrl.length).split(/[?#]/)[0],
        );
        const source = fs.readFileSync(
            path.join(plugin.dirPath, relativePath),
            'utf8',
        );
        blobUrl = URL.createObjectURL(
            new Blob([source], { type: 'text/javascript' }),
        );
        workerBlobUrlMap.set(url, blobUrl);
    }
    return new Worker(blobUrl, options);
}

/**
 * The plugin's Open Lyric half registers into the APP's `open-lyric/internal`
 * (one registry for the editor and every plugin), which the window hands over
 * when it initializes the plugins -- a window with no lyric editor never loads
 * open-lyric for a language's sake.
 */
function bindOpenLyricInternal(
    data: any,
    openLyricCallbacks: ((m: OpenLyricInternalType) => void)[],
) {
    const initOpenLyricPlugins = data.initOpenLyricPlugins;
    if (typeof initOpenLyricPlugins !== 'function') {
        return;
    }
    let boundModule: OpenLyricInternalType | null = null;
    data.initOpenLyricPlugins = (args: any) => {
        const openLyricInternal = args?.openLyricInternal;
        if (openLyricInternal && openLyricInternal !== boundModule) {
            boundModule = openLyricInternal;
            for (const callback of openLyricCallbacks) {
                callback(openLyricInternal);
            }
        }
        if (openLyricCallbacks.length > 0 && boundModule === null) {
            throw new Error(
                `The "${data.langCode}" Open Lyric plugin needs ` +
                    '`openLyricInternal`.',
            );
        }
        return initOpenLyricPlugins(args);
    };
}

async function getLangData(langCode: string) {
    const plugin = await getLangPlugin(langCode);
    if (plugin === null) {
        return null;
    }
    const key = `${plugin.dirPath}@${plugin.version}`;
    const loaded = loadedMap.get(langCode);
    if (loaded?.key === key) {
        return loaded.data;
    }
    const entryFilePath = path.join(
        plugin.dirPath,
        LANG_PLUGIN_ENTRY_FILE_NAME,
    );
    const factory = require(entryFilePath);
    if (typeof factory !== 'function') {
        throw new Error(`"${entryFilePath}" is not a language plugin.`);
    }
    const { host, openLyricCallbacks } = genHost(plugin);
    const data = factory(host);
    if (data === null || typeof data !== 'object') {
        throw new Error(`"${entryFilePath}" returned no language data.`);
    }
    data.packageDir = plugin.dirPath;
    bindOpenLyricInternal(data, openLyricCallbacks);
    loadedMap.set(langCode, { key, data });
    return data;
}

/** One of the plugin's own `*.json` files (`questions.json`, ...), or null. */
async function readLangPluginJson(langCode: string, fileName: string) {
    if (!JSON_FILE_NAME_PATTERN.test(fileName)) {
        return null;
    }
    const plugin = await getLangPlugin(langCode);
    if (plugin === null) {
        return null;
    }
    try {
        const text = await fs.promises.readFile(
            path.join(plugin.dirPath, fileName),
            'utf8',
        );
        return JSON.parse(text);
    } catch (_error) {
        return null;
    }
}

/** `<data folder>/lang`, where installed languages go; null before it is known. */
function getLangPluginsDirPath(): string | null {
    return ipcRenderer.sendSync(LANG_PLUGINS_DIR_CHANNEL) ?? null;
}

const langUtils = {
    getLangPlugins,
    getLangPlugin,
    getLangData,
    readLangPluginJson,
    getLangPluginsDirPath,
    getLangAssetBaseUrl,
};

export default langUtils;
