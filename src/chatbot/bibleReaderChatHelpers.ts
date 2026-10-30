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
 *
 * A reference is also written WITHOUT the chapter word -- "Matthew 18",
 * "ម៉ាថាយ ១៨" -- which is how a reader actually says it. The words before
 * the number are handed to `readBibleReaderAsk`'s `checkIsBook`, which the
 * WINDOW answers from the reader's own Bible (`readBibleReaderAskWithBook`
 * in `ChatbotAppComp.tsx`); that keeps this module pure and a book name in
 * any installed Bible's language still routes. A Resources file named in
 * the question (`MAT.18.pdf`) is a Resources ask on its own (2026-10-19: a
 * live gemma4:cloud run answered "I cannot read PDFs", summarized Matthew
 * 18 from memory, and gave John 3's Resources files as how-to steps).
 */
import {
    checkIsInLanguageScript,
    listAssistantLanguages,
    toAsciiDigits,
    type AssistantLanguageType,
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

/** Whether one run of words before a number names a Bible book. */
export type BibleBookNameCheckType = (bookText: string) => boolean;

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
// resource files for John 3_ is this ask. Only words the Bible itself does
// not use: four verses at most in the KJV and in the NIV each (counted
// 2026-10-29).
const ENGLISH_APP_WORK_PATTERN =
    /\b(?:apps?|application|screens?|projector|slides?|buttons?|click|menus?|tabs?|keyboard|shortcuts?|versions?|translations?|import|install|download|xml|fonts?|text\s+size|paste|highlight\w*|audio|videos?|volume|backgrounds?|countdown|lyrics?|zoom|bigger|print|export|undo|delete|chatbot|assistant|url|online|offline|computer|data|backup|sync|bible\s+list|my\s+list)\b/i;

// The app's words the Bible uses too, counted the same day: _save_ (226
// verses of the KJV), _help_ (117), _sound_ (86), _Mark_ the gospel and the
// mark of Cain (38), the ark's _window_ (42), _present_ (136), the
// _congregation_ (331). Under Noah's card _How did God save Noah?_ had gone
// to the app's guide, which answers no Bible question, and in a Reader tab
// _What does Mark 4:39 say?_ was no Bible question at all. They are the
// app's work in a how-do-I only (_how do I save this?_).
const ENGLISH_SHARED_APP_WORK_PATTERN =
    /\b(?:present\w*|congregation|audience|display|windows?|press|panels?|keys?|settings?|marks?|colou?rs?|sound|play|smaller|share|save|help|scroll|songs?)\b/i;

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

// A file in the user's Resources folders, named as the panel writes it
// (`MAT.18.pdf`, `pdf/LUK.7.pdf`, `GEN.0.json`, `family-tree.jpeg`). The
// extensions are the ones `toResourceFileKind` can read; a dotted word with
// any other tail ("version.2", "e.g.") is not a file. A question naming one
// is about Resources whatever else it says: asked "what does MAT.18.pdf
// say?" the model had no Resources tool at all and answered that it cannot
// read PDFs (seen live 2026-10-19 on gemma4:cloud).
const RESOURCE_FILE_NAME_PATTERN =
    /(?:^|[\s"'`(])(?:[^\s/]+\/)*[^\s/]+\.(?:pdf|own|md|markdown|txt|json|csv|log|xml|html?|ya?ml|srt|vtt|owl|ows|owpf|lyric|png|jpe?g|gif|webp|bmp|avif)\b/i;

/** Whether the words name a file in the user's Resources folders. */
export function checkHasResourceFileName(text: string) {
    // A web address ending in `.pdf` is a page to read, not one of their
    // files: the URL is taken out before the name is looked for.
    return RESOURCE_FILE_NAME_PATTERN.test(
        text.replaceAll(/\bhttps?:\/\/\S+/gi, ' '),
    );
}

// A chapter written WITHOUT its book's chapter word -- "Matthew 18",
// "ម៉ាថាយ ១៨": the way an elderly reader actually says it. The number must
// not be a verse's (`3:16`), a decimal (`3.5`) or inside a word; 150 is
// Psalms' last chapter, so anything larger is not one.
const BARE_CHAPTER_NUMBER_PATTERN =
    /(?<![\p{L}\p{M}\d])(\d{1,3})(?!\d)(?!\s*[:៖])(?!\.\d)/gu;
const BOOK_RUN_PATTERN = /(?:\p{L}[\p{M}]*){2,}/u;
const MAX_CHAPTER_NUMBER = 150;
const MAX_BOOK_RUN_TOKENS = 3;
const BOOK_RUN_LOOKBACK = 48;

/** A number that could be a chapter, with the words before it. */
function* iterateBookNumberMatches(
    ascii: string,
): Generator<{ at: number; bookTextList: string[] }> {
    for (const match of ascii.matchAll(BARE_CHAPTER_NUMBER_PATTERN)) {
        const chapter = Number(match[1]);
        const at = match.index ?? -1;
        if (at < 0 || chapter < 1 || chapter > MAX_CHAPTER_NUMBER) {
            continue;
        }
        const before = ascii
            .slice(Math.max(0, at - BOOK_RUN_LOOKBACK), at)
            .trim();
        const tokenList = before
            .split(/\s+/)
            .filter(Boolean)
            .slice(-MAX_BOOK_RUN_TOKENS);
        // Shortest first: "ម៉ាថាយ", then a longer run only when a numbered
        // book needs it ("1 Samuel" after "Samuel" matched nothing).
        const bookTextList: string[] = [];
        for (let count = 1; count <= tokenList.length; count++) {
            const bookText = tokenList.slice(-count).join(' ');
            if (
                BOOK_RUN_PATTERN.test(bookText) &&
                !bookTextList.includes(bookText)
            ) {
                bookTextList.push(bookText);
            }
        }
        if (bookTextList.length > 0) {
            yield { at, bookTextList };
        }
    }
}

/**
 * The words before a chapter number in a typed question, shortest first, or
 * null. What those words ARE is the window's to ask -- a book name in the
 * reader's own Bible (`owa_bible_suggest`) -- so this stays pure (2026-10-19).
 */
export function readBibleReaderBookCandidate(asked: string) {
    const words = toPlainAsk(asked);
    if (
        words.length === 0 ||
        words.startsWith('/') ||
        checkIsHowTo(words) ||
        checkIsAppWork(words)
    ) {
        return null;
    }
    const bookTextList: string[] = [];
    for (const one of iterateBookNumberMatches(toAsciiDigits(words))) {
        for (const bookText of one.bookTextList) {
            if (!bookTextList.includes(bookText)) {
                bookTextList.push(bookText);
            }
        }
    }
    return bookTextList.length === 0 ? null : { bookTextList };
}

// Where a reference starts, in the words as typed. A verse reference first;
// else a chapter word of any language beside a number; else -- when the
// window has confirmed a book name -- the number after it.
function findReferenceAt(
    text: string,
    checkIsBook?: BibleBookNameCheckType,
): number | null {
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
    let bookAt = -1;
    if (checkIsBook !== undefined) {
        for (const { at, bookTextList } of iterateBookNumberMatches(ascii)) {
            if (bookTextList.some(checkIsBook)) {
                bookAt = at;
                break;
            }
        }
    }
    const atList = [verseAt, chapterAt, bookAt].filter((at) => {
        return at >= 0;
    });
    return atList.length === 0 ? null : Math.min(...atList);
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

// A how-do-I in one language's own words or patterns.
function checkIsLanguageHowTo(text: string, language: AssistantLanguageType) {
    return (
        checkIsInLanguageScript(text, language) &&
        (checkHasWord(text, language.bibleReaderWords.howTo) ||
            language.bibleReaderWords.howToAskPatterns.some((pattern) => {
                return pattern.test(text);
            }))
    );
}

/**
 * Whether the words are a how-do-I ("how do I…", "comment ouvrir…",
 * "តើខ្ញុំ…ដោយរបៀបណា"): the app's own work, never a Bible question. Shared
 * with the passage conversation, which hands such a line to the ordinary
 * assistant rather than answering it under the Bible prompt (2026-10-19).
 *
 * What the PERSON does, never any "how" (2026-10-29): French "comment" and
 * Khmer "ដូចម្តេច" are every "how" there is, and _Comment Jésus a-t-il
 * sauvé Pierre dans Matthieu 14:30 ?_ was no Bible question in a Reader
 * tab while the same words in English were one.
 */
export function checkIsHowTo(text: string) {
    return (
        ENGLISH_HOW_TO_PATTERN.test(text) ||
        listAssistantLanguages().some((language) => {
            return checkIsLanguageHowTo(text, language);
        })
    );
}

/**
 * Whether the words are about working the app -- a screen, a slide, saving,
 * copying, settings -- whatever Bible words ride along. Shared with the
 * passage conversation (2026-10-19), on the same rule: the app answers those,
 * the Bible prompt does not.
 *
 * A word the language's Bibles use too counts in a how-do-I only
 * (2026-10-29, the user's pictures of Noah's card: _what is the size of noah
 * ark_ answered from the record in English and Khmer, and _Quelle est la
 * taille de l'arche de Noé_ sent to the app's guide, which said to type
 * `/btw` -- `taille` is the font's size and Rachel's stature both, 36
 * verses of the Louis Segond).
 */
export function checkIsAppWork(text: string) {
    if (
        ENGLISH_APP_WORK_PATTERN.test(text) ||
        (ENGLISH_HOW_TO_PATTERN.test(text) &&
            ENGLISH_SHARED_APP_WORK_PATTERN.test(text))
    ) {
        return true;
    }
    return listAssistantLanguages().some((language) => {
        if (!checkIsInLanguageScript(text, language)) {
            return false;
        }
        const words = language.bibleReaderWords;
        return (
            checkHasWord(text, words.exclude) ||
            (words.excludeInHowTo.length > 0 &&
                checkHasWord(text, words.excludeInHowTo) &&
                checkIsLanguageHowTo(text, language))
        );
    });
}

/**
 * What kind of Bible-Reader question the words are, or null for any other.
 * Called only for a line the person TYPED: a pressed question is one the
 * guide has filed, and the app's own answers keep it.
 */
export function readBibleReaderAsk(
    asked: string,
    // Whether the words before a chapter number name a Bible book, asked of
    // the app by the window (`readBibleReaderAskWithBook`, 2026-10-19). Left
    // out by the pure readers, which keep the chapter word and the colon.
    checkIsBook?: BibleBookNameCheckType,
): BibleReaderAskType | null {
    const words = toPlainAsk(asked);
    if (
        words.length === 0 ||
        words.startsWith('/') ||
        checkIsHowTo(words) ||
        checkIsAppWork(words)
    ) {
        return null;
    }
    // A file named in the question is a Resources question whatever else it
    // says: "what does MAT.18.pdf say?" has no chapter word, no reference,
    // and used to reach a model with no Resources tool (2026-10-19).
    if (checkHasResourceFileName(words)) {
        return { intent: 'resources' };
    }
    const at = findReferenceAt(words, checkIsBook);
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
              'folders. Find the file they named -- or the book and chapter ' +
              'they named -- with owa_resource_file (`list` by `search` ' +
              'for a file name, or by `ref` or `book`/`chapter`, then ' +
              '`read` the name it gives); a PDF comes back as pictures of ' +
              'its pages. Name every file `list` returned, and say which ' +
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
