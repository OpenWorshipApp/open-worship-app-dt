// A language's own data, as this server reads it: from that language's own
// folder, never from the app's knowledge bundle, which is English alone
// (2026-11-04, the user: _everything related to a language have to be loaded
// from the language data (from language installation catalog), must not ship
// in the app, except english_).
//
// - The folders of the INSTALLED language plugins that are turned on, in the
//   app being served: the in-app host is handed main's own lister
//   (`startOwaMcpHost({listLangDirs})`), and the stdio door reads them off
//   the instance file of the app it drives (`langDirs`, `bin.mjs`). A
//   language nobody installed has nothing here, and one installed a minute
//   ago is read on the next call.
// - Only where no app says -- a unit test, a script, the stdio door with no
//   app up or one too old to publish its languages -- the checkout's source
//   packages that the assistant is written for: `src/lang/data/online/<code>/`
//   holding an `assistant.json` (today Khmer and French, as before they
//   moved there). Not all fifty: nothing says they are installed, and the
//   destructive-label rule built over every one of them was ~98 KB carried by
//   each press and ~4 s to build (2026-11-04), against ~4 KB and 0.4 s for
//   the two.
//
// A pack folder holds the same files either way: `meta.json`,
// `assistant.json`, `questions.json`, `bibleBooks.json`, `manual/`. The
// dictionary is the plugin's `tran.json` (`build-lang-plugins.mjs` lifts it
// out at build time); in the source it is the language's `dictionary.json`
// (every language is a folder of data, `src/lang/data/online/README.md`).
//
// Read per call, like the knowledge index: a pack is a few small files, and
// a resident copy of every installed translation would be felt on the
// machines this runs on. The source packages are kept for the process, as the
// source dictionaries always were -- they are only read outside the app, in a
// checkout whose files are not changing under it.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// tools/owa-devtools-mcp -> repo root
const REPO_ROOT = path.join(HERE, '..', '..');
export const SOURCE_LANG_PACKS_DIR = path.join(
    REPO_ROOT,
    'src',
    'lang',
    'data',
    'online',
);
export const DEFAULT_LANG_CODE = 'en';
// What `build-lang-plugins.mjs` writes into every plugin for this server.
export const LANG_PACK_TRAN_FILE_NAME = 'tran.json';
const SOURCE_DICTIONARY_FILE_NAME = 'dictionary.json';
const SOURCE_ASSISTANT_FILE_NAME = 'assistant.json';
const LANG_CODE_PATTERN = /^[a-z]{2,3}$/;

let listLangDirs = null;
let sourcePacksCache = null;
const sourceDictionaryCache = new Map();

/**
 * The lister of installed language folders (`null` for none at all). It
 * answers an array -- empty when nothing is installed, which is never a
 * reason to read a checkout's source -- or `null` when it cannot tell, and
 * then the source packages are read.
 */
export function configureLangPacks(lister) {
    listLangDirs = typeof lister === 'function' ? lister : null;
}

/** `tran()`'s own key sanitizer -- `sanitizeTranKey` in every language pack. */
export function sanitizeTranKey(key) {
    return key.trim().toLowerCase();
}

function readJsonFile(filePath) {
    try {
        return JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch (_error) {
        return null;
    }
}

function toSanitizedDictionary(map) {
    const sanitized = {};
    for (const [key, value] of Object.entries(map ?? {})) {
        if (typeof value === 'string') {
            sanitized[sanitizeTranKey(key)] = value;
        }
    }
    return sanitized;
}

/**
 * The `const dictionary = { ... }` literal out of a TypeScript source --
 * English's built-in `src/lang/data/en/index.ts` -- sanitized into the map
 * `tran()` actually looks in. Every other language keeps its labels in a
 * `dictionary.json` (`readSourceDictionary`).
 *
 * Brace-matched rather than regex-terminated: the values are text with every
 * kind of punctuation in them, and the literal runs to thousands of entries.
 */
export function extractDictionary(source) {
    const start = source.indexOf('const dictionary = {');
    if (start === -1) {
        return {};
    }
    const open = source.indexOf('{', start);
    let depth = 0;
    let end = -1;
    for (let index = open; index < source.length; index += 1) {
        const character = source[index];
        if (character === '{') {
            depth += 1;
        } else if (character === '}') {
            depth -= 1;
            if (depth === 0) {
                end = index;
                break;
            }
        }
    }
    if (end === -1) {
        return {};
    }
    // eslint-disable-next-line no-new-func
    const literal = new Function(`return (${source.slice(open, end + 1)});`)();
    return toSanitizedDictionary(literal);
}

/**
 * A SOURCE package's dictionary, its `dictionary.json`, sanitized; `{}` for a
 * folder without one (data waiting for its labels). Exported because
 * `build-lang-plugins.mjs` writes it into each plugin as its `tran.json`.
 */
export function readSourceDictionary(packDir) {
    const jsonFilePath = path.join(packDir, SOURCE_DICTIONARY_FILE_NAME);
    if (!existsSync(jsonFilePath)) {
        return {};
    }
    return toSanitizedDictionary(readJsonFile(jsonFilePath) ?? {});
}

function listSourcePacks() {
    if (sourcePacksCache !== null) {
        return sourcePacksCache;
    }
    sourcePacksCache = [];
    if (!existsSync(SOURCE_LANG_PACKS_DIR)) {
        return sourcePacksCache;
    }
    for (const code of readdirSync(SOURCE_LANG_PACKS_DIR).sort()) {
        const dirPath = path.join(SOURCE_LANG_PACKS_DIR, code);
        if (
            LANG_CODE_PATTERN.test(code) &&
            existsSync(path.join(dirPath, SOURCE_DICTIONARY_FILE_NAME)) &&
            existsSync(path.join(dirPath, SOURCE_ASSISTANT_FILE_NAME))
        ) {
            sourcePacksCache.push({ code, dirPath, isSource: true });
        }
    }
    return sourcePacksCache;
}

function toInstalledPacks(dirPathList) {
    const packList = [];
    for (const dirPath of dirPathList) {
        const code = readJsonFile(path.join(dirPath, 'meta.json'))?.langCode;
        if (
            typeof code === 'string' &&
            LANG_CODE_PATTERN.test(code) &&
            code !== DEFAULT_LANG_CODE &&
            !packList.some((pack) => {
                return pack.code === code;
            })
        ) {
            packList.push({ code, dirPath, isSource: false });
        }
    }
    return packList;
}

/**
 * Every language this server can read besides English:
 * `[{code, dirPath, isSource}]`.
 */
export function listLangPacks() {
    let dirPathList = null;
    if (listLangDirs !== null) {
        try {
            dirPathList = listLangDirs();
        } catch (_error) {
            dirPathList = [];
        }
    }
    return Array.isArray(dirPathList)
        ? toInstalledPacks(dirPathList)
        : listSourcePacks();
}

/** One language's pack (by code, or by a locale), or null when it is not there. */
export function findLangPack(langCode) {
    const code = String(langCode ?? '').split('-')[0];
    if (code === '' || code === DEFAULT_LANG_CODE) {
        return null;
    }
    return (
        listLangPacks().find((pack) => {
            return pack.code === code;
        }) ?? null
    );
}

/** A JSON file of a pack, parsed, or null. */
export function readLangPackJson(pack, fileName) {
    if (pack === null || pack === undefined) {
        return null;
    }
    return readJsonFile(path.join(pack.dirPath, fileName));
}

/** A pack's `tran()` dictionary, sanitized; `{}` when it has none. */
export function readLangPackDictionary(pack) {
    if (pack === null || pack === undefined) {
        return {};
    }
    if (!pack.isSource) {
        return toSanitizedDictionary(
            readLangPackJson(pack, LANG_PACK_TRAN_FILE_NAME),
        );
    }
    let dictionary = sourceDictionaryCache.get(pack.dirPath);
    if (dictionary === undefined) {
        dictionary = readSourceDictionary(pack.dirPath);
        sourceDictionaryCache.set(pack.dirPath, dictionary);
    }
    return dictionary;
}

/** A pack's own `name` / `nativeName` (its `meta.json`). */
export function readLangPackNames(pack) {
    const meta = readLangPackJson(pack, 'meta.json') ?? {};
    return {
        name: typeof meta.name === 'string' ? meta.name : pack.code,
        nativeName:
            typeof meta.nativeName === 'string'
                ? meta.nativeName
                : (meta.name ?? pack.code),
    };
}
