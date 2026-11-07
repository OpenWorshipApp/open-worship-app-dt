// The language packages a dev script may read, found by their folders, so no
// script names a language: a language is added -- or taken out -- with its
// folder, and every run, check and report follows. English is the default and
// the fallback, the one package built into the app (`src/lang/data/en/`);
// every other language is installed from the catalog and lives one level
// deeper, `src/lang/data/online/<code>/` (2026-11-04, the user: _everything
// related to a language have to be loaded from the language data (from
// language installation catalog), must not ship in the app, except english_).
//
// - `listPackageCodes()`: every language that can be installed -- an
//   `online/<code>/` folder holding a `dictionary.json` (a folder with only
//   its `typed.json` / `world.json` is data waiting for one), English's by its
//   `index.ts` -- in the language picker's order (`meta.json`'s `order`).
// - `toPackageDir(code)`: where that language's folder is.
// - `readAssistantFacts(code)`: the language's `assistant.json` (its script,
//   digits, glossary...), `{}` when it has none.
// - `readRunWords(code)`: what a chatbot run reads off the window in that
//   language (`chatbot-asks/run-words.json`): the regular-expression
//   `patterns` matched beside their English, the `templateFill` examples, the
//   `bookNames` a button may write a verse with.
// - `genRunWordSource(english, key)`: `english` and every language's
//   `patterns[key]` as one alternation, for a `RegExp` or a page script.
// - `findLanguageAskFile(name, lang)`: `chatbot-asks/<name>` of the language
//   asked for -- or, asked for none, of the ONE language that has such a file.
//
// Node only. Read when asked, nothing kept.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    configureWorldLanguageParts,
    readWorldLanguages as readWorldLanguagesIn,
} from '../tools/owa-devtools-mcp/worldLanguages.mjs';

export const REPO_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
);
export const LANG_DATA_DIR = path.join(REPO_ROOT, 'src', 'lang', 'data');
export const DEFAULT_LANG_CODE = 'en';
// Every language but English: installed, never shipped.
export const ONLINE_LANG_DATA_DIR = path.join(LANG_DATA_DIR, 'online');

// What makes an `online/<code>/` folder a language package: its labels.
export const PACKAGE_MARKER_FILE_NAME = 'dictionary.json';

function listCodesIn(rootDir) {
    if (!existsSync(rootDir)) {
        return [];
    }
    return readdirSync(rootDir).filter((code) => {
        return existsSync(path.join(rootDir, code, PACKAGE_MARKER_FILE_NAME));
    });
}

/** A language's source folder: English's at the top, any other's under `online/`. */
export function toPackageDir(code) {
    return code === DEFAULT_LANG_CODE
        ? path.join(LANG_DATA_DIR, code)
        : path.join(ONLINE_LANG_DATA_DIR, code);
}

function readJson(filePath, fallback) {
    try {
        return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (_error) {
        return fallback;
    }
}

function readOrder(code) {
    const order = readJson(path.join(toPackageDir(code), 'meta.json'), {})
        .order;
    return Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
}

/** Every language package, English first, then in the picker's order. */
export function listPackageCodes({ isEnglishIncluded = true } = {}) {
    const codeList = listCodesIn(ONLINE_LANG_DATA_DIR);
    if (
        isEnglishIncluded &&
        existsSync(path.join(toPackageDir(DEFAULT_LANG_CODE), 'index.ts'))
    ) {
        codeList.push(DEFAULT_LANG_CODE);
    }
    return codeList
        .sort((one, other) => {
            if (one === DEFAULT_LANG_CODE || other === DEFAULT_LANG_CODE) {
                return one === DEFAULT_LANG_CODE ? -1 : 1;
            }
            return readOrder(one) - readOrder(other) || one.localeCompare(other);
        });
}

export function readAssistantFacts(code) {
    return readJson(path.join(toPackageDir(code), 'assistant.json'), {});
}

/** A letter of the language's own script (`assistant.json`), or null. */
export function toScriptPattern(code, flags = 'u') {
    const source = readAssistantFacts(code).scriptPattern;
    if (typeof source !== 'string') {
        return null;
    }
    try {
        return new RegExp(source, flags);
    } catch (_error) {
        return null;
    }
}

export function readRunWords(code) {
    return readJson(
        path.join(toPackageDir(code), 'chatbot-asks', 'run-words.json'),
        {},
    );
}

/**
 * `englishSource` and every package's `patterns[key]`, as one alternation:
 * `Allow more|<each language's words for it>`.
 */
export function genRunWordSource(englishSource, key) {
    const sourceList = [englishSource];
    for (const code of listPackageCodes()) {
        const source = readRunWords(code).patterns?.[key];
        if (typeof source === 'string' && source !== '') {
            sourceList.push(source);
        }
    }
    return sourceList.join('|');
}

export function genRunWordPattern(englishSource, key, flags = '') {
    return new RegExp(genRunWordSource(englishSource, key), flags);
}

/** Every package's `bookNames`, a verse's book as a button writes it. */
export function readRunBookNames() {
    return Object.assign(
        {},
        ...listPackageCodes().map((code) => {
            return readRunWords(code).bookNames ?? {};
        }),
    );
}

/**
 * `<the language's folder>/chatbot-asks/<fileName>` -- or, with no `lang`, the
 * one language that has that file. Throws, naming the choices, otherwise.
 */
export function findLanguageAskFile(fileName, lang = null) {
    const toFilePath = (code) => {
        return path.join(toPackageDir(code), 'chatbot-asks', fileName);
    };
    if (typeof lang === 'string' && lang !== '') {
        const filePath = toFilePath(lang);
        if (!existsSync(filePath)) {
            throw new Error(`No ${fileName} in the "${lang}" language package.`);
        }
        return { lang, filePath };
    }
    const codeList = listPackageCodes().filter((code) => {
        return existsSync(toFilePath(code));
    });
    if (codeList.length !== 1) {
        throw new Error(
            codeList.length === 0
                ? `No language package has chatbot-asks/${fileName}.`
                : `Several languages have chatbot-asks/${fileName} ` +
                      `(${codeList.join(', ')}): name one with --lang=<code>.`,
        );
    }
    return { lang: codeList[0], filePath: toFilePath(codeList[0]) };
}

export function readLanguageAsks(fileName, lang = null) {
    const { lang: code, filePath } = findLanguageAskFile(fileName, lang);
    return { lang: code, data: JSON.parse(readFileSync(filePath, 'utf8')) };
}

/**
 * The world's languages, as the tools know them: English's own
 * (`en/world.json`) and every package's own words (its `world.json`), as an
 * app with every language installed would read them. A data-only folder (no
 * `dictionary.json`) cannot be installed, so it is not read.
 */
export function readWorldLanguages() {
    configureWorldLanguageParts(readPackageWorldParts);
    return readWorldLanguagesIn();
}

/** Every package's `world.json`, as an app with every language installed holds them. */
export function readPackageWorldParts() {
    return listPackageCodes({ isEnglishIncluded: false }).map((code) => {
        return readJson(path.join(toPackageDir(code), 'world.json'), null);
    });
}
