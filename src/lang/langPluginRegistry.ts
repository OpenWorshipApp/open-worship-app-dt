import appProvider from '../server/appProvider';
import {
    LANG_PLUGINS_CHANGED_BROADCAST_CHANNEL,
    LANG_PLUGINS_CHANGED_RENDERER_CHANNEL,
    type LangPluginType,
} from '../../electron/langPluginProtocol';
import { setLangFiles } from './langFileStore';
import {
    listSourceLangPlugins,
    loadSourceLangData,
    loadSourceLangFile,
} from './langSourceFiles';

// Which language plugins this window has (2026-11-04: every language but
// English is one -- `electron/langPluginProtocol.ts`). The list comes from
// `appProvider.langUtils`, which asks the main process; a language's CODE is
// loaded only when something asks for that language. Read once per window and
// again when any window says the languages changed (an install, an update, a
// delete, a switch turned in Settings > Languages).
//
// A provider with no `langUtils` (a unit test's) gets the source packages of
// the checkout instead (`langSourceFiles.ts`), which the app build does not
// carry. A leaf beside `langHelpers.ts`: only the provider and the protocol.

let pluginList: LangPluginType[] | null = null;
let loadingPromise: Promise<LangPluginType[]> | null = null;
let isListening = false;
const changeListenerSet = new Set<() => void>();

function getLangUtils() {
    return appProvider.langUtils ?? null;
}

async function fetchLangPlugins(): Promise<LangPluginType[]> {
    const langUtils = getLangUtils();
    if (langUtils === null) {
        return listSourceLangPlugins();
    }
    try {
        const list = await langUtils.getLangPlugins();
        return Array.isArray(list) ? list : [];
    } catch (error) {
        console.error('Failed to read the installed languages:', error);
        return [];
    }
}

async function readLangPluginFile(langCode: string, fileName: string) {
    const langUtils = getLangUtils();
    if (langUtils === null) {
        return loadSourceLangFile(langCode, fileName);
    }
    return langUtils.readLangPluginJson(langCode, fileName);
}

/** The enabled languages' small files, for the code that reads them by code. */
function syncLangFileStore(list: LangPluginType[]) {
    setLangFiles(
        list
            .filter((plugin) => {
                return plugin.isEnabled;
            })
            .map((plugin) => {
                return [
                    plugin.langCode,
                    {
                        ...plugin.inlineFiles,
                        'meta.json': {
                            locale: plugin.locale,
                            order: plugin.order,
                        },
                    },
                ];
            }),
        readLangPluginFile,
    );
}

function listenForChanges() {
    if (isListening) {
        return;
    }
    isListening = true;
    const listenForData = appProvider.messageUtils?.listenForData;
    if (typeof listenForData !== 'function') {
        return;
    }
    listenForData(LANG_PLUGINS_CHANGED_RENDERER_CHANNEL, () => {
        reloadLangPlugins().catch((error) => {
            console.error('Failed to re-read the installed languages:', error);
        });
    });
}

type LangPluginsPrepareType = (list: LangPluginType[]) => Promise<void>;
let prepareListener: LangPluginsPrepareType | null = null;

/**
 * Runs on a list read AGAIN, before this window takes it as its own. A
 * language installed or turned on can be the one the stored locale names:
 * missing at boot, the window read as English and loaded English alone, and
 * taking the list first switched `getCurrentLocale` to a language this window
 * had not loaded -- `tran` threw in dev, in the error handler too, and every
 * open window looped (Khmer installed from Settings, 2026-11-05). The listener
 * must not await `ensureLangPlugins`: it runs inside that very promise.
 */
export function setLangPluginsPrepare(listener: LangPluginsPrepareType) {
    prepareListener = listener;
}

async function prepareLangPlugins(list: LangPluginType[]) {
    // The first read is the boot's, which loads its own language after it.
    if (pluginList === null || prepareListener === null) {
        return;
    }
    try {
        await prepareListener(list);
    } catch (error) {
        console.error('Failed to prepare the installed languages:', error);
    }
}

/** Every installed language plugin, turned on or off; English is not one. */
export function ensureLangPlugins(): Promise<LangPluginType[]> {
    listenForChanges();
    loadingPromise ??= fetchLangPlugins().then(async (list) => {
        await prepareLangPlugins(list);
        pluginList = list;
        syncLangFileStore(list);
        return list;
    });
    return loadingPromise;
}

/** The list once `ensureLangPlugins` has read it, else null. */
export function getLoadedLangPlugins(): LangPluginType[] | null {
    return pluginList;
}

export function getEnabledLangPlugins(): LangPluginType[] {
    return (pluginList ?? []).filter((plugin) => {
        return plugin.isEnabled;
    });
}

export async function reloadLangPlugins() {
    loadingPromise = null;
    const list = await ensureLangPlugins();
    for (const listener of changeListenerSet) {
        listener();
    }
    return list;
}

/** Called after the list was read again; returns the unregister function. */
export function onLangPluginsChanged(listener: () => void) {
    changeListenerSet.add(listener);
    return () => {
        changeListenerSet.delete(listener);
    };
}

/** Tells every window (this one included) to read the languages again. */
export function notifyLangPluginsChanged() {
    appProvider.messageUtils.sendData(LANG_PLUGINS_CHANGED_BROADCAST_CHANNEL);
}

/** One language plugin's `LanguageDataType`, loaded now; null when absent. */
export async function loadLangPluginData(langCode: string) {
    const langUtils = getLangUtils();
    if (langUtils === null) {
        return loadSourceLangData(langCode);
    }
    return langUtils.getLangData(langCode);
}
