/**
 * A verse asked for in the person's OWN language, read as one (2026-10-17,
 * the elder-persona run). The readers that route a verse to the verse finder
 * -- `readVerseFindAsk` ("Help me find a Bible verse in "KJV": …") and
 * `readBibleContentAsk` ("which verse says …") -- read English, so in a
 * Khmer window every verse asked for in Khmer went to the ordinary
 * assistant, which has no Bible search: asked _ជួយរកខគម្ពីរមួយផង … ស្រឡាញ់
 * ខ្មាំងសត្រូវ_, all three models named Matthew 5:44 and QUOTED a Khmer text
 * of their own making (the installed Bible says otherwise), with no button to
 * open it; one invented the book's Khmer name; one sent an elderly user to
 * type `/btw`. Typed in English the same asks found the verse 20 of 20.
 *
 * Every language is data (`chatLangHelpers.ts`): its `assistant.json` lists
 * how a verse is asked for in it -- `verseFindAsks`, the verse finder's own
 * frame with groups `bible` and `words`, and `verseAsks`, a verse by what it
 * says with group `words` -- and the words that make the ask the app's own
 * work instead (`verseAskExcludeWords`: the screen, a slide, a song). English
 * keeps its readers; this adds every other language's.
 *
 * Pure. Zero-width spaces, which Khmer keyboards put between words, are
 * taken out before reading.
 */

import { readVerseFindAsk } from '../helper/ai/verseFindAskHelpers';
import {
    readBibleContentAsk,
    type BibleContentAskType,
} from './bibleContentAskHelpers';
import { checkHasWord, checkIsAppWork } from './bibleReaderChatHelpers';
import {
    checkIsInLanguageScript,
    listAssistantLanguages,
    toAsciiDigits,
    type AssistantLanguageType,
} from './chatLangHelpers';

// A zero-width space, joiner or byte-order mark: each a format character.
const ZERO_WIDTH_PATTERN = /\p{Cf}/gu;

// A reference with a chapter and a verse, in any digits: the verse readers
// take those (`readBibleContentAsk` leaves them alone for the same reason).
const REFERENCE_PATTERN = /\d+\s*[:៖.]\s*\d+/;

function toPlainAsk(text: string) {
    return text.replace(ZERO_WIDTH_PATTERN, '').replace(/\s+/g, ' ').trim();
}

// A Latin word whole, as `checkHasWord` reads it: French `chant` is not in
// _chantez à l'Éternel_.
function checkHasExcludedWord(text: string, language: AssistantLanguageType) {
    return checkHasWord(text, language.verseAskExcludeWords);
}

/**
 * Whether the words name the app's own work in some language's own words --
 * the screen, a slide, a song (`verseAskExcludeWords`) -- which ends a verse
 * search as `VERSE_FIND_EXIT_PATTERN` does for English: _ដាក់វាលើអេក្រង់_
 * under a found verse is not more words of the verse. A verse asked FOR is
 * read by `checkIsAppWork` instead (2026-10-29): a word the Bible uses too
 * -- a song, a size -- starts a search unless it is a how-do-I, so
 * _ខគម្ពីរណាដែលនិយាយថាច្រៀងចម្រៀងថ្មី_ (which verse says sing a new song)
 * is searched, as its English is.
 */
export function checkIsAppWorkAsk(text: string) {
    const plain = toPlainAsk(text);
    return listAssistantLanguages().some((language) => {
        return (
            checkIsInLanguageScript(plain, language) &&
            checkHasExcludedWord(plain, language)
        );
    });
}

// The English of `closingWords`.
const ENGLISH_CLOSING_PATTERN =
    /^(?:thanks?|thank\s+you|thx|amen|bye|goodbye)\b/i;
// A closing line is short: "thank you so much 🙏", not a verse that
// happens to start with "Thank".
const MAX_CLOSING_LENGTH = 40;

/**
 * Whether the line is a thank-you or a goodbye, in English or in any
 * language's own words (`closingWords`). Under a verse search such a line
 * was searched as more words of the verse (2026-10-17, the elder-persona
 * run: _អរគុណច្រើន 🙏_ came back with a Google search for "thank you").
 */
export function checkIsClosingLine(text: string) {
    const plain = toPlainAsk(text)
        .replace(/[\p{Extended_Pictographic}\p{P}\s]+$/u, '')
        .toLowerCase();
    if (plain.length === 0 || plain.length > MAX_CLOSING_LENGTH) {
        return false;
    }
    if (ENGLISH_CLOSING_PATTERN.test(plain)) {
        return true;
    }
    return listAssistantLanguages().some((language) => {
        return language.closingWords.some((word) => {
            return word.length > 0 && plain.startsWith(word);
        });
    });
}

function toWords(match: RegExpExecArray) {
    return (match.groups?.words ?? '')
        .replace(/^[\s:៖,،]+/, '')
        .replace(/[\s?!។៕]+$/, '')
        .trim();
}

/**
 * Whether the words ask the verse finder for help -- "help me find a verse",
 * with the Bible they name and what they remember (null for either not
 * given) -- in English or in any language that says how. Null otherwise.
 */
export function readTypedVerseFindAsk(
    text: string,
): { bibleKey: string | null; remembered: string | null } | null {
    const english = readVerseFindAsk(text);
    if (english !== null) {
        return english;
    }
    const plain = toPlainAsk(text);
    for (const language of listAssistantLanguages()) {
        if (
            language.verseFindAskPatterns.length === 0 ||
            !checkIsInLanguageScript(plain, language)
        ) {
            continue;
        }
        for (const pattern of language.verseFindAskPatterns) {
            const match = pattern.exec(plain);
            if (match === null) {
                continue;
            }
            const words = toWords(match);
            if (checkIsAppWork(words)) {
                return null;
            }
            const bibleKey = (match.groups?.bible ?? '').trim();
            return {
                bibleKey: bibleKey.length > 0 ? bibleKey : null,
                remembered: words.length > 0 ? words : null,
            };
        }
    }
    return null;
}

/**
 * The Bible a verse asked for in words is searched in, off `owa_find_verse`
 * with no arguments (`{bible, bibles: [{key, locale}]}`): the Bible Lookup's,
 * unless they write in a language other than English and the lookup's Bible
 * is not in it while an installed one is -- then that one (2026-10-17: asked
 * in Khmer, Matthew 5:44 was found and quoted in the King James' English to
 * a person who reads none, the Reader's lookup being on KJV that day). Null
 * when there is no Bible at all.
 */
export function pickVerseFindBible(
    listed: unknown,
    langCode: string,
): string | null {
    const result = listed as { bible?: unknown } | null;
    const lookupKey = typeof result?.bible === 'string' ? result.bible : null;
    return pickBibleInLanguage(listed, lookupKey, langCode) ?? lookupKey;
}

/**
 * An installed Bible in the language somebody reads, when the one a verse
 * would be read from is not in it -- off `owa_find_verse` with no arguments
 * (`{bibles: [{key, locale, books?}]}`), a whole Bible before one that holds
 * `books` of them only (a New Testament had been picked for Genesis,
 * 2026-10-29). Null to keep `currentKey`: English, no language, a Bible
 * already in it, or none in it installed.
 */
export function pickBibleInLanguage(
    listed: unknown,
    currentKey: string | null,
    langCode: string,
): string | null {
    if (langCode === 'en' || langCode === 'other' || langCode.length === 0) {
        return null;
    }
    const result = listed as {
        bibles?: { key?: unknown; locale?: unknown; books?: unknown }[];
    } | null;
    const bibles = (Array.isArray(result?.bibles) ? result.bibles : []).filter(
        (bible) => {
            return typeof bible?.key === 'string';
        },
    );
    const isInLanguage = (bible: { locale?: unknown }) => {
        return String(bible.locale ?? '')
            .toLowerCase()
            .startsWith(langCode.toLowerCase());
    };
    const current = bibles.find((bible) => {
        return bible.key === currentKey;
    });
    if (current !== undefined && isInLanguage(current)) {
        return null;
    }
    const toBookCount = (bible: { books?: unknown }) => {
        return typeof bible.books === 'number' ? bible.books : Infinity;
    };
    const ownList = bibles.filter(isInLanguage);
    if (ownList.length === 0) {
        return null;
    }
    // The first of the most books: a whole Bible says no count at all.
    const own = ownList.reduce((best, bible) => {
        return toBookCount(bible) > toBookCount(best) ? bible : best;
    });
    return String(own.key);
}

/**
 * Knowledge ABOUT the Bible asked in a language other than English --
 * _តើនរណាជាអ្នកសរសេរគម្ពីរទំនុកតម្កើង?_, _Qui a écrit le livre des
 * Psaumes ?_ -- read as `readBibleContentAsk` reads English (2026-10-29,
 * `EC-444`): a question word and a Bible word, not a who-was / where-is,
 * nothing the person has open, nothing of the app's work. With no
 * assistant the guide had searched its manual for them and handed back a
 * page that does not answer (the failure EC-199 ended for English), where
 * the English question gets the way to an assistant. Null otherwise.
 */
export function readTypedKnowledgeAsk(
    text: string,
): BibleContentAskType | null {
    const plain = toPlainAsk(text);
    if (
        plain.length === 0 ||
        plain.startsWith('/') ||
        REFERENCE_PATTERN.test(toAsciiDigits(plain)) ||
        checkIsAppWork(plain)
    ) {
        return null;
    }
    const isKnowledge = listAssistantLanguages().some((language) => {
        const words = language.bibleKnowledgeWords;
        return (
            words.leads.length > 0 &&
            checkIsInLanguageScript(plain, language) &&
            checkHasWord(plain, words.leads) &&
            checkHasWord(plain, words.cues) &&
            !checkHasWord(plain, words.nameLeads) &&
            !checkHasWord(plain, words.ownState) &&
            !checkHasWord(plain, words.appWords)
        );
    });
    return isKnowledge ? { kind: 'knowledge' } : null;
}

/**
 * What kind of Bible question the words are, in English or in the person's
 * own language: a verse by what it says first, then knowledge about the
 * Bible. The guide's one reader (`helpBotHelpers.ts`), so a question the
 * manual cannot answer is said so in every language alike.
 */
export function readAnyBibleContentAsk(
    text: string,
): BibleContentAskType | null {
    return (
        readBibleContentAsk(text) ??
        readTypedVerseContentAsk(text) ??
        readTypedKnowledgeAsk(text)
    );
}

/**
 * A verse asked for by what it says, in a language other than English:
 * `{ kind: 'verse', words }` with the words it is about, as
 * `readBibleContentAsk` answers for English. Null for anything else -- a
 * reference, the app's own work, or words no pattern of the language reads.
 */
export function readTypedVerseContentAsk(
    text: string,
): BibleContentAskType | null {
    const plain = toPlainAsk(text);
    if (
        plain.length === 0 ||
        REFERENCE_PATTERN.test(toAsciiDigits(plain)) ||
        checkIsAppWork(plain)
    ) {
        return null;
    }
    for (const language of listAssistantLanguages()) {
        if (
            language.verseAskPatterns.length === 0 ||
            !checkIsInLanguageScript(plain, language)
        ) {
            continue;
        }
        for (const pattern of language.verseAskPatterns) {
            const match = pattern.exec(plain);
            if (match === null) {
                continue;
            }
            const words = toWords(match);
            return words.length === 0 ? null : { kind: 'verse', words };
        }
    }
    return null;
}
