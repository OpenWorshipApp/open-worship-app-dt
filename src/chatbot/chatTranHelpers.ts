// The help window's own words, in the language the app is shown in -- and
// the AI Chat window's, which shares its tab strip.
//
// `tran` here is the app's own `tran()` once the window's entry has plugged
// it in (`plugChatWindowLanguage` in `chatWindowLanguage.ts`, called by
// `src/chatbot.tsx` and `src/aichat.tsx` after `init` has loaded the
// language) and the English words themselves until then -- so a
// node-environment test stays English and never throws. Importing the app's
// `tran` directly would pull `SettingManager` -> `appLocalStorage` ->
// `fileHelpers` -> `appProvider` into every helper here, which a node test
// cannot load, and would throw in a window that rendered before its language
// arrived.
//
// Named `tran` on purpose: `src/lang/tranKeyCoverage.test.ts` reads every
// call of that name with a literal key in `src/`, so each key here is held to
// having its Khmer (and, through the Khmer file, its French) string like any
// other label.
//
// One rule for what may be translated where. Words CODE reads back -- an
// action's label (`WALKTHROUGH_ACTION_PATTERN`, a typed reply matched to a
// button), a note that marks a thread -- stay English in what is stored and
// are translated where they are DRAWN (`tranLabel`). Words nothing reads back
// are translated when they are written.

import enBibleKeyMap from '../lang/data/en/bibleKeyMap.json';
import frBibleKeyMap from '../lang/data/fr/bibleKeyMap.json';
import kmBibleKeyMap from '../lang/data/km/bibleKeyMap.json';

let strictTranslate = (text: string): string => text;
let lenientTranslate = (text: string): string => text;

type BibleKeyNameMapType = { [key: string]: string };

// A Bible's short names AS THE BIBLE'S OWN LANGUAGE KNOWS THEM -- the JSON
// each language pack's `getBibleKeyNameMap()` returns (`KJV` -> `King James
// Version`, `ពគប` -> `ព្រះគម្ពីរបរិសុទ្ធ ១៩៥៤`). The import chooses the
// Bible's language, which is often not the window's, so these are read here
// by language code: loading a whole pack (dictionary, fonts, lookup data)
// for one small map would cost a low-spec machine its memory. A language
// with no entry -- Thai today -- has no list, and Step 1 falls back to the
// file's own names.
const BIBLE_KEY_NAME_MAP_BY_LANG_CODE: {
    [langCode: string]: BibleKeyNameMapType;
} = {
    en: enBibleKeyMap,
    fr: frBibleKeyMap,
    km: kmBibleKeyMap,
};

/** The names that language knows, or null when the app holds none for it. */
function readBibleKeyNameMap(locale: string | null | undefined) {
    const langCode = locale?.split('-')[0]?.toLowerCase() ?? '';
    return BIBLE_KEY_NAME_MAP_BY_LANG_CODE[langCode] ?? null;
}

/**
 * Plug the app's translators in. `strict` is the app's `tran()`, which throws
 * in dev on a key no dictionary has -- a missing Khmer string is found at once
 * -- and `lenient` answers a word that may or may not be a key (an action
 * label a model wrote, a window's name) with its translation or itself.
 */
export function setChatTranslator(
    strict: (text: string) => string,
    lenient: (text: string) => string,
) {
    strictTranslate = strict;
    lenientTranslate = lenient;
}

/**
 * Every short name ONE LANGUAGE knows a Bible by, in the order its data
 * lists them (`KJV`, `NKJV` …; `ពគប`, `គខប` …), for the language the Bible
 * being imported is IN. These are the options Step 1 offers: the app's own
 * names for the translations those readers use, rather than the invented
 * ones a downloaded file carries. Empty when the app holds no names for that
 * language (`th-TH` today) -- the caller then falls back to the file's own.
 */
export function getChatBibleKeyList(locale: string | null | undefined) {
    const map = readBibleKeyNameMap(locale);
    if (map === null) {
        return [];
    }
    return Object.keys(map).filter((key) => {
        return typeof map[key] === 'string';
    });
}

/**
 * What a short Bible key stands for in that language: `KJV` ->
 * `King James Version`, `ពគប` -> `ព្រះគម្ពីរបរិសុទ្ធ ១៩៥៤`. Null for a
 * key the language names nowhere -- an imported file's own short name, which
 * means nothing outside that file.
 *
 * A Latin key is matched whatever its case (a file writes `kjv` where the
 * app writes `KJV`); the language's own keys are matched as they stand.
 */
export function getChatBibleKeyName(
    key: string,
    locale: string | null | undefined,
): string | null {
    const map = readBibleKeyNameMap(locale);
    if (map === null) {
        return null;
    }
    const own = map[key];
    if (typeof own === 'string' && own !== '') {
        return own;
    }
    const upper = key.toUpperCase();
    for (const [knownKey, name] of Object.entries(map)) {
        if (
            knownKey.toUpperCase() === upper &&
            typeof name === 'string' &&
            name !== ''
        ) {
            return name;
        }
    }
    return null;
}

// The words of a Bible's name and nothing else: case, punctuation and the
// runs of spaces a title may put round a name in brackets do not decide a
// match. Padded, so a name must be a WHOLE phrase of the title.
function normalizeBibleName(text: string) {
    const words = text
        .toLowerCase()
        .replace(/[.,()[\]{}:;'"«»“”‘’—–-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return ` ${words} `;
}

/**
 * The key this language knows a Bible by, matched on the NAME its edition
 * carries: `Khmer 2012 (Khmer Christian Bible)` is this app's `KCB`, and
 * `Khmer 2023 (ព្រះគម្ពីរខ្មែរសាកល)` its `GKHB`. Null for an edition no
 * language pack names -- most files of the free collection -- because a
 * guessed name is worse than none.
 *
 * A name must be a whole phrase of the TITLE -- a file whose title is just
 * the name fits too -- and the longest that fits wins, so `New King James
 * Version` is not read as the KJV. Names shorter than five characters are
 * never matched: they are initials, and initials occur by accident. A title
 * shorter than the name is never a match: `Khmer` alone would claim every
 * named Khmer edition.
 */
export function findChatBibleKeyByName(
    title: string,
    locale: string | null | undefined,
): string | null {
    const map = readBibleKeyNameMap(locale);
    if (map === null || title.trim() === '') {
        return null;
    }
    const shownTitle = normalizeBibleName(title);
    let best: { key: string; length: number } | null = null;
    for (const [key, name] of Object.entries(map)) {
        if (typeof name !== 'string') {
            continue;
        }
        const shownName = normalizeBibleName(name);
        if (shownName.trim().length < 5) {
            continue;
        }
        if (!shownTitle.includes(shownName)) {
            continue;
        }
        if (best === null || shownName.length > best.length) {
            best = { key, length: shownName.length };
        }
    }
    return best?.key ?? null;
}

/** A label of this window, by its English words (a dictionary key). */
export function tran(text: string): string {
    return strictTranslate(text);
}

/**
 * Words that may be a label of the app or may not -- an action's label, a
 * pressed reply, a window's name: the translation when the dictionary has
 * one, the words as they are when it does not. Never throws.
 */
export function tranLabel(text: string): string {
    return lenientTranslate(text);
}

/**
 * A translated sentence with its gaps filled: `{words}` in the key is
 * replaced by `values.words`. The KEY keeps the gap, so one key serves every
 * value and a translation may put it wherever its own grammar wants it.
 */
export function fillWords(
    text: string,
    values: Record<string, string | number>,
): string {
    return text.replace(/\{(\w+)\}/g, (match, name: string) => {
        const value = values[name];
        return value === undefined ? match : String(value);
    });
}
