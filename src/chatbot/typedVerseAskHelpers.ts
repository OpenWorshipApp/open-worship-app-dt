/**
 * A passage typed to be put up or read in a language other than English,
 * with no assistant to read it (2026-11-14, EC-622; the user's goal:
 * _chatbot is very smart to help user control screen_). In an English line
 * `VERSE_ASK_PATTERN` (`helpBotHelpers.ts`) reads "put John 3:16 on the
 * screen", and the answer is the verse with ONE button that puts it up. In
 * any other language nothing read it: with the spend guard paused, a verse
 * asked for on the screen in another language was answered with the guide's
 * page on Settings, and so was a question about what a verse says in a
 * named Bible.
 *
 * A verb cannot be read in every language, so the line is read by what it
 * holds: a chapter and a verse -- `3:16`, `3,16` as most of Europe writes
 * one, `3.16`, `3:16-18`, `3 16` as the app's own parser reads it, in any
 * script's digits -- or a chapter alone, with a book's name right before
 * it as an installed Bible or English names it (`findTypedBookName`, over
 * `owa_bible_suggest books`: the words before the number that are a whole
 * name, `1 Juan` before `Juan`, so a verb before them is no part of it,
 * and in a script written without spaces the name that ends the run of
 * letters). A whole name is read in any case beside a verse; beside a
 * chapter alone only as a name is written, with its capital. A word no
 * installed Bible names a book by, right before a chapter and a verse
 * written with a colon and nothing round it, is read too
 * (`readTypedUnknownBookWord`: a capital and three letters in a Latin
 * script, two letters in another): the parser's refusal is the answer
 * then, never the guide's page. Not beside `3,5`, `3.5` or `3 5`, each
 * also two numbers, nor beside a chapter alone.
 *
 * Not a line read as English, a how-to in any installed language's own
 * words, or another conversation's subject in the language it is typed in
 * (`readTypedLineSubject`: a song, a note, a countdown, a clock). Pure; the
 * window reads the names and the passage.
 */
import { toAsciiDigitText } from '../helper/bibleVerseFindHelpers';
import { DEFAULT_CHAT_LANG_CODE, getAppLangCode } from './chatLangHelpers';
import {
    findTypedBookName,
    readTypedUnknownBookWord,
    type StudyBookNamesType,
} from './studyVerseCheckHelpers';
import { readTypedLineSubject } from './typedScreenAskHelpers';

// A zero-width space, joiner or byte-order mark: each a format character.
const ZERO_WIDTH_PATTERN = /\p{Cf}/gu;
// A line longer than this is not one asking for a passage.
const MAX_LINE_LENGTH = 300;
// A chapter and a verse no book of the Bible reaches: a time, a ratio.
const MAX_CHAPTER = 150;
const MAX_VERSE = 176;
// A chapter, and its verse or verses when given, in any script's digits. A
// comma or a dot only with no space round it: `5, 6` is two numbers. A
// range's end followed by a chapter's sign is the next chapter's
// (`3:16-4:2`), so not taken.
const TYPED_REFERENCE_PATTERN =
    /(?<![\p{Nd}:：.,])(\p{Nd}{1,3})(?:(\s*[:：]\s*|[.,])(\p{Nd}{1,3})(?:\s*[-–—]\s*(\p{Nd}{1,3})(?!\s*[:：.,]\s*\p{Nd}))?)?(?!\p{Nd})/gu;
// A verse after a chapter with a space alone between them, `John 3 16`:
// a number, or a range, and no more of a number after it.
const SPACED_VERSE_PATTERN =
    /^\s+(\p{Nd}{1,3})(?:\s*[-–—]\s*(\p{Nd}{1,3}))?(?!\p{Nd}|[:：.,]\p{Nd})/u;
// A time of day said with its half of the day: `10:30 am`.
const CLOCK_AFTER_PATTERN = /^\s*[ap]\.?m\b/i;
// A sign no book's name carries: where the words before a number stop
// being its name. A dot, a hyphen and an apostrophe stay, and so does a
// script's OWN sign -- a mark between the syllables of one word, a word
// space of its own -- which a name of that script runs on through: only a
// sign the scripts share ends a name.
const STOP_CHAR_PATTERN = /[\p{P}\p{S}]/u;
const SHARED_SIGN_PATTERN = /[\p{Script=Common}\p{Script=Inherited}]/u;
// A script's own signs ending the words before a number: tried without
// them when the words as written name no book.
const OWN_SIGN_END_PATTERN =
    /(?:(?![\p{Script=Common}\p{Script=Inherited}])[\p{P}\p{S}])+$/u;
// A name glued to a few small letters before it -- a word's prefix in
// front of a name's capital: read from the capital.
const PREFIXED_NAME_PATTERN =
    /(^|[^\p{L}\p{M}\p{Nd}])(\p{Ll}{1,5})(?=\p{Lu}\p{Ll})/gu;
// A name no Bible gives made of parts joined by a hyphen, a capital first.
const HYPHEN_NAME_PATTERN =
    /(?:^|[^\p{L}\p{M}\p{Nd}])(\p{Lu}[\p{L}\p{M}]*(?:[-‐‑][\p{L}\p{M}]+)+)$/u;
// One in a script whose own signs part its syllables: the run of them
// ending the words, read whole, and at most this many characters of it.
const JOINED_NAME_PATTERN =
    /(?:^|[^\p{L}\p{M}\p{Nd}])((?:\p{L}[\p{L}\p{M}]*(?:(?![\p{Script=Common}\p{Script=Inherited}])[\p{P}\p{S}])+)+\p{L}[\p{L}\p{M}]*)$/u;
const UNKNOWN_NAME_MAX_CHARS = 30;
// A run's first part cut short, with the sign after it.
const PART_START_PATTERN = /^[^\p{P}\p{S}]*[\p{P}\p{S}]+/u;
const KEPT_SIGN_SET: ReadonlySet<string> = new Set([
    '.',
    '-',
    '‐',
    '‑',
    "'",
    '’',
]);

function toPlainLine(text: string) {
    return String(text ?? '')
        .replace(ZERO_WIDTH_PATTERN, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * The language a line that may ask for a passage is typed in -- a code,
 * `other` or null when its words cannot say -- or null when it is not such
 * a line: no number in it, too long, a `/` command, English, a how-to in
 * any installed language's words, or another conversation's subject in its
 * own. Asked before any Bible is read for its book names.
 */
export function readTypedVerseLine(
    text: string,
    appLangCode: string = getAppLangCode(),
): { typedCode: string | null } | null {
    const line = toPlainLine(text);
    if (
        line.length === 0 ||
        line.length > MAX_LINE_LENGTH ||
        line.startsWith('/') ||
        !/\p{Nd}/u.test(line)
    ) {
        return null;
    }
    const read = readTypedLineSubject(line, appLangCode);
    if (
        read.typedCode === DEFAULT_CHAT_LANG_CODE ||
        read.isHowTo ||
        read.isOtherSubject
    ) {
        return null;
    }
    return { typedCode: read.typedCode };
}

// The tool that puts a passage up, which the corpus row asking for one
// names among its resources.
const PRESENT_BIBLE_TOOL_NAME = 'owa_present_bible';

/**
 * Whether a supported question a line IS leaves it to the verse reader: none
 * does, or the row asking for a passage to be put up -- _Put John 3:16 on
 * the screen_, in a person's own language as the corpus words it -- whose
 * answer with no model is the verse and its one button, never the guide's
 * page (`checkIsBibleListRowFree`'s rule for its own row).
 */
export function checkIsVerseRowFree(
    row: { resources?: { tools?: string[] } } | null,
) {
    return (
        row === null ||
        (row.resources?.tools ?? []).includes(PRESENT_BIBLE_TOOL_NAME)
    );
}

export type TypedVerseRefType = {
    // What the app's own parser is asked to read: the book as typed, then
    // its chapter and verses in ASCII digits with a colon.
    reference: string;
    // An installed Bible, or English, names the book so.
    isBookNamed: boolean;
};

// Where the words before a number start: after the last sign no book's
// name carries, and no earlier than the number before it ended.
function findWindowStart(line: string, from: number, to: number) {
    for (let index = to - 1; index >= from; index--) {
        const char = line[index];
        if (
            STOP_CHAR_PATTERN.test(char) &&
            !KEPT_SIGN_SET.has(char) &&
            SHARED_SIGN_PATTERN.test(char)
        ) {
            return index + 1;
        }
    }
    return from;
}

// The words before a number as a name is looked for in them: a prefix
// glued to a name's capital set apart from it.
function toNameWindow(text: string) {
    return text.replace(PREFIXED_NAME_PATTERN, '$1$2 ');
}

// The book the words before a number end with: as written, then without
// the script's own signs at their end.
function findWindowBook(
    window: string,
    names: StudyBookNamesType,
    isDotted: boolean,
    isAnyCase: boolean,
) {
    const book = findTypedBookName(window, names, isDotted, isAnyCase);
    if (book !== null) {
        return { book, window };
    }
    const trimmed = window.replace(OWN_SIGN_END_PATTERN, '');
    if (trimmed === window || trimmed.trim() === '') {
        return null;
    }
    const trimmedBook = findTypedBookName(trimmed, names, isDotted, isAnyCase);
    return trimmedBook === null ? null : { book: trimmedBook, window: trimmed };
}

// The word before a chapter and a verse that names no book, when it reads
// as a name: a run of syllables its script's own signs part, hyphened
// parts with a capital first, else the last word.
function readUnknownName(window: string) {
    const trimmed = window.replace(OWN_SIGN_END_PATTERN, '');
    const joined = JOINED_NAME_PATTERN.exec(trimmed)?.[1];
    if (joined !== undefined) {
        return joined.length <= UNKNOWN_NAME_MAX_CHARS
            ? joined
            : joined
                  .slice(-UNKNOWN_NAME_MAX_CHARS)
                  .replace(PART_START_PATTERN, '');
    }
    const hyphened = HYPHEN_NAME_PATTERN.exec(trimmed);
    if (hyphened !== null && (hyphened[1].match(/\p{L}/gu) ?? []).length >= 3) {
        return hyphened[1];
    }
    return readTypedUnknownBookWord(trimmed)?.word ?? null;
}

/**
 * The passage a typed line names, by the book names of the installed
 * Bibles and English: the first one a name reads, else the first chapter
 * and verse after a word that reads as a name no Bible gives. Null for
 * neither.
 */
export function readTypedVerseRef(
    text: string,
    names: StudyBookNamesType,
): TypedVerseRefType | null {
    const line = toPlainLine(text);
    const windowMax = names.maxLength * 2 + 12;
    let unknownRef: TypedVerseRefType | null = null;
    // Where the last chapter and verse ended: the words before the next
    // one start no earlier. A number alone does not move it -- `1 John
    // 3:16`'s `1` is the name's.
    let lastEnd = 0;
    for (const match of line.matchAll(TYPED_REFERENCE_PATTERN)) {
        const start = match.index ?? 0;
        const end = start + match[0].length;
        const from = lastEnd;
        const chapter = Number(toAsciiDigitText(match[1]));
        const spaced =
            match[3] === undefined
                ? SPACED_VERSE_PATTERN.exec(line.slice(end))
                : null;
        const verseText = match[3] ?? spaced?.[1];
        const verseEndText = match[3] === undefined ? spaced?.[2] : match[4];
        const verseStart =
            verseText === undefined
                ? null
                : Number(toAsciiDigitText(verseText));
        const verseEnd =
            verseEndText === undefined
                ? verseStart
                : Number(toAsciiDigitText(verseEndText));
        const isVerse = verseStart !== null;
        if (match[3] !== undefined) {
            lastEnd = end;
        }
        if (
            chapter < 1 ||
            chapter > MAX_CHAPTER ||
            (verseStart !== null &&
                (verseStart < 1 || (verseEnd ?? verseStart) > MAX_VERSE)) ||
            CLOCK_AFTER_PATTERN.test(line.slice(end))
        ) {
            continue;
        }
        const windowStart = Math.max(
            findWindowStart(line, from, start),
            start - windowMax,
        );
        const window = toNameWindow(
            line.slice(windowStart, start).replace(/\s+$/u, ''),
        );
        if (window.trim() === '') {
            continue;
        }
        const sign = match[2] ?? '';
        const verses = !isVerse
            ? ''
            : `:${verseStart}` +
              (verseEnd !== null && verseEnd > verseStart
                  ? `-${verseEnd}`
                  : '');
        const found = findWindowBook(
            window,
            names,
            sign.trim() === '.',
            isVerse,
        );
        if (found !== null && (isVerse || found.book.compact !== null)) {
            const name = found.window.slice(found.book.offset).trim();
            return {
                reference: `${name} ${chapter}${verses}`,
                isBookNamed: true,
            };
        }
        if (unknownRef === null && (sign === ':' || sign === '：')) {
            const word = readUnknownName(window);
            if (word !== null) {
                unknownRef = {
                    reference: `${word} ${chapter}${verses}`,
                    isBookNamed: false,
                };
            }
        }
    }
    return unknownRef;
}

/**
 * Whether an installed Bible is in the language a line is typed in: a book
 * name no Bible gives is then a slip, not a Bible to install.
 */
export function checkHasBibleInLanguage(
    names: StudyBookNamesType,
    langCode: string | null,
) {
    if (langCode === null) {
        return false;
    }
    for (const bible of names.bibleMap.values()) {
        if (bible.lang === langCode) {
            return true;
        }
    }
    return false;
}
