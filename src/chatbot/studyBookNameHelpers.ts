/**
 * The books of the Bible in a translated study, named as the language's
 * Bible names them (2026-11-12, EC-534).
 *
 * The user's John 3 study, translated into Khmer by the window (EC-478),
 * named four of its references as no Khmer reader knows them: Titus as the
 * French Bibles do, Ezekiel as no installed Bible does, and Numbers -- twice
 * -- by the everyday word for a number. The translator had been told "write
 * the book in that language" and nothing more, while every Khmer Bible on
 * the computer names all three.
 *
 * Now the window reads the book names every installed Bible writes
 * (`owa_bible_suggest books`) once for the job, and for each part:
 * - the translator is told how the Bible the passages are quoted from names
 *   each book the part cites (`toStudyBookNamesText`);
 * - a reference the answer names as only another language's Bibles, or the
 *   English names, name that book -- or writes short as that Bible never
 *   does -- is written with that Bible's name (`repairStudyBookNames`): a
 *   known name is a word the code can put right;
 * - one named as no Bible names it is asked about once more, naming it
 *   (`listStudyBookNameSlips`): where such a name starts, in a script
 *   written without spaces, only the translator can tell.
 *
 * A reference counts only when the part's own words cite the same chapter
 * and verses: a time or a ratio is nobody's book.
 *
 * Pure. The running is `translateStudyPart` in `llmBotHelpers.ts`.
 */
import {
    findStudyBible,
    scanStudyLineRefs,
    toCompactBookName,
    type StudyBookNamesType,
    type StudyLineHitType,
} from './studyVerseCheckHelpers';

// A Bible naming its books mostly as the English names do, in a language
// that is not English, is no guide to the language's names: the Greek and
// Hebrew Bibles on the user's computer name every book in English.
const ENGLISH_LIKE_SHARE = 0.5;
// Books named to the translator for one part, and slips named in a retry.
const MAX_NAME_PAIRS = 16;
const MAX_SLIPS = 8;
// What the translator keeps as it is, so no book in it is its to name: a
// code span, a link's address, a `[^…]` token (the draft names it from the
// Bible) and a tag. Blanked, not cut, so every place on the line stays.
const KEPT_SPAN_PATTERN = /`[^`\n]*`|\]\([^)\n]*\)|\[\^[^\]\n]*\]|<[^>\n]*>/g;
const REF_NUMBERS_PATTERN = /\p{Nd}[:：.]\p{Nd}/u;

export type StudyBookNameTableType = {
    /** The Bible the translation's passages are quoted from. */
    bible: { key: string; lang: string; books: string[] };
    names: StudyBookNamesType;
};

export type StudyBookNameSlipType = {
    /** The reference as the translation wrote it. */
    written: string;
    /** The book it cites, by its English name and the Bible's. */
    english: string;
    name: string;
};

type RefHitType = Extract<StudyLineHitType, { kind: 'ref' }>;

type CitedRefType = {
    index: number;
    chapter: number;
    verseStart: number;
    verseEnd: number;
};

function blankKeptSpans(text: string) {
    return text.replace(KEPT_SPAN_PATTERN, (span) => {
        return ' '.repeat(span.length);
    });
}

/** Whether some words cite a chapter and a verse, outside what is kept. */
export function checkHasStudyRefNumbers(text: string) {
    return REF_NUMBERS_PATTERN.test(blankKeptSpans(String(text ?? '')));
}

/**
 * The names a translation is held to: those of the Bible its passages are
 * quoted from, among every installed Bible's. Null with no such Bible, or
 * one naming its books mostly in English in a language that is not.
 */
export function toStudyBookNameTable(
    names: StudyBookNamesType | null,
    bibleKey: string | null,
): StudyBookNameTableType | null {
    if (names === null || bibleKey === null) {
        return null;
    }
    const bible = findStudyBible(names, bibleKey);
    if (bible === null) {
        return null;
    }
    let namedCount = 0;
    let englishCount = 0;
    bible.books.forEach((own, index) => {
        if (own === '') {
            return;
        }
        namedCount += 1;
        if (
            toCompactBookName(own) ===
            toCompactBookName(names.english[index] ?? '')
        ) {
            englishCount += 1;
        }
    });
    if (
        namedCount === 0 ||
        (bible.lang !== 'en' && englishCount >= namedCount * ENGLISH_LIKE_SHARE)
    ) {
        return null;
    }
    return {
        bible: { key: bible.key, lang: bible.lang, books: bible.books },
        names,
    };
}

/** Every reference of some words, line by line, what is kept left out. */
function listLineHits(text: string, names: StudyBookNamesType) {
    return text.split('\n').map((line) => {
        return {
            line,
            hits: scanStudyLineRefs(blankKeptSpans(line), names),
        };
    });
}

/** The chapters and verses some words cite, with their books. */
function listCitedRefs(source: string, names: StudyBookNamesType) {
    const citedList: CitedRefType[] = [];
    for (const { hits } of listLineHits(source, names)) {
        for (const hit of hits) {
            if (hit.kind === 'ref') {
                citedList.push({
                    index: hit.index,
                    chapter: hit.chapter,
                    verseStart: hit.verseStart,
                    verseEnd: hit.verseEnd,
                });
            }
        }
    }
    return citedList;
}

function listCitedSame(citedList: CitedRefType[], hit: StudyLineHitType) {
    return citedList.filter((one) => {
        return (
            one.chapter === hit.chapter &&
            one.verseStart === hit.verseStart &&
            one.verseEnd === hit.verseEnd
        );
    });
}

/** A reference's book as written: the words before its chapter. */
function toWrittenName(hit: StudyLineHitType) {
    return hit.written.slice(0, hit.numbersAt - hit.start).trim();
}

/**
 * Whether a reference names its book as the Bible does: its name, or a name
 * a Bible of the same language gives the book -- or, written short, the
 * start of the Bible's name.
 */
function checkIsOwnName(hit: RefHitType, table: StudyBookNameTableType) {
    const own = table.bible.books[hit.index] ?? '';
    if (own === '') {
        return true;
    }
    const ownCompact = toCompactBookName(own);
    if (hit.compact === null) {
        const short = toCompactBookName(toWrittenName(hit));
        return short !== '' && ownCompact.startsWith(short);
    }
    if (hit.compact === ownCompact) {
        return true;
    }
    const entry = table.names.nameMap.get(hit.compact);
    return (
        table.bible.lang !== '' &&
        entry !== undefined &&
        entry.langs.includes(table.bible.lang)
    );
}

/**
 * Each book some words cite, as they write it, beside the Bible's name for
 * it: the first time each is cited, and only when the two differ.
 */
export function listStudyBookNamePairs(
    source: string,
    table: StudyBookNameTableType | null,
): [written: string, name: string][] {
    if (table === null) {
        return [];
    }
    const pairs: [string, string][] = [];
    const seenSet = new Set<number>();
    for (const { hits } of listLineHits(source, table.names)) {
        for (const hit of hits) {
            if (
                hit.kind !== 'ref' ||
                hit.isContinued === true ||
                seenSet.has(hit.index)
            ) {
                continue;
            }
            seenSet.add(hit.index);
            const own = table.bible.books[hit.index] ?? '';
            const written = toWrittenName(hit);
            if (
                own !== '' &&
                written !== '' &&
                toCompactBookName(written) !== toCompactBookName(own) &&
                pairs.length < MAX_NAME_PAIRS
            ) {
                pairs.push([written, own]);
            }
        }
    }
    return pairs;
}

/**
 * What the translator is told of the books a part cites: how the language's
 * Bible names each, and -- asked again -- the references its last answer
 * named another way. Empty when the part cites none to name.
 */
export function toStudyBookNamesText(
    source: string,
    table: StudyBookNameTableType | null,
    languageName: string,
    slips: StudyBookNameSlipType[] = [],
) {
    const pairs = listStudyBookNamePairs(source, table);
    const bibleText = `the ${languageName} Bible`;
    const namesText =
        pairs.length === 0
            ? ''
            : ` Write each book of the Bible as ${bibleText} names it: ` +
              `${pairs
                  .map(([written, name]) => {
                      return `${written} = ${name}`;
                  })
                  .join('; ')}.`;
    const slipText =
        slips.length === 0
            ? ''
            : ' Your last translation named these books another way: ' +
              `${slips
                  .map((slip) => {
                      return `"${slip.written}" (${slip.english} = ${slip.name})`;
                  })
                  .join(', ')}; write each as ${bibleText} names it.`;
    return namesText + slipText;
}

/**
 * A translation with each reference the part cites written with the Bible's
 * name where the answer named the same book as another language does, or
 * wrote it short as the Bible never does, and how many were.
 */
export function repairStudyBookNames(
    source: string,
    translated: string,
    table: StudyBookNameTableType | null,
) {
    if (table === null) {
        return { text: translated, count: 0 };
    }
    const citedList = listCitedRefs(source, table.names);
    if (citedList.length === 0) {
        return { text: translated, count: 0 };
    }
    let count = 0;
    const lineList = listLineHits(translated, table.names).map(
        ({ line, hits }) => {
            let out = line;
            // From the end, so a name put right moves nothing before it.
            for (const hit of [...hits].reverse()) {
                if (hit.kind !== 'ref' || hit.isContinued === true) {
                    continue;
                }
                const isCited = listCitedSame(citedList, hit).some((one) => {
                    return one.index === hit.index;
                });
                if (!isCited || checkIsOwnName(hit, table)) {
                    continue;
                }
                const own = table.bible.books[hit.index] ?? '';
                const nameLength = toWrittenName(hit).length;
                out =
                    out.slice(0, hit.start) +
                    own +
                    out.slice(hit.start + nameLength);
                count += 1;
            }
            return out;
        },
    );
    return { text: lineList.join('\n'), count };
}

/**
 * The references a translation names as no Bible of its language does, and
 * the book the part cites there: a name no installed Bible gives a book, or
 * another book's name. Read after `repairStudyBookNames`, which leaves only
 * these; at most `MAX_SLIPS`, each written once.
 */
export function listStudyBookNameSlips(
    source: string,
    translated: string,
    table: StudyBookNameTableType | null,
): StudyBookNameSlipType[] {
    if (table === null) {
        return [];
    }
    const citedList = listCitedRefs(source, table.names);
    if (citedList.length === 0) {
        return [];
    }
    const slips: StudyBookNameSlipType[] = [];
    const writtenSet = new Set<string>();
    for (const { hits } of listLineHits(translated, table.names)) {
        for (const hit of hits) {
            if (hit.kind === 'ref' && hit.isContinued === true) {
                continue;
            }
            const sameList = listCitedSame(citedList, hit);
            if (sameList.length === 0) {
                continue;
            }
            if (hit.kind === 'ref') {
                const isOwnBook = sameList.some((one) => {
                    return one.index === hit.index;
                });
                if (isOwnBook && checkIsOwnName(hit, table)) {
                    continue;
                }
            }
            const book =
                sameList.find((one) => {
                    return hit.kind === 'ref' && one.index === hit.index;
                }) ?? sameList[0];
            const name = table.bible.books[book.index] ?? '';
            if (
                name === '' ||
                writtenSet.has(hit.written) ||
                slips.length >= MAX_SLIPS
            ) {
                continue;
            }
            writtenSet.add(hit.written);
            slips.push({
                written: hit.written,
                english: table.names.english[book.index] ?? '',
                name,
            });
        }
    }
    return slips;
}
