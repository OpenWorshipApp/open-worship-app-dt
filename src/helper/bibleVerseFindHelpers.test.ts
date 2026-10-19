import { describe, expect, it } from 'vitest';

import {
    MAX_FIND_CANDIDATES,
    MAX_FIND_REFS,
    MAX_FIND_TERMS,
    checkIsSpacedLocale,
    checkVerseFitsChapter,
    countWordHits,
    cutFoundText,
    genVerseFindSql,
    genVerseRangeReason,
    parseFoundVerseRow,
    parseRefParts,
    pickBibleKeyForBookName,
    readVerseKey,
    resolveBookFilter,
    resolveBookKey,
    segmentByVocabulary,
    splitRefList,
    toFindTermList,
    toEnglishStem,
    toNeededHits,
    toSingleVerseText,
    toTermWeight,
    toVerseKey,
} from './bibleVerseFindHelpers';

const STOP_WORD_SET = new Set(['the', 'a', 'and', 'of', 'be']);
const checkIsStopWord = (word: string) => STOP_WORD_SET.has(word);

const ENGLISH_NAMES = {
    GEN: 'Genesis',
    JOB: 'Job',
    PSA: 'Psalms',
    JHN: 'John',
    '1JN': '1 John',
    JOS: 'Joshua',
    JOL: 'Joel',
    JDG: 'Judges',
    JUD: 'Jude',
    MAT: 'Matthew',
    PHP: 'Philippians',
    PHM: 'Philemon',
    REV: 'Revelation',
};

describe('the words a half-remembered verse is searched for', () => {
    it('keeps each word once, drops stop words and short scraps', () => {
        expect(
            toFindTermList(
                ['love', 'the', 'enemies', 'Love', 'a', 'x', 'pray'],
                checkIsStopWord,
            ),
        ).toEqual(['love', 'enemies', 'pray']);
    });

    it('keeps the stop words when they are all there is', () => {
        expect(
            toFindTermList(['let', 'there', 'be'], (word) => {
                return ['let', 'there', 'be'].includes(word);
            }),
        ).toEqual(['let', 'there', 'be']);
    });

    // Every word goes into the SQL as a quoted LIKE operand.
    it('takes out what means something to SQL or to LIKE', () => {
        expect(
            toFindTermList(["god's", '50%', 'a_b', "x';--", 'c\\d'], () => {
                return false;
            }),
        ).toEqual(['gods', '50', 'ab', 'x--', 'cd']);
    });

    it('stops at the most a person remembers of one verse', () => {
        const words = Array.from({ length: 30 }, (_value, index) => {
            return `word${index}`;
        });
        expect(toFindTermList(words, checkIsStopWord)).toHaveLength(
            MAX_FIND_TERMS,
        );
    });
});

describe('ranking', () => {
    it('weighs a rare word above a common one, never at zero', () => {
        const rare = toTermWeight(31_000, 3);
        const common = toTermWeight(31_000, 3_000);
        const everywhere = toTermWeight(31_000, 31_000);
        expect(rare).toBeGreaterThan(common);
        expect(common).toBeGreaterThan(everywhere);
        expect(everywhere).toBeGreaterThan(0);
    });

    it('needs every word of one or two, and two of more', () => {
        expect(toNeededHits(1)).toBe(1);
        expect(toNeededHits(2)).toBe(2);
        expect(toNeededHits(5)).toBe(2);
    });

    it('ranks by words held, then by their weight, then by Bible order', () => {
        const sql = genVerseFindSql({
            terms: ['love', 'enemies'],
            weights: [0.5, 3.2],
            bookKeys: ['MAT', 'LUK'],
            need: 2,
            limit: 8,
        });
        expect(sql.selectSql).toBe(
            "SELECT text, hits, r FROM (SELECT text, rowid AS r, (sText LIKE '%love%') + " +
                "(sText LIKE '%enemies%') AS hits, (sText LIKE '%love%') * 0.5 + " +
                "(sText LIKE '%enemies%') * 3.2 AS score FROM verses WHERE " +
                "(text LIKE 'MAT.%' OR text LIKE 'LUK.%')) WHERE hits >= 2 " +
                'ORDER BY hits DESC, score DESC, r LIMIT 8;',
        );
        expect(sql.countSql).toContain('WHERE hits >= 2;');
        expect(sql.termCountSql('love')).toBe(
            "SELECT COUNT(*) AS count FROM verses WHERE (sText LIKE '%love%');",
        );
    });

    it('holds the page size and the book keys to what they may be', () => {
        const sql = genVerseFindSql({
            terms: ['love'],
            weights: [1],
            bookKeys: ["MAT' OR 1=1 --"],
            need: 0,
            limit: 500,
        });
        expect(sql.selectSql).toContain(`LIMIT ${MAX_FIND_CANDIDATES};`);
        expect(sql.selectSql).toContain('hits >= 1 ');
        expect(sql.selectSql).toContain("text LIKE 'MATOR11.%'");
    });
});

describe('words, not letters that meet across a space', () => {
    // Found live in the KJV: "lover your enemy" ranked Exodus 15:9 -- "I
    // will overtake" -- because the table holds the words run together.
    it('counts a term only at the start of a word', () => {
        const words = 'the enemy said i will pursue i will overtake'.split(' ');
        expect(countWordHits(words, ['lover', 'enemy', 'pursu'])).toEqual([
            false,
            true,
            true,
        ]);
        expect(countWordHits(['Lovest'], ['love'])).toEqual([true]);
    });

    it('cuts an English word back to what its forms share', () => {
        expect(toEnglishStem('enemy')).toBe('enem');
        expect(toEnglishStem('enemies')).toBe('enem');
        expect(toEnglishStem('prayed')).toBe('pray');
        expect(toEnglishStem('praying')).toBe('pray');
        expect(toEnglishStem('loveth')).toBe('lov');
        expect(toEnglishStem('persecute')).toBe('persecut');
        expect(toEnglishStem('lovers')).toBe('lover');
        expect(toEnglishStem('love')).toBe('love');
        expect(toEnglishStem('bless')).toBe('bless');
        expect(toEnglishStem('his')).toBe('his');
    });

    it('reads Khmer and its neighbours run together', () => {
        expect(checkIsSpacedLocale('en-US')).toBe(true);
        expect(checkIsSpacedLocale('fr')).toBe(true);
        expect(checkIsSpacedLocale('km-KH')).toBe(false);
        expect(checkIsSpacedLocale('th')).toBe(false);
    });
});

describe('letters typed with no space', () => {
    // The user's own, 2026-10-16: "Jesus asked Peter many times", typed as
    // one run of Khmer letters, matched nothing.
    const vocabulary = new Set([
        'ព្រះ',
        'យេស',
        'សួរ',
        'ពេត្រុស',
        'ច្រើន',
        'ដង',
    ]);

    it('cuts them into the words the Bible uses', () => {
        expect(
            segmentByVocabulary('ព្រះយេស៊ូសួរពេត្រុសច្រើនដង', vocabulary),
        ).toEqual(['ព្រះ', 'យេស៊ូ', 'សួរ', 'ពេត្រុស', 'ច្រើន', 'ដង']);
    });

    it('keeps letters no word starts with, together', () => {
        expect(segmentByVocabulary('xyzសួរab', vocabulary)).toEqual([
            'xyz',
            'សួរ',
            'ab',
        ]);
        expect(segmentByVocabulary('', vocabulary)).toEqual([]);
    });

    it('takes the longest word first', () => {
        expect(
            segmentByVocabulary('abcd', new Set(['ab', 'abc', 'cd'])),
        ).toEqual(['abc', 'd']);
    });
});

describe('a found row', () => {
    it('reads the table and the online answer alike', () => {
        expect(parseFoundVerseRow('JHN.3:16=>For God so loved')).toEqual({
            bookKey: 'JHN',
            chapter: 3,
            verse: 16,
            text: 'For God so loved',
        });
        expect(parseFoundVerseRow('1JN.4:8:He that loveth not')).toEqual({
            bookKey: '1JN',
            chapter: 4,
            verse: 8,
            text: 'He that loveth not',
        });
        expect(parseFoundVerseRow('not a row')).toBeNull();
    });

    it('takes the number off a single verse’s text', () => {
        expect(toSingleVerseText('(34): Take therefore')).toBe(
            'Take therefore',
        );
        expect(toSingleVerseText('(១៦): ដ្បិត')).toBe('ដ្បិត');
        expect(toSingleVerseText('Take (34): it')).toBe('Take (34): it');
    });

    it('cuts a long verse to a line', () => {
        const cut = cutFoundText('word '.repeat(200), 20);
        expect(cut.length).toBeLessThanOrEqual(21);
        expect(cut.endsWith('…')).toBe(true);
        expect(cutFoundText('  short\n verse ')).toBe('short verse');
    });
});

describe('verse keys', () => {
    it('writes and reads the key a verse is opened by', () => {
        expect(toVerseKey('JHN', 3, 16)).toBe('JHN 3:16');
        expect(toVerseKey('PSA', 23, 1, 6)).toBe('PSA 23:1-6');
        expect(toVerseKey('PSA', 23, 4, 4)).toBe('PSA 23:4');
        expect(readVerseKey('jhn 3:16')).toEqual({
            bookKey: 'JHN',
            chapter: 3,
            verseStart: 16,
            verseEnd: 16,
        });
        expect(readVerseKey('PSA 23:1-6')?.verseEnd).toBe(6);
        expect(readVerseKey('John 3:16')).toBeNull();
        expect(readVerseKey('JHN 3')).toBeNull();
    });
});

describe('a book named as it is said', () => {
    const nameMapList = [{ JHN: 'យ៉ូហាន' }, ENGLISH_NAMES];

    it('reads a code, a name, a singular and the Bible’s own name', () => {
        expect(resolveBookKey('JHN', nameMapList)).toBe('JHN');
        expect(resolveBookKey('john', nameMapList)).toBe('JHN');
        expect(resolveBookKey('1 John', nameMapList)).toBe('1JN');
        expect(resolveBookKey('1john', nameMapList)).toBe('1JN');
        expect(resolveBookKey('Psalm', nameMapList)).toBe('PSA');
        // The KJV's own name is the singular.
        expect(resolveBookKey('Psalms', [{ PSA: 'Psalm' }])).toBe('PSA');
        expect(resolveBookKey('Rev', nameMapList)).toBe('REV');
        expect(resolveBookKey('Philip', nameMapList)).toBe('PHP');
        expect(resolveBookKey('jud', nameMapList)).toBe('JUD');
        expect(resolveBookKey('យ៉ូហាន', nameMapList)).toBe('JHN');
    });

    it('guesses no book a short form leaves open', () => {
        expect(resolveBookKey('Jo', nameMapList)).toBeNull();
        expect(resolveBookKey('Phil.', nameMapList)).toBeNull();
        expect(resolveBookKey('Ju', nameMapList)).toBeNull();
        expect(resolveBookKey('Hezekiah', nameMapList)).toBeNull();
        expect(resolveBookKey('', nameMapList)).toBeNull();
    });

    it('narrows a search to the books named, and names the rest', () => {
        expect(
            resolveBookFilter('Matthew, John and Psalms; Hezekiah', [
                ENGLISH_NAMES,
            ]),
        ).toEqual({ bookKeys: ['MAT', 'JHN', 'PSA'], unknown: ['Hezekiah'] });
    });
});

describe('references as they are written', () => {
    it('splits a list without splitting a verse list', () => {
        expect(
            splitRefList(
                'Matthew 6:34; Philippians 4:6-7\nJohn 3:16, 17, 1 John 4:18',
            ),
        ).toEqual([
            'Matthew 6:34',
            'Philippians 4:6-7',
            'John 3:16, 17',
            '1 John 4:18',
        ]);
        expect(
            splitRefList(
                Array.from({ length: 20 }, () => 'John 3:16').join('; '),
            ),
        ).toHaveLength(MAX_FIND_REFS);
    });

    it('reads a verse, a range, a pair and a whole chapter', () => {
        expect(parseRefParts('1 John 4:18')).toEqual({
            book: '1 John',
            chapter: 4,
            verseStart: 18,
            verseEnd: 18,
        });
        expect(parseRefParts('Philippians 4:6-7')?.verseEnd).toBe(7);
        expect(parseRefParts('John 3:16, 17')?.verseEnd).toBe(17);
        expect(parseRefParts('Psalm 119:105')).toEqual({
            book: 'Psalm',
            chapter: 119,
            verseStart: 105,
            verseEnd: 105,
        });
        expect(parseRefParts('Psalm 23')).toEqual({
            book: 'Psalm',
            chapter: 23,
            verseStart: null,
            verseEnd: null,
        });
        expect(parseRefParts('John 3:16-2')?.verseEnd).toBe(16);
        expect(parseRefParts('no numbers here')).toBeNull();
    });
});

describe('a verse past the end of its chapter', () => {
    it('does not fit, and says how many there are', () => {
        expect(checkVerseFitsChapter(24, 1, 24)).toBe(true);
        expect(checkVerseFitsChapter(24, 24, 24)).toBe(true);
        expect(checkVerseFitsChapter(24, 203)).toBe(false);
        expect(checkVerseFitsChapter(24, 20, 30)).toBe(false);
        expect(checkVerseFitsChapter(24, 0)).toBe(false);
        // A chapter that could not be read is not a verdict.
        expect(checkVerseFitsChapter(null, 203)).toBe(true);
        expect(genVerseRangeReason('Genesis', 3, 24)).toBe(
            'Genesis 3 has 24 verses.',
        );
        expect(genVerseRangeReason('Genesis', 3, 1)).toBe(
            'Genesis 3 has 1 verse.',
        );
    });
});

describe('the Bible that names the book the way it was written', () => {
    const INFO_LIST = [
        { key: 'KJV', keyBookMap: { GEN: 'Genesis', JHN: 'John' } },
        { key: 'ពគប', keyBookMap: { GEN: 'លោកុប្បត្តិ', JHN: 'យ៉ូហាន' } },
    ];

    it('is the preferred one when it has the name', () => {
        expect(pickBibleKeyForBookName('Genesis', INFO_LIST, 'KJV')).toBe(
            'KJV',
        );
    });

    it('else the one that does', () => {
        expect(pickBibleKeyForBookName('លោកុប្បត្តិ', INFO_LIST, 'KJV')).toBe(
            'ពគប',
        );
        expect(pickBibleKeyForBookName('1 John', INFO_LIST, 'KJV')).toBe('KJV');
    });

    it('else the preferred one, never a guess', () => {
        expect(pickBibleKeyForBookName('Psalms', INFO_LIST, 'KJV')).toBe('KJV');
        expect(pickBibleKeyForBookName('', INFO_LIST, 'KJV')).toBe('KJV');
    });
});
