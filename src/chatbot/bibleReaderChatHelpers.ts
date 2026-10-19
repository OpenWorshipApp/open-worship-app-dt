/**
 * A question about the Bible READER, read off the words typed, in any
 * language (2026-10-18).
 *
 * The assistant could answer app questions and could find a verse from what
 * somebody remembered, but a typed question that names a chapter or a verse
 * -- _what names in Genesis chapter 4_, _show resource files of John chapter
 * 3_, _open genesis 3:203_ -- went to the ordinary assistant, which has
 * neither the names lookup nor the Resources files nor the verse reader. The
 * tools existed; nothing offered them to a plain question
 * (`MODEL_ON_ASK_TOOL_MAP` offered each only to a conversation opened from a
 * panel). This reads such a question as one, so the same tab gets all three
 * for that ask and for the plain lines typed under it.
 *
 * Every language is data (`chatLangHelpers.ts`): its `assistant.json` says
 * how it writes "chapter", the words that ask for the Resources files, for
 * the names and places, and for a how-to ("របៀប", "comment"), which is the
 * app's own work and not a Bible question. English reads here. Pure: no
 * store, no tool call, no model.
 */
import {
    checkIsInLanguageScript,
    listAssistantLanguages,
    toAsciiDigits,
} from './chatLangHelpers';

export const BIBLE_READER_ASK_KIND = 'bible-reader';
// A listing and a read, a record and a verse, the answer.
export const BIBLE_READER_MAX_TOOL_ROUNDS = 6;

export type BibleReaderIntentType = 'resources' | 'names' | 'reference';

export type BibleReaderAskType = {
    /** What they are after, so the first round is aimed. */
    intent: BibleReaderIntentType;
    /** A plain line under a Bible-reader answer: the tools, not a new read. */
    isThread?: true;
};

const ZERO_WIDTH_PATTERN = /\p{Cf}/gu;

export function toPlainAsk(text: string) {
    return text.replace(ZERO_WIDTH_PATTERN, '').replace(/\s+/g, ' ').trim();
}

function escapeRegExp(text: string) {
    return text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// `John 3:16`, `លោកុប្បត្តិ ៣:២០៣`: a chapter and a verse, in any digits.
const VERSE_REFERENCE_PATTERN = /\d{1,3}\s*[:៖]\s*\d{1,3}/;

// A how-to is the app's own work, whatever it names: the guide answers it.
const ENGLISH_HOW_TO_PATTERN =
    /^(?:how\s+(?:do|can|would|should)\s+i|how\s+to|where\s+(?:is|are)\s+the)\b/i;

// The app's own nouns and verbs in English, minus the ones a Bible question
// uses too ("open", "show", "read", "find", "search", "list", "resources",
// "files"): _put John 3:16 on the screen_ is the Presenter's work, _show
// resource files for John 3_ is this ask.
const ENGLISH_APP_WORK_PATTERN =
    /\b(?:screens?|projector|present\w*|slides?|congregation|audience|display|buttons?|windows?|click|press|menus?|tabs?|panels?|keys?|keyboard|shortcuts?|settings?|versions?|translations?|import|install|download|xml|fonts?|paste|highlight\w*|marks?|colou?rs?|audio|sound|play|zoom|bigger|smaller|print|export|share|save|undo|delete|chatbot|assistant|help|scroll|url|online|offline|computer|data|backup|sync|bible\s+list|my\s+list)\b/i;

const ENGLISH_RESOURCES_PATTERN =
    /\b(?:resources?|files?|documents?|study\s+notes?|commentar(?:y|ies)|pdfs?)\b/i;
const ENGLISH_NAMES_PATTERN =
    /\b(?:names?|people|persons?|places?|characters?|who)\b/i;
const ENGLISH_CHAPTER_PATTERN = /\bchapters?\s+\d{1,3}\b/i;

// A Latin word has word boundaries; Khmer and its neighbours are written
// without spaces, so their words match inside a run ("ជំពូក" in a sentence).
// Without this, an English "commentary" was excluded as French "comment".
const LATIN_WORD_PATTERN =
    /^[\p{Script=Latin}][\p{Script=Latin}\p{M}0-9'’ -]*$/u;

export function checkHasWord(text: string, wordList: readonly string[]) {
    return wordList.some((word) => {
        if (word.length === 0) {
            return false;
        }
        const source = escapeRegExp(word);
        const pattern = LATIN_WORD_PATTERN.test(word)
            ? new RegExp(`(?<!\\p{L})${source}(?!\\p{L})`, 'iu')
            : new RegExp(source, 'iu');
        return pattern.test(text);
    });
}

// Where a reference starts, in the words as typed. A verse reference first;
// else a chapter word of any language beside a number.
function findReferenceAt(text: string): number | null {
    const ascii = toAsciiDigits(text);
    const verseMatch = VERSE_REFERENCE_PATTERN.exec(ascii);
    const verseAt = verseMatch === null ? -1 : verseMatch.index;
    let chapterAt = ENGLISH_CHAPTER_PATTERN.test(ascii)
        ? ascii.search(ENGLISH_CHAPTER_PATTERN)
        : -1;
    for (const language of listAssistantLanguages()) {
        if (!checkIsInLanguageScript(text, language)) {
            continue;
        }
        for (const word of language.bibleReaderWords.chapter) {
            const match = new RegExp(
                `${escapeRegExp(word)}\\s*\\d{1,3}`,
                'iu',
            ).exec(ascii);
            if (
                match !== null &&
                (chapterAt === -1 || match.index < chapterAt)
            ) {
                chapterAt = match.index;
            }
        }
    }
    if (verseAt === -1 && chapterAt === -1) {
        return null;
    }
    return verseAt === -1
        ? chapterAt
        : chapterAt === -1
          ? verseAt
          : Math.min(verseAt, chapterAt);
}

// A reference needs a book in front of it: "chapter 3" alone, or "3:16"
// alone, says nothing a tool could read. Two LETTER CLUSTERS, so a Khmer
// book name counts: its vowel and subscript marks sit between the letters
// (`យ៉ូហាន` has no two adjacent `\p{L}`), which a bare `\p{L}{2,}` missed and
// let "តើខ្ញុំវាយ យ៉ូហាន 3:16" fall through (found 2026-10-18).
function checkHasBookBefore(text: string, at: number) {
    return /(?:\p{L}[\p{M}]*){2,}/u.test(text.slice(Math.max(0, at - 40), at));
}

function readIntent(text: string): BibleReaderIntentType {
    if (
        ENGLISH_RESOURCES_PATTERN.test(text) ||
        listAssistantLanguages().some((language) => {
            return (
                checkIsInLanguageScript(text, language) &&
                checkHasWord(text, language.bibleReaderWords.resources)
            );
        })
    ) {
        return 'resources';
    }
    if (
        ENGLISH_NAMES_PATTERN.test(text) ||
        listAssistantLanguages().some((language) => {
            return (
                checkIsInLanguageScript(text, language) &&
                checkHasWord(text, language.bibleReaderWords.names)
            );
        })
    ) {
        return 'names';
    }
    return 'reference';
}

function checkIsHowTo(text: string) {
    return (
        ENGLISH_HOW_TO_PATTERN.test(text) ||
        listAssistantLanguages().some((language) => {
            return (
                checkIsInLanguageScript(text, language) &&
                checkHasWord(text, language.bibleReaderWords.howTo)
            );
        })
    );
}

function checkIsAppWork(text: string) {
    return (
        ENGLISH_APP_WORK_PATTERN.test(text) ||
        listAssistantLanguages().some((language) => {
            return (
                checkIsInLanguageScript(text, language) &&
                checkHasWord(text, language.bibleReaderWords.exclude)
            );
        })
    );
}

/**
 * What kind of Bible-Reader question the words are, or null for any other.
 * Called only for a line the person TYPED: a pressed question is one the
 * guide has filed, and the app's own answers keep it.
 */
export function readBibleReaderAsk(asked: string): BibleReaderAskType | null {
    const words = toPlainAsk(asked);
    if (
        words.length === 0 ||
        words.startsWith('/') ||
        checkIsHowTo(words) ||
        checkIsAppWork(words)
    ) {
        return null;
    }
    const at = findReferenceAt(words);
    if (at === null || !checkHasBookBefore(words, at)) {
        return null;
    }
    return { intent: readIntent(words) };
}

/**
 * The ask kind the window may route to: null when the words are one of the
 * app's OWN supported questions (`findKnownQuestion`), because that row
 * decides and a reference in it is an example, not a Bible question. _Where
 * do I type John 3:16?_ is the Reader's own how-to (W-11): routed as a
 * Bible-Reader ask it had the verse opened and never said where to type it
 * (found in round 23's Khmer pass, 2026-10-18). Only a free-typed question
 * with no row gets the verse tools.
 */
export function keepBibleReaderAskUnlessKnown(
    ask: BibleReaderAskType | null,
    knownQuestion: { text?: string } | null,
) {
    return ask !== null && knownQuestion === null ? ask : null;
}

type BibleReaderMessageType = {
    author: 'you' | 'bot';
    text?: string;
    isFollowUp?: true;
    isBibleReaderAnswer?: true;
};

/**
 * Whether a plain line typed in the tab is more of a Bible-Reader
 * conversation: the last answer was one, and the line is not a command or
 * the app's own work. Null otherwise.
 */
export function readBibleReaderThread(
    messages: BibleReaderMessageType[],
    text: string,
): BibleReaderAskType | null {
    const words = toPlainAsk(text);
    if (
        words.length === 0 ||
        words.startsWith('/') ||
        checkIsHowTo(words) ||
        checkIsAppWork(words)
    ) {
        return null;
    }
    const lastAnswer = [...messages].reverse().find((message) => {
        return message.author === 'bot' && message.isFollowUp !== true;
    });
    return lastAnswer?.isBibleReaderAnswer === true
        ? { intent: readIntent(words), isThread: true }
        : null;
}

/**
 * What the model is asked: their question, then the line that aims the
 * first round. In the USER turn, never the system prompt -- it is a cached
 * prefix, and a line that changes per question would break it there.
 */
export function toBibleReaderAsk(
    asked: string,
    ask: BibleReaderAskType,
    // The Bible a quoted verse should come from, when the window could read
    // the installed list (`pickVerseFindBible`): the person's own language
    // first, so a Khmer reader is quoted the Khmer Bible.
    bible: string | null = null,
) {
    const line =
        ask.intent === 'resources'
            ? 'They are asking about the study files in their Resources ' +
              'folders. Find the file for the book and chapter they named ' +
              'with owa_resource_file (`list` by `ref` or `book`/`chapter`, ' +
              'then `read` the name it gives); a PDF comes back as pictures ' +
              'of its pages. Name every file `list` returned, and say which ' +
              'one you read and what it says.'
            : ask.intent === 'names'
              ? 'They are asking who and what places are in a Bible ' +
                'passage. Read it with owa_lookup_record (`kind: "verse"`, ' +
                '`ref` as they named it, `names: true`) and answer from what ' +
                'it holds.'
              : 'They are asking about a Bible passage or verse. Read it ' +
                'with owa_find_verse (`refs`); if they asked to open it, ' +
                'open only a verse `refs` returned (`open` the key) and say ' +
                'it is in the Bible Lookup, not on a screen. A `notFound` ' +
                'reason says why a reference has no verse -- say it, never ' +
                'invent one.';
    const quote =
        bible === null
            ? ''
            : ` Quote a passage from the Bible "${bible}" (pass it as ` +
              '`bible` on the tool that reads it).';
    return `${asked.trim()}\n\n(${line}${quote})`;
}

/**
 * The system prompt of such an ask: the three tools, the one rule about
 * quoting, and the voice every answer in this window keeps.
 */
export const BIBLE_READER_SYSTEM_PROMPT =
    'You are the Bible-study assistant inside Open Worship app, a church ' +
    'presentation program, answering a person who is reading the Bible in ' +
    'this app. Use the tools for what the app holds: owa_lookup_record for ' +
    'the people and places a passage names (`kind: "verse"`, `ref` in any ' +
    'language, `names: true`) and for a passage itself; owa_find_verse for ' +
    'a verse or a reference (`refs` reads it, `open` puts one in the Bible ' +
    'Lookup, never on a screen); owa_resource_file for the study files in ' +
    'their Resources folders (`list` by `ref` -- a book and chapter as they ' +
    'said it -- or by `book`/`chapter`/`search`, then `read` the name ' +
    '`list` gives). A Bible book may be named in their own language; pass ' +
    'it as they wrote it. Quote a verse only as a tool returned it, in the ' +
    'Bible it names, and name the passage. The names lookup is drawn from ' +
    'the King James Version: say so when asked where it comes from, and a ' +
    'kjvName is the KJV spelling. When a tool says a reference was not ' +
    'found (`notFound`), say what it says -- a chapter has fewer verses -- ' +
    'and never make a verse up. Answer plainly and briefly, for older ' +
    'readers, in the language they used; do not describe the app or offer ' +
    'a walkthrough.';
