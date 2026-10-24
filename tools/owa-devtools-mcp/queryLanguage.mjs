// A question asked in a language the guide is not written in, read as the
// English words the guide is searched by.
//
// The manual is English, and the help search counts English words in it
// (`help.mjs`). A question typed in Khmer used to be cut into fragments at
// every vowel sign -- `ស្វែងរកព្រះគម្ពីរ` became `["ងរកព", "គម"]`, which no
// page contains -- and came back with nothing. But the app already knows what
// most of its words mean: its own `tran()` dictionary maps every English label
// to the words on the Khmer button. Read backwards, that is a phrase book for
// exactly the vocabulary a question about this app uses ("Bible Lookup",
// "Clear Long Text", "Background"), and a short glossary of question words
// in each language's `assistant.json` (how, where, show, song...) covers the
// rest. A Khmer button name found in a question becomes its English key, which
// is also what the manual writes it as (`[en:tran:Clear Long Text]`).
//
// Khmer is written without spaces between words, so a run of the script is
// read longest phrase first, and a phrase may only end where a letter ends --
// never before a vowel sign or after the subscript mark, or `ខ` (a letter of
// its own) would be found inside `ខ្ញុំ`. Deliberately NOT `Intl.Segmenter`:
// Electron's ICU splits Khmer words differently from Node's (measured: the
// word for "screen" cut in two), and the search runs in both. What matches
// nothing is dropped -- an unmatched Khmer fragment is no evidence about any
// English page, and as a search term it would only pull every page down.
//
// Pure: no `node:fs`. The phrase book is built per call from the dictionary
// the caller already read (the help search reads the bundle once a search);
// nothing is kept between questions.

// A label short enough to be a button's words. Longer values are sentences,
// whose words would be found inside other questions.
const MAX_PHRASE_LENGTH = 40;
const MAX_KEY_WORDS = 4;

const SUBSCRIPT_MARK = '\u17D2';

function toLanguagePattern(facts) {
    try {
        return new RegExp(facts.scriptPattern, 'u');
    } catch (_error) {
        return null;
    }
}

/**
 * The language a question is written in when its SCRIPT says so, with that
 * language's facts -- or null for Latin letters (English and French share
 * them, and the guide reads both), or a script no language claims.
 */
export function findQuestionLanguage(query, languages) {
    for (const language of languages ?? []) {
        const facts = language?.assistant;
        if (!facts?.scriptPattern) {
            continue;
        }
        const pattern = toLanguagePattern(facts);
        if (pattern === null || pattern.test('a')) {
            continue;
        }
        if (pattern.test(String(query ?? ''))) {
            return { code: language.code, facts, pattern };
        }
    }
    return null;
}

/**
 * The phrase book: every short label in the language, mapped to the English
 * words it stands for, plus the language's glossary. A glossary word meaning
 * nothing (`""`) is a word that only holds a question together -- it is
 * consumed, so no label is found inside it, and adds no term.
 */
export function genPhraseTable(dictionary, facts) {
    const table = new Map();
    for (const [key, value] of Object.entries(dictionary ?? {})) {
        if (typeof value !== 'string') {
            continue;
        }
        const phrase = value.trim().toLowerCase();
        if (
            [...phrase].length < 2 ||
            phrase.length > MAX_PHRASE_LENGTH ||
            key.trim().split(/\s+/).length > MAX_KEY_WORDS
        ) {
            continue;
        }
        const meaningList = table.get(phrase) ?? [];
        const english = key.trim().toLowerCase();
        if (!meaningList.includes(english)) {
            meaningList.push(english);
        }
        table.set(phrase, meaningList);
    }
    for (const [word, meaning] of Object.entries(facts?.glossary ?? {})) {
        const phrase = word.trim().toLowerCase();
        if (phrase.length === 0) {
            continue;
        }
        const wordList = String(meaning ?? '')
            .trim()
            .toLowerCase()
            .split(/\s+/)
            .filter((one) => {
                return one.length > 0;
            });
        if (wordList.length === 0) {
            table.set(phrase, []);
            continue;
        }
        const meaningList = table.get(phrase) ?? [];
        for (const one of wordList) {
            if (!meaningList.includes(one)) {
                meaningList.push(one);
            }
        }
        table.set(phrase, meaningList);
    }
    return table;
}

function checkIsLetterEnd(text, at) {
    if (at >= text.length) {
        return true;
    }
    if (text[at - 1] === SUBSCRIPT_MARK) {
        return false;
    }
    return !/\p{M}/u.test(text[at]);
}

// Phrases by their first character, longest first, so a position is tried
// against the few phrases that can start there.
function indexPhrases(table) {
    const index = new Map();
    for (const phrase of table.keys()) {
        const first = phrase[0];
        const list = index.get(first) ?? [];
        list.push(phrase);
        index.set(first, list);
    }
    for (const list of index.values()) {
        list.sort((one, other) => {
            return other.length - one.length;
        });
    }
    return index;
}

function readRun(run, table, phraseIndex) {
    const groups = [];
    let at = 0;
    while (at < run.length) {
        if (run[at] === ' ') {
            at += 1;
            continue;
        }
        const candidates = phraseIndex.get(run[at]) ?? [];
        const phrase = candidates.find((one) => {
            return run.startsWith(one, at) && checkIsLetterEnd(run, at + one.length);
        });
        if (phrase === undefined) {
            at += 1;
            while (at < run.length && !checkIsLetterEnd(run, at)) {
                at += 1;
            }
            continue;
        }
        const meaningList = table.get(phrase);
        if (meaningList.length > 0) {
            groups.push(meaningList);
        }
        at += phrase.length;
    }
    return groups;
}

/**
 * A question's words in the language's own script, as English search terms:
 * `groups` (each one alternatives for ONE thing the question names -- a label
 * whose words two keys share counts once) and `rest`, whatever was not in
 * that script (a key name, a reference, an English word), left as it was.
 */
export function toEnglishSearchWords(query, dictionary, facts) {
    const pattern = toLanguagePattern(facts);
    const text = String(query ?? '')
        .replace(/\u200B/g, ' ')
        .toLowerCase();
    if (pattern === null) {
        return { groups: [], rest: text };
    }
    const table = genPhraseTable(dictionary, facts);
    const phraseIndex = indexPhrases(table);
    const groups = [];
    // A run of the script, across the single spaces some writers put between
    // phrases -- a label may have one inside it (`ទេ អរគុណ`).
    const source = facts.scriptPattern;
    const runPattern = new RegExp(
        `(?:${source})(?:(?:${source})| (?=(?:${source})))*`,
        'gu',
    );
    const rest = text.replace(runPattern, (run) => {
        groups.push(...readRun(run, table, phraseIndex));
        return ' ';
    });
    const seen = new Set();
    return {
        groups: groups.filter((group) => {
            const key = group.join('|');
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        }),
        rest: rest.replace(/\s+/g, ' ').trim(),
    };
}
