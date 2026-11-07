// What the main process, the preload and the renderer agree on about a
// LANGUAGE PLUGIN (2026-11-04: every language but English is one). A plugin is
// a folder, the same format in both of its homes:
//
// - `electron-build/lang/<folder>/` -- shipped with the app, READ-ONLY;
// - `<data folder>/lang/<folder>/` -- installed from the catalog (Settings >
//   Languages), writable: updated and deleted there.
//
// Built by `extra-work/build-lang-plugins.mjs`, which documents the folder
// itself. Pure: no Node, no Electron, so `src/` imports it as it does the other
// `*Protocol.ts` files.

// The factory contract `build-lang-plugins.mjs` builds for. A plugin built for
// another one is not loaded (an older app would not know what it calls).
export const LANG_PLUGIN_API_VERSION = 1;

export const LANG_PLUGINS_CHANNEL = 'main:app:lang-plugins';
export const LANG_PLUGINS_DIR_CHANNEL = 'main:app:lang-plugins-dir';
export const LANG_PLUGINS_CHANGED_BROADCAST_CHANNEL =
    'all:app:lang-plugins-changed';
export const LANG_PLUGINS_CHANGED_RENDERER_CHANNEL =
    'main:app:lang-plugins-changed';

// This computer's: which installed languages are turned off (JSON list of
// codes). Unset means every installed language is on.
export const DISABLED_LANG_CODES_SETTING_NAME = 'disabled-lang-codes';

export const LANG_PLUGINS_DIR_NAME = 'lang';
export const LANG_PLUGIN_META_FILE_NAME = 'meta.json';
export const LANG_PLUGIN_ENTRY_FILE_NAME = 'index.js';
// Where a page fetches a plugin's assets: `owa://local/@lang/<code>/<path>`
// (and `/@lang/<code>/<path>` on the Screen Mirror server).
export const LANG_PLUGIN_ROUTE_SEGMENT = '@lang';
// Small enough to ride along with the plugin list, so the code that reads them
// at module scope stays synchronous once the list is in (well under 1 KB each).
export const LANG_PLUGIN_INLINE_FILE_NAMES = [
    'appMenus.json',
    'bibleKeyMap.json',
    'bibleReference.json',
    'script.json',
    // What the Bible import, in any window, knows of the language in its own
    // words (`tools/owa-devtools-mcp/worldLanguages.mjs`): a few hundred bytes.
    'world.json',
] as const;

export type LangPluginMetaType = {
    apiVersion: number;
    langCode: string;
    locale: string;
    name: string;
    nativeName: string;
    version: string;
    description: string;
    order?: number;
    // Written right to left (the language's `meta.json`); absent: left to right.
    direction?: 'rtl';
    minAppVersion?: string;
};

export type LangPluginType = LangPluginMetaType & {
    // Not turned off in Settings > Languages.
    isEnabled: boolean;
    // The copy in use came with the app (`electron-build/lang`).
    isBuiltIn: boolean;
    // The copy in use was installed (`<data folder>/lang`): it can be updated
    // and deleted. Deleting it falls back to `builtInVersion`, if any.
    isRemovable: boolean;
    builtInVersion: string | null;
    dirPath: string;
    // Every installed copy of this language in the data folder, the one in use
    // included -- what Delete removes.
    removableDirPaths: string[];
    // `LANG_PLUGIN_INLINE_FILE_NAMES` the plugin has, parsed.
    inlineFiles: { [fileName: string]: unknown };
};

/** True when `latest` is a higher dotted version than `current`. */
export function checkIsLangVersionNewer(current: string, latest: string) {
    const currentParts = `${current}`.split('.').map(Number);
    const latestParts = `${latest}`.split('.').map(Number);
    for (
        let i = 0;
        i < Math.max(currentParts.length, latestParts.length);
        i++
    ) {
        const currentPart = currentParts[i] || 0;
        const latestPart = latestParts[i] || 0;
        if (currentPart !== latestPart) {
            return currentPart < latestPart;
        }
    }
    return false;
}

const LANG_CODE_PATTERN = /^[a-z]{2,3}$/;

/**
 * A `meta.json` this app can load, or null. English is built into the app and
 * can never be replaced by a plugin.
 */
export function toLangPluginMeta(
    data: unknown,
    appVersion: string,
): LangPluginMetaType | null {
    if (data === null || typeof data !== 'object') {
        return null;
    }
    const meta = data as Partial<LangPluginMetaType>;
    if (
        meta.apiVersion !== LANG_PLUGIN_API_VERSION ||
        typeof meta.langCode !== 'string' ||
        !LANG_CODE_PATTERN.test(meta.langCode) ||
        meta.langCode === 'en' ||
        typeof meta.locale !== 'string' ||
        typeof meta.version !== 'string' ||
        meta.version === ''
    ) {
        return null;
    }
    if (
        typeof meta.minAppVersion === 'string' &&
        checkIsLangVersionNewer(appVersion, meta.minAppVersion)
    ) {
        return null;
    }
    return {
        apiVersion: meta.apiVersion,
        langCode: meta.langCode,
        locale: meta.locale,
        name: typeof meta.name === 'string' ? meta.name : meta.langCode,
        nativeName:
            typeof meta.nativeName === 'string'
                ? meta.nativeName
                : (meta.name ?? meta.langCode),
        version: meta.version,
        description:
            typeof meta.description === 'string' ? meta.description : '',
        order: Number.isFinite(meta.order) ? meta.order : undefined,
        direction: meta.direction === 'rtl' ? 'rtl' : undefined,
        minAppVersion:
            typeof meta.minAppVersion === 'string'
                ? meta.minAppVersion
                : undefined,
    };
}

/** The codes turned off, from the setting's JSON text; junk reads as none. */
export function parseDisabledLangCodes(text: unknown): string[] {
    if (typeof text !== 'string' || text === '') {
        return [];
    }
    try {
        const list = JSON.parse(text);
        return Array.isArray(list)
            ? list.filter((code): code is string => {
                  return typeof code === 'string';
              })
            : [];
    } catch (_error) {
        return [];
    }
}

/** `<base>/@lang/<code>/`, the folder a plugin's assets are served from. */
export function toLangPluginBaseUrl(origin: string, langCode: string) {
    return `${origin}/${LANG_PLUGIN_ROUTE_SEGMENT}/${langCode}/`;
}
