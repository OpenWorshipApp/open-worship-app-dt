/**
 * Checking the Bible references a STUDY FILE cites (2026-11-11, EC-497).
 *
 * Asked _Are the cross references in this study file right?_ about the
 * user's John 3 study, gemma4:cloud read the Amplified Bible's own bracketed
 * notes inside the quoted passage (`[Ezek. 36:25-27.]`) as the study's
 * references and called them right. The study's Cross References were never
 * read, and its translated part named Titus as the French Bibles do, Ezekiel
 * as no installed Bible does and Numbers by the everyday word for a number.
 * Like a note's verse check (`toNoteVerseReadText`), the WINDOW now reads
 * every reference the study cites before the model is asked -- from the
 * Bible the part around it quotes -- and the ask carries each verse's words
 * beside the study's line.
 *
 * Pure: the book names every installed Bible writes (`owa_bible_suggest
 * books`) made one table, the references found in the study's own words
 * (never in a quoted passage, a diagram or a code block), the `owa_find_verse
 * refs` calls that read them, and the text the ask carries. The window reads
 * the file, the names and the verses.
 *
 * - A reference is a chapter and verse (`3:16`, `3:16-18`, in any script's
 *   digits; `3.16` only after a known book) with a book before it written as
 *   an installed Bible or the English names write it -- a name in a script
 *   written with spaces starts a word and does not start in lower case; one
 *   written without spaces may end a run of letters -- or a word of three
 *   letters or more that only one such name starts with (`Num.`, `1 Pet`).
 *   `Romans 5:8; 8:1` reads the second as Romans too.
 * - A part of the study is the words after a passage it quotes (`> **John
 *   3:1-36** (KJV)`), read from that Bible. A reference to a verse of that
 *   passage is not read again: the study quotes it.
 * - A book named as no installed Bible names it is listed, never guessed; one
 *   named as only Bibles of ANOTHER language name it is read and said so,
 *   with the name the part's own Bible gives it.
 */
import {
    STUDY_FILE_MAX_CHARS,
    splitStudyForTranslation,
} from '../helper/agentStudyFileRules';
import {
    MAX_FIND_REFS,
    checkIsSpacedLocale,
    toAsciiDigitText,
} from '../helper/bibleVerseFindHelpers';

/** A study read whole for a check: the most a study file holds. */
export const STUDY_CHECK_READ_MAX_CHARS = STUDY_FILE_MAX_CHARS;
/** At most this many references are read for one check. */
export const STUDY_CHECK_MAX_REFS = 24;
// Names no installed Bible gives a book, listed at most.
const STUDY_CHECK_MAX_UNKNOWNS = 8;
// What `owa_find_verse` reads of one call's `refs`.
const STUDY_CALL_MAX_CHARS = 400;
// The study's line shown above its references.
const STUDY_LINE_MAX_CHARS = 240;
const UNKNOWN_WORD_MAX_CHARS = 30;
// A chapter and a verse no book of the Bible reaches: a time, a ratio.
const MAX_CHAPTER = 150;
const MAX_VERSE = 176;
// A part's Bible whose names are mostly the English ones needs no list.
const ENGLISH_LIKE_SHARE = 0.5;

const STUDY_CHECK_FILE_PATTERN = /\.(?:md|markdown|txt)$/i;

/**
 * Whether an attachment is a file whose words a verse check reads: a
 * Markdown or plain text file -- a study -- and never one of the app's own
 * documents, which their own conversations check.
 */
export function checkIsStudyCheckFile(attachment: {
    kind?: string;
    filePath?: string;
    noteId?: number;
}) {
    return (
        attachment.kind === 'text' &&
        typeof attachment.filePath === 'string' &&
        attachment.noteId === undefined &&
        STUDY_CHECK_FILE_PATTERN.test(attachment.filePath)
    );
}

type BookSourceType = { key: string; locale: string };

type BookNameEntryType = {
    index: number;
    // The languages whose Bibles, or the English names, write it so.
    langs: string[];
    sources: BookSourceType[];
    isSpaced: boolean;
};

type StudyBibleType = {
    key: string;
    locale: string;
    lang: string;
    books: string[];
};

export type StudyBookNamesType = {
    english: string[];
    bookKeys: string[];
    nameMap: Map<string, BookNameEntryType>;
    spacedList: { compact: string; index: number }[];
    maxLength: number;
    bibleMap: Map<string, StudyBibleType>;
};

/** A book's name as it is compared: one case, no spaces, dots or joiners. */
function toCompactName(text: string) {
    return toAsciiDigitText(
        String(text ?? '')
            .normalize('NFKC')
            .toLowerCase(),
    ).replace(/[\s.\p{Cf}]/gu, '');
}

function toLangCode(locale: string) {
    return (locale.trim().split(/[-_]/)[0] ?? '').toLowerCase();
}

function toStringList(value: unknown) {
    return Array.isArray(value)
        ? value.map((one) => {
              return typeof one === 'string' ? one : '';
          })
        : [];
}

/**
 * The book names of `owa_bible_suggest books` made one table: each name to
 * its book, the languages and Bibles that write it so, and whether it is a
 * word of a script written with spaces. Null when the answer holds no names.
 */
export function genStudyBookNames(value: unknown): StudyBookNamesType | null {
    const data = (value ?? {}) as Record<string, unknown>;
    const english = toStringList(data.english);
    if (english.length === 0) {
        return null;
    }
    const bookKeyList = toStringList(data.bookKeys);
    const nameMap = new Map<string, BookNameEntryType>();
    const bibleMap = new Map<string, StudyBibleType>();
    const addName = (
        name: string,
        index: number,
        lang: string,
        isSpaced: boolean,
        sources: BookSourceType[],
    ) => {
        const compact = toCompactName(name);
        if (compact.length === 0) {
            return;
        }
        let entry = nameMap.get(compact);
        if (entry === undefined) {
            entry = { index, langs: [], sources: [], isSpaced };
            nameMap.set(compact, entry);
        } else if (entry.index !== index) {
            // Two books under one name: the first one named keeps it.
            return;
        }
        entry.isSpaced = entry.isSpaced || isSpaced;
        if (lang !== '' && !entry.langs.includes(lang)) {
            entry.langs.push(lang);
        }
        entry.sources.push(...sources);
    };
    english.forEach((name, index) => {
        addName(name, index, 'en', true, []);
    });
    const bibleList = Array.isArray(data.bibles) ? data.bibles : [];
    for (const one of bibleList) {
        const keys = toStringList(
            one?.keys ?? (typeof one?.key === 'string' ? [one.key] : []),
        ).filter((key) => {
            return key.trim() !== '';
        });
        const locale = typeof one?.locale === 'string' ? one.locale.trim() : '';
        const books = toStringList(one?.books);
        if (keys.length === 0 || books.length !== english.length) {
            continue;
        }
        const lang = toLangCode(locale);
        const isSpaced = locale === '' || checkIsSpacedLocale(locale);
        const sources = keys.map((key) => {
            return { key, locale };
        });
        for (const key of keys) {
            bibleMap.set(key, { key, locale, lang, books });
        }
        books.forEach((name, index) => {
            addName(name, index, lang, isSpaced, sources);
        });
    }
    let maxLength = 0;
    const spacedList: { compact: string; index: number }[] = [];
    for (const [compact, entry] of nameMap) {
        maxLength = Math.max(maxLength, compact.length);
        if (entry.isSpaced) {
            spacedList.push({ compact, index: entry.index });
        }
    }
    return {
        english,
        bookKeys: bookKeyList.length === english.length ? bookKeyList : [],
        nameMap,
        spacedList,
        maxLength,
        bibleMap,
    };
}

/** An installed Bible by the key a quoted passage names, case aside. */
function findStudyBible(names: StudyBookNamesType, key: string | null) {
    if (key === null) {
        return null;
    }
    const exact = names.bibleMap.get(key);
    if (exact !== undefined) {
        return exact;
    }
    const wanted = key.toLowerCase();
    for (const bible of names.bibleMap.values()) {
        if (bible.key.toLowerCase() === wanted) {
            return bible;
        }
    }
    return null;
}

// --- finding the references on a line ---------------------------------------

// A chapter and a verse or a range, in any script's digits, nothing between
// them but the sign (`Part 2: 4 steps` is no reference). A range's end
// followed by a colon is the next chapter's (`3:16-4:2`), so not taken.
const CHAPTER_VERSE_PATTERN =
    /(?<![\p{Nd}:：.])(\p{Nd}{1,3})([:：.])(\p{Nd}{1,3})(?:\s*[-–—]\s*(\p{Nd}{1,3})(?![:：.]\p{Nd}))?(?!\p{Nd})/gu;
// A sign a book's name never carries: where the words before a reference
// stop being its name. A dot, a hyphen and an apostrophe stay.
const STOP_CHAR_PATTERN = /[\p{P}\p{S}]/u;
const KEPT_SIGN_SET: ReadonlySet<string> = new Set([
    '.',
    '-',
    '‐',
    '‑',
    "'",
    '’',
]);
// The word right before a reference, an abbreviation's dot after it.
const LAST_WORD_PATTERN =
    /(^|[^\p{L}\p{M}\p{Nd}])((?:\p{Nd}\s*)?\p{L}[\p{L}\p{M}]*)\.?$/u;
const CLOCK_AFTER_PATTERN = /^\s*[ap]\.?m\b/i;

type LineHitType =
    | {
          kind: 'ref';
          start: number;
          written: string;
          index: number;
          // The name as the table holds it; null for an abbreviation.
          compact: string | null;
          chapter: number;
          verseStart: number;
          verseEnd: number;
      }
    | { kind: 'unknown'; start: number; written: string; word: string };

function checkIsStopChar(char: string) {
    return STOP_CHAR_PATTERN.test(char) && !KEPT_SIGN_SET.has(char);
}

/**
 * A name in the table as written, or with an `s` more or less: the KJV
 * calls the book "Psalm", a study "Psalms" (the resolver's own tolerance,
 * `resolveBookKey`).
 */
function lookupBookName(compact: string, names: StudyBookNamesType) {
    for (const one of [
        compact,
        `${compact}s`,
        compact.endsWith('s') ? compact.slice(0, -1) : '',
    ]) {
        const entry = one === '' ? undefined : names.nameMap.get(one);
        if (entry !== undefined) {
            return { compact: one, entry };
        }
    }
    return null;
}

/** The book a reference's words end with, by its whole name. */
function findWholeBookName(text: string, names: StudyBookNamesType) {
    for (let start = 0; start < text.length; start++) {
        if (!/[\p{L}\p{Nd}]/u.test(text[start])) {
            continue;
        }
        const tail = text.slice(start);
        const compact = toCompactName(tail);
        if (compact.length > names.maxLength + 1) {
            continue;
        }
        const found = lookupBookName(compact, names);
        if (found === null) {
            continue;
        }
        const { entry } = found;
        if (entry.isSpaced) {
            if (start > 0 && /[\p{L}\p{M}\p{Nd}]/u.test(text[start - 1])) {
                continue;
            }
            const firstLetter = /\p{L}/u.exec(tail)?.[0] ?? '';
            if (/\p{Ll}/u.test(firstLetter)) {
                continue;
            }
        }
        return { index: entry.index, compact: found.compact, offset: start };
    }
    return null;
}

/** The book a written-short name (`Num.`, `1 Pet`) can only be. */
function findShortBookName(text: string, names: StudyBookNamesType) {
    const match = LAST_WORD_PATTERN.exec(text);
    if (match === null) {
        return null;
    }
    const word = match[2];
    const letters = word.match(/\p{L}/gu) ?? [];
    if (letters.length < 3 || /\p{Ll}/u.test(letters[0] ?? '')) {
        return null;
    }
    const wanted = toCompactName(word);
    const indexSet = new Set<number>();
    for (const one of names.spacedList) {
        if (
            one.compact.length > wanted.length &&
            one.compact.startsWith(wanted)
        ) {
            indexSet.add(one.index);
        }
    }
    if (indexSet.size !== 1) {
        return null;
    }
    return {
        index: [...indexSet][0],
        compact: null,
        offset: match.index + match[1].length,
    };
}

/** The word before a reference no book is named by, if it reads as one. */
function readUnknownWord(text: string) {
    const match = LAST_WORD_PATTERN.exec(text);
    if (match === null) {
        return null;
    }
    let word = match[2];
    let offset = match.index + match[1].length;
    if (word.length > UNKNOWN_WORD_MAX_CHARS) {
        const cut = word
            .slice(-UNKNOWN_WORD_MAX_CHARS)
            .replace(/^[^\p{L}]+/u, '');
        offset += word.length - cut.length;
        word = cut;
    }
    const letters = word.match(/\p{L}/gu) ?? [];
    const isLatin = /\p{Script=Latin}/u.test(word);
    if (
        isLatin
            ? letters.length < 3 || !/\p{Lu}/u.test(letters[0] ?? '')
            : letters.length < 2
    ) {
        return null;
    }
    return { word: word.trim(), offset };
}

/** Every reference on one line of the study's own words, in order. */
function scanLineRefs(line: string, names: StudyBookNamesType) {
    const hits: LineHitType[] = [];
    const windowMax = names.maxLength * 2 + 12;
    let lastEnd = 0;
    let lastIndex: number | null = null;
    for (const match of line.matchAll(CHAPTER_VERSE_PATTERN)) {
        const matchStart = match.index ?? 0;
        const matchEnd = matchStart + match[0].length;
        const gap = line.slice(lastEnd, matchStart);
        lastEnd = matchEnd;
        const chapter = Number(toAsciiDigitText(match[1]));
        const verseStart = Number(toAsciiDigitText(match[3]));
        const verseEndRaw =
            match[4] === undefined
                ? verseStart
                : Number(toAsciiDigitText(match[4]));
        const verseEnd = verseEndRaw > verseStart ? verseEndRaw : verseStart;
        if (
            chapter < 1 ||
            chapter > MAX_CHAPTER ||
            verseStart < 1 ||
            verseEnd > MAX_VERSE ||
            CLOCK_AFTER_PATTERN.test(line.slice(matchEnd))
        ) {
            lastIndex = null;
            continue;
        }
        let windowStart = matchStart - gap.length;
        for (let index = gap.length - 1; index >= 0; index--) {
            if (checkIsStopChar(gap[index])) {
                windowStart = matchStart - gap.length + index + 1;
                break;
            }
        }
        windowStart = Math.max(windowStart, matchStart - windowMax);
        const window = line.slice(windowStart, matchStart).replace(/\s+$/u, '');
        const book =
            window === ''
                ? null
                : (findWholeBookName(window, names) ??
                  findShortBookName(window, names));
        if (book !== null) {
            hits.push({
                kind: 'ref',
                start: windowStart + book.offset,
                written: line.slice(windowStart + book.offset, matchEnd).trim(),
                index: book.index,
                compact: book.compact,
                chapter,
                verseStart,
                verseEnd,
            });
            lastIndex = book.index;
            continue;
        }
        if (window === '') {
            // `Romans 5:8; 8:1`: the book before it. `3:16-4:2`'s second
            // half is the same range, read as its first.
            if (lastIndex !== null && /^\s*[,;]\s*$/u.test(gap)) {
                hits.push({
                    kind: 'ref',
                    start: matchStart,
                    written: match[0],
                    index: lastIndex,
                    compact: null,
                    chapter,
                    verseStart,
                    verseEnd,
                });
            }
            continue;
        }
        lastIndex = null;
        const unknown = match[2] === '.' ? null : readUnknownWord(window);
        if (unknown !== null) {
            hits.push({
                kind: 'unknown',
                start: windowStart + unknown.offset,
                written: line
                    .slice(windowStart + unknown.offset, matchEnd)
                    .trim(),
                word: unknown.word,
            });
        }
    }
    return hits;
}

type PassageSpanType = {
    index: number;
    chapter: number;
    verseStart: number;
    verseEnd: number;
};

/** The book, chapter and verses a quoted passage's heading names. */
function readPassageSpan(
    title: string,
    names: StudyBookNamesType,
): PassageSpanType | null {
    const hit = scanLineRefs(title, names).find((one) => {
        return one.kind === 'ref';
    });
    if (hit !== undefined && hit.kind === 'ref') {
        return {
            index: hit.index,
            chapter: hit.chapter,
            verseStart: hit.verseStart,
            verseEnd: hit.verseEnd,
        };
    }
    // A whole chapter: `John 3`.
    const chapterMatch = /^(.*?\S)\s*(\p{Nd}{1,3})\s*$/u.exec(title.trim());
    if (chapterMatch === null) {
        return null;
    }
    const book = findWholeBookName(chapterMatch[1], names);
    return book === null || book.offset !== 0
        ? null
        : {
              index: book.index,
              chapter: Number(toAsciiDigitText(chapterMatch[2])),
              verseStart: 1,
              verseEnd: MAX_VERSE,
          };
}

// --- the references of a study ----------------------------------------------

export type StudyRefType = {
    /** English: `Titus 3:4-5`, what every Bible reads. */
    ref: string;
    /** `TIT 3:4-5`, what a read verse answers with; null with no keys. */
    key: string | null;
    /** The Bible its part quotes, as installed or as the study names it. */
    bible: string | null;
    isInstalled: boolean;
};

type StudyNameNoteType = {
    name: string;
    isEnglish: boolean;
    sources: BookSourceType[];
    ownName: string;
};

type StudyLineItemType =
    | {
          kind: 'ref';
          written: string;
          refIndex: number;
          nameNote: StudyNameNoteType | null;
      }
    | { kind: 'unknown'; written: string; word: string };

type StudyCheckLineType = {
    text: string;
    heading: string;
    bible: string | null;
    items: StudyLineItemType[];
};

type StudyPassageType = {
    bible: string | null;
    title: string;
    count: number;
};

export type StudyVerseCheckType = {
    refs: StudyRefType[];
    lines: StudyCheckLineType[];
    /** References past `STUDY_CHECK_MAX_REFS`, not read. */
    leftCount: number;
    passages: StudyPassageType[];
    names: StudyBookNamesType;
};

function toRefText(
    name: string,
    chapter: number,
    verseStart: number,
    verseEnd: number,
) {
    const end = verseEnd > verseStart ? `-${verseEnd}` : '';
    return `${name} ${chapter}:${verseStart}${end}`;
}

/** The line as it is shown: whole, or the part round its first reference. */
function toShownLine(line: string, firstStart: number) {
    const flat = line.trim();
    if (flat.length <= STUDY_LINE_MAX_CHARS) {
        return flat;
    }
    const start = Math.max(0, Math.min(firstStart - 60, line.length));
    const piece = line.slice(start, start + STUDY_LINE_MAX_CHARS).trim();
    return `${start > 0 ? '…' : ''}${piece}…`;
}

/**
 * Every reference the study's own words cite, by the part of the study it
 * is in: each read once a Bible, at most `maxCount`; a book named as no
 * installed Bible names it kept apart; a verse of a passage the part quotes
 * counted and left out.
 */
export function collectStudyVerseRefs(
    text: string,
    names: StudyBookNamesType,
    maxCount = STUDY_CHECK_MAX_REFS,
): StudyVerseCheckType {
    const refs: StudyRefType[] = [];
    const lines: StudyCheckLineType[] = [];
    const passages: StudyPassageType[] = [];
    // A book named as no Bible names it is said on EVERY line it is
    // written on, once a line, up to the cap: said once for the file, the
    // Cross References' line was fixed and the same wrong name in a
    // discussion question stayed (2026-11-11, EC-499).
    let unknownCount = 0;
    const leftSet = new Set<string>();
    let region: {
        bible: string | null;
        passage: StudyPassageType | null;
        span: PassageSpanType | null;
    } = { bible: null, passage: null, span: null };
    let heading = '';
    for (const part of splitStudyForTranslation(String(text ?? ''))) {
        if (part.kind === 'passage') {
            const installed = findStudyBible(names, part.bibleKey ?? null);
            const passage = {
                bible: installed?.key ?? part.bibleKey ?? null,
                title: part.title ?? '',
                count: 0,
            };
            passages.push(passage);
            region = {
                bible: passage.bible,
                passage,
                span: readPassageSpan(passage.title, names),
            };
            continue;
        }
        if (part.kind !== 'text') {
            continue;
        }
        const partBible = findStudyBible(names, region.bible);
        for (const line of part.text.split('\n')) {
            const headingMatch = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
            if (headingMatch !== null) {
                heading = headingMatch[1];
            }
            const items: StudyLineItemType[] = [];
            const lineUnknownSet = new Set<string>();
            let firstStart = -1;
            for (const hit of scanLineRefs(line, names)) {
                if (hit.kind === 'unknown') {
                    if (
                        lineUnknownSet.has(hit.written) ||
                        unknownCount >= STUDY_CHECK_MAX_UNKNOWNS
                    ) {
                        continue;
                    }
                    lineUnknownSet.add(hit.written);
                    unknownCount += 1;
                    items.push({
                        kind: 'unknown',
                        written: hit.written,
                        word: hit.word,
                    });
                    firstStart = firstStart < 0 ? hit.start : firstStart;
                    continue;
                }
                const { span } = region;
                if (
                    span !== null &&
                    region.passage !== null &&
                    hit.index === span.index &&
                    hit.chapter === span.chapter &&
                    hit.verseStart >= span.verseStart &&
                    hit.verseEnd <= span.verseEnd
                ) {
                    region.passage.count += 1;
                    continue;
                }
                const ref = toRefText(
                    names.english[hit.index] ?? '',
                    hit.chapter,
                    hit.verseStart,
                    hit.verseEnd,
                );
                let refIndex = refs.findIndex((one) => {
                    return one.bible === region.bible && one.ref === ref;
                });
                if (refIndex < 0) {
                    if (refs.length >= maxCount) {
                        leftSet.add(`${region.bible ?? ''}\n${ref}`);
                        continue;
                    }
                    const bookKey = names.bookKeys[hit.index];
                    refs.push({
                        ref,
                        key:
                            bookKey === undefined
                                ? null
                                : toRefText(
                                      bookKey,
                                      hit.chapter,
                                      hit.verseStart,
                                      hit.verseEnd,
                                  ),
                        bible: region.bible,
                        isInstalled: partBible !== null,
                    });
                    refIndex = refs.length - 1;
                }
                const entry =
                    hit.compact === null
                        ? undefined
                        : names.nameMap.get(hit.compact);
                const ownName = partBible?.books[hit.index] ?? '';
                const nameNote =
                    entry !== undefined &&
                    partBible !== null &&
                    partBible.lang !== '' &&
                    ownName !== '' &&
                    !entry.langs.includes(partBible.lang)
                        ? {
                              name: hit.written
                                  .replace(CHAPTER_VERSE_PATTERN, '')
                                  .trim(),
                              isEnglish: entry.langs.includes('en'),
                              sources: entry.sources,
                              ownName,
                          }
                        : null;
                items.push({
                    kind: 'ref',
                    written: hit.written,
                    refIndex,
                    nameNote,
                });
                firstStart = firstStart < 0 ? hit.start : firstStart;
            }
            if (items.length > 0) {
                lines.push({
                    text: toShownLine(line, firstStart),
                    heading,
                    bible: region.bible,
                    items,
                });
            }
        }
    }
    return {
        refs,
        lines,
        leftCount: leftSet.size,
        passages,
        names,
    };
}

export type StudyRefCallType = {
    bible: string | null;
    isInstalled: boolean;
    refs: string[];
};

/**
 * The `owa_find_verse refs` calls that read them: one Bible a call, at most
 * `MAX_FIND_REFS` references and the characters it reads of them.
 */
export function splitStudyRefCalls(
    check: StudyVerseCheckType,
): StudyRefCallType[] {
    const calls: StudyRefCallType[] = [];
    const openMap = new Map<string, StudyRefCallType>();
    for (const one of check.refs) {
        const bibleKey = one.bible ?? '';
        const open = openMap.get(bibleKey);
        if (
            open !== undefined &&
            open.refs.length < MAX_FIND_REFS &&
            [...open.refs, one.ref].join('; ').length <= STUDY_CALL_MAX_CHARS
        ) {
            open.refs.push(one.ref);
            continue;
        }
        const call = {
            bible: one.bible,
            isInstalled: one.isInstalled,
            refs: [one.ref],
        };
        calls.push(call);
        openMap.set(bibleKey, call);
    }
    return calls;
}

export type StudyRefReadType = { call: StudyRefCallType; result: unknown };

type ReadVerseType =
    | { kind: 'verse'; text: string; title: string; readBible: string }
    | { kind: 'missing'; reason: string };

function toLookupKey(bible: string | null, ref: string) {
    return `${bible ?? ''}\n${ref.trim().toLowerCase()}`;
}

/** What each call read, by its Bible and by key and English reference. */
function indexReadVerses(readList: readonly StudyRefReadType[]) {
    const readMap = new Map<string, ReadVerseType>();
    for (const { call, result } of readList) {
        const data = (result ?? {}) as Record<string, unknown>;
        const readBible = typeof data.bible === 'string' ? data.bible : '';
        for (const verse of Array.isArray(data.verses) ? data.verses : []) {
            const read: ReadVerseType = {
                kind: 'verse',
                text: String(verse?.text ?? ''),
                title: typeof verse?.title === 'string' ? verse.title : '',
                readBible,
            };
            for (const name of [verse?.key, verse?.ref]) {
                if (typeof name === 'string' && name.trim() !== '') {
                    readMap.set(toLookupKey(call.bible, name), read);
                }
            }
        }
        for (const one of Array.isArray(data.notFound) ? data.notFound : []) {
            if (typeof one?.ref === 'string') {
                readMap.set(toLookupKey(call.bible, one.ref), {
                    kind: 'missing',
                    reason: String(one.reason ?? 'It is not in this Bible.'),
                });
            }
        }
    }
    return readMap;
}

function describeNameSources(note: StudyNameNoteType) {
    if (note.isEnglish) {
        return 'the English name of the book';
    }
    const [first, ...rest] = note.sources;
    if (first === undefined) {
        return 'how another language names the book';
    }
    const others =
        rest.length === 0
            ? ''
            : ` and ${rest.length} other Bible${rest.length === 1 ? '' : 's'}`;
    return (
        `how ${first.key} (${first.locale})${others} ` +
        `name${rest.length === 0 ? 's' : ''} the book`
    );
}

/** `Genesis = <its name>; …`: a part's Bible's names beside the English. */
function toBookNameListText(bible: StudyBibleType, english: string[]) {
    let sameCount = 0;
    const pairs: string[] = [];
    english.forEach((name, index) => {
        const own = bible.books[index] ?? '';
        if (own === '') {
            return;
        }
        if (toCompactName(own) === toCompactName(name)) {
            sameCount += 1;
        }
        pairs.push(`${name} = ${own}`);
    });
    if (sameCount >= english.length * ENGLISH_LIKE_SHARE) {
        return null;
    }
    return `${bible.key} names the books: ${pairs.join('; ')}.`;
}

const STUDY_CHECK_INTRO =
    '(This asks to check the Bible references the study file cites. The ' +
    "app found each one below in the study's own words and read it from " +
    'the Bible that part of the study quotes. For each: is its book named ' +
    'the way that Bible names it, and does the verse say what the line ' +
    'uses it for? Say how many you checked and how many are right, then ' +
    'name each one that is wrong -- its line, the reference, why -- with ' +
    'the fix as an OPTION. A book no installed Bible names is listed as ' +
    'such: say which book it means and how that Bible names it. A ' +
    'reference in brackets INSIDE a quoted passage, like "[Ezek. ' +
    "36:25-27.]\", is that Bible's own note, not the study's: leave it " +
    'out. Change nothing unasked, and say only what these show.';

/**
 * What the ask carries for a verse check: every line of the study that
 * cites a reference, each reference with the words its part's Bible gave
 * it (`owa_find_verse` results), the names no Bible gives a book, and what
 * was left out. Null when there is no table of names to read by.
 */
export function toStudyVerseReadText(
    check: StudyVerseCheckType | null,
    readList: readonly StudyRefReadType[],
) {
    if (check === null) {
        return null;
    }
    const readMap = indexReadVerses(readList);
    const outLines: string[] = [STUDY_CHECK_INTRO];
    const shownSet = new Set<number>();
    const listedBibleSet = new Set<string>();
    let partBible: string | null | undefined;
    let needsNames = false;
    const closePart = () => {
        const bible = findStudyBible(check.names, partBible ?? null);
        if (needsNames && bible !== null && !listedBibleSet.has(bible.key)) {
            const listText = toBookNameListText(bible, check.names.english);
            if (listText !== null) {
                outLines.push(listText);
                listedBibleSet.add(bible.key);
            }
        }
        needsNames = false;
    };
    for (const line of check.lines) {
        if (line.bible !== partBible) {
            closePart();
            partBible = line.bible;
            const bible = findStudyBible(check.names, line.bible);
            outLines.push(
                '',
                line.bible === null
                    ? 'Before the study quotes a passage:'
                    : `The part quoting ${line.bible}` +
                          (bible === null || bible.locale === ''
                              ? ' (not installed):'
                              : ` (${bible.locale}):`),
            );
        }
        const under = line.heading === '' ? '' : ` (under "${line.heading}")`;
        outLines.push(`Line${under}: ${JSON.stringify(line.text)}`);
        for (const item of line.items) {
            if (item.kind === 'unknown') {
                needsNames = true;
                outLines.push(
                    `- "${item.written}": no installed Bible names a book ` +
                        `"${item.word}".`,
                );
                continue;
            }
            const ref = check.refs[item.refIndex];
            const named =
                item.written === ref.ref
                    ? `"${item.written}"`
                    : `"${item.written}" (${ref.ref})`;
            const note =
                item.nameNote === null
                    ? ''
                    : ` "${item.nameNote.name}" is ` +
                      `${describeNameSources(item.nameNote)}; ` +
                      `${ref.bible} names it "${item.nameNote.ownName}".`;
            if (item.nameNote !== null) {
                needsNames = true;
            }
            if (shownSet.has(item.refIndex)) {
                outLines.push(`- ${named}: read above.${note}`);
                continue;
            }
            shownSet.add(item.refIndex);
            const read =
                (ref.key === null
                    ? undefined
                    : readMap.get(toLookupKey(ref.bible, ref.key))) ??
                readMap.get(toLookupKey(ref.bible, ref.ref));
            if (read === undefined) {
                outLines.push(
                    `- ${named}:${note} The app could not read it` +
                        `${ref.bible === null ? '' : ` from ${ref.bible}`}.`,
                );
                continue;
            }
            if (read.kind === 'missing') {
                outLines.push(`- ${named}:${note} ${read.reason}`);
                continue;
            }
            const source =
                read.title === ''
                    ? read.readBible
                    : `${read.readBible} ${read.title}`;
            outLines.push(
                `- ${named}:${note} ${source} reads: ` +
                    JSON.stringify(read.text),
            );
        }
    }
    closePart();
    if (check.lines.length === 0) {
        outLines.push(
            '',
            check.passages.some((passage) => passage.count > 0)
                ? 'The study cites no reference outside the passages it quotes.'
                : "The app found no Bible reference in the study's own words.",
        );
    }
    for (const passage of check.passages) {
        if (passage.count > 0) {
            const isOne = passage.count === 1;
            outLines.push(
                `${passage.count} reference${isOne ? '' : 's'} to verses ` +
                    `of ${passage.title}` +
                    `${passage.bible === null ? '' : ` (${passage.bible})`} ` +
                    `${isOne ? 'was' : 'were'} not read again: the study ` +
                    `quotes that passage, so check ${isOne ? 'it' : 'them'} ` +
                    'against the passage.',
            );
        }
    }
    if (check.leftCount > 0) {
        // Anything is left only once as many as a check reads were read.
        outLines.push(
            `${check.leftCount} more reference` +
                `${check.leftCount === 1 ? ' was' : 's were'} not read: the ` +
                `first ${check.refs.length} were.`,
        );
    }
    return `${outLines.join('\n')})`;
}
