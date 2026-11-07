import type { LangPluginType } from '../../electron/langPluginProtocol';
import { toCatalogLanguageWord } from '../../tools/owa-devtools-mcp/bibleXmlAdvice.mjs';
import {
    DEFAULT_LANG_CODE,
    getInstalledLangPlugins,
    languageNameMap,
} from '../lang/langHelpers';
import type { LangCatalogEntryType } from '../lang/langPluginInstallHelpers';
import appProvider from '../server/appProvider';
import {
    findLangCatalogEntry,
    readLangCatalogForBibles,
} from '../setting/bible-setting/bibleLangPackageHelpers';
import {
    findNamedLangCode,
    type LangNameSourceType,
} from './agentLanguageNameHelpers';

// `owa_language` (2026-11-05, the user: _mcp should be able to help install
// language package. chatbot must ask user permission to install any language
// package that related to chatting session_): which languages are installed,
// whether the one a conversation is about is, and installing it from the
// catalog -- the Languages tab's own install (`installLangPlugin`), so its
// download, checksum, progress bar and toast are the same and the other
// windows hear of it the same way.
//
// Reached over the `owa-agent-data` relay (domain `language`), imported
// lazily: the install helpers carry the download and the tar code, which no
// window needs until a language is asked about. The person's press is the
// consent -- the help window's model is never offered this tool, and only
// the window's own buttons call `install` (`langInstallChatHelpers.ts`).

export const AGENT_LANGUAGE_STATES = [
    // English is built into the app: nothing to install.
    'english',
    'installed',
    'turned-off',
    // Not installed, and the catalog has it.
    'missing',
    // A language the catalog has no package of -- or, `isOffline`, a
    // catalog that could not be read.
    'unavailable',
    // The words name no language.
    'unknown',
] as const;

export type AgentLanguageStateType = (typeof AGENT_LANGUAGE_STATES)[number];

type AgentLanguageCheckType = {
    language: string;
    state: AgentLanguageStateType;
    langCode?: string;
    name?: string;
    nativeName?: string;
    version?: string;
    // The pack's download size in bytes, for a missing language.
    size?: number;
    isOffline?: boolean;
};

type LanguageRequestType = {
    action?: unknown;
    language?: unknown;
};

async function readPluginList(): Promise<LangPluginType[]> {
    const langUtils = appProvider.langUtils;
    if (langUtils) {
        try {
            // Asked afresh: an install a moment ago in another window is
            // already in main's list, not yet in this window's.
            const list = await langUtils.getLangPlugins();
            if (Array.isArray(list)) {
                return list;
            }
        } catch (_error) {
            // The loaded list below.
        }
    }
    return getInstalledLangPlugins();
}

function toEnglishSources(): LangNameSourceType[] {
    return Object.entries(languageNameMap).map(([langCode, name]) => {
        return { langCode, names: [name] };
    });
}

function toNamedSources(
    list: { langCode: string; name: string; nativeName: string }[],
): LangNameSourceType[] {
    return list.map((item) => {
        return { langCode: item.langCode, names: [item.name, item.nativeName] };
    });
}

function toEnglishCatalogName(word: string) {
    // The Bible collection's own reading of a word: a country, a language's
    // name for itself.
    return toCatalogLanguageWord(word, false);
}

async function checkLanguage(
    language: string,
    pluginList: LangPluginType[],
): Promise<{
    check: AgentLanguageCheckType;
    entry: LangCatalogEntryType | null;
}> {
    // The names this computer knows first -- English's table and every
    // installed language's own -- so a question about an installed language
    // costs no catalog read.
    let langCode = findNamedLangCode(
        language,
        [...toNamedSources(pluginList), ...toEnglishSources()],
        toEnglishCatalogName,
    );
    let entryList: LangCatalogEntryType[] | null | undefined;
    if (langCode === null) {
        // The name a language gives itself, for one not installed, is only
        // in the catalog.
        entryList = await readLangCatalogForBibles();
        langCode =
            entryList === null
                ? null
                : findNamedLangCode(language, toNamedSources(entryList));
    }
    if (langCode === null) {
        return { check: { language, state: 'unknown' }, entry: null };
    }
    if (langCode === DEFAULT_LANG_CODE) {
        return {
            check: {
                language,
                state: 'english',
                langCode,
                name: 'English',
                nativeName: 'English',
            },
            entry: null,
        };
    }
    const plugin = pluginList.find((item) => {
        return item.langCode === langCode;
    });
    if (plugin !== undefined) {
        return {
            check: {
                language,
                state: plugin.isEnabled ? 'installed' : 'turned-off',
                langCode,
                name: plugin.name,
                nativeName: plugin.nativeName,
                version: plugin.version,
            },
            entry: null,
        };
    }
    entryList ??= await readLangCatalogForBibles();
    let entry =
        entryList === null ? null : findLangCatalogEntry(entryList, langCode);
    if (entry === null && entryList !== null) {
        // The names this computer knows read the words as a NEIGHBOUR the
        // catalog has no package of: let the catalog's own names decide
        // (2026-11-05, the robot run over every app language: "Norwegian
        // Bokmal" written with its own letter was read as Norwegian, `no`,
        // English's table spelling Bokmal plainly, and the catalog's
        // Bokmal package `nb` was answered "unavailable").
        const catalogCode = findNamedLangCode(
            language,
            toNamedSources(entryList),
        );
        const catalogEntry =
            catalogCode === null
                ? null
                : findLangCatalogEntry(entryList, catalogCode);
        if (catalogEntry !== null) {
            langCode = catalogEntry.langCode;
            entry = catalogEntry;
        }
    }
    if (entry === null) {
        const name = languageNameMap[langCode] ?? langCode;
        return {
            check: {
                language,
                state: 'unavailable',
                langCode,
                name,
                nativeName: name,
                ...(entryList === null ? { isOffline: true } : {}),
            },
            entry: null,
        };
    }
    return {
        check: {
            language,
            state: 'missing',
            langCode,
            name: entry.name,
            nativeName: entry.nativeName,
            version: entry.version,
            ...(typeof entry.size === 'number' ? { size: entry.size } : {}),
        },
        entry,
    };
}

async function listLanguages() {
    const pluginList = await readPluginList();
    const entryList = await readLangCatalogForBibles();
    const installedCodeSet = new Set(
        pluginList.map((plugin) => {
            return plugin.langCode;
        }),
    );
    return {
        installed: pluginList.map((plugin) => {
            return {
                langCode: plugin.langCode,
                name: plugin.name,
                nativeName: plugin.nativeName,
                version: plugin.version,
                isEnabled: plugin.isEnabled,
            };
        }),
        // Null when the catalog could not be read (offline).
        available:
            entryList === null
                ? null
                : entryList
                      .filter((entry) => {
                          return !installedCodeSet.has(entry.langCode);
                      })
                      .map((entry) => {
                          return {
                              langCode: entry.langCode,
                              name: entry.name,
                              nativeName: entry.nativeName,
                              version: entry.version,
                              ...(typeof entry.size === 'number'
                                  ? { size: entry.size }
                                  : {}),
                          };
                      }),
    };
}

const PROBLEM_MESSAGE_MAP: Partial<Record<AgentLanguageStateType, string>> = {
    unknown:
        'Those words name no language. Ask which language, by its English ' +
        'name or its code.',
    unavailable:
        'The language catalog has no package of that language, or it could ' +
        'not be read. Settings > Languages can also install one from a file.',
};

async function installLanguage(language: string) {
    const pluginList = await readPluginList();
    const { check, entry } = await checkLanguage(language, pluginList);
    if (check.state === 'english' || check.state === 'installed') {
        return { ...check, isAlreadyThere: true };
    }
    const { installLangPlugin, setLangPluginEnabled } =
        await import('../lang/langPluginInstallHelpers');
    if (check.state === 'turned-off' && check.langCode !== undefined) {
        setLangPluginEnabled(check.langCode, true);
        return { ...check, state: 'installed', wasTurnedOn: true };
    }
    if (check.state !== 'missing' || entry === null) {
        return {
            ...check,
            problem: check.state,
            message: PROBLEM_MESSAGE_MAP[check.state] ?? '',
        };
    }
    // Its own toast and progress bar say how it went, in the window the
    // person is looking at; the answer says it to whoever asked.
    const isInstalled = await installLangPlugin(entry, null);
    if (!isInstalled) {
        return {
            ...check,
            problem: 'failed',
            message:
                'The download or the install failed; nothing was changed. ' +
                'The app showed why.',
        };
    }
    return { ...check, state: 'installed', installed: entry.langCode };
}

/** The `language` domain of the `owa-agent-data` relay. */
export async function handleAgentLanguageRequest(request: LanguageRequestType) {
    const action = String(request?.action ?? '');
    const language =
        typeof request?.language === 'string' ? request.language.trim() : '';
    if (action === 'list') {
        return listLanguages();
    }
    if (action !== 'check' && action !== 'install') {
        return {
            isError: true,
            reason: `Unknown action "${action}": use list, check or install.`,
        };
    }
    if (language === '' || language.length > 200) {
        return {
            isError: true,
            reason:
                'Say which language: its English name, its own name, its ' +
                'two-letter code or its locale.',
        };
    }
    if (action === 'install') {
        return installLanguage(language);
    }
    return (await checkLanguage(language, await readPluginList())).check;
}
