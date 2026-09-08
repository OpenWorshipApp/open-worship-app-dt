// The app's own labels, in the language the user is actually looking at.
//
// The knowledge is written in English, but the buttons it names are not: a
// volunteer running the app in Khmer is told to press **Bible Lookup** and has
// `ស្វែងរកព្រះគម្ពីរ` on screen. Naming the control in a language they cannot
// match to their window is the same as not naming it at all.
//
// So the docs carry a TEMPLATE instead of a label:
//
//     Press **F9** ([en:tran:Clear Bible]) to take the verse off screen.
//
// and this module fills it in with whatever that key reads as in the running
// app's interface language -- `Clear Bible` in English, `លុបព្រះគម្ពីរ` in
// Khmer. One source text, every language, and the doc can never drift from the
// app the way a hand-copied twin does (the manual still said `គ្រប់កណ្ឌគម្ពីរ`
// for **All Books** long after the app started saying `សៀវភៅទាំងអស់`).
//
// The dictionary is the app's OWN `tran()` dictionary, extracted at build time
// so nothing here has to load a TypeScript module -- see
// `extra-work/build-knowledge.mjs`. Keys are matched exactly as `tran()`
// matches them (trimmed, lower-cased) and a key that is missing degrades to the
// English text: unlike the app's `tran`, a document must never blank a page
// because somebody wrote a label that is not in the dictionary yet.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

/** `tran()`'s own key sanitizer -- `sanitizeTranKey` in every language pack. */
function sanitizeTranKey(key) {
    return key.trim().toLowerCase();
}

let sourceDictionariesCache = null;

// A source checkout with no build yet, mirroring `help.mjs`'s manual fallback:
// pull the dictionary straight out of the language pack. The literal is pure
// data -- a flat map of string to string -- so it evaluates on its own, without
// the TypeScript, the font imports or the plugin the module around it needs.
//
// Cached for the life of the process because it only ever runs OUTSIDE the
// app, in a checkout whose files are not changing under it; the packaged app
// takes the branch above and reads a file per call like everything else here.
function readSourceDictionaries() {
    if (sourceDictionariesCache !== null) {
        return sourceDictionariesCache;
    }
    sourceDictionariesCache = {};
    const dataDirPath = path.join(REPO_ROOT, 'src', 'lang', 'data');
    if (!existsSync(dataDirPath)) {
        return sourceDictionariesCache;
    }
    for (const langCode of ['en', 'km']) {
        const filePath = path.join(dataDirPath, langCode, 'index.ts');
        if (!existsSync(filePath)) {
            continue;
        }
        try {
            sourceDictionariesCache[langCode] = extractDictionary(
                readFileSync(filePath, 'utf-8'),
            );
        } catch (_error) {
            sourceDictionariesCache[langCode] = {};
        }
    }
    return sourceDictionariesCache;
}

/**
 * The `const dictionary = { ... }` literal out of a language pack, sanitized
 * into the map `tran()` actually looks in.
 *
 * Brace-matched rather than regex-terminated: the values are Khmer text with
 * every kind of punctuation in them, and the literal runs to 1 200 entries.
 * Exported because `extra-work/build-knowledge.mjs` bakes the result into the
 * shipped bundle with it.
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
    const sanitized = {};
    for (const [key, value] of Object.entries(literal)) {
        if (typeof value === 'string') {
            sanitized[sanitizeTranKey(key)] = value;
        }
    }
    return sanitized;
}

/**
 * A language pack's own `name` / `nativeName`.
 *
 * The picker in Settings lists each language under its OWN name, and so should
 * anything that offers a choice of them, so both are carried.
 */
export function extractLangMeta(source) {
    const read = (field) => {
        const match = new RegExp(`\\n[ \\t]*${field}: '([^']+)'`).exec(source);
        return match === null ? null : match[1];
    };
    return { name: read('name'), nativeName: read('nativeName') };
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

/**
 * `{ languages, dictionaries }` -- the shipped bundle, or the language packs in
 * a source checkout.
 *
 * Read per call, like the knowledge index beside it: this runs inside the app
 * on machines where a resident copy of every translation would be felt, and a
 * question asks for it once, not once per label.
 */
export function loadTranBundle() {
    const filePath = findTranFilePath();
    if (filePath !== null) {
        try {
            const bundle = JSON.parse(readFileSync(filePath, 'utf-8'));
            if (bundle?.dictionaries) {
                return bundle;
            }
        } catch (_error) {
            // Fall through to the source packs.
        }
    }
    const dictionaries = readSourceDictionaries();
    return {
        languages: [
            { code: 'en', name: 'English', nativeName: 'English' },
            { code: 'km', name: 'Khmer', nativeName: 'ខ្មែរ' },
        ].filter((language) => {
            return dictionaries[language.code] !== undefined;
        }),
        dictionaries,
    };
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
