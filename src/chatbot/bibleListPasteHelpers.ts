/**
 * Passages TYPED, PASTED or written inside a paragraph, saved to a Bibles
 * list with no model (2026-11-14, EC-626; the user, with the Presenter's
 * Bibles panel and its **Add Bible Item** button: _as a user I want to add
 * bible item without opening the lookup, just tell chatbot which bible
 * verse and also sometime I carry a list of bible verses_, then a messy
 * list -- `John 3:15 (kjv)`; an indented line with a Khmer Bible's key in
 * brackets, the book in Khmer and Khmer digits; `GEN 1:2-`; John in Khmer
 * with an ASCII chapter and `(niv)` after it -- and _also can extract from
 * a given paragraph, if ambigous bible verse then have to follow up to ask
 * for user input_).
 *
 * EC-515's reader (`bibleListAskHelpers.ts`) takes one line that is all
 * references, in English words; a pasted list ran its lines into one, a
 * version or a verse's words beside a reference made it no reference, and
 * _Add John 3:16_ named no list. Here the passages are found by every
 * installed Bible's book names (`owa_bible_suggest books`, the table
 * `genStudyBookNames` makes): a book in any of their languages, its key
 * (`GEN`) or a short form (`Jn`), a chapter and a verse or a range in any
 * script's digits, a range across chapters, a whole chapter, a second
 * passage of the same book (`John 3:16, 18`, `Romans 5:8; 8:1`), a list's
 * bullets and numbers, a version before or after it in any case --
 * `(kjv)`, `[NIV]`, `ESV` -- or alone on a line over the passages under
 * it, and a verse's words after it. Each passage is handed to
 * `owa_bible_item` as its book's KEY, ASCII digits and the version apart,
 * so the app's parser reads a Khmer book name under the KJV and a key
 * under any Bible.
 *
 * What the words around them ask is read with every passage as
 * `REFERENCE_MARK` (`readBibleListRequest`), a sentence at a time, so the
 * request may be a line above the list, a line under it, the passages'
 * own sentence or one sentence of a paragraph. Another language's request
 * is read by the window with that language's own words (EC-516).
 *
 * What cannot be read one way is ASKED, never guessed: an open range
 * (`GEN 1:2-`: the app reads it to the chapter's end, and it may be one
 * verse cut short), and a book several could be (`Kings 3:5`, `Ph 4:13`).
 * A version no installed Bible is called is the tool's to refuse, and the
 * window asks which Bible then. A book no Bible names, on a line of
 * passages, is said as unread; inside a paragraph it is left alone, as are
 * a time, a ratio and a whole chapter followed by more words (_Acts 2
 * times_). Pure, every rule a test: no store, no tool call, no model.
 */
import { toAsciiDigitText } from '../helper/bibleVerseFindHelpers';
import {
    type BibleListRequestType,
    checkIsBibleListHowTo,
    readBibleListRequest,
    REFERENCE_MARK,
} from './bibleListAskHelpers';
import {
    findTypedBookName,
    readTypedUnknownBookWord,
    type StudyBookNamesType,
    toCompactBookName,
} from './studyVerseCheckHelpers';

/** Longer than this is not a list to save: a document, a chapter's text. */
const MAX_PASTE_LENGTH = 6000;
/** Saved at most in one ask: each is one acting call of the firewall's 25. */
export const MAX_PASTE_PASSAGE_COUNT = 20;
const MAX_PICK_CHOICES = 4;
const MAX_CHAPTER = 150;
const MAX_VERSE = 176;

export type BibleListPassageType = {
    /** As typed, in its own script and digits. */
    written: string;
    /** As the tool reads it: `MAT 5:3-5`. */
    reference: string;
    /** As typed, `kjv`; the tool matches an installed key in any case. */
    version: string | null;
};

export type BibleListChoiceType = {
    /** The button's words: a passage as a Bible writes it. */
    label: string;
    reference: string;
    version: string | null;
};

export type BibleListPickType = {
    /**
     * `range`: an open range. `book`: a book several could be. `version`:
     * a Bible asked for that is not installed (`bibleListSaveHelpers.ts`).
     */
    kind: 'range' | 'book' | 'version';
    written: string;
    choices: BibleListChoiceType[];
    /** The Bible a `version` pick was asked for in. */
    missingVersion?: string;
};

export type BibleListPasteType = BibleListRequestType & {
    passages: BibleListPassageType[];
    picks: BibleListPickType[];
    /** Written as passages, read by no installed Bible's names. */
    unreadable: string[];
    /** Past `MAX_PASTE_PASSAGE_COUNT`: said as not saved. */
    overflow: string[];
};

// A list's mark at a line's start: a bullet, a number with its dot or
// bracket, a tick box. `1 John 3:16`'s `1` is the book's.
const LINE_MARKER_PATTERN =
    /^\s*(?:(?:[-*•·▪◦‣>]+|\(?\p{Nd}{1,3}[.)](?=\s)|\[\s?[xX✓ ]?\s?\])\s*)+/u;
// A chapter: a number no digit, sign of a verse or range is right before.
const NUMBER_PATTERN = /(?<![\p{Nd}:：.,\-–—])\p{Nd}{1,3}(?!\p{Nd})/gu;
// A chapter, then its verse: `3:16`, `3 : 16`, `3.16` (no space round a
// dot: `3. 16` is a sentence's end).
const HEAD_PATTERN =
    /^(\p{Nd}{1,3})(?:(\s*[:：]\s*|\.)(\p{Nd}{1,3}))?(?!\p{Nd})/u;
// A range's end -- `-18`, `-4:2` -- or an open one, `-` with no number.
const RANGE_PATTERN =
    /^(\s*)[-–—](\s*)(?:(\p{Nd}{1,3})(?:\s*[:：.]\s*(\p{Nd}{1,3}))?(?!\p{Nd}))?/u;
// What stands before a second passage of the same book: `, 18`, `; 4:1`,
// `and 18`.
const CONTINUED_GAP_PATTERN = /^\s*(?:[,;&]|\band\b)\s*$/iu;
// A capital and a letter or more ending the words before a number: `Ph`,
// short enough that only the books it could start are asked about.
const SHORT_WORD_PATTERN = /(^|[^\p{L}\p{M}\p{Nd}])(\p{Lu}\p{Ll}{1,2})\.?$/u;
// A time of day said with its half of the day: `10:30 am`.
const CLOCK_AFTER_PATTERN = /^\s*[ap]\.?m\b/i;
// What may follow a whole chapter inside a sentence: its end, a sign, or
// another passage joined on. _Acts 2 times_ is no chapter.
const CHAPTER_END_PATTERN =
    /^(?:\s*$|\s*[,.;:!?)\]}]|\s+(?:and|or|&|plus)\b|\s*[(\[{])/iu;
// A whole chapter the sentence goes on after (_we will read Psalm 23
// together_; 2026-11-14, EC-760: a sermon's paragraph pasted under the
// Bibles panel's line had saved every passage but that one, unsaid):
// taken when its book is written in full, not in lower case, and is not
// one of the books whose name is an everyday word in some language too --
// _Acts 2 times_, _Numbers 3 more_, _Job 2 offers_ stay words.
const WORDS_AFTER_CHAPTER_PATTERN = /^\s+\p{L}/u;
const EVERYDAY_NAME_BOOK_KEY_SET: ReadonlySet<string> = new Set([
    'NUM',
    'JDG',
    'JOB',
    'MRK',
    'ACT',
    'JAS',
    'REV',
    'LAM',
]);
// What may stand between one passage and a book named right after it: a
// version in brackets, then `and` or a sign.
const AFTER_PASSAGE_GAP_PATTERN =
    /^\s*(?:[(\[][^()[\]]{1,16}[)\]]\s*)?(?:(?:[,;&]|\band\b|\bplus\b)\s*)?$/iu;
// And after that book's chapter, besides an end: the ask going on (_to my
// list_) or the next passage (_gen 1 ps 23_).
const AFTER_PASSAGE_CHAPTER_PATTERN =
    /^\s+(?:(?:to|in|into|on|onto|for)\b|\p{L}[\p{L}\p{M}.]*\s*\p{Nd})/iu;
// A sign no book's name carries: where the words before a number stop
// being its name. A dot, a hyphen and an apostrophe stay.
const STOP_CHAR_PATTERN = /[\p{P}\p{S}]/u;
const KEPT_SIGN_SET: ReadonlySet<string> = new Set([
    '.',
    '-',
    '‐',
    '‑',
    "'",
    '’',
]);
// A version in brackets: one short word, no digit.
const BRACKET_VERSION_PATTERN =
    /[(\[{]\s*([^\s()[\]{}\p{Nd},;:]{1,12})\s*[)\]}]/gu;
// A version with no brackets: one short word.
const BARE_VERSION_PATTERN =
    /(?<![\p{L}\p{M}\p{Nd}])([\p{L}][\p{L}\p{M}\p{Nd}]{1,9})(?![\p{L}\p{M}\p{Nd}])/gu;
// What may stand between a passage and its version: a space, a dash, a
// colon or a comma.
const VERSION_GAP_PATTERN = /^[\s\-–—:,]*$/u;
// The English versions people write, as their keys: read as a version
// with no brackets too, installed or not -- one that is not is asked.
const KNOWN_VERSION_SET: ReadonlySet<string> = new Set([
    'akjv',
    'amp',
    'asv',
    'ceb',
    'cev',
    'csb',
    'dra',
    'drb',
    'ehv',
    'erv',
    'esv',
    'gnb',
    'gnt',
    'gw',
    'hcsb',
    'icb',
    'isv',
    'kj21',
    'kjv',
    'leb',
    'lsb',
    'msg',
    'nab',
    'nabre',
    'nasb',
    'nasb95',
    'ncv',
    'net',
    'niv',
    'nirv',
    'nivuk',
    'nkjv',
    'nlt',
    'nlv',
    'nrsv',
    'nrsvue',
    'rsv',
    'rv',
    'tlb',
    'tniv',
    'tpt',
    'web',
    'ylt',
]);

function toPasteText(text: string) {
    return String(text ?? '')
        .normalize('NFC')
        .replace(/\p{Cf}/gu, '')
        .replace(/\r\n?/g, '\n');
}

function checkIsStopChar(char: string) {
    return STOP_CHAR_PATTERN.test(char) && !KEPT_SIGN_SET.has(char);
}

type VersionWordType = { word: string; start: number; end: number };

/**
 * Whether a word is a version's: one an installed Bible is called, one of
 * the English ones people write -- or, in brackets, a word in capitals or
 * of another script than Latin, never `(optional)`.
 */
function checkIsVersionWord(
    word: string,
    installedSet: ReadonlySet<string>,
    isBracketed: boolean,
) {
    const lower = word.toLowerCase();
    if (installedSet.has(lower) || KNOWN_VERSION_SET.has(lower)) {
        return true;
    }
    if (!isBracketed || word.length > 8) {
        return false;
    }
    if (/^\p{Lu}[\p{Lu}\p{Nd}]{1,7}$/u.test(word)) {
        return true;
    }
    return !/\p{Script=Latin}/u.test(word) && /^[\p{L}\p{M}]+$/u.test(word);
}

function findVersionWords(
    text: string,
    installedSet: ReadonlySet<string>,
): VersionWordType[] {
    const found: VersionWordType[] = [];
    for (const match of text.matchAll(BRACKET_VERSION_PATTERN)) {
        if (checkIsVersionWord(match[1], installedSet, true)) {
            found.push({
                word: match[1],
                start: match.index,
                end: match.index + match[0].length,
            });
        }
    }
    for (const match of text.matchAll(BARE_VERSION_PATTERN)) {
        const start = match.index;
        const end = start + match[0].length;
        if (
            !found.some((one) => {
                return start < one.end && end > one.start;
            }) &&
            checkIsVersionWord(match[1], installedSet, false)
        ) {
            found.push({ word: match[1], start, end });
        }
    }
    return found.sort((a, b) => {
        return a.start - b.start;
    });
}

type HitType = {
    /** Where the book starts; a second passage's numbers. */
    start: number;
    end: number;
    written: string;
    /** The passage as the tool reads it; null when only asked about. */
    reference: string | null;
    /** The first passage of its book on the line, or `isContinued`. */
    isContinued: boolean;
    /** Index into the books table; -1 for a book no Bible names. */
    bookIndex: number;
    /** A whole name read off the table; null for a key or short form. */
    compact: string | null;
    pick: BibleListPickType | null;
    isUnreadable: boolean;
    version: string | null;
    hasVerse: boolean;
};

type NumbersType = {
    end: number;
    chapter: number;
    verseStart: number | null;
    verseEnd: number | null;
    endChapter: number | null;
    isOpen: boolean;
    isChapterRange: boolean;
    // `Psalm 1-3`'s 3, or `John 3:16, 18-20`'s 20 once read as verses.
    chapterRangeEnd: number | null;
    sign: string;
};

/** A chapter at `start` and what follows it: a verse, a range, an open end. */
function readNumbers(line: string, start: number): NumbersType | null {
    const head = HEAD_PATTERN.exec(line.slice(start));
    if (head === null) {
        return null;
    }
    const chapter = Number(toAsciiDigitText(head[1]));
    const verseStart =
        head[3] === undefined ? null : Number(toAsciiDigitText(head[3]));
    let end = start + head[0].length;
    let verseEnd = verseStart;
    let endChapter: number | null = null;
    let isOpen = false;
    let isChapterRange = false;
    let chapterRangeEnd: number | null = null;
    const range = RANGE_PATTERN.exec(line.slice(end));
    if (range !== null) {
        const [whole, spaceBefore, spaceAfter, first, second] = range;
        const isSpaced = spaceBefore !== '' || spaceAfter !== '';
        if (first === undefined) {
            // `GEN 1:2-` is open; `John 3:16 - For God so loved` is a dash
            // before its words.
            if (spaceBefore === '' && verseStart !== null) {
                isOpen = true;
                end += whole.length;
            }
        } else if (!(
            isSpaced &&
            second === undefined &&
            /^\s+\p{L}/u.test(line.slice(end + whole.length))
        )) {
            if (verseStart === null) {
                isChapterRange = second === undefined;
                chapterRangeEnd = Number(toAsciiDigitText(first));
                if (second !== undefined) {
                    // `Psalm 1-3:4`: no reading of it.
                    isChapterRange = true;
                }
            } else if (second !== undefined) {
                endChapter = Number(toAsciiDigitText(first));
                verseEnd = Number(toAsciiDigitText(second));
            } else {
                verseEnd = Number(toAsciiDigitText(first));
            }
            end += whole.length;
        }
    }
    return {
        end,
        chapter,
        verseStart,
        verseEnd,
        endChapter,
        isOpen,
        isChapterRange,
        chapterRangeEnd,
        sign: head[2]?.trim() ?? '',
    };
}

function checkIsInRange(numbers: NumbersType) {
    const { chapter, verseStart, verseEnd, endChapter } = numbers;
    if (chapter < 1 || chapter > MAX_CHAPTER) {
        return false;
    }
    if (verseStart === null) {
        return true;
    }
    if (verseStart < 1 || (verseEnd ?? verseStart) > MAX_VERSE) {
        return false;
    }
    return (
        endChapter === null ||
        (endChapter > chapter && endChapter <= MAX_CHAPTER)
    );
}

/** `GEN 3`, `GEN 3:16`, `GEN 3:16-18`, `GEN 3:16-4:2`, `GEN 3:16-`. */
function toToolReference(bookKey: string, numbers: NumbersType) {
    const { chapter, verseStart, verseEnd, endChapter, isOpen } = numbers;
    if (verseStart === null) {
        return `${bookKey} ${chapter}`;
    }
    if (isOpen) {
        return `${bookKey} ${chapter}:${verseStart}-`;
    }
    if (endChapter !== null) {
        return `${bookKey} ${chapter}:${verseStart}-${endChapter}:${verseEnd}`;
    }
    return (
        `${bookKey} ${chapter}:${verseStart}` +
        (verseEnd !== null && verseEnd > verseStart ? `-${verseEnd}` : '')
    );
}

function toBookKey(names: StudyBookNamesType, index: number) {
    return names.bookKeys[index] || names.english[index] || '';
}

/** A book as a Bible writes it, for a button: the name the words started. */
function findBookDisplayName(
    names: StudyBookNamesType,
    index: number,
    wordCompact: string,
) {
    const english = names.english[index] ?? '';
    if (toCompactBookName(english).startsWith(wordCompact)) {
        return english;
    }
    for (const bible of names.bibleMap.values()) {
        const name = bible.books[index] ?? '';
        if (name !== '' && toCompactBookName(name).startsWith(wordCompact)) {
            return name;
        }
    }
    return english;
}

/**
 * The books a word could be: `Kings` 1 or 2 Kings (a numbered book named
 * without its number, in any Bible's names), `Ph` Philippians or
 * Philemon (a capital and two letters or more that several names start).
 * None, or more than four, is no question worth asking.
 */
function findBookCandidates(word: string, names: StudyBookNamesType) {
    const compact = toCompactBookName(word);
    const indexList: number[] = [];
    const nameList: string[] = [];
    const add = (index: number, name: string) => {
        if (!indexList.includes(index)) {
            indexList.push(index);
            nameList.push(name);
        }
    };
    for (const number of ['1', '2', '3']) {
        for (const one of [
            `${number}${compact}`,
            `${number}${compact}s`,
            compact.endsWith('s') ? `${number}${compact.slice(0, -1)}` : '',
        ]) {
            const entry = one === '' ? undefined : names.nameMap.get(one);
            if (entry !== undefined) {
                add(entry.index, findBookDisplayName(names, entry.index, one));
                break;
            }
        }
    }
    if (
        indexList.length === 0 &&
        compact.length >= 2 &&
        /^\p{Lu}/u.test(word) &&
        /\p{Script=Latin}/u.test(word)
    ) {
        for (const one of names.spacedList) {
            if (one.compact.startsWith(compact)) {
                add(one.index, findBookDisplayName(names, one.index, compact));
            }
        }
    }
    return indexList.length === 0 || indexList.length > MAX_PICK_CHOICES
        ? []
        : indexList.map((index, at) => {
              return { index, name: nameList[at] };
          });
}

/**
 * The version a passage is read in when none is written: the Bible that
 * names its book so, when only other languages' Bibles write the name --
 * Matthew written in Khmer is read in the Khmer Bible, not the Lookup's
 * KJV.
 */
function findNamingVersion(names: StudyBookNamesType, compact: string | null) {
    if (compact === null) {
        return null;
    }
    const entry = names.nameMap.get(compact);
    if (entry === undefined || entry.langs.includes('en')) {
        return null;
    }
    return entry.sources[0]?.key ?? null;
}

// Where the words before a number start: after the last sign no book's
// name carries, and no earlier than `from`.
function findWindowStart(line: string, from: number, to: number) {
    for (let index = to - 1; index >= from; index--) {
        if (checkIsStopChar(line[index])) {
            return index + 1;
        }
    }
    return from;
}

/**
 * Every passage on one line. `isListLine`: a line that starts with one --
 * a whole chapter needs no capital or whole name there, and a book no
 * Bible names is said as unread.
 */
function scanLine(
    line: string,
    names: StudyBookNamesType,
    isListLine: boolean,
): HitType[] {
    const hits: HitType[] = [];
    const windowMax = names.maxLength * 2 + 12;
    let lastEnd = 0;
    // The book the next `, 18` or `; 4:1` belongs to.
    let last: {
        bookIndex: number;
        compact: string | null;
        bookWritten: string;
        chapter: number;
        hasVerse: boolean;
    } | null = null;
    for (const match of line.matchAll(NUMBER_PATTERN)) {
        const start = match.index;
        if (start < lastEnd) {
            continue;
        }
        const numbers = readNumbers(line, start);
        if (
            numbers === null ||
            CLOCK_AFTER_PATTERN.test(line.slice(numbers.end))
        ) {
            continue;
        }
        const isVerse = numbers.verseStart !== null;
        const windowStart = Math.max(
            findWindowStart(line, lastEnd, start),
            start - windowMax,
        );
        const window = line.slice(windowStart, start).replace(/\s+$/u, '');
        const gap = line.slice(lastEnd, start);
        // A second passage of the line's book: no words before its number.
        if (last !== null && CONTINUED_GAP_PATTERN.test(gap)) {
            // `, 1 John 4:8` names a book; `and 17 people came` no verse.
            const isBookNumber =
                !isVerse &&
                (numbers.chapter <= 3 || !/[,;]/u.test(gap)) &&
                /^\s+\p{L}/u.test(line.slice(numbers.end));
            const continued: NumbersType =
                !isVerse && last.hasVerse
                    ? {
                          ...numbers,
                          chapter: last.chapter,
                          verseStart: numbers.chapter,
                          verseEnd: numbers.chapterRangeEnd ?? numbers.chapter,
                          endChapter: null,
                          isOpen: false,
                          isChapterRange: false,
                      }
                    : numbers;
            if (!isBookNumber && checkIsInRange(continued)) {
                const numbersText = line.slice(start, numbers.end).trim();
                hits.push(
                    toHit({
                        names,
                        start,
                        end: numbers.end,
                        written:
                            !isVerse && last.hasVerse
                                ? `${last.bookWritten} ${last.chapter}:${numbersText}`
                                : `${last.bookWritten} ${numbersText}`,
                        bookIndex: last.bookIndex,
                        compact: last.compact,
                        numbers: continued,
                        isContinued: true,
                    }),
                );
                lastEnd = numbers.end;
                continue;
            }
        }
        if (window.trim() === '') {
            continue;
        }
        const found = findTypedBookName(
            window,
            names,
            numbers.sign === '.',
            isVerse || isListLine,
            true,
        );
        // Right after another passage, with nothing but `and` or a comma
        // between, a book is a book in any case and with a chapter alone
        // (2026-11-14, EC-703: "john 3:16 gen 1" had saved John 3:16 and
        // left "gen 1" as words the request could not be read past).
        const isAfterPassage =
            found !== null &&
            hits.length > 0 &&
            AFTER_PASSAGE_GAP_PATTERN.test(
                line.slice(lastEnd, windowStart + found.offset),
            );
        // A short form typed in lower case is a book only there, before a
        // verse, or as the first word of a line of passages.
        const book =
            found !== null &&
            found.isLowerShort === true &&
            !isVerse &&
            !isAfterPassage &&
            !(
                isListLine &&
                /^[\s\-–—•*·]*$/u.test(
                    line.slice(0, windowStart + found.offset),
                )
            )
                ? null
                : found;
        if (book !== null && book.index >= 0) {
            const after = line.slice(numbers.end);
            const isChapterTaken =
                isVerse ||
                isListLine ||
                (book.compact !== null && CHAPTER_END_PATTERN.test(after)) ||
                (book.compact !== null &&
                    WORDS_AFTER_CHAPTER_PATTERN.test(after) &&
                    !/^\p{Ll}/u.test(
                        line.slice(windowStart + book.offset, start),
                    ) &&
                    !EVERYDAY_NAME_BOOK_KEY_SET.has(
                        toBookKey(names, book.index),
                    )) ||
                (isAfterPassage &&
                    (CHAPTER_END_PATTERN.test(after) ||
                        AFTER_PASSAGE_CHAPTER_PATTERN.test(after)));
            if (!isChapterTaken || !checkIsInRange(numbers)) {
                last = null;
                continue;
            }
            const bookStart = windowStart + book.offset;
            const bookWritten = line.slice(bookStart, start).trim();
            hits.push(
                toHit({
                    names,
                    start: bookStart,
                    end: numbers.end,
                    written: line.slice(bookStart, numbers.end).trim(),
                    bookIndex: book.index,
                    compact: book.compact,
                    numbers,
                    isContinued: false,
                }),
            );
            lastEnd = numbers.end;
            last = {
                bookIndex: book.index,
                compact: book.compact,
                bookWritten,
                chapter: numbers.endChapter ?? numbers.chapter,
                hasVerse: isVerse,
            };
            continue;
        }
        last = null;
        // A word no Bible names a book by: asked when several books could
        // be meant, said as unread on a line of passages.
        if (!isVerse || !checkIsInRange(numbers)) {
            continue;
        }
        const short = SHORT_WORD_PATTERN.exec(window);
        const unknown =
            readTypedUnknownBookWord(window) ??
            (short === null
                ? null
                : {
                      word: short[2],
                      offset: short.index + short[1].length,
                  });
        if (unknown === null) {
            continue;
        }
        const bookStart = windowStart + unknown.offset;
        const written = line.slice(bookStart, numbers.end).trim();
        const candidates = findBookCandidates(unknown.word, names);
        if (candidates.length === 0 && !isListLine) {
            continue;
        }
        const numbersText = line.slice(start, numbers.end).trim();
        hits.push({
            start: bookStart,
            end: numbers.end,
            written,
            reference: null,
            isContinued: false,
            bookIndex: -1,
            compact: null,
            pick:
                candidates.length === 0 || numbers.isOpen
                    ? null
                    : {
                          kind: 'book',
                          written,
                          choices: candidates.map(({ index, name }) => {
                              return {
                                  label: `${name} ${numbersText}`,
                                  reference: toToolReference(
                                      toBookKey(names, index),
                                      numbers,
                                  ),
                                  version: null,
                              };
                          }),
                      },
            isUnreadable: candidates.length === 0 || numbers.isOpen,
            version: null,
            hasVerse: true,
        });
        lastEnd = numbers.end;
    }
    return hits;
}

function toHit(options: {
    names: StudyBookNamesType;
    start: number;
    end: number;
    written: string;
    bookIndex: number;
    compact: string | null;
    numbers: NumbersType;
    isContinued: boolean;
}): HitType {
    const { names, start, end, written, bookIndex, compact, numbers } = options;
    const bookKey = toBookKey(names, bookIndex);
    const base = {
        start,
        end,
        written,
        isContinued: options.isContinued,
        bookIndex,
        compact,
        version: findNamingVersion(names, compact),
        hasVerse: numbers.verseStart !== null,
    };
    if (numbers.isChapterRange || bookKey === '') {
        return { ...base, reference: null, pick: null, isUnreadable: true };
    }
    if (numbers.isOpen) {
        const reference = toToolReference(bookKey, numbers);
        const single = toToolReference(bookKey, {
            ...numbers,
            isOpen: false,
            verseEnd: numbers.verseStart,
        });
        return {
            ...base,
            reference: null,
            pick: {
                kind: 'range',
                written,
                choices: [
                    { label: written, reference, version: null },
                    {
                        label: written.replace(/\s*[-–—]\s*$/u, ''),
                        reference: single,
                        version: null,
                    },
                ],
            },
            isUnreadable: false,
        };
    }
    return {
        ...base,
        reference: toToolReference(bookKey, numbers),
        pick: null,
        isUnreadable: false,
    };
}

/**
 * The version each passage of a line is read in: a version word right
 * after a passage (and the passages joined to it) is theirs; one right
 * before a passage is its own and its joined ones'. A line's words -- a
 * version alone on it -- give `fallback`.
 */
function applyVersions(
    line: string,
    hits: HitType[],
    installedSet: ReadonlySet<string>,
    fallback: string | null,
) {
    const taken: { start: number; end: number }[] = [];
    const versionList = findVersionWords(line, installedSet).filter((one) => {
        return !hits.some((hit) => {
            return one.start < hit.end && one.end > hit.start;
        });
    });
    // The groups: a passage and the ones joined to it.
    const groups: HitType[][] = [];
    for (const hit of hits) {
        if (hit.isContinued && groups.length > 0) {
            groups[groups.length - 1].push(hit);
        } else {
            groups.push([hit]);
        }
    }
    const groupVersions: (string | null)[] = groups.map(() => {
        return null;
    });
    for (const one of versionList) {
        let beforeIndex = -1;
        groups.forEach((group, index) => {
            if (group[group.length - 1].end <= one.start) {
                beforeIndex = index;
            }
        });
        const afterIndex = groups.findIndex((group) => {
            return group[0].start >= one.end;
        });
        if (
            beforeIndex >= 0 &&
            groupVersions[beforeIndex] === null &&
            VERSION_GAP_PATTERN.test(
                line.slice(
                    groups[beforeIndex][groups[beforeIndex].length - 1].end,
                    one.start,
                ),
            )
        ) {
            groupVersions[beforeIndex] = one.word;
            taken.push(one);
            continue;
        }
        if (
            afterIndex >= 0 &&
            groupVersions[afterIndex] === null &&
            VERSION_GAP_PATTERN.test(
                line.slice(one.end, groups[afterIndex][0].start),
            )
        ) {
            groupVersions[afterIndex] = one.word;
            taken.push(one);
        }
    }
    groups.forEach((group, index) => {
        const version = groupVersions[index] ?? fallback;
        for (const hit of group) {
            if (version !== null) {
                hit.version = version;
            }
            for (const choice of hit.pick?.choices ?? []) {
                choice.version = version ?? hit.version;
            }
        }
    });
    return taken;
}

/** A line that is only a version, `NIV` or `(ESV)`: the lines under it. */
function readVersionLine(line: string, installedSet: ReadonlySet<string>) {
    const words = findVersionWords(line, installedSet);
    if (words.length !== 1) {
        return null;
    }
    const [one] = words;
    const rest = line.slice(0, one.start) + line.slice(one.end);
    return /^[\s:\-–—]*$/u.test(rest) ? one.word : null;
}

/** The text with a span made `REFERENCE_MARK`. */
function maskSpans(line: string, spans: { start: number; end: number }[]) {
    let masked = line;
    for (const span of [...spans].sort((a, b) => {
        return b.start - a.start;
    })) {
        masked =
            masked.slice(0, span.start) +
            ` ${REFERENCE_MARK} ` +
            masked.slice(span.end);
    }
    return masked;
}

/** The sentences of a text, with each passage as `REFERENCE_MARK`. */
function splitSentences(masked: string) {
    return (
        masked
            // Any script's full stop ends a sentence, not only `.`, `!`, `?`.
            // A colon ends one too, and stays: what follows it may be the
            // passages the sentence asks about.
            .split(/\n|(?<=\p{Sentence_Terminal})\s*|(?<=:)(?=\s|$)/u)
            .map((sentence) => {
                return sentence.replace(LINE_MARKER_PATTERN, '').trim();
            })
            .filter((sentence) => {
                return sentence !== '';
            })
    );
}

function checkIsMarkOnly(sentence: string) {
    return new RegExp(
        String.raw`^(?:[\s,;&.!?:()\[\]{}\-–—"“”'‘’]|and|or|plus|${REFERENCE_MARK})*$`,
        'iu',
    ).test(sentence);
}

const REQUEST_VERB_PATTERN =
    /\b(?:add|save|put|keep|store|bookmark|insert|include|append|pin|make|create|start|build|set\s+up)\b/iu;

/**
 * Whether a line is worth reading the Bibles' book names for: a digit, a
 * request's verb in English or a request in another language read by the
 * window, never a `/` command or a text longer than a list.
 */
export function checkMayBeBibleListPaste(
    text: string,
    hasTypedRequest = false,
) {
    const pasted = toPasteText(text).trim();
    return (
        pasted !== '' &&
        !pasted.startsWith('/') &&
        pasted.length <= MAX_PASTE_LENGTH &&
        /\p{Nd}/u.test(pasted) &&
        (hasTypedRequest || REQUEST_VERB_PATTERN.test(pasted))
    );
}

/**
 * The line the box is handed by the Bibles panel's **Add Bible Item** →
 * **Open in Chatbot** (2026-11-14, EC-760), for a text pasted under it:
 * one sentence the English reader takes as a request to save to the
 * Bibles list, whatever the text under it says. The window writes it in
 * its own language with a literal `tran` key of these words.
 */
export const BIBLE_LIST_PASTE_LEAD =
    'Add the Bible passages in this text to my Bibles list:';

/**
 * The text read with that line in English when it starts with the line as
 * the window wrote it (`shownLead`), so a person's own language asks the
 * English reader -- their passages and words are left as they are.
 */
export function toEnglishBibleListPasteLead(text: string, shownLead: string) {
    const lead = shownLead.trim();
    const typed = text.trimStart();
    if (
        lead === '' ||
        lead === BIBLE_LIST_PASTE_LEAD ||
        !typed.startsWith(lead)
    ) {
        return text;
    }
    return `${BIBLE_LIST_PASTE_LEAD}\n${typed.slice(lead.length)}`;
}

/** Whether a text starts with that line, as written or in English. */
export function checkHasBibleListPasteLead(text: string, shownLead: string) {
    return toEnglishBibleListPasteLead(text, shownLead)
        .trimStart()
        .startsWith(BIBLE_LIST_PASTE_LEAD);
}

export type ReadTypedRequestType = (
    text: string,
) => BibleListRequestType | null;

/**
 * The passages a text asks to save to a Bibles list, and which list -- or
 * null when it asks for nothing of the kind: no passage, no request, a
 * how-to. `installedKeys`: the installed Bibles' keys, read as versions
 * with no brackets. `readTypedRequest`: another language's request read
 * by its own words -- handed the text's words with its first passage as
 * typed, the passages' place being where that reader looks for one.
 * `carriedRequest`: the request of a question above, for a text of
 * passages and nothing else (`findCarriedBibleListRequest`, EC-703).
 */
export function readBibleListPaste(
    text: string,
    names: StudyBookNamesType,
    options: {
        installedKeys?: readonly string[];
        readTypedRequest?: ReadTypedRequestType;
        carriedRequest?: BibleListRequestType | null;
    } = {},
): BibleListPasteType | null {
    const pasted = toPasteText(text);
    if (
        pasted.trim() === '' ||
        pasted.trim().startsWith('/') ||
        pasted.length > MAX_PASTE_LENGTH
    ) {
        return null;
    }
    const installedSet = new Set(
        [...(options.installedKeys ?? []), ...names.bibleMap.keys()].map(
            (key) => {
                return key.toLowerCase();
            },
        ),
    );
    const hits: HitType[] = [];
    const maskedLines: string[] = [];
    let lineVersion: string | null = null;
    for (const rawLine of pasted.split('\n')) {
        const marker = LINE_MARKER_PATTERN.exec(rawLine)?.[0] ?? '';
        const line = rawLine.slice(marker.length);
        const versionLine = readVersionLine(line, installedSet);
        if (versionLine !== null) {
            lineVersion = versionLine;
            maskedLines.push('');
            continue;
        }
        if (line.trim() === '') {
            lineVersion = null;
            maskedLines.push('');
            continue;
        }
        let lineHits = scanLine(line, names, true);
        // A line of passages starts with one, a version or a bullet before
        // it at most; any other line is a sentence, read strictly.
        const first = lineHits[0];
        const lead = first === undefined ? line : line.slice(0, first.start);
        const isListLine =
            first !== undefined &&
            !first.isContinued &&
            (first.hasVerse ||
                CHAPTER_END_PATTERN.test(line.slice(first.end))) &&
            /^[\s\-–—:]*$/u.test(
                lead
                    .replace(BRACKET_VERSION_PATTERN, ' ')
                    .replace(BARE_VERSION_PATTERN, (word) => {
                        return checkIsVersionWord(word, installedSet, false)
                            ? ' '
                            : word;
                    }),
            );
        if (!isListLine) {
            lineHits = scanLine(line, names, false);
        }
        const versionSpans = applyVersions(
            line,
            lineHits,
            installedSet,
            isListLine ? lineVersion : null,
        );
        hits.push(...lineHits);
        maskedLines.push(maskSpans(line, [...lineHits, ...versionSpans]));
    }
    if (hits.length === 0) {
        return null;
    }
    const sentences = splitSentences(maskedLines.join('\n'));
    if (
        sentences.some((sentence) => {
            return (
                checkIsBibleListHowTo(sentence) &&
                REQUEST_VERB_PATTERN.test(sentence)
            );
        })
    ) {
        return null;
    }
    let request: BibleListRequestType | null = null;
    for (const [index, sentence] of sentences.entries()) {
        if (checkIsMarkOnly(sentence)) {
            continue;
        }
        // _Add to my Bibles list:_ and the passages after it: a request
        // whose passages stand after its colon (EC-703).
        const next = sentences[index + 1];
        const isLeadIn =
            sentence.endsWith(':') &&
            !sentence.includes(REFERENCE_MARK) &&
            next !== undefined &&
            next.includes(REFERENCE_MARK);
        request = readBibleListRequest(
            isLeadIn ? `${sentence} ${REFERENCE_MARK}` : sentence,
        );
        if (request !== null) {
            break;
        }
    }
    if (
        request === null &&
        options.carriedRequest !== undefined &&
        options.carriedRequest !== null &&
        sentences.every(checkIsMarkOnly)
    ) {
        request = options.carriedRequest;
    }
    if (request === null && options.readTypedRequest !== undefined) {
        const words = sentences
            .filter((sentence) => {
                return !checkIsMarkOnly(sentence);
            })
            .map((sentence) => {
                return sentence.replace(/:$/u, '');
            })
            .join(' ')
            .replaceAll(REFERENCE_MARK, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        request =
            words === ''
                ? null
                : options.readTypedRequest(`${words} ${hits[0].written}`);
    }
    if (request === null) {
        return null;
    }
    const passages: BibleListPassageType[] = [];
    const overflow: string[] = [];
    const picks: BibleListPickType[] = [];
    const unreadable: string[] = [];
    for (const hit of hits) {
        if (hit.pick !== null) {
            picks.push(hit.pick);
        } else if (hit.reference === null || hit.isUnreadable) {
            unreadable.push(hit.written);
        } else if (passages.length < MAX_PASTE_PASSAGE_COUNT) {
            passages.push({
                written: hit.written,
                reference: hit.reference,
                version: hit.version,
            });
        } else {
            overflow.push(hit.written);
        }
    }
    return { ...request, passages, picks, unreadable, overflow };
}

/**
 * A pick as a saved button carries it, checked field by field: a saved
 * conversation is a file anyone can edit.
 */
export function toValidBibleListPicks(value: unknown): BibleListPickType[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const toText = (one: unknown, max: number) => {
        return typeof one === 'string' && one.length <= max ? one : null;
    };
    return value
        .slice(0, MAX_PASTE_PASSAGE_COUNT)
        .flatMap((one: any): BibleListPickType[] => {
            const kind =
                one?.kind === 'range' || one?.kind === 'version'
                    ? one.kind
                    : 'book';
            const written = toText(one?.written, 120);
            const missingVersion =
                kind === 'version' ? toText(one?.missingVersion, 40) : null;
            const choices = Array.isArray(one?.choices)
                ? one.choices
                      .slice(0, MAX_PICK_CHOICES)
                      .flatMap((choice: any): BibleListChoiceType[] => {
                          const label = toText(choice?.label, 120);
                          const reference = toText(choice?.reference, 60);
                          const isVersionless =
                              choice?.version === null ||
                              choice?.version === undefined;
                          const version = isVersionless
                              ? null
                              : toText(choice?.version, 40);
                          return label === null ||
                              reference === null ||
                              label === '' ||
                              reference === '' ||
                              (!isVersionless && version === null)
                              ? []
                              : [{ label, reference, version }];
                      })
                : [];
            if (
                written === null ||
                choices.length === 0 ||
                (kind === 'version' && missingVersion === null)
            ) {
                return [];
            }
            return [
                {
                    kind,
                    written,
                    choices,
                    ...(missingVersion === null ? {} : { missingVersion }),
                },
            ];
        });
}
