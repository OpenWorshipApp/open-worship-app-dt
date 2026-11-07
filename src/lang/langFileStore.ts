import { configureWorldLanguageParts } from '../../tools/owa-devtools-mcp/worldLanguages.mjs';
import enAssistantFile from './data/en/assistant.json';
import enBibleKeyMapFile from './data/en/bibleKeyMap.json';
import enMetaFile from './data/en/meta.json';
import { listSourceLangPlugins, loadSourceLangFile } from './langSourceFiles';

// Every language's SMALL data files -- `assistant.json`, `script.json`,
// `bibleKeyMap.json`, `bibleReference.json`, `appMenus.json`, `meta.json` --
// for code that reads them by language code and must stay free of the app
// (the chatbot's pure helpers run in a plain node test).
//
// English's are part of the app. Every other language is a plugin, and its
// files are put here by `langPluginRegistry.ts` when the window starts --
// the enabled languages only, as the plugin list carries them; a bigger file
// (`questions.json`, `bibleBooks.json`) is loaded when asked for. Under vitest
// the source packages stand in (`langSourceFiles.ts`). A leaf: no app imports.

type LangFilesType = { [fileName: string]: unknown };
type LangFileLoaderType = (
    langCode: string,
    fileName: string,
) => Promise<unknown>;

const DEFAULT_LANG_CODE = 'en';
const ENGLISH_FILES: LangFilesType = {
    'assistant.json': enAssistantFile,
    'bibleKeyMap.json': enBibleKeyMapFile,
    'meta.json': enMetaFile,
};

// English first, then by code -- the order the packages' folders were read
// in when this was a glob, which the chatbot's language guesses tie-break on.
function toOrderedMap(entries: [string, LangFilesType][]) {
    return new Map<string, LangFilesType>([
        [DEFAULT_LANG_CODE, ENGLISH_FILES],
        ...entries
            .filter(([langCode]) => {
                return langCode !== DEFAULT_LANG_CODE;
            })
            .sort(([a], [b]) => {
                return a.localeCompare(b);
            }),
    ]);
}

function toSourceEntries(): [string, LangFilesType][] {
    return listSourceLangPlugins().map((plugin) => {
        return [
            plugin.langCode,
            {
                ...plugin.inlineFiles,
                'meta.json': { locale: plugin.locale, order: plugin.order },
            },
        ];
    });
}

let langFileMap = toOrderedMap(toSourceEntries());
let langFileLoader: LangFileLoaderType = loadSourceLangFile;
// Bumped on every change, so a module that derived something from the files
// (a pattern, a list) knows to derive it again.
let langFilesVersion = 0;
const changeListenerSet = new Set<() => void>();

/**
 * The languages this window has, each with its small files; `loader` fetches
 * a file none of them carries.
 */
export function setLangFiles(
    entries: [langCode: string, files: LangFilesType][],
    loader: LangFileLoaderType,
) {
    langFileMap = toOrderedMap(entries);
    langFileLoader = loader;
    langFilesVersion++;
    for (const listener of changeListenerSet) {
        listener();
    }
}

export function getLangFilesVersion() {
    return langFilesVersion;
}

export function onLangFilesChanged(listener: () => void) {
    changeListenerSet.add(listener);
    return () => {
        changeListenerSet.delete(listener);
    };
}

/** The language codes this window has, English first. */
export function listLangFileCodes(): string[] {
    return [...langFileMap.keys()];
}

/** One language's file, or null when it has none (or is not here). */
export function getLangFile<T>(langCode: string, fileName: string): T | null {
    const data = langFileMap.get(langCode)?.[fileName];
    return data === undefined ? null : (data as T);
}

/** Every language's copy of `fileName`, English first, each language once. */
export function listLangFiles<T>(fileName: string) {
    const list: { langCode: string; file: T }[] = [];
    for (const [langCode, files] of langFileMap) {
        const data = files[fileName];
        if (data !== undefined) {
            list.push({ langCode, file: data as T });
        }
    }
    return list;
}

/**
 * One language's file, read when it is not already here -- `questions.json`,
 * `bibleBooks.json`: one small file of one language, never a whole package.
 */
export async function loadLangFile<T>(
    langCode: string,
    fileName: string,
): Promise<T | null> {
    const data = getLangFile<T>(langCode, fileName);
    if (data !== null) {
        return data;
    }
    if (langCode === DEFAULT_LANG_CODE || !langFileMap.has(langCode)) {
        return null;
    }
    try {
        return ((await langFileLoader(langCode, fileName)) ?? null) as T | null;
    } catch (_error) {
        return null;
    }
}

// What the Bible import knows of a language in its own words is that
// INSTALLED language's `world.json` (an inline file, here from the window's
// start): `bibleXmlAdvice.mjs` reads it through `worldLanguages.mjs`, which
// the renderer bundles as the MCP server runs it.
configureWorldLanguageParts(() => {
    return listLangFiles<unknown>('world.json').map(({ file }) => {
        return file;
    });
});

/**
 * Makes `fileName` present for every language here, for code that reads it
 * synchronously afterwards (the help window's `assistant.json`).
 */
export async function ensureLangFiles(fileName: string) {
    let isChanged = false;
    await Promise.all(
        [...langFileMap].map(async ([langCode, files]) => {
            if (files[fileName] !== undefined) {
                return;
            }
            const data = await loadLangFile(langCode, fileName);
            if (data !== null) {
                files[fileName] = data;
                isChanged = true;
            }
        }),
    );
    if (isChanged) {
        langFilesVersion++;
        for (const listener of changeListenerSet) {
            listener();
        }
    }
}
