/**
 * The pure half of `owa_find_verse` (`agentBibleFindHelpers.ts`): what a
 * half-remembered verse is searched FOR, the SQL that ranks the verses, and
 * the references a model or a person writes, read back into book keys.
 *
 * Why not Bible Find's own query. Bible Find matches what is TYPED, as it is
 * typed and in that order (`toFindWildCardText`: `%love%%enemies%`), which is
 * right for a box a person is typing into and wrong for "I remember enemies,
 * love and pray somewhere in it": the words come in the order they are
 * recalled, some are not in the verse at all, and the one that is rare
 * ("persecute") says more than the one that is everywhere ("love"). So each
 * word is matched on its own, a verse is ranked by HOW MANY of them it holds,
 * and ties go to the rarer words -- the inverse document frequency a search
 * engine would use, worked out here with one count per word.
 *
 * It searches the same table Bible Find built (`initSearchingDatabase`:
 * `verses(text, sText)`, `sText` the sanitized words with the spaces taken
 * out), so a Bible is indexed once whichever of the two asks first. Every
 * word goes into the SQL as a quoted LIKE operand, so what can reach it is
 * cut to letters, digits and marks first (`toFindTermList`).
 *
 * No imports: a test reads every rule here with no SQLite and no app.
 */

// More words than a person remembers of one verse: the rest is a paragraph
// pasted in, and every word is one more scan of the whole Bible.
export const MAX_FIND_TERMS = 10;
// Verses an answer carries. The model reads every one of them on every later
// round, so a page, not the whole list.
export const DEFAULT_FIND_LIMIT = 8;
export const MAX_FIND_LIMIT = 20;
// Verses the table hands over to be read word by word (`countWordHits`): a
// verse that truly holds the words holds them run together too, so it is
// among these, ranked high; the rest are words that only meet across a
// space -- "I wil(l over)take" holding "lover".
export const MAX_FIND_CANDIDATES = 300;
// References one call may read.
export const MAX_FIND_REFS = 8;
// A verse is quoted, not printed whole: a long one is cut here.
export const FOUND_TEXT_LIMIT = 300;
// The start of the refusal for words the Bible's language has none of. The
// chat reads it to say so in words of its own (`answerVerseFindOffline`), so
// the worker and the chat share it here, where neither pulls the other in.
export const NOT_IN_LANGUAGE_REASON =
    'Those words are not written in this Bible’s language.';

/**
 * The words to search for, out of the sanitized words: each once, at least
 * two characters, none of the characters that mean something to LIKE or to
 * the SQL string around it, and the stop words of the Bible's language left
 * out -- unless they are ALL there is ("let there be light" is four of them).
 */
export function toFindTermList(
    words: string[],
    checkIsStopWord: (word: string) => boolean,
): string[] {
    const seen = new Set<string>();
    const all: string[] = [];
    for (const word of words) {
        const term = word.replaceAll(/['"%_\\;]/g, '').trim();
        if (term.length < 2 || seen.has(term.toLowerCase())) {
            continue;
        }
        seen.add(term.toLowerCase());
        all.push(term);
    }
    const kept = all.filter((term) => {
        return !checkIsStopWord(term.toLowerCase());
    });
    return (kept.length > 0 ? kept : all).slice(0, MAX_FIND_TERMS);
}

/**
 * How much finding a word says: a word in three verses says far more than
 * one in three thousand. Never zero, so a word in every verse still counts.
 */
export function toTermWeight(verseCount: number, foundCount: number) {
    const weight = Math.log(1 + verseCount / (1 + Math.max(0, foundCount)));
    return Math.round(Math.max(weight, 0.001) * 1000) / 1000;
}

/**
 * How many of the words a verse must hold to be listed at all: every one of
 * one or two, and at least two of more -- one word of five matches thousands
 * of verses and none of them is the one being looked for.
 */
export function toNeededHits(termCount: number) {
    return termCount <= 2 ? termCount : 2;
}

function toLikeTerm(term: string) {
    return `(sText LIKE '%${term}%')`;
}

function toBookCondition(bookKeys: string[]) {
    if (bookKeys.length === 0) {
        return '';
    }
    const conditions = bookKeys.map((bookKey) => {
        return `text LIKE '${bookKey.replaceAll(/[^0-9A-Z]/g, '')}.%'`;
    });
    return ` WHERE (${conditions.join(' OR ')})`;
}

/**
 * The two queries a search is: the verses, most words first, rarer words
 * breaking a tie and the Bible's own order after that; and how many there
 * are in all. `terms` and `weights` go together, one weight a term.
 */
export function genVerseFindSql({
    terms,
    weights,
    bookKeys,
    need,
    limit,
}: {
    terms: string[];
    weights: number[];
    bookKeys: string[];
    need: number;
    limit: number;
}) {
    const hits = terms.map(toLikeTerm).join(' + ');
    const score = terms
        .map((term, index) => {
            return `${toLikeTerm(term)} * ${weights[index] ?? 1}`;
        })
        .join(' + ');
    const where = toBookCondition(bookKeys);
    const safeNeed = Math.max(1, Math.floor(need));
    const safeLimit = Math.min(
        MAX_FIND_CANDIDATES,
        Math.max(1, Math.floor(limit)),
    );
    return {
        selectSql:
            `SELECT text, hits, r FROM (SELECT text, rowid AS r, ${hits} AS hits, ` +
            `${score} AS score FROM verses${where}) WHERE hits >= ${safeNeed} ` +
            `ORDER BY hits DESC, score DESC, r LIMIT ${safeLimit};`,
        countSql:
            `SELECT COUNT(*) AS count FROM (SELECT ${hits} AS hits FROM ` +
            `verses${where}) WHERE hits >= ${safeNeed};`,
        termCountSql: (term: string) => {
            return `SELECT COUNT(*) AS count FROM verses WHERE ${toLikeTerm(term)};`;
        },
    };
}

// A word typed in a script with no spaces that is this long is likely a
// phrase: "ព្រះយេស៊ូសួរពេត្រុសច្រើនដង" (Jesus asked Peter many times) is one
// run of letters, and found as one it matches nothing.
export const LONG_UNSPACED_TERM_LENGTH = 7;
const COMBINING_MARK_PATTERN = /^\p{M}$/u;

/**
 * Letters typed with no space cut into the words a vocabulary knows,
 * longest first from the left -- the Bible's own words, from Bible Find's
 * `spell` table. Letters no word starts with are kept together as one piece,
 * so nothing typed is lost; a piece of one letter is the caller's to drop.
 */
export function segmentByVocabulary(
    text: string,
    vocabulary: ReadonlySet<string>,
    maxWordLength = 24,
): string[] {
    const pieces: string[] = [];
    let unknown = '';
    let index = 0;
    while (index < text.length) {
        let matched = '';
        const longest = Math.min(maxWordLength, text.length - index);
        for (let length = longest; length >= 2; length--) {
            const piece = text.slice(index, index + length);
            if (vocabulary.has(piece)) {
                matched = piece;
                break;
            }
        }
        if (matched === '') {
            // A vowel sign or a mark is the end of the word before it, not
            // the start of one: "យេស" + "៊ូ" is "យេស៊ូ", which the Bible's
            // "យេស៊ូវ" holds.
            if (
                unknown === '' &&
                pieces.length > 0 &&
                COMBINING_MARK_PATTERN.test(text[index])
            ) {
                pieces[pieces.length - 1] += text[index];
            } else {
                unknown += text[index];
            }
            index += 1;
            continue;
        }
        if (unknown !== '') {
            pieces.push(unknown);
            unknown = '';
        }
        pieces.push(matched);
        index += matched.length;
    }
    if (unknown !== '') {
        pieces.push(unknown);
    }
    return pieces;
}

// Scripts written with no space between words: their table can only be
// matched run together, and no word starts anywhere in particular.
const UNSPACED_LANGUAGE_LIST = ['km', 'th', 'lo', 'my', 'zh', 'ja'];

export function checkIsSpacedLocale(locale: string) {
    return !UNSPACED_LANGUAGE_LIST.includes(
        locale.toLowerCase().split(/[-_]/)[0],
    );
}

/**
 * An English word cut back to the part its other forms share, so "enemy"
 * finds "enemies", "prayed" finds "pray", "persecute" finds "persecuted".
 * Matched as the START of a word, so the cut need not be a real stem -- only
 * short enough and never shorter than three letters.
 */
export function toEnglishStem(term: string) {
    const word = term.toLowerCase();
    const cut = (count: number) => {
        return word.length - count >= 3 ? word.slice(0, -count) : word;
    };
    if (word.length > 4 && word.endsWith('ies')) {
        return cut(3);
    }
    if (word.length > 5 && /(?:eth|est|ing)$/.test(word)) {
        return cut(3);
    }
    if (word.length > 4 && /(?:ed|es)$/.test(word)) {
        return cut(2);
    }
    if (word.length > 4 && /[ye]$/.test(word)) {
        return cut(1);
    }
    if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) {
        return cut(1);
    }
    return word;
}

/**
 * Which of the terms a verse holds as the START of one of its words -- the
 * verse as its language's sanitizer leaves it, words between spaces. The
 * table's run-together match counts "lover" in "I will overtake"; this does
 * not.
 */
export function countWordHits(verseWords: string[], terms: string[]) {
    return terms.map((term) => {
        const lowered = term.toLowerCase();
        return verseWords.some((word) => {
            return word.toLowerCase().startsWith(lowered);
        });
    });
}

export type FoundVerseRowType = {
    bookKey: string;
    chapter: number;
    verse: number;
    text: string;
};

/**
 * One row of the table, or one line Bible Find's online search answers --
 * `JHN.3:16=>For God…` and `JHN.3:16:For God…` -- read into its parts.
 */
export function parseFoundVerseRow(row: string): FoundVerseRowType | null {
    const match = /^([0-9A-Z]{3})\.(\d+):(\d+)(?:=>|:)([\s\S]*)$/.exec(row);
    if (match === null) {
        return null;
    }
    return {
        bookKey: match[1],
        chapter: Number.parseInt(match[2], 10),
        verse: Number.parseInt(match[3], 10),
        text: match[4],
    };
}

/**
 * A passage's text as the app writes it puts each verse's number in front
 * -- `(34): Take therefore…` -- which a single verse does not need.
 */
export function toSingleVerseText(text: string) {
    return text.replace(/^\s*\([^)]{1,8}\):\s*/u, '');
}

export function cutFoundText(text: string, limit = FOUND_TEXT_LIMIT) {
    const flat = text.replaceAll(/\s+/g, ' ').trim();
    return flat.length > limit ? `${flat.slice(0, limit).trimEnd()}…` : flat;
}

/** `JHN 3:16`, `PSA 23:1-6`: the key `BibleItem.fromVerseKey` reads. */
export function toVerseKey(
    bookKey: string,
    chapter: number,
    verseStart: number,
    verseEnd?: number | null,
) {
    const end =
        typeof verseEnd === 'number' && verseEnd > verseStart
            ? `-${verseEnd}`
            : '';
    return `${bookKey} ${chapter}:${verseStart}${end}`;
}

// The canonical key a verse is opened by, as a result or a button carries
// it: three letters or digits, chapter, verse, maybe a range.
const VERSE_KEY_PATTERN = /^([0-9A-Z]{3}) (\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/;

/** A verse key read back, or null for anything else. */
export function readVerseKey(text: string) {
    const match = VERSE_KEY_PATTERN.exec(text.trim().toUpperCase());
    if (match === null) {
        return null;
    }
    return {
        bookKey: match[1],
        chapter: Number.parseInt(match[2], 10),
        verseStart: Number.parseInt(match[3], 10),
        verseEnd:
            match[4] === undefined
                ? Number.parseInt(match[3], 10)
                : Number.parseInt(match[4], 10),
    };
}

function toBookNameKey(name: string) {
    return name
        .toLowerCase()
        .normalize('NFKC')
        .replaceAll(/[\s.]+/g, '');
}

/**
 * A book named as it is said -- `John`, `1 John`, `Psalm`, `PSA`, `Rev`, or
 * the Bible's own name for it -- as its key, or null. `nameMapList` is the
 * names to try, in order: the Bible's own, then the English ones. A short
 * form counts only when it starts ONE book's name: `Jo` is John, Job, Joel,
 * Jonah and Joshua at once, and none of them is a guess worth making.
 */
export function resolveBookKey(
    name: string,
    nameMapList: { [bookKey: string]: string }[],
): string | null {
    const wanted = toBookNameKey(name);
    if (wanted.length === 0) {
        return null;
    }
    const allKeys = new Set<string>();
    for (const nameMap of nameMapList) {
        for (const key of Object.keys(nameMap)) {
            allKeys.add(key);
        }
    }
    const asKey = wanted.toUpperCase();
    if (allKeys.has(asKey)) {
        return asKey;
    }
    const startList = new Set<string>();
    for (const nameMap of nameMapList) {
        for (const [key, bookName] of Object.entries(nameMap)) {
            const known = toBookNameKey(bookName);
            // "Psalm" for "Psalms" and the other way round: the KJV calls
            // the book "Psalm".
            if (
                known === wanted ||
                known === `${wanted}s` ||
                `${known}s` === wanted
            ) {
                return key;
            }
            if (wanted.length >= 3 && known.startsWith(wanted)) {
                startList.add(key);
            }
        }
    }
    return startList.size === 1 ? [...startList][0] : null;
}

/**
 * The books a search is narrowed to -- `Psalms`, `Matthew, Mark, Luke and
 * John` -- as keys, and the names that are no book.
 */
export function resolveBookFilter(
    book: string,
    nameMapList: { [bookKey: string]: string }[],
) {
    const bookKeys: string[] = [];
    const unknown: string[] = [];
    for (const part of book.split(/\s*(?:,|;|\band\b|&)\s*/i)) {
        const name = part.trim();
        if (name.length === 0) {
            continue;
        }
        const key = resolveBookKey(name, nameMapList);
        if (key === null) {
            unknown.push(name);
        } else if (!bookKeys.includes(key)) {
            bookKeys.push(key);
        }
    }
    return { bookKeys, unknown };
}

/**
 * A list of references as it is written -- `Matthew 6:34; Philippians 4:6-7`,
 * one a line, or with commas between whole references -- as one reference
 * each. A comma before a bare number stays: `John 3:16, 17` is one.
 */
export function splitRefList(refs: string): string[] {
    return refs
        .split(/\s*(?:;|\n|,(?=\s*(?:\d\s*)?[^\d\s,;]))\s*/)
        .map((one) => {
            return one.trim();
        })
        .filter((one) => {
            return one.length > 0;
        })
        .slice(0, MAX_FIND_REFS);
}

/**
 * A script's own digits as ASCII (`យ៉ូហាន ៣:១៦` -> `យ៉ូហាន 3:16`), so a
 * reference written the way the reader's Bible writes it parses. Unicode's
 * decimal digits are contiguous runs of ten, so a digit's value is its
 * offset from the start of its own run; `\p{Nd}` alone is not enough
 * (`Number('១')` is NaN). Needed by `owa_resource_file`'s `ref`, where a
 * model writing what the person said gave `"ម៉ាថាយ ១៨" is not a book and
 * chapter` (seen live 2026-10-19).
 */
export function toAsciiDigitText(text: string) {
    return text.replaceAll(/\p{Nd}/gu, (digit) => {
        const codePoint = digit.codePointAt(0) ?? 0;
        let runStart = codePoint;
        while (
            runStart > 0 &&
            /\p{Nd}/u.test(String.fromCodePoint(runStart - 1))
        ) {
            runStart -= 1;
        }
        return String(codePoint - runStart);
    });
}

/**
 * One reference read into a book name, a chapter and a verse or a range;
 * no verse is the whole chapter (`verseStart` null). `John 3:16, 17` and
 * `John 3:16-17` are the same two verses.
 */
export function parseRefParts(ref: string) {
    const match =
        /^(.*?\S)\s*(\d{1,3})(?:\s*[:.]\s*(\d{1,3})(?:\s*[-–,]\s*(\d{1,3}))?)?$/.exec(
            toAsciiDigitText(ref.trim()),
        );
    if (match === null) {
        return null;
    }
    const verseStart =
        match[3] === undefined ? null : Number.parseInt(match[3], 10);
    const verseEnd =
        match[4] === undefined ? verseStart : Number.parseInt(match[4], 10);
    return {
        book: match[1],
        chapter: Number.parseInt(match[2], 10),
        verseStart,
        verseEnd:
            verseStart !== null && verseEnd !== null && verseEnd >= verseStart
                ? verseEnd
                : verseStart,
    };
}

/**
 * Whether a verse or a range EXISTS in a chapter of `verseCount` verses.
 * `verseCount` null is not a verdict -- the chapter could not be read, and
 * the caller keeps its own path rather than refusing a verse it cannot
 * count. Seen live 2026-10-18: Genesis 3:203 was quoted as `"??"`, the
 * renderer's missing-verse placeholder, by both `owa_find_verse` and
 * `owa_lookup_record`.
 */
export function checkVerseFitsChapter(
    verseCount: number | null,
    verseStart: number,
    verseEnd?: number | null,
) {
    if (verseCount === null || verseCount <= 0) {
        return true;
    }
    if (verseStart < 1 || verseStart > verseCount) {
        return false;
    }
    return (
        verseEnd == null || (verseEnd >= verseStart && verseEnd <= verseCount)
    );
}

/** `Genesis 3 has 24 verses.` -- why a reference is no verse. */
export function genVerseRangeReason(
    bookName: string,
    chapter: number,
    verseCount: number,
) {
    const verses = verseCount === 1 ? 'verse' : 'verses';
    return `${bookName} ${chapter} has ${verseCount} ${verses}.`;
}

/**
 * The installed Bible that NAMES the book the way it was written -- so a
 * Khmer reference is quoted from the Khmer Bible, not from the KJV the
 * lookup happened to be on. The preferred Bible wins when it has the name;
 * entries without a `keyBookMap` are skipped. Falls back to the preferred
 * key.
 */
export function pickBibleKeyForBookName(
    book: string,
    infoList: { key: string; keyBookMap?: { [bookKey: string]: string } }[],
    preferredKey: string,
) {
    const wanted = toBookNameKey(book);
    if (wanted.length === 0) {
        return preferredKey;
    }
    const checkHasName = (info?: {
        keyBookMap?: { [bookKey: string]: string };
    }) => {
        return Object.values(info?.keyBookMap ?? {}).some((name) => {
            return toBookNameKey(String(name)) === wanted;
        });
    };
    const preferred = infoList.find((info) => {
        return info.key === preferredKey;
    });
    if (preferred !== undefined && checkHasName(preferred)) {
        return preferredKey;
    }
    const own = infoList.find((info) => {
        return info.key !== preferredKey && checkHasName(info);
    });
    return own?.key ?? preferredKey;
}
