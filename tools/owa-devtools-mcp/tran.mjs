// The app's own labels, in the language the user is actually looking at.
//
// The knowledge is written in English, but the buttons it names are not: a
// volunteer running the app in Khmer is told to press **Bible Lookup** and has
// that button's Khmer words on screen. Naming the control in a language they
// cannot match to their window is the same as not naming it at all.
//
// So the docs carry a TEMPLATE instead of a label:
//
//     Press **F9** ([en:tran:Clear Long Text]) to take the verse off screen.
//
// and this module fills it in with whatever that key reads as in the running
// app's interface language -- `Clear Long Text` in English, the Khmer
// dictionary's words in Khmer. One source text, every language, and the doc
// can never drift from the app the way a hand-copied twin does (the manual
// still gave an old Khmer wording for **All Books** long after the app's own
// dictionary had changed it).
//
// The dictionary is the app's OWN `tran()` dictionary, lifted out of the
// language at build time so nothing here has to load a TypeScript module: an
// installed language plugin's `tran.json` (`extra-work/build-lang-plugins.mjs`),
// read through `langPacks.mjs` -- a language that is not installed has none. Keys are matched exactly as `tran()`
// matches them (trimmed, lower-cased) and a key that is missing degrades to the
// English text: unlike the app's `tran`, a document must never blank a page
// because somebody wrote a label that is not in the dictionary yet.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    extractDictionary,
    findLangPack,
    listLangPacks,
    readLangPackDictionary,
    readLangPackJson,
    readLangPackNames,
    sanitizeTranKey,
} from './langPacks.mjs';

export { extractDictionary };

const HERE = path.dirname(fileURLToPath(import.meta.url));
// tools/owa-devtools-mcp -> repo root
const REPO_ROOT = path.join(HERE, '..', '..');

export const DEFAULT_LANG_CODE = 'en';

// `[<language the key is written in>:<how to resolve it>:<the key>]`.
//
// Only `en:tran:` means anything today; the two leading fields exist so a
// second kind of substitution can be added without every existing document
// becoming ambiguous. A token whose key holds `]` cannot be written -- no app
// label does -- which keeps this a single regex with no escaping rules for a
// documentation author to get wrong.
const TRAN_TOKEN_PATTERN = /\[([a-z]{2}):(tran):([^\]]+)\]/g;

// What a source pack says of itself, kept for the process like its
// dictionary (`langPacks.mjs`): only ever read outside the app.
const sourceLanguageCache = new Map();

function toPackLanguage(pack) {
    const cached = pack.isSource ? sourceLanguageCache.get(pack.dirPath) : null;
    if (cached) {
        return cached;
    }
    const { name, nativeName } = readLangPackNames(pack);
    const language = {
        code: pack.code,
        name,
        nativeName,
        // How a question is asked and answered in it (`assistant.json`): the
        // help search reads a question in that language through these.
        assistant: readLangPackJson(pack, 'assistant.json'),
    };
    if (pack.isSource) {
        sourceLanguageCache.set(pack.dirPath, language);
    }
    return language;
}

// Same two candidates as `help.mjs`: whatever the main process passed in, then
// a local build. Deliberately NOT imported from there -- `help.mjs` resolves
// templates through this module, and a cycle between the two would leave
// whichever loaded second holding an undefined binding.
function findTranFilePath() {
    const candidates = [
        process.env.OWA_KNOWLEDGE_DIR,
        path.join(REPO_ROOT, 'electron-build', 'knowledge'),
    ].filter(Boolean);
    for (const candidate of candidates) {
        const filePath = path.join(candidate, 'tran.json');
        if (existsSync(filePath)) {
            return filePath;
        }
    }
    return null;
}

// English, as the knowledge bundle says it (its assistant facts), or as a
// checkout with no build says it. The bundle is English alone; an entry for
// any other language in an older one is not believed -- that language is
// read from its own folder or not at all.
function readEnglishLanguage() {
    const filePath = findTranFilePath();
    if (filePath !== null) {
        try {
            const english = JSON.parse(
                readFileSync(filePath, 'utf-8'),
            )?.languages?.find((language) => {
                return language?.code === DEFAULT_LANG_CODE;
            });
            if (english !== undefined) {
                return english;
            }
        } catch (_error) {
            // Fall through to the source.
        }
    }
    const assistant = readSourceAssistantFacts(DEFAULT_LANG_CODE);
    return {
        code: DEFAULT_LANG_CODE,
        name: assistant?.name ?? 'English',
        nativeName: assistant?.nativeName ?? 'English',
        assistant,
    };
}

/**
 * `{ languages, dictionaries }` -- English, then every language this server
 * can read (`langPacks.mjs`: in the app, the installed ones).
 *
 * Read per call, like the knowledge index beside it: this runs inside the app
 * on machines where a resident copy of every translation would be felt, and a
 * question asks for it once, not once per label.
 */
export function loadTranBundle() {
    const languages = [readEnglishLanguage()];
    const dictionaries = {};
    for (const pack of listLangPacks()) {
        languages.push(toPackLanguage(pack));
        const dictionary = readLangPackDictionary(pack);
        if (Object.keys(dictionary).length > 0) {
            dictionaries[pack.code] = dictionary;
        }
    }
    return { languages, dictionaries };
}

/**
 * What a language's own `assistant.json` says about asking and answering in
 * it (its script, its words for yes and no, a glossary of question words) --
 * English's from `src/lang/data/en/`, which `build-knowledge.mjs` copies into
 * the bundle, any other's from its pack. Null when the language has none.
 */
export function readSourceAssistantFacts(langCode) {
    if (langCode !== DEFAULT_LANG_CODE) {
        return readLangPackJson(findLangPack(langCode), 'assistant.json');
    }
    const filePath = path.join(
        REPO_ROOT,
        'src',
        'lang',
        'data',
        langCode,
        'assistant.json',
    );
    if (!existsSync(filePath)) {
        return null;
    }
    try {
        return JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch (_error) {
        return null;
    }
}

/** One language's assistant facts out of a bundle, or null. */
export function getLanguageFacts(langCode, bundle = null) {
    const code = String(langCode ?? '').split('-')[0];
    const languages = (bundle ?? loadTranBundle()).languages ?? [];
    return (
        languages.find((language) => {
            return language.code === code;
        })?.assistant ?? null
    );
}

/** The languages the app's interface can actually be shown in. */
export function listTranLanguages() {
    return loadTranBundle().languages ?? [];
}

/**
 * One English label, as it is written on the button in `langCode`.
 *
 * Falls back to the English text -- for the default language, for a language
 * that is not installed, and for a key the dictionary does not carry. The app's
 * own `tran()` throws on that last case in dev, on purpose: every string it
 * renders is guaranteed to be in the dictionary. A document is not, and a
 * missing key here must cost the reader an untranslated word, not the answer.
 */
export function tranText(text, langCode, bundle = null) {
    if (typeof text !== 'string' || !text.trim()) {
        return text;
    }
    if (!langCode || langCode === DEFAULT_LANG_CODE) {
        return text;
    }
    const dictionaries = (bundle ?? loadTranBundle()).dictionaries ?? {};
    const dictionary = dictionaries[langCode] ?? dictionaries[langCode.split('-')[0]];
    if (dictionary === undefined) {
        return text;
    }
    return dictionary[sanitizeTranKey(text)] ?? text;
}

/**
 * Fill every `[en:tran:...]` in a document with the label the user sees.
 *
 * Pass `bundle` when resolving more than one string -- a page of search results
 * is one read, not five.
 */
export function resolveTranTemplates(text, langCode, bundle = null) {
    if (typeof text !== 'string' || !text.includes('[en:tran:')) {
        return text;
    }
    const loaded =
        bundle ?? (langCode && langCode !== DEFAULT_LANG_CODE
            ? loadTranBundle()
            : { dictionaries: {} });
    return text.replace(TRAN_TOKEN_PATTERN, (_match, sourceLang, _kind, key) => {
        // A key written in some other language is not a key this dictionary
        // has; give back what was written rather than an empty gap.
        if (sourceLang !== DEFAULT_LANG_CODE) {
            return key;
        }
        return tranText(key, langCode, loaded);
    });
}

/** Every `[en:tran:...]` key in a document, for the corpus guard. */
export function listTranTemplateKeys(text) {
    const keys = [];
    for (const match of String(text).matchAll(TRAN_TOKEN_PATTERN)) {
        keys.push({ sourceLang: match[1], kind: match[2], key: match[3] });
    }
    return keys;
}
